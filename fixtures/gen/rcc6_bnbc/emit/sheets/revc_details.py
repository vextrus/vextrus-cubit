"""Rev C on the notes sheet and the detail sheets S-22 to S-25 (R0-G2, design §6): what the revision
draws that Rev B did not, appended to the composed Rev B scenes and sheets (W-44..W-47).

- **S-01**: the four covers the model cuts bars at and the set did not state (piles and footings,
  tanks, lintels, walls, stairs and the parapet), in the row beside the four it did.
- **S-22**: the landings' thickness and ML1's mesh (STAIR-RB).
- **S-23**: SW1's bars, and a plan of the lift pit at FDN with its four legs — the front wall on
  grid C that closes the pit to GF (K22, W-34) among them — and the note that says so (WLS-1).
- **S-24**: a plan of each tank beside its section — clear sizes, walls outside them, manholes,
  levels, setting-out and bars (T-TANK-CLEAR) — and the outer dimension each section gains (D-TANK).
- **S-25**: the lintel schedule's notes — the floors and the bearing, the class-to-mark map that ties
  L1, LS1 and L2 to the architect's openings (AM-06(5), LNT-1), the brick walls' home — and LS1's
  sunshade detail with its bars.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from ... import model as M
from ..scene import APPENDED, Scene, Sheet, ft_in
from .common import Ctx, authored, core_leg, f, fact
from .revc import add_view, view_of

#: The spacing every wall, tank and landing bar the notes below state was counted at (asserted
#: against each bar's own count before it is printed).
BAR_SPACING = 150


def front(ctx: Ctx, by: dict[str, Sheet]) -> None:
    covers(ctx, by["S-01"])


def draw(ctx: Ctx, by: dict[str, Sheet]) -> None:
    landings(ctx, by["S-22"])
    lift_core(ctx, by["S-23"])
    tanks(ctx, by["S-24"])
    lintels(ctx, by["S-25"])


def _count(run: Any, spacing: int = BAR_SPACING) -> int:
    """L-FRM-05's count over a run, the rule every bar below was counted by (`model.count_at`)."""
    return M.count_at(run if isinstance(run, Decimal) else Decimal(repr(run)), Decimal(spacing))


# -- S-01 -------------------------------------------------------------------------------------------


def covers(ctx: Ctx, sheet: Sheet) -> None:
    """The covers the model cuts the other classes' bars at, in the office's own row (T-NOT-COVER's
    row, `front.s01`), each the value `model.COVER` holds."""
    cov = M.COVER
    assert cov["PILE"] == cov["FOOTING"] and cov["WALL"] == cov["STAIR"], cov
    x0, y0, h = 10.0, 10.0, 400.0
    cy = y0 + h - 196.0 - 32.0 - 6.5  # one row under the four covers Rev B printed
    rows = (
        (6.0, cov["PILE"], "piles & footings"),
        (90.0, cov["TANK"], "tanks"),
        (160.0, cov["LINTEL"], "lintels"),
        (224.0, cov["WALL"], "walls, stairs & parapet"),
    )
    with sheet.paper.revision(APPENDED):
        for dx, value, scope in rows:
            sheet.paper.text(f"{int(value)}mm clear cover ({scope})", (x0 + dx, cy), 3.2, "S-TEXT",
                             family="cover", fact=authored(value))


# -- S-22 -------------------------------------------------------------------------------------------


def landings(ctx: Ctx, sheet: Sheet) -> None:
    sec = view_of(sheet, "STAIR SECTION").scene
    st = M.STAIR
    ml1 = ctx.by_id["ML1@1F"]
    fl = next(m for m in ctx.at("SLAB", "2F") if m["mark"] == "FL")
    assert f(ml1["t"]) == f(fl["t"]) == f(st["landing_t"]), (ml1["t"], fl["t"])
    mesh = {b["bar_mark"]: b for b in ctx.bars if b["member"] == ml1["id"]}
    c = M.COVER["STAIR"]
    across, along = M.SUBGRID["2'"] - st["x0"], st["y1"] - st["y0"]
    assert mesh["ML1-bx"]["n"] == _count(along - 2 * c) and mesh["ML1-by"]["n"] == _count(across - 2 * c)
    (dia,) = {int(b["dia"]) for b in mesh.values()}
    with sec.revision(APPENDED):
        sec.text(f"ML1 & FL LANDINGS {int(f(st['landing_t']))} THK", (0.0, -2150.0), 110.0, "S-TEXT2",
                 fact=authored(st["landing_t"]))
        sec.text(ml1["mark"], (0.0, -2400.0), 110.0, "S-TEXT2", family="mark")
        sec.text(f"{dia}%%C @ {BAR_SPACING} c/c B/W (BOTTOM)", (600.0, -2400.0), 110.0, "S-TEXT2",
                 family="diameter", fact=authored(BAR_SPACING))


