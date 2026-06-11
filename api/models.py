"""
SQLAlchemy ORM models — maps directly to PostgreSQL tables.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional
import enum

from api.database import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class RunStatus(str, enum.Enum):
    pending   = "pending"
    running   = "running"
    success   = "success"
    failed    = "failed"
    cancelled = "cancelled"


class RepoStatus(str, enum.Enum):
    active = "active"
    idle   = "idle"
    paused = "paused"


class UserRole(str, enum.Enum):
    admin     = "admin"
    developer = "developer"
    viewer    = "viewer"


# ── User (GitHub OAuth) ───────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str]           = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    github_id: Mapped[int]    = mapped_column(Integer, unique=True, index=True)
    login: Mapped[str]        = mapped_column(String(128), unique=True)
    name: Mapped[str]         = mapped_column(String(256), nullable=True)
    avatar_url: Mapped[str]   = mapped_column(Text, nullable=True)
    email: Mapped[str]        = mapped_column(String(256), nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=True)   # GitHub OAuth token
    role: Mapped[UserRole]    = mapped_column(SAEnum(UserRole), default=UserRole.developer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repos: Mapped[list["Repo"]] = relationship("Repo", back_populates="owner", cascade="all, delete-orphan")
    api_keys: Mapped[list["ApiKey"]] = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")


# ── Repository ────────────────────────────────────────────────────────────────

class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[str]        = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str]  = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    name: Mapped[str]      = mapped_column(String(256))
    github_owner: Mapped[str] = mapped_column(String(128))
    full_name: Mapped[str] = mapped_column(String(512), unique=True)   # owner/repo
    status: Mapped[RepoStatus] = mapped_column(SAEnum(RepoStatus), default=RepoStatus.idle)
    local_path: Mapped[str]  = mapped_column(Text, nullable=True)
    default_branch: Mapped[str] = mapped_column(String(128), default="main")
    total_fixes: Mapped[int]    = mapped_column(Integer, default=0)
    total_runs: Mapped[int]     = mapped_column(Integer, default=0)
    last_run_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped["User"] = relationship("User", back_populates="repos")
    runs: Mapped[list["Run"]] = relationship("Run", back_populates="repo", cascade="all, delete-orphan", order_by="Run.started_at.desc()")


# ── Run ───────────────────────────────────────────────────────────────────────

class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str]        = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    repo_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("repos.id"), nullable=True)
    filepath: Mapped[str]  = mapped_column(Text)
    branch: Mapped[str]    = mapped_column(String(512), nullable=True)
    status: Mapped[RunStatus] = mapped_column(SAEnum(RunStatus), default=RunStatus.pending)
    attempts: Mapped[int]     = mapped_column(Integer, default=0)
    pr_url: Mapped[str]       = mapped_column(Text, nullable=True)
    pr_merged: Mapped[bool]   = mapped_column(Boolean, default=False)
    dry_run: Mapped[bool]     = mapped_column(Boolean, default=False)
    diff: Mapped[str]         = mapped_column(Text, nullable=True)
    test_output: Mapped[str]  = mapped_column(Text, nullable=True)
    duration_sec: Mapped[float] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    repo: Mapped["Repo"] = relationship("Repo", back_populates="runs")
    smells: Mapped[list["SmellReport"]] = relationship("SmellReport", back_populates="run", cascade="all, delete-orphan")
    logs: Mapped[list["RunLog"]] = relationship("RunLog", back_populates="run", cascade="all, delete-orphan", order_by="RunLog.ts")


# ── Smell Report ──────────────────────────────────────────────────────────────

class SmellReport(Base):
    __tablename__ = "smell_reports"

    id: Mapped[str]            = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str]        = mapped_column(UUID(as_uuid=False), ForeignKey("runs.id"))
    function_name: Mapped[str] = mapped_column(String(256))
    start_line: Mapped[int]    = mapped_column(Integer)
    end_line: Mapped[int]      = mapped_column(Integer)
    nesting_depth: Mapped[int] = mapped_column(Integer)
    length: Mapped[int]        = mapped_column(Integer)
    cognitive_complexity: Mapped[int] = mapped_column(Integer)
    smells_json: Mapped[dict]  = mapped_column(JSON)  # [{type, msg}, ...]

    run: Mapped["Run"] = relationship("Run", back_populates="smells")


# ── Run Log (streaming) ───────────────────────────────────────────────────────

class RunLog(Base):
    __tablename__ = "run_logs"

    id: Mapped[str]      = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str]  = mapped_column(UUID(as_uuid=False), ForeignKey("runs.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    level: Mapped[str]   = mapped_column(String(16), default="INFO")   # INFO | WARNING | ERROR
    message: Mapped[str] = mapped_column(Text)

    run: Mapped["Run"] = relationship("Run", back_populates="logs")


# ── Agent Settings (per-user or global) ───────────────────────────────────────

class AgentSettings(Base):
    __tablename__ = "agent_settings"

    id: Mapped[str]      = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True, unique=True)

    # Thresholds
    max_attempts: Mapped[int]    = mapped_column(Integer, default=3)
    max_cognitive: Mapped[int]   = mapped_column(Integer, default=15)
    max_nesting: Mapped[int]     = mapped_column(Integer, default=2)
    max_length: Mapped[int]      = mapped_column(Integer, default=15)

    # GitHub
    github_enabled: Mapped[bool]  = mapped_column(Boolean, default=False)
    github_token: Mapped[str]     = mapped_column(Text, nullable=True)
    github_owner: Mapped[str]     = mapped_column(String(128), nullable=True)
    github_repo: Mapped[str]      = mapped_column(String(256), nullable=True)

    # AI
    gemini_api_key: Mapped[str]   = mapped_column(Text, nullable=True)
    model_name: Mapped[str]       = mapped_column(String(128), default="gemini-2.5-flash")

    # Runner
    use_docker: Mapped[bool]      = mapped_column(Boolean, default=False)
    docker_image: Mapped[str]     = mapped_column(String(256), default="python:3.11-slim")
    branch_prefix: Mapped[str]    = mapped_column(String(128), default="ghost/refactor-")

    # Policy
    allowlist_dirs: Mapped[list]  = mapped_column(JSON, default=list)
    blacklist_dirs: Mapped[list]  = mapped_column(JSON, default=list)

    updated_at: Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str]          = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    action: Mapped[str]      = mapped_column(String(64), index=True)     # e.g. "run.trigger", "settings.update"
    target_type: Mapped[str] = mapped_column(String(64), nullable=True)  # "run" | "repo" | "settings"
    target_id: Mapped[str]   = mapped_column(String(64), nullable=True)
    details: Mapped[dict]    = mapped_column(JSON, default=dict)
    ip_address: Mapped[str]  = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


# ── API Keys (for CI pipeline authentication) ────────────────────────────────

class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str]          = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]     = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), index=True)
    name: Mapped[str]        = mapped_column(String(128))               # human label, e.g. "CI pipeline"
    key_prefix: Mapped[str]  = mapped_column(String(16), index=True)    # first 8 chars for lookup
    key_hash: Mapped[str]    = mapped_column(String(64))                # SHA-256(full_key)
    scopes: Mapped[list]     = mapped_column(JSON, default=list)        # ["runs:read", "runs:trigger"]
    is_active: Mapped[bool]  = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="api_keys")


# ── Metrics snapshot (daily roll-up, cached by scheduler) ─────────────────────

class MetricsSnapshot(Base):
    __tablename__ = "metrics_snapshots"

    id: Mapped[str]      = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    date: Mapped[str]    = mapped_column(String(16), unique=True)  # YYYY-MM-DD
    total_runs: Mapped[int]    = mapped_column(Integer, default=0)
    issues_found: Mapped[int]  = mapped_column(Integer, default=0)
    fixes_passed: Mapped[int]  = mapped_column(Integer, default=0)
    fixes_failed: Mapped[int]  = mapped_column(Integer, default=0)
    prs_generated: Mapped[int] = mapped_column(Integer, default=0)
    avg_time_sec: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
