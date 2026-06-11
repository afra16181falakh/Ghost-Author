"""
JavaScript / TypeScript smell analyzer.

Uses regex-based heuristics — no external Node.js dependency required.
Detects:
  - Long functions (too many lines)
  - High cognitive complexity (nested control flow)
  - Deeply nested callbacks / promise chains
  - Magic numbers
  - Console.log leftovers in non-debug code
"""
import re
from typing import Any, Dict, List, Optional


# ── Regexes ───────────────────────────────────────────────────────────────────

_FUNC_RE = re.compile(
    r"""
    (?:^|\n)                         # start of line
    [ \t]*                           # optional indent
    (?:
        (?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(  # function name(
      | (?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(  # const name = (  or  const name = async (
      | (?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\w+|\([^)]*\))\s*=>  # arrow: const name = x =>
      | (\w+)\s*(?::\s*\S+\s*)?\(  # method name(   (class body)
    )
    """,
    re.VERBOSE | re.MULTILINE,
)

# Control-flow keywords that increase nesting/complexity
_COMPLEXITY_RE = re.compile(
    r'\b(if|else\s+if|else|for|while|do|switch|catch|&&|\|\||\?\s*\S)'
)

_MAGIC_NUMBER_RE = re.compile(r'\b(?<!\.)([2-9]\d{1,}|\d{3,})\b(?!\s*[;,)\]}])')
_CONSOLE_LOG_RE = re.compile(r'\bconsole\.(log|debug|info|warn)\b')


def _extract_function_body(source: str, start: int) -> tuple[int, int]:
    """
    Find the matching closing brace starting from `start`.
    Returns (start_line, end_line) — 1-indexed.
    """
    depth = 0
    i = start
    body_start = source.find('{', start)
    if body_start == -1:
        # Arrow function without braces: body ends at newline
        end = source.find('\n', start)
        end_line = source[:end if end != -1 else len(source)].count('\n') + 1
        start_line = source[:start].count('\n') + 1
        return start_line, end_line

    i = body_start
    while i < len(source):
        ch = source[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                start_line = source[:start].count('\n') + 1
                end_line = source[:i].count('\n') + 1
                return start_line, end_line
        # Skip strings to avoid counting braces in them
        elif ch in ('"', "'", '`'):
            quote = ch
            i += 1
            while i < len(source) and source[i] != quote:
                if source[i] == '\\':
                    i += 1
                i += 1
        i += 1

    start_line = source[:start].count('\n') + 1
    end_line = source.count('\n') + 1
    return start_line, end_line


def _cognitive_complexity(body: str) -> int:
    """Estimate cognitive complexity from control-flow keyword count + nesting bonus."""
    lines = body.split('\n')
    score = 0
    depth = 0
    for line in lines:
        stripped = line.lstrip()
        open_count = line.count('{') - line.count('}')
        depth = max(0, depth + open_count)
        matches = _COMPLEXITY_RE.findall(stripped)
        if matches:
            score += len(matches) + max(0, depth - 1)
    return score


def _nesting_depth(body: str) -> int:
    """Maximum brace nesting depth."""
    max_depth = depth = 0
    in_string = False
    string_char = ''
    for ch in body:
        if in_string:
            if ch == string_char:
                in_string = False
            continue
        if ch in ('"', "'", '`'):
            in_string = True
            string_char = ch
        elif ch == '{':
            depth += 1
            max_depth = max(max_depth, depth)
        elif ch == '}':
            depth = max(0, depth - 1)
    return max_depth


def analyze_js_file(
    filepath: str,
    code: str,
    max_length: int = 40,
    max_nesting: int = 4,
    max_cognitive: int = 15,
) -> List[Dict[str, Any]]:
    """
    Analyze a JavaScript/TypeScript file for code smells.
    Returns a list of smell dicts compatible with the Python SmellAnalyzer output format.
    """
    smells: List[Dict[str, Any]] = []
    seen_names: set = set()

    for match in _FUNC_RE.finditer(code):
        func_name = next((g for g in match.groups() if g), None)
        if not func_name or func_name in seen_names:
            continue
        seen_names.add(func_name)

        start_line, end_line = _extract_function_body(code, match.start())
        length = end_line - start_line + 1

        body = code[match.start():]
        brace_pos = body.find('{')
        if brace_pos != -1:
            close_pos = _find_closing_brace(body, brace_pos)
            body = body[:close_pos + 1]

        cognitive = _cognitive_complexity(body)
        nesting   = _nesting_depth(body)

        func_smells: List[Dict[str, str]] = []

        if length > max_length:
            func_smells.append({
                "type": "long_function",
                "msg": f"Function is {length} lines (max {max_length})",
            })
        if cognitive > max_cognitive:
            func_smells.append({
                "type": "high_cognitive_complexity",
                "msg": f"Cognitive complexity {cognitive} exceeds threshold {max_cognitive}",
            })
        if nesting > max_nesting:
            func_smells.append({
                "type": "deep_nesting",
                "msg": f"Nesting depth {nesting} exceeds threshold {max_nesting}",
            })

        # Magic numbers
        magic = _MAGIC_NUMBER_RE.findall(body)
        if magic:
            func_smells.append({
                "type": "magic_number",
                "msg": f"Magic numbers found: {', '.join(set(magic[:5]))}",
            })

        # Console.log leftovers
        if _CONSOLE_LOG_RE.search(body):
            func_smells.append({
                "type": "debug_statement",
                "msg": "console.log / console.debug left in code",
            })

        if func_smells:
            smells.append({
                "function_name": func_name,
                "start_line": start_line,
                "end_line": end_line,
                "length": length,
                "cognitive_complexity": cognitive,
                "nesting_depth": nesting,
                "smells": func_smells,
                "language": "typescript" if filepath.endswith((".ts", ".tsx")) else "javascript",
            })

    return smells


def _find_closing_brace(source: str, open_pos: int) -> int:
    depth = 0
    i = open_pos
    while i < len(source):
        ch = source[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i
        elif ch in ('"', "'", '`'):
            quote = ch
            i += 1
            while i < len(source) and source[i] != quote:
                if source[i] == '\\':
                    i += 1
                i += 1
        i += 1
    return len(source) - 1


def is_js_file(filepath: str) -> bool:
    return filepath.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"))
