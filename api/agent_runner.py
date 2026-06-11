"""
Bridges the Ghost Author agent pipeline with:
 - PostgreSQL persistence (Run, SmellReport, RunLog rows)
 - Real-time WebSocket log streaming via ws_manager
 - ML-based smell risk scoring (RiskScorer)
 - Gemini test generation before retry loop
 - Gemini docstring generation after successful refactor
 - Semantic commit messages via Gemini
 - Slack + GitHub PR notifications on completion
 - Audit logging for every run
"""
import asyncio
import difflib
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import AsyncSessionLocal
from api.models import Run, RunStatus, SmellReport, RunLog, Repo, RepoStatus, AgentSettings, AuditLog
from api.ws_manager import ws_manager

# Ensure Git on PATH (Windows)
GIT_BIN_PATH = r"C:\Program Files\Git\cmd"
if os.path.exists(GIT_BIN_PATH) and GIT_BIN_PATH not in os.environ.get("PATH", ""):
    os.environ["PATH"] = GIT_BIN_PATH + os.pathsep + os.environ["PATH"]

logger = logging.getLogger("ghost_author")


class DBStreamHandler(logging.Handler):
    """
    Custom log handler attached during agent execution.
    - Buffers (level, message, ts) triples in memory
    - Immediately broadcasts each line to live WebSocket subscribers
    - Call flush_to_db() after returning from a blocking thread to persist
    """

    def __init__(self, run_id: str, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.run_id  = run_id
        self.loop    = loop
        self._buffer: list[tuple[str, str, datetime]] = []

    def emit(self, record: logging.LogRecord):
        msg   = self.format(record)
        level = record.levelname
        ts    = datetime.utcnow()
        self._buffer.append((level, msg, ts))
        asyncio.run_coroutine_threadsafe(
            ws_manager.broadcast_log(self.run_id, level, msg),
            self.loop,
        )

    async def flush_to_db(self, db: AsyncSession):
        for level, msg, ts in self._buffer:
            db.add(RunLog(run_id=self.run_id, level=level, message=msg, ts=ts))
        self._buffer.clear()
        await db.flush()


def _get_code_diff(original: str, refactored: str, filename: str) -> str:
    lines = difflib.unified_diff(
        original.splitlines(keepends=True),
        refactored.splitlines(keepends=True),
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}",
    )
    return "".join(lines)


async def _write_audit(db: AsyncSession, action: str, target_type: str, target_id: str, details: dict):
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    ))
    await db.flush()


async def run_agent(run_id: str, repo_id: Optional[str] = None, dry_run: bool = False):
    """
    Full async agent execution. Called as a BackgroundTask.
    Creates its own DB session so it is not tied to the request session.
    """
    loop = asyncio.get_running_loop()

    async with AsyncSessionLocal() as db:
        try:
            await _run_agent_inner(db, loop, run_id, repo_id, dry_run=dry_run)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"run_agent fatal error: {e}", exc_info=True)


