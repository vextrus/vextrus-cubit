"""Facts about a PDF, read through pypdfium2 (L-CAD-04's permissive PDF reader).

Run under the `fixtures` dependency group — `uv run --project cad --group fixtures python
cad/tests/sanity/pdf_probe.py <file.pdf>` — and it prints one JSON document: per page, the text
pypdfium2 extracts, how many page objects it holds and how many of those are images. The test that
needs these facts spawns this script rather than importing pypdfium2, so the pytest process itself
never depends on a group the shipped project does not.
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
            }
        )
    return {"pages": pages}


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: pdf_probe.py <file.pdf>", file=sys.stderr)
        return 2
    print(json.dumps(pdf_facts(Path(argv[1]))))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