# -- S-23 -------------------------------------------------------------------------------------------


def lift_core(ctx: Ctx, sheet: Sheet) -> None:
    """SW1's bars on the core plan, and the pit's own plan at FDN (K22)."""
    core = view_of(sheet, "LIFT CORE PLAN").scene
    c = M.CORE
    x0, y0 = f(c["x0"]), f(c["y0"])
    walls = [m for m in ctx.by_class["SHEAR_WALL"] if m["mark"] == "SW1"]
    cover = M.COVER["WALL"]
    for m in walls:
        bars = {b["bar_mark"]: b for b in ctx.bars if b["member"] == m["id"]}
        assert bars["SW1-v"]["n"] == 2 * _count(m["length"] - 2 * cover), m["id"]
        assert bars["SW1-h"]["n"] == 2 * _count(m["h"] - M.D(100)), m["id"]
        assert f(bars["SW1-h"]["legs"][1]) == M.HOOK_90 * int(bars["SW1-h"]["dia"]), m["id"]
    (d_v,) = {int(b["dia"]) for b in ctx.bars if b["bar_mark"] == "SW1-v"}
    (d_h,) = {int(b["dia"]) for b in ctx.bars if b["bar_mark"] == "SW1-h"}
    with core.revision(APPENDED):
        core.text("SW1", (x0 - 1500.0, y0 - 3200.0), 200.0, "S-TEXT", family="mark")
        core.text(f"{d_v}%%C @ {BAR_SPACING} VERT. E.F.", (x0 - 700.0, y0 - 3200.0), 200.0, "S-TEXT2",
                  family="diameter", fact=authored(BAR_SPACING))
        core.text(f"{d_h}%%C @ {BAR_SPACING} HORIZ. E.F.", (x0 - 700.0, y0 - 3550.0), 200.0, "S-TEXT2",
                  family="diameter", fact=authored(BAR_SPACING))
        core.text(f"HORIZONTAL BARS HOOKED 90%%D ({M.HOOK_90}d) AT THE WALL ENDS", (x0 - 700.0, y0 - 3900.0),
                  200.0, "S-TEXT2", fact=authored(M.HOOK_90))
    pit_plan(ctx, sheet)


