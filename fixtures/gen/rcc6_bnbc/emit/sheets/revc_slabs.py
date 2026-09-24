"""Rev C on the slab sheets S-19 to S-21 (R0-G2, design §6): the slab panel schedules the plans point
at, the typical floor's two ducts, the stair and machine-room roofs' thicknesses and the overhead
tank's outline over the stair roof (W-44..W-47).

The three schedules print each panel mark of the floors their sheet draws once, from the model's own
bars: the bottom bars both ways and the extra top bars at the spacing `model.SLAB_BARS` gives the
panel's thickness (the two-way rule the model cuts every such panel by), the one-way and cantilever
panels at the spacing their own bars were counted at — each spacing checked against the bars' own
counts, so a model that moves a spacing moves the schedule or stops the generator. A panel the model
gives no bars (the floor landing FL) prints none.
"""

from __future__ import annotations

from typing import Any

from ... import model as M
from ..scene import APPENDED, Scene, Sheet
from .common import Ctx, authored, f, fact, table
from .revc import add_view, view_of

#: The schedule's columns and their widths (mm at 1:50): a mark, its thickness, the bottom bars across
#: the short and the long span, the extra top bars, the distribution bars, and what else it is.
HEADER = ["MARK", "THK", "SHORT SPAN BOT.", "LONG SPAN BOT.", "EXTRA TOP", "DIST.", "REMARKS"]
WIDTHS = [800.0, 700.0, 1600.0, 1600.0, 1600.0, 1300.0, 1200.0]
ROW_H = 450.0
TEXT_H = 150.0

#: The levels each schedule covers, in the order its sheet names them.
SCHEDULES: tuple[tuple[str, str, tuple[str, ...], tuple[float, float], tuple[float, float]], ...] = (
    ("S-19", "SLAB PANEL SCHEDULE (1ST FLOOR)", ("1F",), (490.0, 250.0), (180.0, 220.0)),
    ("S-20", "SLAB PANEL SCHEDULE (TYPICAL FLOOR)", ("2F",), (490.0, 250.0), (180.0, 220.0)),
    ("S-21", "SLAB PANEL SCHEDULE (ROOF & STAIR ROOF)", ("ROOF", "SRR"), (590.0, 180.0), (178.0, 280.0)),
)

#: Spacings a panel's own bar counts are read back against (L-FRM-05's counting rule).
SPACINGS = (100, 125, 150, 175, 200, 250)


def draw(ctx: Ctx, by: dict[str, Sheet]) -> None:
    for number, title, levels, at, size in SCHEDULES:
        schedule(ctx, by[number], title, levels, at, size)
    ducts(ctx, view_of(by["S-20"], "TYPICAL SLAB REINFORCEMENT PLAN").scene)
    roof(ctx, view_of(by["S-21"], "ROOF & STAIR ROOF PLAN").scene)


def bbox_of(poly: list[Any]) -> tuple[Any, Any, Any, Any]:
    xs = [x for x, _ in poly]
    ys = [y for _, y in poly]
    return min(xs), min(ys), max(xs), max(ys)


def _panels(ctx: Ctx, levels: tuple[str, ...]) -> list[dict[str, Any]]:
    """One member per panel mark at the schedule's levels, in the order the model builds them."""
    seen: dict[str, dict[str, Any]] = {}
    for level in levels:
        for m in ctx.at("SLAB", level):
            seen.setdefault(m["mark"], m)
    return list(seen.values())


def _spacing(bar: dict[str, Any], runs: list[Any], per: int = 1) -> int:
    """The one spacing whose count over one of the member's runs, `per` times, is the bar's count."""
    hits = {s for s in SPACINGS for run in runs if per * M.count_at(run, M.D(s)) == bar["n"]}
    assert len(hits) == 1, (bar["member"], bar["bar_mark"], bar["n"], hits)
    return hits.pop()


def _call(bar: dict[str, Any], spacing: int) -> tuple[str, str, dict[str, str]]:
    return (f"{bar['dia']}%%C @ {spacing}", "diameter", authored(spacing))


