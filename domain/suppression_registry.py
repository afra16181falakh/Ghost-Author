import ast
import logging
from typing import Union

logger = logging.getLogger("ghost_author")

class SuppressionRegistry:
    @staticmethod
    def is_file_ignored(filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                first_lines = [f.readline() for _ in range(3)]
            for line in first_lines:
                if "# ghost-ignore" in line:
                    logger.info(f"Skipping file {filepath} (file-level # ghost-ignore detected)")
                    return True
        except Exception as e:
            logger.debug(f"Failed to check suppression for file {filepath}: {e}")
        return False

    @staticmethod
    def is_function_ignored(func_node: ast.FunctionDef, file_content: str) -> bool:
        try:
            lines = file_content.splitlines()
            start_line = func_node.lineno - 1
            
            # Check up to 5 lines above the function definition (e.g. decorators, comments)
            for i in range(max(0, start_line - 5), start_line):
                if "# ghost-ignore" in lines[i]:
                    logger.info(f"Skipping function '{func_node.name}' (# ghost-ignore detected)")
                    return True
        except Exception as e:
            logger.warning(f"Error checking suppression for function '{func_node.name}': {e}")
        return False
