"""S-00 cover and index, S-01/S-02 general notes, S-03 typical reinforcement details.

The notes sheets are the fixture's grammar lesson: every notation family the product must read is
stated here once, in the office's own words (T-NOT-FC-PSI, T-NOT-FY, T-NOT-COVER, T-MTEXT-CODES,
T-NOTE-OVERRIDE), and the AM-02/AM-03 conventions `model.CONVENTIONS` carries are printed verbatim.
"""

from __future__ import annotations

from ... import model as M
from .. import images, plan
from ..scene import Scene, Sheet
from .common import Ctx, authored, new_paper

STYLE = "Swis721 Cn BT"


def s00(ctx: Ctx) -> Sheet:
    p = new_paper(ctx, "S-00")
    s = p.scene
    x0, y0, w, h = p.x0, p.y0, p.win_w, p.win_h
    top = y0 + h
    # the consultant's logo, an IMAGE the reader lists and never measures (T-IMAGE-LOGO)
    logo = s.image(images.LOGO, (x0 + 6.0, top - 36.0), (60.0, 30.0), "S-IMAGE")
    logo["trap"] = "T-IMAGE-LOGO"
    s.text(plan.IDENTITY["project"], (x0 + 76.0, top - 16.0), 6.0, "S-TEXT")
    # the Bengali title beside the English one — DXF/DWG only (W-03, T-BENGALI)
    s.text(plan.IDENTITY["project_bn"], (x0 + 76.0, top - 26.0), 5.0, "S-TEXT", trap="T-BENGALI")
    s.text(plan.IDENTITY["site"], (x0 + 76.0, top - 34.0), 3.2, "S-TEXT")
    s.text(f"FOR {plan.IDENTITY['client']}", (x0 + 76.0, top - 40.0), 3.2, "S-TEXT")
    s.text(f"RAJUK REF. {plan.IDENTITY['rajuk_ref']}", (x0 + 76.0, top - 46.0), 3.2, "S-TEXT")
    s.line((x0 + 4.0, top - 52.0), (x0 + w - 4.0, top - 52.0), "S-SHEET")

    s.text("DRAWING INDEX", (x0 + 6.0, top - 62.0), 4.5, "S-SHEET")
    rows = [
        [n, t[:46], size, scales, plan.REVISIONS[-1][0]]
        for (n, t, size, scales, _kind, _tr) in plan.SHEETS
    ]
    _index(s, x0 + 6.0, top - 68.0, rows)

    # the location map: a fictional sketch of the block, never a georeference
    mx, my = x0 + 300.0, y0 + 40.0
    s.text("LOCATION MAP  (N.T.S.)", (mx, my + 118.0), 4.0, "S-SHEET")
    s.rect(mx, my, 150.0, 112.0, "S-SHEET")
    s.rect(mx + 46.0, my + 40.0, 34.0, 30.0, "S-SLAB")
    s.hatch([[(mx + 46.0, my + 40.0), (mx + 80.0, my + 40.0), (mx + 80.0, my + 70.0), (mx + 46.0, my + 70.0)]],
            "S-HATCH", pattern="ANSI31", scale=2.0)
    s.text("PLOT 23", (mx + 63.0, my + 54.0), 3.0, "S-TEXT", align="MIDDLE_CENTER")
    for yy, name in ((my + 34.0, "ROAD 7"), (my + 76.0, "ROAD 9")):
        s.line((mx + 6.0, yy), (mx + 144.0, yy), "S-SHEET")
        s.line((mx + 6.0, yy + 5.0), (mx + 144.0, yy + 5.0), "S-SHEET")
        s.text(name, (mx + 10.0, yy + 1.2), 2.6, "S-TEXT")
    s.line((mx + 40.0, my + 6.0), (mx + 40.0, my + 106.0), "S-SHEET")
    s.line((mx + 45.0, my + 6.0), (mx + 45.0, my + 106.0), "S-SHEET")
    s.text("BLOCK C AVENUE", (mx + 41.5, my + 60.0), 2.6, "S-TEXT", rotation=90.0)
    s.insert("NORTH_ARROW", (mx + 138.0, my + 104.0), "S-ARROW")
    s.insert("KEY_PLAN", (x0 + 240.0, y0 + 50.0), "S-SHEET")
    p.scale_bar((x0 + 6.0, y0 + 6.0), "m")
    return p.sheet()


