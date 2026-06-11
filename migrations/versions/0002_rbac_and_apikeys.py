"""rbac and api keys

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-11

Adds:
  - users.role column (admin|developer|viewer)
  - api_keys table
  - runs.pr_merged, runs.dry_run columns (if not already added manually)
  - audit_logs table (if not in 0001)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── UserRole enum ──────────────────────────────────────────────────────────
    user_role = postgresql.ENUM("admin", "developer", "viewer", name="userrole")
    user_role.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column("role", sa.Enum("admin", "developer", "viewer", name="userrole"),
                  nullable=False, server_default="developer"),
    )

    # ── api_keys table ─────────────────────────────────────────────────────────
    op.create_table(
        "api_keys",
        sa.Column("id",           postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id",      postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name",         sa.String(128), nullable=False),
        sa.Column("key_prefix",   sa.String(16),  nullable=False),
        sa.Column("key_hash",     sa.String(64),  nullable=False),
        sa.Column("scopes",       postgresql.JSONB(), nullable=True),
        sa.Column("is_active",    sa.Boolean(),   nullable=True, server_default="true"),
        sa.Column("last_used_at", sa.DateTime(),  nullable=True),
        sa.Column("created_at",   sa.DateTime(),  nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_api_keys_user_id",    "api_keys", ["user_id"])
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])

    # ── runs: pr_merged + dry_run (added here if not present) ──────────────────
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("runs")}
    if "pr_merged" not in existing_cols:
        op.add_column("runs", sa.Column("pr_merged", sa.Boolean(), server_default="false"))
    if "dry_run" not in existing_cols:
        op.add_column("runs", sa.Column("dry_run", sa.Boolean(), server_default="false"))

    # ── audit_logs table (created here if 0001 didn't include it) ──────────────
    tables = inspector.get_table_names()
    if "audit_logs" not in tables:
        op.create_table(
            "audit_logs",
            sa.Column("id",          postgresql.UUID(as_uuid=False), nullable=False),
            sa.Column("action",      sa.String(64),  nullable=False),
            sa.Column("target_type", sa.String(64),  nullable=True),
            sa.Column("target_id",   sa.String(64),  nullable=True),
            sa.Column("details",     postgresql.JSONB(), nullable=True),
            sa.Column("ip_address",  sa.String(64),  nullable=True),
            sa.Column("created_at",  sa.DateTime(),  nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_audit_logs_action",     "audit_logs", ["action"])
        op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_api_keys_key_prefix", table_name="api_keys")
    op.drop_index("ix_api_keys_user_id",    table_name="api_keys")
    op.drop_table("api_keys")
    op.drop_column("users", "role")
    op.execute("DROP TYPE IF EXISTS userrole")
