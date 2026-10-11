"""S15-E2's acceptance (#535; supersedes #160, #133 and #240): one paper model for view boxes, buffers
and the viewer, with the plot settings in the read artefact where the reader has them.

A view's box and the render buffer's drawing are both "paper millimetres from the sheet's lower-left
corner" (the views' and the buffers' docstrings); the viewer lays the first over the second
(`web/src/sheet/SheetViewer.tsx`, its `SheetOutline`). On main they are two papers: the view finder's
(a model sheet at its frame insert's scale, a layout on its frame's box) and the renderer's (a standard
sheet at a listed scale, else A1's long side; a layout's used extents), with different origins, so
outlines land off the drawing (G1 f-1, #314). Round 1 of #437's review: a bordered A1 sheet was laid on
its border's paper. Each sheet here must be one paper, its views' and its buffer's: the same size, the
same origin, the same scale.

Pinned through the engine's public entry points (`read`, `sheets.find`, `views.find`, `buffers.build`,
the harness's stages), never a module's private names: S15-E4 splits the view finder into a package.
The sheets (`drawing.py`) are built at test time by the repo's writer, so the toolchain is needed:

    uv run pytest -m needs_toolchain engine/render/tests/acceptance/ts15e2
"""

from dataclasses import dataclass

import numpy as np
import pytest

from engine.read import read
from engine.recognise import sheets, views
from engine.recognise.types import SheetCandidate, ViewCandidate
from engine.render import buffers
from engine.render.tests.acceptance.ts15e2 import drawing

pytestmark = pytest.mark.needs_toolchain

WITHIN_MM = 1.0
"""How far apart, on paper, two readings of one place may lie (a rounding, never a misplacement)."""

type Box = tuple[float, float, float, float]


@dataclass(frozen=True)
class Read:
    sheet: SheetCandidate
    views: views.FoundViews
    buffers: buffers.SheetBuffers


def key(sheet: SheetCandidate) -> str | None:
    """A sheet's number as these sheets carry it: its layout's name, else its frame's `DWG_NO`."""
    if sheet.location.layout is not None:
        return sheet.location.layout
    return sheet.number.value if sheet.number is not None else None


@pytest.fixture(scope="module")
def read_sheets(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Read]:
    """Each sheet as 13 finds it, with its views (17) and its buffers (11), by its number."""
    build = tmp_path_factory.mktemp("ts15e2-build")
    paths = drawing.build_set(tmp_path_factory.mktemp("ts15e2-set"), build)
    conventions = sheets.default_conventions()
    found: dict[str, Read] = {}
    for path in paths.values():
        artefact = read(path)
        for sheet in sheets.find(artefact, "structural", conventions):
            number = key(sheet)
            if number is not None:
                found[number] = Read(sheet, views.find(artefact, sheet), buffers.build(artefact, sheet))
    return found


def sheet_of(read_sheets: dict[str, Read], number: str) -> Read:
    assert number in read_sheets, f"13 found no sheet {number}; found {sorted(read_sheets)}"
    return read_sheets[number]


def the_plan(found: views.FoundViews) -> ViewCandidate:
    plans = [v for v in found if v.title == drawing.TITLE]
    assert len(plans) == 1, [(v.kind, v.title, v.box) for v in found]
    return plans[0]


def drawn_box(sheet_buffers: buffers.SheetBuffers, layer: str) -> Box:
    """The box, in the buffer's paper mm, of every line it draws on `layer` (a TEXT in the default
    font is drawn as lines, as it plots)."""
    layers = [i for i, s in enumerate(sheet_buffers.strings) if s == layer]
    prims = np.flatnonzero(np.isin(sheet_buffers.primitives["layer"], layers))
    lines = sheet_buffers.lines[np.isin(sheet_buffers.lines["prim"], prims)]
    assert len(lines), f"the buffer draws nothing on {layer}"
    xs = np.concatenate([lines["x0"], lines["x1"]]).astype(float)
    ys = np.concatenate([lines["y0"], lines["y1"]]).astype(float)
    return (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max()))


def union(a: Box, b: Box) -> Box:
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def paper_of(found: Read) -> tuple[float, float]:
    return (found.buffers.paper.width_mm, found.buffers.paper.height_mm)


ALL = [s.number for s in drawing.SHEETS]
BORDERED_A1 = ["E-401", "E-402", "E-501"]
IN_MODEL_SPACE = [s.number for s in drawing.SHEETS if s.file == "E2-model"]
PLOT_SETTINGS_A1 = ["E-501", "E-502", "E-503"]
HOSTILE_PLOT_SETTINGS = ["E-504", "E-505"]


@pytest.mark.parametrize("number", ALL)
def test_the_plans_view_box_is_where_the_buffer_draws_the_plan_and_its_title(
    read_sheets: dict[str, Read], number: str
) -> None:
    """One origin and one scale: the plan's view box (its drawing and its title under it) is the box
    the buffer draws them in, every edge within 1 mm, so the viewer's outline lies over the plan."""
    found = sheet_of(read_sheets, number)
    box = the_plan(found.views).box
    view = (box.x0, box.y0, box.x1, box.y1)
    drawn = union(
        drawn_box(found.buffers, drawing.PLAN_LAYER), drawn_box(found.buffers, drawing.TITLE_LAYER)
    )
    assert view == pytest.approx(drawn, abs=WITHIN_MM), (
        f"{number}: the plan's view box is {view} on paper; the buffer draws it at {drawn} "
        f"(the buffer's paper {found.buffers.paper}, the views' {found.views.paper})"
    )