def _index(s: Scene, x: float, y: float, rows: list[list[str]]) -> None:
    widths = [18.0, 118.0, 14.0, 30.0, 12.0]
    row_h = 5.6
    header = ["SHEET", "TITLE", "SIZE", "SCALE", "REV"]
    lines = [header, *rows]
    total = sum(widths)
    for r in range(len(lines) + 1):
        s.line((x, y - r * row_h), (x + total, y - r * row_h), "S-LINE")
    cx = x
    for wdt in [*widths, 0.0]:
        s.line((cx, y), (cx, y - len(lines) * row_h), "S-LINE")
        cx += wdt
    for r, cells in enumerate(lines):
        cx = x
        for cell, wdt in zip(cells, widths, strict=True):
            s.text(cell, (cx + 1.2, y - (r + 1) * row_h + 1.6), 2.6, "S-TEXT")
            cx += wdt


# -- S-01 / S-02 the general notes ---------------------------------------------------------------

_NOTES_1 = (
    r"{\f" + STYLE + r"|b1|i0|c0|p34;\LGENERAL NOTES}\P"
    r"\A1;1. THESE DRAWINGS SHALL BE READ WITH THE ARCHITECTURAL AND MEP DRAWINGS. "
    r"ANY DISCREPANCY SHALL BE REFERRED TO THE ENGINEER BEFORE WORK PROCEEDS.\P"
    r"2. DESIGN CODE: BNBC 2020, ACI 318-19 WHERE THE CODE IS SILENT.\P"
    r"3. IMPOSED LOAD 2.0 kN/m%%2 (RESIDENTIAL), PARTITION 1.5 kN/m%%2, "
    r"FINISH 1.2 kN/m%%2. BASIC WIND SPEED 65.7 m/s, SEISMIC ZONE 2 (Z=0.20).\P"
    r"4. ALL DIMENSIONS ARE IN MILLIMETRES UNLESS FIGURED IN FEET AND INCHES. "
    r"LEVELS ARE IN METRES ABOVE P.L.\P"
    r"5. {\LDO NOT SCALE THIS DRAWING} - FIGURED DIMENSIONS GOVERN.\P"
)
_NOTES_2 = (
    r"{\f" + STYLE + r"|b1|i0|c0|p34;\LCONCRETE AND REINFORCEMENT}\P"
    r"6. CONCRETE: CYLINDER STRENGTH AT 28 DAYS AS NOTED BELOW. CEMENT CEM-I 52.5N. "
    r"MAXIMUM AGGREGATE 20 mm, SLUMP 100 %%P 25 mm.\P"
    r"7. REINFORCEMENT: DEFORMED BARS TO BDS ISO 6935-2.\P"
    r"8. BAR LETTERS: T AND Y BOTH MEAN A DEFORMED BAR OF THE DIAMETER THAT FOLLOWS "
    r"(T16 = Y16 = 16%%C). A SECOND DRAUGHTSMAN'S SHEET MAY MIX THEM ON ONE LINE.\P"
    r"9. LEGACY IMPERIAL BAR CALLS: #3 = 10%%C, #4 = 12%%C, #5 = 16%%C, #6 = 20%%C, #8 = 25%%C.\P"
    r"10. WELDED HOOKS ARE NOT PERMITTED. ALL HOOKS 135%%D WHERE SHOWN ON S-03.\P"
)


def s01(ctx: Ctx) -> Sheet:
    p = new_paper(ctx, "S-01")
    s = p.scene
    x0, y0, w, h = p.x0, p.y0, p.win_w, p.win_h
    top = y0 + h
    notes = s.mtext(_NOTES_1, (x0 + 6.0, top - 8.0), 3.0, w - 180.0, "S-TEXT",
                    style=STYLE, trap="T-MTEXT-CODES")
    notes["role"] = "notes"
    s.mtext(_NOTES_2, (x0 + 6.0, top - 96.0), 3.0, w - 180.0, "S-TEXT", style=STYLE)

    # the grades, in the office's own units (T-NOT-FC-PSI, T-NOT-FY)
    gy = top - 196.0
    s.text("MATERIALS", (x0 + 6.0, gy + 10.0), 4.0, "S-SHEET")
    s.text("f'c = 3500 psi (24 MPa) cylinder", (x0 + 6.0, gy), 3.2, "S-TEXT",
           family="grade", fact=authored("3500"), trap="T-NOT-FC-PSI")
    s.text("f'c = 3000 psi (BORED PILES)", (x0 + 6.0, gy - 6.0), 3.2, "S-TEXT", family="grade",
           fact=authored("3000"))
    s.text("fy = 72,500 psi (500 MPa) BDS ISO 6935-2 B500DWR", (x0 + 6.0, gy - 12.0), 3.2, "S-TEXT",
           family="grade", fact=authored("500"), trap="T-NOT-FY")
    s.text("B500DWR", (x0 + 6.0, gy - 18.0), 3.2, "S-TEXT", family="grade")

    # clear cover, in both units, the drawing's value governing (T-NOT-COVER, DECISIONS D-07)
    cy = gy - 32.0
    s.text("CLEAR COVER", (x0 + 6.0, cy + 10.0), 4.0, "S-SHEET")
    s.text('2" clear cover (pile caps)', (x0 + 6.0, cy), 3.2, "S-TEXT", family="cover",
           fact=authored("50.8"), trap="T-NOT-COVER")
    s.text("25mm clear cover (beams)", (x0 + 70.0, cy), 3.2, "S-TEXT", family="cover",
           fact=authored(M.COVER["BEAM"]))
    s.text("40mm clear cover (columns)", (x0 + 140.0, cy), 3.2, "S-TEXT", family="cover",
           fact=authored(M.COVER["COLUMN"]))
    s.text("20mm clear cover (slabs)", (x0 + 212.0, cy), 3.2, "S-TEXT", family="cover",
           fact=authored(M.COVER["SLAB"]))

    # the measurement conventions this fixture is built on, printed as notes (AM-02 / AM-03)
    ny = cy - 16.0
    s.text("MEASUREMENT CONVENTIONS (AM-02 / AM-03)", (x0 + 6.0, ny), 4.0, "S-SHEET")
    line = ny - 6.0
    for key in sorted(M.CONVENTIONS):
        value = M.CONVENTIONS[key]
        for part in (value if isinstance(value, list) else [str(value)]):
            s.mtext(f"{key.upper().replace('_', ' ')}: {part}", (x0 + 6.0, line), 2.4, w - 180.0, "S-TEXT")
            line -= 8.0
    s.text("DO NOT SCALE", (x0 + w - 70.0, y0 + 6.0), 5.0, "S-TEXT")
    return p.sheet()


