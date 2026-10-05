"""#160's review, round 1: what paper a model-space frame lies on, in views and buffers alike, and where
the Plot's registration lays that paper on its page.

- A frame block drawn as a bordered sheet (ISO 5457's A3 border, 390 x 277 mm, inside the A3 sheet's
  edge) states its paper by its insert's scale: at 1:100 and at 1:37 it is read at that scale, on the
  border's own 390 x 277 mm, in views and in the buffer.
- A frame block drawn at a tenth of its paper (an A1 frame, 84.1 x 59.4 units) states no paper: the
  sheet is laid on A1's long side (never a guess of A3 or A4), and on an A1 Plot page its border lands
  on the page's edge, 0-841 x 0-594 mm.
- A sheet whose paper is assumed (no frame states it) is fitted to its Plot page, never laid at 1:1 on
  a smaller part of it.

Synthetic drawings, written by the repo's writer (engine/fixtures/dwg) in the test's temporary folder:
invented frames, nothing from a real drawing. The DWG cases need the toolchain:

    uv run --no-sync pytest -m needs_toolchain engine/render/tests/test_frame_papers.py
"""

import json
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np
import pytest
from ezdxf.document import Drawing as Dxf
from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing
from engine.plot import registration
from engine.read import read
from engine.read.pdf.types import Page
from engine.recognise import sheets, views
from engine.recognise.types import Box, SheetCandidate, SheetConventions, SheetLocation
from engine.render import buffers
from engine.render.fixtures.artefacts import Drawing

WITHIN_MM = 1.0
PT_PER_MM = 72 / 25.4
A1 = (841.0, 594.0)
A3 = (420.0, 297.0)
ISO_A3_BORDER = (390.0, 277.0)
"""ISO 5457's A3 border: 20 mm binding on the left, 10 mm on the other sides."""
CONVENTIONS = Path(__file__).parents[2] / "recognise" / "conventions" / "sheet-default.json"
FRAME_LAYER = "FP-FRAME"
PLAN_LAYER = "FP-PLAN"


@dataclass(frozen=True)
class Frame:
    number: str
    block: str
    size: tuple[float, float]
    """The frame block's border as drawn, in block units."""
    insert: float
    """The insert's scale."""
    at: tuple[float, float]

    @property
    def model(self) -> tuple[float, float]:
        """The frame's box in model space, drawing units."""
        return (self.size[0] * self.insert, self.size[1] * self.insert)


FRAMES = (
    Frame("FP-401", "ISO-A3", ISO_A3_BORDER, 100.0, (0.0, 0.0)),
    Frame("FP-402", "ISO-A3", ISO_A3_BORDER, 37.0, (100_000.0, 0.0)),
    Frame("FP-403", "A1-TENTH", (84.1, 59.4), 600.0, (200_000.0, 0.0)),
    Frame("FP-404", "A1-TENTH", (84.1, 59.4), 370.0, (300_000.0, 0.0)),
    Frame("FP-405", "A1-THIRD", (841.0 / 3, 198.0), 300.0, (400_000.0, 0.0)),
    Frame("FP-406", "A1-840", (840.0, 594.0), 100.0, (500_000.0, 0.0)),
    Frame("FP-407", "A2", (594.0, 420.0), 50.0, (600_000.0, 0.0)),
    Frame("FP-408", "ANSI-C", (558.8, 431.8), 48.0, (700_000.0, 0.0)),
)


