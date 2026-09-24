"""Rev C on the foundation sheets S-05 to S-09 (R0-G2, design §6): what the revision draws that Rev B
did not, appended to the composed Rev B scenes and sheets (W-44..W-47).

- **S-05**: how far the pile's main bars run above the cut-off — 3" into the cap and 40d beyond,
  which is what makes each bar the length the model cuts it at (PILE-RB).
- **S-06**: F1's mark in its own ring, its size, depth and mesh beside it (F1-1); the pile caps'
  side bars; and PC5's pointer to its lift-pit recess.
- **S-07**: PC5's section shows its lift-pit recess (K18, W-30: the pit is PC5's recess, T-PIT-RECESS)
  — the void, its sizes and floor level, the recess bars the retired pit members' became — and the
  two FDN core legs standing on the cap top (K22). S-07 has no room for a new 1:25 view of a 3.5 m
  cap, so the recess is drawn in PC5's own section, where a cap detail shows its recess; the pit's
  plan, with all four FDN legs, is S-23's (W-45).
- **S-08**: every grade-beam span marked (TIE-1), the chamfer's blinding LINE (D-BLIND's fifth, the
  exploded outline closed on the slab's own edges, T-BLINDING-OUTLINE), and a RAMP SECTION that
  shows the slab-on-grade's edge the ramp exposes (K7, W-24, T-RAMP-REVEAL).
- **S-09**: how the grade beams meet the slab on grade (K8, W-25).
"""

from __future__ import annotations

from ... import model as M
from ..scene import APPENDED, Scene, Sheet, ft_in
from .common import Ctx, authored, beam_mark, f, fact
from .revc import add_view, view_of

#: The spacings a count is checked against when a note states a spacing the model counted with.
SIDE_SPACING = 150


def draw(ctx: Ctx, by: dict[str, Sheet]) -> None:
    s05(ctx, by["S-05"])
    s06(ctx, by["S-06"])
    s07(ctx, by["S-07"])
    s08(ctx, by["S-08"])
    s09(ctx, by["S-09"])


def _bars(ctx: Ctx, member: str, suffix: str) -> list[dict]:
    return [b for b in ctx.bars if b["member"] == member and b["bar_mark"].endswith(suffix)]


def s05(ctx: Ctx, sheet: Sheet) -> None:
    """The main bars' run above the cut-off: the pile's own embedment into the cap, then 40d."""
    elev = view_of(sheet, "PILE CURTAILMENT & SPIRAL ZONES").scene
    dia = f(M.PILE["dia"])
    _n, d_main = M.PILE["main_full"]
    anchorage = M.LAP_C * d_main  # 40d, the compression development the S-02 table states
    pile = ctx.by_class["PILE"][0]
    full = next(b for b in ctx.bars if b["member"] == pile["id"] and b["bar_mark"].endswith("-m1"))
    curt = next(b for b in ctx.bars if b["member"] == pile["id"] and b["bar_mark"].endswith("-m2"))
    embed = f(M.PILE["embed"])
    # the note is the model's own arithmetic: each bar is its run below the cut-off + the embedment
    # into the cap + 40d
    assert abs(f(full["legs"][0]) - (f(M.PILE["length"]) + embed + anchorage)) < 1e-6, full["legs"]
    assert abs(f(curt["legs"][0]) - (f(M.PILE["main_curtailed"][2]) + embed + anchorage)) < 1e-6
    assert ft_in(embed) == "0'-3\"", ft_in(embed)  # the note's 3"
    with elev.revision(APPENDED):
        # clear of the cut-off's level mark, whose label reaches right to about 1000
        elev.text('MAIN BARS EXTENDED 3" INTO THE CAP', (dia + 700.0, 1000.0), 200.0, "S-TEXT2")
        elev.text(f"AND 40d ({anchorage}) ABOVE THE CUT-OFF", (dia + 700.0, 700.0), 200.0, "S-TEXT2",
                  fact=authored(anchorage))


