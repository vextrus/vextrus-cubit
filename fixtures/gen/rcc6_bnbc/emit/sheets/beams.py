"""S-13 to S-18 — the framing: three beam layouts and three sheets of long sections.

The layouts are drawn from the members at their own level; the long-section strips are drawn from
the bars the model authored for that member, so a printed bar call is never invented here.
"""

from __future__ import annotations

from typing import Any

from ... import model as M
from .. import blocks as B
from ..scene import Scene, bulge_for_arc
from ..scene import Sheet as _Sheet
from .common import (
    Ctx,
    authored,
    beam_mark,
    beam_pair,
    draw_columns,
    draw_core_and_stair,
    draw_grid,
    draw_slab_outline,
    f,
    fact,
    new_paper,
    table,
)


def bar_set(ctx: Ctx, m: dict[str, Any]) -> tuple[Any, Any, Any]:
    """The top, bottom and stirrup bars the model authored for one member, by its own bar marks."""
    bars = [x for x in ctx.bars if x["member"] == m["id"]]

    def pick(*suffixes: str) -> Any:
        for suffix in suffixes:
            for bar in bars:
                if bar["bar_mark"].endswith(suffix):
                    return bar
        return None

    return (pick("-t", "-tx1", "-tx"), pick("-b", "-bx"), pick("-s"))


def spacing(bar: dict[str, Any]) -> int:
    """A stirrup's authored end-zone spacing (never a habit of this module's own)."""
    zones = bar.get("zones")
    if zones:
        return int(f(zones[0]["spacing_mm"]))
    return 150


STRIP_COLS = 6
STRIP_PITCH_X = 5800.0
STRIP_PITCH_Y = 2600.0
STRIP_LENGTH = 5200.0


def _beams(ctx: Ctx, level: str) -> list[dict[str, Any]]:
    return sorted(ctx.at("BEAM", level), key=lambda m: m["id"])


def _layout(ctx: Ctx, view: Scene, level: str, *, hidden: bool = False) -> None:
    draw_grid(view, dims=True, unit="ftin")
    draw_slab_outline(view, level)
    draw_columns(view, ctx, level if level != "ROOF" else "6F", hatch=True)
    for m in _beams(ctx, level):
        beam_pair(view, m, "S-BEAM")
    draw_core_and_stair(view)


