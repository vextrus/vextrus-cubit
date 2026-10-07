"""KR-01's synthetic DWGs, drawn (ticket 182; #150): each sheet a frame with its title block's labels
and values, each view its drawing filling its box with plausible content and its title beneath it, as
13's sheet finder and 17's view finder read a drawing. All invented: no office's convention and
nothing from a real Drawing Set; it proves the demo's mechanics, never a reading (docs/sdlc.md).

    doc = draw("KR-STR-R0.dwg")          # an ezdxf Drawing; `record(folder)` writes it as DWG
    use = replayed()                     # the read job's readers, replaying the recording
    content = draw_pdf("KR-STR-R0.pdf")  # a Plot PDF (`kr01_pdf`), read by `use` in this process

**The recording** (`recorded/`, committed): each file's DWG as the repo's writer saved it, and what the
engine's two readers read from it (the first's ReadArtefact, the second's check), made once by
`uv run manage.py record_demo_reading` with the toolchain. The seed puts each DWG through the
product's read job (`read_propose.files.read`) with `replayed()`: no toolchain and no process, the
readers' answers looked up by the file's sha256; the fonts and the Bangla-ANSI Check run as they are.
KR-STR-old.dwg's second reader is the planted disagreement (m0-screens §7: "the planted-disagreement
stub"), so the job holds it. The two Plot PDFs (`PDFS`, drawn by `kr01_pdf`) are read by the job
too: `replayed()` reads them in this process with the engine's own walk and rules (no sandbox), and
places their pages by text and sizes (`ink=False`).

What each file carries is `vextrus.seed.drawings`' sheets (`STRUCTURAL`, `ARCHITECTURAL`,
`ELECTRICAL`, `OLD_STRUCTURAL`, and MG-01's `GENERAL_NOTES` and `SURVEY`): their numbers, titles,
revision marks, dates, views (kind words in their titles, boxes as fractions of the paper) and where
they lie (side by side in the drawing, or a layout tab). Everything in millimetres
(INSUNITS 4) on an A1, 1:1 on paper.
"""

import gzip
import hashlib
import itertools
import json
import math
import os
import tempfile
from collections.abc import Callable, Sequence
from decimal import Decimal
from pathlib import Path

import httpx
from ezdxf.document import Drawing
from ezdxf.filemanagement import new
from ezdxf.layouts.base import BaseLayout

from engine.check import bangla_ansi
from engine.messages import decoders_agree as agree_codes
from engine.read import ReadArtefact
from engine.read.pdf import READER as PDF_READER
from engine.read.pdf import READER_VERSION as PDF_READER_VERSION
from engine.read.pdf import child, rules, walk
from engine.read.pdf import facts as pdf_facts
from engine.read.pdf.types import Page, PdfReport
from engine.recognise.types import CheckOutcome, CheckResult, ViewKind
from engine.render import fonts as font_report
from vextrus.platform.services import jev
from vextrus.seed.drawings import (
    ARCHITECTURAL,
    ELECTRICAL,
    EMPTY_TAB,
    GAP,
    GENERAL_NOTES,
    NOTES_WITH_CODES,
    OLD_STRUCTURAL,
    PAPER,
    STRUCTURAL,
    SURVEY,
    TITLE_BLOCK,
    S,
    V,
)
from vextrus.seed.kr01_pdf import PDFS as PDFS
from vextrus.seed.kr01_pdf import draw_pdf as draw_pdf
from vextrus.takeoff.services.read_propose import files

