"""S-04 to S-09 — the foundation: piles, pile caps, grade beams and the slab on grade.

Everything drawn is read off `model.build()`: the 89 piles sit at their authored absolute
coordinates, each cap is its authored polygon, and every grade beam is its own member's axis.
"""

from __future__ import annotations

from ... import model as M
from ..scene import Scene
from ..scene import Sheet as _Sheet
from .common import Ctx, authored, f, fact, new_paper, table

CAP_ORDER = ["PC1", "PC2", "PC3", "PC4", "PC5"]


def _caps(ctx: Ctx) -> list[dict]:
    return sorted(ctx.by_class["PILE_CAP"], key=lambda m: m["id"])


def _piles(ctx: Ctx) -> list[dict]:
    return sorted(ctx.by_class["PILE"], key=lambda m: int(m["id"][1:]))


def s04(ctx: Ctx) -> _Sheet:
    from .common import draw_grid

    p = new_paper(ctx, "S-04")
    view = Scene()
    draw_grid(view, dims=True, unit="ftin")
    for cap in _caps(ctx):
        view.poly([(f(x), f(y)) for x, y in cap["poly"]], "S-FDN")
    for pile in _piles(ctx):
        x, y = f(pile["x"]), f(pile["y"])
        view.circle((x, y), f(pile["dia"]) / 2, "S-FDN")
        view.text(pile["id"], (x, y), 160.0, "S-TEXT2", align="MIDDLE_CENTER", family="mark")
    view.text(f"{len(_piles(ctx))} NOS. %%C500 BORED PILES, TOE AT EL {M.ELEV['PILE_TOE'] / 1000:.3f}",
              (0.0, -4200.0), 300.0, "S-TEXT", fact=authored(len(_piles(ctx))))
    view.insert("SECTION_MARK", (-3600.0, f(M.Y["C"])), "S-TEXT", attribs={"SEC": "A-A"})
    p.view("PILE LAYOUT PLAN", view, 100, (p.x0 + 12.0, p.y0 + 150.0), (300.0, 300.0), "ftin")

    # the set-out table: every pile's authored coordinates, in three column groups
    setout = Scene()
    piles = _piles(ctx)
    per = 30
    for g in range(3):
        chunk = piles[g * per: (g + 1) * per]
        if not chunk:
            continue
        rows = [[(m["id"], "mark"), (f"{f(m['x']):.0f}", "number", fact(m, "x")),
                 (f"{f(m['y']):.0f}", "number", fact(m, "y"))] for m in chunk]
        table(setout, g * 6200.0, 0.0, ["PILE", "X (mm)", "Y (mm)"], rows,
              [1600.0, 2300.0, 2300.0], row_h=560.0, h=200.0)
    setout.text("PILE SET-OUT TABLE  -  COORDINATES FROM GRID 1 / GRID A", (0.0, 700.0), 300.0, "S-SHEET")
    p.view("PILE SET-OUT TABLE", setout, 100, (p.x0 + 330.0, p.y0 + 150.0), (200.0, 300.0), "mm")
    p.scale_bar((p.x0 + 12.0, p.y0 + 30.0), "m")
    return p.sheet()


