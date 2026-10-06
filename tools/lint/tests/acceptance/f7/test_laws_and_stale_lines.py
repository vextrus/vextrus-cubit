"""Ticket f7, obligation B: the five law lines in CLAUDE.md, the stale lines fixed, `real-drawings` and
`docs/architecture.md` naming `tools/scorer/`, and `lessons.md` through session 12 (factory spec
§3.1, §3.4, §10; ticket f7 §3 B).

Text checks. Quotes are deleted and whitespace collapsed before matching (`support.normalise`), so a
wrapped or re-quoted line still matches; forbidden strings are matched with backticks deleted as
well, so `` `/code-review` `` and `/code-review` both count.
"""

import re
from pathlib import Path

import pytest

from tools.lint.tests.acceptance.f7.support import LAWS, REPO, normalise

CLAUDE_MD = REPO / "CLAUDE.md"
REAL_DRAWINGS = REPO / ".claude/skills/real-drawings/SKILL.md"
ARCHITECTURE = REPO / "docs/architecture.md"
LESSONS = REPO / "docs/knowledge/lessons.md"


def text_of(path: Path) -> str:
    return normalise(path.read_text())


def bare(text: str) -> str:
    """Quotes and backticks deleted, whitespace collapsed."""
    return normalise(text).replace("`", "")


@pytest.mark.parametrize(
    "law", LAWS, ids=["account-a", "launcher", "date-u", "no-pgrep-wait", "walk-now"]
)
def test_claude_md_carries_the_law(law: str) -> None:
    assert normalise(law) in text_of(CLAUDE_MD), f"CLAUDE.md lacks the law line: {law}"


STALE = [
    "scripts.cloud.launch",
    "CLAUDE_CONFIG_DIR=~/.claude-b",
    "built-in /code-review",
    "defaults to `high`",
    "VCC:",
    ".private/work/session-",
]


def test_claude_md_has_no_stale_or_private_line() -> None:
    text = bare(CLAUDE_MD.read_text())
    found = [line for line in STALE if bare(line) in text]
    if re.search(r"\b[Aa]ccount B\b", text):
        found.append("account B")
    assert not found, f"CLAUDE.md still carries: {found}"


# ADR 0043 made the review `scripts.factory.review run <PR> --round <n>` and kept `/review-pr` "only
# until S14-R3 retires it"; the CLAUDE.md line names the command, and once R3 retires `/review-pr`,
# not it.
@pytest.mark.parametrize("words", ["adversary agent", "scripts.factory.review run", "default to medium"])
def test_claude_md_carries_the_new_line(words: str) -> None:
    assert words in bare(CLAUDE_MD.read_text()), f"CLAUDE.md lacks {words!r}"


def test_claude_md_no_longer_names_review_pr() -> None:
    assert "/review-pr" not in bare(CLAUDE_MD.read_text()), (
        "CLAUDE.md still names /review-pr (retired by S14-R3)"
    )


def test_real_drawings_names_the_scorer_and_the_accept_rule() -> None:
    text = normalise(REAL_DRAWINGS.read_text())
    assert "tools/scorer/" in text
    assert "ADR 0041" in text
    assert "scripts/score" not in text
    assert normalise("The posting run is the owner's") not in text


def test_architecture_does_not_name_scripts_score() -> None:
    assert "scripts/score/" not in ARCHITECTURE.read_text()


def test_lessons_point_at_the_factory_launcher() -> None:
    raw = LESSONS.read_text()
    stale = [
        s
        for s in ("scripts/cloud/launch.py", "scripts.cloud.launch", "test_cloud_launch.py")
        if s in raw
    ]
    assert not stale, f"lessons.md still names {stale}"
    assert "scripts/factory/launch.py" in raw
    assert "scripts/factory/tests/test_launch_cloud.py" in raw
    assert normalise("from the ticket branch's worktree") not in normalise(raw)


@pytest.mark.parametrize("session", ["08", "09", "10", "11", "12"])
def test_lessons_has_the_session(session: str) -> None:
    lines = LESSONS.read_text().splitlines()
    heading = f"## Session {session}"
    bullets = 0
    found = False
    inside = False
    for line in lines:
        if line.startswith("## "):
            inside = line.startswith(heading)
            found = found or inside
        elif inside and line.startswith("- "):
            bullets += 1
    assert found, f"lessons.md has no {heading!r} heading"
    assert bullets >= 3, f"{heading} holds {bullets} top-level bullets; at least three"