def s06(ctx: Ctx, sheet: Sheet) -> None:
    plan = view_of(sheet, "PILE CAP LAYOUT").scene
    foot = ctx.by_id["F1"]
    xs = [f(x) for x, _ in foot["poly"]]
    ys = [f(y) for _, y in foot["poly"]]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    mesh = _bars(ctx, "F1", "-bx")[0]
    assert (int(mesh["dia"]), M.FOOTING_F1["mesh"]) == (M.FOOTING_F1["mesh"][0], M.FOOTING_F1["mesh"])
    side = [b for b in ctx.bars if b["class"] == "PILE_CAP" and b["bar_mark"].endswith("-s")]
    caps = {m["id"] for m in ctx.by_class["PILE_CAP"]}
    assert {b["member"] for b in side} == caps, "every pile cap carries its side bars"
    (n_side,), (d_side,) = {b["n"] for b in side}, {b["dia"] for b in side}
    with plan.revision(APPENDED):
        plan.text(foot["mark"], (cx, cy), 240.0, "S-TEXT", align="MIDDLE_CENTER", family="mark")
        tx = max(xs) + 300.0
        plan.text(f"{int(f(foot['l']))}x{int(f(foot['b']))}", (tx, max(ys) - 300.0), 200.0, "S-TEXT2",
                  family="section", fact=fact(foot, "l"))
        plan.text(f"{int(f(foot['depth']))} DEEP", (tx, max(ys) - 650.0), 200.0, "S-TEXT2",
                  fact=fact(foot, "depth"))
        plan.text(f"{M.FOOTING_F1['mesh'][0]}%%C @ {M.FOOTING_F1['mesh'][1]} c/c B/W",
                  (tx, max(ys) - 1000.0), 200.0, "S-TEXT2", family="diameter",
                  fact=authored(M.FOOTING_F1["mesh"][1]))
        plan.text(f"ALL PILE CAPS: SIDE BARS {n_side}-{d_side}%%C ALL ROUND", (0.0, -3400.0), 240.0,
                  "S-TEXT", fact=authored(d_side))
        plan.text("PC5: LIFT PIT RECESS, SEE S-07", (0.0, -3900.0), 240.0, "S-TEXT")


