"""A builder's PR body, in the order `.claude/agents/builder.md` gives, is read by merge_ready's cut
gate as the builder meant it. On 5 Oct 2026 PR #347's body, written exactly to that order (`## Cut`,
"Nothing cut.", then what a later ticket must know, the Harness net line and the trailers, with no
heading between), was refused: every line after `## Cut` was read as a cut item linking no issue.
Only list items are cut items now, and "Nothing cut." means none."""

from scripts.merge_ready import cut_problems

AS_BUILDER_MD_SAYS = """## Not verified
- The live call.

ruff 0, ruff-format 0, mypy 0, pytest 0

## Cut
Nothing cut.

A later ticket must know: the corpus skips test output.

Harness net: +567 / -52

Factory-State: READY
Factory-Verify: 873e8dca76545a6a5112f9e12ead6d55bfcb62bd ok
"""


def test_a_body_in_builder_md_order_with_nothing_cut_passes() -> None:
    assert cut_problems(AS_BUILDER_MD_SAYS, lambda number: True) == []


def test_the_none_forms_mean_nothing_was_cut() -> None:
    for line in ("None.", "Nothing.", "Nothing cut.", "Nothing was cut.", "No cuts.", "- None"):
        assert cut_problems(f"## Cut\n{line}\n\nprose after it\n", lambda number: True) == [], line


def test_each_list_item_under_cut_still_needs_an_open_issue() -> None:
    body = "## Cut\n- the band test (#5)\n* the export\n1. the replay\n\nA later ticket must know: x\n"

    found = cut_problems(body, lambda number: True)

    assert found == [
        "'cut' item 2 links no issue: file one and link it (#<n>)",
        "'cut' item 3 links no issue: file one and link it (#<n>)",
    ]
    assert cut_problems("## Cut\n- the band test (#5)\n", lambda number: False) == [
        "'cut' item 1 links no open issue"
    ]
