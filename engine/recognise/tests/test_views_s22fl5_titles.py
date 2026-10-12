"""S22-FL5's builder tests, rewritten in S23 to the long-title shape rule: a one-line text of 13 to
16 words is a view title only when it passes every gate a short title passes, stands alone in its column
(no line of the same lettering over or under it within a notes line's gap) and no notes heading's column
holds it; whether it states storeys or stands within a drawing does not count. So a long callout inside
a plan's grid stacked over a line like it, or under a "NOTE:" heading, stays the plan's annotation (the
plan keeps its own title); a lone long line passing every gate is a title even inside a grid (the rule's
known trade-off: no real sheet has one); and a one-line notes heading of that length with nothing under
it stays a notes view of its own. Every title and note here is invented; the sheets are drawn as the
acceptance cases' (`ts22fl5/drawing.py`).

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
def test_a_lone_long_line_passing_every_gate_is_a_title_even_in_a_grid(callout: str) -> None:
    """The rule's known trade-off (no real sheet has one): a lone long callout a height inside an
    untitled plan's lower edge titles it, as a short title there does."""
    long = read([PLAN], [Text(callout, (120.0, 226.0))])
    short = read([PLAN], [Text("TYPICAL BEAM SECTION DETAIL", (120.0, 226.0))])

    assert [v.title for v in long] == [callout]
    assert [v.title for v in short] == ["TYPICAL BEAM SECTION DETAIL"]


UNDER_TITLE = {
    "centred": ((198.5, 545.0), (59.5, 531.0)),
    "indented": ((40.0, 545.0), (60.0, 531.0)),
    "flush": ((40.0, 545.0), (40.0, 531.0)),
}
"""A plan's title over its grid (6 mm lettering, 63 mm wide) and a long line 14 mm under it (342 mm
wide): centred on the title, indented under it, or flush with its left edge."""


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
@pytest.mark.parametrize("places", list(UNDER_TITLE.values()), ids=list(UNDER_TITLE))
def test_a_long_line_under_a_plans_title_is_its_second_line_not_a_title(
    callout: str, places: tuple[tuple[float, float], tuple[float, float]]
) -> None:
    """Review 1 of PR #686: the long line, nearer the drawing, took the plan from its title."""
    title, line = places
    found = read([PLAN], [Text("2ND FLOOR PLAN", title), Text(callout, line)])

    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, "2ND FLOOR PLAN")]


@pytest.mark.parametrize("place", [(40.0, 590.0), (40.0, 150.0)], ids=["above", "below"])
def test_a_long_one_line_notes_heading_with_nothing_under_it_is_a_notes_view(
    place: tuple[float, float],
) -> None:
    found = _read("2ND FLOOR PLAN", [(NOTE, place)])

    assert (ViewKind.PLAN, "2ND FLOOR PLAN") in [(v.kind, v.title) for v in found]
    assert [v.kind for v in found if v.title == NOTE] == [ViewKind.NOTES]
