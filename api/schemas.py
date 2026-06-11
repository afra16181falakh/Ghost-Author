"""
Pydantic v2 schemas for API request/response serialization.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict


# ── Shared base ───────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Smell ─────────────────────────────────────────────────────────────────────

class SmellItem(BaseModel):
    type: str
    msg: str


class SmellReportOut(OrmBase):
    id: str
    function_name: str
    start_line: int
    end_line: int
    nesting_depth: int
    length: int
    cognitive_complexity: int
    smells_json: List[SmellItem]


# ── Run Log ───────────────────────────────────────────────────────────────────

class RunLogOut(OrmBase):
    id: str
    ts: datetime
    level: str
    message: str


# ── Run ───────────────────────────────────────────────────────────────────────

class RunOut(OrmBase):
    id: str
    repo_id: Optional[str]
    filepath: str
    branch: Optional[str]
    status: str
    attempts: int
    pr_url: Optional[str]
    pr_merged: bool = False
    dry_run: bool = False
    diff: Optional[str]
    test_output: Optional[str]
    duration_sec: Optional[float]
    started_at: datetime
    completed_at: Optional[datetime]
    smells: List[SmellReportOut] = []


class RunListItem(OrmBase):
    """Lightweight version for list views."""
    id: str
    repo_id: Optional[str]
    filepath: str
    branch: Optional[str]
    status: str
    attempts: int
    pr_url: Optional[str]
    pr_merged: bool = False
    dry_run: bool = False
    duration_sec: Optional[float]
    started_at: datetime
    completed_at: Optional[datetime]
    smells: List[SmellReportOut] = []


# ── Repo ──────────────────────────────────────────────────────────────────────

class RepoCreate(BaseModel):
    github_owner: str
    name: str
    local_path: Optional[str] = None
    default_branch: str = "main"


class RepoOut(OrmBase):
    id: str
    name: str
    github_owner: str
    full_name: str
    status: str
    total_fixes: int
    total_runs: int
    last_run_at: Optional[datetime]
    created_at: datetime


# ── User ──────────────────────────────────────────────────────────────────────

class UserOut(OrmBase):
    id: str
    github_id: int
    login: str
    name: Optional[str]
    avatar_url: Optional[str]
    email: Optional[str]
    role: str = "developer"
    created_at: datetime


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsIn(BaseModel):
    max_attempts: int = 3
    max_cognitive: int = 15
    max_nesting: int = 2
    max_length: int = 15
    github_enabled: bool = False
    github_token: Optional[str] = None
    github_owner: Optional[str] = None
    github_repo: Optional[str] = None
    gemini_api_key: Optional[str] = None
    model_name: str = "gemini-2.5-flash"
    use_docker: bool = False
    docker_image: str = "python:3.11-slim"
    branch_prefix: str = "ghost/refactor-"
    allowlist_dirs: List[str] = []
    blacklist_dirs: List[str] = []


class SettingsOut(OrmBase):
    id: str
    max_attempts: int
    max_cognitive: int
    max_nesting: int
    max_length: int
    github_enabled: bool
    github_owner: Optional[str]
    github_repo: Optional[str]
    model_name: str
    use_docker: bool
    docker_image: str
    branch_prefix: str
    allowlist_dirs: List[str]
    blacklist_dirs: List[str]
    updated_at: datetime
    # NOTE: token fields are intentionally excluded from output for security


# ── Metrics ───────────────────────────────────────────────────────────────────

class WeeklyPoint(BaseModel):
    day: str
    fixed: int
    found: int


class SmellBreakdown(BaseModel):
    type: str
    count: int


class MetricsOut(BaseModel):
    total_runs: int
    issues_found: int
    fixes_passed: int
    fixes_failed: int
    prs_generated: int
    avg_attempts: float
    success_rate: float
    avg_time_sec: float
    weekly_trend: List[WeeklyPoint]
    smell_breakdown: List[SmellBreakdown]


# ── Trigger ───────────────────────────────────────────────────────────────────

class TriggerIn(BaseModel):
    repo_id: Optional[str] = None  # None = use config.yaml default
    dry_run: bool = False


class TriggerOut(BaseModel):
    run_id: str
    status: str
    message: str
    dry_run: bool = False


# ── Function history (sparkline) ──────────────────────────────────────────────

class FunctionHistoryPoint(BaseModel):
    date: str
    cognitive: int
    run_id: str
    status: str


class FunctionHistoryOut(BaseModel):
    function_name: str
    history: List[FunctionHistoryPoint]


# ── Auth ──────────────────────────────────────────────────────────────────────

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Heatmap ───────────────────────────────────────────────────────────────────

class HeatmapFunctionOut(BaseModel):
    name: str
    cognitive: int
    nesting: int
    length: int
    fixed: bool


class HeatmapFileOut(BaseModel):
    path: str
    functions: List[HeatmapFunctionOut]


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLogOut(OrmBase):
    id: str
    action: str
    target_type: Optional[str]
    target_id: Optional[str]
    details: Any
    ip_address: Optional[str]
    created_at: datetime


# ── WebSocket message ─────────────────────────────────────────────────────────

class WSMessage(BaseModel):
    type: str          # "log" | "status" | "complete" | "error"
    run_id: str
    payload: Any
