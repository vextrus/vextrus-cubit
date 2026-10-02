"""The ink of a sheet and of its Plot page on one pixel grid: what registration fits and F1 scores.

A sheet's ink is 11's engine raster (`engine.render.raster`, the sheet on Paper) darker than `INK`; a
page's is its picture (`engine.plot.picture`, pdfium's) darker than `INK`, carried onto the sheet's
grid by a `PlotTransform` (sheet millimetres to page points: a scale, a turn in 90° steps, an offset).
Every colour plots black on Paper, and "ink = any non-white pixel" (docs/research/viewer-2d-
fidelity.md), with antialiasing's faintest edge left out.

`align` finds where the page's ink lies best on the sheet's: at a coarse density it tries scales about
the one given (a plot fitted to its paper is a percent or two off its size's guess: one Edison sheet
needed 0.982, the research's), and at each the offset whose overlap is largest (by correlation, within
`MAX_SHIFT_MM`); then it refines the offset at the fine density. Both rasterise at most twice per
sheet and draw each page twice; the last sheet's rasters are kept (`_last`) for the render check,
which scores the same sheet next.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from engine.plot.picture import MAX_PX_PER_PT, Picture, PictureError, picture
from engine.read.pdf.types import Page
from engine.recognise.types import PlotTransform
from engine.render.buffers import SheetBuffers
from engine.render.raster import RasterError, rasterise

type Mask = NDArray[np.bool_]

INK = 224
"""A pixel darker than this is ink: 0.12 of full black, below which an antialiased edge is too faint
to call a mark on either side."""
FINE_PX_PER_MM = 4.0
"""The density the render check scores at: the harness's own raster's (engine/harness.py)."""
COARSE_PX_PER_MM = 1.0
MAX_SHIFT_MM = 25.0
"""How far from the text's or the sizes' placement the page's ink is looked for: a plot's margins."""
SCALE_REACH = 0.03
SCALES = tuple(sorted((1 + k / 400 for k in range(-12, 13)), key=lambda f: abs(f - 1)))
"""The scales tried about the one given, nearest first: ±3 % in quarter-percent steps. Only for a
page fitted to its paper: a sheet plotted at 1:1 (`PT_PER_MM`) is at its scale by construction."""
SCALE_MARGIN = 0.02
"""A scale farther from the one given is taken only when it fits 2 % better: at the coarse density
neighbouring scales fit almost alike."""
PT_PER_MM = 72 / 25.4
FINE_SHIFT_PX = 8
"""How far each tile looks about the coarse placement, in fine pixels (2 mm): the coarse offset's half
pixel and its scale step's quarter percent at a tile's distance from the centre."""
TILES = 4
MIN_TILE_INK = 400
"""The fewest ink pixels a tile needs to find its shift (a few centimetres of line at 4 px/mm)."""
RESIDUAL_RINGS = 12
"""The farthest the residual measures, in fine pixels (3 mm on paper); farther counts as this."""


@dataclass(frozen=True)
class Grid:
    """A sheet's pixel grid: its density and its paper's height (the rows run down from it)."""

    px_per_mm: float
    height_mm: float
    shape: tuple[int, int]


_last: list[tuple[SheetBuffers, float, Mask]] = []


def sheet_ink(buffers: SheetBuffers, px_per_mm: float) -> tuple[Mask, Grid]:
    """The sheet's ink at the density, and its grid (the last two rasters are kept)."""
    for kept, density, mask in _last:
        if kept is buffers and density == px_per_mm:
            return mask, Grid(px_per_mm, buffers.paper.height_mm, (mask.shape[0], mask.shape[1]))
    mask = rasterise(buffers, px_per_mm).pixels < INK
    _last.append((buffers, px_per_mm, mask))
    del _last[:-2]
    return mask, Grid(px_per_mm, buffers.paper.height_mm, (mask.shape[0], mask.shape[1]))


def carried(drawn: Picture, page: Page, transform: PlotTransform, grid: Grid) -> Mask:
    """The page's ink on the sheet's grid: each sheet pixel's centre carried to the page by the
    transform, and the page pixel it lands in; off the picture, no ink."""
    rows, columns = grid.shape
    x = (np.arange(columns) + 0.5) / grid.px_per_mm
    y = grid.height_mm - (np.arange(rows) + 0.5) / grid.px_per_mm
    c, s = _cos_sin(transform.rotation)
    k = transform.scale
    ox, oy = transform.offset
    left, _, _, top = page.crop
    density = drawn.px_per_pt
    # A turn in 90° steps carries a sheet column to a page column or a page row alone.
    if s == 0:
        page_cols = np.floor((k * c * x + ox - left) * density).astype(np.int64)[None, :]
        page_rows = np.floor((top - (k * c * y + oy)) * density).astype(np.int64)[:, None]
    else:
        page_cols = np.floor((-k * s * y + ox - left) * density).astype(np.int64)[:, None]
        page_rows = np.floor((top - (k * s * x + oy)) * density).astype(np.int64)[None, :]
    ink = drawn.pixels < INK
    height, width = ink.shape
    inside = (page_cols >= 0) & (page_cols < width) & (page_rows >= 0) & (page_rows < height)
    picked = ink[np.clip(page_rows, 0, height - 1), np.clip(page_cols, 0, width - 1)]
    return np.broadcast_to(inside, (rows, columns)) & picked


