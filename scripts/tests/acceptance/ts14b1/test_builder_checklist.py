"""Ticket S14-B1 (issue #454): the builder's READY checklist in `.claude/agents/builder.md`.

Authority: the session-14 plan, row 9: "Builder self-review: READY checklist in builder.md,
`crosspr.py` (merge-tree and test run against open PRs touching the same files), PR-body lines"; issue
#454, "Fix": "Builder self-review before READY: the builder runs the adversary lens's checks, and runs
`git merge-tree` plus the changed tests against every open PR that touches its files, and lists the
result in the READY body." The orchestrator's brief: "builder.md carries a READY checklist naming
crosspr and a self re-read for each finding class"; "the READY commit message carries a `Cross-PR:`
line naming the open PRs checked".

Only stable phrases are pinned: a `READY checklist` heading, the command, a re-read, and the line.
The finding classes themselves are not named by any authority given, so they are not asserted.
"""

from __future__ import annotations

import re
from pathlib import Path

BUILDER = Path(__file__).resolve().parents[4] / ".claude" / "agents" / "builder.md"


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


def checklist() -> str:
    found = section("READY checklist")
    assert found.strip(), "builder.md has no `## READY checklist` section"
    return found


def test_builder_md_has_a_ready_checklist_section() -> None:
    assert checklist().strip()


def test_the_checklist_runs_the_cross_pr_check_before_ready() -> None:
    assert "scripts.factory.crosspr" in checklist()


def test_the_checklist_asks_for_a_self_re_read_of_the_work() -> None:
    assert re.search(r"\bre-?read", checklist(), re.IGNORECASE)


def test_the_ready_commit_carries_the_cross_pr_line() -> None:
    """The line crosspr prints (`Cross-PR: #<n> ... ok` or `Cross-PR: none ok`) goes in the READY
    commit's message, the PR body."""
    assert "Cross-PR:" in checklist() + section("Finishing")
