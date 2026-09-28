"""A page's glyphs, in the order the page draws them, joined into text items.

The rule (engine/read/pdf's docstring gives the evidence): glyphs are taken in content-stream order,
never re-sorted by position, since a plot's stream order is the text's own order (a mirrored text reads
right way round in it, and a rotated page's words stay whole). The glyphs of one show operator (one
`Tj` or `TJ`) are always one item: the producer wrote them as one string. A glyph of the next show
operator continues the item before it when it is drawn the same way and where that one's pen ended:
- the same visibility (drawn, or hidden text), the same size (within `SIZE_TOLERANCE`), the same
  direction (within `ANGLE_TOLERANCE`) and the same mirroring;
- its origin lies along the direction of reading between `GAP_BEFORE` and `GAP_AFTER` ems of where the
  last glyph moved the pen (its width, the character spacing and any word spacing), and within
  `ACROSS` of the text's size above or below that line.
Within an item, a gap of `SPACE_GAP` ems or more between two glyphs that are not spaces is one space.

An em along the line is the size as the line is scaled (horizontal scaling, AutoCAD's width factor,
included), so a word gap written as a `TJ` number reads the same in narrow text; across the line it is
the text's height. Every threshold is fixed here before any real drawing was read through this code,
and is not tuned to a result: a word space in the fonts AutoCAD plots is about a quarter to a third of
an em, and a line of text sits a whole em or more below the last.
"""

import math
from collections.abc import Iterable, Iterator
from dataclasses import dataclass

SIZE_TOLERANCE = 0.01
"""Two glyphs of one item differ in size by at most this share of the first one's."""
ANGLE_TOLERANCE = 0.01
"""…and in direction by at most this many radians (about half a degree)."""
GAP_BEFORE = -0.5
GAP_AFTER = 1.0
"""The next glyph starts between half an em before and one em after the last one's advance ends."""
ACROSS = 0.25
"""…and at most a quarter of an em above or below that line."""
SPACE_GAP = 0.25
"""A gap of a quarter of an em or more between two glyphs is a space the stream did not draw."""
UNKNOWN = "\ufffd"
"""A glyph whose font does not say which letter it is."""


@dataclass(frozen=True)
class Glyph:
    """One glyph as the page draws it, in the displayed page's frame (points, y up)."""

    text: str
    origin: tuple[float, float]
    axis: tuple[float, float]
    """The direction of reading: the unit vector of the glyph's own baseline, forward."""
    advance: tuple[float, float]
    """Where the next glyph would start, relative to `origin` (zero for a glyph with no width)."""
    up: tuple[float, float]
    """One em upright from the baseline: its length is the glyph's size on the page."""
    em: float
    """One em along the line, on the page: the size as the line is scaled."""
    box: tuple[float, float, float, float]
    index: int
    """The drawing-order index of the text object that drew it."""
    hidden: bool
    font: str


@dataclass(frozen=True)
class Run:
    """Glyphs joined into one text item."""

    text: str
    box: tuple[float, float, float, float]
    index: int
    size: float
    angle: float
    """The direction the text advances in, in degrees anticlockwise from the page's x axis, 0 to 360."""
    mirrored: bool
    hidden: bool
    font: str


def _size(glyph: Glyph) -> float:
    return math.hypot(*glyph.up)


def _direction(glyph: Glyph) -> tuple[float, float] | None:
    length = math.hypot(*glyph.axis)
    if not (math.isfinite(length) and abs(length - 1) < 1e-6):
        return None
    return glyph.axis


def _mirrored(glyph: Glyph) -> bool:
    # The baseline turns anticlockwise into the upright in a text as written; a mirror reverses that.
    return glyph.axis[0] * glyph.up[1] - glyph.axis[1] * glyph.up[0] < 0


def _angle(direction: tuple[float, float]) -> float:
    return math.degrees(math.atan2(direction[1], direction[0])) % 360


def continues(last: Glyph, glyph: Glyph) -> tuple[bool, bool]:
    """Whether `glyph` continues the item `last` ends, and whether a space lies between them."""
    size, direction = _size(last), _direction(last)
    if direction is None or size == 0 or last.em == 0 or glyph.hidden != last.hidden:
        return False, False
    if abs(_size(glyph) - size) > SIZE_TOLERANCE * size or _mirrored(glyph) != _mirrored(last):
        return False, False
    other = _direction(glyph)
    if other is None:
        return False, False
    cross = direction[0] * other[1] - direction[1] * other[0]
    turn = math.atan2(cross, direction[0] * other[0] + direction[1] * other[1])
    if abs(turn) > ANGLE_TOLERANCE:
        return False, False
    end = (last.origin[0] + last.advance[0], last.origin[1] + last.advance[1])
    gap = (glyph.origin[0] - end[0], glyph.origin[1] - end[1])
    along = (gap[0] * direction[0] + gap[1] * direction[1]) / last.em
    across = (gap[1] * direction[0] - gap[0] * direction[1]) / size
    shown_together = glyph.index == last.index
    if not shown_together and not (GAP_BEFORE <= along <= GAP_AFTER and abs(across) <= ACROSS):
        return False, False
    return True, along >= SPACE_GAP and not last.text.isspace() and not glyph.text.isspace()


def runs(glyphs: Iterable[Glyph]) -> Iterator[Run]:
    """The glyphs, in the order given, joined into text items; an item of spaces alone is dropped."""
    current: list[Glyph] = []
    text: list[str] = []
    for glyph in glyphs:
        if current:
            joined, space = continues(current[-1], glyph)
            if joined:
                if space:
                    text.append(" ")
                current.append(glyph)
                text.append(glyph.text)
                continue
            yield from _run(current, text)
        current, text = [glyph], [glyph.text]
    if current:
        yield from _run(current, text)


def _run(glyphs: list[Glyph], text: list[str]) -> Iterator[Run]:
    joined = "".join(text).strip()
    if not joined.strip(UNKNOWN + " "):
        return  # nothing but glyphs whose letters are unknown: no text to read
    first = glyphs[0]
    direction = _direction(first) or (1.0, 0.0)
    yield Run(
        text=joined,
        box=(
            min(g.box[0] for g in glyphs),
            min(g.box[1] for g in glyphs),
            max(g.box[2] for g in glyphs),
            max(g.box[3] for g in glyphs),
        ),
        index=first.index,
        size=_size(first),
        angle=_angle(direction),
        mirrored=_mirrored(first),
        hidden=first.hidden,
        font=first.font,
    )