def _frame(block: BlockLayout, width: float, height: float) -> None:
    """A border and a title block strip at its right, attributed, drawn `width` x `height` units."""
    k = width / 420.0
    block.add_lwpolyline([(0, 0), (width, 0), (width, height), (0, height)], close=True,
                         dxfattribs={"layer": FRAME_LAYER})  # fmt: skip
    x0, x1, y1 = width - 80 * k, width, height
    block.add_lwpolyline([(x0, 0), (x1, 0), (x1, y1), (x0, y1)], close=True)
    rows = (("DRAWING NO.", "DWG_NO", 4.0), ("DRAWING TITLE", "TITLE", 3.0), ("REV.", "REV", 3.0),
            ("DATE", "DATE", 2.5))  # fmt: skip
    for i, (label, tag, size) in enumerate(rows):
        top = y1 - (10 + 18 * i) * k
        block.add_text(label, height=2.0 * k).set_placement((x0 + 4 * k, top))
        block.add_attdef(tag, (x0 + 4 * k, top - 7 * k), dxfattribs={"height": size * k})


def _draw() -> Dxf:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    for layer in (FRAME_LAYER, PLAN_LAYER):
        doc.layers.add(layer)
    _frame(doc.blocks.new("ISO-A3", base_point=(0, 0)), *ISO_A3_BORDER)
    _frame(doc.blocks.new("A1-TENTH", base_point=(0, 0)), 84.1, 59.4)
    _frame(doc.blocks.new("A1-THIRD", base_point=(0, 0)), 841.0 / 3, 198.0)
    _frame(doc.blocks.new("A1-840", base_point=(0, 0)), 840.0, 594.0)
    _frame(doc.blocks.new("A2", base_point=(0, 0)), 594.0, 420.0)
    _frame(doc.blocks.new("ANSI-C", base_point=(0, 0)), 558.8, 431.8)
    model = doc.modelspace()
    for frame in FRAMES:
        s = frame.insert
        ref = model.add_blockref(
            frame.block, frame.at, dxfattribs={"xscale": s, "yscale": s, "zscale": s}
        )
        ref.add_auto_attribs({"DWG_NO": frame.number, "TITLE": "GROUND FLOOR PLAN", "REV": "R0",
                              "DATE": "05.10.2026"})  # fmt: skip
        x, y = frame.at
        w, h = frame.model
        model.add_lwpolyline([(x + 0.1 * w, y + 0.2 * h), (x + 0.6 * w, y + 0.2 * h),
                              (x + 0.6 * w, y + 0.8 * h), (x + 0.1 * w, y + 0.8 * h)], close=True,
                             dxfattribs={"layer": PLAN_LAYER})  # fmt: skip
    return doc


@dataclass(frozen=True)
class Read:
    sheet: SheetCandidate
    views: views.FoundViews
    buffers: buffers.SheetBuffers


@pytest.fixture(scope="module")
def read_sheets(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Read]:
    build = tmp_path_factory.mktemp("frame-papers")
    writer = dwg.build_writer(build)
    dxf, path = build / "FP.dxf", build / "FP.dwg"
    _draw().saveas(dxf)
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(path), "AC1032"], 120)
    artefact = read(path)
    conventions = SheetConventions.from_json(json.loads(CONVENTIONS.read_text(encoding="utf-8")))
    found: dict[str, Read] = {}
    for sheet in sheets.find(artefact, "structural", conventions):
        if sheet.number is not None and sheet.location.box is not None:
            found[sheet.number.value] = Read(
                sheet, views.find(artefact, sheet), buffers.build(artefact, sheet)
            )
    return found


def _sheet(read_sheets: dict[str, Read], number: str) -> Read:
    assert number in read_sheets, f"13 found no model-space sheet {number}; found {sorted(read_sheets)}"
    return read_sheets[number]


def _page(size_mm: tuple[float, float]) -> Page:
    w, h = size_mm[0] * PT_PER_MM, size_mm[1] * PT_PER_MM
    return Page("0" * 64, 1, w, h, 0, (0.0, 0.0, w, h), False, ())


def _drawn(sheet_buffers: buffers.SheetBuffers, layer: str) -> tuple[float, float, float, float]:
    """The box, in the buffer's paper mm, of every line drawn on `layer`."""
    layers = [i for i, s in enumerate(sheet_buffers.strings) if s == layer]
    prims = np.flatnonzero(np.isin(sheet_buffers.primitives["layer"], layers))
    lines = sheet_buffers.lines[np.isin(sheet_buffers.lines["prim"], prims)]
    assert len(lines), f"the buffer draws nothing on {layer}"
    xs = np.concatenate([lines["x0"], lines["x1"]]).astype(float)
    ys = np.concatenate([lines["y0"], lines["y1"]]).astype(float)
    return (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max()))


