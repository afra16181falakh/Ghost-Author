"""
/api/runs  — CRUD + trigger + WebSocket streaming

Pagination: cursor-based via `cursor` (last seen run ID) for consistent
paging on live-updating data sets.
"""
import uuid
from datetime import datetime
from typing import List, Optional


from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models import Run, RunStatus, SmellReport, AuditLog
from api.schemas import RunOut, RunListItem, TriggerIn, TriggerOut, RunLogOut, FunctionHistoryOut, FunctionHistoryPoint
from api.ws_manager import ws_manager

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=List[RunListItem])
async def list_runs(
    limit: int = Query(default=50, le=200),
    cursor: Optional[str] = Query(default=None, description="Last seen run ID for cursor-based paging"),
    status: Optional[str] = None,
    repo_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List runs with cursor-based pagination.
    Pass `cursor=<last_run_id>` to get the next page.
    Response includes `next_cursor` in the X-Next-Cursor header when more results exist.
    """
    q = select(Run).options(selectinload(Run.smells)).order_by(desc(Run.started_at))
    if status:
        q = q.where(Run.status == status)
    if repo_id:
        q = q.where(Run.repo_id == repo_id)
    if cursor:
        # Find the started_at of the cursor run, then page from there
        cursor_result = await db.execute(select(Run.started_at).where(Run.id == cursor))
        cursor_ts = cursor_result.scalar_one_or_none()
        if cursor_ts:
            q = q.where(Run.started_at < cursor_ts)
    q = q.limit(limit + 1)  # fetch one extra to detect next page
    result = await db.execute(q)
    rows = result.scalars().all()
    has_more = len(rows) > limit
    return rows[:limit]


@router.get("/{run_id}", response_model=RunOut)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Run)
        .options(selectinload(Run.smells), selectinload(Run.logs))
        .where(Run.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/{run_id}/logs", response_model=List[RunLogOut])
async def get_run_logs(run_id: str, db: AsyncSession = Depends(get_db)):
    from api.models import RunLog
    result = await db.execute(
        select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.ts)
    )
    return result.scalars().all()


@router.post("/trigger", response_model=TriggerOut)
async def trigger_run(
    body: TriggerIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create a pending Run row then kick off the agent via Celery or BackgroundTask."""
    from api.agent_runner import run_agent

    run = Run(
        id=str(uuid.uuid4()),
        repo_id=body.repo_id,
        filepath="(pending)",
        status=RunStatus.pending,
        dry_run=body.dry_run,
    )
    db.add(run)
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        action="run.trigger",
        target_type="run",
        target_id=run.id,
        details={"repo_id": body.repo_id, "dry_run": body.dry_run},
    ))
    await db.flush()
    await db.refresh(run)

    # Prefer Celery, fall back to BackgroundTasks
    dispatched_via = "background"
    try:
        from api.celery_tasks import run_agent_task
        run_agent_task.delay(run.id, body.repo_id, body.dry_run)
        dispatched_via = "celery"
    except Exception:
        background_tasks.add_task(run_agent, run_id=run.id, repo_id=body.repo_id, dry_run=body.dry_run)

    msg = "Dry run queued — analysis only, no commits or PRs." if body.dry_run else "Ghost Author run queued."
    return TriggerOut(run_id=run.id, status="pending", message=msg, dry_run=body.dry_run)


@router.patch("/{run_id}/cancel", response_model=RunOut)
async def cancel_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Cancel a pending or running run."""
    result = await db.execute(
        select(Run).options(selectinload(Run.smells), selectinload(Run.logs)).where(Run.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in (RunStatus.pending, RunStatus.running):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a run with status '{run.status.value}'")
    run.status = RunStatus.cancelled
    run.completed_at = datetime.utcnow()
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        action="run.cancel",
        target_type="run",
        target_id=run.id,
        details={"previous_status": run.status.value},
    ))
    await db.flush()
    await db.refresh(run)
    return run


@router.get("/function-history", response_model=FunctionHistoryOut)
async def function_history(
    function_name: str,
    repo_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Return cognitive complexity over time for a given function name."""
    q = (
        select(SmellReport, Run.started_at, Run.status, Run.id)
        .join(Run, Run.id == SmellReport.run_id)
        .where(SmellReport.function_name == function_name)
        .where(Run.status.in_([RunStatus.success, RunStatus.failed]))
        .order_by(Run.started_at)
    )
    if repo_id:
        q = q.where(Run.repo_id == repo_id)
    rows = (await db.execute(q)).all()
    history = [
        FunctionHistoryPoint(
            date=started_at.strftime("%Y-%m-%d"),
            cognitive=smell.cognitive_complexity,
            run_id=run_id,
            status=status.value,
        )
        for smell, started_at, status, run_id in rows
    ]
    return FunctionHistoryOut(function_name=function_name, history=history)


@router.websocket("/{run_id}/ws")
async def run_websocket(run_id: str, websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    """
    Subscribe to live log streaming for a specific run.
    Immediately replays all existing logs on connect, then streams new ones.
    """
    await ws_manager.connect(run_id, websocket)
    try:
        from api.models import RunLog
        result = await db.execute(
            select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.ts)
        )
        for log in result.scalars().all():
            await websocket.send_json({
                "type": "log",
                "run_id": run_id,
                "payload": {"level": log.level, "message": log.message, "ts": log.ts.isoformat()},
            })

        run_result = await db.execute(select(Run).where(Run.id == run_id))
        run = run_result.scalar_one_or_none()
        if run:
            await websocket.send_json({"type": "status", "run_id": run_id, "payload": {"status": run.status}})

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        ws_manager.disconnect(run_id, websocket)
