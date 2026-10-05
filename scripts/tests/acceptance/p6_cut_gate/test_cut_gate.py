"""Ticket T-CUT-GATE, section 3: `scripts.merge_ready.cut_problems(body, issue_open)`, gate (c) of the
merge gate: each item under a Cut, Not done or Deferred heading links an open issue.

A builder's body, as `.claude/agents/builder.md` writes it, passes; a cut the gate cannot read as linked
is refused, never skipped (fail closed). The refusals are the four holes PR #354's three reviews found:
prose cuts, a list item after a none-line, free text after a trailer's prefix, and a nested unlinked
list item. Pass is `== []`; refuse is a non-empty list (the messages' words are the builder's).
"""

import pytest

from scripts.merge_ready import cut_problems

OPEN = {5}
CLOSED = 6
VERIFY = "Factory-Verify: 0f3c1d5e7a9b2c4d6e8f1a3b5c7d9e0f2a4b6c8d ok"
SESSION = "https://claude.ai/code/session_01ExampleSession"
FOOTER = "\U0001f916 Generated with [Claude Code](https://claude.com/claude-code)"


def problems(body: str) -> list[str]:
    return cut_problems(body, lambda number: number in OPEN)


# Section 3, case 1: builder.md's new shape.
BUILDER_MD_SHAPE = f"""Not verified: the live call.

Verify summary: ruff 0, ruff-format 0, mypy 0, pytest 0.

## Cut
- the PDF export (#5)

## For a later ticket
The export needs its own ticket; the band test is slow on a cold cache.

Harness net: +1 / -0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: {SESSION}

Factory-State: READY
{VERIFY}
"""

# Section 3, case 5: PR #347's original body, its shape kept: a none-line, then later-ticket prose with
# no heading, the Harness net line, the trailers and the footer.
PR_347_ORIGINAL = f"""Not verified: the live corpus rebuild on the owner's tree (no notes in the cloud).

Verify summary (staged tree):
- ruff check tools/leakscan: 0; ruff format --check: 0; mypy tools/leakscan: 0
- pytest tools/leakscan -rf: 0 (96 passed; acceptance 5 of 5)

## Cut
Nothing cut.

A later ticket must know: if the owner's tree shows notes lost to the design's over-matches above,
narrow the content rule to need pytest's header line, or several pytest lines, rather than one summary
line, and narrow the stem globs (issue to file if wanted: "Leak corpus test-output rule skips a real
note that quotes one pytest summary line").

Harness net: +567 / -52 (acceptance file +255 of it)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: {SESSION}

Factory-State: READY
{VERIFY}


{FOOTER}

"""


def test_builder_md_shape_passes() -> None:
    assert problems(BUILDER_MD_SHAPE) == []


def test_none_then_the_later_ticket_heading_passes() -> None:
    body = "## Cut\nNone.\n\n## For a later ticket\nThe export needs its own ticket.\n"
    assert problems(body) == []


@pytest.mark.parametrize(
    "line", ["None.", "Nothing.", "Nothing cut.", "Nothing was cut.", "No cuts.", "- None"]
)
def test_each_none_line_alone_under_cut_passes(line: str) -> None:
    assert problems(f"## Cut\n{line}\n") == []


@pytest.mark.parametrize(
    "item",
    [
        "- Band width in terminal cells (#5): measure cells, not UTF-16\n  units, in a later ticket.",
        "- Band width in terminal cells: measure cells, not UTF-16\n  units, in a later ticket (#5).",
    ],
    ids=["link-on-first-line", "link-on-continuation"],
)
def test_a_wrapped_item_with_an_indented_continuation_passes(item: str) -> None:
    assert problems(f"## Cut\n{item}\n") == []


def test_pr_347_original_body_passes_prose_after_a_none_line() -> None:
    assert problems(PR_347_ORIGINAL) == []


@pytest.mark.parametrize("heading", ["## Cut", "## Not done", "## Deferred"])
@pytest.mark.parametrize(
    "prose", ["The PDF export was cut.", "Nothing cut except the export.", "Cut: the replay test."]
)
def test_a_prose_cut_is_refused(heading: str, prose: str) -> None:
    assert problems(f"{heading}\n{prose}\n")


def test_a_table_under_deferred_is_refused() -> None:
    body = "## Deferred\n| item | issue |\n|---|---|\n| the PDF export | #5 |\n"
    assert problems(body)


def test_an_unlinked_list_item_after_a_none_line_is_refused() -> None:
    assert problems("## Cut\nNone.\n- the export\n")


@pytest.mark.parametrize("indent", ["    ", "\t"], ids=["four-spaces", "tab"])
def test_a_nested_unlinked_list_item_under_a_linked_item_is_refused(indent: str) -> None:
    assert problems(f"## Cut\n- a (#5)\n{indent}- b\n")


def test_an_indented_table_row_under_an_item_is_refused() -> None:
    assert problems("## Cut\n- a (#5)\n  | the export | later |\n")


ENDING_LINES_NOT_EXACT = [
    "Factory-State: READY the export was cut",
    "Factory-State: DONE",
    "Factory-State: ready",
    "Factory-State: READY, the export was cut",
    "Factory-Verify: 0f3c1d5e7a9b2c4d6e8f1a3b5c7d9e0f2a4b6c8d ok, the export was cut",
    "Factory-Verify: 0f3c1d5e7a9b2c4d6e8f1a3b5c7d9e0f2a4b6c8d",
    "Factory-Verify: 0f3c1d5e ok",
    "Factory-Verify: the export was cut",
    "Factory-Reason: the export was cut",
    "Factory-Reason: time ran out",
    "Harness net: +1 / -0 (the export was cut)",
    "Harness net: +1 / -0 ()",
    f"{FOOTER} and the export was cut",
    f"{SESSION} the export was cut",
    f"Claude-Session: {SESSION} the export was cut",
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com> the export was cut",
]


@pytest.mark.parametrize("line", ENDING_LINES_NOT_EXACT)
@pytest.mark.parametrize(
    "before", ["", "- a (#5)\n\n"], ids=["under-the-heading", "after-a-linked-item"]
)
def test_an_ending_line_not_in_its_exact_form_is_refused(before: str, line: str) -> None:
    assert problems(f"## Cut\n{before}{line}\n")


def test_a_list_item_that_links_no_issue_is_refused() -> None:
    assert problems("## Cut\n- the export\n")


def test_a_list_item_that_links_only_a_closed_issue_is_refused() -> None:
    assert problems(f"## Cut\n- the export (#{CLOSED})\n")
