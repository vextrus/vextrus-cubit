"""The block library — every named block the 26 sheets insert (E-fixture §3.4, Wave B D1).

Public API (Implementer B and `emit.sheets` call exactly these):

    library() -> list[scene.Block]              every block, in a fixed order (definition order)
    title_attribs(number, title, scales, rev)   the ATTRIB values one sheet's TITLE_BLOCK carries
    title_strip(paper, number, title, scales)   the title-block INSERT + revision rows on a paper scene
    bound_xref_content(sc, ox, oy)              the bound-xref walls/doors/windows (T-XREF-BOUND)

Paper-space blocks (TITLE_BLOCK, KEY_PLAN, NORTH_ARROW, SCALE_BAR) are authored in paper
millimetres; model-space blocks (COL_TAG, GRID_BUBBLE, SECTION_MARK, LEVEL_MARK, the PC3 nest)
are authored in real millimetres, so a 1:100 view prints them at a draughtsman's size.

Nothing is measured here: a block's content is derived paint on the product's side (ingest explodes
an INSERT), and an ATTRIB is never content. Every authored number a sheet *prints* is attached to
its TEXT by the composer with `fact=`, not restated here.
"""

from __future__ import annotations

from .. import model as M
from . import plan
from .scene import PAPER_MM, Block, Scene, bulge_for_arc

# -- paper geometry ---------------------------------------------------------------------------

BORDER = 10.0  #: the sheet border inset, every paper size
STRIP_W = 60.0  #: the right-hand title strip's width
STRIP_H = 277.0  #: its height — an A3 window is 277 mm tall, so one block serves all three sizes
REV_ROWS = 3.5  #: a revision row's height


def window(size: str) -> tuple[float, float, float, float]:
    """The drawing window of a paper size: (x0, y0, w, h), border and title strip removed."""
    w, h = PAPER_MM[size]
    return (BORDER, BORDER, w - 2 * BORDER - STRIP_W, h - 2 * BORDER)


def strip_origin(size: str) -> tuple[float, float]:
    """Where TITLE_BLOCK is inserted: the top-left of the right-hand strip."""
    w, h = PAPER_MM[size]
    return (w - BORDER - STRIP_W, h - BORDER)


# -- TITLE_BLOCK ------------------------------------------------------------------------------

_I = plan.IDENTITY


