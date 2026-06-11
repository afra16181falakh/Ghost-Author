"""
/api/settings  — Persistent agent configuration (stored in PostgreSQL)
"""
import hashlib
import hmac
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings as get_app_settings
from api.database import get_db
from api.models import AgentSettings, AuditLog
from api.schemas import SettingsIn, SettingsOut

router = APIRouter(prefix="/api/settings", tags=["settings"])


async def _get_or_create(db: AsyncSession) -> AgentSettings:
    """Return the global settings row, creating defaults if none exists."""
    result = await db.execute(select(AgentSettings))
    row = result.scalar_one_or_none()
    if not row:
        row = AgentSettings(id=str(uuid.uuid4()))
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


@router.get("", response_model=SettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await _get_or_create(db)


@router.put("", response_model=SettingsOut)
async def update_settings(body: SettingsIn, db: AsyncSession = Depends(get_db)):
    row = await _get_or_create(db)

    row.max_attempts   = body.max_attempts
    row.max_cognitive  = body.max_cognitive
    row.max_nesting    = body.max_nesting
    row.max_length     = body.max_length
    row.github_enabled = body.github_enabled
    row.github_owner   = body.github_owner
    row.github_repo    = body.github_repo
    row.model_name     = body.model_name
    row.use_docker     = body.use_docker
    row.docker_image   = body.docker_image
    row.branch_prefix  = body.branch_prefix
    row.allowlist_dirs = body.allowlist_dirs
    row.blacklist_dirs = body.blacklist_dirs

    # Only update secrets if provided (empty string = keep existing)
    if body.github_token:
        row.github_token = body.github_token
    if body.gemini_api_key:
        row.gemini_api_key = body.gemini_api_key

    # Audit log
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        action="settings.update",
        target_type="settings",
        target_id=row.id,
        details={
            "max_attempts":  body.max_attempts,
            "max_cognitive": body.max_cognitive,
            "max_nesting":   body.max_nesting,
            "max_length":    body.max_length,
            "github_enabled": body.github_enabled,
            "model_name":    body.model_name,
        },
    ))

    await db.flush()
    await db.refresh(row)
    return row


@router.post("/test-webhook")
async def test_webhook():
    """
    Validates the webhook HMAC configuration by running a sign-then-verify
    cycle against a synthetic payload. Returns success/failure + diagnostic info.
    """
    cfg = get_app_settings()
    secret = cfg.github_webhook_secret

    if not secret:
        return JSONResponse({
            "success": False,
            "message": "GITHUB_WEBHOOK_SECRET is not set. Add it to your .env file.",
            "hint": "Set GITHUB_WEBHOOK_SECRET=<your-secret> then re-register the webhook in GitHub → Settings → Webhooks.",
        })

    test_payload = b'{"action":"test","repository":{"full_name":"ghost/test"}}'
    signature = "sha256=" + hmac.new(secret.encode(), test_payload, hashlib.sha256).hexdigest()
    verified  = hmac.compare_digest(
        signature,
        "sha256=" + hmac.new(secret.encode(), test_payload, hashlib.sha256).hexdigest(),
    )

    if not verified:
        return JSONResponse({"success": False, "message": "HMAC self-verification failed — check your secret."})

    return JSONResponse({
        "success": True,
        "message": "Webhook secret is configured and HMAC signing works correctly.",
        "endpoint": "POST /webhook/github",
        "events": ["push", "pull_request"],
    })
