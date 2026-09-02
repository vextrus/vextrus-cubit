"""F-RCC6: a synthetic six-storey RCC residential building, authored from one embedded set of inputs.

One run writes the whole corpus (F-RCC6, L-CAD-09): the DXF (ezdxf), a DWG minted from it by
LibreDWG's `dxf2dwg`, a vector PDF (reportlab, D-04: fixtures only), a raster PDF plus one 200 DPI
PNG per sheet (pypdfium2 render, a fixed mild skew, seeded speckle), the authored inputs, the hand
takeoff golden computed by the L-FRM-02/L-FRM-03 formulas from those inputs alone (L-QTY-06: never
from the drawing), the authoring-time sanity tally of every original entity placed, and a manifest.

Everything is deterministic: fixed document metadata, an invariant PDF writer, one seeded generator
for the speckle, no clock anywhere. The same inputs give the same bytes, except the DWG, whose
writer is not byte-stable and which is judged by its LibreDWG census instead.

    uv run --project cad --group fixtures python fixtures/gen/rcc6.py [--out DIR]
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from decimal import ROUND_HALF_EVEN, Decimal
from itertools import pairwise
from pathlib import Path
from typing import Any

import ezdxf
import numpy as np
from ezdxf.enums import MTextEntityAlignment, TextEntityAlignment
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

FIXTURE = "F-RCC6"
GENERATOR_REL = "fixtures/gen/rcc6.py"

# ---------------------------------------------------------------------------------------------
# The authored inputs: the one source every other artifact derives from.
# ---------------------------------------------------------------------------------------------

INPUTS: dict[str, Any] = {
    "levels": [
        {"name": "FDN", "storey_height_m": 1.5},
        {"name": "GF", "storey_height_m": 3.0},
        {"name": "1F", "storey_height_m": 3.0},
        {"name": "2F", "storey_height_m": 3.0},
        {"name": "3F", "storey_height_m": 3.0},
        {"name": "4F", "storey_height_m": 3.0},
        {"name": "5F", "storey_height_m": 3.0},
        {"name": "ROOF", "storey_height_m": 2.4},
    ],
    "grid": {
        "letters": ["A", "B", "C", "D", "E", "F"],
        "numerals": ["1", "2", "3", "4", "5", "6"],
        "x_mm": [0, 4500, 9000, 13500, 18000, 22500],
        "y_mm": [0, 4000, 8000, 12000, 16000, 20000],
    },
    "columns": [
        {"mark": "C1", "b_mm": 300, "d_mm": 300, "count": 4, "levels": ["GF", "1F", "2F", "3F", "4F", "5F"]},
        {"mark": "C2", "b_mm": 300, "d_mm": 450, "count": 16, "levels": ["GF", "1F", "2F", "3F", "4F", "5F"]},
        {"mark": "C3", "b_mm": 350, "d_mm": 500, "count": 12, "levels": ["GF", "1F", "2F", "3F", "4F", "5F"]},
        {
            "mark": "C4",
            "b_mm": 400,
            "d_mm": 600,
            "count": 4,
            "levels": ["GF", "1F", "2F", "3F", "4F", "5F", "ROOF"],
        },
    ],
    "beams": [
        {
            "mark": "B1",
            "b_mm": 250,
            "d_mm": 450,
            "span_m": 4.5,
            "count": 10,
            "levels": ["1F", "2F", "3F", "4F", "5F", "ROOF"],
        },
        {
            "mark": "B2",
            "b_mm": 250,
            "d_mm": 500,
            "span_m": 4.5,
            "count": 20,
            "levels": ["1F", "2F", "3F", "4F", "5F", "ROOF"],
        },
        {
            "mark": "B3",
            "b_mm": 250,
            "d_mm": 450,
            "span_m": 4.0,
            "count": 10,
            "levels": ["1F", "2F", "3F", "4F", "5F", "ROOF"],
        },
        {
            "mark": "B4",
            "b_mm": 250,
            "d_mm": 500,
            "span_m": 4.0,
            "count": 20,
            "levels": ["1F", "2F", "3F", "4F", "5F", "ROOF"],
        },
        {
            "mark": "B5",
            "b_mm": 300,
            "d_mm": 600,
            "span_m": 4.5,
            "count": 4,
            "levels": ["1F", "2F", "3F", "4F", "5F"],
        },
        {
            "mark": "B6",
            "b_mm": 200,
            "d_mm": 400,
            "span_m": 4.0,
            "count": 5,
            "levels": ["1F", "2F", "3F", "4F", "5F"],
        },
    ],
    "slab": [
        {"level": "GF", "area_m2": 450.0, "openings_m2": 15.25, "thickness_mm": 125},
        {"level": "1F", "area_m2": 450.0, "openings_m2": 15.25, "thickness_mm": 150},
        {"level": "2F", "area_m2": 450.0, "openings_m2": 15.25, "thickness_mm": 150},
        {"level": "3F", "area_m2": 450.0, "openings_m2": 15.25, "thickness_mm": 150},
        {"level": "4F", "area_m2": 450.0, "openings_m2": 15.25, "thickness_mm": 150},
        {"level": "5F", "area_m2": 450.0, "openings_m2": 15.25, "thickness_mm": 150},
        {"level": "ROOF", "area_m2": 450.0, "openings_m2": 4.0, "thickness_mm": 150},
    ],
    "footings": [
        {"mark": "F1", "l_mm": 1500, "b_mm": 1500, "depth_mm": 450, "count": 4},
        {"mark": "F2", "l_mm": 1800, "b_mm": 1800, "depth_mm": 500, "count": 8},
        {"mark": "F3", "l_mm": 2100, "b_mm": 2100, "depth_mm": 550, "count": 12},
        {"mark": "F4", "l_mm": 1800, "b_mm": 2100, "depth_mm": 500, "count": 8},
    ],
    "pile_caps": [
        {"mark": "PC1", "l_mm": 2400, "b_mm": 2400, "depth_mm": 900, "count": 2},
        {"mark": "PC2", "l_mm": 3000, "b_mm": 2400, "depth_mm": 900, "count": 2},
    ],
    "tie_beams": [
        {"mark": "TB1", "b_mm": 250, "d_mm": 400, "span_m": 4.5, "count": 30},
        {"mark": "TB2", "b_mm": 250, "d_mm": 400, "span_m": 4.0, "count": 30},
    ],
}

#: Which mark sits on which grid intersection, by (letter index, numeral index) position class.
#: Corners, long edges (rows 1 and 6), short edges (columns A and F), the four core bays, the rest.
COLUMN_AT = {"corner": "C1", "edge": "C2", "interior": "C3", "core": "C4"}
FOOTING_AT = {"corner": "F1", "long_edge": "F2", "interior": "F3", "short_edge": "F4"}
CORE_POSITIONS = {(2, 2): "PC1", (3, 2): "PC2", (2, 3): "PC1", (3, 3): "PC2"}
PILES_UNDER = {"PC1": 4, "PC2": 3}

#: The stair and lift openings the typical slab carries, as (x, y, width, height) in mm.
STAIR_OPENING = (9500, 8500, 2500, 4500)
LIFT_OPENING = (12500, 8500, 2000, 2000)
ROOF_OPENING = (9500, 8500, 2000, 2000)

SHEET_NAMES = (
    "FOUNDATION PLAN",
    "TYPICAL FLOOR PLAN",
    "ROOF PLAN",
    "COLUMN SCHEDULE",
    "BEAM SCHEDULE",
    "FOOTING SCHEDULE",
    "SECTIONS",
    "GENERAL NOTES",
)
PAGE_MM = (420.0, 297.0)
PT_PER_MM = 72.0 / 25.4
TITLE_STRIP_MM = 30.0
BORDER_MM = 10.0

RASTER_DPI = 200
#: The budget for LibreDWG's dxf2dwg (L-CAD-04: an isolated subprocess, generous but bounded); a
#: converter that wedges is a named refusal, not a stalled lane.
DXF2DWG_TIMEOUT_SECONDS = 120.0
SKEW_DEG = 0.6
NOISE_SEED = 20260903
NOISE_FRACTION = 0.002

MM = Decimal(1000)
QUANTUM = Decimal("0.001")

Point = tuple[float, float]


# ---------------------------------------------------------------------------------------------
# A scene: the primitives one view or one title block is made of, rendered twice.
# ---------------------------------------------------------------------------------------------


@dataclass
class Scene:
    """Authored primitives in local millimetres; the DXF writer and the PDF painter both read them."""

    items: list[tuple[Any, ...]] = field(default_factory=list)

    def line(self, a: Point, b: Point, layer: str = "S-LINE") -> None:
        self.items.append(("LINE", a, b, layer))

    def poly(self, points: list[Point], layer: str = "S-LINE", closed: bool = True) -> None:
        self.items.append(("LWPOLYLINE", points, closed, layer))

    def rect(self, x: float, y: float, w: float, h: float, layer: str = "S-LINE") -> None:
        self.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], layer)

    def circle(self, c: Point, r: float, layer: str = "S-LINE") -> None:
        self.items.append(("CIRCLE", c, r, layer))

    def arc(self, c: Point, r: float, start: float, end: float, layer: str = "S-LINE") -> None:
        self.items.append(("ARC", c, r, start, end, layer))

    def text(self, s: str, at: Point, h: float, centred: bool = False, layer: str = "S-TEXT") -> None:
        self.items.append(("TEXT", s, at, h, centred, layer))

    def mtext(self, lines: list[str], at: Point, h: float, width: float, layer: str = "S-TEXT") -> None:
        self.items.append(("MTEXT", lines, at, h, width, layer))

    def insert(self, block: str, at: Point, layer: str = "S-TITLE") -> None:
        self.items.append(("INSERT", block, at, layer))

    def dim(self, p1: Point, p2: Point, base: Point, angle: float, h: float, layer: str = "S-DIMS") -> None:
        self.items.append(("DIMENSION", p1, p2, base, angle, h, layer))

    def bbox(self) -> tuple[float, float, float, float]:
        xs: list[float] = []
        ys: list[float] = []

        def take(p: Point) -> None:
            xs.append(p[0])
            ys.append(p[1])

        for item in self.items:
            kind = item[0]
            if kind == "LINE":
                take(item[1])
                take(item[2])
            elif kind == "LWPOLYLINE":
                for p in item[1]:
                    take(p)
            elif kind in {"CIRCLE", "ARC"}:
                (cx, cy), r = item[1], item[2]
                take((cx - r, cy - r))
                take((cx + r, cy + r))
            elif kind in {"TEXT", "MTEXT", "INSERT"}:
                take(item[2])
            elif kind == "DIMENSION":
                take(item[1])
                take(item[2])
                take(item[3])
        return (min(xs), min(ys), max(xs), max(ys))


def beam_lines(scene: Scene, a: Point, b: Point, width: float, layer: str) -> None:
    """A beam in plan: its two edge lines, offset half a width either side of its axis."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    nx, ny = -dy / length * width / 2, dx / length * width / 2
    scene.line((a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), layer)
    scene.line((a[0] - nx, a[1] - ny), (b[0] - nx, b[1] - ny), layer)


