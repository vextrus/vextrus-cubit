"""The engine raster: a sheet's buffers as pixels, drawn as the viewer draws them on Paper.

`rasterise(buffers, px_per_mm)` is the stage the harness calls (the M0 plan's contract). It draws the
sheet on white, every colour black (m0-screens 4.6, Paper: "every colour prints black"), so the
viewer's WebGL (16's pixel test) and the Plot (18's F1) are compared against the same picture:

- **Lines, each lineweight as plotted, by ruling 2** (m0-screens 4.6): a line's width on screen is its
  lineweight x the pixels per plotted millimetre. At 1.5 px or wider it is drawn at that width, opaque,
  its edges antialiased, with round ends (AutoCAD plots lineweights with round ends); thinner, it is a
  1-pixel line whose alpha is that width x 1.1, never below 0.42 and never above 1: at 4 px/mm a
  0.13 mm line is faint grey and a 0.5 mm line solid black, as on the plot.
- **Fills** (hatches, solids, polylines with width): every pixel whose centre is inside, opaque.
- **Text**: each glyph from the SDF atlas, sampled bilinearly, its edge antialiased over one pixel.

Where marks overlap the darker wins (no alpha builds up). The image's first row is the sheet's top;
pixel (column, row)'s centre is at x = (column + 0.5) / px_per_mm, y = height - (row + 0.5) / px_per_mm
in paper millimetres.

**Bounded:** a density that is not a finite positive number, or an image of more than `MAX_PIXELS`
pixels, is refused with `RasterError` before any memory is taken; a sheet that would draw over its
image more than `WORK_PER_PIXEL` times is refused as it gets there; lines are cut to the image before
they are drawn, and a value that is not finite is left out, so the time and memory taken stay in
proportion to the image.
"""

import io
import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from PIL import Image

from engine.render.buffers import SheetBuffers, clip_mask
from engine.render.fonts.glyphs import SDF_PX_PER_UNIT, SDF_SPREAD

MAX_PIXELS = 100_000_000
"""100 million pixels (100 MB of grey): an A0 at 12 px/mm is 144 million, so refused."""
THICK_PX = 1.5
MIN_ALPHA = 0.42
ALPHA_GAIN = 1.1
WORK_PER_PIXEL = 64
"""How many times over its own pixels a raster may draw before it is refused."""
SAMPLE_CHUNK = 250_000
"""The thin-line samples drawn at once, bounding memory."""
PIECE_PX = 32.0


class RasterError(ValueError):
    """A raster that would not fit its bounds."""


@dataclass(frozen=True)
class Raster:
    """A sheet as grey pixels (rows from the top; 255 is white paper, 0 black ink)."""

    pixels: NDArray[np.uint8]
    px_per_mm: float

    def to_png(self) -> bytes:
        out = io.BytesIO()
        Image.fromarray(self.pixels, mode="L").save(out, format="PNG", optimize=True)
        return out.getvalue()

    @classmethod
    def from_png(cls, data: bytes, px_per_mm: float) -> Raster:
        with Image.open(io.BytesIO(data)) as image:
            return cls(np.array(image.convert("L")), px_per_mm)

    def to_json(self) -> dict[str, object]:
        """What the harness keeps of it: its size and how much of it is ink, never its pixels."""
        return {
            "counts": {
                "width_px": int(self.pixels.shape[1]),
                "height_px": int(self.pixels.shape[0]),
                "ink_px": int((self.pixels < 255).sum()),
            }
        }


def size(buffers: SheetBuffers, px_per_mm: float) -> tuple[int, int]:
    """The raster's width and height in pixels, or `RasterError`."""
    if (
        isinstance(px_per_mm, bool)
        or not isinstance(px_per_mm, int | float)
        or not math.isfinite(px_per_mm)
    ):
        raise RasterError(f"{px_per_mm!r} pixels a millimetre is not a number")
    if px_per_mm <= 0:
        raise RasterError("the pixels a millimetre must be more than 0")
    paper = buffers.paper
    width = paper.width_mm * px_per_mm
    height = paper.height_mm * px_per_mm
    if not (math.isfinite(width) and math.isfinite(height)) or width * height > MAX_PIXELS:
        raise RasterError(f"a {width:.0f} x {height:.0f} pixel raster is past its {MAX_PIXELS} pixels")
    return max(1, math.ceil(width)), max(1, math.ceil(height))


