"""
Celery tasks — thin wrappers around the async agent runner.
"""
import asyncio
import logging

from api.celery_app import celery_app

logger = logging.getLogger("ghost_author")


@celery_app.task(
    name="api.celery_tasks.run_agent_task",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def run_agent_task(self, run_id: str, repo_id: str = None, dry_run: bool = False):
    """Execute Ghost Author agent pipeline for a single run_id."""
    from api.agent_runner import run_agent
    try:
        asyncio.run(run_agent(run_id, repo_id=repo_id, dry_run=dry_run))
    except Exception as exc:
        logger.error(f"Celery task failed for run {run_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc)