def position_class(i: int, j: int) -> str:
    xs, ys = INPUTS["grid"]["x_mm"], INPUTS["grid"]["y_mm"]
    on_x_edge = i in (0, len(xs) - 1)
    on_y_edge = j in (0, len(ys) - 1)
    if on_x_edge and on_y_edge:
        return "corner"
    if on_y_edge:
        return "long_edge"
    if on_x_edge:
        return "short_edge"
    if (i, j) in CORE_POSITIONS:
        return "core"
    return "interior"


def by_mark(family: str) -> dict[str, dict[str, Any]]:
    return {item["mark"]: item for item in INPUTS[family]}


def grid_points() -> list[tuple[int, int, float, float]]:
    xs, ys = INPUTS["grid"]["x_mm"], INPUTS["grid"]["y_mm"]
    return [(i, j, float(x), float(y)) for j, y in enumerate(ys) for i, x in enumerate(xs)]


def draw_grid(scene: Scene, dims: bool) -> None:
    """Grid lines, a bubble per axis with its label inside (L-CAD-07's content signature)."""
    grid = INPUTS["grid"]
    xs, ys = grid["x_mm"], grid["y_mm"]
    x0, x1, y0, y1 = xs[0] - 1500, xs[-1] + 1500, ys[0] - 1500, ys[-1] + 1500
    for letter, x in zip(grid["letters"], xs, strict=True):
        scene.line((x, y0), (x, y1), "S-GRID")
        scene.circle((x, y0 - 1000), 500, "S-GRID")
        scene.text(letter, (x, y0 - 1000), 450, centred=True)
    for numeral, y in zip(grid["numerals"], ys, strict=True):
        scene.line((x0, y), (x1, y), "S-GRID")
        scene.circle((x0 - 1000, y), 500, "S-GRID")
        scene.text(numeral, (x0 - 1000, y), 450, centred=True)
    if dims:
        for a, b in pairwise(xs):
            scene.dim((a, y1), (b, y1), (a, y1 + 1200), 0, 300)
        for a, b in pairwise(ys):
            scene.dim((x1, a), (x1, b), (x1 + 1200, a), 90, 300)
    else:
        scene.dim((xs[0], y1), (xs[-1], y1), (xs[0], y1 + 1200), 0, 300)
        scene.dim((x1, ys[0]), (x1, ys[-1]), (x1 + 1200, ys[0]), 90, 300)


