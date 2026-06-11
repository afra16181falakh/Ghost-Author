import ast
from typing import List, Dict, Any

class ASTInspector:
    def __init__(self, code: str):
        self.code = code
        try:
            self.tree = ast.parse(code)
        except SyntaxError as e:
            raise ValueError(f"Invalid Python code syntax: {e}")

    def find_functions(self) -> List[Dict[str, Any]]:
        functions = []
        for node in ast.walk(self.tree):
            if isinstance(node, ast.FunctionDef):
                end_line = self._get_end_line(node)
                nesting = self._calculate_max_nesting(node)
                cognitive = self._calculate_cognitive_complexity(node)
                functions.append({
                    "name": node.name,
                    "node": node,
                    "start_line": node.lineno,
                    "end_line": end_line,
                    "length": end_line - node.lineno + 1,
                    "nesting_depth": nesting,
                    "cognitive_complexity": cognitive
                })
        return functions

    def _get_end_line(self, node: ast.AST) -> int:
        end_line = node.lineno
        for child in ast.walk(node):
            if hasattr(child, 'lineno'):
                end_line = max(end_line, child.lineno)
        return end_line

    def _calculate_max_nesting(self, node: ast.FunctionDef) -> int:
        max_depth = 0
        
        def visit(n: ast.AST, current_depth: int):
            nonlocal max_depth
            max_depth = max(max_depth, current_depth)
            
            # Nodes that increase nesting level
            nesting_nodes = (ast.If, ast.For, ast.While, ast.Try, ast.With)
            
            for child in ast.iter_child_nodes(n):
                if isinstance(child, nesting_nodes):
                    visit(child, current_depth + 1)
                else:
                    visit(child, current_depth)

        # Start recursion on child nodes of the function definition
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.If, ast.For, ast.While, ast.Try, ast.With)):
                visit(child, 1)
            else:
                visit(child, 0)
        return max_depth

    def _calculate_cognitive_complexity(self, node: ast.FunctionDef) -> int:
        complexity = 0

        def visit(n: ast.AST, current_nesting: int):
            nonlocal complexity
            
            # Nodes that increase nesting and complexity
            nesting_nodes = (ast.If, ast.For, ast.While, ast.Try, ast.With)
            
            # Operators that add complexity
            if isinstance(n, ast.BoolOp):
                complexity += len(n.values) - 1
            
            for child in ast.iter_child_nodes(n):
                if isinstance(child, nesting_nodes):
                    complexity += 1 + current_nesting
                    visit(child, current_nesting + 1)
                else:
                    visit(child, current_nesting)

        # Start recursion on child nodes of the function definition
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.If, ast.For, ast.While, ast.Try, ast.With)):
                complexity += 1
                visit(child, 1)
            else:
                visit(child, 0)
        return complexity

