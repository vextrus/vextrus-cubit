"""Ticket S26-FX8, the empty-Cut words: `scripts.merge_ready.cut_problems` reads the natural sentences
for an empty Cut as nothing, and a real Cut item still needs an open issue.

The authority (the orchestrator's ruling, session 26, 13 Oct 2026; a repeated class: #759 and twice that
day):
- (1) "cut_problems accepts the natural empty-Cut sentences as nothing: "None.", "Nothing.", "Nothing
  cut.", "Nothing was cut.", "None cut." (case-insensitive, optional list marker, optional final period),
  and, as today, prose after such a line is not an item while a list item after it still is";
- (2) "a real item still needs an open issue link (do not weaken that: "Nothing cut except the X (no
  issue)" or "- Nothing cut, but Y" style lines are items, as is any line not exactly one of those
  sentences)".

Pinned at the function's boundary: the list of problems it returns for a body, in merge_ready's own
words ("'cut' item 1 links no issue", "'cut' item 1 links no open issue"). Not pinned: a numbered list
marker before an empty-Cut sentence ("1. Nothing cut."), which the ruling does not name.
"""

from __future__ import annotations

import pytest

from scripts.merge_ready import cut_problems

EMPTY = ("None.", "Nothing.", "Nothing cut.", "Nothing was cut.", "None cut.")
NEW = ("Nothing cut.", "Nothing was cut.", "None cut.")
MISREAD = "cut_problems misreads an empty Cut"


def never_open(number: int) -> bool:
    return False


def always_open(number: int) -> bool:
    return True


def forms(sentence: str) -> list[str]:
    """The sentence as written, in lower and upper case, without its final period, after a list
    marker, and all of those at once."""
    bare = sentence.rstrip(".")
    return [
        sentence,
        sentence.lower(),
        sentence.upper(),
        bare,
        f"- {sentence}",
        f"* {sentence}",
        f"+ {sentence}",
        f"- {bare.lower()}",
    ]


@pytest.mark.parametrize("line", [form for sentence in NEW for form in forms(sentence)])
def test_a_cut_that_says_it_cut_nothing_has_no_problem(line: str) -> None:
    problems = cut_problems(f"## Cut\n{line}\n", never_open)

    assert problems == [], f"{MISREAD}: {line!r} read as a Cut item: {problems}"


@pytest.mark.parametrize("sentence", EMPTY)
def test_each_empty_cut_sentence_is_nothing_in_a_body_with_other_sections(sentence: str) -> None:
    body = f"Closes #999.\n\n## Cut\n{sentence}\n\n## Notes\nA synthetic note.\n"

    problems = cut_problems(body, never_open)

    assert problems == [], f"{MISREAD}: {sentence!r} read as a Cut item: {problems}"


@pytest.mark.parametrize("sentence", NEW)
def test_prose_after_an_empty_cut_sentence_is_not_a_cut_item(sentence: str) -> None:
    body = f"## Cut\n{sentence}\nThe tier 2 export waits for the owner's walk.\n\n## Notes\nA note.\n"

    problems = cut_problems(body, never_open)

    assert problems == [], f"{MISREAD}: prose after {sentence!r} read as a Cut item: {problems}"


@pytest.mark.parametrize("sentence", NEW)
def test_a_list_item_after_an_empty_cut_sentence_is_cut_item_1_and_needs_an_issue(
    sentence: str,
) -> None:
    problems = cut_problems(f"## Cut\n{sentence}\n- the tier 2 export\n", never_open)

    assert problems == ["'cut' item 1 links no issue: file one and link it (#<n>)"], (
        f"{MISREAD}: the list item after {sentence!r} is not the one item: {problems}"
    )


@pytest.mark.parametrize("sentence", NEW)
def test_a_list_item_after_an_empty_cut_sentence_needs_its_issue_open(sentence: str) -> None:
    body = f"## Cut\n{sentence}\n- the tier 2 export (#12)\n"

    assert cut_problems(body, never_open) == ["'cut' item 1 links no open issue"], (
        f"{MISREAD}: the list item after {sentence!r} is not the one item"
    )
    assert cut_problems(body, always_open) == [], (
        f"{MISREAD}: an empty-Cut sentence and an item linking an open issue are refused"
    )


@pytest.mark.parametrize(
    "line",
    [
        "Nothing cut except the tier 2 export (no issue).",
        "- Nothing cut, but the tier 2 export waits.",
        "Nothing cut. The tier 2 export waits for the owner.",
        "- None. The web half was dropped.",
        "Nothing was cut from the export but the web half.",
        "None cut yet: the web half waits.",
        "Nothing cut?",
        "Nothing cut..",
        "- - Nothing cut.",
    ],
)
def test_a_line_that_is_not_exactly_an_empty_cut_sentence_is_a_cut_item(line: str) -> None:
    problems = cut_problems(f"## Cut\n{line}\n", never_open)

    assert problems == ["'cut' item 1 links no issue: file one and link it (#<n>)"], (
        f"{MISREAD}: {line!r} is not read as a Cut item linking no issue: {problems}"
    )


@pytest.mark.parametrize(
    ("heading", "section"), [("## Not done", "not done"), ("## Deferred", "deferred")]
)
def test_an_unlinked_item_under_not_done_or_deferred_is_still_refused(
    heading: str, section: str
) -> None:
    problems = cut_problems(f"{heading}\n- the tier 2 export\n", never_open)

    assert problems == [f"'{section}' item 1 links no issue: file one and link it (#<n>)"], (
        f"{MISREAD}: {problems}"
    )