def draw_section_markers(scene: Scene) -> None:
    """Section A-A cut symbols at both plan edges: a half-circle, a stem and the letter."""
    xs, ys = INPUTS["grid"]["x_mm"], INPUTS["grid"]["y_mm"]
    y = (ys[2] + ys[3]) / 2
    for x, start in ((xs[0] - 3800, 90.0), (xs[-1] + 3800, 270.0)):
        scene.arc((x, y), 500, start, start + 180, "S-TEXT")
        scene.line((x, y - 500), (x, y + 500), "S-TEXT")
        # "A-A", never a bare letter: a bare letter inside a round mark is the grid-axis signature
        # (L-CAD-07), and a section cut must not read as a seventh axis A.
        scene.text("A-A", (x, y), 300, centred=True)


def caption(scene: Scene, title: str, note: str) -> None:
    xs, ys = INPUTS["grid"]["x_mm"], INPUTS["grid"]["y_mm"]
    scene.text(title, ((xs[0] + xs[-1]) / 2, ys[0] - 3600), 600, centred=True)
    scene.text(note, ((xs[0] + xs[-1]) / 2, ys[0] - 4500), 350, centred=True)


def foundation_plan() -> Scene:
    scene = Scene()
    draw_grid(scene, dims=True)
    draw_section_markers(scene)
    footings, caps = by_mark("footings"), by_mark("pile_caps")
    for i, j, x, y in grid_points():
        cls = position_class(i, j)
        if cls == "core":
            mark = CORE_POSITIONS[i, j]
            cap = caps[mark]
            l_mm, b_mm = cap["l_mm"], cap["b_mm"]
            scene.rect(x - l_mm / 2, y - b_mm / 2, l_mm, b_mm, "S-FDN")
            piles = PILES_UNDER[mark]
            for k in range(piles):
                angle = math.tau * k / piles + math.pi / 4
                scene.circle(
                    (x + math.cos(angle) * l_mm * 0.3, y + math.sin(angle) * b_mm * 0.3), 250, "S-FDN"
                )
        else:
            mark = FOOTING_AT[cls]
            footing = footings[mark]
            l_mm, b_mm = footing["l_mm"], footing["b_mm"]
            scene.rect(x - l_mm / 2, y - b_mm / 2, l_mm, b_mm, "S-FDN")
        scene.text(mark, (x + l_mm / 2 + 150, y + b_mm / 2 - 300), 300)
    xs, ys = INPUTS["grid"]["x_mm"], INPUTS["grid"]["y_mm"]
    tie = by_mark("tie_beams")
    for j, y in enumerate(ys):
        for a, b in pairwise(xs):
            beam_lines(scene, (a, y), (b, y), tie["TB1"]["b_mm"], "S-BEAM")
            if j in (0, len(ys) - 1):
                scene.text("TB1", ((a + b) / 2, y + 250), 250, centred=True)
    for i, x in enumerate(xs):
        for a, b in pairwise(ys):
            beam_lines(scene, (x, a), (x, b), tie["TB2"]["b_mm"], "S-BEAM")
            if i in (0, len(xs) - 1):
                scene.text("TB2", (x + 400, (a + b) / 2), 250)
    caption(scene, "FOUNDATION PLAN", "FOOTING TOP AT -1.500  |  TIE BEAMS TB1 / TB2 AT FDN")
    return scene


def typical_floor_plan() -> Scene:
    scene = Scene()
    draw_grid(scene, dims=True)
    draw_section_markers(scene)
    xs, ys = INPUTS["grid"]["x_mm"], INPUTS["grid"]["y_mm"]
    scene.rect(xs[0] - 150, ys[0] - 150, xs[-1] - xs[0] + 300, ys[-1] - ys[0] + 300, "S-SLAB")
    columns = by_mark("columns")
    for i, j, x, y in grid_points():
        mark = COLUMN_AT[
            {"long_edge": "edge", "short_edge": "edge"}.get(position_class(i, j), position_class(i, j))
        ]
        column = columns[mark]
        scene.rect(x - column["b_mm"] / 2, y - column["d_mm"] / 2, column["b_mm"], column["d_mm"], "S-COLS")
        scene.text(mark, (x + column["b_mm"] / 2 + 150, y + column["d_mm"] / 2 + 100), 300)
    beams = by_mark("beams")
    for j, y in enumerate(ys):
        mark = "B1" if j in (0, len(ys) - 1) else "B2"
        for a, b in pairwise(xs):
            beam_lines(scene, (a, y), (b, y), beams[mark]["b_mm"], "S-BEAM")
            scene.text(mark, ((a + b) / 2, y + 250), 250, centred=True)
    for i, x in enumerate(xs):
        mark = "B3" if i in (0, len(xs) - 1) else "B4"
        for a, b in pairwise(ys):
            beam_lines(scene, (x, a), (x, b), beams[mark]["b_mm"], "S-BEAM")
            scene.text(mark, (x + 400, (a + b) / 2), 250)
    sx, sy, sw, sh = STAIR_OPENING
    scene.rect(sx, sy, sw, sh, "S-SLAB")
    scene.text("STAIR OPENING", (sx + sw / 2, sy + sh / 2), 250, centred=True)
    lx, ly, lw, lh = LIFT_OPENING
    scene.rect(lx, ly, lw, lh, "S-SLAB")
    scene.text("LIFT OPENING", (lx + lw / 2, ly + lh / 2), 250, centred=True)
    for a, b in (
        ((sx, sy), (sx + sw, sy)),
        ((sx, sy + sh), (sx + sw, sy + sh)),
        ((lx, ly), (lx + lw, ly)),
        ((lx, ly + lh), (lx + lw, ly + lh)),
    ):
        beam_lines(scene, a, b, beams["B5"]["b_mm"], "S-BEAM")
        scene.text("B5", ((a[0] + b[0]) / 2, a[1] - 450), 250, centred=True)
    for a, b in pairwise(xs):
        x = (a + b) / 2
        beam_lines(scene, (x, ys[2]), (x, ys[3]), beams["B6"]["b_mm"], "S-BEAM")
        scene.text("B6", (x + 300, (ys[2] + ys[3]) / 2), 250)
    caption(scene, "TYPICAL FLOOR PLAN", "1F TO 5F  |  SLAB 150 THK  |  SEE COLUMN AND BEAM SCHEDULES")
    return scene


