"""S15-E2's acceptance (#535, superseding #240): a Plot page whose CropBox is inset from its MediaBox is
placed on its sheet as the page is displayed.

A PDF viewer shows a page's CropBox, not its MediaBox (pdfium and pdf.js both draw the CropBox; a
plot driver may write a MediaBox larger than the sheet, its sheet the CropBox inside it). The engine's
page frame is the MediaBox's (12's `Page`: its lower-left corner at the origin, `Page.crop` the
CropBox in it), and 18's transform is sheet millimetres to points in that frame. So a page placed by
its sizes (a page whose text gives fewer than two pairs to place it by: the module's docstring of
`engine.plot.registration`) must be laid by its CropBox's size and corner: the sheet's lower-left
corner on the CropBox's, the sheet at 1:1 when its paper is the CropBox's size. On main it is centred
on the MediaBox, `CROP_OFFSET` points off.

The sheet is `E-506` of S15-E2's set (`engine/render/tests/acceptance/ts15e2/drawing.py`: a layout,
an A1 frame at its origin, its plot settings A1), built by the repo's DWG writer; the Plot is written
here by the repo's PDF writer (`engine/fixtures/pdf/_writer.py`) and read by 12 in its sandbox:

    uv run pytest -m "needs_toolchain or needs_bwrap" engine/plot/tests/acceptance/ts15e2
"""

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document, num, nums, text, truetype_font
from engine.plot import registration
from engine.read import pdf as pdf_reader
from engine.read import read
from engine.recognise import sheets
from engine.recognise.types import PlotMatch, PlotTransform
from engine.render import buffers
from engine.render.tests.acceptance.ts15e2 import drawing

pytestmark = [pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]

PT_PER_MM = 72 / 25.4
WITHIN_PT = 1.0 * PT_PER_MM
"""One paper millimetre, in points: a rounding, never a misplacement."""
NUMBER = "E-506"
SHEET_PT = (drawing.A1[0] * PT_PER_MM, drawing.A1[1] * PT_PER_MM)
CROP_OFFSET = (100.0, 50.0)
"""The CropBox's lower-left corner in the MediaBox's frame, in points."""
MEDIA_PT = (SHEET_PT[0] + 300.0, SHEET_PT[1] + 200.0)
"""The MediaBox: the sheet and 100 pt left of it, 200 pt right, 50 pt under and 150 pt over."""


def _segment(a: tuple[float, float], b: tuple[float, float]) -> bytes:
    """A stroke between two paper points (mm), drawn on the sheet as the CropBox shows it."""
    (x0, y0), (x1, y1) = (
        (CROP_OFFSET[0] + x * PT_PER_MM, CROP_OFFSET[1] + y * PT_PER_MM) for x, y in (a, b)
    )
    return b"%s %s m %s %s l S\n" % (num(x0), num(y0), num(x1), num(y1))


def _rect(x0: float, y0: float, x1: float, y1: float) -> bytes:
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    return b"".join(_segment(corners[i], corners[i + 1]) for i in range(4))


def _plot() -> bytes:
    """One page: E-506's frame, title block and plan drawn on the CropBox, its number the page's only
    text (one pair: the page is placed by its sizes)."""
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    width, height = drawing.A1
    content = _rect(0, 0, width, height) + _rect(width - drawing.STRIP, 0, width, height)
    content += _rect(*drawing.ON_A1)
    x, y = (width - drawing.STRIP + 4) * PT_PER_MM, (height - 12 - 8) * PT_PER_MM
    content += text(CROP_OFFSET[0] + x, CROP_OFFSET[1] + y, NUMBER, size=6 * PT_PER_MM)
    cx, cy = CROP_OFFSET
    crop = {"CropBox": nums((cx, cy, cx + SHEET_PT[0], cy + SHEET_PT[1]))}
    return document(pdf, [Page(content=content, size=MEDIA_PT, fonts=fonts, entries=crop)])


@pytest.fixture(scope="module")
def matched(tmp_path_factory: pytest.TempPathFactory) -> PlotMatch:
    """The Plot page's match against E-506, placed by its text and sizes alone (no PDF given for ink)."""
    build = tmp_path_factory.mktemp("ts15e2-plot-build")
    paths = drawing.build_set(tmp_path_factory.mktemp("ts15e2-plot-set"), build)
    artefact = read(paths["E2-layouts"])
    found = sheets.find(artefact, "structural", sheets.default_conventions())
    (sheet,) = [s for s in found if s.location.layout == NUMBER]
    plot = tmp_path_factory.mktemp("ts15e2-plot") / "E-plot.pdf"
    plot.write_bytes(_plot())
    pages = pdf_reader.page_text(plot)
    assert len(pages) == 1
    assert pages[0].crop == pytest.approx((*CROP_OFFSET, CROP_OFFSET[0] + SHEET_PT[0],
                                           CROP_OFFSET[1] + SHEET_PT[1]), abs=0.01)  # fmt: skip
    (match,) = registration.match(pages, [sheet], [buffers.build(artefact, sheet)])
    return match


def landing(transform: PlotTransform, x: float, y: float) -> tuple[float, float]:
    """Where sheet point (x, y) mm lands on the page, in points (an unturned page)."""
    assert transform.rotation == 0, transform
    return (transform.scale * x + transform.offset[0], transform.scale * y + transform.offset[1])


def test_the_page_is_matched_to_its_sheet(matched: PlotMatch) -> None:
    assert matched.sheet is not None, f"the page matched no sheet: {matched.reason}"
    assert matched.sheet.location.layout == NUMBER
    assert matched.transform is not None


def test_a_page_with_an_inset_cropbox_is_laid_on_its_cropbox(matched: PlotMatch) -> None:
    """The sheet's lower-left corner lands on the CropBox's, its upper-right on the CropBox's, at 1:1:
    within a paper millimetre."""
    assert matched.transform is not None
    corners = (landing(matched.transform, 0, 0), landing(matched.transform, *drawing.A1))
    crop = (CROP_OFFSET, (CROP_OFFSET[0] + SHEET_PT[0], CROP_OFFSET[1] + SHEET_PT[1]))
    assert corners[0] == pytest.approx(crop[0], abs=WITHIN_PT), (
        f"the sheet's corner lands at {corners[0]} pt; the CropBox's is {crop[0]} "
        f"(the MediaBox is {MEDIA_PT}, transform {matched.transform})"
    )
    assert corners[1] == pytest.approx(crop[1], abs=WITHIN_PT), (
        f"the sheet's far corner lands at {corners[1]} pt; the CropBox's is {crop[1]}"
    )
