"""
/api/metrics  — Aggregated stats computed live from PostgreSQL
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models import Run, RunStatus, SmellReport
from api.schemas import MetricsOut, WeeklyPoint, SmellBreakdown

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("", response_model=MetricsOut)
async def get_metrics(db: AsyncSession = Depends(get_db)):
    # ── Aggregate run counts ───────────────────────────────────────────────
    totals = await db.execute(
        select(
            func.count(Run.id).label("total"),
            func.sum(case((Run.status == RunStatus.success, 1), else_=0)).label("passed"),
            func.sum(case((Run.status == RunStatus.failed, 1), else_=0)).label("failed"),
            func.sum(case((Run.pr_url.isnot(None), 1), else_=0)).label("prs"),
            func.avg(Run.attempts).label("avg_attempts"),
            func.avg(Run.duration_sec).label("avg_time"),
        )
    )
    row = totals.one()

    total_runs   = row.total or 0
    fixes_passed = int(row.passed or 0)
    fixes_failed = int(row.failed or 0)
    prs_gen      = int(row.prs or 0)
    avg_attempts = round(float(row.avg_attempts or 0), 1)
    avg_time     = round(float(row.avg_time or 0), 1)
    success_rate = round((fixes_passed / total_runs * 100) if total_runs else 0, 1)

    # ── Smell count ────────────────────────────────────────────────────────
    smell_count = await db.execute(select(func.count(SmellReport.id)))
    issues_found = smell_count.scalar() or 0

    # ── Weekly trend (last 7 days) ─────────────────────────────────────────
    weekly: list[WeeklyPoint] = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day)
        day_end   = day_start + timedelta(days=1)

        found_q = await db.execute(
            select(func.count(SmellReport.id))
            .join(Run, Run.id == SmellReport.run_id)
            .where(Run.started_at >= day_start, Run.started_at < day_end)
        )
        fixed_q = await db.execute(
            select(func.count(Run.id))
            .where(Run.status == RunStatus.success, Run.started_at >= day_start, Run.started_at < day_end)
        )
        weekly.append(WeeklyPoint(
            day=day.strftime("%a"),
            found=found_q.scalar() or 0,
            fixed=fixed_q.scalar() or 0,
        ))

    # ── Smell type breakdown ───────────────────────────────────────────────
    # smells_json is a JSON array of {type, msg}; aggregate by type
    all_smells_q = await db.execute(select(SmellReport.smells_json))
    type_counts: dict[str, int] = {}
    for (smells_json,) in all_smells_q:
        if isinstance(smells_json, list):
            for s in smells_json:
                t = s.get("type", "unknown") if isinstance(s, dict) else "unknown"
                type_counts[t] = type_counts.get(t, 0) + 1

    label_map = {
        "nested_conditionals": "Nested Conditionals",
        "large_function": "Large Function",
        "cognitive_complexity": "Cognitive Complexity",
    }
    smell_breakdown = [
        SmellBreakdown(type=label_map.get(k, k), count=v)
        for k, v in sorted(type_counts.items(), key=lambda x: -x[1])
    ]

    return MetricsOut(
        total_runs=total_runs,
        issues_found=issues_found,
        fixes_passed=fixes_passed,
        fixes_failed=fixes_failed,
        prs_generated=prs_gen,
        avg_attempts=avg_attempts,
        success_rate=success_rate,
        avg_time_sec=avg_time,
        weekly_trend=weekly,
        smell_breakdown=smell_breakdown,
    )
