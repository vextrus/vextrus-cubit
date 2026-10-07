"""A column's size label read as two dimensions, and their conversion into drawing units.

A size label is two lengths joined by a times sign: `250x500`, `250 X 500`, `10"x20"`, `1'-0" x 1'-6"`,
`300mm x 600mm`. The grammar is engineering notation, not an office's convention (ADR 0039: an office's
label patterns are its Drafting Profile's, `families.column.label_patterns`): a length is a number with
an optional unit mark (`mm`, `cm`, `m`, `"` or `''` or `in` for inches, feet-and-inches as `1'-6"`). A
mark written on one length only holds for both (`10x20"`). A label with no unit mark at all is
`unit=None`: which unit it means is decided by the outline it labels (`resolve`), never guessed here.

The first length is `b`, the second `d`, verbatim order. Values are exact Decimals; no float is used.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

MM_PER: dict[str, Decimal] = {
    "mm": Decimal(1),
    "cm": Decimal(10),
    "m": Decimal(1000),
    "in": Decimal("25.4"),
    "ft": Decimal("304.8"),
}
"""Millimetres in one of each unit a label or a drawing may state."""

FIT = Decimal("0.1")
"""How near a label's reading must lie to its outline's sides to fit it."""

INSUNITS: dict[int, str] = {1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m"}
"""DXF $INSUNITS codes for the units a structural plan is drawn in."""

_NUMBER = r"\d+(?:\.\d+)?"
_FEET_INCHES = rf"(?P<{{n}}ft>\d+)\s*'\s*-?\s*(?P<{{n}}fi>{_NUMBER})\s*(?:\"|'')"
_PLAIN = rf"(?P<{{n}}v>{_NUMBER})\s*(?P<{{n}}u>mm|cm|m(?![a-z])|\"|''|in(?:ch(?:es)?)?\b)?"


def _length(n: str) -> str:
    return rf"(?:{_FEET_INCHES.format(n=n)}|{_PLAIN.format(n=n)})"


_SIZE = re.compile(rf"(?<![\d.]){_length('b')}\s*[xX\u00d7*]\s*{_length('d')}(?!\d|\.\d)", re.IGNORECASE)
MAX_TEXT = 200
"""The longest text read for a size: a label is a few words; a longer text is a note, never parsed
(the grammar's runs of spaces are not linear in a hostile text far longer than any label)."""
MAX_LENGTH = Decimal(100000)
"""The longest length a label may state in any unit: a column 100 m wide is not a column."""
_UNIT_WORDS = {"mm": "mm", "cm": "cm", "m": "m", '"': "in", "''": "in"}


@dataclass(frozen=True)
class Size:
    """A size label's two lengths as written, in `unit` ("mm", "in", …; None when the label has none)."""

    b: Decimal
    d: Decimal
    unit: str | None
    text: str


def _one(match: re.Match[str], n: str) -> tuple[Decimal, str | None]:
    feet = match.group(f"{n}ft")
    if feet is not None:
        return Decimal(feet) * 12 + Decimal(match.group(f"{n}fi")), "in"
    raw = match.group(f"{n}u")
    unit = None if raw is None else _UNIT_WORDS.get(raw.lower(), "in")
    return Decimal(match.group(f"{n}v")), unit


def find(text: str) -> tuple[int, int] | None:
    """Where in `text` its size is written (start, end), or None."""
    match = _SIZE.search(text) if len(text) <= MAX_TEXT else None
    return None if match is None else match.span()


def parse(text: str) -> Size | None:
    """The size a label states, or None when it states none (a mark, a note, a single number)."""
    match = _SIZE.search(text) if len(text) <= MAX_TEXT else None
    if match is None:
        return None
    b, b_unit = _one(match, "b")
    d, d_unit = _one(match, "d")
    if b_unit is not None and d_unit is not None and b_unit != d_unit:
        b, d = b * MM_PER[b_unit], d * MM_PER[d_unit]
        b_unit = d_unit = "mm"
    if not (0 < b < MAX_LENGTH and 0 < d < MAX_LENGTH):
        return None
    return Size(b=b, d=d, unit=b_unit or d_unit, text=text)


def plain(value: Decimal, places: int = 6) -> Decimal:
    """`value` rounded to `places` and written without trailing zeros or an exponent."""
    rounded = value.quantize(Decimal(1).scaleb(-places))
    if rounded == rounded.to_integral_value():
        return rounded.quantize(Decimal(1))
    return rounded.normalize()


def to_drawing(size: Size, label_unit: str, drawing_unit: str) -> tuple[Decimal, Decimal]:
    """The size's b and d in drawing units, its label read in `label_unit`."""
    factor = MM_PER[label_unit] / MM_PER[drawing_unit]
    return plain(size.b * factor), plain(size.d * factor)


def resolve(size: Size, drawing_unit: str, outline: tuple[float, float] | None) -> str:
    """The unit a label means: its own mark, or for a bare label the one (mm or inches) whose reading
    lies nearer the outline it labels (sides in drawing units, either order); with no outline, inches
    for numbers under 100 and millimetres otherwise (a column under 100 mm is not drawn)."""
    if size.unit is not None:
        return size.unit
    if outline is not None and min(outline) > 0:
        sides = sorted(Decimal(repr(side)) for side in outline)

        def miss(unit: str) -> Decimal:
            b, d = sorted(to_drawing(size, unit, drawing_unit))
            return abs(b / sides[0] - 1) + abs(d / sides[1] - 1)

        return min(("mm", "in"), key=miss)
    return "in" if max(size.b, size.d) < 100 else "mm"


def _fits(size: Size, unit: str, drawing_unit: str, outline: tuple[float, float]) -> bool:
    b, d = sorted(to_drawing(size, unit, drawing_unit))
    low, high = sorted(Decimal(repr(side)) for side in outline)
    return low > 0 and abs(b / low - 1) <= FIT and abs(d / high - 1) <= FIT


def drawing_unit(stated: int, labelled: Sequence[tuple[Size, tuple[float, float]]]) -> str:
    """The unit a plan is drawn in: the one under which most size labels fit the outlines they label
    (a bare label fits read as mm or as inches), ties going to its $INSUNITS (`stated`) and then to
    millimetres. A file's $INSUNITS alone is not trusted: a plan drawn in millimetres often states
    metres or nothing."""
    preferred = INSUNITS.get(stated, "mm")

    def score(unit: str) -> tuple[int, bool, bool]:
        fits = sum(
            any(
                _fits(size, label, unit, outline)
                for label in ((size.unit,) if size.unit else ("mm", "in"))
            )
            for size, outline in labelled
        )
        return fits, unit == preferred, unit == "mm"

    return max(MM_PER, key=score)
