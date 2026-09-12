"""S-19 to S-21 — the slabs: the first floor, the typical floor, and the roof with its parapet.

The panels, their holes and their bars all come out of `model.build()`; the sheets differ only in
how the office spelled the same bar call — unicode on one sheet, mojibake on the next.
"""

from __future__ import annotations

from typing import Any

from ... import model as M
from ..scene import Scene
from ..scene import Sheet as _Sheet
from .common import (
    Ctx,
    authored,
    draw_columns,
    draw_core_and_stair,
    draw_grid,
    draw_slab_outline,
    f,
    fact,
    new_paper,
)


def _centroid(poly: list[Any]) -> tuple[float, float]:
    xs = [f(x) for x, _ in poly]
    ys = [f(y) for _, y in poly]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def _panels(ctx: Ctx, level: str, view: Scene, *, marks: bool = True) -> None:
    for m in sorted(ctx.at("SLAB", level), key=lambda m: m["id"]):
        poly = [(f(x), f(y)) for x, y in m["poly"]]
        view.poly(poly, "S-SLAB")
        if marks:
            cx, cy = _centroid(m["poly"])
            view.text(m["mark"], (cx, cy), 240.0, "S-TEXT", align="MIDDLE_CENTER", family="mark")
            view.text(f"{int(f(m['t']))} THK", (cx, cy - 400.0), 190.0, "S-TEXT2",
                      family="thickness", fact=fact(m, "t"))


