"""The PDF painter — the second painting of the one authored Scene (E-fixture §4.1).

`write(sheets, blocks, images, mode)` returns the bytes of a whole set: one page per sheet at that
sheet's own paper size, so the page sizes MIX across the document the way a Dhaka set does (A1
layouts, A2 notes, an A3 bar bending schedule). Everything is painted by hand from the Scene
primitives — reportlab is a pen and a page, never a drawing library — so the PDF carries the same
geometry the DXF carries and nothing else.

Two modes, the two ways a consultant's PDF comes out of a CAD station (W-03):

  "ttf"  TrueType text: Vera, taken from the pinned reportlab wheel so the bytes are the same on
         every machine, embedded and extractable — `pypdfium2` reads every string back.
  "shx"  stroked text: the Hershey simplex table in `hershey.py` painted as polylines, which is
         what a station without the drawing's SHX prints. The page carries no text object at all,
         so an extractor reads nothing and the product must fall back to the DXF (T-PDF-SHX).

Neither mode can print Bengali (no Bengali face is pinned and reportlab does not shape it), so a
string the mode cannot draw is dropped and named as a loss — `BENGALI_TEXT_DXF_ONLY` — which is
the ruling W-03 makes and `sanity.json` records. The English line beside it is drawn as authored.
"""

from __future__ import annotations

import io
import math
import os
from dataclasses import dataclass
from typing import Any

import reportlab
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from . import hershey
from .scene import PAPER_MM, Block, Scene, Sheet, View, dim_text, plain_text

PT_PER_MM = 72.0 / 25.4

#: The faces inside the pinned reportlab wheel (W-03) — never a system font.
_FONT_DIR = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
REGULAR, BOLD = "Vera", "VeraBd"
_FONT_FILES = {REGULAR: "Vera.ttf", BOLD: "VeraBd.ttf"}

#: Fixed document metadata: no clock, no machine, no user (determinism, §3.9).
TITLE = "F-RCC6-BNBC PROPOSED G+6 STORIED RESIDENTIAL BUILDING — STRUCTURAL DRAWINGS"
AUTHOR = "MEGHNA STRUCTURAL CONSULTANTS LTD."
SUBJECT = "F-RCC6-BNBC"
CREATOR = "fixtures/gen/rcc6_bnbc/emit/pdf.py"

#: Pen weights in points, by the composer's layer name (plan.LAYERS keys).
_HEAVY = ("S-COLS", "S-WALL", "S-FDN", "S-TITLE", "S-SHEET", "S-REV")
_LIGHT = ("S-TEXT", "S-TEXT2", "S-DIMS", "S-DIMI", "S-GRID", "S-GRIDC", "S-GRIDT", "S-HATCH", "Defpoints")

#: Linetype patterns in points (the DXF's HIDDEN/CENTER/DASHED as a dash array).
_DASH: dict[str, list[float]] = {
    "HIDDEN": [3.0, 2.0],
    "DASHED": [5.0, 2.5],
    "CENTER": [10.0, 2.0, 2.0, 2.0],
    "PHANTOM": [12.0, 2.0, 2.0, 2.0, 2.0, 2.0],
}

#: The chord a flattened arc is allowed to miss its true curve by, in points.
_CHORD_TOLERANCE_PT = 0.15

#: What a pen without the glyph spells instead — the substitution a CAD station makes when the
#: face is missing a stacked eighth. Bengali has no such spelling, which is why it is a loss.
_FALLBACK = {
    "\u215b": "1/8", "\u215c": "3/8", "\u215d": "5/8", "\u215e": "7/8", "\u2153": "1/3",
    "\u2154": "2/3", "\u00bd": "1/2", "\u00bc": "1/4", "\u00be": "3/4", "\u2265": ">=",
    "\u2264": "<=", "\u2212": "-", "\u00b7": ".", "\u2205": "\u00d8", "\u00d7": "x",
}

#: The loss a string that no pinned face can draw is recorded under (W-03).
BENGALI_LOSS = "BENGALI_TEXT_DXF_ONLY"
UNDRAWN_LOSS = "GLYPH_NOT_IN_PINNED_FACE"


