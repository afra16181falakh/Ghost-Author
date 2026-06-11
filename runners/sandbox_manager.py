import os
import uuid
import shutil
import logging
import subprocess

logger = logging.getLogger("ghost_author")

class SandboxManager:
    def __init__(self, repo_path: str, worktrees_dir: str = ".ghost_worktrees"):
        self.repo_path = os.path.abspath(repo_path)
        self.worktrees_dir = os.path.join(self.repo_path, worktrees_dir)

    def create_worktree(self, branch_name: str) -> str:
        worktree_name = f"ghost_{uuid.uuid4().hex[:8]}"
        worktree_path = os.path.join(self.worktrees_dir, worktree_name)
        os.makedirs(self.worktrees_dir, exist_ok=True)

        logger.info(f"Creating isolated Git worktree at: {worktree_path} on branch: '{branch_name}'")
        try:
            # git worktree add -b <branch_name> <path>
            cmd = ["git", "worktree", "add", "-b", branch_name, worktree_path]
            result = subprocess.run(cmd, cwd=self.repo_path, check=True, capture_output=True, text=True)
            logger.info(f"Git worktree created: {result.stdout.strip()}")
            return worktree_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create Git worktree: {e.stderr}")
            raise RuntimeError(f"Git worktree creation failed: {e.stderr}")

    def cleanup_worktree(self, worktree_path: str, branch_name: str):
        logger.info(f"Cleaning up Git worktree at: {worktree_path}")
        
        # Remove worktree via git command first
        try:
            cmd = ["git", "worktree", "remove", "-f", worktree_path]
            subprocess.run(cmd, cwd=self.repo_path, check=True, capture_output=True, text=True)
            logger.info("Successfully removed Git worktree via git command.")
        except subprocess.CalledProcessError as e:
            logger.warning(f"Git worktree remove command failed: {e.stderr}. Attempting manual removal.")
            if os.path.exists(worktree_path):
                shutil.rmtree(worktree_path, ignore_errors=True)
        
        # Prune worktrees
        try:
            subprocess.run(["git", "worktree", "prune"], cwd=self.repo_path, check=True, capture_output=True)
        except Exception as e:
            logger.warning(f"Git worktree prune failed: {e}")

        # Delete local branch if it exists
        try:
            cmd = ["git", "branch", "-D", branch_name]
            subprocess.run(cmd, cwd=self.repo_path, check=True, capture_output=True, text=True)
            logger.info(f"Successfully deleted local branch: '{branch_name}'")
        except subprocess.CalledProcessError as e:
            logger.debug(f"Could not delete branch '{branch_name}': {e.stderr.strip()}")
