"""S22-FL5's builder tests, rewritten in S23 to the long-title shape rule: a one-line text of 13 to
16 words is a view title only when it passes every gate a short title passes, stands alone in its column
(no line of the same lettering over or under it within a notes line's gap) and no notes heading's column
holds it, and (review 1 of PR #692) it stands directly under or over a drawing, centred on it, where
no short title stands; whether it states storeys does not count. So a long callout inside a plan's grid
stays the plan's annotation (the plan keeps its own title, or stays untitled); and a one-line notes
heading of that length with nothing under it stays a notes view of its own. Every title and note here
is invented; the sheets are drawn as the acceptance cases' (`ts22fl5/drawing.py`).

    uv run pytest engine/recognise/tests/test_views_s22fl5_titles.py
"""

from dataclasses import replace

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, storeys, views
from engine.recognise.tests.acceptance.ts22fl5.drawing import BOX, ORIGIN, SCALE
from engine.recognise.tests.acceptance.ts22fl5.layout import Text, read
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import Sourced, ValueSource, ViewCandidate, ViewKind

CALLOUT = "SEE TYPICAL BEAM SECTION DETAIL ON SHEET S-12 FOR ALL STAIR LAPS AND HOOKS"
STOREY_CALLOUT = "SEE 3RD FLOOR PLAN SECTION DETAIL ON SHEET S-12 FOR ALL STAIR LAPS AND HOOKS"
SECOND = "SEE TYPICAL WALL SECTION DETAIL ON SHEET A-31 FOR ALL PARAPET DRIPS AND COPINGS"
NOTE = "NOTES: ALL DIMENSIONS ARE IN MM UNLESS OTHERWISE NOTED AND LAPS PER THE SCHEDULE"


def _words(text: str) -> int:
    return len("".join(c if c.isalnum() else " " for c in text.casefold()).split())


