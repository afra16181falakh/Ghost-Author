"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id",           postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("github_id",    sa.Integer(),  nullable=False),
        sa.Column("login",        sa.String(128), nullable=False),
        sa.Column("name",         sa.String(256), nullable=True),
        sa.Column("avatar_url",   sa.Text(),      nullable=True),
        sa.Column("email",        sa.String(256), nullable=True),
        sa.Column("access_token", sa.Text(),      nullable=True),
        sa.Column("created_at",   sa.DateTime(),  nullable=True),
        sa.Column("last_login",   sa.DateTime(),  nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("github_id"),
        sa.UniqueConstraint("login"),
    )

    op.create_table(
        "repos",
        sa.Column("id",             postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("owner_id",       postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("name",           sa.String(256), nullable=False),
        sa.Column("github_owner",   sa.String(128), nullable=False),
        sa.Column("full_name",      sa.String(512), nullable=False),
        sa.Column("status",         sa.String(32),  nullable=True),
        sa.Column("local_path",     sa.Text(),      nullable=True),
        sa.Column("default_branch", sa.String(128), nullable=True),
        sa.Column("total_fixes",    sa.Integer(),   nullable=True),
        sa.Column("total_runs",     sa.Integer(),   nullable=True),
        sa.Column("last_run_at",    sa.DateTime(),  nullable=True),
        sa.Column("created_at",     sa.DateTime(),  nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("full_name"),
    )

    op.create_table(
        "runs",
        sa.Column("id",           postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("repo_id",      postgresql.UUID(as_uuid=False), nullable=True),   # nullable — local runs have no repo
        sa.Column("filepath",     sa.Text(),     nullable=False),
        sa.Column("branch",       sa.String(512), nullable=True),
        sa.Column("status",       sa.String(32),  nullable=True),
        sa.Column("attempts",     sa.Integer(),   nullable=True),
        sa.Column("pr_url",       sa.Text(),      nullable=True),
        sa.Column("diff",         sa.Text(),      nullable=True),
        sa.Column("test_output",  sa.Text(),      nullable=True),
        sa.Column("duration_sec", sa.Float(),     nullable=True),
        sa.Column("started_at",   sa.DateTime(),  nullable=True),
        sa.Column("completed_at", sa.DateTime(),  nullable=True),
        sa.ForeignKeyConstraint(["repo_id"], ["repos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "smell_reports",
        sa.Column("id",                   postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("run_id",               postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("function_name",        sa.String(256), nullable=False),
        sa.Column("start_line",           sa.Integer(),   nullable=False),
        sa.Column("end_line",             sa.Integer(),   nullable=False),
        sa.Column("nesting_depth",        sa.Integer(),   nullable=False),
        sa.Column("length",               sa.Integer(),   nullable=False),
        sa.Column("cognitive_complexity", sa.Integer(),   nullable=False),
        sa.Column("smells_json",          postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "run_logs",
        sa.Column("id",      postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("run_id",  postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("ts",      sa.DateTime(),  nullable=True),
        sa.Column("level",   sa.String(16),  nullable=True),
        sa.Column("message", sa.Text(),      nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_run_logs_run_id", "run_logs", ["run_id"])

    op.create_table(
        "agent_settings",
        sa.Column("id",             postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id",        postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("max_attempts",   sa.Integer(), nullable=True),
        sa.Column("max_cognitive",  sa.Integer(), nullable=True),
        sa.Column("max_nesting",    sa.Integer(), nullable=True),
        sa.Column("max_length",     sa.Integer(), nullable=True),
        sa.Column("github_enabled", sa.Boolean(), nullable=True),
        sa.Column("github_token",   sa.Text(),    nullable=True),
        sa.Column("github_owner",   sa.String(128), nullable=True),
        sa.Column("github_repo",    sa.String(256), nullable=True),
        sa.Column("gemini_api_key", sa.Text(),    nullable=True),
        sa.Column("model_name",     sa.String(128), nullable=True),
        sa.Column("use_docker",     sa.Boolean(), nullable=True),
        sa.Column("docker_image",   sa.String(256), nullable=True),
        sa.Column("branch_prefix",  sa.String(128), nullable=True),
        sa.Column("allowlist_dirs", postgresql.JSONB(), nullable=True),
        sa.Column("blacklist_dirs", postgresql.JSONB(), nullable=True),
        sa.Column("updated_at",     sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "metrics_snapshots",
        sa.Column("id",            postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("date",          sa.String(16),  nullable=False),
        sa.Column("total_runs",    sa.Integer(),   nullable=True),
        sa.Column("issues_found",  sa.Integer(),   nullable=True),
        sa.Column("fixes_passed",  sa.Integer(),   nullable=True),
        sa.Column("fixes_failed",  sa.Integer(),   nullable=True),
        sa.Column("prs_generated", sa.Integer(),   nullable=True),
        sa.Column("avg_time_sec",  sa.Float(),     nullable=True),
        sa.Column("created_at",    sa.DateTime(),  nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date"),
    )


def downgrade() -> None:
    op.drop_table("metrics_snapshots")
    op.drop_table("agent_settings")
    op.drop_index("ix_run_logs_run_id", table_name="run_logs")
    op.drop_table("run_logs")
    op.drop_table("smell_reports")
    op.drop_table("runs")
    op.drop_table("repos")
    op.drop_table("users")
