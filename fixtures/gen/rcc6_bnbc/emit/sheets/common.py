"""Shared composition ground for the 26 sheets: the context, the paper frame, and the plan/table
helpers every sheet module draws with (Wave B D2).

Every printed number comes out of `model.build()` (the `Ctx` below is only an index over it) and is
attached to its TEXT with `fact=`; nothing here restates a dimension of its own.
"""

from __future__ import annotations

import json
from decimal import Decimal
from itertools import pairwise
from pathlib import Path
from typing import Any

from ... import model as M
from ... import selfcheck
from .. import blocks as B
from .. import plan
from ..scene import PAPER_MM, Scene, Sheet, View, ft_in

HERE = Path(__file__).resolve().parents[2]

#: How far a view sits from the window edge, and how tall a caption band is.
MARGIN = 14.0
CAPTION = 16.0


def f(v: Any) -> float:
    return float(v)


def fact(member: dict[str, Any], field: str) -> dict[str, Any]:
    """The `fact=` a TEXT carries when it prints one member's authored field (check 5)."""
    return {"member": member["id"], "field": field, "value": str(member[field])}


def authored(value: Any) -> dict[str, Any]:
    return {"authored": str(value)}


class Ctx:
    """One index over `model.build()` plus the registered traps — the only source a sheet reads."""

    def __init__(self, world: dict[str, Any]) -> None:
        self.world = world
        self.members = world["members"]
        self.by_id = {m["id"]: m for m in self.members}
        self.by_class: dict[str, list[dict[str, Any]]] = {}
        self.by_mark: dict[str, list[dict[str, Any]]] = {}
        for m in self.members:
            self.by_class.setdefault(m["class"], []).append(m)
            self.by_mark.setdefault(m["mark"], []).append(m)
        self.bars = world["bars"]
        self.marks = {m["mark"] for m in self.members}
        self.traps = json.loads((HERE / "traps.json").read_text(encoding="utf-8"))
        self.trap = {t["id"]: t for t in self.traps["traps"]}
        self.schedule_marks = selfcheck.schedule_marks()
        self.stacks = {s["id"]: s for s in M._stacks()}
        self._bbs: dict[str, Any] | None = None

    def at(self, cls: str, level: str) -> list[dict[str, Any]]:
        return [m for m in self.by_class.get(cls, []) if m["level"] == level]

    def one(self, mark: str) -> dict[str, Any]:
        return self.by_mark[mark][0]

    def marks_for(self, number: str) -> list[str]:
        """The marks `selfcheck.schedule_marks()` puts on this sheet that the model really builds."""
        return [m for m in self.schedule_marks.get(number, []) if m in self.marks]

    def bbs(self) -> dict[str, Any]:
        if self._bbs is None:
            path = HERE.parents[2] / "fixtures" / "rcc6-bnbc" / "bbs.golden.json"
            self._bbs = json.loads(path.read_text(encoding="utf-8"))
        return self._bbs


# -- the paper frame ----------------------------------------------------------------------------


class Paper:
    """A sheet's paper-space scene under construction, in paper millimetres."""

    def __init__(self, ctx: Ctx, number: str, title: str, size: str, scales: str, kind: str) -> None:
        self.ctx = ctx
        self.number = number
        self.title = title
        self.size = size
        self.scales = scales
        self.kind = kind
        self.scene = Scene()
        self.views: list[View] = []
        w, h = PAPER_MM[size]
        self.w, self.h = w, h
        self.scene.rect(B.BORDER, B.BORDER, w - 2 * B.BORDER, h - 2 * B.BORDER, "S-SHEET")
        self.title_item = B.title_strip(self.scene, size, number, title, scales, "B")
        self.x0, self.y0, self.win_w, self.win_h = B.window(size)
        self.key_plan: dict | None = None
        if kind == "plan":
            self.scene.insert("NORTH_ARROW", (self.x0 + self.win_w - 18.0, self.y0 + self.win_h - 14.0), "S-ARROW")
            kx = self.x0 + self.win_w - 46.0
            self.key_plan = self.scene.insert("KEY_PLAN", (kx, self.y0 + 14.0), "S-SHEET")
            # this sheet's own area, hatched on the key plan (T-KEYPLAN)
            gx = [f(M.X[n]) / 1000.0 for n in M.XN]
            gy = [f(M.Y[n]) / 1000.0 for n in M.YL]
            self.scene.hatch(
                [[(kx + gx[0], self.y0 + 14.0 + gy[0]), (kx + gx[-1], self.y0 + 14.0 + gy[0]),
                  (kx + gx[-1], self.y0 + 14.0 + gy[-1]), (kx + gx[0], self.y0 + 14.0 + gy[-1])]],
                "S-HATCH", pattern="ANSI31", scale=1.5,
            )

    # -- captions and instruments ---------------------------------------------------------------

    def caption(self, text: str, at: tuple[float, float], h: float = 4.0) -> dict:
        return self.scene.text(text, at, h, "S-SHEET")

    def scale_bar(self, at: tuple[float, float], unit: str = "m") -> None:
        self.scene.insert("SCALE_BAR", at, "S-SHEET", attribs={"UNIT": unit})

    def view(
        self,
        title: str,
        scene: Scene,
        scale: int,
        at: tuple[float, float],
        size: tuple[float, float],
        unit: str = "ftin",
        caption: str | None = None,
    ) -> View:
        """Frame a 1:1 scene into a window on the paper, centred on the scene's own extents."""
        x0, y0, x1, y1 = scene.bbox()
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        origin = (cx - size[0] * scale / 2, cy - size[1] * scale / 2)
        v = View(title, scene, scale, at, size, origin, (0.0, 0.0), unit)
        self.views.append(v)
        text = caption if caption is not None else f"{title}  SCALE 1:{scale}"
        self.caption(text, (at[0], at[1] - 6.0), 4.0)
        return v

    def sheet(self) -> Sheet:
        return Sheet(self.number, self.title, self.size, self.views, self.scene, self.scales, "B")


