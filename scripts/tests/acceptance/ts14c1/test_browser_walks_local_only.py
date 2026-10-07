"""S14-C1 (c): every agent that may walk the product in a browser refuses in a cloud session.

The owner, session 14: cloud sessions could not find the chrome-devtools MCP for web walks and silently
fell back to Playwright. The orchestrator's pin: where builder.md, the critics and the other walkers
decide on a browser, they say that in a cloud session browser walks (chrome-devtools) are local-only,
and that they refuse and report rather than walk with Playwright. Playwright stays the web's test
runner (`web/e2e/`); what is refused is a Playwright walk in the chrome-devtools walk's place.

A file passes when one of its blocks (a paragraph or one list item) names the cloud, chrome-devtools,
"local-only" (or "local only"), says to report, and names Playwright beside a never or not.
"""

from __future__ import annotations

import re

import pytest

from scripts.tests.acceptance.ts14c1._world import REPO

WALKERS = (
    ".claude/agents/builder.md",
    ".claude/agents/ux-critic.md",
    ".claude/agents/qs-critic.md",
    ".claude/agents/refuter.md",
    ".claude/skills/product-review/SKILL.md",
)
ITEM = re.compile(r"^\s{0,3}([-*+]|\d{1,3}[.)])\s")
NEGATION = re.compile(r"(?i)\b(never|not|no|don't|do not|must not)\b")


def blocks(text: str) -> list[str]:
    found: list[str] = []
    current: list[str] = []
    for line in text.splitlines():
        if not line.strip() or ITEM.match(line) or line.lstrip().startswith("#"):
            if current:
                found.append(" ".join(current))
            current = [line] if line.strip() else []
            continue
        current.append(line)
    if current:
        found.append(" ".join(current))
    return found


def the_rule(block: str) -> bool:
    return (
        re.search(r"(?i)\bcloud\b", block) is not None
        and "chrome-devtools" in block
        and re.search(r"(?i)\blocal[- ]only\b", block) is not None
        and re.search(r"(?i)\breport", block) is not None
        and "Playwright" in block
        and NEGATION.search(block) is not None
    )


@pytest.mark.parametrize("path", WALKERS)
def test_a_cloud_session_refuses_a_browser_walk_and_reports_it(path: str) -> None:
    text = (REPO / path).read_text(encoding="utf-8")
    assert any(the_rule(block) for block in blocks(text)), (
        f"{path} has no block saying that in a cloud session browser walks (chrome-devtools) are "
        "local-only, to report, and never to walk with Playwright instead"
    )
