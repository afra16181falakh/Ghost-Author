"""
/api/repos  — Repository management

Heatmap results are cached in Redis (TTL 5 min) and invalidated on run completion.
Falls back to direct DB query if Redis is unavailable.
"""
import asyncio
import json
import uuid
from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models import Repo, RepoStatus, Run, RunStatus, SmellReport
from api.schemas import RepoCreate, RepoOut, HeatmapFileOut, HeatmapFunctionOut

router = APIRouter(prefix="/api/repos", tags=["repos"])

HEATMAP_CACHE_TTL = 300  # 5 minutes


async def _get_redis():
    """Return the shared Redis client from ws_manager if available."""
    from api.ws_manager import ws_manager
    return ws_manager._redis


def _heatmap_cache_key(repo_id: Optional[str]) -> str:
    return f"ghost:heatmap:{repo_id or 'global'}"


async def _cache_get(key: str) -> Optional[list]:
    redis = await _get_redis()
    if not redis:
        return None
    try:
        raw = await redis.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def _cache_set(key: str, value: list) -> None:
    redis = await _get_redis()
    if not redis:
        return
    try:
        await redis.setex(key, HEATMAP_CACHE_TTL, json.dumps(value))
    except Exception:
        pass


async def invalidate_heatmap_cache(repo_id: Optional[str] = None) -> None:
    """Call after a run completes to bust the relevant cache entry."""
    redis = await _get_redis()
    if not redis:
        return
    try:
        await redis.delete(_heatmap_cache_key(repo_id))
        await redis.delete(_heatmap_cache_key(None))  # global heatmap
    except Exception:
        pass


@router.get("", response_model=List[RepoOut])
async def list_repos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo).order_by(Repo.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=RepoOut, status_code=201)
async def create_repo(body: RepoCreate, db: AsyncSession = Depends(get_db)):
    full_name = f"{body.github_owner}/{body.name}"
    # Ensure no duplicate
    existing = await db.execute(select(Repo).where(Repo.full_name == full_name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Repo '{full_name}' already connected")

    repo = Repo(
        id=str(uuid.uuid4()),
        name=body.name,
        github_owner=body.github_owner,
        full_name=full_name,
        local_path=body.local_path,
        default_branch=body.default_branch,
        status=RepoStatus.idle,
    )
    db.add(repo)
    await db.flush()
    await db.refresh(repo)
    return repo


@router.get("/{repo_id}", response_model=RepoOut)
async def get_repo(repo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    return repo


@router.delete("/{repo_id}", status_code=204)
async def delete_repo(repo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    await db.delete(repo)


@router.patch("/{repo_id}/pause", response_model=RepoOut)
async def pause_repo(repo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    repo.status = RepoStatus.paused if repo.status == RepoStatus.active else RepoStatus.active
    await db.flush()
    await db.refresh(repo)
    return repo


@router.get("/{repo_id}/heatmap", response_model=List[HeatmapFileOut])
async def get_repo_heatmap(repo_id: str, db: AsyncSession = Depends(get_db)):
    """Heatmap for a specific repo — cached in Redis for 5 min."""
    cache_key = _heatmap_cache_key(repo_id)
    cached = await _cache_get(cache_key)
    if cached is not None:
        return [HeatmapFileOut(**item) for item in cached]
    data = await _build_heatmap(db, repo_id=repo_id)
    await _cache_set(cache_key, [item.model_dump() for item in data])
    return data


@router.post("/{repo_id}/scan", response_model=List[HeatmapFileOut])
async def scan_repo(repo_id: str, db: AsyncSession = Depends(get_db)):
    """
    Walk the entire local repo and build a live heatmap from real AST analysis.
    Unlike the history-based heatmap, this reflects the codebase's current state.
    """
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    if not repo.local_path:
        raise HTTPException(
            status_code=422,
            detail="Repo has no local_path configured. Set it via the Settings page.",
        )
    heatmap = await asyncio.to_thread(_live_scan, repo.local_path)
    return heatmap


def _live_scan(repo_path: str) -> List[HeatmapFileOut]:
    """
    Blocking: recursively walk repo_path, AST-analyse every .py file,
    and return a heatmap sorted by max cognitive complexity descending.
    """
    import os
    from services.ast_inspector import ASTInspector

    SKIP_DIRS = {"__pycache__", ".git", "node_modules", "venv", ".venv", ".mypy_cache", "dist"}
    results: List[HeatmapFileOut] = []

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS]
        for fname in files:
            if not fname.endswith(".py"):
                continue
            full_path = os.path.join(root, fname)
            rel_path  = os.path.relpath(full_path, repo_path).replace("\\", "/")
            try:
                with open(full_path, "r", encoding="utf-8") as fh:
                    code = fh.read()
                inspector = ASTInspector(code)
                functions = inspector.find_functions()
                if not functions:
                    continue
                func_outs = [
                    HeatmapFunctionOut(
                        name=fn["name"],
                        cognitive=fn["cognitive_complexity"],
                        nesting=fn["nesting_depth"],
                        length=fn["length"],
                        fixed=False,
                    )
                    for fn in functions
                ]
                results.append(HeatmapFileOut(path=rel_path, functions=func_outs))
            except Exception:
                continue

    results.sort(
        key=lambda hf: max((f.cognitive for f in hf.functions), default=0),
        reverse=True,
    )
    return results


async def _build_heatmap(
    db: AsyncSession,
    repo_id: Optional[str],
) -> List[HeatmapFileOut]:
    """
    Joins SmellReport → Run, groups by filepath/function.
    A function is marked fixed if ANY successful run addressed it.
    """
    q = (
        select(SmellReport, Run.filepath, Run.status)
        .join(Run, Run.id == SmellReport.run_id)
    )
    if repo_id:
        q = q.where(Run.repo_id == repo_id)

    rows = (await db.execute(q)).all()

    # filepath → func_name → best entry
    file_map: dict[str, dict[str, dict]] = defaultdict(dict)

    for smell, filepath, status in rows:
        fname = smell.function_name
        is_fixed = status == RunStatus.success
        existing = file_map[filepath].get(fname)

        if not existing:
            file_map[filepath][fname] = {
                "name":     fname,
                "cognitive": smell.cognitive_complexity,
                "nesting":   smell.nesting_depth,
                "length":    smell.length,
                "fixed":     is_fixed,
            }
        else:
            # Preserve worst scores; mark fixed if any successful run exists
            existing["cognitive"] = max(existing["cognitive"], smell.cognitive_complexity)
            existing["nesting"]   = max(existing["nesting"],   smell.nesting_depth)
            existing["length"]    = max(existing["length"],    smell.length)
            if is_fixed:
                existing["fixed"] = True

    # Sort files by max cognitive complexity descending
    result = []
    for path, funcs in file_map.items():
        func_list = list(funcs.values())
        func_list.sort(key=lambda f: f["cognitive"], reverse=True)
        result.append(HeatmapFileOut(path=path, functions=[HeatmapFunctionOut(**f) for f in func_list]))

    result.sort(key=lambda hf: max((f.cognitive for f in hf.functions), default=0), reverse=True)
    return result