def s19(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-19")
    view = Scene()
    draw_grid(view, dims=True, unit="ftin")
    draw_slab_outline(view, "1F")
    draw_columns(view, ctx, "1F")
    draw_core_and_stair(view)
    _panels(ctx, "1F", view)
    # the bar call with a real Ø, the way the CAD operator typed it (T-NOT-UNICODE)
    t = f(M.SLAB_T["S"])
    dia, spacing = M.SLAB_BARS[125]
    uni = view.text(f"{dia}Ø @ {spacing} c/c B/W", (f(M.X["1"]) + 600.0, f(M.Y["A"]) + 2600.0),
                    240.0, "S-TEXT", family="diameter", fact=authored(spacing),
                    trap="T-NOT-UNICODE")
    uni["role"] = "unicode"
    view.text(f"{int(t)} THK", (f(M.X["1"]) + 600.0, f(M.Y["A"]) + 2100.0), 240.0,
              "S-TEXT", family="thickness", fact=authored(t))
    view.text("SLAB THICKNESS U.N.O.", (f(M.X["1"]) + 1800.0, f(M.Y["A"]) + 2100.0), 240.0, "S-TEXT")
    # the sleeves that are too small to deduct beside the ducts that are not (T-SLEEVE-BELOW)
    sw, sh = f(M.SLEEVE_SIZE[0]), f(M.SLEEVE_SIZE[1])
    for i, (x, y) in enumerate(M.SLEEVES):
        item = view.rect(f(x), f(y), sw, sh, "S-SLAB")
        if i == 0:
            item["trap"] = "T-SLEEVE-BELOW"
        view.text("SLEEVE 150x150", (f(x) + sw + 150.0, f(y)), 170.0, "S-TEXT2", family="plain")
    dw, dh = f(M.DUCT_SIZE[0]), f(M.DUCT_SIZE[1])
    for x, y in M.DUCTS:
        view.rect(f(x), f(y), dw, dh, "S-SLAB")
        view.text("DUCT 600x1200", (f(x) + dw + 150.0, f(y)), 170.0, "S-TEXT2", family="plain")
    # the sunken slabs
    for x, y in M.SUNKEN:
        view.rect(f(x), f(y), f(M.SUNKEN_SIZE[0]), f(M.SUNKEN_SIZE[1]), "S-SLAB")
        view.text(f"SUNK {int(f(M.SUNKEN_DROP))}", (f(x) + 200.0, f(y) + 200.0), 180.0, "S-TEXT2",
                  fact=authored(M.SUNKEN_DROP))
    # the balcony's top bars
    view.text("BALCONY TOP BARS 12%%C @ 125 c/c, L/3 INTO THE SLAB",
              (f(M.BALCONY["x0"]), -f(M.BALCONY["depth"]) - 1400.0), 220.0, "S-TEXT2")
    # the xref nobody rebound: the INSERT resolves to nothing (T-XREF-UNRESOLVED)
    xref = view.insert("ARCH-PLAN", (f(M.X["1"]), f(M.Y["A"])), "S-LINE")
    xref["trap"] = "T-XREF-UNRESOLVED"
    view.text("XREF arch-plan.dwg (NOT FOUND)", (f(M.X["1"]) + 600.0, f(M.Y["E"]) + 1200.0), 220.0,
              "S-TEXT2")
    for mark in ctx.marks_for("S-19"):
        cx, cy = (f(M.X["2"]) + 400.0, f(M.Y["C"]) - 900.0 - 500.0 * ctx.marks_for("S-19").index(mark))
        view.text(mark, (cx, cy), 220.0, "S-TEXT", family="mark")
    p.view("1ST FLOOR SLAB REINFORCEMENT PLAN", view, 100, (p.x0 + 60.0, p.y0 + 120.0),
           (400.0, 340.0), "ftin")
    p.scale_bar((p.x0 + 60.0, p.y0 + 30.0), "m")
    return p.sheet()


def s20(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-20")
    view = Scene()
    draw_grid(view, dims=True, unit="ftin")
    draw_slab_outline(view, "2F")
    draw_columns(view, ctx, "2F")
    draw_core_and_stair(view)
    _panels(ctx, "2F", view)
    # the caption that names no floor range at all — the index on S-00 says which (T-NOT-RANGE-UNSTATED)
    cap = view.text("TYPICAL SLAB REINFORCEMENT PLAN", (f(M.X["3"]), -4600.0), 340.0, "S-TEXT",
                    align="CENTER", family="range", trap="T-NOT-RANGE-UNSTATED")
    cap["role"] = "range-unstated"
    # the same bar call, mangled by a CP1252 round trip (T-NOT-MOJIBAKE)
    mj = view.text("10mm âˆ… @ 150 c/c ALT. CRANKED",
                   (f(M.X["1"]) + 600.0, f(M.Y["A"]) + 2600.0), 240.0, "S-TEXT",
                   family="diameter", fact=authored(150), trap="T-NOT-MOJIBAKE")
    mj["role"] = "mojibake"
    # S3's outline, drawn open and 1 mm short, with a stray Z (T-GAP-OUTLINE)
    s3 = next(m for m in ctx.at("SLAB", "2F") if m["mark"] == "S3")
    poly = [(f(x), f(y)) for x, y in s3["poly"]]
    gap = list(poly) + [(poly[0][0] + 1.0, poly[0][1])]
    item = view.poly(gap, "S-SLAB", closed=False, elevation=0.001)
    item["trap"] = "T-GAP-OUTLINE"
    view.text("S3 OUTLINE (SEE THE PANEL SCHEDULE)", (poly[0][0] + 300.0, poly[0][1] + 300.0),
              200.0, "S-TEXT2")
    for mark in ctx.marks_for("S-20"):
        m = next((x for x in ctx.at("SLAB", "2F") if x["mark"] == mark), ctx.by_mark[mark][0])
        cx, cy = _centroid(m["poly"])
        view.text(mark, (cx + 500.0, cy + 500.0), 220.0, "S-TEXT2", family="mark")
    p.view("TYPICAL SLAB REINFORCEMENT PLAN", view, 100, (p.x0 + 60.0, p.y0 + 120.0),
           (400.0, 340.0), "ftin")
    p.scale_bar((p.x0 + 60.0, p.y0 + 30.0), "m")
    return p.sheet()


def s21(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-21")
    view = Scene()
    draw_grid(view, dims=True, unit="ftin")
    draw_slab_outline(view, "ROOF")
    draw_columns(view, ctx, "6F")
    draw_core_and_stair(view)
    _panels(ctx, "ROOF", view)
    for m in sorted(ctx.at("SLAB", "SRR"), key=lambda m: m["id"]):
        cx, cy = _centroid(m["poly"])
        view.poly([(f(x), f(y)) for x, y in m["poly"]], "S-SLAB")
        view.text(m["mark"], (cx, cy + 900.0), 240.0, "S-TEXT", align="MIDDLE_CENTER", family="mark")
    outline = [(f(x), f(y)) for x, y in M.outline("ROOF")]
    view.poly(outline, "S-WALL")
    view.text("PP1", (outline[0][0] + 1200.0, outline[0][1] + 400.0), 240.0, "S-TEXT", family="mark")
    view.text(f"PARAPET {M.PARAPET['t']} THK x {f(M.PARAPET['h']):.0f} HIGH",
              (outline[0][0] + 1200.0, outline[0][1] - 200.0), 220.0, "S-TEXT2",
              fact=authored(M.PARAPET["h"]))
    p.view("ROOF & STAIR ROOF PLAN", view, 100, (p.x0 + 40.0, p.y0 + 120.0), (380.0, 340.0), "ftin")

    det = Scene()
    t, hgt = f(M.PARAPET["t"]), f(M.PARAPET["h"])
    det.rect(0.0, 0.0, t, hgt, "S-WALL")
    det.rect(-200.0, -f(M.SLAB_T["R"]), 900.0, f(M.SLAB_T["R"]), "S-SLAB")
    det.line((t / 2, 0.0), (t / 2, hgt - 40.0), "S-ROD")
    det.text(f"{M.PARAPET['bars'][0][0]}%%C @ {M.PARAPET['bars'][0][1]} VERT.", (t + 200.0, hgt * 0.7),
             60.0, "S-TEXT2", family="diameter", fact=authored(M.PARAPET["bars"][0][1]))
    det.text(f"{M.PARAPET['bars'][1][0]}%%C @ {M.PARAPET['bars'][1][1]} HORIZ.", (t + 200.0, hgt * 0.5),
             60.0, "S-TEXT2", family="diameter", fact=authored(M.PARAPET["bars"][1][1]))
    det.dim((0.0, 0.0), (0.0, hgt), (-400.0, 0.0), 90.0, 60.0, "S-DIMS", fact=authored(hgt))
    p.view("PARAPET DETAIL", det, 20, (p.x0 + 450.0, p.y0 + 200.0), (120.0, 200.0), "mm")
    p.scale_bar((p.x0 + 40.0, p.y0 + 30.0), "m")
    return p.sheet()