def _read(
    plan: str, extra: list[tuple[str, tuple[float, float]]], discipline: str = "structural"
) -> list[ViewCandidate]:
    """One invented sheet at 1:50: a grid at `BOX` titled `plan` 12 mm under it, and each `extra` text
    at its place on the paper (mm), as tall as the title; its views but the title block."""
    d = Sheets(source_name="invented.dwg")
    block = frame_block(d)
    ox, oy = ORIGIN
    insert = d.insert(block, (ox, oy, 0.0), scale=(SCALE, SCALE, SCALE))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in {0: "GENERAL ARRANGEMENT", 2: "S-21"}.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * SCALE)
    x0, y0, x1, y1 = BOX
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((ox + x * SCALE, oy + y0 * SCALE), (ox + x * SCALE, oy + y1 * SCALE))
        d.line((ox + x0 * SCALE, oy + y * SCALE), (ox + x1 * SCALE, oy + y * SCALE))
    d.text(plan, (ox + x0 * SCALE, oy + (y0 - 12) * SCALE, 0.0), height=6.0 * SCALE)
    for text, (x, y) in extra:
        d.text(text, (ox + x * SCALE, oy + y * SCALE, 0.0), height=6.0 * SCALE)
    artefact = d.artefact()
    (found,) = sheets.find(artefact, discipline, DEFAULT)
    sheet = replace(
        found,
        number=Sourced("S-21", ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced("GENERAL ARRANGEMENT", ValueSource.TITLE_BLOCK_TEXT),
        storeys_as_stated=None,
    )
    got = views.find(artefact, sheet, views.default_conventions())
    return [v for v in got if v.kind is not ViewKind.TITLE_BLOCK]


def test_the_invented_texts_are_13_to_16_words_and_only_one_callout_states_storeys() -> None:
    assert all(12 < _words(t) <= 16 for t in (CALLOUT, STOREY_CALLOUT, NOTE, SECOND))
    states = [storeys.read(t, DEFAULT, plan_title=True).keys for t in (CALLOUT, STOREY_CALLOUT)]
    assert states[0] in ((), ("not_stated",))
    assert states[1] not in ((), ("not_stated",))


PLAN = (40.0, 220.0, 420.0, 520.0)
"""A plan's grid half the paper's height (taller, its rules would be the paper's dividers)."""
TITLE = Text("2ND FLOOR PLAN", (40.0, 208.0))
IN_GRID = (120.0, 380.0)

CLAIMED = {
    "stacked": [Text(SECOND, (120.0, 370.0))],
    "stacked-3-heights-apart": [Text(SECOND, (120.0, 362.0))],
    "under-a-note-heading": [Text("NOTE:", (120.0, 392.0))],
}
"""What leaves a long callout in a plan's grid a callout: a line like it under it (10 mm apart, and
18 mm: 3 heights of 6 mm, inside the notes line's gap), or a notes heading over it."""


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
@pytest.mark.parametrize("claim", list(CLAIMED.values()), ids=list(CLAIMED))
def test_a_stacked_or_noted_long_callout_in_a_plans_grid_leaves_the_plan_its_title(
    callout: str, claim: list[Text]
) -> None:
    found = read([PLAN], [TITLE, Text(callout, IN_GRID), *claim])

    assert [v.title for v in found if v.kind is ViewKind.PLAN] == ["2ND FLOOR PLAN"]
    assert all(v.title not in (callout, SECOND) for v in found)


def test_two_long_lines_3_heights_apart_under_a_plan_are_a_column_not_its_title() -> None:
    """Out of every drawing, only the stack test can tell them: 18 mm baseline to baseline is 3 heights
    of 6 mm, past a short title's stack gap (2.5) and within a notes line's (3.5)."""
    found = read([PLAN], [Text(STOREY_CALLOUT, (40.0, 208.0)), Text(SECOND, (40.0, 190.0))])

    assert [v.title for v in found if v.title is not None] == []


def test_a_long_title_with_a_line_like_it_beyond_a_notes_gap_titles_its_drawing() -> None:
    found = read([PLAN], [Text(STOREY_CALLOUT, (40.0, 208.0)), Text(SECOND, (40.0, 180.0))])

    assert [v.title for v in found] == [STOREY_CALLOUT]


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
def test_a_lone_long_line_inside_a_plans_grid_is_no_title_where_a_short_one_is(callout: str) -> None:
    """Review 1 of PR #692: a long line titles a drawing only standing under or over it, never within
    it (the shape of every real long title); a short title a height inside the lower edge still titles
    it (main's reading)."""
    long = read([PLAN], [Text(callout, (120.0, 226.0))])
    short = read([PLAN], [Text("TYPICAL BEAM SECTION DETAIL", (120.0, 226.0))])

    assert [(v.kind, v.title) for v in long] == [(ViewKind.PLAN, None)]
    assert [v.title for v in short] == ["TYPICAL BEAM SECTION DETAIL"]


UNDER_TITLE = {
    "centred": ((198.5, 545.0), (59.5, 531.0)),
    "indented": ((40.0, 545.0), (45.0, 531.0)),
    "flush": ((40.0, 545.0), (40.0, 531.0)),
}
"""A plan's title over its grid (6 mm lettering, 63 mm wide) and a long line 14 mm under it (342 mm
wide): centred on the title, indented under it (5 mm: within one height, review 2 of PR #686), or
flush with its left edge."""


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
@pytest.mark.parametrize("places", list(UNDER_TITLE.values()), ids=list(UNDER_TITLE))
def test_a_long_line_under_a_plans_title_is_its_second_line_not_a_title(
    callout: str, places: tuple[tuple[float, float], tuple[float, float]]
) -> None:
    """Review 1 of PR #686: the long line, nearer the drawing, took the plan from its title."""
    title, line = places
    found = read([PLAN], [Text("2ND FLOOR PLAN", title), Text(callout, line)])

    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, "2ND FLOOR PLAN")]


NOTE_LINE = "THE 4TH TO 6TH FLOOR PLANS FOLLOW THE 3RD FLOOR PLAN SAVE FOR THE STAIR LANDING"


