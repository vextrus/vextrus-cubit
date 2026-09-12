"""S-22 to S-26 — stairs, the lift core and shear walls, the tanks, the lintel schedule with the
building section, and the sample bar bending schedule.

S-26 prints the `golden.bbs_sample` rows verbatim: the schedule on the
sheet is the golden's own arithmetic, and only the grand total disagrees — by the 1.7 % the trap
registers (T-BBS-TOTAL).
"""

from __future__ import annotations

from itertools import pairwise
from typing import Any

from ... import golden
from ... import model as M
from ..scene import Scene
from ..scene import Sheet as _Sheet
from .common import Ctx, authored, f, fact, new_paper, table


def s22(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-22")
    st = M.STAIR
    x0, y0, x1, y1 = f(st["x0"]), f(st["y0"]), f(st["x1"]), f(st["y1"])
    width, well, landing = f(st["width"]), f(st["well"]), f(st["landing"])
    tread = f(st["tread"])

    for i, (level, title) in enumerate((("GF", "GROUND FLOOR"), ("1F", "1ST FLOOR (TYPICAL)"))):
        sc = Scene()
        sc.rect(x0, y0, x1 - x0, y1 - y0, "S-WALL")
        risers = st["risers"][level]
        flights = [m for m in ctx.at("STAIR", level) if m["geom"] == "FLIGHT"]
        for m in sorted(flights, key=lambda m: m["id"]):
            fx0, fy0, fx1, fy1 = f(m["x0"]), f(m["y0"]), f(m["x1"]), f(m["y1"])
            sc.rect(fx0, fy0, fx1 - fx0, fy1 - fy0, "S-SLAB")
            steps = int(m["risers"])
            for k in range(1, steps):
                x = fx0 + k * (fx1 - fx0) / steps
                sc.line((x, fy0), (x, fy1), "S-LINE")
            sc.text(m["mark"], (fx0 + 300.0, fy0 + 300.0), 200.0, "S-TEXT", family="mark")
        landings = [m for m in ctx.at("STAIR", level) if m["geom"] != "FLIGHT"]
        for m in sorted(landings, key=lambda m: m["id"]):
            sc.text(m["mark"], (x0 + 400.0, y1 - 500.0), 200.0, "S-TEXT", family="mark")
        sc.text(f"{risers} R @ {f(M.storey_height(level)) / risers:.2f}", (x0, y0 - 700.0), 220.0,
                "S-TEXT2", family="count",
                fact=authored(f"{f(M.storey_height(level)) / risers:.4f}"),
                trap="T-RISER-ROUNDED" if level == "1F" else None)
        sc.text(f"GOING {int(tread)}", (x0 + 2600.0, y0 - 700.0), 220.0, "S-TEXT2")
        sc.dim((x0, y1), (x1, y1), (x0, y1 + 700.0), 0.0, 200.0, "S-DIMS")
        p.view(f"STAIR PLAN AT {title}", sc, 50, (p.x0 + 20.0 + i * 240.0, p.y0 + p.win_h - 240.0),
               (220.0, 220.0), "mm")

    sec = Scene()
    waist = f(st["waist"])
    rise = f(M.storey_height("1F")) / st["risers"]["1F"]
    n = st["risers"]["1F"] // 2
    for k in range(n):
        sec.rect(k * tread, k * rise, tread, rise, "S-SLAB")
    sec.poly([(0.0, -waist), (n * tread, n * rise - waist), (n * tread, n * rise), (0.0, 0.0)], "S-SLAB")
    sec.line((60.0, -waist + 60.0), (n * tread - 60.0, n * rise - waist + 60.0), "S-ROD")
    sec.text(f"{st['bars'][0]}%%C @ {st['bars'][1]} c/c MAIN", (n * tread + 300.0, n * rise / 2),
             90.0, "S-TEXT2", family="diameter", fact=authored(st["bars"][1]))
    sec.text(f"{st['dist'][0]}%%C @ {st['dist'][1]} c/c DIST.", (n * tread + 300.0, n * rise / 2 - 300.0),
             90.0, "S-TEXT2", family="diameter", fact=authored(st["dist"][1]))
    sec.text(f"WAIST {int(waist)}", (n * tread + 300.0, n * rise / 2 - 600.0), 90.0, "S-TEXT2",
             fact=authored(waist))
    # the stacked fraction the office still types into an MTEXT (T-NOT-FTIN-STACK)
    stack = sec.mtext('FLIGHT WIDTH 3\'-6\\S1/2;"', (0.0, -1400.0), 110.0, 6000.0, "S-TEXT2",
                      family="length", fact=authored(width), trap="T-NOT-FTIN-STACK")
    stack["role"] = "ftin-stack"
    sec.text(f"WELL {int(well)}  LANDING {int(landing)}", (0.0, -1800.0), 110.0, "S-TEXT2",
             fact=authored(landing))
    sec.dim((0.0, 0.0), (n * tread, 0.0), (0.0, -900.0), 0.0, 110.0, "S-DIMS")
    p.view("STAIR SECTION", sec, 20, (p.x0 + 20.0, p.y0 + 26.0), (400.0, 250.0), "mm")
    p.scale_bar((p.x0 + 460.0, p.y0 + 26.0), "m")
    return p.sheet()


def s23(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-23")
    c = M.CORE
    x0, y0, x1, y1 = f(c["x0"]), f(c["y0"]), f(c["x1"]), f(c["y1"])
    t = f(c["t_low"])
    sc = Scene()
    sc.rect(x0, y0, x1 - x0, y1 - y0, "S-WALL")
    sc.rect(x0 + t, y0 + t, x1 - x0 - 2 * t, y1 - y0 - 2 * t, "S-WALL")
    sc.hatch([[(x0, y0), (x1, y0), (x1, y1), (x0, y1)],
              [(x0 + t, y0 + t), (x1 - t, y0 + t), (x1 - t, y1 - t), (x0 + t, y1 - t)]],
             "S-HATCH", pattern="ANSI31", scale=30.0)
    dw = f(c["door"][0])
    sc.rect(x0 + (x1 - x0 - dw) / 2, y0 - 60.0, dw, t + 120.0, "S-SLAB")
    sc.text("SW1", (x0 + 300.0, y1 - 500.0), 240.0, "S-TEXT", family="mark")
    sc.text(f"SHEAR WALL {int(t)} THK (LOWER), {int(f(c['t_high']))} THK ABOVE 4F",
            (x0, y1 + 800.0), 220.0, "S-TEXT2", fact=authored(t))
    walls = [m for m in ctx.by_class["SHEAR_WALL"] if m["level"] == "GF"]
    for m in sorted(walls, key=lambda m: m["id"])[:4]:
        sc.text(f"{m['mark']} L={f(m['length']):.0f}", (x0 + 300.0, y0 - 600.0 - 400.0 * walls.index(m)),
                200.0, "S-TEXT2", family="plain", fact=fact(m, "length"))
    sc.dim((x0, y0), (x1, y0), (x0, y0 - 2600.0), 0.0, 220.0, "S-DIMS")
    p.view("LIFT CORE PLAN", sc, 50, (p.x0 + 20.0, p.y0 + p.win_h - 300.0), (280.0, 280.0), "mm")

    pit = Scene()
    depth = f(c["pit_bottom"])
    pit.rect(x0, depth, x1 - x0, -depth, "S-WALL")
    pit.rect(x0, depth, x1 - x0, f(c["pit_slab"]), "S-FDN")
    pit.text("PIT", (x0 + 400.0, depth + 600.0), 240.0, "S-TEXT", family="mark")
    pit.text("LPS", (x0 + 400.0, depth + 200.0), 240.0, "S-TEXT", family="mark")
    pit.text(f"LIFT PIT SLAB {int(f(c['pit_slab']))} THK", (x1 + 300.0, depth + 300.0), 200.0,
             "S-TEXT2", fact=authored(c["pit_slab"]))
    pit.insert("LEVEL_MARK", (x1, depth), "S-TEXT", attribs={"LEVEL": f"EL {depth / 1000:.3f}"})
    pit.dim((x0, depth), (x0, 0.0), (x0 - 900.0, depth), 90.0, 220.0, "S-DIMS")
    p.view("LIFT PIT SECTION", pit, 50, (p.x0 + 330.0, p.y0 + p.win_h - 300.0), (260.0, 280.0), "mm")
    p.scale_bar((p.x0 + 20.0, p.y0 + 30.0), "m")
    return p.sheet()


def _tank(sc: Scene, spec: dict[str, Any], name: str, marks: tuple[str, str, str]) -> None:
    lx, hgt = f(spec["lx"]), f(spec["h"])
    base, wall, top = f(spec["base"]), f(spec["wall"]), f(spec["top"])
    sc.rect(0.0, 0.0, lx, base, "S-FDN")
    sc.rect(0.0, 0.0, wall, base + hgt, "S-WALL")
    sc.rect(lx - wall, 0.0, wall, base + hgt, "S-WALL")
    sc.rect(0.0, base + hgt, lx, top, "S-SLAB")
    sc.text(name, (0.0, base + hgt + top + 900.0), 260.0, "S-TEXT")
    sc.text(marks[0], (200.0, base / 2), 200.0, "S-TEXT", family="mark")
    sc.text(marks[1], (lx / 2, base + hgt + top / 2), 200.0, "S-TEXT", family="mark")
    sc.text(marks[2], (wall + 200.0, base + hgt / 2), 200.0, "S-TEXT", family="mark")
    sc.text(f"BASE {int(base)} / WALL {int(wall)} / TOP {int(top)}", (0.0, -700.0), 190.0,
            "S-TEXT2", fact=authored(base))
    sc.dim((0.0, 0.0), (lx, 0.0), (0.0, -1400.0), 0.0, 200.0, "S-DIMS")


def s24(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-24")
    ohwt = Scene()
    _tank(ohwt, M.OHWT, "OVERHEAD WATER TANK", ("OHWT-B", "OHWT-T", "OHWT-W"))
    ohwt.text(f"MANHOLE {int(f(M.OHWT['manhole'][0]))}x{int(f(M.OHWT['manhole'][1]))}",
              (f(M.OHWT["lx"]) + 400.0, f(M.OHWT["h"])), 190.0, "S-TEXT2")
    p.view("OVERHEAD WATER TANK", ohwt, 50, (p.x0 + 20.0, p.y0 + p.win_h - 260.0), (230.0, 240.0), "mm")

    ugwr = Scene()
    _tank(ugwr, M.UGWR, "UNDERGROUND WATER RESERVOIR", ("UGWR-B", "UGWR-T", "UGWR-W"))
    ugwr.insert("LEVEL_MARK", (0.0, 0.0), "S-TEXT",
                attribs={"LEVEL": f"EL {f(M.UGWR['bottom']) / 1000:.3f}"})
    p.view("UNDERGROUND WATER RESERVOIR", ugwr, 50, (p.x0 + 270.0, p.y0 + p.win_h - 260.0),
           (230.0, 240.0), "mm")

    septic = Scene()
    _tank(septic, M.SEPTIC, "SEPTIC TANK", ("ST-B", "ST-T", "ST-W"))
    bx = f(M.SEPTIC["lx"]) / 2
    septic.rect(bx, f(M.SEPTIC["base"]), f(M.SEPTIC["baffle"]), f(M.SEPTIC["h"]) * 0.7, "S-WALL")
    septic.text(f"BAFFLE {int(f(M.SEPTIC['baffle']))} THK, {M.SEPTIC['chambers']} CHAMBERS",
                (bx + 400.0, f(M.SEPTIC["h"]) * 0.5), 190.0, "S-TEXT2",
                fact=authored(M.SEPTIC["baffle"]))
    p.view("SEPTIC TANK", septic, 50, (p.x0 + 20.0, p.y0 + 26.0), (230.0, 230.0), "mm")
    p.scale_bar((p.x0 + 300.0, p.y0 + 26.0), "m")
    return p.sheet()


def s25(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-25")
    sch = Scene()
    sch.text("LINTEL & SUNSHADE SCHEDULE", (0.0, 900.0), 400.0, "S-SHEET")
    sch.text("MARK        SIZE            BARS                   OPENING (mm)", (0.0, 400.0), 240.0,
             "S-TEXT")
    marks = ctx.marks_for("S-25")
    lintels = [m for m in marks if m in ("L1", "L2", "LS1")]
    for i, mark in enumerate(lintels):
        m = ctx.by_mark[mark][0]
        row = sch.insert("LINTEL_ROW", (0.0, -i * 700.0), "S-LINE", attribs={
            "MARK": mark,
            "SIZE": f"{int(f(m['b']))}x{int(f(m['depth']))}",
            "BARS": "2-12%%C T&B + 8%%C @ 150",
            "OPENING": f"{int(f(m['opening_w']))}",
        })
        if i == 0:
            row["trap"] = "T-SCHED-ATTRIB"
        # the key beside the ATTRIB table: the mark again, as an original TEXT
        sch.text(mark, (11400.0, -i * 700.0 - 500.0), 240.0, "S-TEXT", family="mark")
        sch.text(f"OVER {int(f(m['opening_w']))} OPENING, {m['count']} NOS PER FLOOR",
                 (13000.0, -i * 700.0 - 500.0), 200.0, "S-TEXT2", fact=fact(m, "opening_w"))
    y = -len(lintels) * 700.0 - 900.0
    for mark in ("BW250", "BW125"):
        if mark in marks:
            m = ctx.by_mark[mark][0]
            sch.text(f"{mark}  BRICK WALL {int(f(m['t']))} THK", (0.0, y), 240.0, "S-TEXT",
                     family="plain", fact=fact(m, "t"))
            sch.text(mark, (7000.0, y), 240.0, "S-TEXT", family="mark")
            y -= 600.0
    p.view("LINTEL & SUNSHADE SCHEDULE", sch, 50, (p.x0 + 10.0, p.y0 + p.win_h - 240.0),
           (280.0, 220.0), "mm")

    # the building section, with the level stack written in both habits (T-NOT-LEVEL)
    sec = Scene()
    xs = [f(M.X[n]) for n in M.XN]
    levels = ["GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"]
    for name in levels:
        z = f(M.ELEV[name])
        sec.line((xs[0] - 2000.0, z), (xs[-1] + 2000.0, z), "S-GRID")
        sec.text(f"{name} EL {z / 1000:+.3f}", (xs[-1] + 2200.0, z + 120.0), 220.0, "S-TEXT2",
                 family="plain", fact=authored(M.ELEV[name]))
    for x in xs:
        sec.line((x - 175.0, f(M.ELEV["PCTOP"])), (x - 175.0, f(M.ELEV["ROOF"])), "S-COLS")
        sec.line((x + 175.0, f(M.ELEV["PCTOP"])), (x + 175.0, f(M.ELEV["ROOF"])), "S-COLS")
    for name in levels[1:]:
        z = f(M.ELEV[name])
        for x0, x1 in pairwise(xs):
            sec.rect(x0, z - 600.0, x1 - x0, 600.0, "S-BEAM")
        sec.line((xs[0], z - 125.0), (xs[-1], z - 125.0), "S-SLAB")
    egl = f(M.ELEV["PILE_CUT"]) / 2
    sec.line((xs[0] - 2000.0, egl), (xs[-1] + 2000.0, egl), "S-FDN")
    lv = sec.text('P.L= +0\'-0"', (xs[0] - 2000.0, 300.0), 240.0, "S-TEXT", family="level",
                  fact=authored("0"), trap="T-NOT-LEVEL")
    lv["role"] = "level"
    sec.text('E.G.L (-1\'-6")', (xs[0] - 2000.0, egl + 300.0), 240.0, "S-TEXT", family="level",
             fact=authored(M.SITE["egl_mm"]))
    sec.text('EL +11\'-0"', (xs[0] - 2000.0, f(M.ELEV["1F"]) + 300.0), 240.0, "S-TEXT",
             family="level", fact=authored(M.ELEV["1F"]))
    sec.text(f"+{f(M.ELEV['1F']) / 1000:.3f}", (xs[0] - 2000.0, f(M.ELEV["1F"]) - 500.0), 240.0,
             "S-TEXT", family="level", fact=authored(M.ELEV["1F"]))
    # the cut arrows, filled SOLIDs, and the ground hatch below the E.G.L
    for x, sign in ((xs[0] - 1200.0, 1.0), (xs[-1] + 1200.0, -1.0)):
        sec.solid([(x, egl), (x + sign * 900.0, egl + 400.0), (x + sign * 900.0, egl - 400.0)],
                  "S-ARROW")
    sec.text("SECTION A-A", (xs[0], f(M.ELEV["PCTOP"]) - 1800.0), 400.0, "S-TEXT")
    p.view("BUILDING SECTION A-A", sec, 100, (p.x0 + 300.0, p.y0 + 40.0), (400.0, 420.0), "ftin")
    p.scale_bar((p.x0 + 20.0, p.y0 + 30.0), "m")
    return p.sheet()


def s26(ctx: Ctx) -> _Sheet:
    """The sample bar bending schedule: three members' rows from `golden.bbs_sample`; its printed
    grand total is the SAMPLE's row sum × 1.017 (T-BBS-TOTAL), never the project total (F2-1)."""
    p = new_paper(ctx, "S-26")
    bbs = ctx.bbs()
    sample, sample_total = golden.bbs_sample(bbs)
    sc = Scene()
    rows: list[list[Any]] = []
    last_label = None
    for label, r in sample:
        if last_label is not None and label != last_label:
            rows.append([("", "plain")] * 8)
        last_label = label
        dims = r["dims_mm"]
        rows.append([
            (label, "mark"),
            (r["bar_mark"], "plain"),
            (r["shape"], "plain"),
            (f"{r['dia_mm']}%%C", "diameter", authored(r["dia_mm"])),
            ("/".join(f"{k}={dims[k]}" for k in sorted(dims)), "plain"),
            (r["cutting_rounded_mm"], "number", authored(r["cutting_rounded_mm"])),
            (r["bars"], "number"),
            (r["kg"], "number", authored(r["kg"])),
        ])
    rows.append([("", "plain")] * 8)
    table(sc, 0.0, 0.0,
          ["MEMBER", "BAR MARK", "SHAPE", "DIA", "A / B / C (mm)", "CUT LENGTH", "NOS", "MASS (kg)"],
          rows, [1600.0, 2200.0, 1400.0, 1400.0, 3600.0, 2400.0, 1400.0, 2000.0],
          row_h=500.0, h=180.0)
    sc.text("BAR BENDING SCHEDULE (SAMPLE)", (0.0, 1400.0), 380.0, "S-SHEET")
    sc.text("BS 8666 CUTTING LENGTHS; LAPS AND HOOKS PER THE S-02 TABLE", (0.0, 800.0), 200.0, "S-TEXT")
    bottom = -500.0 * (len(rows) + 1) - 600.0
    sc.text("GRAND TOTAL (KG)", (0.0, bottom), 260.0, "S-TEXT")
    total = sc.text(ctx.trap["T-BBS-TOTAL"]["printed"], (5200.0, bottom), 260.0, "S-TEXT",
                    family="number", fact=authored(str(sample_total)), trap="T-BBS-TOTAL")
    total["role"] = "bbs-total"
    sc.text("(THE ROW SUMS ARE THE TRUTH; THIS TOTAL IS THE TYPIST'S)", (0.0, bottom - 500.0),
            190.0, "S-TEXT2")
    p.view("BAR BENDING SCHEDULE", sc, 50, (p.x0 + 4.0, p.y0 + 6.0), (332.0, 262.0), "mm")
    p.scale_bar((p.x0 + 10.0, p.y0 + 4.0), "m")
    return p.sheet()
