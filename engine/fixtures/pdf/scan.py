"""Pages covered by a picture, to test the scan rule on either side of its edges.

Each of `pages` pages carries one picture covering `share` of its area (a strip from the left edge,
the page's full height), split into `tiles` side-by-side pieces, as some scanners write a page; with
`chars` glyphs of real text, `hidden` glyphs of hidden text (a scanner's OCR) and `strokes` stroked
segments. `drawn` further pages are ordinary drawn pages with no picture.
"""

from engine.fixtures.pdf._writer import (
    A3,
    Page,
    Pdf,
    document,
    image,
    place,
    strokes,
    text,
    truetype_font,
)


def write(
    share: float = 1.0,
    pages: int = 1,
    tiles: int = 1,
    chars: int = 0,
    hidden: int = 0,
    strokes_drawn: int = 0,
    drawn: int = 0,
) -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    picture = image(pdf, 8, 8)
    width, height = A3
    strip = width * share / tiles
    content = b"".join(place("Im1", i * strip, 0, strip, height) for i in range(tiles))
    content += strokes(strokes_drawn)
    if chars:
        content += text(100, 400, "X" * chars, size=8)
    if hidden:
        content += text(100, 300, "H" * hidden, size=8, render=3)
    scanned = [
        Page(content=content, fonts={"F1": font}, xobjects={"Im1": picture}) for _ in range(pages)
    ]
    plotted = [
        Page(content=strokes(30) + text(900, 60, "A-201 SECTION", size=12), fonts={"F1": font})
        for _ in range(drawn)
    ]
    return document(pdf, scanned + plotted, info={"Producer": "Scanner Suite 4"})
