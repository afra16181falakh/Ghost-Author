import os
import sys
import yaml
import logging
import difflib
import subprocess
from datetime import datetime
from typing import Dict, Any

# Ensure Git is on PATH (for Windows environment when Git was just installed via winget)
GIT_BIN_PATH = r"C:\Program Files\Git\cmd"
if os.path.exists(GIT_BIN_PATH) and GIT_BIN_PATH not in os.environ["PATH"]:
    os.environ["PATH"] = GIT_BIN_PATH + os.pathsep + os.environ["PATH"]

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("ghost_author.log", mode="w", encoding="utf-8")
    ]
)
logger = logging.getLogger("ghost_author")

from domain.diff_ingestor import DiffIngestor
from domain.policy_guard import PolicyGuard
from domain.suppression_registry import SuppressionRegistry
from services.smell_analyzer import SmellAnalyzer
from services.pr_writer import PRWriter
from integrations.github_client import GitHubClient
from runners.sandbox_manager import SandboxManager
from runners.retry_loop import RetryLoop

def load_config(config_path: str = "config.yaml") -> Dict[str, Any]:
    if not os.path.exists(config_path):
        logger.warning(f"Config file {config_path} not found. Using defaults.")
        return {}
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def get_code_diff(original: str, refactored: str, filename: str) -> str:
    diff_lines = difflib.unified_diff(
        original.splitlines(keepends=True),
        refactored.splitlines(keepends=True),
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}"
    )
    return "".join(diff_lines)

def run_ghost_author():
    logger.info("Initializing Ghost Author Active Loop...")
    config = load_config()

    repo_path = config.get("repo_path", ".")
    allowlist_dirs = config.get("allowlist_dirs", [])
    blacklist_dirs = config.get("blacklist_dirs", [])
    max_attempts = config.get("max_attempts", 3)
    max_cognitive = config.get("max_cognitive", 15)
    branch_prefix = config.get("branch_prefix", "ghost/refactor-")
    github_config = config.get("github", {})
 
    # Instantiate modules
    diff_ingestor = DiffIngestor(repo_path)
    policy_guard = PolicyGuard(allowlist_dirs, blacklist_dirs)
    smell_analyzer = SmellAnalyzer(max_nesting=2, max_length=15, max_cognitive=max_cognitive)
    sandbox_manager = SandboxManager(repo_path)
    retry_loop = RetryLoop(
        policy_guard=policy_guard, 
        max_attempts=max_attempts,
        use_docker=config.get("use_docker", False),
        docker_image=config.get("docker_image", "python:3.11")
    )
    github_client = GitHubClient(
        enabled=github_config.get("enabled", False),
        repo_owner=github_config.get("repo_owner", "owner"),
        repo_name=github_config.get("repo_name", "repo")
    )

    # Metrics logging
    metrics = {
        "start_time": datetime.now().isoformat(),
        "issues_found": 0,
        "fixes_attempted": 0,
        "fixes_passed": 0,
        "prs_generated": 0,
        "validation_time_sec": 0.0
    }

    # Ingest changed files (since last commit, or uncommitted files)
    changed_files = diff_ingestor.get_changed_files()
    logger.info(f"Detected changed files: {changed_files}")

    for filepath in changed_files:
        if not policy_guard.is_file_allowed(filepath):
            logger.info(f"Skipping file {filepath}: policy guard boundary check failed.")
            continue

        if SuppressionRegistry.is_file_ignored(filepath):
            logger.info(f"Skipping file {filepath}: suppressed via file-level # ghost-ignore.")
            continue

        # Read original file contents
        full_filepath = os.path.join(repo_path, filepath)
        try:
            with open(full_filepath, "r", encoding="utf-8") as f:
                original_code = f.read()
        except Exception as e:
            logger.error(f"Failed to read file {filepath}: {e}")
            continue

        # Analyze for refactor smells
        smells = smell_analyzer.analyze_file(filepath, original_code)
        if not smells:
            logger.info(f"No code smells detected in {filepath}.")
            continue

        logger.info(f"Detected {len(smells)} refactoring candidate(s) in {filepath}.")
        metrics["issues_found"] += len(smells)

        # Process first smell (v1 processes one smell at a time for safety)
        smell = smells[0]
        func_name = smell["function_name"]
        
        # Prepare branch name
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        branch_name = f"{branch_prefix}{func_name}-{timestamp}"
        
        worktree_path = None
        try:
            # Create sandbox worktree
            worktree_path = sandbox_manager.create_worktree(branch_name)
            metrics["fixes_attempted"] += 1
            
            # Run Refactor & Verify validation loop
            start_val = datetime.now()
            loop_result = retry_loop.run(worktree_path, filepath, original_code, smell)
            val_duration = (datetime.now() - start_val).total_seconds()
            metrics["validation_time_sec"] += val_duration

            if loop_result["success"]:
                metrics["fixes_passed"] += 1
                logger.info("Refactoring and test validation succeeded. Preparing PR summary.")
                
                # Compute code diff
                diff_str = get_code_diff(original_code, loop_result["refactored_code"], filepath)
                
                # Generate Markdown PR summary
                pr_body = PRWriter.generate_pr_summary(
                    filepath=filepath,
                    smells=[smell],
                    diff=diff_str,
                    test_outcome=loop_result["test_outcome"],
                    attempts=loop_result["attempts"]
                )
                
                # Save PR summary locally
                summary_file = os.path.join(repo_path, "ghost_pr_summary.md")
                with open(summary_file, "w", encoding="utf-8") as sf:
                    sf.write(pr_body)
                logger.info(f"Local PR summary generated successfully: {summary_file}")
                
                # Commit change inside worktree so it's captured in git
                try:
                    subprocess.run(["git", "add", filepath], cwd=worktree_path, check=True)
                    subprocess.run(["git", "commit", "-m", f"refactor: resolve nesting smell in {func_name}"], cwd=worktree_path, check=True)
                    logger.info("Changes committed in worktree.")
                except Exception as ce:
                    logger.error(f"Failed to commit changes in worktree: {ce}")

                # Optional Remote PR Creation (Feature flagged)
                pr_result = github_client.create_pull_request(
                    title=f"refactor: simplify conditionals in {func_name}",
                    body=pr_body,
                    head_branch=branch_name
                )
                if pr_result["success"]:
                    metrics["prs_generated"] += 1
            else:
                logger.warning(f"Refactoring loop finished with failure. Check validation test logs.")
                
        except Exception as e:
            logger.error(f"Error during sandbox execution: {e}", exc_info=True)
        finally:
            # Cleanup worktree sandbox
            if worktree_path:
                sandbox_manager.cleanup_worktree(worktree_path, branch_name)

    metrics["end_time"] = datetime.now().isoformat()
    logger.info(f"Ghost Author loop completed. Execution Metrics: {metrics}")

if __name__ == "__main__":
    run_ghost_author()