def s07(ctx: Ctx, sheet: Sheet) -> None:
    """PC5's section with its recess: the void cut into the cap top, the recess bars, and the FDN
    core legs standing on the cap (the section is taken on the core's centre, across legs 3 and 4)."""
    sc = view_of(sheet, "PC5 SECTION").scene
    cap = ctx.by_id["PC-CORE"]
    assert cap["mark"] == "PC5" and f(cap["recess"]) > 0
    c, t = M.CORE, f(M.CORE["t_low"])
    ix = f(c["x1"] - c["x0"]) - t
    iy = f(c["y1"] - c["y0"]) - t
    hp = f(M.ELEV["PCTOP"] - c["pit_bottom"])
    assert abs(ix * iy * hp - f(cap["recess"])) < 1.0, "the drawn recess is the one PC5 deducts"
    depth = f(cap["depth"])
    half = max(abs(f(x)) for x, _ in M.CAPS["PC5"]["poly"])
    legs = {leg: ctx.by_id[f"SW1-{leg}@FDN"] for leg in ("3", "4", "C", "D")}
    neck = f(M.ELEV["GF"] - M.ELEV["PCTOP"])
    assert all(abs(f(m["h"]) - neck) < 1e-6 for m in legs.values()), "the FDN legs run cap top to GF"
    vert, horiz = _bars(ctx, "PC-CORE", "PIT-v"), _bars(ctx, "PC-CORE", "PIT-h")
    base = [b for b in ctx.bars if b["member"] == "PC-CORE" and b["bar_mark"].startswith("LPS-")]
    cover = f(M.COVER["WALL"])
    # the recess sides' bars at the spacing their counts give over each side's length (the retired
    # pit walls' lengths are the FDN legs' own), each face; the horizontal ones over the recess depth
    spacing = M.D(SIDE_SPACING)
    sides = {legs["3"]["length"], legs["C"]["length"]}
    assert {b["n"] for b in vert} == {2 * M.count_at(n - 2 * M.COVER["WALL"], spacing) for n in sides}
    assert {b["n"] for b in horiz} == {2 * M.count_at(M.ELEV["PCTOP"] - c["pit_bottom"] - M.D(100), spacing)}
    (d_v,), (d_h,), (d_b,) = {b["dia"] for b in vert}, {b["dia"] for b in horiz}, {b["dia"] for b in base}
    with sc.revision(APPENDED):
        recess = sc.poly([(-ix / 2, 0.0), (-ix / 2, -hp), (ix / 2, -hp), (ix / 2, 0.0)], "S-FDN",
                         closed=False)
        for sign in (-1.0, 1.0):
            x = sign * (ix / 2 + cover)
            sc.line((x, -hp - 60.0), (x, -cover), "S-ROD")
        sc.line((-ix / 2 + cover, -hp - cover), (ix / 2 - cover, -hp - cover), "S-ROD2")
        # the FDN legs 3 and 4, cut: cap top to GF, their inner faces on the recess sides
        for sign in (-1.0, 1.0):
            x0 = ix / 2 if sign > 0 else -ix / 2 - t
            sc.rect(x0, 0.0, t, neck, "S-WALL")
            sc.hatch([[(x0, 0.0), (x0 + t, 0.0), (x0 + t, neck), (x0, neck)]], "S-HATCH",
                     pattern="ANSI31", scale=30.0)
        sc.text(legs["3"]["mark"], (-ix / 2 - t, neck + 120.0), 110.0, "S-TEXT", align="RIGHT",
                family="mark")
        sc.text(legs["4"]["mark"], (ix / 2 + t, neck + 120.0), 110.0, "S-TEXT", family="mark")
        sc.dim((-ix / 2, -hp), (ix / 2, -hp), (0.0, -hp + 250.0), 0.0, 100.0, "S-DIMS")
        sc.dim((ix / 2, 0.0), (ix / 2, -hp), (ix / 2 - 250.0, 0.0), 90.0, 100.0, "S-DIMS")
        sc.text(f"{d_v}%%C @ {SIDE_SPACING} VERT. E.F.", (-ix / 2 + 150.0, -280.0), 90.0, "S-TEXT2",
                family="diameter", fact=authored(SIDE_SPACING))
        sc.text(f"{d_h}%%C @ {SIDE_SPACING} HORIZ. E.F.", (-ix / 2 + 150.0, -430.0), 90.0, "S-TEXT2",
                family="diameter", fact=authored(SIDE_SPACING))
        sc.text(f"{d_b}%%C @ {SIDE_SPACING} B/W T&B (BASE)", (-ix / 2 + 150.0, -hp - 170.0), 90.0,
                "S-TEXT2", family="diameter", fact=authored(SIDE_SPACING))
        left = -half + 100.0
        sc.text("LIFT PIT RECESS (SEE S-23)", (left, -depth - 1750.0), 110.0, "S-TEXT2")
        sc.text(f"{ix:.0f}x{iy:.0f}", (left, -depth - 1950.0), 110.0, "S-TEXT2", family="section",
                fact=authored(ix))
        sc.text(f"EL {ft_in(f(c['pit_bottom']))}", (left + 1500.0, -depth - 1950.0), 110.0, "S-TEXT2",
                family="level", fact=authored(c["pit_bottom"]))
    recess["trap"] = "T-PIT-RECESS"


def s08(ctx: Ctx, sheet: Sheet) -> None:
    plan = view_of(sheet, "GRADE BEAM LAYOUT & GF SLAB ON GRADE").scene
    sog = ctx.by_id["SOG@GF"]
    pts = [(f(x), f(y)) for x, y in sog["poly"]]
    edges = [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]
    chamfer = [(a, b) for a, b in edges if a[0] != b[0] and a[1] != b[1]]
    assert len(chamfer) == 1, chamfer
    seen: set[str] = set()
    with plan.revision(APPENDED):
        # every span of a grade beam carries its mark (Rev B marked the first of each)
        for gb in sorted(ctx.by_class["TIE_BEAM"], key=lambda m: m["id"]):
            if gb["mark"] in seen:
                beam_mark(plan, gb)
            seen.add(gb["mark"])
        outline = plan.line(chamfer[0][0], chamfer[0][1], "S-FDN")
    outline["trap"] = "T-BLINDING-OUTLINE"
    ramp_section(ctx, sheet)