def roof_plan() -> Scene:
    scene = Scene()
    draw_grid(scene, dims=False)
    draw_section_markers(scene)
    xs, ys = INPUTS["grid"]["x_mm"], INPUTS["grid"]["y_mm"]
    scene.rect(xs[0] - 150, ys[0] - 150, xs[-1] - xs[0] + 300, ys[-1] - ys[0] + 300, "S-SLAB")
    scene.rect(xs[0] + 100, ys[0] + 100, xs[-1] - xs[0] - 200, ys[-1] - ys[0] - 200, "S-SLAB")
    scene.text("PARAPET 150 THK, 1000 HIGH", ((xs[0] + xs[-1]) / 2, ys[-1] - 600), 300, centred=True)
    beams = by_mark("beams")
    for j, y in enumerate(ys):
        mark = "B1" if j in (0, len(ys) - 1) else "B2"
        for a, b in pairwise(xs):
            beam_lines(scene, (a, y), (b, y), beams[mark]["b_mm"], "S-BEAM")
    for i, x in enumerate(xs):
        mark = "B3" if i in (0, len(xs) - 1) else "B4"
        for a, b in pairwise(ys):
            beam_lines(scene, (x, a), (x, b), beams[mark]["b_mm"], "S-BEAM")
    for i, j, x, y in grid_points():
        if position_class(i, j) == "core":
            column = by_mark("columns")["C4"]
            scene.rect(
                x - column["b_mm"] / 2, y - column["d_mm"] / 2, column["b_mm"], column["d_mm"], "S-COLS"
            )
            scene.text("C4", (x + column["b_mm"] / 2 + 150, y + column["d_mm"] / 2 + 100), 300)
    rx, ry, rw, rh = ROOF_OPENING
    scene.rect(rx, ry, rw, rh, "S-SLAB")
    scene.text("STAIR OPENING", (rx + rw / 2, ry + rh / 2), 250, centred=True)
    scene.rect(9000, 8000, 6000, 5000, "S-SLAB")
    scene.text("MACHINE ROOM OVER", (12000, 13300), 300, centred=True)
    caption(scene, "ROOF PLAN", "ROOF SLAB 150 THK AT +18.000  |  B1 TO B4 AT ROOF")
    return scene


def table(scene: Scene, title: str, header: list[str], rows: list[list[str]], widths: list[float]) -> None:
    """A schedule: ruled with lines, every cell an original TEXT."""
    row_h = 900.0
    total = sum(widths)
    top = 0.0
    scene.text(title, (total / 2, top + 1200), 600, centred=True)
    lines = [header, *rows]
    for r in range(len(lines) + 1):
        scene.line((0, top - r * row_h), (total, top - r * row_h), "S-LINE")
    x = 0.0
    for w in [*widths, 0.0]:
        scene.line((x, top), (x, top - len(lines) * row_h), "S-LINE")
        x += w
    for r, cells in enumerate(lines):
        x = 0.0
        for cell, w in zip(cells, widths, strict=True):
            scene.text(cell, (x + 200, top - (r + 1) * row_h + 300), 320)
            x += w


def levels_text(levels: list[str]) -> str:
    return f"{levels[0]} TO {levels[-1]}"


def column_schedule() -> Scene:
    scene = Scene()
    bars = {
        "C1": ("8-T16", "T8 @ 150"),
        "C2": ("8-T20", "T8 @ 150"),
        "C3": ("10-T20", "T8 @ 125"),
        "C4": ("12-T25", "T10 @ 100"),
    }
    rows = [
        [
            c["mark"],
            f"{c['b_mm']} x {c['d_mm']}",
            levels_text(c["levels"]),
            bars[c["mark"]][0],
            bars[c["mark"]][1],
            str(c["count"]),
        ]
        for c in INPUTS["columns"]
    ]
    table(
        scene,
        "COLUMN SCHEDULE",
        ["MARK", "SIZE b x d (mm)", "LEVELS", "MAIN BARS", "LINKS", "NOS"],
        rows,
        [1800, 3200, 3000, 2600, 2600, 1400],
    )
    scene.text("ALL COLUMNS M25 CONCRETE, Fe500 BARS, 40 mm CLEAR COVER", (0, -6500), 320)
    return scene


def beam_schedule() -> Scene:
    scene = Scene()
    bars = {
        "B1": "3-T16 T / 3-T16 B",
        "B2": "3-T16 T / 4-T16 B",
        "B3": "3-T16 T / 3-T16 B",
        "B4": "3-T16 T / 4-T16 B",
        "B5": "4-T20 T / 4-T20 B",
        "B6": "2-T12 T / 3-T12 B",
    }
    rows = [
        [
            b["mark"],
            f"{b['b_mm']} x {b['d_mm']}",
            f"{b['span_m']:.1f} m",
            levels_text(b["levels"]),
            bars[b["mark"]],
            "T8 @ 150",
            str(b["count"]),
        ]
        for b in INPUTS["beams"]
    ]
    rows += [
        [
            t["mark"],
            f"{t['b_mm']} x {t['d_mm']}",
            f"{t['span_m']:.1f} m",
            "FDN",
            "2-T16 T / 2-T16 B",
            "T8 @ 200",
            str(t["count"]),
        ]
        for t in INPUTS["tie_beams"]
    ]
    table(
        scene,
        "BEAM SCHEDULE",
        ["MARK", "SIZE b x d (mm)", "SPAN", "LEVELS", "BARS", "STIRRUPS", "NOS PER LEVEL"],
        rows,
        [1800, 3200, 1800, 2600, 4000, 2400, 3000],
    )
    scene.text("BEAM DEPTHS INCLUDE THE SLAB; SPANS ARE GRID TO GRID", (0, -10100), 320)
    return scene


def footing_schedule() -> Scene:
    scene = Scene()
    rows = [
        [f["mark"], f"{f['l_mm']} x {f['b_mm']}", str(f["depth_mm"]), "T12 @ 150 B/W", str(f["count"])]
        for f in INPUTS["footings"]
    ]
    rows += [
        [
            p["mark"],
            f"{p['l_mm']} x {p['b_mm']}",
            str(p["depth_mm"]),
            f"T16 @ 125 B/W ON {PILES_UNDER[p['mark']]} PILES",
            str(p["count"]),
        ]
        for p in INPUTS["pile_caps"]
    ]
    table(
        scene,
        "FOOTING SCHEDULE",
        ["MARK", "L x B (mm)", "DEPTH (mm)", "BARS", "NOS"],
        rows,
        [1800, 3200, 2400, 6200, 1400],
    )
    scene.text("FOOTING TOP AT -1.500, 50 mm CLEAR COVER, 75 mm BLINDING BELOW", (0, -7400), 320)
    return scene


