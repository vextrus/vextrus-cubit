"""The render check (ticket 18): how closely a sheet as the engine draws it matches its Plot page.

    score(buffers, page, transform, plot) -> float      # the harness's `render_f1` stage

For each page 18's registration matched to a sheet: the sheet's buffers are rasterised by 11's engine
raster (`engine.render.raster`, what the viewer draws on Paper) at `PX_PER_MM`; the page is drawn by
pdfium from the PDF at `plot` (`engine.plot.picture`, sandboxed), at the density that puts the same
number of its pixels on a paper millimetre as the transform's scale says; and the page's pixels are
carried onto the sheet's by the transform (sheet millimetres to page points: a scale, a turn in 90°
steps, an offset). Ink is any pixel darker than `INK` on either side (every colour plots black on
Paper; docs/research/viewer-2d-fidelity.md's "ink = any non-white pixel", with antialiasing's faintest
edge left out).

**The F1**, within `TOLERANCE_PX` (2 pixels, half a millimetre on paper; the M0 plan's "F1 within 2 px
per sheet against its Plot"): precision is the share of the sheet's ink with page ink within 2 pixels
of it, recall the share of the page's ink with the sheet's ink within 2 pixels, and F1 their harmonic
mean, from 0 to 1. A page carried onto the sheet only in part counts only where it lies. Where
neither has ink the two agree (1); where one alone has, not at all (0).

It is a stage of its own, never run by the catalogue's `run_all` (no `SET`): its result is a number
per sheet, the export's `render_f1`, not a finding. It declares the catalogue's names, so the Library
lists it (engine/check/catalogue.py).
"""

from dataclasses import dataclass
from pathlib import Path

from engine.messages import render_f1 as codes
from engine.plot import ink
from engine.plot.picture import MAX_PX_PER_PT, PictureError, picture
from engine.read.pdf.types import Page
from engine.recognise.types import PlotTransform
from engine.render.buffers import SheetBuffers
from engine.render.raster import RasterError

CODE = "render_f1"
VERSION = 1
MILESTONE = "M0"
KIND = "source"
MESSAGE = codes.RENDER_F1

TOLERANCE_PX = 2
"""Within 2 pixels at `ink.FINE_PX_PER_MM` (4): half a millimetre on paper."""


@dataclass(frozen=True)
class Unscored:
    """No score for a page the check could not draw, and the reason's key (`score`'s): one page of a
    set that cannot be drawn is that page's, never the whole stage's failure."""

    reason: str


def score(buffers: SheetBuffers, page: Page, transform: PlotTransform, plot: Path) -> float | Unscored:
    """The sheet's F1 against its Plot page (the module's rules), or why it has none: the sheet too
    large or too dense for the raster at `ink.FINE_PX_PER_MM` (`sheet_raster`: registration may have
    placed it at a coarser density), a page too small beside it to draw (`too_dense`), or pdfium's
    reason for a page it will not draw."""
    try:
        sheet, grid = ink.sheet_ink(buffers, ink.FINE_PX_PER_MM)
    except RasterError:
        return Unscored("sheet_raster")
    density = ink.FINE_PX_PER_MM / transform.scale
    if not 0 < density < MAX_PX_PER_PT:
        return Unscored("too_dense")
    try:
        drawn = picture(plot, page, density)
    except PictureError as refused:
        return Unscored(refused.reason)
    return ink.f1(sheet, ink.carried(drawn, page, transform, grid), TOLERANCE_PX)