def s02(ctx: Ctx) -> Sheet:
    p = new_paper(ctx, "S-02")
    s = p.scene
    x0, y0, w, h = p.x0, p.y0, p.win_w, p.win_h
    top = y0 + h
    s.mtext(
        r"{\f" + STYLE + r"|b1|i0|c0|p34;\LDETAILING NOTES}\P"
        r"11. LAPS SHALL BE STAGGERED; NOT MORE THAN 50%%% OF BARS MAY BE LAPPED AT ONE SECTION. "
        r"NO LAP WITHIN A BEAM-COLUMN JOINT.\P"
        r"12. TOP BARS OVER SUPPORTS SHALL EXTEND L/4 EACH SIDE OF THE SUPPORT FACE, "
        r"BOTTOM BARS L/5, UNLESS THE LONG SECTION SHOWS OTHERWISE.\P"
        r"13. STIRRUP ZONES: 2D FROM EACH SUPPORT FACE AT THE CLOSE SPACING, "
        r"THE MIDDLE AT THE WIDE SPACING.\P"
        r"14. CHAIRS AT 1.0 m c/c BOTH WAYS IN EVERY DOUBLE-LAYER SLAB AND RAFT.\P",
        (x0 + 6.0, top - 8.0), 3.0, w - 180.0, "S-TEXT", style=STYLE,
    )
    # the lap note that overrides the code table (J-032, T-NOTE-OVERRIDE)
    ly = top - 70.0
    s.text("LAP 50d TENSION / 40d COMPRESSION U.N.O.", (x0 + 6.0, ly), 4.2, "S-TEXT",
           fact=authored(M.LAP_T), trap="T-NOTE-OVERRIDE")
    s.text("(THIS NOTE GOVERNS OVER THE CODE TABLE)", (x0 + 6.0, ly - 6.0), 2.6, "S-TEXT")

    ty = ly - 16.0
    s.text("DEVELOPMENT LENGTH ld  -  fy 500 MPa, f'c 3500 psi", (x0 + 6.0, ty), 4.0, "S-SHEET")
    rows = [
        [f"{d}%%C", f"{M.LD * d}", f"{M.LD_TOP * d}", f"{M.LAP_T * d}", f"{M.LAP_C * d}"]
        for d in sorted(M.KG_PER_M)
    ]
    _ld_table(s, x0 + 6.0, ty - 4.0,
              ["BAR", "ld BOTTOM (mm)", "ld TOP (mm)", "LAP TENSION (mm)", "LAP COMPRESSION (mm)"], rows)
    s.text("BAR BENDING TO BS 8666; THE IS ADDITIVE FIGURE IS PRINTED BESIDE IT ON S-26.",
           (x0 + 6.0, ty - 60.0), 2.8, "S-TEXT")
    s.text("DO NOT SCALE", (x0 + w - 70.0, y0 + 6.0), 5.0, "S-TEXT")
    return p.sheet()