def level_elevations() -> list[tuple[str, float]]:
    """(name, elevation in metres) for the stack, the ground floor at 0.000."""
    stack = INPUTS["levels"]
    below = next(level for level in stack if level["name"] == "FDN")
    elevations: list[tuple[str, float]] = [("FDN", -below["storey_height_m"])]
    z = 0.0
    for level in stack[1:]:
        elevations.append((level["name"], z))
        z += level["storey_height_m"]
    return elevations


def sections() -> Scene:
    scene = Scene()
    xs = INPUTS["grid"]["x_mm"]
    elevations = level_elevations()
    x0, x1 = xs[0] - 2500, xs[-1] + 2500
    for name, z in elevations:
        y = z * 1000
        scene.line((x0, y), (x1, y), "S-GRID")
        scene.text(f"{name} {z:+.3f}", (x1 + 300, y + 100), 300)
    footing = by_mark("footings")["F3"]
    for x in xs:
        scene.rect(
            x - footing["l_mm"] / 2,
            -1500 - footing["depth_mm"],
            footing["l_mm"],
            footing["depth_mm"],
            "S-FDN",
        )
        scene.line((x - 175, -1500), (x - 175, 18000), "S-COLS")
        scene.line((x + 175, -1500), (x + 175, 18000), "S-COLS")
    beam = by_mark("beams")["B2"]
    for name, z in elevations:
        if name in ("FDN", "GF"):
            continue
        for x in xs:
            scene.rect(x - beam["b_mm"] / 2, z * 1000 - beam["d_mm"], beam["b_mm"], beam["d_mm"], "S-BEAM")
        scene.line((xs[0], z * 1000 - 150), (xs[-1], z * 1000 - 150), "S-SLAB")
    scene.line((x0, -1500), (x1, -1500), "S-FDN")
    scene.text("GROUND", (x0, -1200), 300)
    for (_, a), (_, b) in pairwise(elevations):
        scene.dim((x0 - 800, a * 1000), (x0 - 800, b * 1000), (x0 - 2000, a * 1000), 90, 300)
    scene.text("SECTION A-A", ((xs[0] + xs[-1]) / 2, -4800), 600, centred=True)
    scene.text(
        "SECTIONS  |  STOREY HEIGHTS PER LEVEL STACK, SEE GENERAL NOTES",
        ((xs[0] + xs[-1]) / 2, -5700),
        350,
        centred=True,
    )
    return scene


NOTES = [
    [
        "1. CONCRETE",
        "M25 FOR ALL RCC WORK (fck = 25 N/mm2). CEMENT OPC 43 GRADE.",
        "MAXIMUM AGGREGATE 20 mm, SLUMP 75 TO 100 mm.",
    ],
    ["2. REINFORCEMENT", "Fe500 HIGH YIELD DEFORMED BARS, fy = 500 N/mm2.", "BAR MARKS: T = Fe500."],
    ["3. CLEAR COVER", "FOOTINGS AND PILE CAPS 50 mm, COLUMNS 40 mm, BEAMS 25 mm,", "SLABS 20 mm."],
    [
        "4. LAPS",
        "LAP LENGTH 50d FOR BARS IN TENSION, STAGGERED, NOT MORE THAN",
        "50% OF BARS LAPPED AT ONE SECTION. NO LAPS AT BEAM-COLUMN JOINTS.",
    ],
    [
        "5. LEVELS",
        "GF AT +0.000. FOOTING TOP AT -1.500. TYPICAL STOREY 3.000 m,",
        "ROOF MACHINE ROOM 2.400 m.",
    ],
    [
        "6. DIMENSIONS",
        "ALL DIMENSIONS IN mm UNLESS NOTED. LEVELS IN m. DO NOT SCALE.",
        "GRID A TO F AND 1 TO 6 AS PLANS.",
    ],
]


def general_notes() -> Scene:
    scene = Scene()
    scene.text("GENERAL NOTES", (9000, 1200), 600, centred=True)
    y = 0.0
    for lines in NOTES:
        scene.mtext(lines, (0, y), 320, 18000)
        y -= 2200
    scene.text("SIX-STOREY RCC RESIDENTIAL BUILDING", (9000, y - 600), 400, centred=True)
    return scene


def title_block(name: str, index: int) -> Scene:
    """The paper-space title block: one INSERT of the frame block and the sheet's own TEXT."""
    scene = Scene()
    scene.insert("TITLE_BLOCK", (0, 0))
    left, base = PAGE_MM[0] - 200.0, BORDER_MM + 4.0
    scene.text(name, (left, base + 14.0), 6.0)
    scene.text(f"{FIXTURE}  SAMPLE  SIX-STOREY RCC RESIDENTIAL BUILDING", (left, base + 7.0), 3.5)
    scene.text(f"SHEET {index + 1} OF {len(SHEET_NAMES)}  |  A3  |  ALL DIMENSIONS IN mm", (left, base), 3.0)
    return scene


def frame_block() -> Scene:
    """The block the title block inserts: the sheet border and the title strip's rulings."""
    scene = Scene()
    w, h = PAGE_MM
    scene.rect(BORDER_MM, BORDER_MM, w - 2 * BORDER_MM, h - 2 * BORDER_MM, "S-TITLE")
    scene.line(
        (BORDER_MM, BORDER_MM + TITLE_STRIP_MM), (w - BORDER_MM, BORDER_MM + TITLE_STRIP_MM), "S-TITLE"
    )
    scene.line((w - 210.0, BORDER_MM), (w - 210.0, BORDER_MM + TITLE_STRIP_MM), "S-TITLE")
    scene.line(
        (w - 210.0, BORDER_MM + TITLE_STRIP_MM / 2),
        (w - BORDER_MM, BORDER_MM + TITLE_STRIP_MM / 2),
        "S-TITLE",
    )
    return scene


@dataclass(frozen=True)
class Sheet:
    name: str
    view: Scene
    offset: Point
    title: Scene

    @property
    def slug(self) -> str:
        return self.name.lower().replace(" ", "-")


def author_sheets() -> list[Sheet]:
    views = [
        foundation_plan(),
        typical_floor_plan(),
        roof_plan(),
        column_schedule(),
        beam_schedule(),
        footing_schedule(),
        sections(),
        general_notes(),
    ]
    offsets = [
        (0, 0),
        (40000, 0),
        (80000, 0),
        (0, -40000),
        (40000, -40000),
        (80000, -40000),
        (0, -80000),
        (40000, -80000),
    ]
    return [
        Sheet(name, view, offset, title_block(name, index))
        for index, (name, view, offset) in enumerate(zip(SHEET_NAMES, views, offsets, strict=True))
    ]


# ---------------------------------------------------------------------------------------------
# The DXF: every scene placed as original entities, tallied as it is placed (L-CAD-09).
# ---------------------------------------------------------------------------------------------

