"""The shipped fonts' glyphs: outlines (TrueType, drawn as SDF) and strokes (the single-stroke font).

Only the files in `files/` are ever opened, by a `FontKey`; a font name from a drawing never reaches
a path (`engine.render.fonts` maps names to keys). Every glyph is given in **text units**, where 1 is
the text's height: AutoCAD sizes a font so its capitals are the text's height, so the unit is the
font's cap height (Liberation's OS/2 `sCapHeight`; the Hershey simplex's 21 units from its cap line to
its baseline). x runs along the baseline from the glyph's origin, y up from the baseline.

- **Outlines** come from fontTools' pen over the TrueType `glyf` table, their quadratic curves
  flattened into `CURVE_STEPS` segments each, contours closed. They fill by the **nonzero winding
  rule**, as TrueType defines, so overlapping contours (a diameter sign drawn as an O and a slash)
  fill once, never as a blob (docs/research/viewer-2d-fidelity.md).
- **SDF** (`sdf`): a glyph's signed distance field, `SDF_PX_PER_UNIT` atlas pixels per text unit with
  `SDF_SPREAD` pixels of range each side of the edge, 8 bits: 0 is `SDF_SPREAD` pixels or more outside,
  255 as far inside, and the edge is at 127.5 (a sampled value ≥ 128 is ink). Inside is decided by the
  nonzero winding number at each pixel's centre.
- **Strokes**: the Hershey Roman Simplex glyphs (`files/rowmans.jhf`, space to `~` and the degree
  circle; files/HERSHEY-NOTICE.txt), polylines drawn as lines, as AutoCAD's SHX lettering is plotted.
  ⌀ and Ø are composed from its O and a slash, ± from its plus and a bar.
"""

import math
from dataclasses import dataclass
from enum import StrEnum
from functools import cache, lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from fontTools.pens.basePen import BasePen  # type: ignore[import-untyped]
from fontTools.ttLib import TTFont  # type: ignore[import-untyped]
from numpy.typing import NDArray

FILES = Path(__file__).with_name("files")
CURVE_STEPS = 6
SDF_PX_PER_UNIT = 24
SDF_SPREAD = 4


class FontKey(StrEnum):
    """The fonts Vextrus ships (each with its licence in `files/`)."""

    SANS = "liberation-sans"
    SANS_BOLD = "liberation-sans-bold"
    SERIF = "liberation-serif"
    STROKE = "hershey-simplex"


FILE_OF = {
    FontKey.SANS: "LiberationSans-Regular.ttf",
    FontKey.SANS_BOLD: "LiberationSans-Bold.ttf",
    FontKey.SERIF: "LiberationSerif-Regular.ttf",
    FontKey.STROKE: "rowmans.jhf",
}
NAME_OF = {
    FontKey.SANS: "Liberation Sans",
    FontKey.SANS_BOLD: "Liberation Sans Bold",
    FontKey.SERIF: "Liberation Serif",
    FontKey.STROKE: "Hershey Simplex",
}
"""How the font report names each font Vextrus draws with."""

type Points = NDArray[np.float64]


@dataclass(frozen=True)
class Outline:
    """An outline glyph in text units: closed contours (each Nx2, first point not repeated)."""

    contours: tuple[Points, ...]
    advance: float
    box: tuple[float, float, float, float] | None
    """(x0, y0, x1, y1) of its ink; none for a blank glyph (a space)."""


@dataclass(frozen=True)
class Strokes:
    """A stroke glyph in text units: polylines (each Nx2) drawn as lines."""

    strokes: tuple[Points, ...]
    advance: float