VERSION = "AC1032"
"""The DWG version the writer saves (as the real sets' newest)."""
FILES: dict[str, tuple[Sequence[S], tuple[str, ...]]] = {
    "KR-STR-R0.dwg": (STRUCTURAL, ("Arial", "ROMANS", "SWISSC")),
    "KR-ARC-R0.dwg": (ARCHITECTURAL, ("Arial",)),
    "KR-ELE-R0.dwg": (ELECTRICAL, ("Arial",)),
    "KR-STR-old.dwg": (OLD_STRUCTURAL, ("Arial",)),
    "MG-GENERAL-NOTES.dwg": (GENERAL_NOTES, ("Arial",)),
    "MG-SURVEY-R0.dwg": (SURVEY, ("Arial",)),
}
"""Each file's sheets and the text styles it letters with (title, notes, dimensions); the last two are
MG-01's (#223): a file of general notes, and one whose name names no Discipline."""
STYLES = {
    "Arial": "arial.ttf",
    "ROMANS": "romans.shx",
    "SWISSC": "swissc.ttf",
    "BANGLA": "sutonnymj.ttf",
}
TITLE_HEIGHT = 5.0
"""A view's title; its content is lettered smaller (`TEXT_HEIGHT`)."""
TEXT_HEIGHT = 2.5
REGISTER_HEIGHT = 3.0
"""S-01's drawing list heading: 13's register reads rows this many heights either side (its span)."""
SEGMENT = 80.0
"""mm: the longest straight piece a view's drawing holds."""
TITLE_ROOM = 14.0
"""Under a view's drawing, in its box: its title's line."""
BANGLA_ROOM = "†kvevi Ni"
"""A room name as a Bijoy-style font stores Bangla (Latin letters), invented."""

Point = tuple[float, float]


def draw(name: str) -> Drawing:
    """The file's drawing: its sheets side by side in model space, or each on its layout tab."""
    sheets, fonts = FILES[name]
    doc = new("R2018", setup=False)
    doc.header["$INSUNITS"] = 4
    doc.header["$DIMSTYLE"] = "Standard"
    for style, font in STYLES.items():
        if style in fonts or style == "BANGLA":
            doc.styles.add(style, font=font)
    fonts = (fonts * 3)[:3]
    if any(s.layout for s in sheets):
        doc.layouts.rename("Layout1", EMPTY_TAB) if EMPTY_TAB != "Layout1" else None
    drawn = 0
    for sheet in sheets:
        if sheet.layout is not None:
            space: BaseLayout = doc.layouts.new(sheet.layout)
            origin = (0.0, 0.0)
        else:
            space = doc.modelspace()
            origin = (drawn * GAP, 0.0)
            drawn += 1
        _sheet(_Pen(space, origin, fonts), sheet)
    return doc


class _Pen:
    """Draws on one sheet: points as paper millimetres from its lower-left corner."""

    def __init__(self, space: BaseLayout, origin: Point, fonts: Sequence[str]) -> None:
        self.space = space
        self.origin = origin
        self.title_font, self.note_font, self.dim_font = fonts
        self.holes: list[tuple[float, float, float, float]] = []
        """Boxes of views drawn inside another's: the outer view's drawing leaves them clear."""

    def at(self, x: float, y: float) -> Point:
        return (self.origin[0] + x, self.origin[1] + y)

    def line(self, a: Point, b: Point, layer: str = "0") -> None:
        """A line, drawn as pieces no longer than `SEGMENT` (as a draughtsman's grid and beam lines
        run from column to column; a straight line across most of the paper is a border to 17)."""
        pieces = max(1, math.ceil(math.dist(a, b) / SEGMENT))
        for n in range(pieces):
            p = (a[0] + (b[0] - a[0]) * n / pieces, a[1] + (b[1] - a[1]) * n / pieces)
            q = (a[0] + (b[0] - a[0]) * (n + 1) / pieces, a[1] + (b[1] - a[1]) * (n + 1) / pieces)
            if self.in_hole(p) or self.in_hole(q):
                continue
            self.space.add_line(self.at(*p), self.at(*q), dxfattribs={"layer": layer})

    def in_hole(self, p: Point) -> bool:
        return any(
            x0 - 4 <= p[0] <= x1 + 4 and y0 - 4 <= p[1] <= y1 + 4 for x0, y0, x1, y1 in self.holes
        )

    def box(self, x0: float, y0: float, x1: float, y1: float, layer: str = "0") -> None:
        points = [self.at(x0, y0), self.at(x1, y0), self.at(x1, y1), self.at(x0, y1)]
        self.space.add_lwpolyline(points, close=True, dxfattribs={"layer": layer})

    def circle(self, c: Point, r: float, layer: str = "0") -> None:
        self.space.add_circle(self.at(*c), r, dxfattribs={"layer": layer})

    def text(self, value: str, at: Point, height: float = TEXT_HEIGHT, style: str | None = None,
             layer: str = "TEXT") -> None:  # fmt: skip
        attribs = {"height": height, "style": style or self.note_font, "layer": layer}
        self.space.add_text(value, dxfattribs=attribs).set_placement(self.at(*at))

    def mtext(self, value: str, at: Point, height: float = TEXT_HEIGHT) -> None:
        attribs = {"char_height": height, "style": self.note_font, "layer": "TEXT"}
        self.space.add_mtext(value, dxfattribs=attribs).set_location(self.at(*at))