LAYERS = {
    "S-GRID": 8,
    "S-COLS": 1,
    "S-BEAM": 4,
    "S-FDN": 3,
    "S-SLAB": 5,
    "S-TEXT": 7,
    "S-DIMS": 6,
    "S-TITLE": 7,
    "S-LINE": 7,
}


def place(layout: Any, scene: Scene, offset: Point, tally: Counter[str] | None) -> None:
    """Draw a scene into an ezdxf layout at an offset; count each original under its DXF type."""
    ox, oy = offset

    def at(p: Point) -> Point:
        return (p[0] + ox, p[1] + oy)

    def count(dxftype: str) -> None:
        if tally is not None:
            tally[dxftype] += 1

    for item in scene.items:
        kind = item[0]
        if kind == "LINE":
            layout.add_line(at(item[1]), at(item[2]), dxfattribs={"layer": item[3]})
        elif kind == "LWPOLYLINE":
            layout.add_lwpolyline([at(p) for p in item[1]], close=item[2], dxfattribs={"layer": item[3]})
        elif kind == "CIRCLE":
            layout.add_circle(at(item[1]), item[2], dxfattribs={"layer": item[3]})
        elif kind == "ARC":
            layout.add_arc(at(item[1]), item[2], item[3], item[4], dxfattribs={"layer": item[5]})
        elif kind == "TEXT":
            _, s, p, h, centred, layer = item
            align = TextEntityAlignment.MIDDLE_CENTER if centred else TextEntityAlignment.LEFT
            layout.add_text(s, height=h, dxfattribs={"layer": layer}).set_placement(at(p), align=align)
        elif kind == "MTEXT":
            _, lines, p, h, width, layer = item
            mtext = layout.add_mtext(
                "\\P".join(lines), dxfattribs={"layer": layer, "char_height": h, "width": width}
            )
            mtext.set_location(at(p), attachment_point=MTextEntityAlignment.TOP_LEFT)
        elif kind == "INSERT":
            layout.add_blockref(item[1], at(item[2]), dxfattribs={"layer": item[3]})
        elif kind == "DIMENSION":
            _, p1, p2, base, angle, h, layer = item
            # Text stays horizontal (dimtih/dimtoh): a rotated MTEXT in the rendered dimension block
            # is a DXF group LibreDWG's dxf2dwg refuses to decode, and the DWG must mint (L-CAD-04).
            override = {
                "dimtxt": h,
                "dimasz": h * 0.6,
                "dimexe": h * 0.5,
                "dimexo": h * 0.3,
                "dimgap": h * 0.2,
                "dimdec": 0,
                "dimtad": 1,
                "dimtih": 1,
                "dimtoh": 1,
            }
            layout.add_linear_dim(
                base=at(base),
                p1=at(p1),
                p2=at(p2),
                angle=angle,
                dimstyle="EZDXF",
                override=override,
                dxfattribs={"layer": layer},
            ).render()
        else:
            raise ValueError(f"unknown primitive {kind}")
        count(kind)


def write_dxf(sheets: list[Sheet], scratch: Path) -> tuple[bytes, dict[str, dict[str, int]]]:
    ezdxf.options.write_fixed_meta_data_for_testing = True
    # R2004: LibreDWG's dxf2dwg re-owns every dimension block after the first when it decodes an
    # R2000 DXF, and dwg2dxf then writes that block's paint into model space as originals - a silent
    # higher count on the DWG side of L-CAD-09's sanity number. An R2004 DXF rounds trip exact.
    doc = ezdxf.new("R2004", setup=True)
    doc.header["$INSUNITS"] = 4
    for name, colour in LAYERS.items():
        doc.layers.add(name, color=colour)
    block = doc.blocks.new("TITLE_BLOCK")
    place(block, frame_block(), (0, 0), None)

    drawn: dict[str, Counter[str]] = {"model": Counter()}
    msp = doc.modelspace()
    for sheet in sheets:
        place(msp, sheet.view, sheet.offset, drawn["model"])
    for sheet in sheets:
        layout = doc.layouts.new(sheet.name)
        layout.page_setup(size=PAGE_MM, margins=(0, 0, 0, 0), units="mm")
        # page_setup plants a main VIEWPORT; the artifact never records one (it frames paint rather
        # than being paint), so the sheet carries none and both sanity numbers count the same set.
        viewport = layout.main_viewport()
        if viewport is not None:
            layout.delete_entity(viewport)
            layout.dxf_layout.dxf.discard("viewport_handle")
        drawn[sheet.name] = Counter()
        place(layout, sheet.title, (0, 0), drawn[sheet.name])
    doc.layouts.delete("Layout1")
    # ezdxf fills the CLASSES section from a set of the entity types in use, whose order follows
    # the interpreter's hash seed; registering them sorted first keeps the bytes the same run to run.
    for dxftype in sorted(doc.entitydb.dxf_types_in_use()):
        doc.classes.add_class(dxftype)

    path = scratch / "rcc6.dxf"
    doc.saveas(path)
    sanity = {space: dict(sorted(counts.items())) for space, counts in drawn.items()}
    return path.read_bytes(), sanity


