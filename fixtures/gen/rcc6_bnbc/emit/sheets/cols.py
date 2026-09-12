"""S-10 column layout, S-11 the column schedule, S-12 the column details.

Eleven of the fifty-two traps live on these three sheets: the feet-inch grid, the tag drawn over a
grid line, the ATTRIB-carried mark, the column drawn twice, the overridden dimension, the merged
band headers, the two-TEXT cell, the inch caption beside the millimetre cell, the revision cloud,
and the 1:20 detail drawn x5 under DIMLFAC.
"""

from __future__ import annotations

from ... import model as M
from .. import blocks as B
from ..scene import Scene
from ..scene import Sheet as _Sheet
from .common import Ctx, authored, draw_columns, draw_grid, f, fact, new_paper

#: The band headers the schedule prints, in the office's own spelling (T-NOT-RANGE-GF3).
BAND_HEADERS = [("GF-2F", "GF TO 2ND", "GF"), ("3F-4F", "3RD & 4TH", "3F"),
                ("5F-6F", "5TH TO 6TH", "5F"), ("ROOF-SRR", "ROOF-SRR", "ROOF")]


def s10(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-10")
    view = Scene()
    dims = draw_grid(view, dims=True, unit="ftin")
    # 15'-0" 14'-0" 9'-0" — an irregular grid dimensioned in the office's own units (T-NOT-FTIN)
    dims[("1", "2")]["trap"] = "T-NOT-FTIN"
    # the one dimension that disagrees with its geometry, under S-02's DO NOT SCALE (T-DIM-OVERRIDE)
    over = dims[("4", "5")]
    over["text"] = '14\'-2"'
    over["trap"] = "T-DIM-OVERRIDE"
    over["fact"] = authored(str(M.X["5"] - M.X["4"]))

    draw_columns(view, ctx, "GF", tags=False)
    for m in sorted(ctx.at("COLUMN", "GF"), key=lambda m: m["id"]):
        stack = ctx.stacks[m["stack"]]
        view.text(m["mark"], (f(m["cx"]) + 420.0, f(m["cy"]) - 620.0), 200.0, "S-TEXT", family="mark")
        if stack.get("rot_deg"):
            view.text("COLUMN ON GRID 1a, ROTATED 45%%D", (f(m["cx"]) + 700.0, f(m["cy"]) + 700.0),
                      190.0, "S-TEXT2")
    # the porch column is circular, and the floating column starts at 1F on TG1
    porch = next(m for m in ctx.at("COLUMN", "GF") if ctx.stacks[m["stack"]].get("porch"))
    view.circle((f(porch["cx"]), f(porch["cy"])), f(porch["b"]) / 2, "S-COLS")
    view.text("C7 %%C450 PORCH COLUMN", (f(porch["cx"]) + 600.0, f(porch["cy"])), 200.0, "S-TEXT2")
    fl = next(m for m in ctx.at("COLUMN", "1F") if ctx.stacks[m["stack"]].get("floating_on"))
    view.rect(f(fl["cx"]) - f(fl["sx"]) / 2, f(fl["cy"]) - f(fl["sy"]) / 2, f(fl["sx"]), f(fl["sy"]),
              "S-COLS", linetype="DASHED")
    view.text("C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)",
              (f(fl["cx"]) + 700.0, f(fl["cy"]) + 400.0), 190.0, "S-TEXT2")

    # C4 at D-5, drawn twice, the second exactly over the first (T-DUP-COLUMN)
    d5 = next(m for m in ctx.at("COLUMN", "GF") if m["stack"] == "D5")
    poly = [(f(x), f(y)) for x, y in M.column_poly(ctx.stacks["D5"], "GF")]
    dup = view.poly(poly, "S-COLS")
    dup["trap"] = "T-DUP-COLUMN"
    # the tag block whose ATTRIB carries the mark (T-BLOCK-ATTRIB)
    tag = view.insert("COL_TAG", (f(d5["cx"]) + 1100.0, f(d5["cy"]) + 1100.0), "S-GRIDT",
                      attribs={"MARK": "C-4"})
    tag["family"] = "mark"
    tag["trap"] = "T-BLOCK-ATTRIB"
    # a tag text dropped straight over a grid line and the bay dimension (T-TEXT-OVERLAP)
    ov = view.text("C-2", (f(M.X["3"]), f(M.Y["E"]) + 3800.0), 220.0, "S-TEXT",
                   align="MIDDLE_CENTER", family="mark", trap="T-TEXT-OVERLAP")
    ov["role"] = "overlap"
    view.insert("SECTION_MARK", (-3600.0, f(M.Y["C"])), "S-TEXT", attribs={"SEC": "A-A"})
    view.text("COLUMN POSITIONS ARE FACE-FLUSH ON THE OUTER FACE; SEE THE SCHEDULE ON S-11",
              (0.0, -4200.0), 240.0, "S-TEXT")
    p.view("COLUMN LAYOUT PLAN", view, 100, (p.x0 + 60.0, p.y0 + 120.0), (400.0, 340.0), "ftin")
    p.scale_bar((p.x0 + 60.0, p.y0 + 30.0), "m")
    return p.sheet()


def _band_spec(mark: str, storey: str) -> tuple[int, int, int, int]:
    spec = M.COLUMN_MARKS[mark]
    return spec["bands"][M._band_index(mark, storey)]


def s11(ctx: Ctx) -> _Sheet:
    p = new_paper(ctx, "S-11")
    sc = Scene()
    marks = ctx.marks_for("S-11")
    col_w = 4200.0
    row_h = 2600.0
    x_mark = 0.0
    w_mark = 2000.0
    top = 0.0

    # merged band headers spanning the four band columns (T-SCHED-MERGED, T-NOT-RANGE-GF3)
    sc.text("COLUMN SCHEDULE", (0.0, top + 2200.0), 400.0, "S-SHEET")
    merged = sc.line((x_mark, top + 900.0), (w_mark + 4 * col_w, top + 900.0), "S-LINE")
    merged["trap"] = "T-SCHED-MERGED"
    sc.line((x_mark, top), (w_mark + 4 * col_w, top), "S-LINE")
    sc.line((x_mark, top + 900.0), (x_mark, top), "S-LINE")
    for i, (_band, header, _storey) in enumerate(BAND_HEADERS):
        x = w_mark + i * col_w
        sc.line((x, top + 900.0), (x, top - row_h * len(marks)), "S-LINE")
        t = sc.text(header, (x + col_w / 2, top + 300.0), 260.0, "S-TEXT", align="CENTER",
                    family="range", trap="T-NOT-RANGE-GF3" if i == 0 else None)
        if i == 0:
            t["role"] = "band-header"
    sc.line((w_mark + 4 * col_w, top + 900.0), (w_mark + 4 * col_w, top - row_h * len(marks)),
            "S-LINE")
    sc.line((x_mark, top), (x_mark, top - row_h * len(marks)), "S-LINE")
    sc.text("MARK", (400.0, top + 300.0), 260.0, "S-TEXT")

    for r, mark in enumerate(marks):
        y = top - r * row_h
        sc.line((x_mark, y - row_h), (w_mark + 4 * col_w, y - row_h), "S-LINE")
        sc.text(mark, (400.0, y - row_h / 2), 300.0, "S-TEXT", family="mark")
        ties = M.COLUMN_MARKS[mark]["ties"]
        for i, (_band, _header, storey) in enumerate(BAND_HEADERS):
            b, d, n, dia = _band_spec(mark, storey)
            x = w_mark + i * col_w
            # a section sketch inside the cell — paint, never a placement (T-SCHED-MERGED)
            sk_w, sk_h = 900.0, 900.0 * d / max(b, 1)
            sk_h = min(sk_h, 1400.0)
            sc.rect(x + 200.0, y - row_h + 300.0, sk_w, sk_h, "S-COLS")
            for k in range(4):
                sc.circle((x + 300.0 + (k % 2) * (sk_w - 200.0),
                           y - row_h + 400.0 + (k // 2) * (sk_h - 200.0)), 40.0, "S-ROD")
            member = next((m for m in ctx.by_mark[mark] if m["level"] == storey), None)
            sc.text(f"{b}x{d}", (x + 1300.0, y - 500.0), 240.0, "S-TEXT", family="section",
                           fact=fact(member, "b") if member else authored(b))
            bars = f"{n}-{dia}%%C"
            if mark == "C3" and i == 0:
                # one cell, two TEXT entities, the second carrying the ties (T-SCHED-TWO-TEXTS)
                t1 = sc.text(bars, (x + 1300.0, y - 900.0), 240.0, "S-TEXT", family="diameter",
                             fact=authored(dia), trap="T-NOT-PCTC")
                t1["role"] = "two-texts-1"
                t2 = sc.text(f"TIES {ties[0]}%%C@{ties[1]}/{ties[2]}", (x + 1300.0, y - 1300.0),
                             240.0, "S-TEXT", family="diameter", fact=authored(ties[0]))
                t2["role"] = "two-texts-2"
                t2["trap"] = "T-SCHED-TWO-TEXTS"
            else:
                sc.text(bars, (x + 1300.0, y - 900.0), 240.0, "S-TEXT", family="diameter",
                        fact=authored(dia))
                sc.text(f"{ties[0]}%%C@{ties[1]}/{ties[2]} (TIES)", (x + 1300.0, y - 1300.0), 240.0,
                        "S-TEXT", family="diameter", fact=authored(ties[0]))
            if mark == "C4" and i == 1:
                cloud = B.rev_cloud(sc, x + 100.0, y - row_h + 150.0, col_w - 200.0, row_h - 300.0)
                cloud["trap"] = "T-REV-CLOUD"
                sc.text("2-20%%C EXTRA", (x + 1300.0, y - 1800.0), 240.0, "S-TEXT2",
                        family="diameter", fact=authored(20))
                sc.text("REV B", (x + col_w - 700.0, y - row_h + 250.0), 220.0, "S-REV")

    # the same section, restated in inches beside the millimetre cell (T-NOT-SIZE-IN)
    note_y = top - row_h * len(marks) - 900.0
    c2 = _band_spec("C2", "GF")
    sc.text("C2 GF TO 2ND:", (0.0, note_y), 260.0, "S-TEXT")
    a = sc.text('12"X24"', (3000.0, note_y), 260.0, "S-TEXT", family="section",
                fact=authored(f"{c2[0]}x{c2[1]}"), trap="T-NOT-SIZE-IN")
    a["role"] = "size-in"
    sc.text('12" x 24"', (5600.0, note_y), 260.0, "S-TEXT", family="section",
            fact=authored(f"{c2[0]}x{c2[1]}"), trap="T-NOT-SIZE-IN")
    sc.text(f"{c2[0]}x{c2[1]}", (8400.0, note_y), 260.0, "S-TEXT", family="section",
            fact=authored(f"{c2[0]}x{c2[1]}"))
    sc.text("THE MILLIMETRE CELL GOVERNS; THE INCH CAPTION IS A ROUNDED RESTATEMENT",
            (0.0, note_y - 600.0), 240.0, "S-TEXT")
    sc.text("ALL COLUMNS f'c = 3500 psi, fy = 500 MPa, 40 mm CLEAR COVER",
            (0.0, note_y - 1200.0), 240.0, "S-TEXT")
    p.view("COLUMN SCHEDULE", sc, 50, (p.x0 + 20.0, p.y0 + 34.0), (440.0, 522.0), "mm",
           caption="COLUMN SCHEDULE  (SECTIONS N.T.S.)")
    p.scale_bar((p.x0 + 470.0, p.y0 + 30.0), "m")
    return p.sheet()


def s12(ctx: Ctx) -> _Sheet:
    """Column sections at 1:20 — the scene is drawn x5 and every dimension carries DIMLFAC 0.2,
    so the printed text is the true millimetre while the geometry is five times it (T-DIMLFAC)."""
    p = new_paper(ctx, "S-12")
    k = 5.0
    marks = ctx.marks_for("S-11")
    for i, mark in enumerate(marks[:6]):
        b, d, n, dia = _band_spec(mark, "GF")
        ties = M.COLUMN_MARKS[mark]["ties"]
        cover = f(M.COVER["COLUMN"])
        sc = Scene()
        sc.rect(0.0, 0.0, b * k, d * k, "S-COLS")
        sc.rect(cover * k, cover * k, (b - 2 * cover) * k, (d - 2 * cover) * k, "S-STIR")
        per = max(2, n // 2)
        for j in range(n):
            side = j // per
            t = (j % per) / max(per - 1, 1)
            x = (cover + 20 + t * (b - 2 * cover - 40)) * k
            y = (cover + 20 + side * (d - 2 * cover - 40)) * k
            sc.circle((x, y), dia * k / 2, "S-ROD")
        sc.text(mark, (0.0, d * k + 700.0), 320.0, "S-TEXT", family="mark")
        sc.text(f"{n}-{dia}%%C", (b * k + 400.0, d * k * 0.7), 260.0, "S-TEXT2", family="diameter",
                fact=authored(dia))
        sc.text(f"{ties[0]}%%C@{ties[1]}/{ties[2]} (TIES)", (b * k + 400.0, d * k * 0.45), 260.0,
                "S-TEXT2", family="diameter", fact=authored(ties[1]))
        dm = sc.dim((0.0, 0.0), (b * k, 0.0), (0.0, -900.0), 0.0, 260.0, "S-DIMS", dimlfac=1 / k,
                    fact=authored(b))
        if i == 0:
            dm["trap"] = "T-DIMLFAC"
        sc.dim((0.0, 0.0), (0.0, d * k), (-900.0, 0.0), 90.0, 260.0, "S-DIMS", dimlfac=1 / k,
               fact=authored(d))
        col, row = i % 3, i // 3
        p.view(f"{mark} SECTION", sc, 100,
               (p.x0 + 12.0 + col * 160.0, p.y0 + p.win_h - 140.0 - row * 160.0), (150.0, 130.0), "mm",
               caption=f"{mark} SECTION  SCALE 1:20 (DRAWN x5, DIMLFAC 0.2)")
    p.scale_bar((p.x0 + 12.0, p.y0 + 20.0), "m")
    return p.sheet()
