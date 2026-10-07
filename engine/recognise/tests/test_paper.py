"""A sheet's one paper (`engine.recognise.views.paper.paper_of`, S15-E2): the rules a layout's paper is
laid by, from its plot settings, its frame or its extents, and that views and buffers keep to it.

Invented layouts, built in code: no office's convention, nothing from a real drawing.
"""

from dataclasses import replace

import pytest

from engine.read.anchor import DwgAnchor
from engine.read.artefact import PlotSettings, ReadArtefact
from engine.recognise import views
from engine.recognise.tests.drawing import Sheets, rectangle
from engine.recognise.types import SheetCandidate, SheetLocation
from engine.recognise.views.paper import paper_of
from engine.render import buffers
from engine.render.buffers import PaperSource

A1 = (841.0, 594.0)
NAME = "S-01"


def layout(
    frame: tuple[float, float, float, float] | None,
    plot: PlotSettings | None = None,
    *,
    lines: tuple[tuple[tuple[float, float], tuple[float, float]], ...] = (((100, 100), (400, 300)),),
    paper_mm_per_unit: float | None = None,
) -> tuple[ReadArtefact, SheetCandidate]:
    """A layout `NAME` with a frame drawn as a rectangle (paper units), the lines given, and its plot
    settings."""
    d = Sheets()
    handle = d.layout(NAME)
    anchors: tuple[DwgAnchor, ...] = ()
    if frame is not None:
        rect = d.entity("LWPOLYLINE", rectangle(*frame), owner=handle)
        anchors = (DwgAnchor("0" * 63 + "2", "synthetic", "1", NAME, (), rect),)
    for a, b in lines:
        d.line(a, b, owner=handle)
    artefact = d.artefact()
    record = replace(artefact.blocks[handle], plot=plot, paper_mm_per_unit=paper_mm_per_unit)
    artefact = replace(artefact, blocks={**artefact.blocks, handle: record})
    return artefact, SheetCandidate(SheetLocation(layout=NAME), anchors=anchors)


def plotted(
    width: float = A1[0],
    height: float = A1[1],
    margins: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0),
    origin: tuple[float, float] = (0.0, 0.0),
    rotation: int = 0,
) -> PlotSettings:
    return PlotSettings(width, height, margins, origin, rotation)


def sides(artefact: ReadArtefact, sheet: SheetCandidate) -> tuple[float, float]:
    paper = paper_of(artefact, sheet)
    return (paper.width_mm, paper.height_mm)


def test_a_layout_is_on_the_sheet_its_plot_settings_state_its_corner_by_the_margins_and_offset() -> None:
    """The layout's origin is the printable area's lower-left corner moved by the plot offset: the
    sheet's corner lies the left and bottom margins and the offset before it."""
    artefact, sheet = layout((0, 0, 811, 574), plotted(margins=(5.0, 7.0, 5.0, 7.0), origin=(10.0, 3.0)))
    paper = paper_of(artefact, sheet)
    assert (paper.width_mm, paper.height_mm) == A1
    assert paper.origin == pytest.approx((-15.0, -10.0))
    assert paper.source == PaperSource.LAYOUT


@pytest.mark.parametrize(
    ("rotation", "corner"), [(1, (-6.0, -7.0)), (2, (-7.0, -8.0)), (3, (-8.0, -5.0))]
)
def test_a_quarter_turned_plot_swaps_its_papers_sides(
    rotation: int, corner: tuple[float, float]
) -> None:
    """A paper held portrait and plotted turned (as the real sets' layouts state theirs) is landscape
    on the layout, and its margins turn with it."""
    portrait = plotted(A1[1], A1[0], margins=(5.0, 6.0, 7.0, 8.0), rotation=rotation)
    artefact, sheet = layout((0, 0, 811, 574), portrait)
    paper = paper_of(artefact, sheet)
    expected = A1 if rotation in (1, 3) else (A1[1], A1[0])
    if rotation == 2:  # a half turn leaves a portrait paper portrait: the frame is not on it
        assert paper.source != PaperSource.LAYOUT
        return
    assert (paper.width_mm, paper.height_mm) == expected
    assert paper.origin == pytest.approx(corner)


@pytest.mark.parametrize(
    "plot",
    [plotted(0.0, 0.0), plotted(1e6, 1e6), plotted(841.0, 10.0), plotted(margins=(1e9, 0.0, 0.0, 0.0)),
     plotted(origin=(-5000.0, 0.0)), plotted(279.4, 215.9)],
)  # fmt: skip
def test_plot_settings_stating_no_sheet_the_layout_is_drawn_on_are_not_taken(plot: PlotSettings) -> None:
    """A size no sheet has, or a sheet the frame does not lie on (a default page setup left on a
    layout drawn for another sheet; margins or an offset that move the sheet off the frame) are not
    the layout's sheet: its frame's A1 is."""
    artefact, sheet = layout((0, 0, *A1), plot)
    paper = paper_of(artefact, sheet)
    assert (paper.width_mm, paper.height_mm) == A1
    assert paper.origin == (0.0, 0.0)
    assert paper.source == PaperSource.STANDARD