def _sheet(pen: _Pen, sheet: S) -> None:
    width, height = PAPER
    pen.box(0, 0, width, height, "FRAME")
    width, height = PAPER
    boxes = [
        (v.box[0] * width, v.box[1] * height, v.box[2] * width, v.box[3] * height) for v in sheet.views
    ]
    for view, box in zip(sheet.views, boxes, strict=True):
        pen.holes = [h for h in boxes if h != box and _inside(h, box)]
        _view(pen, sheet, view)
    pen.holes = []
    if sheet.title_block:
        _title_block(pen, sheet)
    for n in range(sheet.bangla):
        pen.text(f"{BANGLA_ROOM} {n + 1}", (70 + 55 * n, 300), style="BANGLA", layer="ROOM")


def _inside(inner: tuple[float, ...], outer: tuple[float, ...]) -> bool:
    return (
        outer[0] <= inner[0] and outer[1] <= inner[1] and inner[2] <= outer[2] and inner[3] <= outer[3]
    )


def _title_block(pen: _Pen, sheet: S) -> None:
    """The title block: labels with their values beside them, ruled into rows."""
    x0, y0, x1, y1 = (f * s for f, s in zip(TITLE_BLOCK, (*PAPER, *PAPER), strict=True))
    for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        pen.line(a, b, "TITLE")
    rows = [
        ("SHEET TITLE", sheet.title),
        ("SHEET NO", sheet.number or ""),
        ("REV", sheet.mark if sheet.mark_source.value != "file_name" else ""),
        ("DATE", sheet.date),
    ]
    step = (y1 - y0) / len(rows)
    for n, (label, value) in enumerate(rows):
        top = y1 - step * n
        pen.text(label, (x0 + 3, top - step + 4), height=2.5, style=pen.title_font, layer="TITLE")
        if value:
            size = 5.0 if label in ("SHEET NO", "SHEET TITLE") else 3.0
            pen.text(value, (x0 + 40, top - step + 4), height=size, style=pen.title_font, layer="TITLE")


def _view(pen: _Pen, sheet: S, view: V) -> None:
    width, height = PAPER
    fx0, fy0, fx1, fy1 = view.box
    x0, y0, x1, y1 = fx0 * width, fy0 * height, fx1 * width, fy1 * height
    region = (x0 + 2, y0 + TITLE_ROOM, x1 - 2, y1 - 2)
    if view.title is None:
        _loose(pen, (x0, y0, x1, y1))
        return
    if view.kind is ViewKind.SCHEDULE and sheet.number == "S-01":
        # A drawing list's heading stands over its rows (13's register reads the rows under it).
        _register(pen, (x0 + 2, y0 + 2, x1 - 2, y1 - TITLE_ROOM))
        pen.text(
            view.title, (x0 + 2, y1 - 9), height=REGISTER_HEIGHT, style=pen.title_font, layer="TITLES"
        )
        return
    CONTENT.get(view.kind, _plan)(pen, region, sheet, view)
    pen.text(view.title, (x0 + 2, y0 + 4), height=TITLE_HEIGHT, style=pen.title_font, layer="TITLES")
    if view.scale:
        pen.text(
            f"SCALE {view.scale}", (x1 - 40, y0 + 4), height=3.0, style=pen.dim_font, layer="TITLES"
        )