def test_a_long_notes_line_under_a_heading_under_a_plans_title_stays_the_headings() -> None:
    """Review 2 of PR #686: a heading between them, the long line is the heading's, not the title's."""
    found = read(
        [PLAN],
        [
            Text("2ND FLOOR PLAN", (40.0, 208.0)),
            Text("NOTES:", (40.0, 190.0)),
            Text(NOTE_LINE, (40.0, 182.0)),
        ],
    )

    assert sorted((v.kind, v.title or "") for v in found) == [
        (ViewKind.NOTES, "NOTES:"),
        (ViewKind.PLAN, "2ND FLOOR PLAN"),
    ]


def test_a_long_title_under_a_neighbours_title_titles_its_own_view() -> None:
    """Review 2 of PR #686: the long line runs under a small plan's title beside it, aligned to
    neither its left edge nor its centre, so it is no second line of that title."""
    small, wide = (40.0, 250.0, 110.0, 450.0), (130.0, 240.0, 480.0, 520.0)
    found = read(
        [small, wide], [Text("2ND FLOOR PLAN", (40.0, 236.0)), Text(STOREY_CALLOUT, (90.0, 226.0))]
    )

    assert sorted(v.title or "" for v in found) == sorted(["2ND FLOOR PLAN", STOREY_CALLOUT])
    assert [(v.box.x0, v.box.x1) for v in found if v.title == "2ND FLOOR PLAN"] == [(40.0, 110.0)]


REMARK = "BEAM SECTION DETAIL AS PER SHEET S-12 SAVE AT THE STAIR LANDING AND LIFT CORE"
SCHEDULE_RULES = [((60.0, y), (800.0, y)) for y in (100.0, 227.0, 353.0, 480.0)] + [
    ((x, 100.0), (x, 480.0)) for x in (60.0, 200.0, 340.0, 800.0)
]
"""A ruled schedule of three rows and three columns, its rules across most of the paper."""
SCHEDULE_CELLS = [
    Text(shown, (x + 8.0, y + 50.0))
    for shown, x, y in [
        ("B1", 60.0, 353.0),
        ("300 X 600", 200.0, 353.0),
        ("B2", 60.0, 227.0),
        ("250 X 500", 200.0, 227.0),
        ("B3", 60.0, 100.0),
        ("250 X 450", 200.0, 100.0),
    ]
]


def test_a_lone_long_remark_in_a_ruled_schedule_leaves_it_a_schedule() -> None:
    """Review 3 of PR #686: the remark, alone in its sparse column, named a view kind and passed every
    gate, so the table read as a grid of titled drawings and no view was found."""
    found = read([], [*SCHEDULE_CELLS, Text(REMARK, (348.0, 400.0))], SCHEDULE_RULES)

    assert [(v.kind, v.title) for v in found] == [(ViewKind.SCHEDULE, None)]


STOREYS_LINE = {
    "centred": ((198.5, 545.0), (205.0, 537.0), (59.5, 529.0)),
    "indented": ((40.0, 548.0), (40.0, 539.0), (45.0, 527.0)),
}
"""A plan's title over its grid, its storeys line under it (5 mm lettering), then a long line under
that, aligned to the title."""


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
@pytest.mark.parametrize("places", list(STOREYS_LINE.values()), ids=list(STOREYS_LINE))
def test_a_long_line_under_a_titles_storeys_line_is_its_second_line(
    callout: str, places: tuple[tuple[float, float], ...]
) -> None:
    """Review 3 of PR #686: the title's own storeys line between them is no line between."""
    title, storeys_line, line = places
    found = read(
        [PLAN],
        [
            Text("2ND FLOOR PLAN", title),
            Text("2ND TO 4TH FLOOR", storeys_line, 5.0),
            Text(callout, line),
        ],
    )

    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, "2ND FLOOR PLAN")]


SCHEDULE_MARKS = {
    "a-group-rule": [((340.0, 455.0), (800.0, 455.0))],
    "a-dash": [((560.0, 300.0), (572.0, 300.0))],
    "a-strike": [((340.0, 100.0), (800.0, 227.0))],
}
"""A schedule's own marks, none a drawing that a long line could title: a rule across the last
column's top cell, a 12 mm dash in a cell, a strike through an empty cell."""


