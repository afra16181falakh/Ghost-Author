"""
Ghost Author — FastAPI application entry point.

Starts on port 8000. Frontend (Vite/Nginx) runs on 3000.
"""
import hashlib
import hmac
import logging
import logging.config
import sys
import uuid
from contextlib import asynccontextmanager
from typing import List

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings, validate_startup
from api.database import create_all_tables, get_db
from api.schemas import HeatmapFileOut
from api.routes.runs import router as runs_router
from api.routes.repos import router as repos_router
from api.routes.metrics import router as metrics_router
from api.routes.settings import router as settings_router
from api.routes.audit import router as audit_router
from api.auth import router as auth_router
from api.ws_manager import ws_manager

settings = get_settings()

# ── Startup validation ────────────────────────────────────────────────────────
validate_startup(settings)

# ── Sentry ────────────────────────────────────────────────────────────────────
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.2,
    )

# ── Structured JSON logging ────────────────────────────────────────────────────
def _configure_logging():
    if settings.environment == "production":
        from pythonjsonlogger import jsonlogger
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%SZ",
        ))
        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(logging.INFO)
    else:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler("ghost_author.log", mode="a", encoding="utf-8"),
            ],
        )

_configure_logging()
logger = logging.getLogger("ghost_author")

# ── Rate limiter ────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# ── Lifespan ────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Ghost Author API starting up…", extra={"version": "3.0.0", "env": settings.environment})
    await create_all_tables()
    await ws_manager.startup(settings.redis_url if settings.redis_url else None)
    logger.info("Startup complete.")
    yield
    await ws_manager.shutdown()
    logger.info("Ghost Author API shut down.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ghost Author API",
    description="AI-powered autonomous code quality agent — REST API + WebSocket",
    version="3.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5176",
        settings.frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus metrics ─────────────────────────────────────────────────────────
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
    logger.info("Prometheus metrics exposed at /metrics")
except ImportError:
    logger.warning("prometheus-fastapi-instrumentator not installed — /metrics disabled")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(runs_router)
app.include_router(repos_router)
app.include_router(metrics_router)
app.include_router(settings_router)
app.include_router(audit_router)


# ── Global heatmap ─────────────────────────────────────────────────────────────
@app.get("/api/heatmap", response_model=List[HeatmapFileOut], tags=["heatmap"])
async def global_heatmap(db: AsyncSession = Depends(get_db)):
    from api.routes.repos import _build_heatmap, _cache_get, _cache_set, _heatmap_cache_key
    cache_key = _heatmap_cache_key(None)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return [HeatmapFileOut(**item) for item in cached]
    data = await _build_heatmap(db, repo_id=None)
    await _cache_set(cache_key, [item.model_dump() for item in data])
    return data


# ── Health probes ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health():
    """Basic liveness — always returns 200 if process is up."""
    return {
        "status": "ok",
        "service": "Ghost Author API",
        "version": "3.0.0",
        "environment": settings.environment,
    }


@app.get("/api/health/live", tags=["health"])
async def health_live():
    """Kubernetes liveness probe — returns 200 if process is alive."""
    return {"status": "alive"}


@app.get("/api/health/ready", tags=["health"])
async def health_ready(db: AsyncSession = Depends(get_db)):
    """
    Kubernetes readiness probe — returns 200 only when DB and Redis are reachable.
    Returns 503 if any dependency is unavailable.
    """
    checks: dict = {}

    # Database check
    try:
        await db.execute(select(1))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Redis check
    try:
        if ws_manager._redis:
            await ws_manager._redis.ping()
            checks["redis"] = "ok"
        else:
            checks["redis"] = "not configured"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    all_ok = all(v in ("ok", "not configured") for v in checks.values())
    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "ready" if all_ok else "degraded", "checks": checks},
    )


# ── GitHub Webhook ─────────────────────────────────────────────────────────────
@app.post("/webhook/github", tags=["webhook"])
@limiter.limit("30/minute")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives GitHub push/PR events and triggers Ghost Author runs.

    Register this URL as a webhook in your GitHub repo settings:
      Payload URL: http://<your-host>/webhook/github
      Content type: application/json
      Events: push, pull_request
    """
    from api.models import Run, RunStatus, Repo, AuditLog

    body = await request.body()

    # ── Signature verification ─────────────────────────────────────────────
    if settings.github_webhook_secret:
        sig_header = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(
            settings.github_webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig_header, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = request.headers.get("X-GitHub-Event", "")

    # ── PR merge tracking ──────────────────────────────────────────────────
    if event == "pull_request":
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        if payload.get("action") == "closed" and payload.get("pull_request", {}).get("merged"):
            pr_url = payload["pull_request"].get("html_url", "")
            if pr_url:
                result = await db.execute(select(Run).where(Run.pr_url == pr_url))
                run = result.scalar_one_or_none()
                if run:
                    run.pr_merged = True
                    await db.commit()
                    logger.info(f"PR merged: marked run {run.id} as merged")
        return JSONResponse({"status": "ok", "event": "pull_request"})

    if event != "push":
        return JSONResponse({"status": "ignored", "event": event})

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    from api.js_analyzer import is_js_file
    changed_files: list[str] = []
    for commit in payload.get("commits", []):
        for fp in commit.get("modified", []) + commit.get("added", []):
            if (fp.endswith(".py") or is_js_file(fp)) and fp not in changed_files:
                changed_files.append(fp)

    if not changed_files:
        return JSONResponse({"status": "no_python_files_changed"})

    repo_full_name = payload.get("repository", {}).get("full_name", "")
    repo_result    = await db.execute(select(Repo).where(Repo.full_name == repo_full_name))
    repo           = repo_result.scalar_one_or_none()

    run_ids: list[str] = []
    for filepath in changed_files[:5]:
        run = Run(
            id=str(uuid.uuid4()),
            repo_id=repo.id if repo else None,
            filepath=filepath,
            status=RunStatus.pending,
        )
        db.add(run)
        db.add(AuditLog(
            id=str(uuid.uuid4()),
            action="run.webhook_trigger",
            target_type="run",
            target_id=run.id,
            details={"filepath": filepath, "repo": repo_full_name},
            ip_address=request.client.host if request.client else None,
        ))
        await db.flush()
        _dispatch_run(background_tasks, run.id, repo.id if repo else None)
        run_ids.append(run.id)

    await db.commit()
    logger.info(f"Webhook: triggered {len(run_ids)} run(s) for {repo_full_name}")
    return JSONResponse({"status": "triggered", "run_ids": run_ids, "files": changed_files[:5]})


def _dispatch_run(background_tasks: BackgroundTasks, run_id: str, repo_id: str = None, dry_run: bool = False):
    """
    Dispatch agent run via Celery if available, else fall back to BackgroundTasks.
    """
    try:
        from api.celery_tasks import run_agent_task
        run_agent_task.delay(run_id, repo_id, dry_run)
        logger.info(f"Dispatched run {run_id} via Celery")
    except Exception:
        # Celery/Redis not available — run in-process
        from api.agent_runner import run_agent
        background_tasks.add_task(run_agent, run_id=run_id, repo_id=repo_id, dry_run=dry_run)
        logger.info(f"Dispatched run {run_id} via BackgroundTasks (Celery unavailable)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
        ws="websockets",
    )
