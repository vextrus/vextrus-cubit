"""Rev C on the framing and column sheets (R0-G2, design §6): what the revision draws that Rev B did
not, appended to the composed Rev B scenes (W-44..W-47).

- **The lift core's leg D** (D-CORE, W-36) on the eight views that draw the core: the seven plans
  and S-23's core plan. Rev B drew legs 3 and 4 (corrected in place by R0-G1); leg D, on grid D
  between them, is Rev C's outline. Each view draws the storey its own legs are (the caller's
  storey, as the Rev B composer read it), so 250 or 200; the typical plans stand for 2F..6F and draw
  the lower band, with S-23's band note governing (T-CORE-BAND).
- **S-15's roof layout** gains the seventh LB1 (K6, W-23: the half-landing beam of the sixth storey
  is filed at ROOF, the layout that draws it; T-LB1-HALF-LANDING).
- **S-15's stair-roof layout** gains its grid (2, 3, 4 / C, D, bubbled and dimensioned), the two
  C4 stubs at C/2 and D/2 that carry the stair roof, their marks, the grid-referenced note (never
  the stack's own C2, which is mark C4's stack name; T-STUB-COLUMNS) and the machine-room roof's
  thickness.
- **S-12** gains its two general notes: the sections are typical for every band of a mark (reading
  A of S-12's sections, I-607), and the starter bars' foot and lap as the model builds them.
  C7's section (the circular hoops) waits on its reader (R6c), as S-03's CH row does (W-48); its
  formula is settled by AM-03(d), not the owner (W-28).
"""

from __future__ import annotations

from itertools import pairwise
from typing import Any

from ... import model as M
from ..scene import APPENDED, Scene, Sheet, ft_in
from .common import (
    GX,
    GY,
    Ctx,
    _mm,
    authored,
    beam_mark,
    beam_pair,
    core_leg,
    f,
    fact,
    storey_under,
)
from .revc import view_of

#: The eight views that draw the lift core, with the storey whose legs each draws — the storey its
#: Rev B composer read legs 3 and 4 at (`beams._layout`, `slabs.s19..s21`, `details.s23`).
CORE_VIEWS: tuple[tuple[str, str, str], ...] = (
    ("S-13", "1ST FLOOR BEAM LAYOUT", storey_under("1F")),
    ("S-14", "TYPICAL FLOOR BEAM LAYOUT", storey_under("2F")),
    ("S-15", "ROOF BEAM LAYOUT", storey_under("ROOF")),
    ("S-15", "STAIR ROOF BEAM LAYOUT", storey_under("SRR")),
    ("S-19", "1ST FLOOR SLAB REINFORCEMENT PLAN", storey_under("1F")),
    ("S-20", "TYPICAL SLAB REINFORCEMENT PLAN", storey_under("2F")),
    ("S-21", "ROOF & STAIR ROOF PLAN", storey_under("ROOF")),
    ("S-23", "LIFT CORE PLAN", "GF"),
)

#: The view whose leg D stands for the typical band: S-14 states its range, 2ND TO 6TH, and draws
#: the lower band's 250 (T-CORE-BAND).
CORE_BAND_VIEW = ("S-14", "TYPICAL FLOOR BEAM LAYOUT")

#: The stair roof's two columns: the roof-storey stubs of stacks C2 and D2 (both mark C4).
STUBS = ("COL:C2@ROOF", "COL:D2@ROOF")

#: The grid the stair-roof layout draws: the three axes and two rows its members stand on.
SRR_AXES = ("2", "3", "4")
SRR_ROWS = ("C", "D")


def draw(ctx: Ctx, by: dict[str, Sheet]) -> None:
    for number, title, storey in CORE_VIEWS:
        leg_d(ctx, view_of(by[number], title).scene, storey, band=(number, title) == CORE_BAND_VIEW)
    roof_layout(ctx, view_of(by["S-15"], "ROOF BEAM LAYOUT").scene)
    stair_roof(ctx, view_of(by["S-15"], "STAIR ROOF BEAM LAYOUT").scene)
    column_notes(ctx, by["S-12"])


def leg_d(ctx: Ctx, scene: Scene, storey: str, *, band: bool = False) -> dict[str, Any]:
    """Leg D of the lift core as the model builds it at `storey`, on the wall layer legs 3 and 4 are."""
    a, b, u, v = core_leg(ctx, "D", storey)
    with scene.revision(APPENDED):
        item = scene.rect(a, b, u - a, v - b, "S-WALL")
    if band:
        item["trap"] = "T-CORE-BAND"
    return item


def roof_layout(ctx: Ctx, roof: Scene) -> None:
    """The seventh LB1: the sixth storey's half-landing beam, filed at ROOF (K6), drawn where the
    model builds it, between the roof beams it frames into."""
    lb1 = ctx.by_id["LB1@6F"]
    assert lb1["level"] == "ROOF", lb1["level"]
    with roof.revision(APPENDED):
        beam_pair(roof, lb1, "S-BEAM")
        mark = beam_mark(roof, lb1)
    mark["trap"] = "T-LB1-HALF-LANDING"