def s13(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-13")
    # the mini key plan the reader must not georeference (T-KEYPLAN)
    if p.key_plan is not None:
        p.key_plan["trap"] = "T-KEYPLAN"
    view = Scene()
    _layout(ctx, view, "1F")
    marked: set[str] = set()
    for m in _beams(ctx, "1F"):
        if m["mark"] in marked:
            continue
        marked.add(m["mark"])
        beam_mark(view, m)
    # the transfer girder, called out where it carries the floating column
    tg = next(m for m in _beams(ctx, "1F") if m["mark"] == "TG1")
    rotated = beam_mark(view, tg, rotation=90.0, layer="S-TEXT2")
    rotated["trap"] = "T-TEXT-ROTATED"
    view.text(f"TG1 {int(f(tg['b']))}x{int(f(tg['depth']))} TRANSFER GIRDER UNDER C5",
              (f(tg["p0"][0]), f(tg["p0"][1]) + 900.0), 220.0, "S-TEXT2", fact=fact(tg, "b"))
    # a level, printed upside down where the draughtsman's UCS was flipped (T-TEXT-ROTATED)
    view.text(f"EL +{f(M.ELEV['1F']) / 1000:.3f}", (f(M.X["5"]), f(M.Y["B"]) - 1400.0), 240.0,
              "S-TEXT2", rotation=180.0, family="level", fact=authored(M.ELEV["1F"]))
    # beams below the slab, drawn on the HIDDEN linetype (T-LINETYPE-HIDDEN)
    for x, y in M.SUNKEN[:2]:
        h = view.line((f(x), f(y)), (f(x) + f(M.SUNKEN_SIZE[0]), f(y)), "S-BEAMH", linetype="HIDDEN")
        h["trap"] = "T-LINETYPE-HIDDEN"
        view.line((f(x), f(y) + f(M.SUNKEN_SIZE[1])), (f(x) + f(M.SUNKEN_SIZE[0]),
                  f(y) + f(M.SUNKEN_SIZE[1])), "S-BEAMH", linetype="HIDDEN")
    view.text("BEAM UNDER SUNKEN SLAB (HIDDEN)", (f(M.SUNKEN[0][0]), f(M.SUNKEN[0][1]) - 700.0),
              200.0, "S-TEXT2")
    # the curved balcony edge beam, a bulged polyline
    bx0, bx1 = f(M.BALCONY["x0"]), f(M.BALCONY["x1"])
    depth, r = f(M.BALCONY["depth"]), f(M.BALCONY["r"])
    curve = view.poly([(bx0, -depth), (bx1 - r, -depth), (bx1, -depth + r)], "S-BEAM",
                      closed=False, bulges=[0.0, bulge_for_arc(-90.0), 0.0])
    curve["role"] = "curved-edge"
    view.text("1EB2 CURVED EDGE BEAM R 1524", (bx0 + 2000.0, -depth - 700.0), 220.0, "S-TEXT2")
    # the architect's background, bound into this drawing (T-XREF-BOUND)
    B.bound_xref_content(view, f(M.X["1"]) + 1200.0, f(M.Y["A"]) + 1600.0)
    for item in view.items:
        if item["layer"] == "X-WALL" and item["kind"] == "LINE":
            item["trap"] = "T-XREF-BOUND"
            break
    p.view("1ST FLOOR BEAM LAYOUT", view, 100, (p.x0 + 60.0, p.y0 + 120.0), (400.0, 340.0), "ftin")
    p.scale_bar((p.x0 + 60.0, p.y0 + 30.0), "m")
    return p.sheet()


def s14(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-14")
    view = Scene()
    _layout(ctx, view, "2F")
    marked: set[str] = set()
    for m in _beams(ctx, "2F"):
        if m["mark"] in marked:
            continue
        marked.add(m["mark"])
        beam_mark(view, m)
    # the caption that stands for five levels at once (T-NOT-RANGE)
    rng = view.text("(2ND TO 6TH FLOOR)", (f(M.X["3"]), -5200.0), 340.0, "S-TEXT",
                    align="CENTER", family="range", trap="T-NOT-RANGE")
    rng["role"] = "range"
    view.text("TYPICAL FLOOR BEAM LAYOUT", (f(M.X["3"]), -4600.0), 380.0, "S-TEXT", align="CENTER")
    # the scheme this sheet replaced, left behind on a frozen layer (T-LAYER-FROZEN)
    for m in _beams(ctx, "2F")[:14]:
        (ax, ay), (bx, by) = [(f(q[0]), f(q[1])) for q in (m["p0"], m["p1"])]
        old = view.line((ax, ay + 600.0), (bx, by + 600.0), "S-OLD")
        old["trap"] = "T-LAYER-FROZEN"
    view.text("OBSOLETE SCHEME - REV 0 - DO NOT USE", (f(M.X["2"]), f(M.Y["E"]) + 2800.0), 280.0,
              "S-OLD")
    p.view("TYPICAL FLOOR BEAM LAYOUT", view, 100, (p.x0 + 60.0, p.y0 + 120.0), (400.0, 340.0), "ftin")
    p.scale_bar((p.x0 + 60.0, p.y0 + 30.0), "m")
    return p.sheet()


def s15(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-15")
    roof = Scene()
    _layout(ctx, roof, "ROOF")
    marked: set[str] = set()
    for m in _beams(ctx, "ROOF"):
        if m["mark"] in marked:
            continue
        marked.add(m["mark"])
        beam_mark(roof, m)
    roof.text("ROOF BEAM LAYOUT (AT ROOF LEVEL)", (f(M.X["3"]), -4600.0), 340.0, "S-TEXT",
              align="CENTER")
    p.view("ROOF BEAM LAYOUT", roof, 100, (p.x0 + 20.0, p.y0 + 130.0), (330.0, 330.0), "ftin")

    srr = Scene()
    draw_core_and_stair(srr)
    for m in sorted(ctx.at("BEAM", "SRR"), key=lambda m: m["id"]):
        beam_pair(srr, m, "S-BEAM")
        beam_mark(srr, m)
    for m in sorted(ctx.at("SLAB", "SRR"), key=lambda m: m["id"]):
        srr.poly([(f(x), f(y)) for x, y in m["poly"]], "S-SLAB")
        srr.text(m["mark"], (f(M.CORE_CENTRE[0]), f(M.CORE_CENTRE[1]) + 1400.0), 240.0, "S-TEXT",
                 align="CENTER", family="mark")
    srr.insert("LEVEL_MARK", (f(M.CORE_CENTRE[0]), f(M.CORE["y1"]) + 1200.0), "S-TEXT",
               attribs={"LEVEL": f"EL {f(M.ELEV['SRR']) / 1000:.3f}"})
    srr.text("STAIR ROOF & MACHINE ROOM ROOF (5TH TO ROOF)", (f(M.CORE["x0"]), f(M.CORE["y0"]) - 2000.0),
             240.0, "S-TEXT", family="plain")
    p.view("STAIR ROOF BEAM LAYOUT", srr, 100, (p.x0 + 380.0, p.y0 + 200.0), (250.0, 250.0), "ftin")
    p.scale_bar((p.x0 + 20.0, p.y0 + 30.0), "m")
    return p.sheet()


# -- the long-section strips -----------------------------------------------------------------------


def _strip(sc: Scene, ctx: Ctx, m: dict[str, Any], ox: float, oy: float) -> dict[str, Any]:
    """One beam's long section: the outline, the top and bottom bars, the stirrup zones."""
    length = min(f(m["length"]), STRIP_LENGTH)
    depth = f(m["depth"])
    b = f(m["b"])
    sc.rect(ox, oy, length, depth, "S-BEAM")
    sc.line((ox + 76.0, oy + depth - 76.0), (ox + length - 76.0, oy + depth - 76.0), "S-ROD")
    sc.line((ox + 76.0, oy + 76.0), (ox + length - 76.0, oy + 76.0), "S-ROD2")
    for k in range(6):
        x = ox + 150.0 + k * (length - 300.0) / 5
        sc.line((x, oy + 60.0), (x, oy + depth - 60.0), "S-STIR")
    mk = sc.text(m["mark"], (ox, oy + depth + 460.0), 260.0, "S-TEXT", family="mark")
    sc.text(f"{int(b)}x{int(depth)}", (ox + 1500.0, oy + depth + 460.0), 220.0, "S-TEXT",
            family="section", fact=fact(m, "b"))
    top, bot, st = bar_set(ctx, m)
    if top is not None:
        sc.text(f"{top['n']}-{top['dia']}%%C TOP", (ox + 200.0, oy + depth + 160.0), 200.0,
                "S-TEXT2", family="diameter", fact=authored(top["dia"]))
    if bot is not None:
        sc.text(f"{bot['n']}-{bot['dia']}%%C BOT.", (ox + 200.0, oy - 320.0), 200.0, "S-TEXT2",
                family="diameter", fact=authored(bot["dia"]))
    if st is not None:
        sc.text(f"{st['dia']}%%C @ {spacing(st)} c/c", (ox + 2600.0, oy - 320.0),
                200.0, "S-TEXT2", family="diameter", fact=authored(st["dia"]))
    sc.text("L/4", (ox + length / 4, oy + depth + 760.0), 200.0, "S-TEXT2", family="length")
    return mk


def _strips(ctx: Ctx, sheet: str, marks: list[str], level_of) -> Scene:
    sc = Scene()
    for i, mark in enumerate(marks):
        members = [m for m in ctx.by_mark[mark] if m["level"] == level_of(mark)]
        m = (members or ctx.by_mark[mark])[0]
        ox = (i % STRIP_COLS) * STRIP_PITCH_X
        oy = -(i // STRIP_COLS) * STRIP_PITCH_Y
        _strip(sc, ctx, m, ox, oy)
    return sc


def s16(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-16")
    marks = ctx.marks_for("S-16")
    sc = _strips(ctx, "S-16", marks, lambda _m: "1F")
    # a bar call in the two roles one section carries at once (T-NOT-ST-EXT)
    tg = ctx.by_mark["TG1"][0]
    sc.text("2-20%%C st. + 1-20%%C ext.", (0.0, 1400.0), 260.0, "S-TEXT2", family="bar_call",
            fact=authored(20), trap="T-NOT-ST-EXT")
    sc.text("1ST FLOOR BEAM LONG SECTIONS - TOP, BOTTOM AND EXTRA BARS", (0.0, 2000.0), 300.0,
            "S-SHEET", fact=None)
    # a leader that reaches across the sheet to the strip it annotates (T-LEADER-FAR)
    # 300 mm on the paper at 1:50 is 15 m in the scene: the mark and the strip it annotates
    ld = sc.leader([(15000.0, -2600.0), (15000.0, 1200.0), (2400.0, 1200.0)], "S-DIMS")
    ld["trap"] = "T-LEADER-FAR"
    sc.text("EXTRA TOP BARS, SEE THE STRIP ARROWED", (0.0, 1000.0), 220.0, "S-TEXT2")
    # one MLEADER, the entity LibreDWG loses: the DXF keeps it, the DWG profile names the loss
    ml = sc.mleader([(8000.0, -1400.0), (9600.0, 400.0)], "2-16%%C ext.", 220.0, "S-DIMS")
    ml["role"] = "mleader"
    sc.text(f"TG1 CARRIES {tg.get('carries', 'B4')} AND THE FLOATING COLUMN", (0.0, 600.0), 220.0,
            "S-TEXT2")
    p.view("1ST FLOOR BEAM DETAILS", sc, 50, (p.x0 + 20.0, p.y0 + 26.0), (700.0, 524.0), "mm")
    p.scale_bar((p.x0 + 600.0, p.y0 + 12.0), "m")
    return p.sheet()


def s17(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-17")
    marks = ctx.marks_for("S-17")
    sc = _strips(ctx, "S-17", marks, lambda _m: "2F")
    # the lower-case %%c a second draughtsman typed (T-NOT-PCTC-LOWER)
    sc.text("2L-10%%c @ 100 c/c", (0.0, 1400.0), 260.0, "S-TEXT2", family="diameter",
            fact=authored(10), trap="T-NOT-PCTC-LOWER")
    sc.text("TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)", (0.0, 2000.0), 300.0, "S-SHEET")
    # one member whose strip runs out of sheet (T-SCHED-CONTD)
    if "B9" in marks:
        i = marks.index("B9")
        ox = (i % STRIP_COLS) * STRIP_PITCH_X
        oy = -(i // STRIP_COLS) * STRIP_PITCH_Y
        contd = sc.text("CONTD. ON S-18", (ox + 3600.0, oy + 1200.0), 240.0, "S-TEXT2")
        contd["trap"] = "T-SCHED-CONTD"
    p.view("TYPICAL FLOOR BEAM DETAILS", sc, 50, (p.x0 + 20.0, p.y0 + 26.0), (700.0, 524.0), "mm")
    p.scale_bar((p.x0 + 600.0, p.y0 + 12.0), "m")
    return p.sheet()


def s18(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-18")
    marks = ctx.marks_for("S-18")
    sc = Scene()
    rows = []
    for mark in marks:
        m = ctx.by_mark[mark][0]
        top, bot, st = bar_set(ctx, m)
        rows.append([
            (mark, "mark"),
            (f"{int(f(m['b']))}x{int(f(m['depth']))}", "section", fact(m, "b")),
            (f"{f(m['length']):.0f}", "number", fact(m, "length")),
            (f"{top['n']}-{top['dia']}%%C" if top else "-", "diameter" if top else "plain"),
            (f"{bot['n']}-{bot['dia']}%%C" if bot else "-", "diameter" if bot else "plain"),
            (f"{st['dia']}%%C@{spacing(st)}" if st else "-", "diameter" if st else "plain"),
        ])
    header = ["MARK", "SIZE", "SPAN (mm)", "TOP", "BOTTOM", "STIRRUPS"]
    widths = [1800.0, 2400.0, 2400.0, 2800.0, 2800.0, 2600.0]
    half = (len(rows) + 1) // 2
    table(sc, 0.0, 0.0, header, rows[:half], widths, row_h=700.0, h=240.0)
    sc.text("ROOF BEAM SCHEDULE (1 OF 2)", (0.0, 900.0), 340.0, "S-SHEET")
    # the British letters the second draughtsman used on one line (T-NOT-TY)
    sc.text("3T16 + 2Y16", (9000.0, 900.0), 280.0, "S-TEXT2", family="diameter",
            fact=authored(16), trap="T-NOT-TY")
    sc.text("(T AND Y BOTH MEAN A DEFORMED BAR - SEE NOTE 8 ON S-01)", (12000.0, 900.0), 240.0,
            "S-TEXT2")
    second = Scene()
    table(second, 0.0, 0.0, header, rows[half:], widths, row_h=700.0, h=240.0)
    second.text("ROOF BEAM SCHEDULE (2 OF 2)", (0.0, 900.0), 340.0, "S-SHEET")
    # the general note beside the specific cell it loses to (T-NOTE-VS-SCHED)
    bottom = -700.0 * (len(rows) - half + 1) - 700.0
    note = second.text("ALL ROOF BEAM STIRRUPS 10%%C@150 U.N.O.", (0.0, bottom), 260.0, "S-TEXT",
                       family="diameter", fact=authored(150))
    note["trap"] = "T-NOTE-VS-SCHED"
    second.text("10%%C@100 (ends)", (0.0, bottom - 500.0), 260.0, "S-TEXT2", family="diameter",
                fact=authored(100))
    if "RB9" in marks or "B9" in ctx.marks:
        second.text("B9 (CONTD. FROM S-17)", (0.0, bottom - 1000.0), 240.0, "S-TEXT2")
    p.view("ROOF BEAM SCHEDULE 1", sc, 50, (p.x0 + 20.0, p.y0 + 30.0), (340.0, 516.0), "mm")
    p.view("ROOF BEAM SCHEDULE 2", second, 50, (p.x0 + 380.0, p.y0 + 30.0), (340.0, 516.0), "mm")
    p.scale_bar((p.x0 + 600.0, p.y0 + 12.0), "m")
    return p.sheet()
