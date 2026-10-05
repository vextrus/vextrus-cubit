"""KR-01's Plot PDFs, drawn (ticket 236; #236): one page per sheet of the Discipline's DWG, printing
its title block's values where the DWG draws them, 1:1 on an A1, so the read job finds and places each
page as it would a consultant's Plot. All invented: no driver's or office's file is copied, and
nothing comes from a real Drawing Set.

    content = draw_pdf("KR-STR-R0.pdf")   # the PDF's bytes, the same each time

**KR-STR-R0.pdf**, plotted by AutoCAD's driver: a page for each Structural sheet but both S-07s, then a
last page for S-13 (in S-01's drawing list, in no DWG); pages 3 and 8 displayed portrait (`/Rotate`
90, the sheet turned on them); its layers kept, a few SHX comments on each page, one small picture on
page 1. **KR-ARC-R0.pdf**, merged by another tool: a page for each Architectural sheet, no layers, its
lettering drawn as lines (only the number, revision mark and date as text: fewer than 20 glyphs), so
the unnumbered schedule's page names no sheet.

Each page carries the frame and each view's box as strokes, and the title block's values (title,
number, revision mark, date) at the paper positions `kr01._title_block` draws them (the value at x0 +
40 on each row's baseline), in millimetres times 72/25.4. No page prints another sheet's number.
"""

from collections.abc import Sequence

from engine.fixtures.pdf._writer import (
    Page,
    Pdf,
    document,
    image,
    layer,
    num,
    on_layer,
    place,
    shx_comment,
    text,
    truetype_font,
)
from vextrus.seed.drawings import ARCHITECTURAL, PAPER, STRUCTURAL, TITLE_BLOCK, S

PDFS: tuple[str, ...] = ("KR-STR-R0.pdf", "KR-ARC-R0.pdf")
"""The demo seed's Plot PDFs the read job reads (`kr01.replayed()` reads them in process)."""
PT_PER_MM = 72 / 25.4
TURNED = (3, 8)
"""The Structural PDF's pages displayed portrait (`/Rotate` 90)."""
NOT_IN_ANY_DWG = S("S-13", "S-13", "SHEAR WALL DETAILS", ())
"""The Structural PDF's last page: a sheet S-01's drawing list names and no DWG carries."""
AUTOCAD = {"Producer": "pdfplot 9.0 DWG To PDF.pc3 (invented)", "Creator": "AutoCAD (invented)"}
MERGED = {"Producer": "Invented PDF Merge 2.1"}
NOTES = ("VERIFY ON SITE", "LAP AS NOTED", "COVER 40 MM", "TYP. ALL BAYS")
"""SHX comments' words: none a sheet's number, none a part of a sheet's title."""

Point = tuple[float, float]


def draw_pdf(name: str) -> bytes:
    """The PDF `name` of `PDFS`, drawn by the repo's writer; the same bytes each time."""
    if name == PDFS[0]:
        sheets = [s for s in STRUCTURAL if s.number != "S-07"] + [NOT_IN_ANY_DWG]
        return _document(sheets, autocad=True)
    if name == PDFS[1]:
        return _document(list(ARCHITECTURAL), autocad=False)
    raise KeyError(f"{name} is not one of KR-01's Plot PDFs {PDFS}")


def _document(sheets: Sequence[S], *, autocad: bool) -> bytes:
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    layers = {f"L{n}": layer(pdf, n_) for n, n_ in enumerate(("FRAME", "VIEW", "TITLES"))}
    picture = image(pdf, 8, 8) if autocad else None
    pages = []
    for number, sheet in enumerate(sheets, start=1):
        sheet_page = _Sheet(turned=autocad and number in TURNED)
        page = Page(
            content=sheet_page.content(sheet, autocad=autocad),
            size=sheet_page.media,
            rotate=90 if sheet_page.turned else None,
            fonts=fonts,
            layers=layers if autocad else {},
        )
        if autocad:
            page.annots = [
                shx_comment(pdf, words, sheet_page.rect(30 + 70 * n, 560, 60, 4))
                for n, words in enumerate(NOTES[: 1 + number % 3])
            ]
        if picture is not None and number == 1:
            page.xobjects = {"Im1": picture}
            x, y = sheet_page.at(20, 20)
            page.content += place("Im1", x, y, 30, 30)
        pages.append(page)
    return document(pdf, pages, info=AUTOCAD if autocad else MERGED)


class _Sheet:
    """One page: paper millimetres (from the sheet's lower-left corner) to the page's own points. A
    turned page's MediaBox is landscape and displayed portrait by its `/Rotate` 90, the sheet turned a
    quarter anticlockwise on the page as it is displayed."""

    def __init__(self, *, turned: bool) -> None:
        self.turned = turned
        self.media = (PAPER[0] * PT_PER_MM, PAPER[1] * PT_PER_MM)

    def at(self, x: float, y: float) -> Point:
        if not self.turned:
            return x * PT_PER_MM, y * PT_PER_MM
        # Displayed, (x, y) lands at (s(H - y), s x); a reader turns the MediaBox by /Rotate 90
        # clockwise (displayed (u, v) is media (W - v, u)), so in the MediaBox it is half a turn.
        return (PAPER[0] - x) * PT_PER_MM, (PAPER[1] - y) * PT_PER_MM

    def angle(self) -> float:
        return 180.0 if self.turned else 0.0

    def rect(self, x: float, y: float, w: float, h: float) -> tuple[float, float, float, float]:
        (ax, ay), (bx, by) = self.at(x, y), self.at(x + w, y + h)
        return min(ax, bx), min(ay, by), max(ax, bx), max(ay, by)

    def line(self, a: Point, b: Point) -> bytes:
        (ax, ay), (bx, by) = self.at(*a), self.at(*b)
        return b"%s %s m %s %s l S\n" % (num(ax), num(ay), num(bx), num(by))

    def box(self, x0: float, y0: float, x1: float, y1: float) -> bytes:
        corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        return b"".join(self.line(a, b) for a, b in zip(corners, corners[1:] + corners[:1], strict=True))

    def text(self, x: float, y: float, value: str, height: float) -> bytes:
        px, py = self.at(x, y)
        return text(px, py, value, size=height * PT_PER_MM, angle=self.angle())

    def content(self, sheet: S, *, autocad: bool) -> bytes:
        width, height = PAPER
        frame = self.box(0, 0, width, height)
        views = b"".join(
            self.box(v.box[0] * width, v.box[1] * height, v.box[2] * width, v.box[3] * height)
            for v in sheet.views
        )
        x0, y0, x1, y1 = (f * s for f, s in zip(TITLE_BLOCK, (*PAPER, *PAPER), strict=True))
        block = self.box(x0, y0, x1, y1)
        step = (y1 - y0) / 4
        rows = [
            (sheet.title if autocad else None, 5.0),
            (sheet.number, 5.0),
            (sheet.mark, 3.0),
            (sheet.date, 3.0),
        ]
        titles = b"".join(
            self.text(x0 + 40, y1 - step * (n + 1) + 4, value, size)
            for n, (value, size) in enumerate(rows)
            if value
        )
        if not autocad:
            return frame + views + block + titles
        return on_layer("L0", frame + block) + on_layer("L1", views) + on_layer("L2", titles)