def ramp_section(ctx: Ctx, sheet: Sheet) -> None:
    """The ramp on its long axis: the slab on grade flush at its top edge, the ramp falling to grid A,
    and the SOG edge it exposes along both its sides — the lesser of the slab's thickness and the
    drop (K7)."""
    r = M.RAMP
    run, rise = f(r["y1"] - r["y0"]), f(r["rise"])
    sog, ramp = ctx.by_id["SOG@GF"], ctx.by_id["RAMP@GF"]
    t, tr = f(sog["t"]), f(ramp["t"])
    blind = f(M.D(M.SITE["sog_blinding_thickness_mm"]))
    beyond = 2400.0
    sc = Scene()
    # the ramp slab and the slab on grade, cut on the ramp's centre line (grid A at the left)
    sc.poly([(0.0, -rise), (run, 0.0), (run, -tr), (0.0, -rise - tr)], "S-SLAB")
    sc.rect(run, -t, beyond, t, "S-SLAB")
    # the strip of slab on grade left between the ramp's mouth and the edge beam on grid A
    edge = f(M.EDGE_HALF)
    sc.rect(-edge, -t, edge, t, "S-SLAB")
    sc.line((0.0, -rise - tr - blind), (run, -tr - blind), "S-FDN")
    sc.line((run, -t - blind), (run + beyond, -t - blind), "S-FDN")
    # the SOG beyond, along both sides of the ramp: its top at GF, its underside at -t
    sc.line((0.0, 0.0), (run, 0.0), "S-SLAB")
    sc.line((0.0, -t), (run, -t), "S-SLAB", linetype="DASHED")
    # the edge the ramp exposes: from the SOG's top down to the ramp's surface or the SOG's underside
    flush = run - t * run / rise  # where the drop reaches the slab's thickness
    exposed = [(0.0, 0.0), (run, 0.0), (flush, -t), (0.0, -t)] if rise > t else [(0.0, 0.0), (run, 0.0),
                                                                                  (0.0, -rise)]
    sc.hatch([exposed], "S-HATCH", pattern="ANSI31", scale=20.0)
    sc.text("SOG", (run + 300.0, 250.0), 150.0, "S-TEXT", family="mark")
    sc.text("RAMP", (300.0, 250.0), 150.0, "S-TEXT", family="mark")
    sc.text(f"{int(tr)} THK", (1100.0, 250.0), 120.0, "S-TEXT2", family="thickness", fact=fact(ramp, "t"))
    sc.text(f"FALLS {rise:.0f} TO GRID A (1:8)", (300.0, 550.0), 120.0, "S-TEXT2", fact=authored(rise))
    note = sc.text(f"SOG EDGE EXPOSED ALONG BOTH RAMP SIDES AND ITS MOUTH TO THE LESSER OF {int(t)} "
                   "AND THE DROP", (0.0, -rise - tr - blind - 900.0), 120.0, "S-TEXT2", fact=fact(sog, "t"))
    note["trap"] = "T-RAMP-REVEAL"
    sc.text(f"{int(blind)} THK BLINDING UNDER", (run + 300.0, -t - blind - 350.0), 110.0, "S-TEXT2",
            fact=authored(blind))
    sc.text(f"EL {ft_in(-rise)}", (-200.0, -rise + 150.0), 120.0, "S-TEXT2", align="RIGHT",
            family="level", fact=authored(-r["rise"]))
    sc.text("GRID A", (-200.0, 250.0), 110.0, "S-TEXT2", align="RIGHT")
    sc.dim((0.0, -rise - tr - blind), (run, -rise - tr - blind), (0.0, -rise - tr - blind - 350.0), 0.0,
           110.0, "S-DIMS")
    sc.dim((run, 0.0), (run, -t), (run + beyond + 400.0, 0.0), 90.0, 110.0, "S-DIMS")
    add_view(sheet, "RAMP SECTION", sc, 50, (430.0, 300.0), (300.0, 150.0))


def s09(ctx: Ctx, sheet: Sheet) -> None:
    """How the grade beams meet the slab on grade (K8): their tops at its underside, the slab over
    them to their outer face."""
    view = sheet.views[0]
    gb = next(m for m in ctx.by_class["TIE_BEAM"] if m["mark"] == view.title.split()[0])
    sog = ctx.by_id["SOG@GF"]
    depth = f(gb["depth"])
    with view.scene.revision(APPENDED):
        view.scene.text(f"TOP OF GRADE BEAM AT THE UNDERSIDE OF THE SLAB ON GRADE "
                        f"(EL {-f(sog['t']) / 1000:.3f});", (0.0, -depth - 1300.0), 180.0, "S-TEXT2",
                        fact=authored(-f(sog["t"])))
        view.scene.text("THE SLAB RUNS OVER TO THEIR OUTER FACE (ALL GRADE BEAMS)",
                        (0.0, -depth - 1600.0), 180.0, "S-TEXT2")
