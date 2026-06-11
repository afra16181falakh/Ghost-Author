"""
Alembic migration environment — async-compatible setup for asyncpg / SQLAlchemy 2.x.

Run migrations:
  alembic upgrade head
  alembic revision --autogenerate -m "describe change"
"""
import asyncio
import os
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import pool
from alembic import context

# Import all models so autogenerate sees every mapped class
from api.models import (  # noqa: F401
    User, Repo, Run, SmellReport, RunLog, AgentSettings, MetricsSnapshot,
    AuditLog, ApiKey,
)
from api.database import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Allow DATABASE_URL env var to override alembic.ini (handy in CI / Docker)
DATABASE_URL = os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url")


def run_migrations_offline() -> None:
    """Generate SQL script without a live DB connection."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(DATABASE_URL, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