def _cos_sin(turn: int) -> tuple[int, int]:
    return {0: (1, 0), 90: (0, 1), 180: (-1, 0), 270: (0, -1)}[turn]


def rescaled(transform: PlotTransform, factor: float, centre: tuple[float, float]) -> PlotTransform:
    """The transform at `factor` times its scale, the sheet's `centre` (mm) kept where it lands."""
    c, s = _cos_sin(transform.rotation)
    x, y = centre
    k = transform.scale
    change = k - k * factor
    ox = transform.offset[0] + change * (c * x - s * y)
    oy = transform.offset[1] + change * (s * x + c * y)
    return PlotTransform(k * factor, transform.rotation, (ox, oy))


def half_turned(transform: PlotTransform, centre: tuple[float, float]) -> PlotTransform:
    """The transform turned a further 180° about the sheet's `centre` (mm), which it keeps in place."""
    c, s = _cos_sin(transform.rotation)
    k, (ox, oy), (x, y) = transform.scale, transform.offset, centre
    # T(centre) = k R centre + o; turned, R becomes -R: the offset gains 2 k R centre
    offset = (ox + 2 * k * (c * x - s * y), oy + 2 * k * (s * x + c * y))
    return PlotTransform(k, (transform.rotation + 180) % 360, offset)


def shifted(transform: PlotTransform, columns: float, rows: float, grid: Grid) -> PlotTransform:
    """The transform that lands the page `columns` right and `rows` down on the sheet's grid: the sheet
    point that took the page's ink from p now takes it from p moved back by the shift."""
    dx, dy = columns / grid.px_per_mm, -rows / grid.px_per_mm
    c, s = _cos_sin(transform.rotation)
    k = transform.scale
    ox = transform.offset[0] - k * (c * dx - s * dy)
    oy = transform.offset[1] - k * (s * dx + c * dy)
    return PlotTransform(k, transform.rotation, (ox, oy))


def best_shift(sheet: Mask, printed: Mask, reach: int) -> tuple[int, int, int]:
    """The shift (columns right, rows down, at most `reach` each way) that lays the most of the page's
    ink (each pixel widened by one) on the sheet's, and how much it lays: by correlation, padded so
    nothing wraps round."""
    rows, columns = sheet.shape
    size = (_fast(rows + reach), _fast(columns + reach))
    ours = np.fft.rfft2(near(sheet, 1).astype(np.float32), size)
    theirs = np.fft.rfft2(near(printed, 1).astype(np.float32), size)
    overlap = np.fft.irfft2(ours * np.conj(theirs), size)
    best = (0, 0, -1.0)
    for dy in (*range(reach + 1), *range(-reach, 0)):
        row = overlap[dy % size[0]]
        window = np.concatenate([row[: reach + 1], row[size[1] - reach :]])
        at = int(np.argmax(window))
        if window[at] > best[2]:
            dx = at if at <= reach else at - (2 * reach + 1)
            best = (dx, dy, float(window[at]))
    # correlation gives sheet[r, c] against printed[r - dy, c - dx]: the page moves by (dx, dy)
    return best[0], best[1], round(best[2])


def nearby_shift(sheet: Mask, printed: Mask, reach: int) -> tuple[int, int]:
    """The shift, at most `reach` each way, that lays the most of the page's ink on the sheet's, tried
    shift by shift and unwidened (the coarse fit has come within a pixel or two): no transform of the
    whole sheet, so at the fine density an A0 costs its masks and one more, never a gigabyte of
    spectra. Of shifts that lay as much, the smallest."""
    wide = printed
    best = (0, 0, -1)
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            laid = int(np.count_nonzero(sheet & moved(wide, dx, dy)))
            if laid > best[2] or (laid == best[2] and abs(dx) + abs(dy) < abs(best[0]) + abs(best[1])):
                best = (dx, dy, laid)
    return best[0], best[1]


def _fast(n: int) -> int:
    """The next size at or above n whose only prime factors are 2, 3 and 5 (quick to transform)."""
    while True:
        m = n
        for p in (2, 3, 5):
            while m % p == 0:
                m //= p
        if m == 1:
            return n
        n += 1


