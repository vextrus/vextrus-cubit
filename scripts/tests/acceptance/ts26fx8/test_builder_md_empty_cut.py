"""Ticket S26-FX8, the empty-Cut words: `.claude/agents/builder.md` names them.

The authority (the orchestrator's ruling, session 26, 13 Oct 2026): "(3) builder.md names the exact
empty-Cut words ("None.") and that every Cut item is one line ending in its issue (#n)".

Pinned: a paragraph of builder.md that names the `## Cut` heading also names `None.`, and one names
`(#n)`. Not pinned: the sentences around them (the builder's words).
"""

from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parents[4] / ".claude" / "agents" / "builder.md"
UNNAMED = "builder.md does not name the empty-Cut rule"


def paragraphs_naming_the_cut() -> list[str]:
    text = BUILDER.read_text(encoding="utf-8")
    return [block for block in text.split("\n\n") if "## Cut" in block]


def test_builder_md_names_none_as_the_words_for_an_empty_cut() -> None:
    found = [block for block in paragraphs_naming_the_cut() if "None." in block]

    assert found, f"{UNNAMED}: no paragraph naming `## Cut` names `None.`"


def test_builder_md_says_each_cut_item_ends_in_its_issue() -> None:
    found = [block for block in paragraphs_naming_the_cut() if "(#n)" in block]

    assert found, f"{UNNAMED}: no paragraph naming `## Cut` names `(#n)`"