class _FlatteningPen(BasePen):  # type: ignore[misc]
    def __init__(self, glyph_set: Any, scale: float) -> None:
        super().__init__(glyph_set)
        self.scale = scale
        self.contours: list[list[tuple[float, float]]] = []
        self.current: list[tuple[float, float]] = []

    def _point(self, p: tuple[float, float]) -> tuple[float, float]:
        return (p[0] * self.scale, p[1] * self.scale)

    def _moveTo(self, pt: tuple[float, float]) -> None:
        self._end()
        self.current = [self._point(pt)]

    def _lineTo(self, pt: tuple[float, float]) -> None:
        self.current.append(self._point(pt))

    def _qCurveToOne(self, pt1: tuple[float, float], pt2: tuple[float, float]) -> None:
        p0 = self.current[-1]
        c, e = self._point(pt1), self._point(pt2)
        for k in range(1, CURVE_STEPS + 1):
            t = k / CURVE_STEPS
            u = 1 - t
            self.current.append(
                (
                    u * u * p0[0] + 2 * u * t * c[0] + t * t * e[0],
                    u * u * p0[1] + 2 * u * t * c[1] + t * t * e[1],
                )
            )

    def _curveToOne(
        self, pt1: tuple[float, float], pt2: tuple[float, float], pt3: tuple[float, float]
    ) -> None:
        p0 = self.current[-1]
        a, b, e = self._point(pt1), self._point(pt2), self._point(pt3)
        for k in range(1, CURVE_STEPS + 1):
            t = k / CURVE_STEPS
            u = 1 - t
            self.current.append(
                (
                    u**3 * p0[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t**3 * e[0],
                    u**3 * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t**3 * e[1],
                )
            )

    def _closePath(self) -> None:
        self._end()

    def _endPath(self) -> None:
        self._end()

    def _end(self) -> None:
        points = self.current
        if len(points) > 1 and points[0] == points[-1]:
            points = points[:-1]
        if len(points) >= 3:
            self.contours.append(points)
        self.current = []


class _TrueType:
    def __init__(self, key: FontKey) -> None:
        self.font = TTFont(FILES / FILE_OF[key], lazy=True)
        self.cmap: dict[int, str] = self.font.getBestCmap()
        self.glyph_set = self.font.getGlyphSet()
        self.scale = 1.0 / float(self.font["OS/2"].sCapHeight)

    def outline(self, code: int) -> Outline | None:
        name = self.cmap.get(code)
        if name is None:
            return None
        return self._outline(name)

    def notdef(self) -> Outline:
        return self._outline(".notdef")

    def _outline(self, name: str) -> Outline:
        glyph = self.glyph_set[name]
        pen = _FlatteningPen(self.glyph_set, self.scale)
        glyph.draw(pen)
        contours = tuple(np.array(c, dtype=np.float64) for c in pen.contours)
        box = None
        if contours:
            joined = np.concatenate(contours)
            x0, y0 = joined.min(axis=0)
            x1, y1 = joined.max(axis=0)
            box = (float(x0), float(y0), float(x1), float(y1))
        return Outline(contours, glyph.width * self.scale, box)


@cache
def _true_type(key: FontKey) -> _TrueType:
    return _TrueType(key)


@lru_cache(maxsize=8192)
def outline(key: FontKey, char: str) -> Outline | None:
    """The outline of `char` in an outline font, or none when the font has no such glyph."""
    if key is FontKey.STROKE:
        raise ValueError("the single-stroke font has strokes, not outlines")
    return _true_type(key).outline(ord(char))


@cache
def notdef(key: FontKey) -> Outline:
    """The font's glyph for a character it lacks (Liberation's: an empty box)."""
    return _true_type(key).notdef()


# The single-stroke font --------------------------------------------------------------------------

_HERSHEY_CAP = 21.0
_HERSHEY_BASELINE = 9.0


@cache
def _hershey() -> dict[str, Strokes]:
    glyphs: dict[str, Strokes] = {}
    lines = (FILES / FILE_OF[FontKey.STROKE]).read_text(encoding="ascii").splitlines()
    for index, line in enumerate(lines):
        data = line[8:]
        left, right = ord(data[0]) - 82, ord(data[1]) - 82
        strokes: list[list[tuple[float, float]]] = [[]]
        for i in range(2, len(data) - 1, 2):
            pair = data[i : i + 2]
            if pair == " R":
                strokes.append([])
                continue
            x, y = ord(pair[0]) - 82, ord(pair[1]) - 82
            strokes[-1].append(((x - left) / _HERSHEY_CAP, (_HERSHEY_BASELINE - y) / _HERSHEY_CAP))
        char = "°" if index == 95 else chr(32 + index)  # the last record is the degree circle
        glyphs[char] = Strokes(
            tuple(np.array(s, dtype=np.float64) for s in strokes if len(s) >= 2),
            (right - left) / _HERSHEY_CAP,
        )
    letter_o, plus = glyphs["O"], glyphs["+"]
    slash = np.array([[0.1, -0.1], [letter_o.advance - 0.1, 1.1]])
    glyphs["⌀"] = glyphs["Ø"] = Strokes((*letter_o.strokes, slash), letter_o.advance)
    raised = tuple(s + np.array([0.0, 0.15]) for s in plus.strokes)
    bar = np.array([[plus.advance * 0.2, 0.0], [plus.advance * 0.8, 0.0]])
    glyphs["±"] = Strokes((*raised, bar), plus.advance)
    return glyphs


def strokes(char: str) -> Strokes | None:
    """The single-stroke glyph of `char`, or none when the font has none."""
    return _hershey().get(char)


# Signed distance fields --------------------------------------------------------------------------


@dataclass(frozen=True)
class Field:
    """A glyph's signed distance field: `pixels` (rows from the top, 8-bit) spanning `box` (x0, y0,
    x1, y1 in text units; y0 at the bottom row's lower edge)."""

    pixels: NDArray[np.uint8]
    box: tuple[float, float, float, float]


def winding(points: Points, contours: tuple[Points, ...]) -> NDArray[np.int64]:
    """The nonzero winding number of each point (Nx2) about the closed contours."""
    total = np.zeros(len(points), dtype=np.int64)
    px, py = points[:, 0:1], points[:, 1:2]
    for contour in contours:
        a = contour
        b = np.roll(contour, -1, axis=0)
        ax, ay, bx, by = a[:, 0], a[:, 1], b[:, 0], b[:, 1]
        cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
        up = (ay <= py) & (by > py) & (cross > 0)
        down = (by <= py) & (ay > py) & (cross < 0)
        total += up.sum(axis=1) - down.sum(axis=1)
    return total


def _distance(points: Points, contours: tuple[Points, ...]) -> NDArray[np.float64]:
    a = np.concatenate(contours)
    b = np.concatenate([np.roll(c, -1, axis=0) for c in contours])
    ab = b - a
    length2 = np.maximum((ab * ab).sum(axis=1), 1e-18)
    ap_x = points[:, 0:1] - a[:, 0]
    ap_y = points[:, 1:2] - a[:, 1]
    t = np.clip((ap_x * ab[:, 0] + ap_y * ab[:, 1]) / length2, 0.0, 1.0)
    dx = ap_x - t * ab[:, 0]
    dy = ap_y - t * ab[:, 1]
    result: NDArray[np.float64] = np.sqrt((dx * dx + dy * dy).min(axis=1))
    return result


def sdf(glyph: Outline) -> Field | None:
    """The glyph's signed distance field, or none for a blank glyph."""
    if glyph.box is None or not glyph.contours:
        return None
    pad = SDF_SPREAD / SDF_PX_PER_UNIT
    x0, y0 = glyph.box[0] - pad, glyph.box[1] - pad
    width = max(1, math.ceil((glyph.box[2] - glyph.box[0]) * SDF_PX_PER_UNIT + 2 * SDF_SPREAD))
    height = max(1, math.ceil((glyph.box[3] - glyph.box[1]) * SDF_PX_PER_UNIT + 2 * SDF_SPREAD))
    step = 1.0 / SDF_PX_PER_UNIT
    xs = x0 + (np.arange(width) + 0.5) * step
    ys = y0 + (np.arange(height)[::-1] + 0.5) * step  # the first row is the top
    grid_x, grid_y = np.meshgrid(xs, ys)
    points = np.column_stack([grid_x.ravel(), grid_y.ravel()])
    distance = _distance(points, glyph.contours) * SDF_PX_PER_UNIT
    inside = winding(points, glyph.contours) != 0
    signed = np.where(inside, distance, -distance)
    value = 127.5 + 127.5 * np.clip(signed / SDF_SPREAD, -1.0, 1.0)
    pixels = np.clip(np.round(value), 0, 255).astype(np.uint8).reshape(height, width)
    return Field(pixels, (x0, y0, x0 + width * step, y0 + height * step))