def pit_plan(ctx: Ctx, sheet: Sheet) -> None:
    """The lift pit at FDN: the four legs standing on PC5 from its top to GF — legs 3 and 4 run to the
    front wall's outer face, and the front wall on grid C closes the pit below the lift door (K22) —
    the pit floor, its sizes, and the note WLS-1 reads."""
    c = M.CORE
    legs = {leg: ctx.by_id[f"SW1-{leg}@FDN"] for leg in ("3", "4", "D", "C")}
    t = f(c["t_low"])
    sc = Scene()
    boxes = {leg: core_leg(ctx, leg, "FDN") for leg in legs}
    for a, b, u, v in boxes.values():
        sc.rect(a, b, u - a, v - b, "S-WALL")
    sc.hatch([[(a, b), (u, b), (u, v), (a, v)] for a, b, u, v in boxes.values()], "S-HATCH",
             pattern="ANSI31", scale=30.0)
    ix0, iy0 = boxes["3"][2], boxes["C"][3]
    ix1, iy1 = boxes["4"][0], boxes["D"][1]
    assert abs((ix1 - ix0) * (iy1 - iy0) * f(M.ELEV["PCTOP"] - c["pit_bottom"])
               - f(ctx.by_id["PC-CORE"]["recess"])) < 1.0, "the pit drawn is PC5's recess"
    # the pile cap under it, drawn as its edges (it is S-06's member; this plan only stands on it)
    cap = [(f(x), f(y)) for x, y in ctx.by_id["PC-CORE"]["poly"]]
    for a, b in zip(cap, cap[1:] + cap[:1], strict=True):
        sc.line(a, b, "S-FDN", linetype="DASHED")
    sc.text("PC5 (BELOW)", (cap[3][0] + 150.0, cap[3][1] - 330.0), 160.0, "S-TEXT2")
    sc.text("SW1", (ix0 + 200.0, iy1 - 450.0), 200.0, "S-TEXT", family="mark")
    sc.text("PIT FLOOR", (ix0 + 200.0, (iy0 + iy1) / 2 + 100.0), 160.0, "S-TEXT2")
    sc.text(f"EL {ft_in(f(c['pit_bottom']))}", (ix0 + 200.0, (iy0 + iy1) / 2 - 200.0), 160.0, "S-TEXT2",
            family="level", fact=authored(c["pit_bottom"]))
    clear_x = (c["x1"] - c["x0"]) - c["t_low"]  # the recess PC5 deducts (`model.own_foundation_junctions`)
    clear_y = (c["y1"] - c["y0"]) - c["t_low"]
    assert abs(f(clear_x) - (ix1 - ix0)) < 1e-6 and abs(f(clear_y) - (iy1 - iy0)) < 1e-6
    sc.dim((ix0, iy0), (ix1, iy0), (ix0, iy0 + 400.0), 0.0, 160.0, "S-DIMS")
    sc.dim((ix1, iy0), (ix1, iy1), (ix1 - 400.0, iy0), 90.0, 160.0, "S-DIMS")
    front = legs["C"]
    left = cap[0][0]
    lines = [
        ("BELOW GF THE PIT IS CLOSED ON GRID C:", None),
        (f"FRONT WALL SW1 {int(f(front['t']))} THK, PIT FLOOR TO GF", fact(front, "t")),
        ("(BELOW THE LIFT DOOR)", None),
        ("AT FDN SW1 L=" + "/".join(f"{f(legs[k]['length']):.0f}" for k in ("3", "4", "D", "C")),
         fact(legs["3"], "length")),
    ]
    for i, (text, fct) in enumerate(lines):
        sc.text(text, (left, cap[0][1] - 700.0 - 330.0 * i), 170.0, "S-TEXT2", fact=fct)
    sc.text("LIFT DOOR ABOVE (GF)", ((ix0 + ix1) / 2 - 900.0, boxes["C"][1] - 270.0), 150.0, "S-TEXT2")
    assert f(front["h"]) == f(M.ELEV["GF"] - M.ELEV["PCTOP"]) and t == f(front["t"])
    add_view(sheet, "LIFT PIT PLAN AT FDN", sc, 50, (30.0, 70.0), (280.0, 190.0))


# -- S-24 -------------------------------------------------------------------------------------------

#: The three tanks: the model's spec, its member prefix, the section it stands beside, and the plan
#: view Rev C adds for it (paper window lower-left and size, mm).
TANKS: tuple[tuple[str, str, str, str, tuple[float, float], tuple[float, float]], ...] = (
    ("OHWT", "OHWT", "OVERHEAD WATER TANK", "OHWT PLAN", (530.0, 420.0), (230.0, 140.0)),
    ("UGWR", "UGWR", "UNDERGROUND WATER RESERVOIR", "UGWR PLAN", (530.0, 240.0), (230.0, 150.0)),
    ("SEPTIC", "ST", "SEPTIC TANK", "SEPTIC TANK PLAN", (300.0, 70.0), (220.0, 190.0)),
)


def tanks(ctx: Ctx, sheet: Sheet) -> None:
    for spec_name, prefix, section, title, at, size in TANKS:
        spec = getattr(M, spec_name)
        outer_dim(view_of(sheet, section).scene, spec)
        tank_plan(ctx, sheet, spec_name, spec, prefix, title, at, size)


def outer_dim(sc: Scene, spec: dict[str, Any]) -> None:
    """D-TANK's outer dimension: the section's walls stand outside the clear span, over both walls."""
    lx, wall = f(spec["lx"]), f(spec["wall"])
    with sc.revision(APPENDED):
        sc.dim((-wall, 0.0), (lx + wall, 0.0), (0.0, -2100.0), 0.0, 200.0, "S-DIMS")


