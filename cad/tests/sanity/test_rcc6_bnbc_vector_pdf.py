"""AC-5 for F-RCC6-BNBC — the two vector PDFs, read the way a permissive reader reads them.

The set is painted twice from one authored Scene (W-03). `rcc6-bnbc.pdf` carries TrueType text —
Vera out of the pinned reportlab wheel — so every page's strings come back through `pypdfium2`:
its own sheet number, the consultant's name, its title, and on the sheets that carry them the
notes' `3500 psi` and `50d` and the column schedule's `C1` and `8-20Ø`. `rcc6-bnbc.shx.pdf` is the
same drawing stroked with the Hershey simplex table, which is what a station without the drawing's
SHX prints: the same pages at the same paper sizes, the same geometry, and NOT ONE text object, so
an extractor reads nothing off it and the product must fall back to the DXF (T-PDF-SHX).

Both are read through `pdf_probe.py` under the `fixtures` group, so pytest itself never imports a
group the shipped project does not ship. The page sizes come from the manifest's own sheet roster,
in points, which is how a mixed A1/A2/A3 set is checked without restating the roster here.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

TTF_REL = "rcc6-bnbc.pdf"
SHX_REL = "rcc6-bnbc.shx.pdf"
MANIFEST_REL = "manifest.json"

PROBE = Path(__file__).resolve().with_name("pdf_probe.py")
PROBE_REL = PROBE.relative_to(Path(__file__).resolve().parents[3]).as_posix()

#: cad/tests/sanity/<this file> -> the checkout.
_CORPUS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6-bnbc"

pytestmark = pytest.mark.skipif(
    not (_CORPUS_DIR / TTF_REL).is_file(),
    reason=f"fixtures/rcc6-bnbc/{TTF_REL} is not committed yet — Wave B's outputs land with the "
    "generator run, and the golden checks stand on their own until then",
)

#: 1 mm in PostScript points, and the slack a page size is allowed (reportlab rounds nothing).
PT_PER_MM = 72.0 / 25.4
SIZE_TOLERANCE_PT = 0.5

#: What particular sheets must be readable as text on their own page.
SHEET_VOCABULARY: dict[str, tuple[str, ...]] = {
    "S-01": ("3500 psi", "50d"),
    "S-11": ("C1", "8-20Ø"),
}


def _sheets(corpus) -> list[dict[str, Any]]:
    manifest = corpus.read_json(MANIFEST_REL)
    sheets = manifest.get("sheets")
    assert isinstance(sheets, list) and sheets, "manifest.json names no sheets"
    return sheets


def _manifest(corpus) -> dict[str, Any]:
    return corpus.read_json(MANIFEST_REL)


def _pages(corpus, relative: str) -> list[dict[str, Any]]:
    def read_once() -> list[dict[str, Any]]:
        pdf = corpus.require(relative)
        run = corpus.run_in_fixtures_group([PROBE_REL, str(pdf)])
        assert run.returncode == 0, (
            f"reading {relative} through pypdfium2 under the `fixtures` group failed "
            f"({run.returncode})\n{run.stderr[-3000:]}"
        )
        return json.loads(run.stdout)["pages"]

    return corpus.once(f"bnbc-pages-{relative}", read_once)


def _collapsed(text: str) -> str:
    return " ".join(text.split())


def _squashed(text: str) -> str:
    """All whitespace dropped: a title block breaks a long name across two cells, and the reader
    should still find it (the consultant is spelled over two TEXTs, the sheet title over two
    ATTRIBs), so the test asks for the characters, not for the office's line breaks."""
    return "".join(text.split())


def _page_of(corpus, number: str, relative: str = TTF_REL) -> dict[str, Any]:
    numbers = [sheet["number"] for sheet in _sheets(corpus)]
    assert number in numbers, f"manifest.json names no sheet {number!r}"
    pages = _pages(corpus, relative)
    index = numbers.index(number)
    assert index < len(pages), f"{relative} has no page {index} for sheet {number}"
    return pages[index]


def _names_token(text: str, token: str) -> bool:
    return re.search(rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])", text) is not None


@pytest.mark.parametrize("relative", [TTF_REL, SHX_REL])
def test_ac5_a_page_per_sheet_at_that_sheet_s_own_paper_size(bnbc_corpus, relative: str) -> None:
    sheets, pages = _sheets(bnbc_corpus), _pages(bnbc_corpus, relative)
    assert len(pages) == len(sheets), f"{relative} has {len(pages)} pages for {len(sheets)} sheets"
    wrong = []
    for sheet, page in zip(sheets, pages, strict=True):
        width, height = (value * PT_PER_MM for value in sheet["page_mm"])
        if (
            abs(page["width_pt"] - width) > SIZE_TOLERANCE_PT
            or abs(page["height_pt"] - height) > SIZE_TOLERANCE_PT
        ):
            wrong.append((sheet["number"], sheet["size"], page["width_pt"], page["height_pt"]))
    assert wrong == [], f"{relative} pages whose size is not their sheet's paper: {wrong}"


