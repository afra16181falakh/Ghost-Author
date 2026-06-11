import logging
from typing import Dict, Any, List

logger = logging.getLogger("ghost_author")

class PRWriter:
    @staticmethod
    def generate_pr_summary(
        filepath: str,
        smells: List[Dict[str, Any]],
        diff: str,
        test_outcome: Dict[str, Any],
        attempts: int
    ) -> str:
        smell_details = ""
        for s in smells:
            for item in s["smells"]:
                smell_details += f"- **{item['type']}** in `{s['function_name']}`: {item['msg']}\n"
                
        test_status = "✅ PASSED" if test_outcome.get("success") else "❌ FAILED"
        test_log = test_outcome.get("output", "No test logs captured.")
        if len(test_log) > 1500:
            test_log = test_log[:1500] + "\n... [TRUNCATED] ..."

        summary = f"""# Ghost Author PR Summary: Refactored Code Smells in `{filepath}`

Proactive automated refactoring applied to address technical debt.

## 🛠️ Smells Addressed
{smell_details}

## 🔍 Validation Status
- **Test Command**: `{test_outcome.get('command', 'pytest')}`
- **Test Outcome**: {test_status}
- **Validation Attempts**: {attempts}

### 📝 Test Run Output
```text
{test_log}
```

## 📉 Code Diff
```diff
{diff}
```

## ⚠️ Risk Assessment
- **Risk Level**: **Low** (Deterministic rule-based extraction)
- **Review Guidance**: Verify the extracted helper function signatures and make sure imports are correctly preserved.

---
*Created automatically by **Ghost Author** v1 Prototype.*
"""
        return summary