def tank_plan(ctx: Ctx, sheet: Sheet, spec_name: str, spec: dict[str, Any], prefix: str, title: str,
              at: tuple[float, float], size: tuple[float, float]) -> None:
    """One tank in plan, local to its outer corner: the clear inside sizes (the model's lx and ly),
    the walls outside them, the manholes, its level, where it is set out, and its bars."""
    base, top = ctx.by_id[f"{prefix}-B"], ctx.by_id[f"{prefix}-T"]
    walls = [m for m in ctx.by_class["WALL"] if m["id"].startswith(f"{prefix}-W")]
    x0, y0 = min(f(x) for x, _ in base["poly"]), min(f(y) for _, y in base["poly"])
    x1, y1 = max(f(x) for x, _ in base["poly"]), max(f(y) for _, y in base["poly"])
    wall = f(spec["wall"])
    lx, ly = x1 - x0 - 2 * wall, y1 - y0 - 2 * wall
    assert abs(lx - f(spec["lx"])) < 1e-6, (spec_name, lx)
    # the bars, each checked against its own count before it is printed (COVER["TANK"], `model.tank`)
    c = M.COVER["TANK"]
    bars = {b["bar_mark"][len(prefix) + 1:]: b for b in ctx.bars if b["member"] in {base["id"], top["id"]}}
    wbars = {b["bar_mark"][len(prefix) + 1:]: b for b in ctx.bars if b["member"] == walls[0]["id"]}
    d_b, s_b = M.SLAB_BARS[int(f(base["t"]))]
    d_t, s_t = M.SLAB_BARS[int(f(top["t"]))]
    assert bars["Bbx"]["n"] == M.count_at(M.D(str(y1 - y0)) - 2 * c, M.D(s_b)) and int(bars["Bbx"]["dia"]) == d_b
    assert bars["Tbx"]["n"] == M.count_at(M.D(str(y1 - y0)) - 2 * c, M.D(s_t)) and int(bars["Tbx"]["dia"]) == d_t
    assert wbars["Wv"]["n"] == 2 * _count(walls[0]["length"] - 2 * c), spec_name
    (d_w,) = {int(b["dia"]) for b in wbars.values()}
    manholes = [h for h in top["holes"] if h["kind"] == "MANHOLE"]
    mw, mh = (f(v) for v in M.OHWT["manhole"])
    assert all(abs(f(h["area"]) - mw * mh) < 1e-6 for h in manholes), spec_name
    sc = Scene()
    sc.rect(0.0, 0.0, lx + 2 * wall, ly + 2 * wall, "S-WALL")
    sc.rect(wall, wall, lx, ly, "S-WALL")
    sc.hatch([[(0.0, 0.0), (lx + 2 * wall, 0.0), (lx + 2 * wall, ly + 2 * wall), (0.0, ly + 2 * wall)],
              [(wall, wall), (wall + lx, wall), (wall + lx, wall + ly), (wall, wall + ly)]],
             "S-HATCH", pattern="ANSI31", scale=25.0)
    chambers = spec.get("chambers", 1) if spec_name == "SEPTIC" else 1
    if spec_name == "SEPTIC":
        baffle = f(spec["baffle"])
        yb = wall + f(spec["ly"])
        sc.rect(wall, yb, lx, baffle, "S-WALL")
        assert abs(ly - (chambers * f(spec["ly"]) + baffle)) < 1e-6, ly
    # the manholes in the top slab, one a chamber, centred on each chamber's width, dashed below it
    per = ly / len(manholes) if spec_name == "SEPTIC" else ly
    for k in range(len(manholes)):
        cx = wall + lx * (k + 1) / (len(manholes) + 1) if spec_name != "SEPTIC" else wall + lx / 2
        cy = wall + ly / 2 if spec_name != "SEPTIC" else wall + per * k + per / 2
        pts = [(cx - mw / 2, cy - mh / 2), (cx + mw / 2, cy - mh / 2), (cx + mw / 2, cy + mh / 2),
               (cx - mw / 2, cy + mh / 2)]
        for a, b in zip(pts, pts[1:] + pts[:1], strict=True):
            sc.line(a, b, "S-SLAB", linetype="DASHED")
        sc.text(f"MH {int(mw)}x{int(mh)}", (cx - mw / 2, cy + mh / 2 + 120.0), 130.0, "S-TEXT2",
                fact=authored(mw))
    sc.dim((wall, wall), (wall + lx, wall), (wall, wall + 150.0), 0.0, 150.0, "S-DIMS")
    sc.dim((wall + lx, wall), (wall + lx, wall + ly), (wall + lx - 450.0, wall), 90.0, 150.0, "S-DIMS")
    sc.dim((0.0, 0.0), (lx + 2 * wall, 0.0), (0.0, -500.0), 0.0, 150.0, "S-DIMS")
    sc.dim((0.0, 0.0), (0.0, ly + 2 * wall), (-500.0, 0.0), 90.0, 150.0, "S-DIMS")
    notes = Scene()
    lines: list[tuple[str, str, Any]] = [
        ("ALL SIZES ARE CLEAR INSIDE", "plain", None),
        (f"WALL {int(wall)} THK", "plain", authored(spec["wall"])),
        (f"{d_b}%%C @ {s_b} B/W T&B (BASE)", "diameter", authored(s_b)),
        (f"{d_t}%%C @ {s_t} B/W (TOP SLAB)", "diameter", authored(s_t)),
        (f"{d_w}%%C @ {BAR_SPACING} E.F. BOTH WAYS (WALLS)", "diameter", authored(BAR_SPACING)),
    ]
    where, level, setting_out = _level_and_setting_out(spec_name, spec)
    lines += [(where, "plain", None), level, (setting_out, "plain", None)]
    items = [notes.text(text, (0.0, -i * 280.0), 150.0, "S-TEXT2", family=family, fact=fct)
             for i, (text, family, fct) in enumerate(lines)]
    if spec_name == "UGWR":
        items[0]["trap"] = "T-TANK-CLEAR"
    sc.extend(notes, (0.0, -1100.0))
    add_view(sheet, title, sc, 50, at, size)