@pytest.mark.needs_toolchain
@pytest.mark.parametrize("number", ["FP-401", "FP-402"])
def test_an_iso_bordered_a3_frame_is_read_at_its_inserts_scale(
    read_sheets: dict[str, Read], number: str
) -> None:
    """The border lies inside A3 by ISO's binding margin: its insert's scale is the paper's (main read
    it so; a 5 % match read it A4 at 1:131, or A2), in views and in the buffer."""
    found = _sheet(read_sheets, number)
    frame = next(f for f in FRAMES if f.number == number)
    paper = found.buffers.paper
    assert paper.mm_per_unit == pytest.approx(1 / frame.insert, rel=1e-6), paper
    assert paper.source == buffers.PaperSource.STANDARD
    assert (paper.width_mm, paper.height_mm) == pytest.approx(ISO_A3_BORDER, abs=WITHIN_MM)
    assert found.views.paper == pytest.approx(ISO_A3_BORDER, abs=WITHIN_MM)


@pytest.mark.needs_toolchain
@pytest.mark.parametrize("number", ["FP-403", "FP-404"])
def test_a_tenth_size_a1_frame_is_laid_on_a1_and_its_border_on_an_a1_plot_pages_edge(
    read_sheets: dict[str, Read], number: str
) -> None:
    """A frame block drawn at a tenth of its paper states none: views and buffer lay it on A1's long
    side (never a smaller guess, A3 at 1:120 or 1:74), and the registration lays its border on an A1
    page's edge."""
    found = _sheet(read_sheets, number)
    paper = found.buffers.paper
    assert paper.source == buffers.PaperSource.ASSUMED
    assert (paper.width_mm, paper.height_mm) == pytest.approx(A1, abs=WITHIN_MM)
    assert found.views.paper == pytest.approx(A1, abs=WITHIN_MM)
    page = _page(A1)
    placed = registration.place(page, found.sheet, found.buffers)
    assert placed is not None
    transform = placed[0]
    assert transform.rotation == 0
    x0, y0, x1, y1 = _drawn(found.buffers, FRAME_LAYER)
    on_page = tuple(
        (transform.scale * v + transform.offset[i % 2]) / PT_PER_MM
        for i, v in enumerate((x0, y0, x1, y1))
    )
    assert on_page == pytest.approx((0.0, 0.0, *A1), abs=WITHIN_MM), (paper, transform)


@pytest.mark.needs_toolchain
def test_a_frame_whose_box_is_a_standard_sheet_at_a_standard_scale_is_read_so(
    read_sheets: dict[str, Read],
) -> None:
    """#160's review, round 2: a frame block drawn at a third of an A1 (280 x 198 units), inserted at
    300, boxes an exact A1 at 1:100. Its insert's scale gives a paper inside A4's binding window, but
    the box's own match wins: A1 at 1:100 (as main's buffers read it), spanning its A1 Plot page."""
    found = _sheet(read_sheets, "FP-405")
    paper = found.buffers.paper
    assert paper.mm_per_unit == pytest.approx(1 / 100, rel=1e-6), paper
    assert paper.source == buffers.PaperSource.STANDARD
    assert (paper.width_mm, paper.height_mm) == pytest.approx(A1, abs=WITHIN_MM)
    assert found.views.paper == pytest.approx(A1, abs=WITHIN_MM)
    page = _page(A1)
    placed = registration.place(page, found.sheet, found.buffers)
    assert placed is not None
    span = placed[0].scale * paper.width_mm / page.width
    assert span >= 0.98, (paper, placed[0])