def row(ctx: Ctx, m: dict[str, Any]) -> list[Any]:
    bars = {b["bar_mark"].split("-", 1)[1]: b for b in ctx.bars if b["member"] == m["id"]}
    x0, y0, x1, y1 = bbox_of(m["poly"])
    c = M.COVER["SLAB"]
    lx, ly = x1 - x0, y1 - y0
    runs = [lx - 2 * c, ly - 2 * c]
    none = ("-", "plain")
    thk = (str(int(f(m["t"]))), "number", fact(m, "t"))
    mark = (m["mark"], "mark")
    if not bars:
        return [mark, thk, none, none, none, none, "LANDING"]
    if "t" in bars and "d" in bars:  # a cantilever: its main bars are its top bars
        return [mark, thk, none, none, _call(bars["t"], _spacing(bars["t"], runs)),
                _call(bars["d"], _spacing(bars["d"], runs)), "CANTILEVER"]
    if "m" in bars:  # one-way: main bars across the short span, distribution along it
        return [mark, thk, _call(bars["m"], _spacing(bars["m"], runs)), none,
                _call(bars["xt"], _spacing(bars["xt"], runs)), _call(bars["d"], _spacing(bars["d"], runs)),
                "ONE WAY"]
    dia, s = M.SLAB_BARS[int(f(m["t"]))]
    for key in ("bx", "cx", "by", "cy", "tx", "ty"):
        assert int(bars[key]["dia"]) == dia, (m["id"], key)
    # bottom bars: half straight, half cranked, together at the panel's spacing; top: two ends
    for axis, run in (("x", ly - 2 * c), ("y", lx - 2 * c)):
        assert bars[f"b{axis}"]["n"] + bars[f"c{axis}"]["n"] == M.count_at(run, M.D(s)), (m["id"], axis)
        assert bars[f"t{axis}"]["n"] == 2 * M.count_at(run, M.D(s)), (m["id"], axis)
    call = (f"{dia}%%C @ {s}", "diameter", authored(s))
    remark = (f"SUNK {int(f(M.SUNKEN_DROP))}", "plain", authored(M.SUNKEN_DROP)) if m.get("sunken") else ""
    return [mark, thk, call, call, call, none, remark]


def schedule(ctx: Ctx, sheet: Sheet, title: str, levels: tuple[str, ...], at: tuple[float, float],
             size: tuple[float, float]) -> None:
    rows = [row(ctx, m) for m in _panels(ctx, levels)]
    sc = Scene()
    sc.text(title, (0.0, 900.0), 240.0, "S-TEXT")
    _table(sc, rows)
    bottom = -ROW_H * (len(rows) + 1)
    sc.text("BOTTOM BARS: ALTERNATE BARS CRANKED AT L/5 (S-03)", (0.0, bottom - 450.0), 130.0, "S-TEXT2")
    sc.text("EXTRA TOP BARS: L/4 EACH SIDE OF THE SUPPORT", (0.0, bottom - 700.0), 130.0, "S-TEXT2")
    add_view(sheet, title, sc, 50, at, size)


def _table(sc: Scene, rows: list[list[Any]]) -> None:
    """A ruled schedule, one TEXT a cell (the table convention `common.table` keeps, drawn at this
    schedule's own row height and lettering)."""
    table(sc, 0.0, 0.0, HEADER, rows, WIDTHS, row_h=ROW_H, h=TEXT_H)


def ducts(ctx: Ctx, plan: Scene) -> None:
    """The two service ducts every framed floor below the roof is cut for (the model deducts them at
    2F..6F as at 1F; S-19 draws them, the typical plan now does too)."""
    holes = [h for m in ctx.at("SLAB", "2F") for h in m.get("holes", []) if h.get("kind") == "DUCT"]
    assert len(holes) == len(M.DUCTS), holes
    dw, dh = f(M.DUCT_SIZE[0]), f(M.DUCT_SIZE[1])
    with plan.revision(APPENDED):
        for x, y in M.DUCTS:
            plan.rect(f(x), f(y), dw, dh, "S-SLAB")
            plan.text(f"DUCT {int(dw)}x{int(dh)}", (f(x) + dw + 150.0, f(y)), 170.0, "S-TEXT2",
                      fact=authored(M.DUCT_SIZE[0]))


def roof(ctx: Ctx, plan: Scene) -> None:
    """The stair and machine-room roofs' thicknesses under their marks, and the overhead tank's
    outline where it stands on the stair roof (its outer faces, dashed: it stands above this plan)."""
    with plan.revision(APPENDED):
        for m in sorted(ctx.at("SLAB", "SRR"), key=lambda m: m["id"]):
            x0, y0, x1, y1 = bbox_of(m["poly"])
            cx, cy = f(x0 + x1) / 2, f(y0 + y1) / 2
            plan.text(f"{int(f(m['t']))} THK", (cx, cy + 500.0), 190.0, "S-TEXT2", align="MIDDLE_CENTER",
                      family="thickness", fact=fact(m, "t"))
        base = ctx.by_id["OHWT-B"]
        x0, y0, x1, y1 = (f(v) for v in bbox_of(base["poly"]))
        corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        for a, b in zip(corners, corners[1:] + corners[:1], strict=True):
            plan.line(a, b, "S-WALL", linetype="DASHED")
        plan.text("OHWT OVER THE STAIR ROOF (SEE S-24)", (x0 + 200.0, y0 + 250.0), 170.0, "S-TEXT2")