@pytest.mark.parametrize("marks", list(SCHEDULE_MARKS.values()), ids=list(SCHEDULE_MARKS))
def test_a_long_remark_in_a_schedule_with_its_own_marks_leaves_it_a_schedule(
    marks: list[tuple[tuple[float, float], tuple[float, float]]],
) -> None:
    """Review 1 of PR #692: a short rule or a dash in the table made it "hold a drawing", and the
    remark became a title again (no view, or an untitled plan)."""
    found = read([], [*SCHEDULE_CELLS, Text(REMARK, (348.0, 400.0))], [*SCHEDULE_RULES, *marks])

    assert [(v.kind, v.title) for v in found] == [(ViewKind.SCHEDULE, None)]


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
def test_a_long_remark_beside_a_plans_title_leaves_the_plan_its_title(callout: str) -> None:
    """Review 1 of PR #692: lettered on the strip under the drawing beside the plan's own title, a
    millimetre nearer the grid, the remark took the plan by its gap; a short title stands at that
    drawing, so no long line titles it."""
    wide = (40.0, 220.0, 620.0, 520.0)
    found = read([wide], [Text("2ND FLOOR PLAN", (412.0, 208.0)), Text(callout, (60.0, 209.0))])

    plans = [v for v in found if v.kind is ViewKind.PLAN]
    assert [(v.title, v.storeys) for v in plans] == [("2ND FLOOR PLAN", ("floor_2",))]
    assert all(v.title != callout for v in found)


@pytest.mark.parametrize("marks", [[], SCHEDULE_MARKS["a-strike"]], ids=["bare", "with-a-strike"])
@pytest.mark.parametrize("at", [(230.0, 70.0), (230.0, 495.0)], ids=["under", "over"])
def test_a_long_footnote_by_a_schedule_leaves_it_a_schedule(
    at: tuple[float, float], marks: list[tuple[tuple[float, float], tuple[float, float]]]
) -> None:
    """Review 2 of PR #692: a ruled table's box was a drawing a long line could title, so a footnote
    centred under or over the schedule took it. A table holding text rows and no drawing is none, and
    a strike through a cell (one stroke, under MIN_STROKES) is no drawing."""
    found = read([], [*SCHEDULE_CELLS, Text(REMARK, at)], [*SCHEDULE_RULES, *marks])

    assert [(v.kind, v.title) for v in found] == [(ViewKind.SCHEDULE, None)]


SHORT_AT = {"a-height-inside-the-lower-edge": (300.0, 226.0), "7.3-heights-under": (300.0, 170.2)}
"""Where a plan's short title stands that pairing lets take the grid (inside an edge, or within
TITLE_GAP under it) but which is not right under it, a long callout standing a height under the grid."""


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
@pytest.mark.parametrize("at", list(SHORT_AT.values()), ids=list(SHORT_AT))
def test_a_long_callout_under_a_grid_leaves_a_short_title_pairing_takes_it(
    callout: str, at: tuple[float, float]
) -> None:
    """Review 2 of PR #692: the guard "no short title stands at that drawing" now asks pairing's own
    rule (`pieces._reach`), so the short title keeps its view and storeys."""
    found = read([PLAN], [Text(callout, (40.0, 208.0)), Text("2ND FLOOR PLAN", at)])

    assert [(v.kind, v.title, v.storeys) for v in found] == [
        (ViewKind.PLAN, "2ND FLOOR PLAN", ("floor_2",))
    ]


@pytest.mark.parametrize("place", [(40.0, 590.0), (40.0, 150.0)], ids=["above", "below"])
def test_a_long_one_line_notes_heading_with_nothing_under_it_is_a_notes_view(
    place: tuple[float, float],
) -> None:
    found = _read("2ND FLOOR PLAN", [(NOTE, place)])

    assert (ViewKind.PLAN, "2ND FLOOR PLAN") in [(v.kind, v.title) for v in found]
    assert [v.kind for v in found if v.title == NOTE] == [ViewKind.NOTES]