@pytest.mark.parametrize("number", ALL)
def test_views_and_the_buffer_lay_the_sheet_on_one_paper(
    read_sheets: dict[str, Read], number: str
) -> None:
    """The paper the views' boxes are on is the buffer's paper: width and height within 1 mm."""
    found = sheet_of(read_sheets, number)
    assert found.views.paper is not None, f"{number}: the views read no paper"
    assert found.views.paper == pytest.approx(paper_of(found), abs=WITHIN_MM), (
        f"{number}: the views lay the sheet on {found.views.paper} mm, the buffer on {paper_of(found)}"
    )


@pytest.mark.parametrize("number", BORDERED_A1)
def test_a_bordered_a1_frame_is_drawn_on_an_a1_sheet(read_sheets: dict[str, Read], number: str) -> None:
    """A frame that draws an A1 sheet's border (inset 20 mm at its binding edge and 10 mm elsewhere,
    or 10 mm all round) and not its trimmed edge is on A1, 841 x 594 mm: never on its border's paper,
    nor on the border stretched to A1's long side."""
    sides = sorted(paper_of(sheet_of(read_sheets, number)), reverse=True)
    assert sides == pytest.approx(list(drawing.A1), abs=WITHIN_MM), (
        f"{number}: a bordered A1 sheet is on A1 {drawing.A1}; the buffer's paper is {sides}"
    )


@pytest.mark.parametrize("number", IN_MODEL_SPACE)
def test_a_model_space_frame_is_drawn_at_its_inserts_scale_on_its_paper(
    read_sheets: dict[str, Read], number: str
) -> None:
    """The frame inserted at 1:100 is drawn at 1:100: its border keeps its size in paper mm, lies on
    the paper, and the plan lies where it is drawn within the border (all within 1 mm)."""
    found = sheet_of(read_sheets, number)
    expected = drawing.sheet(number)
    bx0, by0, bx1, by1 = drawn_box(found.buffers, drawing.FRAME_LAYER)
    width, height = paper_of(found)
    assert (bx1 - bx0, by1 - by0) == pytest.approx(expected.border, abs=WITHIN_MM), (
        f"{number}: the border is {expected.border} mm at 1:100; the buffer draws it "
        f"{(bx1 - bx0, by1 - by0)}"
    )
    on_paper = min(bx0, by0) >= -WITHIN_MM and bx1 <= width + WITHIN_MM and by1 <= height + WITHIN_MM
    assert on_paper, f"{number}: the border {(bx0, by0, bx1, by1)} leaves the paper, {width} x {height}"
    px0, py0, px1, py1 = drawn_box(found.buffers, drawing.PLAN_LAYER)
    from_border = (px0 - bx0, py0 - by0, px1 - bx0, py1 - by0)
    assert from_border == pytest.approx(expected.from_border, abs=WITHIN_MM), (
        f"{number}: the plan lies at {expected.from_border} from the border; the buffer draws it at "
        f"{from_border}"
    )


@pytest.mark.parametrize("number", PLOT_SETTINGS_A1)
def test_a_layout_is_drawn_on_the_sheet_its_plot_settings_state(
    read_sheets: dict[str, Read], number: str
) -> None:
    """A layout whose plot settings state ISO A1 (841 x 594 mm, no margins, no offset, 1:1) is on that
    sheet, its corner at the layout's origin: bordered, framed with a stray line off the sheet beside
    it, or with no frame at all. The plan lies on it where the layout draws it, within 1 mm."""
    found = sheet_of(read_sheets, number)
    assert paper_of(found) == pytest.approx(drawing.A1, abs=WITHIN_MM), (
        f"{number}: the plot settings state A1 {drawing.A1}; the buffer's paper is {paper_of(found)}"
    )
    drawn = drawn_box(found.buffers, drawing.PLAN_LAYER)
    assert drawn == pytest.approx(drawing.sheet(number).region, abs=WITHIN_MM), (
        f"{number}: the plan lies at {drawing.sheet(number).region} on A1; the buffer draws it {drawn}"
    )


@pytest.mark.parametrize("number", HOSTILE_PLOT_SETTINGS)
def test_plot_settings_stating_no_sheet_leave_the_layout_on_its_frames_sheet(
    read_sheets: dict[str, Read], number: str
) -> None:
    """Plot settings are read from a hostile file: a paper of no size, or one a kilometre a side, is no
    sheet. The layout is still drawn, on the sheet its frame draws (A1, at the layout's origin)."""
    found = sheet_of(read_sheets, number)
    assert paper_of(found) == pytest.approx(drawing.A1, abs=WITHIN_MM), (
        f"{number}: its frame is A1 {drawing.A1}; the buffer's paper is {paper_of(found)}"
    )
    drawn = drawn_box(found.buffers, drawing.PLAN_LAYER)
    assert drawn == pytest.approx(drawing.sheet(number).region, abs=WITHIN_MM)


def test_every_sheet_is_found(read_sheets: dict[str, Read]) -> None:
    """The set's seven sheets are all read (so no case above passes by being left out)."""
    assert sorted(read_sheets) == sorted(ALL)
