"""
Docstring generation — after a successful refactor, Gemini adds or
updates Google-style docstrings for every public function in the file.

This is one extra API call per successful fix; the updated code replaces
the refactored code before it is committed.
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


def generate_docstrings(
    filepath: str,
    refactored_code: str,
    model_name: str = "gemini-2.5-flash",
) -> Optional[str]:
    """
    Ask Gemini to add / update docstrings in the refactored file.

    Returns the updated file content (str) or None when generation
    is skipped or fails, so the caller can use the original refactored code.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not HAS_GENAI or not api_key:
        return None

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""You are a Python documentation specialist.

Refactored file `{filepath}`:
```python
{refactored_code}
```

Add or update Google-style docstrings for every public function and class.
Rules:
1. Do NOT change any logic — only add / update docstrings.
2. One-sentence summary for simple helpers; full Args / Returns / Raises for
   complex functions (>10 lines or with multiple parameters).
3. Do not add docstrings to private helpers starting with `_` unless they
   already have one.
4. Return the COMPLETE updated file in a single ```python ... ``` block.
"""
        response = client.models.generate_content(model=model_name, contents=prompt)
        text = (response.text or "").strip()
        if "```python" in text:
            updated = text.split("```python", 1)[1].split("```", 1)[0].strip()
            if updated:
                return updated
        return None
    except Exception as exc:
        logger.warning(f"Docstring generation failed for {filepath}: {exc}")
        return None