# ---------------------------------------------------------------------------------------------
# The transform: scene millimetres -> PDF points, carrying scale, rotation and mirror.
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Xf:
    """An affine map (a b c d e f) taking a scene point to a point on the page, in points."""

    a: float = 1.0
    b: float = 0.0
    c: float = 0.0
    d: float = 1.0
    e: float = 0.0
    f: float = 0.0

    def __call__(self, p: tuple[float, float]) -> tuple[float, float]:
        return (self.a * p[0] + self.c * p[1] + self.e, self.b * p[0] + self.d * p[1] + self.f)

    @property
    def det(self) -> float:
        return self.a * self.d - self.b * self.c

    @property
    def scale(self) -> float:
        """The uniform part: how long one scene millimetre is, in points."""
        return math.sqrt(abs(self.det)) or 1e-9

    def length(self, v: float) -> float:
        return v * self.scale

    def then(self, inner: Xf) -> Xf:
        """`self ∘ inner`: apply `inner` first (a block's own placement), then this one."""
        return Xf(
            a=self.a * inner.a + self.c * inner.b,
            b=self.b * inner.a + self.d * inner.b,
            c=self.a * inner.c + self.c * inner.d,
            d=self.b * inner.c + self.d * inner.d,
            e=self.a * inner.e + self.c * inner.f + self.e,
            f=self.b * inner.e + self.d * inner.f + self.f,
        )

    def matrix(self) -> tuple[float, float, float, float, float, float]:
        return (self.a, self.b, self.c, self.d, self.e, self.f)


def translation(dx: float, dy: float) -> Xf:
    return Xf(e=dx, f=dy)


def scaling(sx: float, sy: float) -> Xf:
    return Xf(a=sx, d=sy)


def rotation(deg: float) -> Xf:
    r = math.radians(deg)
    return Xf(a=math.cos(r), b=math.sin(r), c=-math.sin(r), d=math.cos(r))


def paper_xf() -> Xf:
    """Paper millimetres, 1:1, to points."""
    return scaling(PT_PER_MM, PT_PER_MM)


def view_xf(view: View) -> Xf:
    """The view window: `world_origin` lands at `paper_at`, shrunk by the view's scale."""
    k = PT_PER_MM / float(view.scale)
    return Xf(
        a=k,
        d=k,
        e=(view.paper_at[0] - view.world_origin[0] / float(view.scale)) * PT_PER_MM,
        f=(view.paper_at[1] - view.world_origin[1] / float(view.scale)) * PT_PER_MM,
    )


# ---------------------------------------------------------------------------------------------
# Curves flattened to polylines (one code path for CIRCLE, ARC and a bulged LWPOLYLINE segment).
# ---------------------------------------------------------------------------------------------


def _arc_points(
    centre: tuple[float, float], r: float, start_deg: float, end_deg: float, radius_pt: float
) -> list[tuple[float, float]]:
    sweep = end_deg - start_deg
    while sweep <= 0:
        sweep += 360.0
    steps = _steps_for(radius_pt, sweep)
    return [
        (
            centre[0] + r * math.cos(math.radians(start_deg + sweep * i / steps)),
            centre[1] + r * math.sin(math.radians(start_deg + sweep * i / steps)),
        )
        for i in range(steps + 1)
    ]


def _steps_for(radius_pt: float, sweep_deg: float) -> int:
    """Enough chords that the flattened curve stays within `_CHORD_TOLERANCE_PT` of the true one."""
    if radius_pt <= _CHORD_TOLERANCE_PT:
        return 4
    per = 2.0 * math.degrees(math.acos(max(-1.0, 1.0 - _CHORD_TOLERANCE_PT / radius_pt)))
    return max(2, min(360, math.ceil(abs(sweep_deg) / max(per, 0.5))))


