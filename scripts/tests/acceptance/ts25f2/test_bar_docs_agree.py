"""S25-F2, the bar (the owner's Q13): the documents that state the bar say the new one.

Q13: "The bar lives in ADR 0041 item 7 (amended 7 Oct), CLAUDE.md's 'Every serious finding' line and
the ledger's verdict; F2 changes all three together." Session 25's brief (step 3, F2): "ADR 0041 item 7
(and item 5's late-finding rule), CLAUDE.md's 'Every serious finding' line and the ledger's verdict
amended together"; "each lens tags a finding's class (user-facing, edge, rule-only)". The owner's
ruling at the session's start: a trust-boundary finding of 50-74 still blocks.

Each statement of the bar names the two things that now block at 50 (a user-facing finding, a finding
on a trust boundary); the ledger's own description and the reviewer's instructions also name the three
classes a lens tags. Pinned by presence of the owner's words, not by any sentence: how each document
words the rest is free. scripts/tests/test_bar_docs.py keeps its own pins."""

import re
from collections.abc import Callable
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[4]
ADR = "docs/adr/0041-sessions-are-autonomous.md"
TRUST_BOUNDARY = re.compile(r"trust[- ]boundar(?:y|ies)", re.IGNORECASE)


def flat(text: str) -> str:
    return " ".join(text.split())


def read(name: str) -> str:
    return (ROOT / name).read_text()


def section(text: str, start: str, end: str) -> str:
    """The text from `start` up to `end` (both must be found)."""
    begin = text.index(start)
    return text[begin : text.index(end, begin + len(start))]


def claude_md_line() -> str:
    text = read("CLAUDE.md")
    return section(text, "- **Every serious finding", "\n- **")


def builder_quality_line() -> str:
    text = read(".claude/agents/builder.md")
    return section(text, "- Every serious finding", "\n- ")


def adr_item(number: int) -> str:
    text = read(ADR)
    return section(text, f"\n{number}. **", f"\n{number + 1}. **")


def ledger_doc() -> str:
    import scripts.ledger

    return scripts.ledger.__doc__ or ""


STATEMENTS: dict[str, Callable[[], str]] = {
    "CLAUDE.md": claude_md_line,
    "ADR 0041 item 7": lambda: adr_item(7),
    ".claude/agents/builder.md": builder_quality_line,
    "scripts/ledger.py": ledger_doc,
    ".claude/agents/pr-reviewer.md": lambda: read(".claude/agents/pr-reviewer.md"),
}


@pytest.mark.parametrize("name", list(STATEMENTS))
def test_each_statement_of_the_bar_names_a_user_facing_finding(name: str) -> None:
    text = flat(STATEMENTS[name]())
    assert "user-facing" in text, f"{name} does not state Q13's bar: no user-facing finding"


# pr-reviewer.md names the trust boundary already (its focus); its classes are pinned below.
@pytest.mark.parametrize("name", [name for name in STATEMENTS if "pr-reviewer" not in name])
def test_each_statement_of_the_bar_names_a_trust_boundary(name: str) -> None:
    text = flat(STATEMENTS[name]())
    assert TRUST_BOUNDARY.search(text), f"{name} does not state Q13's bar: no trust boundary"


@pytest.mark.parametrize(
    "name", ["scripts/ledger.py", ".claude/agents/pr-reviewer.md"], ids=["ledger", "pr-reviewer"]
)
def test_the_ledger_and_the_reviewer_name_the_three_classes(name: str) -> None:
    text = flat(STATEMENTS[name]())
    for word in ("user-facing", "edge", "rule-only"):
        assert word in text, f"{name} does not state Q13's bar: no {word} class"


def test_adr_0041_item_5_late_findings_follow_the_new_bar() -> None:
    """Item 5's late-finding rule is amended with item 7: it names a user-facing finding or a trust
    boundary (which of the two is the amendment's choice)."""
    text = flat(adr_item(5))
    assert "user-facing" in text or TRUST_BOUNDARY.search(text), (
        "ADR 0041 item 5 does not state Q13's bar: neither user-facing nor a trust boundary"
    )