def _level_and_setting_out(spec_name: str, spec: dict[str, Any]) -> tuple[str, tuple[str, str, Any], str]:
    """What the tank's base stands on and at what level, and where its outer corner is set out."""
    if spec_name == "OHWT":
        srr = M.ELEV["SRR"]
        st = M.STAIR
        assert (st["x0"], st["y0"]) == (M.X["2"], M.Y["C"]), "the OHWT stands on the stair roof"
        return ("BASE ON THE STAIR ROOF AT", (f"EL +{ft_in(f(srr))}", "level", authored(srr)),
                "OUTER CORNER AT GRID 2 / GRID C")
    bottom = spec["bottom"]
    grids = {f(v): n for n, v in M.X.items()}
    east = grids.get(f(spec["x0"]))
    across = f"GRID {east}" if east else f"{ft_in(f(spec['x0']))} FROM GRID 1"
    return ("UNDERSIDE OF BASE AT", (f"EL {ft_in(f(bottom))}", "level", authored(bottom)),
            f"OUTER CORNER AT {across}, {ft_in(-f(spec['y0']))} SOUTH OF GRID A")


# -- S-25 -------------------------------------------------------------------------------------------


def lintels(ctx: Ctx, sheet: Sheet) -> None:
    """The lintel schedule's notes, in a notes view of their own under it — never inside the schedule's
    window, where its reader would take them for rows (W-47) — and LS1's sunshade in section."""
    lin = {mark: ctx.by_mark[mark][0] for mark in ("L1", "L2", "LS1")}
    bearing = {(f(m["length"]) - f(m["opening_w"])) / 2 for m in lin.values()}
    assert len(bearing) == 1, bearing
    (bear,) = bearing
    floors = sorted({m["level"] for m in ctx.by_class["LINTEL"]}, key=M.FLOORS.index)
    words = {"1F": "1ST", "2F": "2ND", "3F": "3RD", "4F": "4TH", "5F": "5TH", "6F": "6TH"}
    assert floors == ["1F", "2F", "3F", "4F", "5F", "6F"], floors
    host = {int(f(m["b"])) for m in lin.values()}
    assert host == {250}, host
    sc = Scene()
    lines: list[tuple[str, Any]] = [
        (f"LINTELS AT {words[floors[0]]} TO {words[floors[-1]]} FLOOR; BEARING {bear:.0f} EACH SIDE",
         authored(bear)),
        ("L1 OVER W1, LS1 OVER W2, L2 OVER D1, FD1 & SD1 - IN 250 WALLS ONLY", authored(250)),
        ("(SEE THE ARCHITECTURAL DOOR & WINDOW SCHEDULE)", None),
        ("NOS PER FLOOR ARE INDICATIVE; THE ARCHITECTURAL SCHEDULE GOVERNS", None),
        ("BRICK WALLS: SEE THE ARCHITECTURAL DRAWINGS", None),
    ]
    items = [sc.text(text, (0.0, -450.0 * i), 160.0, "S-TEXT2", fact=fct) for i, (text, fct) in enumerate(lines)]
    items[3]["trap"] = "T-LINTEL-NOS-FLOORS"
    add_view(sheet, "LINTEL NOTES", sc, 50, (20.0, 250.0), (270.0, 70.0), caption="LINTEL NOTES",
             origin=(-400.0, -450.0 * (len(lines) - 1) - 700.0))
    sunshade(ctx, sheet, lin["LS1"])


