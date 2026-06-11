import ast
import sys
import logging
from typing import List, Set

logger = logging.getLogger("ghost_author")

class PolicyGuard:
    def __init__(self, allowlist_dirs: List[str], blacklist_dirs: List[str], allowed_imports: Set[str] = None):
        self.allowlist_dirs = [d.replace("\\", "/") for d in allowlist_dirs]
        self.blacklist_dirs = [d.replace("\\", "/") for d in blacklist_dirs]
        self.allowed_imports = allowed_imports or set()

    def is_file_allowed(self, filepath: str) -> bool:
        # Normalize path
        filepath = filepath.replace("\\", "/").lstrip("/")
        
        # Check blacklist first
        for b_dir in self.blacklist_dirs:
            if filepath.startswith(b_dir + "/") or b_dir == filepath or f"/{b_dir}/" in f"/{filepath}/":
                return False
                
        # Check allowlist
        if not self.allowlist_dirs:
            return True
            
        for a_dir in self.allowlist_dirs:
            if filepath.startswith(a_dir + "/") or a_dir == filepath or f"/{a_dir}/" in f"/{filepath}/":
                return True
                
        return False

    def validate_imports(self, code: str) -> bool:
        # Extract imports in the code and verify they are safe (stdlib or already installed)
        try:
            tree = ast.parse(code)
        except SyntaxError:
            logger.error("Failed to parse code AST during import validation")
            return False

        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        module_name = alias.name.split('.')[0]
                        if not self._is_module_safe(module_name):
                            logger.warning(f"Safety Rail Violated: Uninstalled or hallucinated import detected: '{module_name}'")
                            return False
                elif isinstance(node, ast.ImportFrom) and node.module:
                    module_name = node.module.split('.')[0]
                    if not self._is_module_safe(module_name):
                        logger.warning(f"Safety Rail Violated: Uninstalled or hallucinated import detected: '{module_name}'")
                        return False
        return True

    def _is_module_safe(self, module_name: str) -> bool:
        # Allow checking in current sys.modules or standard library
        if module_name in sys.builtin_module_names:
            return True
        if module_name in sys.modules:
            return True
            
        # Try checking if it can be found in environment without executing it
        import importlib.util
        try:
            spec = importlib.util.find_spec(module_name)
            return spec is not None
        except (ModuleNotFoundError, ValueError, AttributeError):
            return False
        except Exception:
            return False