def mint_dwg(dxf_path: Path, scratch: Path) -> bytes:
    """`dxf2dwg`, judged by the drawing it wrote and never by its exit code (L-CAD-04)."""
    program = shutil.which("dxf2dwg")
    if program is None:
        raise RuntimeError("dxf2dwg (LibreDWG) is not on PATH; the DWG cannot be minted")
    target = scratch / "rcc6.dwg"
    try:
        run = subprocess.run(
            [program, "-y", "-o", str(target), str(dxf_path)],
            capture_output=True,
            text=True,
            check=False,
            timeout=DXF2DWG_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as expired:
        raise RuntimeError(
            f"dxf2dwg outran its {DXF2DWG_TIMEOUT_SECONDS:g}s budget minting the DWG and was stopped"
        ) from expired
    if not target.is_file() or target.stat().st_size == 0:
        raise RuntimeError(f"dxf2dwg wrote no drawing (exit {run.returncode}): {run.stderr.strip()[-2000:]}")
    return target.read_bytes()


# ---------------------------------------------------------------------------------------------
# The vector PDF (D-04: reportlab, fixtures only) and the raster set derived from it.
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Fit:
    """Local millimetres -> page millimetres: a scale and a translation."""

    scale: float
    dx: float
    dy: float

    def __call__(self, p: Point) -> tuple[float, float]:
        return ((p[0] * self.scale + self.dx) * PT_PER_MM, (p[1] * self.scale + self.dy) * PT_PER_MM)

    def length(self, mm: float) -> float:
        return mm * self.scale * PT_PER_MM


def fit_view(scene: Scene) -> Fit:
    x0, y0, x1, y1 = scene.bbox()
    area_w = PAGE_MM[0] - 2 * BORDER_MM - 20.0
    area_h = PAGE_MM[1] - 2 * BORDER_MM - TITLE_STRIP_MM - 16.0
    scale = min(area_w / (x1 - x0), area_h / (y1 - y0))
    dx = BORDER_MM + 10.0 + (area_w - (x1 - x0) * scale) / 2 - x0 * scale
    dy = BORDER_MM + TITLE_STRIP_MM + 8.0 + (area_h - (y1 - y0) * scale) / 2 - y0 * scale
    return Fit(scale, dx, dy)


def paint_text(pdf: canvas.Canvas, s: str, x: float, y: float, size: float, centred: bool) -> None:
    pdf.setFont("Helvetica", size)
    if centred:
        pdf.drawCentredString(x, y - size * 0.35, s)
    else:
        pdf.drawString(x, y, s)


def paint(pdf: canvas.Canvas, scene: Scene, place: Fit, blocks: dict[str, Scene]) -> None:
    """Paint a scene on the current page; the same primitives the DXF placed."""
    for item in scene.items:
        kind = item[0]
        if kind == "LINE":
            (ax, ay), (bx, by) = place(item[1]), place(item[2])
            pdf.line(ax, ay, bx, by)
        elif kind == "LWPOLYLINE":
            path = pdf.beginPath()
            points = [place(p) for p in item[1]]
            path.moveTo(*points[0])
            for p in points[1:]:
                path.lineTo(*p)
            if item[2]:
                path.close()
            pdf.drawPath(path, stroke=1, fill=0)
        elif kind == "CIRCLE":
            (cx, cy), r = place(item[1]), place.length(item[2])
            pdf.circle(cx, cy, r, stroke=1, fill=0)
        elif kind == "ARC":
            (cx, cy), r = place(item[1]), place.length(item[2])
            pdf.arc(cx - r, cy - r, cx + r, cy + r, item[3], item[4] - item[3])
        elif kind == "TEXT":
            _, s, p, h, centred, _ = item
            x, y = place(p)
            paint_text(pdf, s, x, y, place.length(h), centred)
        elif kind == "MTEXT":
            _, lines, p, h, _, _ = item
            x, y = place(p)
            size = place.length(h)
            for n, line in enumerate(lines):
                paint_text(pdf, line, x, y - size * (n + 1) * 1.4, size, False)
        elif kind == "INSERT":
            _, name, p, _ = item
            paint(
                pdf,
                blocks[name],
                Fit(place.scale, place.dx + p[0] * place.scale, place.dy + p[1] * place.scale),
                blocks,
            )
        elif kind == "DIMENSION":
            paint_dimension(pdf, place, item)


def paint_dimension(pdf: canvas.Canvas, place: Fit, item: tuple[Any, ...]) -> None:
    _, p1, p2, base, angle, h, _ = item
    ux, uy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    nx, ny = -uy, ux
    offset = (base[0] - p1[0]) * nx + (base[1] - p1[1]) * ny
    a = (p1[0] + nx * offset, p1[1] + ny * offset)
    measure = (p2[0] - p1[0]) * ux + (p2[1] - p1[1]) * uy
    b = (a[0] + ux * measure, a[1] + uy * measure)
    tick = h * 0.6
    for start, end in ((p1, a), (p2, b), (a, b)):
        (sx, sy), (ex, ey) = place(start), place(end)
        pdf.line(sx, sy, ex, ey)
    for p in (a, b):
        (sx, sy), (ex, ey) = (
            place((p[0] - (ux + nx) * tick / 2, p[1] - (uy + ny) * tick / 2)),
            place((p[0] + (ux + nx) * tick / 2, p[1] + (uy + ny) * tick / 2)),
        )
        pdf.line(sx, sy, ex, ey)
    mid = ((a[0] + b[0]) / 2 + nx * h * 0.8, (a[1] + b[1]) / 2 + ny * h * 0.8)
    x, y = place(mid)
    paint_text(pdf, f"{abs(measure):.0f}", x, y, place.length(h), True)


def page_size_pt() -> tuple[float, float]:
    return (PAGE_MM[0] * PT_PER_MM, PAGE_MM[1] * PT_PER_MM)


def new_canvas(buffer: io.BytesIO, title: str) -> canvas.Canvas:
    pdf = canvas.Canvas(buffer, pagesize=page_size_pt(), invariant=1)
    pdf.setTitle(title)
    pdf.setAuthor(GENERATOR_REL)
    pdf.setSubject(FIXTURE)
    return pdf


def write_vector_pdf(sheets: list[Sheet]) -> bytes:
    buffer = io.BytesIO()
    pdf = new_canvas(buffer, f"{FIXTURE} SAMPLE six-storey RCC residential building")
    blocks = {"TITLE_BLOCK": frame_block()}
    for sheet in sheets:
        pdf.setLineWidth(0.5)
        paint(pdf, sheet.title, Fit(1.0, 0.0, 0.0), blocks)
        pdf.setLineWidth(0.35)
        paint(pdf, sheet.view, fit_view(sheet.view), blocks)
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def rasterise(vector_pdf: bytes, sheets: list[Sheet]) -> tuple[list[bytes], bytes]:
    """One greyscale PNG per sheet at RASTER_DPI, skewed and speckled, and the PDF that binds them."""
    import pypdfium2 as pdfium

    rng = np.random.default_rng(NOISE_SEED)
    document = pdfium.PdfDocument(vector_pdf)
    pngs: list[bytes] = []
    pages: list[Image.Image] = []
    for index in range(len(sheets)):
        page = document[index]
        rendered = page.render(scale=RASTER_DPI / 72, grayscale=True).to_pil().convert("L")
        page.close()
        skewed = rendered.rotate(SKEW_DEG, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=255)
        pixels = np.array(skewed)
        flat = pixels.reshape(-1)
        specks = round(NOISE_FRACTION * flat.size)
        where = rng.choice(flat.size, size=specks, replace=False)
        flat[where] = rng.integers(0, 64, size=specks, dtype=np.uint8)
        image = Image.fromarray(pixels.reshape(skewed.size[1], skewed.size[0]), mode="L")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=False, compress_level=6)
        pngs.append(buffer.getvalue())
        pages.append(image)
    document.close()

    buffer = io.BytesIO()
    pdf = new_canvas(buffer, f"{FIXTURE} SAMPLE raster scan")
    width, height = page_size_pt()
    for image in pages:
        pdf.drawImage(ImageReader(image), 0, 0, width=width, height=height)
        pdf.showPage()
    pdf.save()
    return pngs, buffer.getvalue()


# ---------------------------------------------------------------------------------------------
# The hand takeoff golden: L-FRM-02 concrete and L-FRM-03 formwork from the inputs alone.
# ---------------------------------------------------------------------------------------------


