"""
/api/audit  — Audit log viewer (read-only)

Records every run trigger, settings change, and repo connect/delete so
teams can track who changed what and when.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models import AuditLog
from api.schemas import AuditLogOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=List[AuditLogOut])
async def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action, e.g. 'run.trigger'"),
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return recent audit events, newest first."""
    q = select(AuditLog).order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    if action:
        q = q.where(AuditLog.action == action)
    result = await db.execute(q)
    return result.scalars().all()
