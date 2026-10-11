"""S22-FL5's builder tests, review 1 of PR #676: a text of 13 to 16 words is a view title only when it is
one line stating storeys that stands in no drawing. A callout of that length naming a kind word inside a
plan's grid, stating storeys or not, stays the plan's annotation (the plan keeps its own title and its
drawing), and a one-line notes heading of that length with nothing under it stays a notes view of its
own. Every title and note here is invented; the sheets are drawn as the acceptance cases'
(`ts22fl5/drawing.py`).

    uv run pytest engine/recognise/tests/test_views_s22fl5_titles.py
"""

from dataclasses import replace

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, storeys, views
from engine.recognise.tests.acceptance.ts22fl5.drawing import BOX, ORIGIN, SCALE
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.types import Sourced, ValueSource, ViewCandidate, ViewKind

CALLOUT = "SEE TYPICAL BEAM SECTION DETAIL ON SHEET S-12 FOR ALL STAIR LAPS AND HOOKS"
STOREY_CALLOUT = "SEE 3RD FLOOR PLAN SECTION DETAIL ON SHEET S-12 FOR ALL STAIR LAPS AND HOOKS"
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
    assert all(12 < _words(t) <= 16 for t in (CALLOUT, STOREY_CALLOUT, NOTE))
    states = [storeys.read(t, DEFAULT, plan_title=True).keys for t in (CALLOUT, STOREY_CALLOUT)]
    assert states[0] in ((), ("not_stated",))
    assert states[1] not in ((), ("not_stated",))


@pytest.mark.parametrize("callout", [CALLOUT, STOREY_CALLOUT], ids=["no-storeys", "storeys"])
def test_a_long_callout_inside_a_plans_grid_leaves_the_plan_its_title_and_drawing(callout: str) -> None:
    found = _read("2ND FLOOR PLAN", [(callout, (120.0, 380.0))])

    assert [(v.kind, v.title) for v in found if v.kind is ViewKind.PLAN] == [
        (ViewKind.PLAN, "2ND FLOOR PLAN")
    ]
    assert all(v.title != callout for v in found)


@pytest.mark.parametrize("place", [(40.0, 590.0), (40.0, 150.0)], ids=["above", "below"])
def test_a_long_one_line_notes_heading_with_nothing_under_it_is_a_notes_view(
    place: tuple[float, float],
) -> None:
    found = _read("2ND FLOOR PLAN", [(NOTE, place)])

    assert (ViewKind.PLAN, "2ND FLOOR PLAN") in [(v.kind, v.title) for v in found]
    assert [v.kind for v in found if v.title == NOTE] == [ViewKind.NOTES]