def _title_block() -> Block:
    """The Dhaka title block: consultant, client, project, site, sheet cell, the signature row,
    the RAJUK reference, the job number and the revision table — drawn downward from (0, 0)."""
    s = Scene()
    s.rect(0.0, -STRIP_H, STRIP_W, STRIP_H, "S-TITLE")
    y = 0.0

    def rule(at: float) -> None:
        s.line((0.0, at), (STRIP_W, at), "S-TITLE")

    def label(text: str, at: float, h: float = 1.8) -> None:
        s.text(text, (1.5, at), h, "S-TITLE")

    # consultant
    s.text(_I["consultant"][:28], (2.0, y - 6.0), 2.6, "S-TITLE")
    s.text(_I["consultant"][28:] or "STRUCTURAL ENGINEERS", (2.0, y - 9.5), 2.6, "S-TITLE")
    s.text(_I["consultant_address"], (2.0, y - 13.0), 1.5, "S-TITLE")
    s.text(f"TEL {_I['consultant_phone']}", (2.0, y - 16.0), 1.5, "S-TITLE")
    rule(y - 18.0)
    # client
    label("CLIENT", y - 21.5)
    s.text(_I["client"], (2.0, y - 26.0), 2.2, "S-TITLE")
    rule(y - 29.0)
    # project (English; the Bengali line is a TEXT on S-00 only — T-BENGALI)
    label("PROJECT", y - 32.5)
    s.text(_I["project"][:30], (2.0, y - 37.0), 2.2, "S-TITLE")
    s.text(_I["project"][30:] or "AT BASHUNDHARA R/A", (2.0, y - 40.5), 2.2, "S-TITLE")
    rule(y - 43.0)
    # site
    label("SITE", y - 46.5)
    s.text(_I["site"][:30], (2.0, y - 51.0), 1.8, "S-TITLE")
    s.text(_I["site"][30:], (2.0, y - 54.5), 1.8, "S-TITLE")
    rule(y - 57.0)
    # sheet title (ATTDEF)
    label("SHEET TITLE", y - 60.5)
    rule(y - 76.0)
    # signature row
    for i, (tag, who) in enumerate(
        (("DESIGNED", _I["designed"]), ("DRAWN", _I["drawn"]), ("CHECKED", _I["checked"]), ("APPROVED", _I["approved"]))
    ):
        x = i * STRIP_W / 4
        s.line((x, y - 76.0), (x, y - 88.0), "S-TITLE")
        s.text(tag, (x + 0.8, y - 79.5), 1.3, "S-TITLE")
        s.text(who, (x + 0.8, y - 85.0), 2.4, "S-TITLE")
    rule(y - 88.0)
    # RAJUK / job no
    label("RAJUK REF.", y - 91.5)
    s.text(_I["rajuk_ref"], (22.0, y - 91.5), 2.0, "S-TITLE")
    rule(y - 94.0)
    label("JOB NO.", y - 97.5)
    rule(y - 100.0)
    label("DATE", y - 103.5)
    rule(y - 106.0)
    label("SCALE", y - 109.5)
    rule(y - 112.0)
    # sheet number and revision
    s.line((STRIP_W * 0.66, y - 112.0), (STRIP_W * 0.66, y - 126.0), "S-TITLE")
    label("SHEET NO.", y - 115.0, 1.5)
    s.text("REV.", (STRIP_W * 0.66 + 1.5, y - 115.0), 1.5, "S-TITLE")
    rule(y - 126.0)
    # revision table (rulings; the rows themselves are TEXTs on each sheet's paper scene)
    s.text("REVISIONS", (2.0, y - 130.0), 1.8, "S-TITLE")
    top = y - 132.0
    rule(top)
    for i in range(len(plan.REVISIONS) + 2):
        rule(top - i * REV_ROWS)
    for x in (6.0, 22.0):
        s.line((x, top), (x, top - (len(plan.REVISIONS) + 1) * REV_ROWS), "S-TITLE")
    s.text("REV", (1.0, top - 2.6), 1.4, "S-TITLE")
    s.text("DATE", (7.0, top - 2.6), 1.4, "S-TITLE")
    s.text("DESCRIPTION", (23.0, top - 2.6), 1.4, "S-TITLE")
    # the office footer
    s.text("ALL DIMENSIONS IN mm U.N.O.", (2.0, -STRIP_H + 8.0), 1.5, "S-TITLE")
    s.text("DO NOT SCALE THIS DRAWING", (2.0, -STRIP_H + 4.0), 1.5, "S-TITLE")
    attdefs = [
        ("SHEETTITLE", "SHEET TITLE", (2.0, -64.5), 2.4, "SHEET TITLE"),
        ("SHEETTITLE2", "SHEET TITLE CONT.", (2.0, -68.5), 2.4, ""),
        ("JOBNO", "JOB NO", (22.0, -97.5), 2.0, _I["job_no"]),
        ("DATE", "DATE", (22.0, -103.5), 2.0, _I["date"]),
        ("SCALE", "SCALE", (22.0, -109.5), 2.0, "1:100"),
        ("SHEETNO", "SHEET NO", (2.0, -122.0), 4.5, "S-00"),
        ("REV", "REV", (STRIP_W * 0.66 + 1.5, -122.0), 4.5, "B"),
    ]
    return Block("TITLE_BLOCK", s, attdefs=attdefs)


def title_attribs(number: str, title: str, scales: str, revision: str) -> dict[str, str]:
    """The ATTRIB values one sheet's TITLE_BLOCK insert carries (ATTRIB is never content)."""
    return {
        "SHEETTITLE": title[:30],
        "SHEETTITLE2": title[30:60],
        "JOBNO": _I["job_no"],
        "DATE": _I["date"],
        "SCALE": scales,
        "SHEETNO": number,
        "REV": revision,
    }


def title_strip(paper: Scene, size: str, number: str, title: str, scales: str, revision: str) -> dict:
    """Insert TITLE_BLOCK on a paper scene and write the revision rows into its table.

    Returns the sheet-title TEXT item (the anchor a document-level trap resolves to, W-06)."""
    ox, oy = strip_origin(size)
    paper.insert("TITLE_BLOCK", (ox, oy), "S-TITLE", attribs=title_attribs(number, title, scales, revision))
    top = oy - 132.0
    for i, (rev, date, what) in enumerate(plan.REVISIONS):
        y = top - (i + 2) * REV_ROWS + 1.0
        paper.text(rev, (ox + 1.5, y), 1.6, "S-TITLE")
        paper.text(date, (ox + 7.0, y), 1.6, "S-TITLE")
        paper.text(what[:34], (ox + 23.0, y), 1.4, "S-TITLE")
    # the sheet's own title, drawn as an original TEXT beside the strip: W-06's trap anchor
    item = paper.text(f"{number}  {title}", (BORDER + 2.0, BORDER + 2.0), 3.2, "S-SHEET")
    item["role"] = "sheet-title"
    return item


