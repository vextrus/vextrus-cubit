"""AC-5 — the vector PDF is one drawn, text-bearing, image-free page per sheet (F-RCC6, D-04).

Read through pypdfium2 under the `fixtures` group (see `pdf_probe.py`): as many pages as the
manifest names sheets, each page's extracted text carrying its sheet's name and the title block's
`F-RCC6`, the plan pages naming what F-RCC6 says they draw (the foundation marks, the column and
beam marks with the grid, the `50d` lap note), every page carrying path objects — drawn geometry,
not only strings — and no image object on any page (a vector PDF that had rasterised a sheet would
carry one).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

PDF_REL = "rcc6.pdf"
MANIFEST_REL = "manifest.json"

PROBE = Path(__file__).resolve().with_name("pdf_probe.py")
PROBE_REL = PROBE.relative_to(Path(__file__).resolve().parents[3]).as_posix()

#: The title-block text every sheet carries, and the lap note the general notes carry.
TITLE_BLOCK_TEXT = "F-RCC6"
LAP_NOTE = "50d"

#: What F-RCC6 says each plan draws — the marks and labels its sheets must name.
FOUNDATION_PLAN = "FOUNDATION PLAN"
TYPICAL_FLOOR_PLAN = "TYPICAL FLOOR PLAN"
GENERAL_NOTES = "GENERAL NOTES"
FOUNDATION_MARKS = ("F1", "F2", "F3", "F4", "PC1", "PC2")
FLOOR_MARKS = ("C1", "C2", "C3", "C4", "B1", "B2", "B3", "B4", "B5", "B6")
GRID_LABELS = ("A", "B", "C", "D", "E", "F", "1", "2", "3", "4", "5", "6")
SHEET_VOCABULARY: dict[str, tuple[str, ...]] = {
    FOUNDATION_PLAN: FOUNDATION_MARKS,
    TYPICAL_FLOOR_PLAN: FLOOR_MARKS + GRID_LABELS,
    GENERAL_NOTES: (LAP_NOTE,),
}

Pages = list[dict[str, Any]]


def _sheets(corpus) -> list[dict[str, Any]]:
    manifest = corpus.read_json(MANIFEST_REL)
    assert isinstance(manifest.get("sheets"), list) and manifest["sheets"], "manifest.json names no sheets"
    return manifest["sheets"]


def _pages(corpus) -> Pages:
    def read_once() -> Pages:
        pdf = corpus.require(PDF_REL)
        run = corpus.run_in_fixtures_group([PROBE_REL, str(pdf)])
        assert run.returncode == 0, (
            f"reading {PDF_REL} through pypdfium2 under the `fixtures` group failed ({run.returncode})\n"
            f"{run.stderr[-3000:]}"
        )
        return json.loads(run.stdout)["pages"]

    return corpus.once("vector-pdf-pages", read_once)


def _page_of(corpus, sheet_name: str) -> dict[str, Any]:
    """The page at the manifest index of the sheet named `sheet_name`."""
    names = [sheet["name"] for sheet in _sheets(corpus)]
    assert sheet_name in names, f"manifest.json names no sheet {sheet_name!r}"
    pages = _pages(corpus)
    index = names.index(sheet_name)
    assert index < len(pages), f"the vector PDF has no page {index} for sheet {sheet_name!r}"
    return pages[index]


def _collapsed(text: str) -> str:
    return " ".join(text.split())


def _names_token(text: str, token: str) -> bool:
    """`token` as a whole mark or label: not a run inside a longer alphanumeric (C1 is not in PC1)."""
    return re.search(rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])", text) is not None


def test_ac5_one_page_per_manifest_sheet(corpus) -> None:
    sheets, pages = _sheets(corpus), _pages(corpus)
    assert len(pages) == len(sheets), f"the vector PDF has {len(pages)} pages for {len(sheets)} sheets"


def test_ac5_each_page_carries_its_sheet_name(corpus) -> None:
    unnamed = [
        sheet["name"]
        for sheet, page in zip(_sheets(corpus), _pages(corpus), strict=False)
        if sheet["name"] not in _collapsed(page["text"])
    ]
    assert unnamed == [], f"pages whose extracted text lacks their sheet's name: {unnamed}"


def test_ac5_each_page_carries_the_title_block_text(corpus) -> None:
    untitled = [
        page["index"] for page in _pages(corpus) if TITLE_BLOCK_TEXT not in _collapsed(page["text"])
    ]
    assert untitled == [], f"pages whose text lacks the title block's {TITLE_BLOCK_TEXT}: {untitled}"


@pytest.mark.parametrize(("sheet_name", "tokens"), sorted(SHEET_VOCABULARY.items()))
def test_ac5_each_plan_page_names_what_its_sheet_draws(
    corpus, sheet_name: str, tokens: tuple[str, ...]
) -> None:
    text = _collapsed(_page_of(corpus, sheet_name)["text"])
    if sheet_name == GENERAL_NOTES:
        unnamed = [token for token in tokens if token not in text]
    else:
        unnamed = [token for token in tokens if not _names_token(text, token)]
    assert unnamed == [], f"the {sheet_name} page's extracted text does not name: {unnamed}"


def test_ac5_every_page_carries_drawn_geometry_not_only_text(corpus) -> None:
    text_only = [
        page["index"]
        for page in _pages(corpus)
        if page["paths"] < 1 or page["objects"] <= page["texts"]
    ]
    assert text_only == [], (
        f"vector PDF pages with no path object (strings on an otherwise blank page): {text_only}"
    )


def test_ac5_no_page_carries_an_image_object(corpus) -> None:
    with_images = [page["index"] for page in _pages(corpus) if page["images"] > 0]
    assert with_images == [], f"vector PDF pages carrying an image object: {with_images}"
