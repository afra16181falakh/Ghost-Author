import os
import logging
from typing import Dict, Any
from services.patch_applier import PatchApplier
from services.refactor_planner import RefactorPlanner, HAS_GENAI
from runners.test_runner import TestRunner
from domain.policy_guard import PolicyGuard

logger = logging.getLogger("ghost_author")

class RetryLoop:
    def __init__(
        self,
        policy_guard: PolicyGuard,
        max_attempts: int = 3,
        use_docker: bool = False,
        docker_image: str = "python:3.11",
        model_name: str = "gemini-2.5-flash",
    ):
        self.policy_guard = policy_guard
        self.max_attempts = max_attempts
        self.use_docker   = use_docker
        self.docker_image = docker_image
        self.model_name   = model_name

    def run(self, worktree_path: str, filepath: str, original_code: str, smell: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"Starting Refactor-Test validation loop for '{smell['function_name']}' in {filepath}")
        
        attempts = 0
        current_code = original_code
        test_outcome = {"success": False, "output": "Refactoring not started yet."}
        feedback = None
        
        while attempts < self.max_attempts:
            attempts += 1
            logger.info(f"Attempt {attempts} of {self.max_attempts}")
            
            # Plan the refactor
            try:
                # We always base the refactor on the original_code to prevent accumulated syntax corruption,
                # passing the feedback from the previous failed run if it exists.
                refactored_code = RefactorPlanner.plan_refactor(filepath, original_code, smell, feedback=feedback, model_name=self.model_name)
            except Exception as e:
                logger.error(f"Refactor planning failed: {e}")
                test_outcome = {"success": False, "output": f"Refactoring execution failed: {e}"}
                continue

            # Safety Guard: Check for hallucinated/disallowed imports
            if not self.policy_guard.validate_imports(refactored_code):
                logger.error("Imports validation failed. Code imports are unsafe.")
                test_outcome = {"success": False, "output": "Imports validation failed. Disallowed or hallucinated import."}
                feedback = "Safety Rail Violated: Uninstalled or hallucinated import detected."
                # Don't break immediately if we have LLM capabilities, let it try to fix it, but update feedback
                api_key = os.environ.get("GEMINI_API_KEY")
                if not (HAS_GENAI and api_key):
                    break
                continue

            # Apply patch to worktree file
            worktree_file_path = os.path.join(worktree_path, filepath)
            if not PatchApplier.apply_patch(worktree_file_path, refactored_code):
                logger.error("Failed to write patch to file.")
                test_outcome = {"success": False, "output": "Failed to apply refactored patch to file."}
                feedback = "Failed to apply refactored patch to file."
                continue

            # Run validation tests
            test_outcome = TestRunner.run_tests(worktree_path, use_docker=self.use_docker, docker_image=self.docker_image)
            
            if test_outcome["success"]:
                logger.info(f"Validation tests passed successfully on attempt {attempts}!")
                current_code = refactored_code
                break
            else:
                logger.warning(f"Validation tests failed on attempt {attempts}.")
                feedback = test_outcome.get("output", "")
                
                # Since v1 without LLM uses deterministic rewrite rules, further attempts will yield the same result.
                # To prevent unnecessary loops, we break early if Gemini is not configured.
                api_key = os.environ.get("GEMINI_API_KEY")
                if not (HAS_GENAI and api_key):
                    logger.info("Gemini API not configured. Breaking retry loop early.")
                    break

        return {
            "success": test_outcome.get("success", False),
            "attempts": attempts,
            "refactored_code": current_code,
            "test_outcome": test_outcome
        }

