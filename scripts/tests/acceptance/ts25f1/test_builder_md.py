"""Ticket S25-F1 `review self`: the builder's step in `.claude/agents/builder.md`.

Authority: docs/handoff/session-25-prompt.md, "Session 25's order" step 3, F1: "`builder.md` runs it once
before READY and on each fix's own diff, then re-runs the previous round's attack tests."

Only stable phrases are pinned: the command in the READY checklist, and a fix round's re-run of the
previous round's attack tests. How a fix round names its own diff (a flag) is not named by the authority,
so it is not asserted.
"""

from __future__ import annotations

import re
from pathlib import Path

BUILDER = Path(__file__).resolve().parents[4] / ".claude" / "agents" / "builder.md"
COMMAND = "scripts.factory.review_self"


def section(title: str) -> str:
    """The text of builder.md's `## <title>` (or `###`) section, up to the next heading of its level or
    higher; "" when there is none."""
    text = BUILDER.read_text()
    heading = re.compile(rf"^(#{{2,3}})[ \t]+{re.escape(title)}\b.*$", re.MULTILINE | re.IGNORECASE)
    match = heading.search(text)
    if not match:
        return ""
    level = len(match.group(1))
    rest = text[match.end() :]
    end = re.search(rf"^#{{1,{level}}}[ \t]", rest, re.MULTILINE)
    return rest[: end.start()] if end else rest


def test_the_ready_checklist_runs_review_self_before_ready() -> None:
    checklist = section("READY checklist")
    assert checklist.strip(), "builder.md has no `## READY checklist` section"
    assert COMMAND in checklist, f"builder.md's READY checklist does not name {COMMAND}"


def test_a_fix_round_re_runs_the_previous_round_s_attack_tests() -> None:
    """One paragraph (or list item) of builder.md names a fix round and re-running the previous
    round's attack tests."""
    blocks = re.split(r"\n\s*\n|\n(?=\s*(?:\d+\.|-)\s)", BUILDER.read_text())
    tied = [
        block
        for block in blocks
        if re.search(r"\bfix", block, re.IGNORECASE)
        and re.search(r"attack tests?", block, re.IGNORECASE)
        and re.search(r"\bprevious\b|\blast\b|\bearlier\b", block, re.IGNORECASE)
        and re.search(r"\bre-?run", block, re.IGNORECASE)
    ]
    assert tied, "builder.md does not say that a fix round re-runs the previous round's attack tests"
