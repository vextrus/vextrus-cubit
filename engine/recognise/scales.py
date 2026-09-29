"""Stated scales (17): what a view's title or the text beside it says its scale is.

    scales.read(text, patterns) -> Scale | None

`patterns` are the view conventions' `scale_patterns` (regular expressions, data a Drafting Profile
extends; `engine/recognise/conventions/view-default.json` holds the default), tried in order; the first
that matches decides. A pattern names what it read by its groups:

- `paper` and `real`: a ratio, paper to real ("1:100", "1 : 50"): the view is drawn at real/paper;
- `inches` (a fraction such as "1/8" or a whole "1") and `feet`: a drawing in inches to the foot
  ("1/8\" = 1'-0\""): the view is drawn at 12 x feet / inches;
- `nts`: not to scale ("N.T.S.", "NOT TO SCALE"); a view so marked has no ratio.

The result keeps the text as the drawing states it (`stated`, the matched words, verbatim) and the
ratio it gives (100.0 for "1:100"), or none for a not-to-scale mark or a figure that cannot be read (a
zero, a denominator of zero, a number past `MAX_RATIO`). A text longer than the conventions' pattern
bound is never matched (`types.pattern_search`).
"""

import math
from dataclasses import dataclass
from fractions import Fraction

from engine.recognise.types import pattern_search

MAX_RATIO = 1_000_000.0
"""The largest scale ratio read (1:1,000,000); a larger one is kept as stated, with no ratio."""
MAX_FIGURE = 12
"""The most characters a figure of a scale is read from (a longer run is not turned into a number)."""


@dataclass(frozen=True)
class Scale:
    stated: str
    """The scale's words as drawn (the matched text)."""
    ratio: float | None
    """Real units per paper unit (100.0 for 1:100); none when not to scale or not readable."""
    not_to_scale: bool = False


def read(text: str, patterns: tuple[str, ...]) -> Scale | None:
    """The first scale `patterns` find in `text`, or none."""
    if not isinstance(text, str):
        return None
    for pattern in patterns:
        found = pattern_search(pattern, text)
        if found is None or not found.group(0).strip():
            continue
        groups = {k: v for k, v in found.groupdict().items() if v is not None}
        stated = found.group(0).strip()
        if "nts" in groups:
            return Scale(stated, None, not_to_scale=True)
        if "paper" in groups and "real" in groups:
            return Scale(stated, _ratio(_figure(groups["real"]), _figure(groups["paper"])))
        if "inches" in groups and "feet" in groups:
            inches, feet = _figure(groups["inches"]), _figure(groups["feet"])
            return Scale(stated, _ratio(None if feet is None else feet * 12, inches))
        return Scale(stated, None)
    return None


def _figure(text: str) -> Fraction | None:
    """A figure: a whole or decimal number, or a fraction "a/b"; none past `MAX_FIGURE` characters."""
    text = text.strip().replace(" ", "")
    if not text or len(text) > MAX_FIGURE:
        return None
    try:
        if "/" in text:
            top, bottom = text.split("/", 1)
            return Fraction(int(top), int(bottom)) if int(bottom) else None
        return Fraction(text)
    except ValueError, ZeroDivisionError:
        return None


def _ratio(real: Fraction | None, paper: Fraction | None) -> float | None:
    if real is None or paper is None or paper <= 0 or real <= 0:
        return None
    value = float(real / paper)
    return value if math.isfinite(value) and value <= MAX_RATIO else None
