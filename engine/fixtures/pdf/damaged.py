"""Files that are not readable PDFs, or hold something a reader must survive (hostile: engine/read/pdf).

- `garbage`: a PDF header, then noise: no object, no page.
- `locked`: a PDF that needs a password to open (the standard security handler, whose check value
  fits no empty password).
- `huge_image`: a drawn page with an image claiming `pixels` by `pixels` pixels, over a tenth of the
  page, with a few bytes of data.
- `nested_forms`: two drawn pages, the second drawing a form that draws a form, `depth` deep (distinct
  forms, so no loop a reader would notice), deeper than a reader's stack.
"""

from engine.fixtures.pdf._writer import (
    A3,
    Page,
    Pdf,
    dictionary,
    document,
    image,
    place,
    string,
    strokes,
    text,
    truetype_font,
)


def write(kind: str = "garbage", pixels: int = 1_000_000_000, depth: int = 3000) -> bytes:
    if kind == "garbage":
        return b"%PDF-1.7\n" + bytes(range(256)) * 64 + b"\n%%EOF\n"
    pdf = Pdf()
    font = truetype_font(pdf)
    drawn = strokes(30) + text(900, 60, "S-401", size=12) + text(900, 40, "ROOF PLAN", size=8)
    if kind == "locked":
        encrypt = pdf.add(
            dictionary(
                {
                    "Filter": b"/Standard",
                    "V": b"1",
                    "R": b"2",
                    "O": string("o" * 32),
                    "U": string("u" * 32),
                    "P": b"-4",
                }
            )
        )
        trailer = {
            "Encrypt": b"%d 0 R" % encrypt,
            "ID": b"[<00112233445566778899AABBCCDDEEFF><00112233445566778899AABBCCDDEEFF>]",
        }
        return document(pdf, [Page(content=drawn, fonts={"F1": font})], trailer=trailer)
    if kind == "huge_image":
        claimed = image(pdf, 2, 2, claimed=(pixels, pixels))
        width, height = A3
        content = drawn + place("Im1", 0, 0, width / 10, height)
        return document(pdf, [Page(content=content, fonts={"F1": font}, xobjects={"Im1": claimed})])
    if kind == "nested_forms":
        inner = pdf.stream(
            strokes(1), {"Type": b"/XObject", "Subtype": b"/Form", "BBox": b"[0 0 100 100]"}
        )
        for _ in range(depth):
            inner = pdf.stream(
                b"/Fm Do",
                {
                    "Type": b"/XObject",
                    "Subtype": b"/Form",
                    "BBox": b"[0 0 100 100]",
                    "Resources": dictionary({"XObject": dictionary({"Fm": b"%d 0 R" % inner})}),
                },
            )
        nested = Page(content=strokes(3) + b"/Fm Do", fonts={"F1": font}, xobjects={"Fm": inner})
        return document(pdf, [Page(content=drawn, fonts={"F1": font}), nested])
    raise ValueError(f"damaged: no such kind {kind!r}")
