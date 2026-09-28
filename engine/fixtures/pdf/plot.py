"""A plot as AutoCAD's PDF driver writes one with PDFSHX at 1: three invented sheets.

- Page 1, landscape: strokes on layer `A-WALL`; the title block's number and title as real text in an
  embedded TrueType font on layer `A-TEXT`; a note in the body; two SHX comments (one carrying the raw
  diameter code); one small picture, as a gradient hatch plots.
- Page 2, `/Rotate 270`: a portrait page box whose drawing is turned to read landscape, its text drawn
  one glyph per text object at 270° (what fragments a reader that groups by position); one comment.
- Page 3, landscape: a mirrored text (letters drawn right to left, flipped); no comment, and a title
  block in real text, so its lettering is kept.

`producer` and `creator` replace the Info dictionary's entries (none leaves it out).
"""

from engine.fixtures.pdf._writer import (
    A3,
    Page,
    Pdf,
    document,
    image,
    layer,
    letters,
    on_layer,
    place,
    shx_comment,
    strokes,
    text,
    truetype_font,
)

PRODUCER = "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"
CREATOR = "AutoCAD 2027 - English 2027"


def write(producer: str | None = PRODUCER, creator: str | None = CREATOR) -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    walls, lettering = layer(pdf, "A-WALL"), layer(pdf, "A-TEXT")
    picture = image(pdf)

    first = Page(
        content=on_layer("oc1", strokes(40))
        + on_layer(
            "oc2",
            text(900, 60, "S-101", size=12)
            + text(900, 40, "GROUND FLOOR PLAN", size=8)
            + text(200, 500, "COLUMN C1", size=6),
        )
        + place("Im1", 300, 300, 20, 20),
        fonts={"F1": font},
        layers={"oc1": walls, "oc2": lettering},
        xobjects={"Im1": picture},
        annots=[
            shx_comment(pdf, "%%C12 BAR", (400, 400, 440, 406)),
            shx_comment(pdf, "GRID A", (100, 700, 130, 706)),
        ],
    )
    portrait = (A3[1], A3[0])
    second = Page(
        content=strokes(20) + letters(60, 1100, "BEAM B-12", size=10, angle=270),
        size=portrait,
        rotate=270,
        fonts={"F1": font},
        annots=[shx_comment(pdf, "GRID 1", (200, 300, 206, 330))],
    )
    third = Page(
        content=strokes(10)
        + text(600, 400, "MIRRORED NOTE", size=8, mirrored=True)
        + text(900, 60, "S-102", size=12)
        + text(900, 40, "FIRST FLOOR PLAN", size=8),
        fonts={"F1": font},
    )
    info = {key: value for key, value in (("Producer", producer), ("Creator", creator)) if value}
    return document(pdf, [first, second, third], info=info or None)
