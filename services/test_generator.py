"""
Test generation — uses Gemini to write pytest tests for functions that
lack coverage before the refactoring loop runs.

Ghost Author writes the generated test file into the worktree so the
existing retry loop's pytest step validates against them automatically.
"""
import logging
import os
from typing import Optional

logger = logging.getLogger("ghost_author")

try:
    from google import genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


def has_test_for(function_name: str, repo_path: str) -> bool:
    """
    Heuristic: walk the repo tree for test files that reference function_name.
    Returns True if at least one reference is found.
    """
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git", "venv", ".venv", "node_modules")]
        for fname in files:
            if not (fname.startswith("test_") and fname.endswith(".py")):
                continue
            try:
                with open(os.path.join(root, fname), "r", encoding="utf-8") as fh:
                    if function_name in fh.read():
                        return True
            except Exception:
                pass
    return False


def generate_tests(
    filepath: str,
    code: str,
    function_name: str,
    model_name: str = "gemini-2.5-flash",
) -> Optional[str]:
    """
    Ask Gemini to write a pytest module for function_name.
    Returns test source code (str) or None if generation was skipped/failed.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not HAS_GENAI or not api_key:
        return None

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""You are a Python test engineer writing a pytest test module.

Source file `{filepath}`:
```python
{code}
```

Write at least 3 pytest test functions for `{function_name}`.
Requirements:
1. Cover: normal inputs, edge cases (empty / None / boundary values), error paths if applicable.
2. Import only standard library modules and pytest.
3. Copy the function under test inline if it has no external dependencies, OR import it with:
   `from {filepath.replace("/", ".").replace(".py", "")} import {function_name}`
4. Name test functions clearly: `test_{function_name}_<scenario>`.
5. Output only a single ```python ... ``` block — no explanation.
"""
        response = client.models.generate_content(model=model_name, contents=prompt)
        text = (response.text or "").strip()
        if "```python" in text:
            return text.split("```python", 1)[1].split("```", 1)[0].strip()
        return None
    except Exception as exc:
        logger.warning(f"Test generation failed for {function_name}: {exc}")
        return None