def dec(value: Any) -> Decimal:
    return Decimal(str(value))


def spelled(amount: Decimal) -> str:
    return format(amount.quantize(QUANTUM, rounding=ROUND_HALF_EVEN), "f")


def golden_rows() -> list[dict[str, str]]:
    heights = {level["name"]: dec(level["storey_height_m"]) for level in INPUTS["levels"]}
    order = [level["name"] for level in INPUTS["levels"]]
    totals: dict[tuple[str, str, str], Decimal] = {}
    formulas: dict[tuple[str, str], str] = {}

    def add(cls: str, kind: str, level: str, amount: Decimal, formula: str) -> None:
        totals[cls, kind, level] = totals.get((cls, kind, level), Decimal(0)) + amount
        formulas[cls, kind] = formula

    for column in INPUTS["columns"]:
        b, d, count = dec(column["b_mm"]) / MM, dec(column["d_mm"]) / MM, dec(column["count"])
        for level in column["levels"]:
            add(
                "COLUMN",
                "RCC_CONCRETE",
                level,
                count * b * d * heights[level],
                "sum(count * b * d * storey_height)",
            )
            add(
                "COLUMN",
                "FORMWORK",
                level,
                count * 2 * (b + d) * heights[level],
                "sum(count * 2 * (b + d) * storey_height)",
            )
    for beam in INPUTS["beams"]:
        b, d, span, count = (
            dec(beam["b_mm"]) / MM,
            dec(beam["d_mm"]) / MM,
            dec(beam["span_m"]),
            dec(beam["count"]),
        )
        for level in beam["levels"]:
            add("BEAM", "RCC_CONCRETE", level, count * b * d * span, "sum(count * b * d * span)")
            add("BEAM", "FORMWORK", level, count * (2 * d + b) * span, "sum(count * (2 * d + b) * span)")
    for slab in INPUTS["slab"]:
        net = dec(slab["area_m2"]) - dec(slab["openings_m2"])
        add(
            "SLAB",
            "RCC_CONCRETE",
            slab["level"],
            net * (dec(slab["thickness_mm"]) / MM),
            "(area - openings) * thickness",
        )
        add("SLAB", "FORMWORK", slab["level"], net, "area - openings")
    for cls, family in (("FOOTING", "footings"), ("PILE_CAP", "pile_caps")):
        for item in INPUTS[family]:
            length, b, depth, count = (
                dec(item["l_mm"]) / MM,
                dec(item["b_mm"]) / MM,
                dec(item["depth_mm"]) / MM,
                dec(item["count"]),
            )
            add(cls, "RCC_CONCRETE", "FDN", count * length * b * depth, "sum(count * l * b * depth)")
            add(cls, "FORMWORK", "FDN", count * 2 * (length + b) * depth, "sum(count * 2 * (l + b) * depth)")
    for tie in INPUTS["tie_beams"]:
        b, d, span, count = (
            dec(tie["b_mm"]) / MM,
            dec(tie["d_mm"]) / MM,
            dec(tie["span_m"]),
            dec(tie["count"]),
        )
        add("TIE_BEAM", "RCC_CONCRETE", "FDN", count * b * d * span, "sum(count * b * d * span)")
        add("TIE_BEAM", "FORMWORK", "FDN", count * (2 * d + b) * span, "sum(count * (2 * d + b) * span)")

    classes = ["FOOTING", "PILE_CAP", "TIE_BEAM", "COLUMN", "BEAM", "SLAB"]
    kinds = {"RCC_CONCRETE": "m3", "FORMWORK": "m2"}
    rows: list[dict[str, str]] = []
    for cls in classes:
        for kind, unit in kinds.items():
            for level in order:
                amount = totals.get((cls, kind, level))
                if amount is None:
                    continue
                rows.append(
                    {
                        "class": cls,
                        "kind": kind,
                        "level": level,
                        "quantity": spelled(amount),
                        "unit": unit,
                        "formula": formulas[cls, kind],
                    }
                )
    return rows


# ---------------------------------------------------------------------------------------------
# The corpus, assembled in memory and written only once every file exists.
# ---------------------------------------------------------------------------------------------


def dumps(document: Any) -> bytes:
    return (json.dumps(document, indent=2) + "\n").encode("utf-8")


def build(scratch: Path) -> list[tuple[str, bytes]]:
    sheets = author_sheets()
    dxf, sanity = write_dxf(sheets, scratch)
    dwg = mint_dwg(scratch / "rcc6.dxf", scratch)
    vector_pdf = write_vector_pdf(sheets)
    pngs, raster_pdf = rasterise(vector_pdf, sheets)
    png_paths = [f"raster/{sheet.slug}.png" for sheet in sheets]

    manifest = {
        "fixture": FIXTURE,
        "generator": {
            "path": GENERATOR_REL,
            "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        },
        "sheets": [
            {
                "name": sheet.name,
                "slug": sheet.slug,
                "page": {"width_mm": PAGE_MM[0], "height_mm": PAGE_MM[1]},
            }
            for sheet in sheets
        ],
        "raster": {
            "dpi": RASTER_DPI,
            "skew_deg": SKEW_DEG,
            "noise_seed": NOISE_SEED,
            "noise_fraction": NOISE_FRACTION,
        },
        "files": [
            "rcc6.dxf",
            "rcc6.dwg",
            "rcc6.pdf",
            "rcc6.raster.pdf",
            *png_paths,
            "inputs.json",
            "takeoff.golden.json",
            "sanity.json",
            "manifest.json",
        ],
    }
    golden = {"fixture": FIXTURE, "provenance": "HAND_FROM_AUTHORED_SOURCE", "rows": golden_rows()}
    return [
        ("rcc6.dxf", dxf),
        ("rcc6.dwg", dwg),
        ("rcc6.pdf", vector_pdf),
        ("rcc6.raster.pdf", raster_pdf),
        *zip(png_paths, pngs, strict=True),
        ("inputs.json", dumps(INPUTS)),
        ("takeoff.golden.json", dumps(golden)),
        ("sanity.json", dumps({"generator": GENERATOR_REL, "drawn": sanity})),
        ("manifest.json", dumps(manifest)),
    ]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "rcc6")
    args = parser.parse_args(argv)
    out_dir: Path = args.out
    try:
        with tempfile.TemporaryDirectory(prefix="rcc6-gen-") as scratch:
            files = build(Path(scratch))
        out_dir.mkdir(parents=True, exist_ok=True)
        for relative, payload in files:
            target = out_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            print(f"wrote {relative} sha256={hashlib.sha256(payload).hexdigest()}")
    except Exception as error:
        print(f"rcc6.py: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
