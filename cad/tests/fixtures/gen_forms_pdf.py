"""Write `forms.pdf`, the vector-PDF lane's own fixture (R-TO-002, L-CAD-02, L-CAD-03). Not a test.

    uv run --project cad python cad/tests/fixtures/gen_forms_pdf.py [--out PATH]

F-RCC6-BNBC's `rcc6-bnbc.pdf` is written by reportlab and carries no Form XObject, no Bézier, no
optional content, no page rotation and no path with more than one subpath — which is exactly what a
plotted set carries and what the lane must read. So this drawing is written by hand, object by
object, with nothing but the standard library: every byte is stated here, there is no timestamp and
no document id, and two runs write the same file. It holds, on two pages:

* page 1 — a border, a numbered title line (`F-01 FORMS FIXTURE`), a text under a scaled CTM (its
  page height comes from the matrix, never from the font size alone), a turned text, a circle of four
  Béziers, a path of three subpaths, a ring with a hole, a fill-only square, one path drawn twice and
  one subpath repeated inside a path (two collapses), one text written twice (a third), two lines in
  the optional-content group `S-GRID`, a Form XObject placed five times (plain, turned, scaled,
  mirrored, and inside the group), a Form XObject that places the first twice (nesting), and an image;
* page 2 — `/Rotate 90`, a title line and the first form once more.

The committed `forms.entitygraph.json` is `vextrus-cad ingest forms.pdf` of these bytes;
`cad/tests/test_pdf.py` proves both regenerate byte for byte.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

#: Where the fixture is committed, beside this script.
DEFAULT_OUT = Path(__file__).resolve().with_name("forms.pdf")

#: A 4 x 4 grey ramp: the image's pixels, which the lane lists and never measures.
IMAGE_PIXELS = bytes(range(0, 256, 16))

#: The column symbol: a square, one diagonal and its mark, drawn about the form's own origin.
FORM_COLUMN = "0 0 1 RG 0.5 w\n-5 -5 10 10 re S\n-5 -5 m 5 5 l S\nBT /F1 3 Tf 1 0 0 1 -2 -7 Tm (C1) Tj ET\n"

#: A form that places the column symbol twice: its paint reaches the page through two levels.
FORM_PAIR = "q 1 0 0 1 -8 0 cm /Fm1 Do Q\nq 1 0 0 1 8 0 cm /Fm1 Do Q\n"

#: A circle of radius 10 about (190, 300), as the four Béziers every PDF writer draws one with.
_K = 5.5228475

CIRCLE = (
    f"190 310 m {190 + _K} 310 200 {300 + _K} 200 300 c "
    f"200 {300 - _K} {190 + _K} 290 190 290 c "
    f"{190 - _K} 290 180 {300 - _K} 180 300 c "
    f"180 {300 + _K} {190 - _K} 310 190 310 c h S\n"
)

PAGE_ONE = (
    "0 0 0 RG 1 w\n"
    "10 10 575 400 re S\n"
    "BT /F1 9 Tf 1 0 0 1 400 20 Tm (F-01 FORMS FIXTURE) Tj ET\n"
    "BT /F1 5 Tf 1 0 0 1 20 380 Tm (GRID NOTES) Tj ET\n"
    "q 2 0 0 2 0 0 cm BT /F1 3 Tf 1 0 0 1 50 75 Tm (SCALED) Tj ET Q\n"
    "BT /F1 5 Tf 0 1 -1 0 30 200 Tm (VERTICAL) Tj ET\n"
    "BT /F1 4 Tf 1 0 0 1 20 360 Tm (DUP) Tj ET\n"
    "BT /F1 4 Tf 1 0 0 1 20 360 Tm (DUP) Tj ET\n"
    "q 0 0 1 RG\n" + CIRCLE + "Q\n"
    "100 100 m 110 100 l 120 100 m 130 100 l 140 100 m 150 100 l S\n"
    "0.6 g 300 100 50 40 re 310 110 20 20 re f*\n"
    "0.8 g 480 100 20 20 re f\n"
    "250 250 m 280 250 l S\n"
    "250 250 m 280 250 l S\n"
    "400 300 m 420 300 l 400 300 m 420 300 l S\n"
    "/OC /oc1 BDC 0.5 0.5 0.5 RG 50 50 m 550 50 l S 50 60 m 550 60 l S "
    "q 1 0 0 1 520 80 cm /Fm1 Do Q EMC\n"
    "q 1 0 0 1 100 250 cm /Fm1 Do Q\n"
    "q 0 1 -1 0 140 250 cm /Fm1 Do Q\n"
    "q 2 0 0 2 180 250 cm /Fm1 Do Q\n"
    "q -1 0 0 1 220 250 cm /Fm1 Do Q\n"
    "q 1 0 0 1 400 200 cm /Fm2 Do Q\n"
    "q 40 0 0 30 450 330 cm /Im1 Do Q\n"
)

PAGE_TWO = (
    "0 0 0 RG 1 w\n"
    "BT /F1 9 Tf 1 0 0 1 250 20 Tm (F-02 ROTATED PAGE) Tj ET\n"
    "20 40 m 380 40 l S\n"
    "q 1 0 0 1 100 150 cm /Fm1 Do Q\n"
)


def _stream(dictionary: str, data: bytes) -> bytes:
    return f"<< {dictionary} /Length {len(data)} >>\nstream\n".encode("latin-1") + data + b"\nendstream"


def objects() -> list[bytes]:
    """The document's indirect objects, numbered from 1 in list order."""
    font = "<< /F1 6 0 R >>"
    return [
        # 1: the catalog, and the one optional-content group every page names (default: on).
        b"<< /Type /Catalog /Pages 2 0 R "
        b"/OCProperties << /OCGs [5 0 R] /D << /Order [5 0 R] /ON [5 0 R] >> >> >>",
        # 2: the page tree.
        b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
        # 3: page 1, 595 x 420 pt.
        (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 420] "
            f"/Resources << /Font {font} /XObject << /Fm1 7 0 R /Fm2 9 0 R /Im1 8 0 R >> "
            "/Properties << /oc1 5 0 R >> >> /Contents 10 0 R >>"
        ).encode("latin-1"),
        # 4: page 2, 420 x 297 pt, turned a quarter.
        (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Rotate 90 "
            f"/Resources << /Font {font} /XObject << /Fm1 7 0 R >> >> /Contents 11 0 R >>"
        ).encode("latin-1"),
        # 5: the optional-content group.
        b"<< /Type /OCG /Name (S-GRID) >>",
        # 6: a standard font, so the file embeds nothing.
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        # 7: the column symbol.
        _stream(
            f"/Type /XObject /Subtype /Form /BBox [-6 -8 6 6] /Resources << /Font {font} >>",
            FORM_COLUMN.encode("latin-1"),
        ),
        # 8: the image.
        _stream(
            "/Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8",
            IMAGE_PIXELS,
        ),
        # 9: the form that places the column symbol twice.
        _stream(
            "/Type /XObject /Subtype /Form /BBox [-14 -8 14 6] /Resources << /XObject << /Fm1 7 0 R >> >>",
            FORM_PAIR.encode("latin-1"),
        ),
        # 10, 11: the two pages' content.
        _stream("", PAGE_ONE.encode("latin-1")),
        _stream("", PAGE_TWO.encode("latin-1")),
    ]


def document() -> bytes:
    """The whole file: header, the objects, a cross-reference table the offsets were counted for."""
    out = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = []
    for number, body in enumerate(objects(), start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode("latin-1") + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(offsets) + 1}\n".encode("latin-1")
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode("latin-1")
    out += f"trailer\n<< /Size {len(offsets) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode(
        "latin-1"
    )
    return bytes(out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write the vector-PDF lane's forms fixture.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="where to write the PDF")
    arguments = parser.parse_args(argv)
    arguments.out.write_bytes(document())
    return 0


if __name__ == "__main__":  # pragma: no cover - script entry point
    sys.exit(main())
