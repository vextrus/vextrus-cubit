"""The scene primitive every sheet is drawn in, and the block library (doors, furniture, the north
arrow). A scene is a list of plain dicts in drawing units; `dxf.py` turns each into one entity.

Model-space blocks are authored in millimetres (a door is its leaf and swing at 1:1); the paper
block (NORTH) in paper millimetres. A block's content is derived paint on the product's side (the
ingest explodes an INSERT), so nothing here is measured.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


def f(v: Any) -> float:
    return float(v)


class Scene:
    """An ordered list of primitives; the order is the order they are written (and handled)."""

    def __init__(self) -> None:
        self.items: list[dict[str, Any]] = []

    def add(self, kind: str, layer: str, **kw: Any) -> dict[str, Any]:
        item = {"kind": kind, "layer": layer, **kw}
        self.items.append(item)
        return item

    def line(self, a: Any, b: Any, layer: str, **kw: Any) -> dict[str, Any]:
        return self.add("LINE", layer, a=(f(a[0]), f(a[1])), b=(f(b[0]), f(b[1])), **kw)

    def poly(self, pts: list[Any], layer: str, closed: bool = True, **kw: Any) -> dict[str, Any]:
        return self.add("LWPOLYLINE", layer, points=[(f(x), f(y)) for x, y in pts], closed=closed, **kw)

    def rect(self, x0: Any, y0: Any, x1: Any, y1: Any, layer: str, **kw: Any) -> dict[str, Any]:
        return self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], layer, **kw)

    def circle(self, c: Any, r: Any, layer: str, **kw: Any) -> dict[str, Any]:
        return self.add("CIRCLE", layer, c=(f(c[0]), f(c[1])), r=f(r), **kw)

    def arc(self, c: Any, r: Any, start: float, end: float, layer: str, **kw: Any) -> dict[str, Any]:
        return self.add("ARC", layer, c=(f(c[0]), f(c[1])), r=f(r), start=start, end=end, **kw)

    def text(self, s: str, at: Any, h: Any, layer: str, align: str = "LEFT", rotation: float = 0.0,
             **kw: Any) -> dict[str, Any]:
        return self.add("TEXT", layer, s=s, at=(f(at[0]), f(at[1])), h=f(h), align=align, rotation=rotation, **kw)

    def mtext(self, raw: str, at: Any, h: Any, layer: str, attach: str = "MIDDLE_CENTER", width: Any = 0,
              **kw: Any) -> dict[str, Any]:
        return self.add("MTEXT", layer, raw=raw, at=(f(at[0]), f(at[1])), h=f(h), attach=attach, width=f(width),
                        **kw)

    def insert(self, block: str, at: Any, layer: str, rotation: float = 0.0, xscale: float = 1.0,
               yscale: float = 1.0, **kw: Any) -> dict[str, Any]:
        return self.add("INSERT", layer, block=block, at=(f(at[0]), f(at[1])), rotation=rotation,
                        xscale=xscale, yscale=yscale, **kw)

    def hatch(self, paths: list[list[Any]], layer: str, solid: bool = True, pattern: str = "ANSI31",
              scale: float = 1.0, **kw: Any) -> dict[str, Any]:
        return self.add("HATCH", layer, paths=[[(f(x), f(y)) for x, y in p] for p in paths], solid=solid,
                        pattern=pattern, scale=scale, **kw)

    def dim(self, p1: Any, p2: Any, base: Any, angle: float, text: str, h: float, layer: str,
            **kw: Any) -> dict[str, Any]:
        return self.add("DIMENSION", layer, p1=(f(p1[0]), f(p1[1])), p2=(f(p2[0]), f(p2[1])),
                        base=(f(base[0]), f(base[1])), angle=angle, text=text, h=h, **kw)

    def leader(self, pts: list[Any], layer: str, **kw: Any) -> dict[str, Any]:
        return self.add("LEADER", layer, points=[(f(x), f(y)) for x, y in pts], **kw)

    def bbox(self) -> tuple[float, float, float, float]:
        xs: list[float] = []
        ys: list[float] = []
        for it in self.items:
            for key in ("a", "b", "c", "at", "p1", "p2", "base"):
                if key in it:
                    xs.append(it[key][0])
                    ys.append(it[key][1])
            for p in it.get("points", []):
                xs.append(p[0])
                ys.append(p[1])
            if it["kind"] in ("CIRCLE", "ARC"):
                xs += [it["c"][0] - it["r"], it["c"][0] + it["r"]]
                ys += [it["c"][1] - it["r"], it["c"][1] + it["r"]]
            if it["kind"] in ("TEXT", "MTEXT"):
                # an estimate of the lettering's own extent, so a window framed on it clips nothing
                lines = (it.get("s") or it.get("raw") or "").split("\\P")
                wide = it.get("width") or max(len(line) for line in lines) * it["h"] * 0.95
                tall = len(lines) * it["h"] * 1.7
                x, y = it["at"]
                where = it.get("align") or it.get("attach") or "LEFT"
                x0 = x - wide / 2 if "CENTER" in where else (x - wide if "RIGHT" in where else x)
                y0 = y - tall / 2 if "MIDDLE" in where else (y - tall if "TOP" in where else y)
                xs += [x0, x0 + wide]
                ys += [y0, y0 + tall]
        return (min(xs), min(ys), max(xs), max(ys))


@dataclass
class Block:
    name: str
    scene: Scene = field(default_factory=Scene)


def _door(name: str, w: Decimal) -> Block:
    """A hinged leaf at 90° and its swing: hinge at the origin, closed along +x, opening toward +y."""
    b = Block(name)
    b.scene.line((0, 0), (0, w), "0")
    b.scene.arc((0, 0), w, 0.0, 90.0, "0")
    return b


def _bed() -> Block:
    b = Block("FURN-BED")
    s = b.scene
    s.rect(-750, -1000, 750, 1000, "0")
    s.rect(-650, 600, -80, 900, "0")
    s.rect(80, 600, 650, 900, "0")
    s.line((-750, 450), (750, 450), "0")
    return b


def _sofa() -> Block:
    b = Block("FURN-SOFA")
    s = b.scene
    s.rect(-1100, -450, 1100, 450, "0")
    s.rect(-1100, 250, 1100, 450, "0")
    s.line((-367, -450), (-367, 250), "0")
    s.line((367, -450), (367, 250), "0")
    return b


def _dining() -> Block:
    b = Block("FURN-DINING")
    s = b.scene
    s.rect(-900, -450, 900, 450, "0")
    for x in (-600, 0, 600):
        s.rect(x - 220, 520, x + 220, 900, "0")
        s.rect(x - 220, -900, x + 220, -520, "0")
    return b


def _north() -> Block:
    b = Block("NORTH")
    s = b.scene
    s.circle((0, 0), 8.0, "0")
    s.poly([(0, 10), (-4, -6), (0, -3), (4, -6)], "0")
    s.text("N", (0, 12), 3.0, "0", align="BOTTOM_CENTER")
    return b


def library(door_widths: list[Decimal]) -> list[Block]:
    """Every block the sheets insert, in a fixed order (the order is written, so it is part of the bytes)."""
    blocks = [_door(door_name(w), w) for w in sorted(set(door_widths))]
    return [*blocks, _bed(), _sofa(), _dining(), _north()]


def door_name(w: Decimal) -> str:
    inches = int((Decimal(w) / Decimal("25.4")).quantize(Decimal(1)))
    return f"DR-{inches // 12}{inches % 12:02d}"