def new_paper(ctx: Ctx, number: str) -> Paper:
    number_, title, size, scales, kind, _traps = next(s for s in plan.SHEETS if s[0] == number)
    return Paper(ctx, number_, title, size, scales, kind)


# -- plan furniture ------------------------------------------------------------------------------

GX = [(n, f(M.X[n])) for n in M.XN]
GY = [(n, f(M.Y[n])) for n in M.YL]
BLD_W = GX[-1][1] - GX[0][1]
BLD_H = GY[-1][1] - GY[0][1]


def draw_grid(s: Scene, *, dims: bool = True, unit: str = "ftin", bubbles: bool = True) -> dict:
    """Grid lines, a GRID_BUBBLE per axis (circle + ATTRIB), and the bay dimensions outside them.

    A plan dimensions in feet-inches (W-08): the string is authored from the measured millimetres
    through `ft_in()`, so the drawn text and the drawn geometry are the same fact twice."""
    x0, x1 = GX[0][1] - 2200.0, GX[-1][1] + 2200.0
    y0, y1 = GY[0][1] - 2200.0, GY[-1][1] + 2200.0
    for n, x in GX:
        s.line((x, y0), (x, y1), "S-GRID")
        if bubbles:
            b = s.insert("GRID_BUBBLE", (x, y1 + 500.0), "S-GRIDC", attribs={"GRID": n})
            b["family"] = "grid"
    for n, y in GY:
        s.line((x0, y), (x1, y), "S-GRID")
        if bubbles:
            b = s.insert("GRID_BUBBLE", (x0 - 500.0, y), "S-GRIDC", attribs={"GRID": n})
            b["family"] = "grid"
    out: dict[tuple[str, str], dict] = {}
    if not dims:
        return out
    layer = "S-DIMI" if unit == "ftin" else "S-DIMS"
    base = y1 + 1600.0
    for (na, a), (nb, b) in pairwise(GX):
        out[(na, nb)] = s.dim((a, y1), (b, y1), (a, base), 0.0, 220.0, layer,
                              text=ft_in(b - a) if unit == "ftin" else None,
                              fact=authored(_mm(b - a)))
    left = x0 - 1600.0
    for (na, a), (nb, b) in pairwise(GY):
        out[(na, nb)] = s.dim((x0, a), (x0, b), (left, a), 90.0, 220.0, layer,
                              text=ft_in(b - a) if unit == "ftin" else None,
                              fact=authored(_mm(b - a)))
    return out


def _mm(v: float) -> str:
    """A measured millimetre span, spelled the way `model` spells its own Decimals."""
    return str(Decimal(repr(v)).normalize())


def draw_columns(s: Scene, ctx: Ctx, level: str, *, hatch: bool = False, tags: bool = False) -> list[dict]:
    """Every column at a storey, from its authored plan rectangle."""
    out = []
    for m in sorted(ctx.at("COLUMN", level), key=lambda m: m["id"]):
        stack = ctx.stacks[m["stack"]]
        poly = [(f(x), f(y)) for x, y in M.column_poly(stack, level)]
        if stack.get("circular"):
            item = s.circle((f(m["cx"]), f(m["cy"])), f(m["b"]) / 2, "S-COLS")
        else:
            item = s.poly(poly, "S-COLS")
        out.append(item)
        if hatch:
            s.hatch([poly], "S-HATCH", pattern="ANSI31", scale=40.0)
        if tags:
            tag = s.insert("COL_TAG", (f(m["cx"]) + 900.0, f(m["cy"]) + 900.0), "S-GRIDT",
                           attribs={"MARK": f"{m['mark'][0]}-{m['mark'][1:]}"})
            tag["family"] = "mark"
    return out