# -- the small blocks -------------------------------------------------------------------------


def _north_arrow() -> Block:
    s = Scene()
    s.solid([(0.0, 0.0), (-3.0, -9.0), (0.0, -6.0)], "S-ARROW")
    s.poly([(0.0, 0.0), (3.0, -9.0), (0.0, -6.0)], "S-ARROW")
    s.circle((0.0, -4.5), 10.0, "S-ARROW")
    s.text("N", (0.0, 3.0), 3.5, "S-TEXT", align="CENTER")
    return Block("NORTH_ARROW", s)


def _key_plan() -> Block:
    """The mini key plan at 1:1000 (T-KEYPLAN): the building outline with grid bubbles 1-6 / A-E.

    The bubbles are 1.2 mm circles at a thousandth of the real grid — deliberately NOT a second
    grid to georeference against."""
    k = 1.0 / 1000.0
    xs = [float(M.X[n]) * k for n in M.XN]
    ys = [float(M.Y[n]) * k for n in M.YL]
    s = Scene()
    s.rect(xs[0], ys[0], xs[-1] - xs[0], ys[-1] - ys[0], "S-SHEET")
    for x, name in zip(xs, M.XN, strict=True):
        s.line((x, ys[0]), (x, ys[-1] + 2.0), "S-GRID")
        s.circle((x, ys[-1] + 3.2), 1.2, "S-GRIDC")
        s.text(name, (x, ys[-1] + 3.2), 1.1, "S-GRIDT", align="MIDDLE_CENTER", family="grid")
    for y, name in zip(ys, M.YL, strict=True):
        s.line((xs[0] - 2.0, y), (xs[-1], y), "S-GRID")
        s.circle((xs[0] - 3.2, y), 1.2, "S-GRIDC")
        s.text(name, (xs[0] - 3.2, y), 1.1, "S-GRIDT", align="MIDDLE_CENTER", family="grid")
    s.text("KEY PLAN  1:1000", (xs[0] - 3.2, ys[0] - 4.0), 1.8, "S-SHEET")
    return Block("KEY_PLAN", s)


def _col_tag() -> Block:
    s = Scene()
    s.circle((0.0, 0.0), 450.0, "S-GRIDC")
    return Block("COL_TAG", s, attdefs=[("MARK", "COLUMN MARK", (0.0, -140.0), 280.0, "C-0")])


def _grid_bubble() -> Block:
    s = Scene()
    s.circle((0.0, 0.0), 500.0, "S-GRIDC")
    return Block("GRID_BUBBLE", s, attdefs=[("GRID", "GRID", (0.0, -160.0), 320.0, "A")])


def _section_mark() -> Block:
    s = Scene()
    s.arc((0.0, 0.0), 600.0, 90.0, 270.0, "S-TEXT")
    s.line((0.0, -600.0), (0.0, 600.0), "S-TEXT")
    s.solid([(600.0, 0.0), (1400.0, 250.0), (1400.0, -250.0)], "S-ARROW")
    return Block("SECTION_MARK", s, attdefs=[("SEC", "SECTION", (-300.0, -160.0), 320.0, "A-A")])


def _scale_bar() -> Block:
    """A 50 mm paper bar in five parts — the instrument that says what 1:100 means (AFFIRM_SCALE)."""
    s = Scene()
    for i in range(5):
        x = i * 10.0
        s.rect(x, 0.0, 10.0, 2.0, "S-SHEET")
        if i % 2 == 0:
            s.hatch([[(x, 0.0), (x + 10.0, 0.0), (x + 10.0, 2.0), (x, 2.0)]], "S-SHEET", solid=True)
    for i in range(6):
        s.text(str(i), (i * 10.0, -4.0), 2.0, "S-SHEET", align="CENTER", family="number")
    return Block("SCALE_BAR", s, attdefs=[("UNIT", "UNIT", (52.0, -4.0), 2.0, "m")])


def _level_mark() -> Block:
    s = Scene()
    s.solid([(0.0, 0.0), (-300.0, 450.0), (300.0, 450.0)], "S-TEXT")
    s.line((-900.0, 450.0), (900.0, 450.0), "S-TEXT")
    return Block("LEVEL_MARK", s, attdefs=[("LEVEL", "LEVEL", (-800.0, 600.0), 280.0, "EL +0.000")])