def test_ac5_the_set_mixes_paper_sizes(bnbc_corpus) -> None:
    sizes = {sheet["size"] for sheet in _sheets(bnbc_corpus)}
    assert len(sizes) > 1, f"a Dhaka set is not all one paper size; the manifest names only {sizes}"


def test_ac5_every_ttf_page_names_its_sheet_its_title_and_its_consultant(bnbc_corpus) -> None:
    consultant = _manifest(bnbc_corpus)["identity"]["consultant"]
    unnamed = []
    for sheet, page in zip(_sheets(bnbc_corpus), _pages(bnbc_corpus, TTF_REL), strict=True):
        text = _squashed(page["text"])
        missing = [
            token
            for token in (sheet["number"], sheet["title"], consultant)
            if _squashed(token) not in text
        ]
        if missing:
            unnamed.append((sheet["number"], missing))
    assert unnamed == [], f"pages whose extracted text lacks what every sheet carries: {unnamed}"


@pytest.mark.parametrize(("number", "tokens"), sorted(SHEET_VOCABULARY.items()))
def test_ac5_each_sheet_names_what_it_draws(bnbc_corpus, number: str, tokens: tuple[str, ...]) -> None:
    text = _collapsed(_page_of(bnbc_corpus, number)["text"])
    unnamed = [
        token for token in tokens if not (_names_token(text, token) if " " not in token else token in text)
    ]
    assert unnamed == [], f"the {number} page's extracted text does not name: {unnamed}"


@pytest.mark.parametrize("relative", [TTF_REL, SHX_REL])
def test_ac5_every_page_carries_drawn_geometry(bnbc_corpus, relative: str) -> None:
    bare = [page["index"] for page in _pages(bnbc_corpus, relative) if page["paths"] < 1]
    assert bare == [], f"{relative} pages with no path object (a blank sheet): {bare}"


def test_ac5_exactly_the_sheets_the_manifest_names_carry_images(bnbc_corpus) -> None:
    named = set(_manifest(bnbc_corpus)["pdf"][TTF_REL]["image_pages"])
    numbers = [sheet["number"] for sheet in _sheets(bnbc_corpus)]
    carried = {
        numbers[page["index"]] for page in _pages(bnbc_corpus, TTF_REL) if page["images"] > 0
    }
    assert carried == named, (
        f"the vector PDF carries images on {sorted(carried)}; the manifest names {sorted(named)}"
    )
    assert named, "no sheet carries an image — the authored rasters never reached the PDF"


def test_ac5_the_shx_pdf_has_no_text_object_at_all(bnbc_corpus) -> None:
    pages = _pages(bnbc_corpus, SHX_REL)
    with_text = [(page["index"], page["texts"]) for page in pages if page["texts"]]
    assert with_text == [], f"{SHX_REL} pages carrying text objects (T-PDF-SHX): {with_text}"
    extracted = [page["index"] for page in pages if page["text"].strip()]
    assert extracted == [], f"{SHX_REL} pages an extractor can read strings off: {extracted}"


def test_ac5_the_shx_pdf_says_the_same_drawing_in_strokes(bnbc_corpus) -> None:
    ttf, shx = _pages(bnbc_corpus, TTF_REL), _pages(bnbc_corpus, SHX_REL)
    thinner = [
        (a["index"], a["paths"], b["paths"])
        for a, b in zip(ttf, shx, strict=True)
        if b["paths"] <= a["paths"]
    ]
    assert thinner == [], (
        "stroked text is geometry: every page of the stroked PDF must carry MORE paths than the "
        f"TrueType one, and these do not: {thinner}"
    )


def test_ac5_the_manifest_agrees_with_what_the_reader_finds(bnbc_corpus) -> None:
    manifest = _manifest(bnbc_corpus)["pdf"]
    for relative in (TTF_REL, SHX_REL):
        pages = _pages(bnbc_corpus, relative)
        assert manifest[relative]["pages"] == len(pages), relative
        assert manifest[relative]["text_objects"] == sum(page["texts"] for page in pages), relative
    assert "BENGALI_TEXT_DXF_ONLY" in manifest[TTF_REL]["losses"], (
        "W-03: the Bengali title lives in the DXF alone and both PDFs must name the loss"
    )
