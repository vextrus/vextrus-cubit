"""A builder's PR body, in the shape `.claude/agents/builder.md` gives, passes merge_ready's cut gate; a
cut that slips past the list form is refused, never skipped (fail closed). On 5 Oct 2026 PR #347's
body was refused: every line after `## Cut` (later-ticket prose, the Harness net line, the trailers)
was read as an unlinked cut item, and "Nothing cut." was not a none. Round 1 of #354 then let a prose
cut through."""

from pathlib import Path

import pytest

from scripts.merge_ready import cut_problems

BUILDER_MD = Path(__file__).resolve().parents[2] / ".claude" / "agents" / "builder.md"

AS_BUILDER_MD_SAYS = """## Not verified
- The live call.

ruff 0, ruff-format 0, mypy 0, pytest 0

## Cut
- the band test (#5)

## For a later ticket
The corpus skips test output.

Harness net: +567 / -52

Factory-State: READY
Factory-Verify: 873e8dca76545a6a5112f9e12ead6d55bfcb62bd ok
"""

AS_PR_347_WAS = """## Cut
Nothing cut.

A later ticket must know: the corpus skips test output.

Harness net: +567 / -52

Factory-State: READY
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_x

🤖 Generated with [Claude Code](https://claude.com/claude-code)
"""


def test_builder_md_prescribes_the_shape_this_test_uses() -> None:
    text = " ".join(BUILDER_MD.read_text().split())
    assert "`## Cut` with one list item (`- `) per cut" in text
    assert "or `None.`" in text
    assert "`## For a later ticket`" in text


@pytest.mark.parametrize("body", [AS_BUILDER_MD_SAYS, AS_PR_347_WAS], ids=["builder-md", "pr-347"])
def test_a_builders_body_passes(body: str) -> None:
    assert cut_problems(body, lambda number: True) == []


@pytest.mark.parametrize(
    "line", ["None.", "Nothing.", "Nothing cut.", "Nothing was cut.", "No cuts.", "- None"]
)
def test_a_none_line_closes_the_section(line: str) -> None:
    assert cut_problems(f"## Cut\n{line}\n\nprose after it\n", lambda number: True) == []


@pytest.mark.parametrize(
    "body",
    [
        "## Cut\nThe PDF export was cut: it needs its own ticket.\n",
        "## Cut\nNothing cut except the export.\n",
        "## Cut\nCut: the replay test.\n",
        "## Not done\nthe replay test, for lack of time\n",
        "## Deferred\n| item | why |\n|---|---|\n| export | time |\n",
    ],
    ids=["prose", "nothing-except", "cut-colon", "not-done-prose", "deferred-table"],
)
def test_a_cut_not_written_as_a_list_item_is_refused(body: str) -> None:
    assert cut_problems(body, lambda number: True), body


def test_each_list_item_still_needs_an_open_issue() -> None:
    body = "## Cut\n- the band test (#5)\n* the export\n1. the replay\n"

    assert cut_problems(body, lambda number: True) == [
        "'cut' item 2 links no issue: file one and link it (#<n>)",
        "'cut' item 3 links no issue: file one and link it (#<n>)",
    ]
    assert cut_problems("## Cut\n- the band test (#5)\n", lambda number: False) == [
        "'cut' item 1 links no open issue"
    ]


def test_a_wrapped_item_is_one_item_and_its_link_may_be_on_any_line() -> None:
    first = (
        "## Cut\n- Band width in terminal cells (#5): measure cells, not UTF-16\n"
        "  units, in a later ticket.\n"
    )
    second = "## Cut\n- Band width in terminal cells: measure cells, not\n  UTF-16 units (#5).\n"

    assert cut_problems(first, lambda number: True) == []
    assert cut_problems(second, lambda number: True) == []


@pytest.mark.parametrize(
    "body",
    [
        "## Cut\nNone.\n- the PDF export\n",
        "## Cut\n- None\n- the PDF export\n",
        "## Cut\n- the band test (#5)\nThe replay was cut too.\n",
    ],
    ids=["item-after-none", "item-after-listed-none", "unindented-line-after-item"],
)
def test_a_cut_after_a_none_or_after_an_item_is_still_caught(body: str) -> None:
    assert cut_problems(body, lambda number: True), body


@pytest.mark.parametrize(
    "line",
    [
        "Harness net: the PDF export was cut",
        "Factory-Cut: the PDF export",
        "Co-Authored-By: the replay test was not done",
        "https://claude.ai/code/ the export was cut",
        "\U0001f916 Generated with the export cut",
    ],
)
def test_a_cut_dressed_as_a_trailer_is_refused(line: str) -> None:
    assert cut_problems(f"## Cut\n{line}\n", lambda number: True), line