def beam_pair(s: Scene, m: dict[str, Any], layer: str = "S-BEAM", linetype: str | None = None) -> None:
    """A beam in plan: the two faces of its authored width about its authored axis."""
    (ax, ay), (bx, by) = [(f(p[0]), f(p[1])) for p in (m["p0"], m["p1"])]
    w = f(m["b"])
    dx, dy = bx - ax, by - ay
    ln = (dx * dx + dy * dy) ** 0.5 or 1.0
    nx, ny = -dy / ln * w / 2, dx / ln * w / 2
    s.line((ax + nx, ay + ny), (bx + nx, by + ny), layer, linetype=linetype)
    s.line((ax - nx, ay - ny), (bx - nx, by - ny), layer, linetype=linetype)


def beam_mark(s: Scene, m: dict[str, Any], *, rotation: float = 0.0, layer: str = "S-TEXT") -> dict:
    (ax, ay), (bx, by) = [(f(p[0]), f(p[1])) for p in (m["p0"], m["p1"])]
    mx, my = (ax + bx) / 2, (ay + by) / 2
    rot = rotation if rotation else (0.0 if m["axis"] == "x" else 90.0)
    return s.text(m["mark"], (mx, my + 160.0), 220.0, layer, align="MIDDLE_CENTER",
                  rotation=rot, family="mark")


def draw_slab_outline(s: Scene, level: str, layer: str = "S-SLAB") -> dict:
    poly = [(f(x), f(y)) for x, y in M.outline(level)]
    return s.poly(poly, layer)


def draw_core_and_stair(s: Scene, *, text: bool = True) -> None:
    c = M.CORE
    x0, y0, x1, y1 = f(c["x0"]), f(c["y0"]), f(c["x1"]), f(c["y1"])
    t = f(c["t_low"])
    s.rect(x0, y0, x1 - x0, y1 - y0, "S-WALL")
    s.rect(x0 + t, y0 + t, x1 - x0 - 2 * t, y1 - y0 - 2 * t, "S-WALL")
    st = M.STAIR
    sx0, sy0, sx1, sy1 = f(st["x0"]), f(st["y0"]), f(st["x1"]), f(st["y1"])
    s.rect(sx0, sy0, sx1 - sx0, sy1 - sy0, "S-SLAB")
    if text:
        s.text("LIFT CORE", ((x0 + x1) / 2, (y0 + y1) / 2), 200.0, "S-TEXT", align="MIDDLE_CENTER")
        s.text("STAIR", ((sx0 + sx1) / 2, (sy0 + sy1) / 2), 200.0, "S-TEXT", align="MIDDLE_CENTER")


# -- tables ---------------------------------------------------------------------------------------


def table(
    s: Scene,
    x: float,
    y: float,
    header: list[str],
    rows: list[list[Any]],
    widths: list[float],
    row_h: float = 700.0,
    h: float = 240.0,
    layer: str = "S-TEXT",
) -> None:
    """A ruled schedule: every cell an original TEXT (a cell may carry (text, family, fact, trap))."""
    total = sum(widths)
    lines = [[(c, "plain", None, None) for c in header], *[[_cell(c) for c in r] for r in rows]]
    for r in range(len(lines) + 1):
        s.line((x, y - r * row_h), (x + total, y - r * row_h), "S-LINE")
    cx = x
    for w in [*widths, 0.0]:
        s.line((cx, y), (cx, y - len(lines) * row_h), "S-LINE")
        cx += w
    for r, cells in enumerate(lines):
        cx = x
        for (text, family, fct, trp), w in zip(cells, widths, strict=True):
            if text != "":
                s.text(str(text), (cx + 80.0, y - (r + 1) * row_h + row_h * 0.3), h, layer,
                       family=family, fact=fct, trap=trp)
            cx += w


def _cell(c: Any) -> tuple[str, str, Any, Any]:
    if isinstance(c, tuple):
        return (c[0], c[1] if len(c) > 1 else "plain", c[2] if len(c) > 2 else None,
                c[3] if len(c) > 3 else None)
    return (str(c), "plain", None, None)


def size_text(b: Any, d: Any) -> str:
    return f"{int(f(b))}x{int(f(d))}"


def level_text(mm: Any) -> str:
    return f"EL {ft_in(f(mm))}"


def dec(v: Any, places: int = 0) -> str:
    q = Decimal(str(v)).quantize(Decimal(1) if places == 0 else Decimal("1." + "0" * places))
    return str(q)