@pytest.mark.parametrize(
    ("frame", "sheet_sides"),
    [((20, 10, 831, 584), A1), ((10, 10, 831, 584), A1), ((0, 0, *A1), A1),
     ((10, 10, 410, 287), (420, 297)), ((10, 10, 584, 831), (594, 841))],
)  # fmt: skip
def test_a_bordered_frame_with_no_plot_settings_is_on_the_smallest_sheet_around_it(
    frame: tuple[float, float, float, float], sheet_sides: tuple[float, float]
) -> None:
    """A border drawn up to 25 mm inside a standard sheet's edge on each side is on that sheet,
    centred, in the frame's orientation."""
    artefact, sheet = layout(frame)
    paper = paper_of(artefact, sheet)
    assert (paper.width_mm, paper.height_mm) == sheet_sides
    x0, y0, x1, y1 = frame
    assert paper.origin == pytest.approx(
        (x0 - (sheet_sides[0] - (x1 - x0)) / 2, y0 - (sheet_sides[1] - (y1 - y0)) / 2)
    )


def test_a_frame_inside_no_sheet_by_25_mm_a_side_is_its_own_paper() -> None:
    """A border 60 mm inside A1's edge on each side is no A1's: the paper is the frame's box, assumed."""
    artefact, sheet = layout((60, 60, 781, 534))
    paper = paper_of(artefact, sheet)
    assert (paper.width_mm, paper.height_mm) == (721.0, 474.0)
    assert paper.origin == (60.0, 60.0)
    assert paper.source == PaperSource.ASSUMED


def test_a_frameless_layout_is_on_its_plot_sheet_when_its_drawing_is_centred_on_it() -> None:
    """With no frame, the plot settings' sheet is taken when the layout's drawing lies on it; a
    default A4 page setup under a drawing as large as an A1 is not."""
    artefact, sheet = layout(None, plotted(), lines=(((60, 100), (420, 400)),))
    assert sides(artefact, sheet) == A1
    artefact, sheet = layout(None, plotted(297.0, 210.0), lines=(((60, 100), (820, 580)),))
    assert sides(artefact, sheet) == (760.0, 480.0)


def test_a_layout_in_inches_is_laid_in_its_paper_units() -> None:
    """A layout drawn in inches (its plot settings' paper units): its paper is in mm, its origin in
    inches, and its sheet is the one its settings state."""
    artefact, sheet = layout(
        (0, 0, 811 / 25.4, 574 / 25.4), plotted(margins=(25.4, 0.0, 0.0, 0.0)), paper_mm_per_unit=25.4
    )
    paper = paper_of(artefact, sheet)
    assert (paper.width_mm, paper.height_mm, paper.mm_per_unit) == (*A1, 25.4)
    assert paper.origin == pytest.approx((-1.0, 0.0))


@pytest.mark.parametrize(
    ("frame", "plot"),
    [((20, 10, 831, 584), plotted()), ((20, 10, 831, 584), None), (None, plotted()),
     ((60, 60, 781, 534), None)],
)  # fmt: skip
def test_views_and_buffers_lay_a_layout_on_its_one_paper(
    frame: tuple[float, float, float, float] | None, plot: PlotSettings | None
) -> None:
    """Views' paper and the buffer's are `paper_of`'s, and the buffer draws the layout's line at its
    place on that paper."""
    artefact, sheet = layout(frame, plot)
    paper = paper_of(artefact, sheet)
    built = buffers.build(artefact, sheet)
    assert built.paper == paper
    (ox, oy), k = paper.origin, paper.mm_per_unit
    line = built.lines[-1]  # drawn after the frame
    drawn = tuple(float(line[n]) for n in ("x0", "y0", "x1", "y1"))
    assert drawn == pytest.approx(
        ((100 - ox) * k, (100 - oy) * k, (400 - ox) * k, (300 - oy) * k), abs=1e-3
    )
    assert views.find(artefact, sheet).paper == pytest.approx((paper.width_mm, paper.height_mm))


def test_a_layout_the_drawing_lacks_has_no_paper() -> None:
    artefact, _ = layout(None)
    with pytest.raises(ValueError, match="not in the drawing"):
        paper_of(artefact, SheetCandidate(SheetLocation(layout="nowhere")))
    assert views.find(artefact, SheetCandidate(SheetLocation(layout="nowhere"))).paper is None


@pytest.mark.parametrize(
    ("frame", "lines", "units", "plot"),
    [((0, 0, 1e300, 1e300), (), None, plotted()), ((0, 0, 1e5, 1e5), (), 1e4, plotted()),
     ((0, 0, 1e-300, 1e-300), (), None, None), (None, (((-1e308, 0), (1e308, 0)),), None, plotted())],
)  # fmt: skip
def test_a_paper_no_sheet_has_is_refused_by_views_and_buffers_alike(
    frame: tuple[float, float, float, float] | None,
    lines: tuple[tuple[tuple[float, float], tuple[float, float]], ...],
    units: float | None,
    plot: PlotSettings | None,
) -> None:
    """S15-E2's refuter: a hostile layout's frame or extents of no size, past a float, or past
    `MAX_PAPER_MM` a side give no paper: `paper_of` refuses it, the views read none and the buffer
    is refused, never a sheet 1e300 mm wide."""
    artefact, sheet = layout(frame, plot, lines=lines, paper_mm_per_unit=units)
    refused = r"no area|larger than any sheet"
    with pytest.raises(ValueError, match=refused):
        paper_of(artefact, sheet)
    assert views.find(artefact, sheet).paper is None
    with pytest.raises(ValueError, match=refused):
        buffers.build(artefact, sheet)