def _ld_table(s: Scene, x: float, y: float, header: list[str], rows: list[list[str]]) -> None:
    widths = [26.0, 40.0, 40.0, 46.0, 52.0]
    row_h = 7.0
    lines = [header, *rows]
    total = sum(widths)
    for r in range(len(lines) + 1):
        s.line((x, y - r * row_h), (x + total, y - r * row_h), "S-LINE")
    cx = x
    for wdt in [*widths, 0.0]:
        s.line((cx, y), (cx, y - len(lines) * row_h), "S-LINE")
        cx += wdt
    for r, cells in enumerate(lines):
        cx = x
        for i, (cell, wdt) in enumerate(zip(cells, widths, strict=True)):
            fam = "diameter" if (r > 0 and i == 0) else ("number" if r > 0 else "plain")
            s.text(cell, (cx + 1.4, y - (r + 1) * row_h + 2.2), 2.8, "S-TEXT", family=fam)
            cx += wdt


# -- S-03 typical details ------------------------------------------------------------------------


def s03(ctx: Ctx) -> Sheet:
    p = new_paper(ctx, "S-03")
    s = p.scene
    x0, y0, h = p.x0, p.y0, p.win_h
    # a 135 degrees hook, drawn at real size and viewed at 1:20
    hook = Scene()
    b, d, c = 450.0, 600.0, float(M.COVER["BEAM"])
    hook.rect(0.0, 0.0, b, d, "S-BEAM")
    hook.rect(c, c, b - 2 * c, d - 2 * c, "S-STIR")
    hook.line((b - c, d - c), (b - c - 160.0, d - c - 160.0), "S-STIR")
    hook.line((c, d - c), (c + 160.0, d - c - 160.0), "S-STIR")
    hook.text("135%%D HOOK, 10d EXTENSION, MIN 75", (b + 200.0, d - 100.0), 60.0, "S-TEXT2")
    hook.text("TYPICAL STIRRUP / TIE", (b + 200.0, d - 200.0), 60.0, "S-TEXT2")
    hook.text("10%%C @ 100 c/c", (b + 200.0, d - 300.0), 60.0, "S-TEXT2", family="diameter",
              fact=authored(100))
    hook.dim((0.0, 0.0), (b, 0.0), (0.0, -300.0), 0.0, 60.0, "S-DIMS")
    p.view("TYPICAL STIRRUP HOOK DETAIL", hook, 20, (x0 + 10.0, y0 + h - 130.0), (110.0, 110.0), "mm")

    crank = Scene()
    crank.poly([(0.0, 0.0), (900.0, 0.0), (1200.0, 250.0), (2400.0, 250.0)], "S-ROD", closed=False)
    crank.poly([(0.0, 250.0), (2400.0, 250.0)], "S-ROD2", closed=False)
    crank.text("CRANK 1:6 AT L/5 FROM THE SUPPORT FACE", (0.0, 400.0), 60.0, "S-TEXT2")
    crank.text("L/5", (900.0, -160.0), 60.0, "S-TEXT2", family="length")
    crank.dim((0.0, 0.0), (900.0, 0.0), (0.0, -300.0), 0.0, 60.0, "S-DIMS")
    p.view("TYPICAL SLAB BAR CRANK", crank, 20, (x0 + 140.0, y0 + h - 130.0), (130.0, 110.0), "mm")

    shapes = Scene()
    for i, (code, legs) in enumerate((("21", "A + B + C"), ("51", "2(A+B) + 2C - 2.5r - 5d"),
                                      ("11", "A + (B) hook"), ("00", "A  straight"))):
        yy = -i * 700.0
        shapes.rect(0.0, yy, 900.0, 400.0, "S-ROD")
        shapes.text(f"SHAPE {code}", (1000.0, yy + 250.0), 110.0, "S-TEXT2")
        shapes.text(legs, (1000.0, yy + 80.0), 90.0, "S-TEXT2")
    shapes.text("BS 8666 SHAPE CODES USED IN THE BAR BENDING SCHEDULE", (0.0, 500.0), 110.0, "S-TEXT2")
    p.view("BAR SHAPE CODES", shapes, 25, (x0 + 290.0, y0 + h - 130.0), (140.0, 110.0), "mm")

    # a detail somebody pasted in from a scan and never redrew (F-SCAN seed)
    scan = s.image(images.SCAN, (x0 + 20.0, y0 + 24.0), (120.0, 80.0), "S-IMAGE")
    scan["role"] = "scan"
    s.text("PASTED DETAIL - HOOK (SCANNED FROM THE STANDARD SHEET)", (x0 + 20.0, y0 + 18.0), 3.0, "S-TEXT")
    s.text(f"HOOK 135%%D = {M.HOOK_135}d, MIN 75 mm; 90%%D = {M.HOOK_90}d", (x0 + 160.0, y0 + 60.0),
           3.4, "S-TEXT", fact=authored(M.HOOK_135))
    p.scale_bar((x0 + 160.0, y0 + 24.0), "m")
    return p.sheet()