def rasterise(buffers: SheetBuffers, px_per_mm: float) -> Raster:
    """The sheet on Paper at `px_per_mm` (the module's docstring)."""
    width, height = size(buffers, px_per_mm)
    ink = np.zeros((height, width), dtype=np.float32)  # 0 paper, 1 black
    work = _Work(WORK_PER_PIXEL * width * height + 1_000_000)
    top = buffers.paper.height_mm
    _fills(ink, buffers, px_per_mm, top, work)
    _lines(ink, buffers, px_per_mm, top, work)
    _glyphs(ink, buffers, px_per_mm, top, work)
    pixels = np.round(255.0 * (1.0 - np.clip(ink, 0.0, 1.0))).astype(np.uint8)
    return Raster(pixels, float(px_per_mm))


class _Work:
    """The pixels a raster may visit; past them it is refused (a sheet drawn over itself that often
    is no drawing)."""

    def __init__(self, budget: float) -> None:
        self.left = budget

    def spend(self, pixels: float) -> None:
        self.left -= pixels
        if self.left < 0:
            raise RasterError("the sheet draws over itself too many times to rasterise")


def _to_px(
    x: NDArray[np.float64], y: NDArray[np.float64], s: float, top: float
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Paper mm to pixel coordinates (continuous; a pixel's centre is at +0.5)."""
    return x * s, (top - y) * s


def _mark(
    ink: NDArray[np.float32],
    rows: NDArray[np.int64],
    cols: NDArray[np.int64],
    alpha: NDArray[np.float64] | float,
) -> None:
    h, w = ink.shape
    ok = (rows >= 0) & (rows < h) & (cols >= 0) & (cols < w)
    values = np.broadcast_to(np.asarray(alpha, dtype=np.float32), rows.shape)[ok]
    np.maximum.at(ink, (rows[ok], cols[ok]), values)


def _lines(ink: NDArray[np.float32], buffers: SheetBuffers, s: float, top: float, work: _Work) -> None:
    lines = buffers.lines
    if not len(lines):
        return
    x0, y0 = _to_px(lines["x0"].astype(np.float64), lines["y0"].astype(np.float64), s, top)
    x1, y1 = _to_px(lines["x1"].astype(np.float64), lines["y1"].astype(np.float64), s, top)
    widths = lines["weight"].astype(np.float64) * s
    ends = np.column_stack([x0, y0, x1, y1])
    finite = np.isfinite(ends).all(axis=1) & np.isfinite(widths) & (widths >= 0)
    h, w = ink.shape
    thin = finite & (widths < THICK_PX)
    thick = finite & (widths >= THICK_PX)
    # Thin lines: 1 pixel wide, each pixel the line passes through at the ruling's alpha; cut to the
    # image first, and drawn in chunks, so memory stays bounded whatever the lines' lengths.
    if thin.any():
        keep, cut = clip_mask(ends[thin], (-1.0, -1.0, w + 1.0, h + 1.0))
        cut, alpha = cut[keep], np.clip(widths[thin][keep] * ALPHA_GAIN, MIN_ALPHA, 1.0)
        steps = np.ceil(np.maximum(np.abs(cut[:, 2] - cut[:, 0]), np.abs(cut[:, 3] - cut[:, 1])) * 2)
        steps = steps.astype(np.int64) + 1
        work.spend(float(steps.sum()))
        start = 0
        while start < len(steps):
            stop = start + max(1, int(np.searchsorted(np.cumsum(steps[start:]), SAMPLE_CHUNK)))
            _thin(ink, cut[start:stop], steps[start:stop], alpha[start:stop])
            start = stop
    # Thick lines: capsules of their width, antialiased at the edge, cut into pieces at most
    # PIECE_PX long so each fills only its own neighbourhood.
    for i in np.flatnonzero(thick):
        half = widths[i] / 2
        keep, cut = clip_mask(ends[i : i + 1], (-half - 1, -half - 1, w + half + 1, h + half + 1))
        if not keep[0]:
            continue
        ax, ay, bx, by = cut[0]
        pieces = max(1, math.ceil(math.hypot(bx - ax, by - ay) / PIECE_PX))
        for k in range(pieces):
            t0, t1 = k / pieces, (k + 1) / pieces
            _capsule(
                ink,
                ax + (bx - ax) * t0,
                ay + (by - ay) * t0,
                ax + (bx - ax) * t1,
                ay + (by - ay) * t1,
                half,
                work,
            )


def _thin(
    ink: NDArray[np.float32],
    ends: NDArray[np.float64],
    steps: NDArray[np.int64],
    alpha: NDArray[np.float64],
) -> None:
    owner = np.repeat(np.arange(len(steps)), steps)
    first = np.cumsum(steps) - steps
    t = (np.arange(int(steps.sum())) - first[owner]) / np.maximum(steps[owner] - 1, 1)
    px = ends[owner, 0] + t * (ends[owner, 2] - ends[owner, 0])
    py = ends[owner, 1] + t * (ends[owner, 3] - ends[owner, 1])
    _mark(ink, np.floor(py).astype(np.int64), np.floor(px).astype(np.int64), alpha[owner])


def _capsule(
    ink: NDArray[np.float32], x0: float, y0: float, x1: float, y1: float, half: float, work: _Work
) -> None:
    h, w = ink.shape
    c0 = max(0, math.floor(min(x0, x1) - half - 1))
    c1 = min(w, math.ceil(max(x0, x1) + half + 1))
    r0 = max(0, math.floor(min(y0, y1) - half - 1))
    r1 = min(h, math.ceil(max(y0, y1) + half + 1))
    if c0 >= c1 or r0 >= r1:
        return
    work.spend((c1 - c0) * (r1 - r0))
    cx = np.arange(c0, c1) + 0.5
    cy = np.arange(r0, r1)[:, None] + 0.5
    dx, dy = x1 - x0, y1 - y0
    length2 = dx * dx + dy * dy
    t = np.clip(((cx - x0) * dx + (cy - y0) * dy) / length2, 0.0, 1.0) if length2 > 0 else 0.0
    distance = np.hypot(cx - (x0 + t * dx), cy - (y0 + t * dy))
    coverage = np.clip(half + 0.5 - distance, 0.0, 1.0).astype(np.float32)
    region = ink[r0:r1, c0:c1]
    np.maximum(region, coverage, out=region)


def _fills(ink: NDArray[np.float32], buffers: SheetBuffers, s: float, top: float, work: _Work) -> None:
    triangles = buffers.triangles
    h, w = ink.shape
    for t in triangles:
        xs, ys = _to_px(
            np.array([t["x0"], t["x1"], t["x2"]], dtype=np.float64),
            np.array([t["y0"], t["y1"], t["y2"]], dtype=np.float64),
            s,
            top,
        )
        if not (np.isfinite(xs).all() and np.isfinite(ys).all()):
            continue
        c0, c1 = max(0, math.floor(max(xs.min(), -1.0))), min(w, math.ceil(min(xs.max(), w + 1.0)) + 1)
        r0, r1 = max(0, math.floor(max(ys.min(), -1.0))), min(h, math.ceil(min(ys.max(), h + 1.0)) + 1)
        if c0 >= c1 or r0 >= r1:
            continue
        work.spend((c1 - c0) * (r1 - r0))
        px = np.arange(c0, c1) + 0.5
        py = np.arange(r0, r1)[:, None] + 0.5
        edges = []
        for k in range(3):
            ax, ay, bx, by = xs[k], ys[k], xs[(k + 1) % 3], ys[(k + 1) % 3]
            edges.append((bx - ax) * (py - ay) - (by - ay) * (px - ax))
        inside = ((edges[0] >= 0) & (edges[1] >= 0) & (edges[2] >= 0)) | (
            (edges[0] <= 0) & (edges[1] <= 0) & (edges[2] <= 0)
        )
        region = ink[r0:r1, c0:c1]
        region[inside] = 1.0


def _glyphs(ink: NDArray[np.float32], buffers: SheetBuffers, s: float, top: float, work: _Work) -> None:
    atlas = buffers.atlas.astype(np.float32)
    table = buffers.atlas_glyphs
    h, w = ink.shape
    for g in buffers.glyphs:
        index = int(g["glyph"])
        if index >= len(table):
            continue
        entry = table[index]
        gx0, gy0, gx1, gy1 = (float(entry[k]) for k in ("x0", "y0", "x1", "y1"))
        u0, v0, u1, v1 = int(entry["u0"]), int(entry["v0"]), int(entry["u1"]), int(entry["v1"])
        if not (
            0 <= u0 < u1 <= atlas.shape[1] and 0 <= v0 < v1 <= atlas.shape[0] and gx0 < gx1 and gy0 < gy1
        ):
            continue
        ox, oy = float(g["ox"]), float(g["oy"])
        ax, ay, bx, by = float(g["xx"]), float(g["xy"]), float(g["yx"]), float(g["yy"])
        det = ax * by - ay * bx
        if det == 0 or not all(math.isfinite(v) for v in (det, ox, oy, gx0, gy0, gx1, gy1)):
            continue
        corners_x = [ox + gx * ax + gy * bx for gx in (gx0, gx1) for gy in (gy0, gy1)]
        corners_y = [oy + gx * ay + gy * by for gx in (gx0, gx1) for gy in (gy0, gy1)]
        px_x, px_y = _to_px(np.array(corners_x), np.array(corners_y), s, top)
        if not (np.isfinite(px_x).all() and np.isfinite(px_y).all()):
            continue
        c0, c1 = (
            max(0, math.floor(max(px_x.min(), -1.0))),
            min(w, math.ceil(min(px_x.max(), w + 1.0)) + 1),
        )
        r0, r1 = (
            max(0, math.floor(max(px_y.min(), -1.0))),
            min(h, math.ceil(min(px_y.max(), h + 1.0)) + 1),
        )
        if c0 >= c1 or r0 >= r1:
            continue
        work.spend((c1 - c0) * (r1 - r0))
        # Pixel centres back to paper mm, then to the glyph's text units (the inverse of its axes).
        mx = (np.arange(c0, c1) + 0.5) / s - ox
        my = top - (np.arange(r0, r1)[:, None] + 0.5) / s - oy
        gx = (mx * by - my * bx) / det
        gy = (my * ax - mx * ay) / det
        fu = u0 + (gx - gx0) / (gx1 - gx0) * (u1 - u0) - 0.5
        fv = v0 + (gy1 - gy) / (gy1 - gy0) * (v1 - v0) - 0.5
        value = _bilinear(atlas, fu, fv, u0, v0, u1, v1)
        text_px = math.sqrt(abs(det)) * s  # screen pixels per text unit
        distance_px = (value - 127.5) / 127.5 * SDF_SPREAD / SDF_PX_PER_UNIT * text_px
        coverage = np.clip(distance_px + 0.5, 0.0, 1.0).astype(np.float32)
        region = ink[r0:r1, c0:c1]
        np.maximum(region, coverage, out=region)


def _bilinear(
    atlas: NDArray[np.float32],
    fu: NDArray[np.float64],
    fv: NDArray[np.float64],
    u0: int,
    v0: int,
    u1: int,
    v1: int,
) -> NDArray[np.float64]:
    """The atlas sampled at (fu, fv) within one glyph's pixels (outside them: 0, far outside)."""
    fu = np.broadcast_to(fu, np.broadcast_shapes(fu.shape, fv.shape))
    fv = np.broadcast_to(fv, fu.shape)
    outside = (fu < u0 - 0.5) | (fu > u1 - 0.5) | (fv < v0 - 0.5) | (fv > v1 - 0.5)
    cu = np.clip(fu, u0, u1 - 1)
    cv = np.clip(fv, v0, v1 - 1)
    iu = np.clip(np.floor(cu).astype(np.int64), u0, max(u0, u1 - 2))
    iv = np.clip(np.floor(cv).astype(np.int64), v0, max(v0, v1 - 2))
    iu1 = np.minimum(iu + 1, u1 - 1)
    iv1 = np.minimum(iv + 1, v1 - 1)
    du, dv = cu - iu, cv - iv
    top = atlas[iv, iu] * (1 - du) + atlas[iv, iu1] * du
    bottom = atlas[iv1, iu] * (1 - du) + atlas[iv1, iu1] * du
    value = top * (1 - dv) + bottom * dv
    return np.where(outside, 0.0, value)