def stair_roof(ctx: Ctx, srr: Scene) -> None:
    """The stair-roof layout's grid, its two C4 stubs and what the sheet says about them."""
    xs = [(n, x) for n, x in GX if n in SRR_AXES]
    ys = [(n, y) for n, y in GY if n in SRR_ROWS]
    assert [n for n, _ in xs] == list(SRR_AXES) and [n for n, _ in ys] == list(SRR_ROWS)
    x0, x1 = xs[0][1] - 1500.0, xs[-1][1] + 1500.0
    y0, y1 = ys[0][1] - 1500.0, ys[-1][1] + 1500.0
    with srr.revision(APPENDED):
        for n, x in xs:
            srr.line((x, y0), (x, y1), "S-GRID")
            bubble = srr.insert("GRID_BUBBLE", (x, y1 + 500.0), "S-GRIDC", attribs={"GRID": n})
            bubble["family"] = "grid"
        for n, y in ys:
            srr.line((x0, y), (x1, y), "S-GRID")
            bubble = srr.insert("GRID_BUBBLE", (x0 - 500.0, y), "S-GRIDC", attribs={"GRID": n})
            bubble["family"] = "grid"
        # the bays in the plans' own feet-and-inches habit (W-08), each its own measured span
        for (_na, a), (_nb, b) in pairwise(xs):
            srr.dim((a, y1), (b, y1), (a, y1 + 1600.0), 0.0, 220.0, "S-DIMI",
                    text=ft_in(b - a), fact=authored(_mm(b - a)))
        for (_na, a), (_nb, b) in pairwise(ys):
            srr.dim((x0, a), (x0, b), (x0 - 1600.0, a), 90.0, 220.0, "S-DIMI",
                    text=ft_in(b - a), fact=authored(_mm(b - a)))
        # the two stubs: the roof storey of stacks C2 and D2, mark C4, from the roof to the stair roof
        for sid in STUBS:
            m = ctx.by_id[sid]
            assert (m["class"], m["level"], m["mark"]) == ("COLUMN", "ROOF", "C4"), (sid, m["mark"])
            poly = [(f(x), f(y)) for x, y in M.column_poly(ctx.stacks[m["stack"]], "ROOF")]
            srr.poly(poly, "S-COLS")
            srr.hatch([poly], "S-HATCH", pattern="ANSI31", scale=40.0)
            srr.text(m["mark"], (f(m["cx"]) - 700.0, f(m["cy"]) + 350.0), 200.0, "S-TEXT",
                     align="MIDDLE_RIGHT", family="mark")
        note = srr.text("COLUMNS AT C/2 AND D/2 (C4) CONTINUE TO THE STAIR ROOF",
                        (x0, y0 - 1100.0), 240.0, "S-TEXT", family="plain")
        mrr = next(m for m in ctx.at("SLAB", "SRR") if m["mark"] == "MRR")
        srr.text(f"MRR {int(f(mrr['t']))} THK", (f(M.CORE_CENTRE[0]), f(M.CORE_CENTRE[1]) - 600.0),
                 200.0, "S-TEXT2", align="CENTER", family="plain", fact=fact(mrr, "t"))
    note["trap"] = "T-STUB-COLUMNS"


def column_notes(ctx: Ctx, sheet: Sheet) -> None:
    """S-12's general notes, on its paper below the sections: how its sections read across a mark's
    bands, and the starter bars' foot and lap as the model builds every neck's dowels."""
    x0, y0 = 10.0, 10.0
    neck = next(m for m in ctx.at("COLUMN", "FDN"))
    dowel = next(b for b in ctx.bars if b["member"] == neck["id"] and b["bar_mark"].endswith("-d"))
    foot = f(dowel["legs"][1]) / int(dowel["dia"])
    assert foot == M.HOOK_90 and dowel["shape"] == "11" and dowel["lap_count"] == 1, dowel
    with sheet.paper.revision(APPENDED):
        sheet.paper.text("SECTIONS ARE TYPICAL FOR EVERY BAND OF THE MARK (S-11 GIVES EACH BAND'S SIZE "
                         "AND BARS)", (x0 + 170.0, y0 + 64.0), 3.0, "S-TEXT")
        sheet.paper.text(f"STARTER BARS: AS THE COLUMN MAIN BARS, {M.HOOK_90}d FOOT ON THE PILE CAP "
                         f"BOTTOM MESH, LAPPED {M.LAP_T}d AT GF", (x0 + 170.0, y0 + 57.0), 3.0, "S-TEXT",
                         fact=authored(M.HOOK_90))
