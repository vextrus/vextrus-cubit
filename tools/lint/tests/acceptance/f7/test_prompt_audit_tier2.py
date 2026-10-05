"""Ticket f7, tier 2 (cut first): the prompt-audit fixes to the Pocock and other skills and
`docs/agents/issue-tracker.md` (factory spec §3.4; ticket f7 §3 F and appendix A).

If this item is cut, this whole file is deleted by a later `acceptance:` commit.
"""

import pytest

from tools.lint.tests.acceptance.f7.support import REPO, normalise

SKILLS = REPO / ".claude/skills"


@pytest.mark.parametrize("gone", ["/setup-matt-pocock-skills", "/grill-me"])
def test_no_skill_points_at_a_deleted_skill(gone: str) -> None:
    hits = [
        str(path.relative_to(REPO)) for path in sorted(SKILLS.rglob("*.md")) if gone in path.read_text()
    ]
    assert not hits, f"{gone} is named in {hits}"


# (skill file, words it must not carry)
FORBIDDEN = [
    ("resolving-merge-conflicts/SKILL.md", "Stage everything"),
    ("handoff/SKILL.md", "temporary directory of the user's OS"),
    ("diagnosing-bugs/SKILL.md", "Refuse to give up"),
    ("spec-review/SKILL.md", "Under 400 words"),
    ("to-spec/SKILL.md", "A LONG"),
    ("to-spec/SKILL.md", "extremely extensive"),
    ("MATT-POCOCK-SKILLS.md", "`edison-drawings`"),
    ("MATT-POCOCK-SKILLS.md", "`lanes`"),
    ("MATT-POCOCK-SKILLS.md", "`readback`"),
    ("MATT-POCOCK-SKILLS.md", "`session-close`"),
]


@pytest.mark.parametrize(("name", "words"), FORBIDDEN)
def test_the_audited_line_is_gone(name: str, words: str) -> None:
    assert normalise(words) not in normalise((SKILLS / name).read_text()), f"{name} still says {words!r}"


def test_handoff_saves_under_private_work() -> None:
    assert ".private/work/" in (SKILLS / "handoff/SKILL.md").read_text()


def test_the_issue_tracker_says_the_repository_is_public() -> None:
    text = normalise((REPO / "docs/agents/issue-tracker.md").read_text())
    assert "The repository is private" not in text
    assert "public" in text