async def _run_agent_inner(
    db: AsyncSession,
    loop: asyncio.AbstractEventLoop,
    run_id: str,
    repo_id: Optional[str],
    dry_run: bool = False,
):
    import yaml

    # ── 0. Load settings from DB (fall back to config.yaml) ──────────────────
    settings_result = await db.execute(select(AgentSettings))
    s = settings_result.scalar_one_or_none()

    if s:
        repo_path     = s.allowlist_dirs[0] if s.allowlist_dirs else "demo_repo"
        allowlist     = list(s.allowlist_dirs)
        blacklist     = list(s.blacklist_dirs)
        max_attempts  = s.max_attempts
        max_cognitive = s.max_cognitive
        max_nesting   = s.max_nesting
        max_length    = s.max_length
        use_docker    = s.use_docker
        docker_image  = s.docker_image
        branch_prefix = s.branch_prefix
        gh_enabled    = s.github_enabled
        gh_owner      = s.github_owner or "owner"
        gh_repo_name  = s.github_repo  or "repo"
        gh_token      = s.github_token
        gemini_key    = s.gemini_api_key
        model_name    = s.model_name
    else:
        cfg: dict = {}
        if os.path.exists("config.yaml"):
            with open("config.yaml", "r") as f:
                cfg = yaml.safe_load(f) or {}
        repo_path     = cfg.get("repo_path",     "demo_repo")
        allowlist     = cfg.get("allowlist_dirs", [])
        blacklist     = cfg.get("blacklist_dirs", [])
        max_attempts  = cfg.get("max_attempts",  3)
        max_cognitive = cfg.get("max_cognitive", 15)
        max_nesting   = cfg.get("max_nesting",   2)
        max_length    = cfg.get("max_length",    15)
        use_docker    = cfg.get("use_docker",    False)
        docker_image  = cfg.get("docker_image",  "python:3.11-slim")
        branch_prefix = cfg.get("branch_prefix", "ghost/refactor-")
        gh_cfg        = cfg.get("github", {})
        gh_enabled    = gh_cfg.get("enabled",    False)
        gh_owner      = gh_cfg.get("repo_owner", "owner")
        gh_repo_name  = gh_cfg.get("repo_name",  "repo")
        gh_token      = os.environ.get("GITHUB_TOKEN")
        gemini_key    = os.environ.get("GEMINI_API_KEY")
        model_name    = "gemini-2.5-flash"

    if gemini_key:
        os.environ["GEMINI_API_KEY"] = gemini_key

    slack_url = os.environ.get("SLACK_WEBHOOK_URL", "")

    # ── 1. Attach streaming log handler ──────────────────────────────────────
    stream_handler = DBStreamHandler(run_id, loop)
    stream_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    ghost_logger = logging.getLogger("ghost_author")
    ghost_logger.addHandler(stream_handler)

    try:
        # ── 2. Load Run row ───────────────────────────────────────────────────
        result = await db.execute(select(Run).where(Run.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            ghost_logger.error(f"Run {run_id} not found")
            return

        # ── 3. Mark as running ────────────────────────────────────────────────
        run.status     = RunStatus.running
        run.started_at = datetime.utcnow()
        if dry_run:
            ghost_logger.info("🔍 DRY RUN mode — analysis only, no commits or PRs will be created.")
        await db.flush()
        await ws_manager.broadcast_status(run_id, "running")

        # ── 4. Import pipeline modules ────────────────────────────────────────
        from domain.diff_ingestor        import DiffIngestor
        from domain.policy_guard         import PolicyGuard
        from domain.suppression_registry import SuppressionRegistry
        from services.smell_analyzer     import SmellAnalyzer
        from services.refactor_planner   import RefactorPlanner
        from services.pr_writer          import PRWriter
        from integrations.github_client  import GitHubClient
        from runners.sandbox_manager     import SandboxManager
        from runners.retry_loop          import RetryLoop
        from services.risk_scorer        import RiskScorer
        from services.notification_service import NotificationService
        from services.test_generator     import has_test_for, generate_tests
        from services.docstring_generator import generate_docstrings

        diff_ingestor   = DiffIngestor(repo_path)
        policy_guard    = PolicyGuard(allowlist, blacklist)
        smell_analyzer  = SmellAnalyzer(
            max_nesting=max_nesting,
            max_length=max_length,
            max_cognitive=max_cognitive,
        )
        sandbox_manager = SandboxManager(repo_path)
        retry_loop      = RetryLoop(
            policy_guard=policy_guard,
            max_attempts=max_attempts,
            use_docker=use_docker,
            docker_image=docker_image,
            model_name=model_name,
        )
        github_client   = GitHubClient(
            enabled=gh_enabled,
            repo_owner=gh_owner,
            repo_name=gh_repo_name,
            token=gh_token,
        )
        notifier = NotificationService(
            slack_webhook_url=slack_url or None,
            github_token=gh_token,
        )

        # ── 5. Train risk scorer on historical data ───────────────────────────
        from api.models import SmellReport as SR
        history_q = (
            select(SR, Run.status)
            .join(Run, Run.id == SR.run_id)
            .where(Run.status.in_([RunStatus.success, RunStatus.failed]))
        )
        history_rows = (await db.execute(history_q)).all()
        training_data = [
            {
                "cognitive_complexity": sr.cognitive_complexity,
                "nesting_depth":        sr.nesting_depth,
                "length":               sr.length,
                "fixed":                status == RunStatus.success,
            }
            for sr, status in history_rows
        ]
        risk_scorer = RiskScorer()
        risk_scorer.train(training_data)
        ghost_logger.info(
            f"Risk scorer ready — {'ML model' if risk_scorer._trained else 'heuristic'} "
            f"({len(training_data)} historical samples)"
        )
        await stream_handler.flush_to_db(db)

        # ── 6. Detect changed files ───────────────────────────────────────────
        changed_files = await asyncio.to_thread(diff_ingestor.get_changed_files)
        ghost_logger.info(f"Changed files: {changed_files}")
        await stream_handler.flush_to_db(db)

        total_issues = 0
        total_fixed  = 0
        final_pr_url = None

        for filepath in changed_files:
            # Cancellation check — another request may have set status=cancelled
            await db.refresh(run)
            if run.status == RunStatus.cancelled:
                ghost_logger.info(f"Run {run_id} was cancelled — stopping.")
                await stream_handler.flush_to_db(db)
                await ws_manager.broadcast_status(run_id, "cancelled")
                return

            if not policy_guard.is_file_allowed(filepath):
                ghost_logger.info(f"Skipping {filepath}: policy guard")
                continue

            full_path = os.path.join(repo_path, filepath)
            if SuppressionRegistry.is_file_ignored(full_path):
                ghost_logger.info(f"Skipping {filepath}: file-level ghost-ignore")
                continue

            try:
                with open(full_path, "r", encoding="utf-8") as fh:
                    original_code = fh.read()
            except Exception as e:
                ghost_logger.error(f"Cannot read {filepath}: {e}")
                continue

            # Route to language-appropriate analyzer
            from api.js_analyzer import is_js_file, analyze_js_file
            if is_js_file(filepath):
                smells = analyze_js_file(
                    filepath, original_code,
                    max_length=max_length,
                    max_nesting=max_nesting,
                    max_cognitive=max_cognitive,
                )
            else:
                smells = smell_analyzer.analyze_file(filepath, original_code)
            if not smells:
                ghost_logger.info(f"No smells in {filepath}")
                continue

            # ── Risk-score and sort smells (riskiest first) ───────────────────
            smells = risk_scorer.rank(smells)
            ghost_logger.info(
                f"{len(smells)} smell(s) in {filepath} — top risk: "
                f"{smells[0]['function_name']} (score {smells[0].get('risk_score', '?')})"
            )
            total_issues += len(smells)

            # Persist SmellReport rows
            for smell in smells:
                db.add(SmellReport(
                    run_id=run_id,
                    function_name=smell["function_name"],
                    start_line=smell["start_line"],
                    end_line=smell["end_line"],
                    nesting_depth=smell["nesting_depth"],
                    length=smell["length"],
                    cognitive_complexity=smell["cognitive_complexity"],
                    smells_json=smell["smells"],
                ))
            await db.flush()

            # ── Process smells in risk order ──────────────────────────────────
            for smell in smells:
                func_name     = smell["function_name"]
                timestamp     = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
                branch_name   = f"{branch_prefix}{func_name}-{timestamp}"
                worktree_path = None

                try:
                    worktree_path = await asyncio.to_thread(
                        sandbox_manager.create_worktree, branch_name
                    )
                    await stream_handler.flush_to_db(db)

                    # ── Generate tests if none exist ──────────────────────────
                    if not has_test_for(func_name, repo_path):
                        ghost_logger.info(f"No tests for {func_name} — generating…")
                        test_code = await asyncio.to_thread(
                            generate_tests, filepath, original_code, func_name, model_name
                        )
                        if test_code:
                            test_filename = f"test_ghost_{func_name}.py"
                            test_path     = os.path.join(worktree_path, test_filename)
                            with open(test_path, "w", encoding="utf-8") as tf:
                                tf.write(test_code)
                            ghost_logger.info(f"Generated test file: {test_filename}")
                        await stream_handler.flush_to_db(db)

                    start_t     = datetime.utcnow()
                    loop_result = await asyncio.to_thread(
                        retry_loop.run, worktree_path, filepath, original_code, smell
                    )
                    duration = (datetime.utcnow() - start_t).total_seconds()
                    await stream_handler.flush_to_db(db)

                    run.attempts     = max(run.attempts, loop_result["attempts"])
                    run.duration_sec = (run.duration_sec or 0.0) + duration

                    if loop_result["success"]:
                        total_fixed += 1
                        refactored_code = loop_result["refactored_code"]

                        diff_str = _get_code_diff(original_code, refactored_code, filepath)
                        run.diff        = (run.diff or "") + diff_str
                        run.test_output = loop_result["test_outcome"].get("output", "")

                        if dry_run:
                            ghost_logger.info(f"✅ [DRY RUN] Would fix {func_name} in {filepath} — skipping commit & PR.")
                        else:
                            # ── Generate docstrings for the refactored code ───
                            ghost_logger.info(f"Generating docstrings for {filepath}…")
                            with_docs = await asyncio.to_thread(
                                generate_docstrings, filepath, refactored_code, model_name
                            )
                            if with_docs:
                                refactored_code = with_docs
                                ghost_logger.info("Docstrings added successfully")
                            await stream_handler.flush_to_db(db)

                            # ── Semantic commit message ───────────────────────
                            smell_types = [si.get("type", "") for si in smell.get("smells", [])]
                            commit_msg  = await asyncio.to_thread(
                                RefactorPlanner.generate_commit_message,
                                filepath, func_name, diff_str, smell_types, model_name,
                            )
                            ghost_logger.info(f"Commit message: {commit_msg}")
                            await stream_handler.flush_to_db(db)

                            pr_body = PRWriter.generate_pr_summary(
                                filepath=filepath,
                                smells=[smell],
                                diff=diff_str,
                                test_outcome=loop_result["test_outcome"],
                                attempts=loop_result["attempts"],
                            )

                            import subprocess
                            try:
                                await asyncio.to_thread(
                                    subprocess.run,
                                    ["git", "add", filepath],
                                    cwd=worktree_path, check=True,
                                )
                                await asyncio.to_thread(
                                    subprocess.run,
                                    ["git", "commit", "-m", commit_msg],
                                    cwd=worktree_path, check=True,
                                )
                            except Exception as ce:
                                ghost_logger.error(f"Commit failed: {ce}")

                            pr_result = await asyncio.to_thread(
                                github_client.create_pull_request,
                                title=commit_msg,
                                body=pr_body,
                                head_branch=branch_name,
                            )
                            if pr_result["success"]:
                                final_pr_url = pr_result["pr_url"]
                                run.pr_url   = final_pr_url
                                await notifier.comment_on_pr(final_pr_url, pr_body)

                            ghost_logger.info(f"✅ Fixed {func_name} in {filepath} — PR: {final_pr_url or 'n/a'}")
                    else:
                        ghost_logger.warning(f"❌ Failed to fix {func_name} in {filepath}")

                    await db.flush()

                except Exception as e:
                    ghost_logger.error(f"Error processing {func_name}: {e}", exc_info=True)
                finally:
                    if worktree_path:
                        await asyncio.to_thread(
                            sandbox_manager.cleanup_worktree, worktree_path, branch_name
                        )

        # ── 7. Finalize run ───────────────────────────────────────────────────
        run.status       = RunStatus.success if total_fixed > 0 else RunStatus.failed
        run.completed_at = datetime.utcnow()
        await db.flush()

        repo_display = "local"
        if repo_id:
            repo_result = await db.execute(select(Repo).where(Repo.id == repo_id))
            repo = repo_result.scalar_one_or_none()
            if repo:
                repo.total_runs  += 1
                repo.total_fixes += total_fixed
                repo.last_run_at  = datetime.utcnow()
                repo.status       = RepoStatus.idle
                repo_display      = repo.full_name
                await db.flush()

        # ── 8. Audit log ──────────────────────────────────────────────────────
        await _write_audit(db, "run.complete", "run", run_id, {
            "status":       run.status.value,
            "total_issues": total_issues,
            "total_fixed":  total_fixed,
            "pr_url":       final_pr_url,
            "duration_sec": run.duration_sec,
        })

        ghost_logger.info(
            f"Run complete. Issues: {total_issues} | Fixed: {total_fixed} | PR: {final_pr_url}"
        )
        await stream_handler.flush_to_db(db)
        await ws_manager.broadcast_complete(run_id, total_fixed > 0, final_pr_url)

        # Invalidate heatmap cache so next request reflects this run
        try:
            from api.routes.repos import invalidate_heatmap_cache
            await invalidate_heatmap_cache(repo_id)
        except Exception:
            pass

        # ── 9. Notifications ──────────────────────────────────────────────────
        await notifier.notify_run_complete(
            repo_name=repo_display,
            filepath=run.filepath,
            total_fixed=total_fixed,
            total_issues=total_issues,
            pr_url=final_pr_url,
            duration_sec=run.duration_sec or 0.0,
        )

    except Exception as e:
        ghost_logger.error(f"Fatal agent error: {e}", exc_info=True)
        run_obj = (await db.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
        if run_obj:
            run_obj.status       = RunStatus.failed
            run_obj.completed_at = datetime.utcnow()
            await db.flush()
        await stream_handler.flush_to_db(db)
        await ws_manager.broadcast_status(run_id, "failed")

    finally:
        ghost_logger.removeHandler(stream_handler)
