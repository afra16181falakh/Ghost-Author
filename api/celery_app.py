"""
Celery application — task queue backed by Redis.

Replaces FastAPI BackgroundTasks for agent execution so that:
  - Tasks survive API restarts
  - Workers can run on separate machines
  - Tasks are retried automatically on failure
"""
from celery import Celery
from api.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ghost_author",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["api.celery_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,           # re-queue on worker crash
    worker_prefetch_multiplier=1,  # one task per worker slot (long-running agent)
    task_default_queue="ghost_agent",
    task_routes={
        "api.celery_tasks.run_agent_task": {"queue": "ghost_agent"},
    },
    # Retry configuration
    task_max_retries=2,
    task_default_retry_delay=30,
)
