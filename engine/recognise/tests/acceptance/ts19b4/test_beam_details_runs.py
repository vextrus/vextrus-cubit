"""Ticket S19-B4 (Train B, false conflict Questions), E1 and E3, on 19b's
`engine.recognise.conflicts.compare` after T-W334's series rule.

- E1: "a section size (inches with X between, e.g. 11"X17") is never a member mark, so per-floor
  beam-detail runs whose marks restart at 1 are not one same_title Question."
- E3: "when the plan before a run states only a symbolic storey, runs are told apart by layer (the run
  title's layer, else its plan's); two runs whose titles both state the same symbolic storey stay one
  Question."

The shape (synthetic): framing plans of beams, each followed by a run of one details title whose
sections name beams `B-1`, `B-2` (the marks restart on every level) with their sizes; two beam plans
of a cistern whose storey is not stated, one of the bottom layer, one of the top. Every title,
number, mark and size is invented.
"""

from dataclasses import replace

from engine.recognise.types import Layer, SheetCandidate, ViewCandidate

from ..w334.test_series_and_ranges import (
    compare,
    conflicts_of,
    continuations,
    no_series,
    same_titles,
    series,
    sheet,
)
from .views import plan, section

DETAILS = "DETAILS OF BEAM BARS"
CUTS = (
    section('SECTION THRU BEAM B-1, 11"X23"'),
    section('SECTION THRU BEAM B-2, 9"X13"'),
)
"""One details sheet's views: marks that restart on every floor, each with its size in inches."""

type Rows = list[tuple[str, str, tuple[ViewCandidate, ...]]]


def built(rows: Rows) -> tuple[list[SheetCandidate], list[tuple[ViewCandidate, ...]]]:
    """The rows' sheets, each with fresh copies of its views (one view object is never given twice)."""
    views = [tuple(replace(v) for v in vs) for _, _, vs in rows]
    return [sheet(n, t) for n, t, _ in rows], views


def floor_plan(number: str, level: str, storey: str) -> tuple[str, str, tuple[ViewCandidate, ...]]:
    title = f"FRAMING PLAN OF BEAMS, LEVEL {level}"
    return number, title, (plan(title, "beam", storey),)


def tank_plan(
    number: str, layer: Layer | None, place: str = "CISTERN"
) -> tuple[str, str, tuple[ViewCandidate, ...]]:
    """A beam plan of a cistern or sump whose storey is not stated (symbolic), of one layer or none."""
    mark = {Layer.BOTTOM: " - BTM", Layer.TOP: " - TOP"}
    title = f"{place} BEAMS PLAN{mark[layer] if layer else ''}"
    return number, title, (plan(title, "beam", "not_stated", layer=layer),)


# E1. A size is no member mark -----------------------------------------------------------------------


def test_runs_whose_marks_restart_after_each_floors_plan_are_a_series_though_their_sizes_repeat() -> (
    None
):
    """The sizes `11"X23"` and `9"X13"` recur on both floors: read as marks `X23` and `X13` they
    would overlap and keep the Question."""
    sheets, views = built(
        [
            floor_plan("S-01", "1", "floor_1"),
            ("S-02", DETAILS, CUTS),
            ("S-03", DETAILS, CUTS),
            floor_plan("S-04", "2", "floor_2"),
            ("S-05", DETAILS, CUTS),
        ]
    )

    found = compare(sheets, views)

    assert continuations(found) == [["S-02", "S-03"]]
    assert series(found) == [["S-02", "S-03", "S-05"]]
    assert same_titles(found) == []
    assert conflicts_of(found) == []


def test_a_size_written_with_a_lower_case_x_or_spaces_is_no_member_mark_either() -> None:
    for first, second in (('11"x17"', '9"x13"'), ('11" X 17"', '9" X 13"')):
        sections = (
            section(f"SECTION THRU BEAM B-1, {first}"),
            section(f"SECTION THRU BEAM B-2, {second}"),
        )
        sheets, views = built(
            [
                floor_plan("S-01", "1", "floor_1"),
                ("S-02", DETAILS, sections),
                floor_plan("S-04", "2", "floor_2"),
                ("S-05", DETAILS, sections),
            ]
        )

        found = compare(sheets, views)

        assert series(found) == [["S-02", "S-05"]], first
        assert conflicts_of(found) == [], first


