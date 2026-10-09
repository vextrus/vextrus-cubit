"""S19-B5's acceptance, R1 (views stage, `engine.recognise.views.storeys.read`): a plan whose own title
states no storey takes the storeys of an unbracketed line under its title (after its scale note) when
13's storey reader reads that whole line as stated (`as_stated` equals the line), recorded as read from
that line (`StoreysSource.TITLE_LINE`, as a bracketed line is); a line with a misspelt or leftover word,
or a reference, is refused. The effect: two consecutive sheets carrying one copied title block, whose
plans state different storeys on that line, are `same_title`, not a Continuation.

The guards (green on the base): a bracketed line is still read; a plan with no storey line keeps its
title block's storeys; a plan whose own title states a storey keeps it; one title over one storey line
still runs on.

Every number, title and line here is invented; only the shape is the drawings' (a plan title naming its
drawing alone, a scale note, then a line of storey words).

    uv run pytest engine/recognise/tests/acceptance/ts19b5
"""

import pytest

from engine.recognise.types import StoreysSource

from .drawing import Sheet, compare, continuations, plan_of, same_titles

TITLE = "SLAB OPENING PLAN, 3RD & 4TH FLOOR"
STATED = "3RD & 4TH FLOOR"
PLAN = "SLAB OPENING PLAN"
SCALE_NOTE = "SCALE 1:100"
UPPER = ("floor_7", "floor_8", "floor_9", "floor_10", "floor_11")

NOT_READ = "engine.recognise.views.storeys did not read the line under the title"
RAN_ON = "engine.recognise.conflicts ran on over different storey lines"


def sheet(number: str, *lines: str, plan: str = PLAN) -> Sheet:
    """A sheet of the copied title block, its one plan titled `plan`, the `lines` under that title."""
    return Sheet(number, TITLE, STATED, plan, lines)


# The line is read --------------------------------------------------------------------------------------


def test_an_unbracketed_storey_line_under_the_scale_note_gives_the_plan_its_storeys() -> None:
    plan = plan_of(sheet("S-22", SCALE_NOTE, "7TH TO 11TH FLOOR"))

    assert (plan.storeys, plan.storeys_as_stated, plan.storeys_source) == (
        UPPER,
        "7TH TO 11TH FLOOR",
        StoreysSource.TITLE_LINE,
    ), NOT_READ


def test_a_storey_line_stating_the_title_blocks_storeys_is_read_from_the_line() -> None:
    """The first sheet of the pair: its line states what its title block states, and the plan's
    storeys are recorded as read from the line, not inherited from the sheet's title."""
    plan = plan_of(sheet("S-21", SCALE_NOTE, STATED))

    assert (plan.storeys, plan.storeys_as_stated, plan.storeys_source) == (
        ("floor_3", "floor_4"),
        STATED,
        StoreysSource.TITLE_LINE,
    ), NOT_READ


# The line is refused (guards) --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "line",
    ["UPPPER 6TH FLOOR", "7TH TO 11TH FLOORS ONLY", "REFER 6TH FLOOR PLAN"],
    ids=["misspelt-word", "leftover-word", "reference"],
)
def test_a_line_the_storey_reader_reads_only_in_part_is_refused(line: str) -> None:
    """The whole line must read as stated: a misspelt or leftover word, or a reference to another
    plan, leaves the plan with its title block's storeys."""
    plan = plan_of(sheet("S-22", SCALE_NOTE, line))

    assert plan.storeys == ("floor_3", "floor_4")
    assert plan.storeys_source is StoreysSource.SHEET_TITLE


def test_a_plan_with_only_a_scale_note_keeps_its_title_blocks_storeys() -> None:
    plan = plan_of(sheet("S-22", SCALE_NOTE))

    assert plan.storeys == ("floor_3", "floor_4")
    assert plan.storeys_as_stated == STATED
    assert plan.storeys_source is StoreysSource.SHEET_TITLE


def test_a_bracketed_storey_line_after_the_scale_note_is_still_read() -> None:
    plan = plan_of(sheet("S-22", SCALE_NOTE, "(7TH TO 11TH FLOOR)"))

    assert plan.storeys == UPPER
    assert plan.storeys_as_stated == "7TH TO 11TH FLOOR"
    assert plan.storeys_source is StoreysSource.TITLE_LINE


def test_a_plan_whose_own_title_states_a_storey_keeps_it_over_the_line() -> None:
    plan = plan_of(sheet("S-22", SCALE_NOTE, "7TH TO 11TH FLOOR", plan="3RD FLOOR SLAB OPENING PLAN"))

    assert plan.storeys == ("floor_3",)
    assert plan.storeys_source is None


# The pair --------------------------------------------------------------------------------------------


def test_one_copied_title_block_over_different_storey_lines_is_same_title_not_a_continuation() -> None:
    found = compare([sheet("S-21", SCALE_NOTE, STATED), sheet("S-22", SCALE_NOTE, "7TH TO 11TH FLOOR")])

    assert (continuations(found), same_titles(found)) == ([], [["S-21", "S-22"]]), RAN_ON


def test_one_title_over_one_storey_line_on_both_sheets_still_runs_on() -> None:
    found = compare([sheet("S-21", SCALE_NOTE, STATED), sheet("S-22", SCALE_NOTE, STATED)])

    assert continuations(found) == [["S-21", "S-22"]]
    assert same_titles(found) == []


def test_a_refused_line_on_the_next_sheet_still_runs_on() -> None:
    found = compare([sheet("S-21", SCALE_NOTE, STATED), sheet("S-22", SCALE_NOTE, "UPPPER 6TH FLOOR")])

    assert continuations(found) == [["S-21", "S-22"]]
    assert same_titles(found) == []