def s05(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-05")
    dia, length = f(M.PILE["dia"]), f(M.PILE["length"])
    n_full, d_full = M.PILE["main_full"]
    n_curt, d_curt, curt = M.PILE["main_curtailed"]
    sd, s1, zone, s2 = M.PILE["spiral"]

    sec = Scene()
    sec.circle((0.0, 0.0), dia / 2, "S-FDN")
    sec.circle((0.0, 0.0), dia / 2 - f(M.COVER["PILE"]), "S-STIR")
    for i in range(int(n_full) + int(n_curt)):
        import math

        a = 2 * math.pi * i / (int(n_full) + int(n_curt))
        r = dia / 2 - f(M.COVER["PILE"]) - 20.0
        sec.circle((r * math.cos(a), r * math.sin(a)), float(d_full) / 2, "S-ROD")
    sec.text(f"{int(n_full)}-{int(d_full)}%%C FULL LENGTH", (dia, 120.0), 40.0, "S-TEXT2",
             family="diameter", fact=authored(d_full))
    sec.text(f"{int(n_curt)}-{int(d_curt)}%%C CURTAILED", (dia, 40.0), 40.0, "S-TEXT2",
             family="diameter", fact=authored(d_curt))
    sec.dim((-dia / 2, -dia / 2 - 200.0), (dia / 2, -dia / 2 - 200.0), (0.0, -dia / 2 - 400.0), 0.0,
            40.0, "S-DIMS", fact=authored(dia))
    p.view("PILE SECTION", sec, 20, (p.x0 + 10.0, p.y0 + p.win_h - 90.0), (70.0, 70.0), "mm")

    elev = Scene()
    elev.rect(-dia / 2, -length, dia, length, "S-FDN")
    elev.line((-dia / 2 + 60.0, -length + 100.0), (-dia / 2 + 60.0, 0.0), "S-ROD")
    elev.line((dia / 2 - 60.0, -length + 100.0), (dia / 2 - 60.0, 0.0), "S-ROD")
    elev.line((0.0, -float(curt)), (0.0, 0.0), "S-ROD2")
    elev.line((-dia / 2, -float(curt)), (dia / 2, -float(curt)), "S-ROD2")
    elev.text(f"CURTAILED AT {curt} FROM CUT-OFF", (dia, -float(curt)), 300.0, "S-TEXT2",
              fact=authored(curt))
    for i in range(24):
        y = -i * float(zone) / 8.0
        elev.line((-dia / 2, y), (dia / 2, y - 60.0), "S-STIR")
    # the spiral note, in the pitch-zone spelling the office uses (T-NOT-MSWIRE)
    elev.text(f"{int(sd)}%%C spiral @ {int(s1)}mm c/c (top 3.0 m) then @ {int(s2)}",
              (dia, -600.0), 300.0, "S-TEXT2", family="spiral", fact=authored(s1),
              trap="T-NOT-MSWIRE")
    elev.text(f"PILE LENGTH {length:.0f}", (dia, -length / 2), 300.0, "S-TEXT2", fact=authored(length))
    elev.insert("LEVEL_MARK", (dia / 2, 0.0), "S-TEXT",
                attribs={"LEVEL": f"EL {f(M.ELEV['PILE_CUT']) / 1000:.3f}"})
    p.view("PILE CURTAILMENT & SPIRAL ZONES", elev, 100, (p.x0 + 100.0, p.y0 + 40.0), (120.0, 250.0), "mm")

    sch = Scene()
    pile = ctx.by_class["PILE"][0]
    rows = [[("P", "mark"), (f"{int(dia)}", "number", authored(dia)),
             (f"{length:.0f}", "number", fact(pile, "length")),
             (f"{int(n_full)}-{int(d_full)}%%C + {int(n_curt)}-{int(d_curt)}%%C", "diameter"),
             (f"{int(sd)}%%C @ {int(s1)}/{int(s2)}", "diameter"),
             (str(len(_piles(ctx))), "number", authored(len(_piles(ctx))))]]
    table(sch, 0.0, 0.0, ["MARK", "DIA (mm)", "LENGTH (mm)", "MAIN BARS", "SPIRAL", "NOS"],
          rows, [1400.0, 1600.0, 2000.0, 3400.0, 2200.0, 1200.0], row_h=700.0, h=240.0)
    sch.text("BORED CAST-IN-SITU PILES, f'c = 3000 psi", (0.0, 700.0), 260.0, "S-SHEET")
    p.view("PILE SCHEDULE", sch, 50, (p.x0 + 240.0, p.y0 + p.win_h - 90.0), (250.0, 60.0), "mm")
    p.scale_bar((p.x0 + 240.0, p.y0 + 30.0), "m")
    return p.sheet()


def s06(ctx: Ctx) -> _Sheet:
    from .common import draw_grid

    p = new_paper(ctx, "S-06")
    view = Scene()
    draw_grid(view, dims=True, unit="ftin")
    for cap in _caps(ctx):
        poly = [(f(x), f(y)) for x, y in cap["poly"]]
        view.poly(poly, "S-FDN")
        cx = sum(x for x, _ in poly) / len(poly)
        cy = sum(y for _, y in poly) / len(poly)
        view.text(cap["mark"], (cx, cy), 240.0, "S-TEXT", align="MIDDLE_CENTER", family="mark")
        for pid in cap["piles"]:
            pile = ctx.by_id[pid]
            view.circle((f(pile["x"]), f(pile["y"])), f(pile["dia"]) / 2, "S-FDN")
    foot = ctx.by_id["F1"]
    view.poly([(f(x), f(y)) for x, y in foot["poly"]], "S-FDN")
    p.view("PILE CAP LAYOUT", view, 100, (p.x0 + 12.0, p.y0 + 150.0), (300.0, 300.0), "ftin")

    # the schedule as un-ruled MTEXT columns, with no NOS column anywhere (T-SCHED-NORULES)
    sch = Scene()
    head = sch.mtext(
        r"\LPILE CAP SCHEDULE\l\P"
        r"MARK        SIZE                 DEPTH      PILES      BOTTOM MESH        TOP MESH",
        (0.0, 0.0), 260.0, 16000.0, "S-TEXT")
    head["trap"] = "T-SCHED-NORULES"
    y = -900.0
    for mark in CAP_ORDER:
        spec = M.CAPS[mark]
        member = next(m for m in _caps(ctx) if m["mark"] == mark)
        xs = [f(x) for x, _ in spec["poly"]]
        ys = [f(y2) for _, y2 in spec["poly"]]
        size = f"{int(max(xs) - min(xs))}x{int(max(ys) - min(ys))}"
        mesh = f"{spec['mesh'][0]}%%C @ {spec['mesh'][1]} B/W"
        top = f"{spec['top'][0]}%%C @ {spec['top'][1]} B/W"
        sch.text(mark, (0.0, y), 240.0, "S-TEXT", family="mark")
        sch.text(size, (2400.0, y), 240.0, "S-TEXT", family="section")
        sch.text(f"{f(member['depth']):.0f}", (5600.0, y), 240.0, "S-TEXT", family="number",
                 fact=fact(member, "depth"))
        sch.text(str(len(spec["piles"])), (7800.0, y), 240.0, "S-TEXT", family="number")
        sch.text(mesh, (9800.0, y), 240.0, "S-TEXT", family="diameter")
        sch.text(top, (13600.0, y), 240.0, "S-TEXT", family="diameter")
        y -= 700.0
    sch.mtext(r"COUNTS ARE TAKEN FROM THE LAYOUT ABOVE\PTHIS OFFICE PRINTS NO NOS COLUMN",
              (0.0, y - 300.0), 220.0, 16000.0, "S-TEXT")
    p.view("PILE CAP SCHEDULE", sch, 50, (p.x0 + 330.0, p.y0 + 250.0), (300.0, 200.0), "mm")
    p.scale_bar((p.x0 + 12.0, p.y0 + 30.0), "m")
    return p.sheet()


def s07(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-07")
    x0, y0, h = p.x0, p.y0, p.win_h
    for i, mark in enumerate(CAP_ORDER):
        spec = M.CAPS[mark]
        member = next(m for m in _caps(ctx) if m["mark"] == mark)
        depth = f(member["depth"])
        xs = [f(x) for x, _ in spec["poly"]]
        width = max(xs) - min(xs)
        sc = Scene()
        sc.rect(-width / 2, -depth, width, depth, "S-FDN")
        for dx, _dy in spec["piles"]:
            sc.rect(f(dx) - 250.0, -depth - 900.0, 500.0, 900.0, "S-FDN")
        sc.line((-width / 2 + 76.0, -depth + 76.0), (width / 2 - 76.0, -depth + 76.0), "S-ROD")
        sc.line((-width / 2 + 76.0, -76.0), (width / 2 - 76.0, -76.0), "S-ROD2")
        sc.text(mark, (0.0, 300.0), 200.0, "S-TEXT", align="CENTER", family="mark")
        if mark == "PC3":
            # the imperial call the older draughtsman still writes (T-NOT-HASH)
            sc.text('#5 @ 6" c/c B.W.', (-width / 2, -depth - 1400.0), 150.0, "S-TEXT2",
                    family="diameter", fact=authored(spec["mesh"][0]), trap="T-NOT-HASH")
            nest = sc.insert("PC3_DETAIL", (0.0, -depth - 2600.0), "S-ROD")
            nest["trap"] = "T-BLOCK-NESTED"
        else:
            sc.text(f"{spec['mesh'][0]}%%C @ {spec['mesh'][1]} B.W.", (-width / 2, -depth - 1400.0),
                    150.0, "S-TEXT2", family="diameter", fact=authored(spec["mesh"][1]))
        sc.dim((-width / 2, -depth), (width / 2, -depth), (0.0, -depth - 600.0), 0.0, 150.0, "S-DIMS")
        col, row = i % 3, i // 3
        p.view(f"{mark} SECTION", sc, 25, (x0 + 10.0 + col * 160.0, y0 + h - 178.0 - row * 190.0),
               (140.0, 170.0), "mm")
    foot = ctx.by_id["F1"]
    fs = Scene()
    fl, fd = f(foot["l"]), f(foot["depth"])
    fs.rect(-fl / 2, -fd, fl, fd, "S-FDN")
    fs.line((-fl / 2 + 76.0, -fd + 76.0), (fl / 2 - 76.0, -fd + 76.0), "S-ROD")
    fs.text("F1", (0.0, 300.0), 200.0, "S-TEXT", align="CENTER", family="mark")
    fs.text(f"{M.FOOTING_F1['mesh'][0]}%%C @ {M.FOOTING_F1['mesh'][1]} B/W", (-fl / 2, -fd - 500.0),
            150.0, "S-TEXT2", family="diameter", fact=authored(M.FOOTING_F1["mesh"][1]))
    fs.dim((-fl / 2, -fd), (fl / 2, -fd), (0.0, -fd - 900.0), 0.0, 150.0, "S-DIMS")
    p.view("F1 ISOLATED FOOTING (RAMP WALL)", fs, 25, (x0 + 330.0, y0 + h - 368.0), (140.0, 170.0), "mm")
    p.scale_bar((x0 + 10.0, y0 + 20.0), "m")
    return p.sheet()


def s08(ctx: Ctx) -> _Sheet:
    from .common import beam_mark, beam_pair, draw_grid

    p = new_paper(ctx, "S-08")
    view = Scene()
    draw_grid(view, dims=True, unit="ftin")
    for cap in _caps(ctx):
        view.poly([(f(x), f(y)) for x, y in cap["poly"]], "S-FDN")
    for gb in sorted(ctx.by_class["TIE_BEAM"], key=lambda m: m["id"]):
        beam_pair(view, gb, "S-BEAM")
    seen: set[str] = set()
    for gb in sorted(ctx.by_class["TIE_BEAM"], key=lambda m: m["id"]):
        if gb["mark"] in seen:
            continue
        seen.add(gb["mark"])
        beam_mark(view, gb)
    sog = next(m for m in ctx.by_class["SLAB"] if m["mark"] == "SOG")
    # the slab on grade is a heavy 2D POLYLINE (one entity, its vertices not content), and its
    # blinding is an "exploded" rectangle of four LINEs — the same shape drawn three ways
    view.polyline([(f(x), f(y)) for x, y in sog["poly"]], "S-SLAB")
    x0s = [f(x) for x, _ in sog["poly"]]
    y0s = [f(y) for _, y in sog["poly"]]
    view.rect_lines(min(x0s) - 75.0, min(y0s) - 75.0,
                    max(x0s) - min(x0s) + 150.0, max(y0s) - min(y0s) + 150.0, "S-FDN")
    view.text("75 THK BLINDING UNDER (EXPLODED OUTLINE)", (min(x0s), min(y0s) - 500.0), 200.0,
              "S-TEXT2")
    # the setting-out origin, a POINT on Defpoints
    view.point((f(M.X["1"]), f(M.Y["A"])), "Defpoints")
    view.text("SETTING OUT POINT  GRID 1 / GRID A", (f(M.X["1"]) + 300.0, f(M.Y["A"]) - 900.0),
              200.0, "S-TEXT2")
    view.text("SOG", (f(M.X["3"]), f(M.Y["B"]) - 1200.0), 300.0, "S-TEXT", family="mark")
    view.text(f"SLAB ON GRADE {int(f(sog['t']))} THK", (f(M.X["3"]), f(M.Y["B"]) - 1800.0), 240.0,
              "S-TEXT", family="plain", fact=fact(sog, "t"))
    ramp = next(m for m in ctx.by_class["SLAB"] if m["mark"] == "RAMP")
    view.poly([(f(x), f(y)) for x, y in ramp["poly"]], "S-SLAB")
    rx = (f(M.RAMP["x0"]) + f(M.RAMP["x1"])) / 2
    view.text("RAMP", (rx, f(M.RAMP["y0"]) + 900.0), 300.0, "S-TEXT", family="mark")
    view.text(f"RISE {f(M.RAMP['rise']):.0f} AT 1:8", (rx, f(M.RAMP["y0"]) + 300.0), 200.0, "S-TEXT",
              fact=authored(M.RAMP["rise"]))
    pit = next(m for m in ctx.by_class["SLAB"] if m["mark"] == "LPS")
    view.poly([(f(x), f(y)) for x, y in pit["poly"]], "S-FDN")
    view.text("LIFT PIT", (f(M.CORE_CENTRE[0]), f(M.CORE_CENTRE[1])), 240.0, "S-TEXT",
              align="MIDDLE_CENTER")
    view.insert("LEVEL_MARK", (f(M.CORE_CENTRE[0]), f(M.CORE["y0"]) - 900.0), "S-TEXT",
                attribs={"LEVEL": f"EL {f(M.CORE['pit_bottom']) / 1000:.3f}"})
    p.view("GRADE BEAM LAYOUT & GF SLAB ON GRADE", view, 100, (p.x0 + 40.0, p.y0 + 120.0),
           (340.0, 340.0), "ftin")
    p.scale_bar((p.x0 + 40.0, p.y0 + 30.0), "m")
    return p.sheet()


def s09(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-09")
    x0, y0, h = p.x0, p.y0, p.win_h
    marks = ctx.marks_for("S-09")
    for i, mark in enumerate(marks):
        gb = next(m for m in ctx.by_class["TIE_BEAM"] if m["mark"] == mark)
        length, b, depth = f(gb["length"]), f(gb["b"]), f(gb["depth"])
        sc = Scene()
        sc.rect(0.0, -depth, length, depth, "S-BEAM")
        sc.line((76.0, -depth + 76.0), (length - 76.0, -depth + 76.0), "S-ROD")
        sc.line((76.0, -76.0), (length - 76.0, -76.0), "S-ROD2")
        for k in range(int(length // 400.0)):
            sc.line((100.0 + k * 400.0, -depth + 50.0), (100.0 + k * 400.0, -50.0), "S-STIR")
        sc.text(mark, (0.0, 300.0), 220.0, "S-TEXT", family="mark")
        sc.text(f"{int(b)}x{int(depth)}", (1200.0, 300.0), 200.0, "S-TEXT", family="section",
                fact=fact(gb, "b"))
        bars = [x for x in ctx.bars if x["member"] == gb["id"]]
        if bars:
            top = next((x for x in bars if x["role"] == "TOP"), bars[0])
            sc.text(f"{top['n']}-{top['dia']}%%C", (length / 2, -260.0), 190.0, "S-TEXT2",
                    align="CENTER", family="diameter", fact=authored(top["dia"]))
        # a dimension that keeps its measurement and adds a unit suffix (T-DIM-SUFFIX)
        d = sc.dim((0.0, -depth), (length, -depth), (0.0, -depth - 700.0), 0.0, 200.0, "S-DIMS",
                   text='<>"', trap="T-DIM-SUFFIX" if i == 0 else None)
        if i != 0:
            d["text"] = None
        col, row = i % 2, i // 2
        p.view(f"{mark} LONG SECTION", sc, 50, (x0 + 20.0 + col * 340.0, y0 + h - 120.0 - row * 150.0),
               (300.0, 110.0), "mm")
    p.scale_bar((x0 + 20.0, y0 + 24.0), "m")
    return p.sheet()