def moved(mask: Mask, columns: int, rows: int) -> Mask:
    """The mask moved `columns` right and `rows` down; what moves in is empty."""
    out = np.zeros_like(mask)
    h, w = mask.shape
    if abs(columns) >= w or abs(rows) >= h:
        return out
    out[max(rows, 0) : h + min(rows, 0), max(columns, 0) : w + min(columns, 0)] = mask[
        max(-rows, 0) : h + min(-rows, 0), max(-columns, 0) : w + min(-columns, 0)
    ]
    return out


def near(mask: Mask, radius: int) -> Mask:
    """Every pixel within `radius` pixels (a disc) of the mask's ink."""
    out = mask.copy()
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if (dx, dy) != (0, 0) and dx * dx + dy * dy <= radius * radius:
                out |= moved(mask, dx, dy)
    return out


def f1(sheet: Mask, printed: Mask, tolerance: int) -> float:
    """Precision (the sheet's ink with the page's within `tolerance` pixels), recall (the page's with
    the sheet's) and their harmonic mean; 1 where neither has ink, 0 where one alone has."""
    ours, theirs = int(sheet.sum()), int(printed.sum())
    if ours == 0 and theirs == 0:
        return 1.0
    if ours == 0 or theirs == 0:
        return 0.0
    precision = int((sheet & near(printed, tolerance)).sum()) / ours
    recall = int((printed & near(sheet, tolerance)).sum()) / theirs
    return 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)


def residual_mm(sheet: Mask, printed: Mask, grid: Grid) -> float | None:
    """The median distance from the sheet's ink to the page's nearest, in millimetres on paper,
    measured out to `RESIDUAL_RINGS` pixels (farther counts as that); none when either has no ink."""
    total = int(sheet.sum())
    if total == 0 or not printed.any():
        return None
    reached = printed.copy()
    counted = int((sheet & reached).sum())
    ring = 0
    while counted * 2 < total and ring < RESIDUAL_RINGS:
        ring += 1
        reached = (
            reached | moved(reached, 1, 0) | moved(reached, -1, 0) | moved(reached, 0, 1)
            | moved(reached, 0, -1)
        )  # fmt: skip
        counted = int((sheet & reached).sum())
    return ring / grid.px_per_mm


def align(
    page: Page, buffers: SheetBuffers, transform: PlotTransform, plot: Path
) -> tuple[PlotTransform, float | None]:
    """The transform moved (and rescaled) to where the page's ink lies best on the sheet's, and the
    residual there (`residual_mm`); the transform as given, and none, when either has no ink or the
    page cannot be drawn (the module's rules)."""
    if not FINE_PX_PER_MM / transform.scale / (1 - SCALE_REACH) < MAX_PX_PER_PT:
        return transform, None  # a page so small beside its sheet that it would be drawn huge
    try:
        sheet, grid = sheet_ink(buffers, COARSE_PX_PER_MM)
        density = COARSE_PX_PER_MM / transform.scale
        drawn = picture(plot, page, density)
    except PictureError, RasterError:  # the page or the sheet could not be drawn
        return transform, None
    if not sheet.any():
        return transform, None
    centre = (buffers.paper.width_mm / 2, buffers.paper.height_mm / 2)
    reach = round(MAX_SHIFT_MM * COARSE_PX_PER_MM)
    best: tuple[float, PlotTransform] | None = None
    ours = int(sheet.sum())
    factors = SCALES if abs(transform.scale - PT_PER_MM) > 1e-9 else (1.0,)
    # The given turn first, then the half turn: a page placed by its sizes alone cannot tell a sheet
    # from the same sheet upside down, and its ink can.
    turns = (transform, half_turned(transform, centre))
    for tried in (rescaled(t, factor, centre) for t in turns for factor in factors):
        printed = carried(drawn, page, tried, grid)
        theirs = int(printed.sum())
        if theirs == 0:
            continue
        dx, dy, laid = best_shift(sheet, printed, reach)
        fit = laid / (ours * theirs) ** 0.5
        if best is None or fit > best[0] * (1 + SCALE_MARGIN):
            best = (fit, shifted(tried, dx, dy, grid))
    if best is None:
        return transform, None
    coarse = best[1]
    try:
        sheet, grid = sheet_ink(buffers, FINE_PX_PER_MM)
        drawn = picture(plot, page, FINE_PX_PER_MM / coarse.scale)
    except PictureError, RasterError:
        return coarse, None
    fine = refined(sheet, carried(drawn, page, coarse, grid), coarse, grid)
    return fine, residual_mm(sheet, carried(drawn, page, fine, grid), grid)


