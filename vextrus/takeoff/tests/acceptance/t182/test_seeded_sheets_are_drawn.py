"""Ticket 182 (M0 21e), #150: KR-01's seeded sheets open nearly empty ("S-04 draws no beams; S-01's
Notes, Legend and Drawing-list boxes are blank ... draw each seeded sheet's views with plausible
content inside their boxes, and the drawing list's rows inside its box"; m0-screens 5: a sheet never
looks empty).

The measure, as the eye sees it: a view's box (Step 1's `views[].box`, which the sheet viewer outlines
on the paper as millimetres from its lower-left corner) against the sheet's render (11's sheet
buffer, `…/drawings/sheets/{sheet_id}/render`, in the same paper millimetres). What lies inside the
box, kept clear of its own outline by 2 % of its size each side, and not inside another view's box
drawn within it (S-04's lift pit detail is drawn inside its plan): line segments with both ends inside,
triangles with a corner inside, glyphs by their origin.
"""

import uuid
from typing import Any

import numpy as np
import pytest

from engine.render.buffers import SheetBuffers
from vextrus.testing.auth import Api

from ..t19a.step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from ..t21c.step1_whole import proposals, the

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

INSET = 0.02
TOLERANCE = 1.0
"""mm: another view's box, its outline among it."""
DRAWING_LIST_ROWS = 13
"""S-01 to S-13, both S-07s one line (m0-screens §7: "a drawing list naming S-01 to S-13")."""


def render(api: Api, project: uuid.UUID, sheet_id: str) -> SheetBuffers:
    response = api.get(f"/api/projects/{project}/drawings/sheets/{sheet_id}/render")
    assert response.status_code == 200, response.content
    return SheetBuffers.from_bytes(response.content)


def inside(view: dict[str, Any]) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = (float(v) for v in view["box"])
    dx, dy = (x1 - x0) * INSET, (y1 - y0) * INSET
    return x0 + dx, y0 + dy, x1 - dx, y1 - dy


def _in(x: Any, y: Any, box: tuple[float, float, float, float]) -> Any:
    x0, y0, x1, y1 = box
    return (x > x0) & (x < x1) & (y > y0) & (y < y1)


def _within(x: Any, y: Any, box: tuple[float, float, float, float], others: list[dict[str, Any]]) -> Any:
    """Inside the view's inset box and in none of the others."""
    hit = _in(x, y, box)
    for other in others:
        x0, y0, x1, y1 = (float(v) for v in other["box"])
        t = TOLERANCE
        hit &= ~((x >= x0 - t) & (x <= x1 + t) & (y >= y0 - t) & (y <= y1 + t))
    return hit


def others_of(sheet: dict[str, Any], view: dict[str, Any]) -> list[dict[str, Any]]:
    """The sheet's other views drawn inside this one's box (a detail inside its plan)."""
    x0, y0, x1, y1 = (float(c) for c in view["box"])

    def nested(other: dict[str, Any]) -> bool:
        a0, b0, a1, b1 = (float(c) for c in other["box"])
        return x0 <= a0 and y0 <= b0 and a1 <= x1 and b1 <= y1

    return [v for v in sheet["views"] if v["id"] != view["id"] and nested(v)]


def drawn_inside(drawn: SheetBuffers, view: dict[str, Any], others: list[dict[str, Any]]) -> int:
    """What is drawn in the view's box and no other's."""
    box = inside(view)
    lines, tris, glyphs = drawn.lines, drawn.triangles, drawn.glyphs
    segments = _within(lines["x0"], lines["y0"], box, others) & _within(
        lines["x1"], lines["y1"], box, others
    )
    corners = (
        _within(tris["x0"], tris["y0"], box, others)
        | _within(tris["x1"], tris["y1"], box, others)
        | _within(tris["x2"], tris["y2"], box, others)
    )
    return int(segments.sum() + corners.sum() + _within(glyphs["ox"], glyphs["oy"], box, others).sum())


def text_rows_inside(drawn: SheetBuffers, view: dict[str, Any]) -> int:
    glyphs = drawn.glyphs[_in(drawn.glyphs["ox"], drawn.glyphs["oy"], inside(view))]
    return len(np.unique(np.round(glyphs["oy"], 0)))


def test_no_seeded_view_box_is_empty(nusrat: Api, kr01: uuid.UUID) -> None:
    empty = []
    for sheet in proposals(nusrat, kr01):
        drawn = render(nusrat, kr01, sheet["sheet_id"])
        for view in sheet["views"]:
            if drawn_inside(drawn, view, others_of(sheet, view)) == 0:
                empty.append((sheet["number"], sheet["revision_mark"], view["kind"], view["title"]))

    assert empty == []


def test_s04s_ground_floor_beam_layout_draws_line_work_inside_its_box(
    nusrat: Api, kr01: uuid.UUID
) -> None:
    s04 = the(proposals(nusrat, kr01), "S-04")
    [plan] = [v for v in s04["views"] if v["kind"] == "plan"]
    drawn = render(nusrat, kr01, s04["sheet_id"])
    box, others = inside(plan), others_of(s04, plan)
    lines = drawn.lines

    drawn_lines = _within(lines["x0"], lines["y0"], box, others) & _within(
        lines["x1"], lines["y1"], box, others
    )
    assert int(drawn_lines.sum()) > 0


@pytest.mark.parametrize("kind", ["notes", "legend", "schedule"])
def test_s01s_notes_legend_and_drawing_list_boxes_hold_their_content(
    nusrat: Api, kr01: uuid.UUID, kind: str
) -> None:
    s01 = the(proposals(nusrat, kr01), "S-01")
    [view] = [v for v in s01["views"] if v["kind"] == kind]

    assert drawn_inside(render(nusrat, kr01, s01["sheet_id"]), view, others_of(s01, view)) > 0


def test_s01s_drawing_list_rows_are_inside_its_box(nusrat: Api, kr01: uuid.UUID) -> None:
    s01 = the(proposals(nusrat, kr01), "S-01")
    [listed] = [v for v in s01["views"] if v["kind"] == "schedule"]

    assert text_rows_inside(render(nusrat, kr01, s01["sheet_id"]), listed) >= DRAWING_LIST_ROWS