def test_member_marks_beside_a_size_still_tell_two_runs_apart() -> None:
    """Both runs follow the one plan, so only their marks, `GB7` and `GB8`, part them: a mark is still
    read where a size stands beside it."""
    sheets, views = built(
        [
            floor_plan("S-01", "1", "floor_1"),
            ("S-02", "LINK BEAM DETAILS", (section('LINK BEAM GB7 11"X17"'),)),
            ("S-05", "LINK BEAM DETAILS", (section('LINK BEAM GB8 11"X17"'),)),
        ]
    )

    found = compare(sheets, views)

    assert series(found) == [["S-02", "S-05"]]
    assert conflicts_of(found) == []


def test_one_member_mark_beside_a_size_on_two_runs_keeps_the_same_title_question() -> None:
    """Green on main (the tripwire): `GB7` drawn twice is the same member, whatever the floors."""
    sheets, views = built(
        [
            floor_plan("S-01", "1", "floor_1"),
            ("S-02", "LINK BEAM DETAILS", (section('LINK BEAM GB7 11"X17"'),)),
            floor_plan("S-04", "2", "floor_2"),
            ("S-05", "LINK BEAM DETAILS", (section('LINK BEAM GB7 11"X17"'),)),
        ]
    )

    found = compare(sheets, views)

    assert same_titles(found) == [["S-02", "S-05"]]
    assert no_series(found)


# E3. After a plan of a symbolic storey, runs are told apart by layer ----------------------------------


def test_runs_after_a_cisterns_bottom_and_top_beam_plans_join_the_floors_runs_in_one_series() -> None:
    """The cistern's plans state no storey: the run after the bottom layer's plan and the run after the
    top layer's plan draw different layers, and no floor."""
    sheets, views = built(
        [
            floor_plan("S-01", "1", "floor_1"),
            ("S-02", DETAILS, CUTS),
            ("S-03", DETAILS, CUTS),
            floor_plan("S-04", "2", "floor_2"),
            ("S-05", DETAILS, CUTS),
            tank_plan("S-06", Layer.BOTTOM),
            ("S-07", DETAILS, CUTS),
            tank_plan("S-08", Layer.TOP),
            ("S-09", DETAILS, CUTS),
        ]
    )

    found = compare(sheets, views)

    assert continuations(found) == [["S-02", "S-03"]]
    assert series(found) == [["S-02", "S-03", "S-05", "S-07", "S-09"]]
    assert same_titles(found) == []
    assert conflicts_of(found) == []


def test_two_runs_whose_titles_both_state_the_bottom_layer_keep_the_question_after_either_plan() -> None:
    """Green on main (the tripwire): the run's own title's layer comes before its plan's, so one run
    after the bottom plan and one after the top plan, both titled the bottom layer, may draw the same
    thing."""
    title = "CISTERN BEAM BARS, BTM MESH DETAILS"
    sheets, views = built(
        [
            tank_plan("S-06", Layer.BOTTOM),
            ("S-07", title, CUTS),
            tank_plan("S-08", Layer.TOP),
            ("S-09", title, CUTS),
        ]
    )

    found = compare(sheets, views)

    assert same_titles(found) == [["S-07", "S-09"]]
    assert no_series(found)


def test_runs_after_plans_of_no_stated_storey_and_no_layer_keep_the_question() -> None:
    """Green on main (the tripwire): what was not read is not different."""
    sheets, views = built(
        [
            floor_plan("S-01", "1", "floor_1"),
            ("S-02", DETAILS, CUTS),
            tank_plan("S-06", None, "SUMP"),
            ("S-07", DETAILS, CUTS),
            tank_plan("S-08", None, "ROOF CISTERN"),
            ("S-09", DETAILS, CUTS),
        ]
    )

    found = compare(sheets, views)

    assert same_titles(found) == [["S-02", "S-07", "S-09"]]
    assert no_series(found)


def test_two_runs_whose_titles_state_one_symbolic_storey_stay_one_question() -> None:
    """Green on main (the tripwire): both runs' titles, and the plans before them, state only the
    typical level; no layer is stated anywhere."""
    title = "BEAM BAR DETAILS, TYPICAL LEVEL"
    east, west = "TYPICAL LEVEL BEAM PLAN (EAST WING)", "TYPICAL LEVEL BEAM PLAN (WEST WING)"
    sheets, views = built(
        [
            ("S-11", east, (plan(east, "beam", "typical"),)),
            ("S-12", title, CUTS),
            ("S-15", west, (plan(west, "beam", "typical"),)),
            ("S-16", title, CUTS),
        ]
    )

    found = compare(sheets, views)

    assert same_titles(found) == [["S-12", "S-16"]]
    assert no_series(found)
