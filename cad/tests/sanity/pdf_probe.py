"""Facts about a PDF, read through pypdfium2 (L-CAD-04's permissive PDF reader). Not a test.

`uv run --project cad --group fixtures python cad/tests/sanity/pdf_probe.py <file.pdf>` prints one
JSON document: per page, the text pypdfium2 extracts, how many page objects it holds and how many of
those are images, paths (drawn geometry), text objects and Form XObjects. The corpus sanity suites
spawn it beside the generator that wrote the PDF, under the group the generator runs in. pypdfium2
itself ships with the extractor since the vector-PDF lane landed (R-TO-002), so `cad/tests/test_pdf.py`
reads the same facts in-process; this probe is the generator's side of the same reading.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def pdf_facts(path: Path) -> dict[str, Any]:
    import pypdfium2 as pdfium
    import pypdfium2.raw as pdfium_c

    document = pdfium.PdfDocument(str(path))
    pages: list[dict[str, Any]] = []
    for index in range(len(document)):
        page = document[index]
        objects = list(page.get_objects())
        text = page.get_textpage().get_text_range()
        pages.append(
            {
                "index": index,
                "width_pt": page.get_width(),
                "height_pt": page.get_height(),
                "text": text,
                "objects": len(objects),
                "images": sum(1 for item in objects if item.type == pdfium_c.FPDF_PAGEOBJ_IMAGE),
                "paths": sum(1 for item in objects if item.type == pdfium_c.FPDF_PAGEOBJ_PATH),
                "texts": sum(1 for item in objects if item.type == pdfium_c.FPDF_PAGEOBJ_TEXT),
                "forms": sum(1 for item in objects if item.type == pdfium_c.FPDF_PAGEOBJ_FORM),
            }
        )
    return {"pages": pages}


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: pdf_probe.py <file.pdf>", file=sys.stderr)
        return 2
    path = Path(argv[1])
    assert path.is_file(), f"{path} is not a file"
    print(json.dumps(pdf_facts(path)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
