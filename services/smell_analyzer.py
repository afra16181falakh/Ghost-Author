import logging
from typing import List, Dict, Any
from services.ast_inspector import ASTInspector
from domain.suppression_registry import SuppressionRegistry

logger = logging.getLogger("ghost_author")

class SmellAnalyzer:
    def __init__(self, max_nesting: int = 2, max_length: int = 15, max_cognitive: int = 15):
        self.max_nesting = max_nesting
        self.max_length = max_length
        self.max_cognitive = max_cognitive

    def analyze_file(self, filepath: str, code: str) -> List[Dict[str, Any]]:
        try:
            inspector = ASTInspector(code)
            functions = inspector.find_functions()
        except ValueError as e:
            logger.error(f"Failed to inspect file {filepath}: {e}")
            return []

        smells = []
        for func in functions:
            if SuppressionRegistry.is_function_ignored(func["node"], code):
                continue

            func_smells = []
            if func["nesting_depth"] > self.max_nesting:
                func_smells.append({
                    "type": "nested_conditionals",
                    "msg": f"Function '{func['name']}' has max nesting depth of {func['nesting_depth']} (limit: {self.max_nesting})"
                })
            if func["length"] > self.max_length:
                func_smells.append({
                    "type": "large_function",
                    "msg": f"Function '{func['name']}' is too long ({func['length']} lines, limit: {self.max_length})"
                })
            if func.get("cognitive_complexity", 0) > self.max_cognitive:
                func_smells.append({
                    "type": "cognitive_complexity",
                    "msg": f"Function '{func['name']}' has cognitive complexity of {func['cognitive_complexity']} (limit: {self.max_cognitive})"
                })

            if func_smells:
                smells.append({
                    "function_name": func["name"],
                    "start_line": func["start_line"],
                    "end_line": func["end_line"],
                    "smells": func_smells,
                    "nesting_depth": func["nesting_depth"],
                    "length": func["length"],
                    "cognitive_complexity": func.get("cognitive_complexity", 0)
                })

        return smells
