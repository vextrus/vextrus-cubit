"""S14-D1 (factory-next.md section 8, row 17): "spec 3.8 and 4 updated". `docs/specs/factory.md`
§3.8 (Workflows) holds the review as `review-pr.js`; ADR 0043 supersedes ADR 0042's review part with
the command factory-next.md section 2 names, "`uv run python -m scripts.factory.review run <PR>`", so
§3.8 names it. §4's update is not pinned: the authority names no words for it.
"""

import re

from tools.lint.tests.acceptance.ts14d1._repo import flat, read

SPEC = "docs/specs/factory.md"


def section(text: str, number: str) -> str:
    """The text from the `### <number> ` heading to the next `## ` or `### ` heading."""
    match = re.search(rf"^### {re.escape(number)} .*?(?=^##+ |\Z)", text, re.MULTILINE | re.DOTALL)
    return match.group(0) if match else ""


def test_spec_section_3_8_names_scripts_factory_review_run() -> None:
    text = section(read(SPEC), "3.8")
    assert text, f"{SPEC} has no `### 3.8` section"
    assert "scripts.factory.review run" in flat(text), "§3.8 does not name scripts.factory.review run"