def _pc3_nest() -> list[Block]:
    """The 3-deep nested PC3 detail (T-BLOCK-NESTED): PC3_DETAIL inserts PC3_CAGE scaled (2, 1),
    which inserts PC3_BAR mirrored (-1, 1). A flattening reader must carry the whole transform."""
    bar = Scene()
    bar.poly([(0.0, 0.0), (0.0, 300.0), (600.0, 300.0)], "S-ROD", closed=False)
    bar.text("PC3-bx", (620.0, 300.0), 90.0, "S-TEXT2", family="mark")
    cage = Scene()
    cage.insert("PC3_BAR", (0.0, 0.0), "S-ROD", scale=(-1.0, 1.0))
    cage.line((-600.0, -100.0), (600.0, -100.0), "S-ROD")
    detail = Scene()
    detail.insert("PC3_CAGE", (0.0, 0.0), "S-ROD", scale=(2.0, 1.0))
    detail.rect(-1000.0, -1295.4, 2000.0, 1295.4, "S-FDN")
    return [Block("PC3_BAR", bar), Block("PC3_CAGE", cage), Block("PC3_DETAIL", detail)]


def _lintel_row() -> Block:
    """One row of the lintel schedule, as an ATTRIB-block: the cells are the attributes
    (T-SCHED-ATTRIB). The rulings belong to the block; the values to each INSERT."""
    s = Scene()
    s.line((0.0, 0.0), (11000.0, 0.0), "S-LINE")
    s.line((0.0, -700.0), (11000.0, -700.0), "S-LINE")
    for x in (0.0, 1800.0, 4200.0, 8200.0, 11000.0):
        s.line((x, 0.0), (x, -700.0), "S-LINE")
    return Block(
        "LINTEL_ROW",
        s,
        attdefs=[
            ("MARK", "MARK", (200.0, -500.0), 240.0, "L0"),
            ("SIZE", "SIZE", (2000.0, -500.0), 240.0, "250x150"),
            ("BARS", "BARS", (4400.0, -500.0), 240.0, "2-12%%C T&B"),
            ("OPENING", "OPENING", (8400.0, -500.0), 240.0, "1000"),
        ],
    )


def _arch_xref() -> Block:
    """The xref block itself — its content lives in arch-plan.dxf, never in this drawing."""
    return Block("ARCH-PLAN", Scene(), xref="arch-plan.dwg")


def bound_xref_content(s: Scene, ox: float, oy: float) -> None:
    """The bound xref's architecture, drawn as originals on ARCH-PLAN$0$… layers (T-XREF-BOUND):
    partition walls, door swings and window lines — context, never a structural member."""
    for i in range(4):
        y = oy + i * 3000.0
        s.line((ox, y), (ox + 9000.0, y), "X-WALL")
        s.line((ox, y + 125.0), (ox + 9000.0, y + 125.0), "X-WALL")
        s.arc((ox + 2000.0, y + 125.0), 900.0, 0.0, 90.0, "X-DOOR")
        s.line((ox + 2000.0, y + 125.0), (ox + 2000.0, y + 1025.0), "X-DOOR")
        s.line((ox + 5000.0, y), (ox + 6800.0, y), "X-WIN")
        s.line((ox + 5000.0, y + 125.0), (ox + 6800.0, y + 125.0), "X-WIN")
    s.text("ARCHITECTURAL BACKGROUND (BOUND XREF)", (ox, oy - 800.0), 200.0, "X-WALL")


# -- the revision cloud ------------------------------------------------------------------------


def rev_cloud(s: Scene, x: float, y: float, w: float, h: float, layer: str = "S-REV") -> dict:
    """A closed LWPOLYLINE whose every segment bulges outward — a draughtsman's revision cloud."""
    step = 400.0
    pts: list[tuple[float, float]] = []
    nx = max(2, int(w // step))
    ny = max(2, int(h // step))
    for i in range(nx):
        pts.append((x + w * i / nx, y))
    for i in range(ny):
        pts.append((x + w, y + h * i / ny))
    for i in range(nx):
        pts.append((x + w - w * i / nx, y + h))
    for i in range(ny):
        pts.append((x, y + h - h * i / ny))
    return s.poly(pts, layer, closed=True, bulges=[bulge_for_arc(150.0)] * len(pts))


# -- the library -------------------------------------------------------------------------------


def library() -> list[Block]:
    """Every block the sheets insert, in definition order (nested children before their parents)."""
    return [
        _title_block(),
        _north_arrow(),
        _key_plan(),
        _col_tag(),
        _grid_bubble(),
        _section_mark(),
        _scale_bar(),
        _level_mark(),
        *_pc3_nest(),
        _lintel_row(),
        _arch_xref(),
    ]