def agreement(
    page: Page,
    buffers: SheetBuffers,
    transform: PlotTransform,
    plot: Path,
    shared: Mask | None = None,
) -> float | None:
    """How well the page's ink, carried by the transform, lies on the sheet's: their F1 at the coarse
    density within a pixel (a millimetre on paper), leaving out `shared` (the ink every sheet tried
    draws alike, a frame and title block: on it any sheet agrees with any page); none when either
    cannot be drawn."""
    if not COARSE_PX_PER_MM / transform.scale < MAX_PX_PER_PT:
        return None
    try:
        sheet, grid = sheet_ink(buffers, COARSE_PX_PER_MM)
        drawn = picture(plot, page, COARSE_PX_PER_MM / transform.scale)
    except PictureError, RasterError:
        return None
    printed = carried(drawn, page, transform, grid)
    if shared is not None and shared.shape == sheet.shape:
        sheet, printed = sheet & ~shared, printed & ~shared
    return f1(sheet, printed, 1)


def shared_ink(geometry: list[SheetBuffers]) -> Mask | None:
    """The ink every one of the sheets draws (each widened by a pixel) at the coarse density: what a
    page agrees with whichever of them it is; none when their papers differ."""
    masks = []
    for buffers in geometry:
        try:
            mask, _ = sheet_ink(buffers, COARSE_PX_PER_MM)
        except RasterError:
            return None
        masks.append(near(mask, 1))
    if not masks or any(m.shape != masks[0].shape for m in masks):
        return None
    common = masks[0].copy()
    for m in masks[1:]:
        common &= m
    return common


def refined(sheet: Mask, printed: Mask, transform: PlotTransform, grid: Grid) -> PlotTransform:
    """The transform corrected by the page's ink tile by tile: each of `TILES` x `TILES` tiles with ink
    on both finds its own shift (`FINE_SHIFT_PX` each way), and a scale about the sheet's centre and
    a shift are fitted to them by least squares (a percent's error in scale is millimetres at an A1's
    edge, which one shift cannot mend). A sheet plotted at 1:1, or with fewer than three tiles, gets
    one shift for the whole sheet, the tiles' median."""
    rows, columns = sheet.shape
    reach = FINE_SHIFT_PX
    padded = np.pad(printed, reach)
    centres, shifts = [], []
    for i in range(TILES):
        for j in range(TILES):
            r0, r1 = rows * i // TILES, rows * (i + 1) // TILES
            c0, c1 = columns * j // TILES, columns * (j + 1) // TILES
            ours = sheet[r0:r1, c0:c1]
            if np.count_nonzero(ours) < MIN_TILE_INK:
                continue
            best = (0, 0, -1)
            for dy in range(-reach, reach + 1):
                for dx in range(-reach, reach + 1):
                    theirs = padded[r0 - dy + reach : r1 - dy + reach, c0 - dx + reach : c1 - dx + reach]
                    laid = int(np.count_nonzero(ours & theirs))
                    if laid > best[2] or (
                        laid == best[2] and abs(dx) + abs(dy) < abs(best[0]) + abs(best[1])
                    ):
                        best = (dx, dy, laid)
            if best[2] >= MIN_TILE_INK // 4:
                centres.append(
                    ((c0 + c1) / 2 / grid.px_per_mm, grid.height_mm - (r0 + r1) / 2 / grid.px_per_mm)
                )
                shifts.append((best[0] / grid.px_per_mm, -best[1] / grid.px_per_mm))
    if not shifts:
        return transform
    at, by = np.array(centres), np.array(shifts)  # millimetres on the sheet: where, and how far
    if len(shifts) < 3 or abs(transform.scale - PT_PER_MM) <= 1e-9:  # 1:1 is exact: a shift only
        dx, dy = np.median(by, axis=0)
        return shifted(transform, dx * grid.px_per_mm, -dy * grid.px_per_mm, grid)
    middle = at.mean(axis=0)
    # by = a (at - middle) + b: one scale change `a` and a shift `b`, by least squares over both axes
    design = np.zeros((2 * len(at), 3))
    design[0::2, 0], design[1::2, 0] = at[:, 0] - middle[0], at[:, 1] - middle[1]
    design[0::2, 1], design[1::2, 2] = 1.0, 1.0
    (a, bx, by_), *_ = np.linalg.lstsq(design, by.reshape(-1), rcond=None)
    if not (abs(a) < SCALE_REACH and np.isfinite([bx, by_]).all()):
        return transform
    # The page's ink at q belongs at q + a (q - middle) + b: the sheet point p takes it from
    # T(p - a (p - middle) - b), which is a scale of k (1 - a) and a new offset.
    c, s_ = _cos_sin(transform.rotation)
    k = transform.scale
    ux, uy = a * middle[0] - bx, a * middle[1] - by_
    offset = (
        transform.offset[0] + k * (c * ux - s_ * uy),
        transform.offset[1] + k * (s_ * ux + c * uy),
    )
    return PlotTransform(float(k * (1 - a)), transform.rotation, (float(offset[0]), float(offset[1])))
