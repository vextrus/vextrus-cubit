"""Ticket 160's acceptance (#160, absorbing #133): one paper scale for views and buffers. Views (17)
and render buffers (11) both lay a sheet "in paper millimetres from the sheet's lower-left corner"
(each module's docstring); for a model-space frame inserted at a scale they must lay it on the same
paper, the frame's.

From the ticket: "Synthetic model-space frame inserted at a non-standard scale, and at 90°: a known
view's box overlays its drawing in the buffer within 1 mm; the buffer's paper equals the frame's
paper." and from its brief: views and buffers use one paper scale (both agree on every case).

Carried into S15-E2 (#535), which supersedes #160: its one paper must lay these sheets as well as
those of `engine/render/tests/acceptance/ts15e2`.

Built at test time by the repo's writer (drawing.py), so the toolchain is needed:

    uv run pytest -m needs_toolchain engine/render/tests/acceptance/t160
"""

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest

from engine.read import read
from engine.recognise import sheets, views
from engine.recognise.types import SheetCandidate, SheetConventions, ViewCandidate
from engine.render import buffers
from engine.render.tests.acceptance.t160 import drawing

pytestmark = pytest.mark.needs_toolchain

WITHIN_MM = 1.0
CONVENTIONS = Path(__file__).parents[4] / "recognise" / "conventions" / "sheet-default.json"


@dataclass(frozen=True)
class Read:
    sheet: SheetCandidate
    views: views.FoundViews
    buffers: buffers.SheetBuffers


@pytest.fixture(scope="module")
def read_sheets(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Read]:
    """Each frame's sheet, as 13 finds it, with its views (17) and its buffers (11)."""
    build = tmp_path_factory.mktemp("t160-build")
    paths = drawing.build_set(tmp_path_factory.mktemp("t160-set"), build)
    conventions = SheetConventions.from_json(json.loads(CONVENTIONS.read_text(encoding="utf-8")))
    found: dict[str, Read] = {}
    for path in paths.values():
        artefact = read(path)
        for sheet in sheets.find(artefact, "structural", conventions):
            if sheet.number is not None and sheet.location.box is not None:
                found[sheet.number.value] = Read(
                    sheet, views.find(artefact, sheet), buffers.build(artefact, sheet)
                )
    return found


def frame(number: str) -> drawing.Frame:
    return next(f for f in drawing.FRAMES if f.number == number)


def sheet_of(read_sheets: dict[str, Read], number: str) -> Read:
    assert number in read_sheets, f"13 found no model-space sheet {number}; found {sorted(read_sheets)}"
    return read_sheets[number]


def the_plan(found: views.FoundViews) -> ViewCandidate:
    plans = [v for v in found if v.title == drawing.TITLE]
    assert len(plans) == 1, [(v.kind, v.title, v.box) for v in found]
    return plans[0]


def drawn_box(sheet_buffers: buffers.SheetBuffers, layer: str) -> tuple[float, float, float, float]:
    """The box, in the buffer's paper mm, of every line drawn on `layer`."""
    layers = [i for i, s in enumerate(sheet_buffers.strings) if s == layer]
    prims = np.flatnonzero(np.isin(sheet_buffers.primitives["layer"], layers))
    lines = sheet_buffers.lines[np.isin(sheet_buffers.lines["prim"], prims)]
    assert len(lines), f"the buffer draws nothing on {layer}"
    xs = np.concatenate([lines["x0"], lines["x1"]]).astype(float)
    ys = np.concatenate([lines["y0"], lines["y1"]]).astype(float)
    return (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max()))


ALL = [f.number for f in drawing.FRAMES]
KNOWN_PAPER = [f.number for f in drawing.FRAMES if f.fraction == 1]
"""The frames drawn at paper size, whose insert's scale states their paper."""


@pytest.mark.parametrize("number", ALL)
def test_a_known_views_box_overlays_its_drawing_in_the_buffer_within_1_mm(
    read_sheets: dict[str, Read], number: str
) -> None:
    """The plan's view box (its drawing, and its title under it) lies over the plan as the buffer draws
    it: left, right and top edges within 1 mm of the drawn plan's, its foot within 1 mm of the title's
    baseline, `TITLE_GAP` A3 mm under the drawn plan (through the buffer's own mm a drawing unit, so
    a frame read on another paper keeps its title where the buffer draws it)."""
    found = sheet_of(read_sheets, number)
    box = the_plan(found.views).box
    x0, y0, x1, y1 = drawn_box(found.buffers, drawing.PLAN_LAYER)
    view = (box.x0, box.y0, box.x1, box.y1)
    gap = drawing.TITLE_GAP * frame(number).scale * found.buffers.paper.mm_per_unit
    drawn = (x0, y0 - gap, x1, y1)
    assert view == pytest.approx(drawn, abs=WITHIN_MM), (
        f"{number}: the view's box {view} on paper mm; the buffer draws it at {drawn} "
        f"(buffer paper {found.buffers.paper}, views paper {found.views.paper})"
    )


@pytest.mark.parametrize("number", KNOWN_PAPER)
def test_the_buffers_paper_is_the_frames_paper(read_sheets: dict[str, Read], number: str) -> None:
    """An A3 frame inserted at any scale, turned or not, in millimetres or metres, is drawn on A3
    (420 x 297 mm), never on A1."""
    paper = sheet_of(read_sheets, number).buffers.paper
    sides = sorted((paper.width_mm, paper.height_mm), reverse=True)
    assert sides == pytest.approx(list(drawing.A3), abs=WITHIN_MM), (
        f"{number}: the frame's paper is A3 {drawing.A3}; the buffer's is {paper}"
    )


@pytest.mark.parametrize("number", KNOWN_PAPER)
def test_the_buffer_draws_the_plan_where_it_lies_on_the_frames_paper(
    read_sheets: dict[str, Read], number: str
) -> None:
    """The plan drawn in model space at its paper place (mm from the frame's lower-left corner, in model
    space's axes) is drawn there in the buffer, within 1 mm."""
    drawn = drawn_box(sheet_of(read_sheets, number).buffers, drawing.PLAN_LAYER)
    assert drawn == pytest.approx(frame(number).region, abs=WITHIN_MM), (
        f"{number}: the plan lies at {frame(number).region} on paper mm; the buffer draws it at {drawn}"
    )


@pytest.mark.parametrize("number", ALL)
def test_views_and_buffers_lay_the_sheet_on_one_paper(read_sheets: dict[str, Read], number: str) -> None:
    """Views' paper and the buffer's paper are one (width and height, within 1 mm), on every case:
    a standard scale, a scale no list holds, a turned frame, a drawing in metres, and a frame block
    drawn at a fraction of its paper size."""
    found = sheet_of(read_sheets, number)
    assert found.views.paper is not None, f"{number}: views read no paper"
    paper = found.buffers.paper
    assert (paper.width_mm, paper.height_mm) == pytest.approx(found.views.paper, abs=WITHIN_MM), (
        f"{number}: views lay the sheet on {found.views.paper} mm, the buffer on {paper}"
    )