def _bulge_points(
    a: tuple[float, float], b: tuple[float, float], bulge: float, xf: Xf
) -> list[tuple[float, float]]:
    """The arc a DXF bulge means: tan(θ/4) between two vertices, positive counter-clockwise."""
    if not bulge:
        return [b]
    chord = math.hypot(b[0] - a[0], b[1] - a[1])
    if chord == 0:
        return [b]
    theta = 4.0 * math.atan(bulge)
    r = chord / (2.0 * math.sin(abs(theta) / 2.0))
    mid = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
    height = r * math.cos(theta / 2.0)
    nx, ny = -(b[1] - a[1]) / chord, (b[0] - a[0]) / chord
    centre = (mid[0] + nx * height, mid[1] + ny * height)
    start = math.degrees(math.atan2(a[1] - centre[1], a[0] - centre[0]))
    end = math.degrees(math.atan2(b[1] - centre[1], b[0] - centre[0]))
    if theta < 0:
        start, end = end, start
    points = _arc_points(centre, r, start, end, xf.length(r))
    if theta < 0:
        points.reverse()
    return points[1:]


# ---------------------------------------------------------------------------------------------
# The painter
# ---------------------------------------------------------------------------------------------


class Painter:
    """Paints Scenes onto one canvas. `mode` picks the text pen; `losses` gathers what it drops."""

    def __init__(
        self,
        pdf: canvas.Canvas,
        blocks: dict[str, Block],
        images: dict[str, bytes],
        mode: str,
    ) -> None:
        if mode not in ("ttf", "shx"):
            raise ValueError(f"mode is 'ttf' or 'shx', not {mode!r}")
        self.pdf = pdf
        self.blocks = blocks
        self.images = images
        self.mode = mode
        self.losses: dict[str, int] = {}
        self.substitutions = 0
        self.page_images = 0
        self.page_texts = 0
        self.depth = 0

    # -- pens ---------------------------------------------------------------------------------

    def _pen(self, item: dict[str, Any], xf: Xf) -> None:
        layer = item.get("layer") or "S-LINE"
        width = 0.5 if layer in _HEAVY else 0.25 if layer in _LIGHT else 0.35
        self.pdf.setLineWidth(width)
        pattern = _DASH.get((item.get("linetype") or "").upper())
        self.pdf.setDash(pattern, 0) if pattern else self.pdf.setDash([], 0)

    def _font(self, item: dict[str, Any]) -> str:
        style = str(item.get("style") or "").upper()
        raw = str(item.get("raw") or "")
        heavy = "BOLD" in style or "TITLE" in style or "|b1" in raw or item.get("layer") == "S-TITLE"
        return BOLD if heavy else REGULAR

    def _has(self, ch: str) -> bool:
        if ch == " ":
            return True
        if self.mode == "shx":
            return hershey.covers(ch)
        return ord(ch) in pdfmetrics.getFont(REGULAR).face.charToGlyph

    def _drawable(self, text: str) -> bool:
        return all(self._has(ch) for ch in text)

    def _lose(self, text: str) -> None:
        bengali = any(0x0980 <= ord(ch) <= 0x09FF for ch in text)
        name = BENGALI_LOSS if bengali else UNDRAWN_LOSS
        self.losses[name] = self.losses.get(name, 0) + 1

    def _substitute(self, text: str) -> str:
        """Spell out the characters this pen has no glyph for; leave the rest exactly as authored."""
        if all(self._has(ch) for ch in text):
            return text
        return "".join(
            ch if self._has(ch) else _FALLBACK.get(ch, ch) for ch in text
        )

    def _string_width(self, text: str, font: str, size: float) -> float:
        if self.mode == "shx":
            return hershey.width(text) * size / hershey.CAP
        return pdfmetrics.stringWidth(text, font, size)

    # -- scenes -------------------------------------------------------------------------------

    def scene(self, scene: Scene, xf: Xf, unit: str = "ftin") -> None:
        for item in scene.items:
            self.item(item, xf, unit)

    def item(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        kind = item["kind"]
        painter = getattr(self, f"_paint_{kind.lower()}", None)
        if painter is None:
            raise ValueError(f"the painter has no pen for {kind}")
        self._pen(item, xf)
        painter(item, xf, unit)

    # -- geometry -----------------------------------------------------------------------------

    def _stroke(self, points: list[tuple[float, float]], xf: Xf, close: bool = False) -> None:
        if len(points) < 2:
            return
        path = self.pdf.beginPath()
        path.moveTo(*xf(points[0]))
        for p in points[1:]:
            path.lineTo(*xf(p))
        if close:
            path.close()
        self.pdf.drawPath(path, stroke=1, fill=0)

    def _fill(self, points: list[tuple[float, float]], xf: Xf, grey: float = 0.0) -> None:
        if len(points) < 3:
            return
        self.pdf.saveState()
        self.pdf.setFillGray(grey)
        path = self.pdf.beginPath()
        path.moveTo(*xf(points[0]))
        for p in points[1:]:
            path.lineTo(*xf(p))
        path.close()
        self.pdf.drawPath(path, stroke=0, fill=1)
        self.pdf.restoreState()

    def _paint_line(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        self._stroke([item["a"], item["b"]], xf)

    def _paint_lwpolyline(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        points = list(item["points"])
        bulges = item.get("bulges")
        closed = bool(item.get("closed"))
        if not bulges:
            self._stroke(points, xf, close=closed)
            return
        walked: list[tuple[float, float]] = [points[0]]
        last = len(points) if closed else len(points) - 1
        for i in range(last):
            a, b = points[i], points[(i + 1) % len(points)]
            walked.extend(_bulge_points(a, b, bulges[i], xf))
        self._stroke(walked, xf, close=False)

    def _paint_polyline(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        self._stroke(list(item["points"]), xf, close=bool(item.get("closed")))

    def _paint_circle(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        self._stroke(_arc_points(item["c"], item["r"], 0.0, 360.0, xf.length(item["r"])), xf)

    def _paint_arc(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        points = _arc_points(item["c"], item["r"], item["start"], item["end"], xf.length(item["r"]))
        self._stroke(points, xf)

    def _paint_point(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        x, y = item["at"]
        tick = 0.8 / max(xf.scale, 1e-9)
        self._stroke([(x - tick, y), (x + tick, y)], xf)
        self._stroke([(x, y - tick), (x, y + tick)], xf)

    def _paint_solid(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        self._fill(list(item["points"]), xf)

    def _paint_hatch(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        paths = [list(p) for p in item["paths"] if len(p) >= 3]
        if not paths:
            return
        if item.get("solid"):
            self._fill(paths[0], xf, grey=0.72)
            return
        self.pdf.saveState()
        clip = self.pdf.beginPath()
        for ring in paths:
            clip.moveTo(*xf(ring[0]))
            for p in ring[1:]:
                clip.lineTo(*xf(p))
            clip.close()
        self.pdf.clipPath(clip, stroke=0, fill=0)
        self.pdf.setLineWidth(0.2)
        for line in _hatch_lines(paths, float(item.get("angle") or 0.0), float(item.get("scale") or 25.0), xf):
            self._stroke(list(line), xf)
        self.pdf.restoreState()

    # -- text ---------------------------------------------------------------------------------

    def string(
        self,
        text: str,
        at: tuple[float, float],
        h: float,
        xf: Xf,
        align: str = "LEFT",
        rotation_deg: float = 0.0,
        width_factor: float = 1.0,
        font: str = REGULAR,
    ) -> None:
        """One line of text, placed by its alignment, in whichever pen the mode calls for."""
        if not text.strip():
            return
        spelled = self._substitute(text)
        if spelled != text:
            self.substitutions += 1
            text = spelled
        if not self._drawable(text):
            self._lose(text)
            return
        place = xf.then(translation(*at)).then(rotation(rotation_deg)).then(scaling(width_factor, 1.0))
        width = self._string_width(text, font, h)
        dx = {"LEFT": 0.0, "CENTER": -width / 2.0, "RIGHT": -width}[_horizontal(align)]
        dy = {"BASE": 0.0, "MIDDLE": -h * 0.38, "TOP": -h * 0.78, "BOTTOM": h * 0.2}[_vertical(align)]
        if self.mode == "shx":
            k = h / hershey.CAP
            local = place.then(scaling(k, k)).then(translation(dx / k, dy / k))
            self.pdf.setLineWidth(max(0.2, h * xf.scale * 0.075))
            self.pdf.setDash([], 0)
            for stroke in hershey.text_strokes(text):
                self._stroke(list(stroke), local)
            return
        self.pdf.saveState()
        self.pdf.transform(*place.matrix())
        self.pdf.setFont(font, h)
        self.pdf.setFillGray(0.0)
        self.pdf.drawString(dx, dy, text)
        self.pdf.restoreState()
        self.page_texts += 1

    def _paint_text(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        lines = plain_text(item["s"])
        font = self._font(item)
        for n, line in enumerate(lines):
            self.string(
                line,
                (item["at"][0], item["at"][1] - n * item["h"] * 1.5),
                float(item["h"]),
                xf,
                align=str(item.get("align") or "LEFT"),
                rotation_deg=float(item.get("rotation") or 0.0),
                width_factor=float(item.get("width_factor") or 1.0),
                font=font,
            )

    def _paint_mtext(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        h = float(item["h"])
        font = self._font(item)
        lines: list[str] = []
        for paragraph in plain_text(item["raw"]):
            lines.extend(self._wrap(paragraph, float(item.get("width") or 0.0), font, h))
        if not lines:
            return
        attachment = str(item.get("attachment") or "TOP_LEFT")
        block = (len(lines) - 1) * h * 1.5 + h
        top = {"TOP": 0.0, "MIDDLE": block / 2.0, "BOTTOM": block}[_vertical(attachment)]
        for n, line in enumerate(lines):
            self.string(
                line,
                (item["at"][0], item["at"][1] + top - h - n * h * 1.5),
                h,
                xf,
                align=_horizontal(attachment),
                rotation_deg=float(item.get("rotation") or 0.0),
                font=font,
            )

    def _wrap(self, text: str, width: float, font: str, h: float) -> list[str]:
        if width <= 0 or not text:
            return [text]
        out: list[str] = []
        line = ""
        for word in text.split(" "):
            trial = f"{line} {word}".strip()
            if line and self._string_width(trial, font, h) > width:
                out.append(line)
                line = word
            else:
                line = trial
        out.append(line)
        return out

    # -- annotation ---------------------------------------------------------------------------

    def _paint_dimension(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        p1, p2, base = item["p1"], item["p2"], item["base"]
        angle = float(item["angle"])
        h = float(item["h"])
        ux, uy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        nx, ny = -uy, ux
        offset = (base[0] - p1[0]) * nx + (base[1] - p1[1]) * ny
        a = (p1[0] + nx * offset, p1[1] + ny * offset)
        measure = (p2[0] - p1[0]) * ux + (p2[1] - p1[1]) * uy
        b = (a[0] + ux * measure, a[1] + uy * measure)
        over = h * 0.6
        self._stroke([p1, (a[0] + nx * over * 0.5, a[1] + ny * over * 0.5)], xf)
        self._stroke([p2, (b[0] + nx * over * 0.5, b[1] + ny * over * 0.5)], xf)
        self._stroke([a, b], xf)
        for p in (a, b):
            self._stroke(
                [
                    (p[0] - (ux + nx) * over / 2, p[1] - (uy + ny) * over / 2),
                    (p[0] + (ux + nx) * over / 2, p[1] + (uy + ny) * over / 2),
                ],
                xf,
            )
        measured = dim_text(abs(measure), float(item.get("dimlfac") or 1.0), unit)
        authored = item.get("text")
        text = measured if authored is None else str(authored).replace("<>", measured)
        mid = ((a[0] + b[0]) / 2 + nx * h * 0.7, (a[1] + b[1]) / 2 + ny * h * 0.7)
        for n, line in enumerate(plain_text(text)):
            self.string(line, (mid[0], mid[1] - n * h * 1.5), h, xf, align="CENTER")

    def _arrow(self, tip: tuple[float, float], tail: tuple[float, float], size: float, xf: Xf) -> None:
        dx, dy = tip[0] - tail[0], tip[1] - tail[1]
        length = math.hypot(dx, dy) or 1.0
        ux, uy = dx / length, dy / length
        nx, ny = -uy, ux
        back = (tip[0] - ux * size, tip[1] - uy * size)
        self._fill(
            [tip, (back[0] + nx * size / 3, back[1] + ny * size / 3), (back[0] - nx * size / 3, back[1] - ny * size / 3)],
            xf,
        )

    def _paint_leader(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        points = list(item["points"])
        self._stroke(points, xf)
        if item.get("arrow", True) and len(points) > 1:
            span = math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1])
            self._arrow(points[0], points[1], min(span / 2.0, _paper_mm(2.5, xf)), xf)

    def _paint_mleader(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        self._paint_leader({**item, "arrow": True}, xf, unit)
        points = list(item["points"])
        h = float(item["h"])
        tail = points[-1]
        for n, line in enumerate(plain_text(item["s"])):
            self.string(line, (tail[0] + h * 0.4, tail[1] + h * 0.3 - n * h * 1.5), h, xf, align="LEFT")

    # -- references ---------------------------------------------------------------------------

    def _paint_insert(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        name = item["block"]
        block = self.blocks.get(name)
        if block is None:
            return
        if self.depth > 8:
            raise RecursionError(f"block {name} nests deeper than a drawing ever should")
        sx, sy = item.get("scale") or (1.0, 1.0)
        place = xf.then(translation(*item["at"])).then(rotation(float(item.get("rotation") or 0.0))).then(
            scaling(float(sx), float(sy))
        )
        self.depth += 1
        self.scene(block.scene, place, unit)
        values = dict(item.get("attribs") or {})
        for tag, _prompt, at, h, default in block.attdefs:
            self.string(str(values.get(tag, default)), at, float(h), place, align="LEFT")
        self.depth -= 1

    def _paint_image(self, item: dict[str, Any], xf: Xf, unit: str) -> None:
        payload = self.images.get(item["name"])
        if payload is None:
            return
        w, h = item["size"]
        place = xf.then(translation(*item["at"]))
        self.pdf.saveState()
        self.pdf.transform(*place.matrix())
        self.pdf.drawImage(
            ImageReader(io.BytesIO(payload)), 0, 0, width=float(w), height=float(h), mask=None
        )
        self.pdf.restoreState()
        self.page_images += 1


def _paper_mm(mm: float, xf: Xf) -> float:
    """`mm` millimetres measured ON THE PAPER, expressed in the scene units `xf` maps from."""
    return mm * PT_PER_MM / max(xf.scale, 1e-9)


def _horizontal(align: str) -> str:
    name = align.upper()
    if "CENTER" in name and "MIDDLE_CENTER" not in name:
        return "CENTER"
    if name in ("CENTER", "MIDDLE_CENTER", "TOP_CENTER", "BOTTOM_CENTER"):
        return "CENTER"
    if "RIGHT" in name:
        return "RIGHT"
    return "LEFT"


def _vertical(align: str) -> str:
    name = align.upper()
    if name.startswith("MIDDLE"):
        return "MIDDLE"
    if name.startswith("TOP"):
        return "TOP"
    if name.startswith("BOTTOM"):
        return "BOTTOM"
    return "BASE"


#: ANSI31's rules are 0.125 in apart at pattern scale 1, and a reader needs them between these
#: two spacings on the paper however the view is scaled.
_ANSI31_MM = 3.175
_HATCH_PAPER_MM = (0.7, 6.0)


def _hatch_lines(
    paths: list[list[tuple[float, float]]], angle: float, scale: float, xf: Xf
) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """ANSI31's parallel rules: 45° off the pattern angle, spaced by the pattern scale."""
    xs = [p[0] for ring in paths for p in ring]
    ys = [p[1] for ring in paths for p in ring]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    on_paper = _ANSI31_MM * scale * xf.scale / PT_PER_MM
    spacing = min(max(on_paper, _HATCH_PAPER_MM[0]), _HATCH_PAPER_MM[1]) * PT_PER_MM / xf.scale
    theta = math.radians(angle + 45.0)
    ux, uy = math.cos(theta), math.sin(theta)
    nx, ny = -uy, ux
    centre = ((x0 + x1) / 2.0, (y0 + y1) / 2.0)
    reach = math.hypot(x1 - x0, y1 - y0) / 2.0 + spacing
    count = min(int(reach / spacing), 4000)
    lines = []
    for i in range(-count, count + 1):
        base = (centre[0] + nx * i * spacing, centre[1] + ny * i * spacing)
        lines.append(
            ((base[0] - ux * reach, base[1] - uy * reach), (base[0] + ux * reach, base[1] + uy * reach))
        )
    return lines


# ---------------------------------------------------------------------------------------------
# The document
# ---------------------------------------------------------------------------------------------


def register_fonts() -> None:
    """Vera and VeraBd from the pinned wheel, once per process (W-03)."""
    for name, filename in _FONT_FILES.items():
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, os.path.join(_FONT_DIR, filename)))


def page_size_pt(size: str) -> tuple[float, float]:
    w, h = PAPER_MM[size]
    return (w * PT_PER_MM, h * PT_PER_MM)


def _as_blocks(blocks: Any) -> dict[str, Block]:
    if isinstance(blocks, dict):
        return blocks
    return {block.name: block for block in (blocks or [])}


def _as_images(images: Any) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for name, payload in (images or {}).items():
        out[name] = payload if isinstance(payload, bytes | bytearray) else payload["png"]
    return out


def write_report(
    sheets: list[Sheet], blocks: Any, images: Any, mode: str
) -> tuple[bytes, dict[str, Any]]:
    """The bytes of the whole set and what the painter can say about them."""
    register_fonts()
    buffer = io.BytesIO()
    first = page_size_pt(sheets[0].size) if sheets else page_size_pt("A1")
    pdf = canvas.Canvas(buffer, pagesize=first, invariant=1, pageCompression=1)
    pdf.setTitle(TITLE)
    pdf.setAuthor(AUTHOR)
    pdf.setSubject(SUBJECT)
    pdf.setCreator(CREATOR)
    pdf.setProducer(CREATOR)
    painter = Painter(pdf, _as_blocks(blocks), _as_images(images), mode)
    pages: list[dict[str, Any]] = []
    for sheet in sheets:
        size = page_size_pt(sheet.size)
        pdf.setPageSize(size)
        painter.page_images = painter.page_texts = 0
        pdf.setStrokeGray(0.0)
        pdf.setFillGray(0.0)
        painter.scene(sheet.paper, paper_xf(), "mm")
        for view in sheet.views:
            pdf.saveState()
            window = pdf.beginPath()
            window.rect(
                view.paper_at[0] * PT_PER_MM,
                view.paper_at[1] * PT_PER_MM,
                view.paper_size[0] * PT_PER_MM,
                view.paper_size[1] * PT_PER_MM,
            )
            pdf.clipPath(window, stroke=0, fill=0)
            painter.scene(view.scene, view_xf(view), view.unit)
            pdf.restoreState()
        pages.append(
            {
                "sheet": sheet.number,
                "size": sheet.size,
                "page_pt": [round(size[0], 3), round(size[1], 3)],
                "images": painter.page_images,
                "texts": painter.page_texts,
            }
        )
        pdf.showPage()
    pdf.save()
    losses = sorted(painter.losses)
    if mode == "shx":
        losses = sorted({*losses, BENGALI_LOSS, "NO_TEXT_LAYER"})
    report = {
        "mode": mode,
        "pages": len(pages),
        "page_sizes_pt": [page["page_pt"] for page in pages],
        "text_pages": sum(1 for page in pages if page["texts"] > 0),
        "image_pages": [page["sheet"] for page in pages if page["images"] > 0],
        "text_objects": sum(page["texts"] for page in pages),
        "losses": losses,
        "loss_counts": dict(sorted(painter.losses.items())),
        "substituted_glyphs": painter.substitutions,
        "font": "Vera + VeraBd (reportlab wheel)" if mode == "ttf" else "Hershey simplex strokes",
    }
    return buffer.getvalue(), report


def write(sheets: list[Sheet], blocks: Any, images: Any, mode: str) -> bytes:
    return write_report(sheets, blocks, images, mode)[0]
