"""One page with exactly the lettering asked for: to test the lettering rule on either side of its edges.

`chars` glyphs of real text (one string of `X`s), `hidden` glyphs of hidden text (render mode 3, as
AutoCAD writes SHX text with PDFSHX at 2), `comments` SHX comments and `strokes` stroked segments.
`pages` repeats the page; `comment_pages` puts the comments on only the first so many of them.
"""

from engine.fixtures.pdf._writer import Page, Pdf, document, shx_comment, strokes, text, truetype_font


def write(
    chars: int = 0,
    hidden: int = 0,
    comments: int = 0,
    strokes_drawn: int = 1,
    pages: int = 1,
    comment_pages: int | None = None,
) -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    content = strokes(strokes_drawn)
    if chars:
        content += text(100, 400, "X" * chars, size=8)
    if hidden:
        content += text(100, 300, "H" * hidden, size=8, render=3)
    listed = []
    for number in range(pages):
        commented = comment_pages is None or number < comment_pages
        annots = [
            shx_comment(pdf, f"NOTE {i}", (200, 200 + 10 * i, 240, 206 + 10 * i))
            for i in range(comments if commented else 0)
        ]
        listed.append(Page(content=content, fonts={"F1": font}, annots=annots))
    return document(pdf, listed, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})