@pytest.mark.needs_toolchain
@pytest.mark.parametrize("number", ["FP-406", "FP-407", "FP-408"])
def test_a_frame_drawn_at_its_sheets_size_is_read_at_its_inserts_scale(
    read_sheets: dict[str, Read], number: str
) -> None:
    """#160's review, round 3: a sheet twice another (A1 = 2 x A3, A2 = 2 x A4, ANSI C = 2 x ANSI A)
    boxes both at standard scales; a frame block drawn at its own sheet's size says which: an A1 drawn
    840 x 594 at 1:100 is A1 (not A3 at 1:200), an A2 at 1:50 is A2 (not A4 at 1:100), an ANSI C at
    1:48 is ANSI C (not ANSI A at 1:96)."""
    found = _sheet(read_sheets, number)
    frame = next(f for f in FRAMES if f.number == number)
    paper = found.buffers.paper
    assert paper.mm_per_unit == pytest.approx(1 / frame.insert, rel=1e-6), paper
    assert paper.source == buffers.PaperSource.STANDARD
    assert (paper.width_mm, paper.height_mm) == pytest.approx(frame.size, abs=WITHIN_MM)
    assert found.views.paper == pytest.approx(frame.size, abs=WITHIN_MM)


@pytest.mark.needs_toolchain
@pytest.mark.parametrize("number", [f.number for f in FRAMES])
def test_views_and_buffers_keep_one_paper(read_sheets: dict[str, Read], number: str) -> None:
    found = _sheet(read_sheets, number)
    paper = found.buffers.paper
    assert found.views.paper == pytest.approx((paper.width_mm, paper.height_mm), abs=WITHIN_MM)


@pytest.mark.parametrize("insunits", [4, 6])
def test_an_assumed_paper_spans_its_plot_page(insunits: int) -> None:
    """A box no frame states (2200 x 1556 units: a guess of A4 at 1:7.4) on an A3 page: the assumed
    paper is fitted to the page, never laid at 1:1 on 71 % of it, so the ink's alignment rescales it."""
    side = 2200.0 if insunits == 4 else 2.2
    artefact = Drawing().artefact()
    artefact = replace(artefact, summary=replace(artefact.summary, insunits=insunits))
    sheet = SheetCandidate(SheetLocation(box=Box(0.0, 0.0, side, side * 1556 / 2200)))
    built = buffers.build(artefact, sheet)
    assert built.paper.source == buffers.PaperSource.ASSUMED
    page = _page(A3)
    placed = registration.place(page, sheet, built)
    assert placed is not None
    transform = placed[0]
    span = transform.scale * built.paper.width_mm / page.width
    assert span >= 0.98, (built.paper, transform)


@pytest.mark.parametrize("layout", [None, "Sheet1"])
def test_an_assumed_paper_smaller_than_its_page_is_fitted_in_model_space_and_kept_on_a_layout(
    layout: str | None,
) -> None:
    """The registration lays a paper at 1:1 only where its size is the drawing's: a model-space sheet's
    assumed paper (A4 here, on an A3 page) is fitted to the page; a layout's assumed paper (its units
    taken as mm, at the size it is drawn) stays at 1:1, as before."""
    built = buffers.build(
        Drawing().artefact(), SheetCandidate(SheetLocation(box=Box(0.0, 0.0, 297.0, 210.0)))
    )
    built = replace(
        built,
        paper=replace(built.paper, width_mm=297.0, height_mm=210.0, source=buffers.PaperSource.ASSUMED),
    )
    sheet = SheetCandidate(
        SheetLocation(layout=layout) if layout else SheetLocation(box=Box(0.0, 0.0, 297.0, 210.0))
    )
    page = _page(A3)
    placed = registration.place(page, sheet, built)
    assert placed is not None
    scale = placed[0].scale
    if layout is None:
        assert scale * 297.0 / page.width == pytest.approx(1.0, abs=0.01)
    else:
        assert scale == pytest.approx(PT_PER_MM)
