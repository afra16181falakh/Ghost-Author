import os
import subprocess
import logging
from typing import Dict, Any

logger = logging.getLogger("ghost_author")

class TestRunner:
    @staticmethod
    def run_tests(worktree_path: str, timeout: int = 30, use_docker: bool = False, docker_image: str = "python:3.11") -> Dict[str, Any]:
        logger.info(f"Executing pytest suite in worktree at: {worktree_path} (use_docker={use_docker}, image={docker_image})")
        
        abs_worktree_path = os.path.abspath(worktree_path)
        if use_docker:
            cmd = [
                "docker", "run", "--rm",
                "-v", f"{abs_worktree_path}:/workspace",
                "-w", "/workspace",
                docker_image,
                "python", "-m", "pytest"
            ]
        else:
            cmd = ["python", "-m", "pytest"]
        
        try:
            result = subprocess.run(
                cmd,
                cwd=worktree_path,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            success = result.returncode == 0
            output = (result.stdout or "") + "\n" + (result.stderr or "")
            logger.info(f"Test validation complete. Success: {success}")
            return {
                "success": success,
                "output": output,
                "command": " ".join(cmd),
                "exit_code": result.returncode
            }
        except subprocess.TimeoutExpired as e:
            logger.error(f"Test validation timed out after {timeout} seconds.")
            stdout_str = e.stdout.decode('utf-8') if isinstance(e.stdout, bytes) else (e.stdout or "")
            stderr_str = e.stderr.decode('utf-8') if isinstance(e.stderr, bytes) else (e.stderr or "")
            output = stdout_str + "\n" + stderr_str
            return {
                "success": False,
                "output": f"Error: Timeout expired after {timeout} seconds.\n{output}",
                "command": " ".join(cmd),
                "exit_code": -1
            }
        except Exception as e:
            logger.error(f"Test runner error: {e}")
            return {
                "success": False,
                "output": f"Execution failed: {e}",
                "command": " ".join(cmd),
                "exit_code": -2
            }

