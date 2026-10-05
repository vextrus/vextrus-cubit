"""KR-01's Plot PDFs (ticket 236): drawn the same each time, a page per sheet printing that sheet's
title block words, and read by `kr01.replayed()` only when they are the seed's own."""

from pathlib import Path

import pytest

from engine.read.pdf.types import Page
from engine.text.decode import decode
from vextrus.seed import kr01, kr01_pdf
from vextrus.seed.drawings import ARCHITECTURAL, STRUCTURAL


def pages_of(name: str, folder: Path) -> list[Page]:
    path = folder / name
    path.write_bytes(kr01.draw_pdf(name))
    return kr01.replayed().pages(path)


def test_each_pdf_is_drawn_the_same_each_time() -> None:
    assert kr01.PDFS == kr01_pdf.PDFS
    for name in kr01.PDFS:
        assert kr01.draw_pdf(name) == kr01.draw_pdf(name)
    with pytest.raises(KeyError):
        kr01.draw_pdf("KR-PLB-R9.pdf")


def test_a_page_prints_its_sheets_words_and_no_other_number(tmp_path: Path) -> None:
    numbers = {s.number for s in (*STRUCTURAL, *ARCHITECTURAL) if s.number is not None}
    structural = [s for s in STRUCTURAL if s.number != "S-07"] + [kr01_pdf.NOT_IN_ANY_DWG]
    for name, sheets, titled in ((kr01.PDFS[0], structural, True), (kr01.PDFS[1], ARCHITECTURAL, False)):
        pages = pages_of(name, tmp_path)
        assert len(pages) == len(sheets)
        for page, sheet in zip(pages, sheets, strict=True):
            words = {decode(item.text).strip() for item in page.items}
            assert {sheet.mark, sheet.date} <= words, (name, page.number)
            assert (decode(sheet.title) in words) is titled, (name, page.number)
            assert words & numbers == ({sheet.number} & numbers), (name, page.number)


def test_a_pdf_not_drawn_by_the_seed_is_not_read(tmp_path: Path) -> None:
    other = tmp_path / "KR-STR-R0.pdf"
    other.write_bytes(kr01.draw_pdf("KR-ARC-R0.pdf") + b"\n% changed\n")
    use = kr01.replayed()
    with pytest.raises(kr01.NotRecorded):
        use.pdf(other)
    with pytest.raises(kr01.NotRecorded):
        use.pages(other)
    assert use.ink is False