def sunshade(ctx: Ctx, sheet: Sheet, ls1: dict[str, Any]) -> None:
    """LS1 in section: the lintel in its 250 wall and the sunshade it carries, with their bars."""
    proj, ts = (f(v) for v in ls1["sunshade"])
    b, d = f(ls1["b"]), f(ls1["depth"])
    bars = {bar["bar_mark"].split("-", 1)[1]: bar for bar in ctx.bars if bar["member"] == ls1["id"]}
    w = f(ls1["opening_w"])
    assert bars["ss"]["n"] == _count(w + 600.0) and bars["sd"]["n"] == _count(proj, 200), bars
    assert f(bars["ss"]["legs"][0]) == proj + 200.0
    cover = f(M.COVER["LINTEL"])
    sc = Scene()
    sc.rect(0.0, 0.0, b, d, "S-BEAM")
    sc.poly([(b, d - ts), (b + proj, d - ts), (b + proj, d), (b, d)], "S-SLAB", closed=False)
    for x in (0.0, b):
        sc.line((x, 0.0), (x, -600.0), "S-WALL", linetype="DASHED")
    sc.rect(cover, cover, b - 2 * cover, d - 2 * cover, "S-STIR")
    for x in (cover + 16.0, b - cover - 16.0):
        for y in (cover + 16.0, d - cover - 16.0):
            sc.circle((x, y), 6.0, "S-ROD")
    sc.poly([(b - cover, cover + 20.0), (b - cover, d - 20.0), (b + proj - 20.0, d - 20.0),
             (b + proj - 20.0, d - ts + 20.0)], "S-ROD2", closed=False)
    sc.dim((b, d), (b + proj, d), (b, d + 180.0), 0.0, 45.0, "S-DIMS")
    sc.dim((b + proj, d - ts), (b + proj, d), (b + proj + 150.0, d - ts), 90.0, 45.0, "S-DIMS")
    sc.dim((0.0, 0.0), (b, 0.0), (0.0, -200.0), 0.0, 45.0, "S-DIMS")
    sc.text(ls1["mark"], (0.0, d + 330.0), 60.0, "S-TEXT", family="mark")
    sc.text(f"{int(b)}x{int(d)}", (220.0, d + 330.0), 60.0, "S-TEXT2", family="section", fact=fact(ls1, "b"))
    t_bar, st = bars["t"], bars["s"]
    assert (t_bar["n"], t_bar["dia"]) == (bars["b"]["n"], bars["b"]["dia"]), "LS1 is bar-for-bar top and bottom"
    s_dia, s_end, s_mid = M.BEAM_TYPES[ls1["type"]]["st"]
    assert (int(st["dia"]), s_end) == (s_dia, s_mid), (st["dia"], s_end, s_mid)
    key = [
        (f"{t_bar['n']}-{t_bar['dia']}%%C T&B", "bar_call", authored(t_bar["dia"])),
        (f"{st['dia']}%%C @ {s_end} STIRRUPS", "diameter", authored(s_end)),
        (f"{bars['ss']['dia']}%%C @ {BAR_SPACING} (SUNSHADE MAIN)", "diameter", authored(BAR_SPACING)),
        (f"{bars['sd']['dia']}%%C @ 200 DIST. (SUNSHADE)", "diameter", authored(200)),
    ]
    for i, (text, family, fct) in enumerate(key):
        sc.text(text, (b + proj + 350.0, d - 100.0 * i), 50.0, "S-TEXT2", family=family, fact=fct)
    add_view(sheet, "LS1 SUNSHADE DETAIL", sc, 20, (20.0, 70.0), (270.0, 160.0))
