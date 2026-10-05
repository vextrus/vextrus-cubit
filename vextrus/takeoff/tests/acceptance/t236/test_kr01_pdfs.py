"""Ticket 236 (#236): the demo seed's Plot PDFs are real vector PDFs, drawn from KR-01's sheets
("`kr01.draw_pdf(name: str) -> bytes`: the PDF drawn from the same `S`/`V` lists as the DWG of its
Discipline (`STRUCTURAL`, `ARCHITECTURAL`), by the repo's writer `engine/fixtures/pdf/_writer.py`;
deterministic (same bytes twice)").

Each PDF is read here in this process, as the engine's child reads it (`walk.read_file`, its JSON
encoded and parsed back as the parent does: `child._encode`, `json.loads`, `facts.parse`), then by 12's
own rules (`rules.report`, `rules.pages`): never through `engine.read.pdf.report`, whose sandboxed child
the cloud does not have. Every literal is the seed's own (`vextrus.seed.drawings`); none is a real
drawing's.
"""

import hashlib
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from engine.plot import registration
from engine.read.pdf import READER, READER_VERSION, child, rules, walk
from engine.read.pdf import facts as pdf_facts
from engine.read.pdf.types import Lettering, MadeBy, Page, PdfReport, TextSource
from engine.text.decode import decode
from vextrus.seed import drawings as seed_drawings
from vextrus.seed import kr01

STR, ARC = "KR-STR-R0.pdf", "KR-ARC-R0.pdf"
TURNED = (3, 8)
"""The Structural PDF's pages displayed portrait, turned by `/Rotate` 90 (m0-screens §7's seed)."""
SEAM: Any = kr01
"""`vextrus.seed.kr01` as 236 extends it (`PDFS`, `draw_pdf`): its new names are pinned by these tests
(an AttributeError until they are built), not by mypy."""
NOT_IN_ANY_DWG = "S-13"
"""The Structural PDF's last page: a sheet the drawing list names and no DWG carries."""


def read_in_process(content: bytes, folder: Path) -> tuple[PdfReport, list[Page]]:
    """The PDF's report and pages, read here as the engine's child and parent read it."""
    path = folder / f"{hashlib.sha256(content).hexdigest()[:12]}.pdf"
    path.write_bytes(content)
    facts = pdf_facts.parse(json.loads(child._encode(walk.read_file(path))))
    sha256 = hashlib.sha256(content).hexdigest()
    return rules.report(facts, sha256), rules.pages(facts, sha256, READER, READER_VERSION)


def structural_sheets() -> list[seed_drawings.S]:
    """The Structural PDF's sheets, a page each in order: every sheet of the DWG but both S-07s."""
    return [s for s in seed_drawings.STRUCTURAL if s.number != "S-07"]


def every_number() -> set[str]:
    """Every sheet number in KR-01's Drawing Set (its three Disciplines' DWGs)."""
    sheets = (*seed_drawings.STRUCTURAL, *seed_drawings.ARCHITECTURAL, *seed_drawings.ELECTRICAL)
    return {s.number for s in sheets if s.number is not None}


def named(page: Page, numbers: Iterable[str]) -> set[str]:
    """The numbers the page names, as 18's registration finds a number on a page."""
    return {n for n in numbers if registration.mention(page, n) is not None}


def words(page: Page) -> set[str]:
    return {decode(item.text).strip() for item in page.items}


def test_kr01_pdfs_are_real_pages(tmp_path: Path) -> None:
    """Case 1: the Structural PDF plotted by AutoCAD's driver (12 pages, 3 and 8 turned, its lettering
    kept as SHX comments, its layers kept, one picture on page 1 and no scan); the Architectural one
    made by another tool (8 pages, no layers, its lettering drawn as lines). Every page has text."""
    assert SEAM.PDFS == (STR, ARC)
    structural = SEAM.draw_pdf(STR)
    assert SEAM.draw_pdf(STR) == structural
    assert SEAM.draw_pdf(ARC) == SEAM.draw_pdf(ARC)

    report, pages = read_in_process(structural, tmp_path)
    assert report.made_by is MadeBy.AUTOCAD
    assert report.producer is not None
    assert "dwg to pdf" in report.producer.casefold()
    assert len(pages) == len(report.pages) == 12
    for page, shown in zip(pages, report.pages, strict=True):
        turned = page.number in TURNED
        assert (shown.rotate, page.width < page.height) == ((90, True) if turned else (0, False))
        assert shown.lettering is Lettering.COMMENTS, page.number
        comments = [i for i in page.items if i.source is TextSource.SHX_COMMENT]
        assert shown.shx_comments >= 1, page.number
        assert comments, page.number
        assert all(not any(n in decode(c.text) for n in every_number()) for c in comments)
        assert not shown.scan, page.number
        assert not shown.mostly_picture, page.number
        assert page.items, page.number
    assert len(report.layers) >= 2
    assert [p.images for p in report.pages] == [1] + [0] * 11
    assert report.refused is None

    report, pages = read_in_process(SEAM.draw_pdf(ARC), tmp_path)
    assert report.made_by is MadeBy.OTHER
    assert report.layers == ()
    assert len(pages) == len(report.pages) == 8
    for page, shown in zip(pages, report.pages, strict=True):
        assert shown.lettering is Lettering.LINES, page.number
        assert shown.chars < rules.FEW_CHARS, page.number
        assert shown.strokes > 0, page.number
        assert shown.shx_comments == 0, page.number
        assert page.items, page.number
        assert (shown.rotate, page.width > page.height) == (0, True)


def test_each_page_prints_its_sheets_words(tmp_path: Path) -> None:
    """Case 2: page n of the Structural PDF prints the n-th sheet's number (both S-07s have no page),
    its title as drawn, its revision mark and its date; page 12 prints S-13 and no sheet's number. Page
    n of the Architectural PDF prints the n-th sheet's number, and the unnumbered schedule's page none.
    No page prints a second sheet's number."""
    numbers = every_number()
    _, pages = read_in_process(SEAM.draw_pdf(STR), tmp_path)
    sheets = structural_sheets()
    assert len(sheets) == 11
    for page, sheet in zip(pages, [*sheets, None], strict=True):
        if sheet is None:
            assert (registration.mention(page, NOT_IN_ANY_DWG) or (False, 0.0))[0], page.number
            assert named(page, numbers) == set(), page.number
            continue
        assert sheet.number is not None
        assert named(page, numbers) == {sheet.number}, page.number
        whole, _height = registration.mention(page, sheet.number) or (False, 0.0)
        assert whole, page.number
        assert {decode(sheet.title), sheet.mark, sheet.date} <= words(page), page.number

    _, pages = read_in_process(SEAM.draw_pdf(ARC), tmp_path)
    assert len(pages) == len(seed_drawings.ARCHITECTURAL)
    for page, sheet in zip(pages, seed_drawings.ARCHITECTURAL, strict=True):
        expected = set() if sheet.number is None else {sheet.number}
        assert named(page, numbers) == expected, page.number
        if sheet.number is not None:
            assert (registration.mention(page, sheet.number) or (False, 0.0))[0], page.number