# What each kind of view draws inside its box ---------------------------------------------------------

Region = tuple[float, float, float, float]


def _grid(pen: _Pen, region: Region, across: int, up: int) -> list[Point]:
    x0, y0, x1, y1 = region
    xs = [x0 + 6 + (x1 - x0 - 12) * i / across for i in range(across + 1)]
    ys = [y0 + 6 + (y1 - y0 - 12) * j / up for j in range(up + 1)]
    for i, x in enumerate(xs):
        pen.line((x, y0), (x, y1), "GRID")
        pen.circle((x, y1 - 1), 1.5, "GRID")
        pen.text(chr(ord("A") + i), (x - 1, y1 - 2), height=2.0, layer="GRID")
    for j, y in enumerate(ys):
        pen.line((x0, y), (x1, y), "GRID")
        pen.text(str(j + 1), (x0 + 1, y + 1), height=2.0, layer="GRID")
    return [(x, y) for x in xs for y in ys]


def _plan(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    """A framing plan: grid lines, a column at each crossing, beams along the grid, a beam mark."""
    x0, y0, x1, y1 = region
    across = max(2, min(6, int((x1 - x0) // 60)))
    up = max(2, min(4, int((y1 - y0) // 60)))
    points = _grid(pen, region, across, up)
    for n, (x, y) in enumerate(points):
        if pen.in_hole((x, y)):
            continue
        pen.box(x - 2, y - 2, x + 2, y + 2, "COLUMN")
        if n % 3 == 0:
            pen.text(f"C{1 + n % 4}", (x + 3, y + 3), height=2.0, layer="COLUMN")
    xs = sorted({p[0] for p in points})
    ys = sorted({p[1] for p in points})
    for y in ys:
        pen.line((xs[0], y + 1.5), (xs[-1], y + 1.5), "BEAM")
        pen.line((xs[0], y - 1.5), (xs[-1], y - 1.5), "BEAM")
    for i, (a, b) in enumerate(itertools.pairwise(xs)):
        pen.text(f"B{i + 1}", ((a + b) / 2 - 2, ys[0] + 3), height=2.0, layer="BEAM")


def _section(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    """Floor lines one storey apart, the columns between them, a level at each floor."""
    x0, y0, x1, y1 = region
    floors = max(2, int((y1 - y0) // 30))
    for j in range(floors + 1):
        y = y0 + 4 + (y1 - y0 - 8) * j / floors
        pen.line((x0 + 4, y), (x1 - 4, y), "SECTION")
        pen.line((x0 + 4, y - 2), (x1 - 4, y - 2), "SECTION")
        pen.text(f"+{3.0 * j:.3f}", (x1 - 22, y + 1), height=2.0, layer="LEVEL")
    for i in range(4):
        x = x0 + 10 + (x1 - x0 - 30) * i / 3
        pen.line((x, y0 + 4), (x, y1 - 4), "SECTION")


def _detail(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    """A member in outline with its bars and links, and a call-out."""
    x0, y0, x1, y1 = region
    w, h = (x1 - x0) * 0.9, (y1 - y0) * 0.6
    cx, cy = (x0 + x1) / 2, y0 + 2 + h / 2
    pen.box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, "DETAIL")
    pen.box(cx - w / 2 + 3, cy - h / 2 + 3, cx + w / 2 - 3, cy + h / 2 - 3, "BARS")
    for i in range(5):
        pen.circle((cx - w / 2 + 6 + (w - 12) * i / 4, cy - h / 2 + 6), 1.0, "BARS")
        pen.circle((cx - w / 2 + 6 + (w - 12) * i / 4, cy + h / 2 - 6), 1.0, "BARS")
    pen.line((cx + w / 2, cy), (min(x1 - 2, cx + w / 2 + 15), cy + 10), "DETAIL")
    pen.text("4-16 DIA", (min(x1 - 20, cx + w / 2 + 2), cy + 12), height=2.0)


def _schedule(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    """A ruled table: a mark and its sizes on each row."""
    x0, y0, x1, y1 = region
    rows = max(3, min(12, int((y1 - y0) // 10)))
    step = (y1 - y0) / rows
    pen.box(x0, y0, x1, y1, "TABLE")
    for j in range(1, rows):
        pen.line((x0, y0 + step * j), (x1, y0 + step * j), "TABLE")
    cols = 4
    for i in range(1, cols):
        pen.line((x0 + (x1 - x0) * i / cols, y0), (x0 + (x1 - x0) * i / cols, y1), "TABLE")
    for j in range(rows):
        y = y1 - step * (j + 1) + step / 3
        cells = (f"M{j + 1}", f"{250 + 50 * (j % 4)}x{400 + 50 * (j % 3)}", f"{4 + j % 4}-16", "10@150")
        for i, cell in enumerate(cells):
            pen.text(cell, (x0 + 2 + (x1 - x0) * i / cols, y), height=2.0)


def _register(pen: _Pen, region: Region) -> None:
    """S-01's drawing list: each Structural number once, its title and its latest revision mark,
    S-13 among them though no file carries it."""
    x0, _y0, x1, y1 = region
    for n, (number, title, mark) in enumerate(drawing_list()):
        y = y1 - 8 - 10 * n
        pen.line((x0, y - 3), (x1, y - 3), "TABLE")
        pen.text(number, (x0 + 2, y), height=2.5, style=pen.title_font)
        pen.text(title, (x0 + 22, y), height=2.5, style=pen.title_font)
        pen.text(mark, (x1 - 14, y), height=2.5, style=pen.title_font)


def drawing_list() -> list[tuple[str, str, str]]:
    """KR-01's Structural drawing list as drawn on S-01 (m0-screens §7): S-01 to S-13, each number
    once, both S-07s one line at the later revision mark (REV B)."""
    listed: dict[str, tuple[str, str]] = {}
    for sheet in STRUCTURAL:
        if sheet.number is None:
            continue
        mark = "R0" if sheet.mark_source.value == "file_name" else f"REV {sheet.mark}"
        listed[sheet.number] = (sheet.title, max(listed.get(sheet.number, ("", ""))[1], mark))
    listed["S-13"] = ("SHEAR WALL DETAILS", "R0")
    return [(number, title, mark) for number, (title, mark) in listed.items()]


def _notes(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    """Numbered notes, one to a line (and S-01's, with a drawing's codes)."""
    x0, y0, _x1, y1 = region
    lines = max(3, min(14, int((y1 - y0) // 8)))
    top = y0 + 8 * lines
    coded = NOTES_WITH_CODES if sheet.codes else ()
    for n in range(lines - len(coded)):
        pen.text(f"{n + 1}. {NOTE_LINES[n % len(NOTE_LINES)]}", (x0 + 2, top - 8 * n), height=2.0)
    for n, (kind, raw) in enumerate(coded, start=lines - len(coded)):
        at = (x0 + 2, top - 8 * n)
        if kind == "MTEXT":
            pen.mtext(raw, at, height=2.0)
        else:
            pen.text(raw, at, height=2.0)


NOTE_LINES = (
    "ALL DIMENSIONS ARE IN MILLIMETRES UNLESS STATED.",
    "CONCRETE STRENGTH 28 DAY CYLINDER 25 MPA.",
    "REINFORCEMENT YIELD STRENGTH 500 MPA.",
    "LAP LENGTH 50 BAR DIAMETERS.",
    "DO NOT SCALE FROM THE DRAWING.",
    "READ WITH THE ARCHITECTURAL DRAWINGS.",
    "CEMENT: ORDINARY PORTLAND, ONE BRAND THROUGHOUT.",
    "COARSE AGGREGATE: STONE CHIPS, 20 MM DOWN.",
    "CURE EVERY POUR FOR 14 DAYS.",
    "STRIP SOFFIT FORMWORK AFTER 14 DAYS.",
    "SETTING OUT TO BE CHECKED BY THE ENGINEER.",
    "ALL LEVELS ARE FROM THE PLINTH, +0.000.",
    "NO OPENING IN A BEAM WITHOUT THE ENGINEER'S CONSENT.",
    "BACKFILL IN 150 MM LAYERS, EACH COMPACTED.",
)


def _legend(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    """A symbol and its meaning on each line."""
    x0, y0, _x1, y1 = region
    lines = max(3, min(10, int((y1 - y0) // 12)))
    for n in range(lines):
        y = y0 + 12 * (lines - n) - 6
        if n % 2:
            pen.circle((x0 + 8, y + 1), 2.5, "SYMBOL")
        else:
            pen.box(x0 + 5, y - 1.5, x0 + 11, y + 3.5, "SYMBOL")
        pen.text(LEGEND_LINES[n % len(LEGEND_LINES)], (x0 + 18, y), height=2.0)


LEGEND_LINES = ("COLUMN", "BEAM", "SLAB EDGE", "PILE", "DOOR", "WINDOW", "LIGHT POINT", "SOCKET")


def _key_plan(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    x0, y0, x1, y1 = region
    pen.box(x0 + 10, y0 + 10, x1 - 10, y1 - 10, "KEY")
    pen.box((x0 + x1) / 2 - 10, (y0 + y1) / 2 - 8, (x0 + x1) / 2 + 10, (y0 + y1) / 2 + 8, "KEY")
    pen.line((x0 + 10, y0 + 10), (x1 - 10, y1 - 10), "KEY")


def _perspective(pen: _Pen, region: Region, sheet: S, view: V) -> None:
    """A building in a 30° projection: its storeys as stacked boxes."""
    x0, y0, x1, y1 = region
    cos, sin = math.cos(math.pi / 6), math.sin(math.pi / 6)
    base = ((x0 + x1) / 2, y0 + 20)
    size = min(x1 - x0, y1 - y0) * 0.35

    def iso(x: float, y: float, z: float) -> Point:
        return (base[0] + (x - y) * cos * size, base[1] + (x + y) * sin * size + z * size * 0.12)

    for z in range(8):
        corners = [iso(0, 0, z), iso(1, 0, z), iso(1, 1, z), iso(0, 1, z)]
        for a, b in zip(corners, corners[1:] + corners[:1], strict=True):
            pen.line(a, b, "3D")
    for x, y in ((0, 0), (1, 0), (1, 1), (0, 1)):
        pen.line(iso(x, y, 0), iso(x, y, 7), "3D")


def _loose(pen: _Pen, box: Region) -> None:
    """A loose box beside the title block: a rectangle with a line of text the reader cannot place."""
    x0, y0, x1, y1 = box
    pen.box(x0, y0, x1, y1, "0")
    pen.text("REFER STR. CONSULTANT", (x0 + 2, (y0 + y1) / 2), height=2.0)


CONTENT: dict[ViewKind, Callable[[_Pen, Region, S, V], None]] = {
    ViewKind.PLAN: _plan,
    ViewKind.SECTION: _section,
    ViewKind.ELEVATION: _section,
    ViewKind.DETAIL: _detail,
    ViewKind.SCHEDULE: _schedule,
    ViewKind.NOTES: _notes,
    ViewKind.LEGEND: _legend,
    ViewKind.KEY_PLAN: _key_plan,
    ViewKind.PERSPECTIVE: _perspective,
}


# The recording, and its replay -----------------------------------------------------------------------

RECORDED = Path(__file__).with_name("recorded")
HELD = "KR-STR-old.dwg"
"""The file whose second reader is planted to disagree (§7): the job holds it."""
PLANTED = agree_codes.DISAGREE(items=212, only_first=187, only_second=25, kinds=2, layers=3, unread=0)


class NotRecorded(RuntimeError):
    """A file reached the replaying readers that the recording does not hold: the seed's fault (a
    stale recording), raised as it is, never a file's reason."""


def content(name: str) -> bytes:
    """The recorded DWG's bytes, as the seed adds the file."""
    return (RECORDED / name).read_bytes()


def record(folder: Path, only: Sequence[str] = ()) -> list[str]:
    """Draw each file, write it as DWG with the repo's writer and read it with the engine's two
    readers; keep both in `RECORDED`. Needs the toolchain (.NET, LibreDWG, bwrap); `folder` holds the
    builds; `only` names the files to record again (all, when empty).
    Answers each file's line: its name, sha256 and what the second reader said."""
    from engine.check import decoders_agree
    from engine.fixtures import dwg
    from engine.read import read
    from engine.read.acadsharp.tests.build import build_dumper

    folder = Path(tempfile.mkdtemp(prefix="record-", dir=folder))  # a fresh build each run
    writer = dwg.build_writer(folder / "writer")
    os.environ["VEXTRUS_ACADSHARP_DUMP"] = str(build_dumper(folder / "dumper"))
    RECORDED.mkdir(exist_ok=True)
    said = []
    for name in only or FILES:
        dxf = folder / f"{name}.dxf"
        draw(name).saveas(dxf)
        path = RECORDED / name
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(path), VERSION], 120)
        artefact = read(path, source_name=name)
        checked = decoders_agree.run(path, artefact)
        kept = {
            "drawn": drawn_digest(name),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "artefact": artefact.to_json(),
            "second": {
                "code": checked.code,
                "outcome": str(checked.outcome),
                "finding": checked.finding,
            },
        }
        with gzip.open(RECORDED / f"{name}.json.gz", "wt", encoding="utf-8") as out:
            json.dump(kept, out, sort_keys=True)
        said.append(f"{name} {kept['sha256']} {checked.outcome}")
    return said


def drawn_digest(name: str) -> str:
    """What `draw(name)` draws, as a digest of every entity on every layout (its kind, layer, style,
    points and words), so a recording made from another drawing is seen (`recorded_of`). The DWG's own
    bytes cannot say it: the writer stamps each save differently."""
    doc = draw(name)
    lines = []
    for layout in doc.layouts:
        for entity in layout:
            dxf = entity.dxf.all_existing_dxf_attribs()
            kept = {k: v for k, v in dxf.items() if k not in ("handle", "owner")}
            if entity.dxftype() == "LWPOLYLINE":
                kept["points"] = [tuple(round(c, 6) for c in p) for p in entity.get_points()]  # type: ignore[attr-defined]
            if entity.dxftype() == "MTEXT":
                kept["text"] = entity.text  # type: ignore[attr-defined]
            lines.append(
                f"{layout.name}|{entity.dxftype()}|{sorted((k, repr(v)) for k, v in kept.items())}"
            )
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()


def recorded_of(name: str) -> dict[str, object]:
    """The recording of one file, as kept."""
    with gzip.open(RECORDED / f"{name}.json.gz", "rt", encoding="utf-8") as read:
        kept: dict[str, object] = json.load(read)
    return kept


def _recorded() -> dict[str, dict[str, object]]:
    kept = {}
    for name in FILES:
        with gzip.open(RECORDED / f"{name}.json.gz", "rt", encoding="utf-8") as read:
            one = json.load(read)
        kept[one["sha256"]] = one
    return kept


def replayed() -> files.Readers:
    """The read job's readers, answering from the recording by the file's sha256 (a file not
    recorded is the seed's fault: `NotRecorded`)."""
    kept = _recorded()

    def of(path: Path) -> dict[str, object]:
        sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
        if sha256 not in kept:
            raise NotRecorded(
                f"{path.name} ({sha256}) is not in vextrus/seed/recorded/: run"
                " `uv run manage.py record_demo_reading <work folder>` and commit what it writes"
            )
        return kept[sha256]

    def first(path: Path, name: str) -> ReadArtefact:
        return ReadArtefact.from_json(of(path)["artefact"])  # type: ignore[arg-type]

    def second(path: Path, artefact: ReadArtefact) -> CheckResult:
        if artefact.summary.source_name == HELD:
            return CheckResult(code="decoders_agree", outcome=CheckOutcome.FIRED, finding=PLANTED)
        said = of(path)["second"]
        assert isinstance(said, dict)
        return CheckResult(
            code=said["code"], outcome=CheckOutcome(said["outcome"]), finding=said["finding"]
        )

    drawn = {hashlib.sha256(draw_pdf(name)).hexdigest() for name in PDFS}

    def pdf(path: Path) -> PdfReport:
        sha256, facts = facts_of(path, drawn)
        return rules.report(facts, sha256)

    def pages(path: Path) -> list[Page]:
        sha256, facts = facts_of(path, drawn)
        return rules.pages(facts, sha256, PDF_READER, PDF_READER_VERSION)

    return files.Readers(
        dwg=first,
        second=second,
        fonts=font_report.report,
        bangla_ansi=bangla_ansi.run,
        pdf=pdf,
        pages=pages,
        ink=False,  # placing a page by its ink renders it in a sandbox: by its text and sizes here
    )


def facts_of(path: Path, drawn: set[str]) -> tuple[str, pdf_facts.DocumentFacts]:
    """A PDF of `PDFS` (by its sha256, among `drawn`) read in this process, as the engine's child
    reads it and its parent checks what the child said (`walk`, `child._encode`, `facts.parse`): the
    seed's own PDF, drawn here, never a file from outside. Any other PDF is `NotRecorded`."""
    sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if sha256 not in drawn:
        raise NotRecorded(f"{path.name} ({sha256}) is not one of the seed's PDFs {PDFS}")
    return sha256, pdf_facts.parse(json.loads(child._encode(walk.read_file(path))))


# Jev, as the demo has it ----------------------------------------------------------------------------

SURE = Decimal("0.95")
UNSURE = Decimal("0.55")


def jev_stand_in() -> jev.Client:
    """A client whose TypeSafe is a function here (no call leaves the machine; its answers go into the
    tenant's cache, as a job's would): a sheet's kind is the one its drawing was drawn as, sure, when
    that kind is among the options; a sheet drawn as no kind (A-05, "SECTION A-A & ELEVATION") gets the
    options as offered, unsure, so the job asks the QS."""
    kinds: dict[str, str] = {}
    for sheets, _fonts in FILES.values():
        for sheet in sheets:
            if sheet.kind:
                kinds.setdefault(sheet.title, sheet.kind)

    def answer(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        [(node, asked)] = body["questions"].items()
        options = list(asked["criteria"])
        drawn = kinds.get(str(body["state"].get("title", "")))
        choice, confidence = (drawn, SURE) if drawn in options else (options[0], UNSURE)
        rest = ((1 - confidence) / (len(options) - 1)).quantize(Decimal("0.0001"))
        probabilities = {o: float(rest) for o in options if o != choice} | {choice: float(confidence)}
        said = {"type": "choice", "choice": choice, "confidence": float(confidence)}
        said["probabilities"] = probabilities
        return httpx.Response(200, json={"model": body["model"], "answers": {node: said}})

    return jev.Client(transport=httpx.MockTransport(answer), key=lambda: "seed-stand-in")
