"""AC-5 — the vector PDF is one text-bearing, image-free page per sheet (F-RCC6, D-04).

Read through pypdfium2 under the `fixtures` group (see `pdf_probe.py`): as many pages as the
manifest names sheets, each page's extracted text carrying its sheet's name, and no image object on
any page — a vector PDF that had rasterised a sheet would carry one.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PDF_REL = "rcc6.pdf"
MANIFEST_REL = "manifest.json"

PROBE = Path(__file__).resolve().with_name("pdf_probe.py")
PROBE_REL = PROBE.relative_to(Path(__file__).resolve().parents[3]).as_posix()

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


def test_ac5_one_page_per_manifest_sheet(corpus) -> None:
    sheets, pages = _sheets(corpus), _pages(corpus)
    assert len(pages) == len(sheets), f"the vector PDF has {len(pages)} pages for {len(sheets)} sheets"


def test_ac5_each_page_carries_its_sheet_name(corpus) -> None:
    unnamed = [
        sheet["name"]
        for sheet, page in zip(_sheets(corpus), _pages(corpus), strict=False)
        if sheet["name"] not in " ".join(page["text"].split())
    ]
    assert unnamed == [], f"pages whose extracted text lacks their sheet's name: {unnamed}"


def test_ac5_no_page_carries_an_image_object(corpus) -> None:
    with_images = [page["index"] for page in _pages(corpus) if page["images"] > 0]
    assert with_images == [], f"vector PDF pages carrying an image object: {with_images}"
