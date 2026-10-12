"""Text laid out as the engine draws it: glyphs placed in text units, before any placement.

`lay_out(text, local_height, style)` turns one TEXT, ATTRIB, ATTDEF or MTEXT into glyphs placed in **text
units** (1 is the text's height; x along its baseline from its position, y up), which the caller maps
into the world through `engine.text.mtext.frame`. The browser lays out no drawing text (m0-screens
4.6): what it draws is this.

- Every character is drawn with its font's substitute (`engine.render.fonts.substitute`): an outline
  glyph (drawn as SDF), or for AutoCAD's SHX lettering the single-stroke glyph as lines. A character
  the single-stroke font lacks is drawn from Liberation Sans; ⌀, which Liberation lacks, as Ø; any
  other missing character as the font's empty box, and counted.
- A TEXT (and ATTRIB, ATTDEF) is one line from its start point, left to right, whatever its alignment
  (the reader gives the start point, from which AutoCAD plots it: docs/knowledge/lessons.md), stretched
  by its width factor. `%%U` and `%%O` draw their lines.
- **The text style's width factor and oblique angle** (#88; the artefact's style table, #82): an MTEXT
  is drawn at its style's width factor, a TEXT at its own (which AutoCAD copies from the style), and
  both leaning by the style's oblique angle; an inline `\\W` or `\\Q` wins. A value that is not a
  usable number is drawn as 1 and 0.
- An MTEXT's runs keep their inline font, bold, italic (a 12° slant), height (`\\H`), width (`\\W`),
  oblique (`\\Q`), tracking (`\\T`), underline, overline and strike-through; a stacked fraction draws its
  parts at 0.7 of the height, one above the other with a bar (`/`), side by side with a slash (`#`), or
  one above the other (`^`). Lines break at `\\P` and wrap at spaces past the MTEXT's reference width,
  when it has one; the block sits on its attachment point (1-9: top, middle or bottom; left, centre or
  right), each line aligned by it.
- **An MTEXT's line spacing** is its own (S24-A4): single spacing is 5/3 of a line's tallest run; the
  entity's factor (0.25 to 4, as AutoCAD allows) multiplies it; its style 1 ("at least") keeps it
  per line, its style 2 ("exactly") spaces every line by the factor times 5/3 of the MTEXT's height,
  whatever its runs. A style that is neither reads as at least; a factor outside AutoCAD's range, or
  none, as 1.
- **An MTEXT is fitted to AutoCAD's own measure of it** (S24-A4): the file stores, beside the
  reference width, the width of the widest line AutoCAD drew (`extents_width`) and the block's height
  (`extents_height`). The outline substitutes measure wider than the faces they stand for (the
  condensed ones by a quarter or more, Arial's own by 4 %), and drafters' reference rectangles hug
  AutoCAD's lines within a few per cent, so wrapping with the substitute's widths broke lines AutoCAD
  kept whole, and the extra line printed over the text below. So the text's box is AutoCAD's measured
  width (a word longer than the reference width overflows it in AutoCAD too); for single-stroke text
  its reference width instead (AutoCAD's measure of SHX runs 12 % under the width its Plot shows,
  which the Hershey substitute matches), and none without one. It is laid out at a horizontal
  squeeze, from 1 down to `MIN_SQUEEZE` in steps of `SQUEEZE_STEP`, wrapping at the reference width
  as AutoCAD would with faces that narrow. Of the squeezes whose widest line fits the box (within
  `FIT_TOLERANCE`), the one wins whose block height is nearest AutoCAD's measured height (its lines
  are as many as AutoCAD's), then (outline text) whose widest line is nearest AutoCAD's measured
  width, a line within a step of it counting as exact (and the layout without a squeeze when within
  `FIT_TOLERANCE` of it, so Arial stays as drawn), then the gentlest: two wraps can each meet
  AutoCAD's width and height (a word moved between lines), and the gentler squeeze is the Plot's
  (three headings of a real set). At a squeeze of 1 the text is laid out as without a fit, else its
  lines are drawn squeezed to fill the box. With no measured width, no box, or no squeeze that
  fits, there is no fit. A TEXT is laid out without one.
- Bounded: at most `MAX_CHARACTERS` characters of one text are laid out; the rest are counted.
"""

import math
from dataclasses import dataclass, field, replace

import numpy as np
from numpy.typing import NDArray

from engine.read.artefact import Text, TextStyle
from engine.render.fonts import Substitute, substitute
from engine.render.fonts.glyphs import FontKey, outline, strokes
from engine.text.decode import Run, runs

MAX_CHARACTERS = 20_000
LINE_SPACING = 5 / 3
LINE_SPACING_FACTORS = (0.25, 4.0)
"""The line spacing factors AutoCAD accepts; any other reads as 1."""
EXACTLY = 2
"""An MTEXT's line spacing style "exactly" (DXF group 73); 1 is "at least"."""
FIT_TOLERANCE = 0.05
"""How much wider than AutoCAD's measure a line may be drawn unsqueezed (Arial's substitute: 4.4 %)."""
MIN_SQUEEZE = 0.6
SQUEEZE_STEP = 0.01
MAX_FIT_CHARACTERS = 2_000
"""The longest MTEXT fitted (each squeeze wraps it again: one entity's cost stays bounded apart from
the sheet's budget, as `engine.render.buffers` asks); the real sets' longest is 300."""
FIRST_LINE_DEPTH = 1.03
"""AutoCAD's measured height of one line, in its tallest run's heights (both real sets)."""
ITALIC_SLANT = math.tan(math.radians(12))
STACK_SIZE = 0.7
STACK_BELOW = 0.35
"""How far below its line's baseline a stacked fraction's lower part is drawn, in the run's heights."""


@dataclass(frozen=True)
class PlacedGlyph:
    """An outline glyph: font and character (none for the font's empty box), placed so its point
    (gx, gy) lands at (u + sx·gx + shear·gy, v + sy·gy) in text units."""

    key: FontKey
    char: str | None
    u: float
    v: float
    sx: float
    sy: float
    shear: float


@dataclass
class Laid:
    glyphs: list[PlacedGlyph] = field(default_factory=list)
    strokes: list[NDArray[np.float64]] = field(default_factory=list)
    """Polylines in text units: single-stroke letters and the lines under, over and through runs."""
    fonts: set[Substitute] = field(default_factory=set)
    missing: int = 0
    """Characters drawn as an empty box."""
    cut: int = 0
    """Characters past `MAX_CHARACTERS`, not laid out."""


@dataclass(frozen=True)
class _Atom:
    char: str
    run: Run
    size: float
    width: float
    shear: float
    font: Substitute
    advance: float


def _positive(value: float | None, default: float) -> float:
    return value if value is not None and math.isfinite(value) and value > 0 else default


def _advance(font: Substitute, char: str) -> float:
    if char in (" ", "\u00a0", "\t"):
        char = " "
    if font.key is FontKey.STROKE:
        found = strokes(char)
        if found is not None:
            return found.advance
        font_key = FontKey.SANS
    else:
        font_key = font.key
    glyph = outline(font_key, char) or outline(font_key, "Ø" if char == "⌀" else " ")
    return glyph.advance if glyph is not None else 0.5


def _atoms(
    text: Text, local_height: float, text_style: TextStyle | None = None
) -> tuple[list[list[_Atom]], int]:
    mtext = text.type == "MTEXT"
    styled = text_style.width_factor if text_style is not None else None
    width_factor = _positive(styled, 1.0) if mtext else _positive(text.width, 1.0)
    oblique = text_style.oblique_radians if text_style is not None else None
    leaning = math.degrees(oblique) if oblique is not None and math.isfinite(oblique) else 0.0
    lines: list[list[_Atom]] = [[]]
    count = cut = 0
    for run in runs(text.text, mtext=mtext):
        if run.text == "\n":
            lines.append([])
            continue
        style = run.style
        size = (style.height / local_height if style.height is not None else 1.0) * style.scale
        size = _positive(size, 1.0)
        width = _positive(style.width, width_factor) * _positive(style.tracking, 1.0)
        angle = leaning if style.oblique is None else style.oblique  # an inline `\\Q` wins, `\\Q0` too
        shear = math.tan(math.radians(angle)) if abs(angle) < 85 else 0.0
        if style.italic:
            shear += ITALIC_SLANT
        font = substitute(style.font if style.font is not None else text.font, style.bold)
        if run.stack is not None:
            upper, lower, _ = run.stack
            stacked = size * STACK_SIZE
            span = max(sum(_advance(font, c) for c in part) for part in (upper, lower)) * stacked * width
            lines[-1].append(_Atom("", run, size, width, shear, font, span))
            continue
        for char in run.text:
            count += 1
            if count > MAX_CHARACTERS:
                cut += 1
                continue
            lines[-1].append(
                _Atom(char, run, size, width, shear, font, _advance(font, char) * size * width)
            )
    return lines, cut


def _wrap(line: list[_Atom], limit: float) -> list[list[_Atom]]:
    out: list[list[_Atom]] = []
    current: list[_Atom] = []
    x = 0.0
    last_space = -1
    for atom in line:
        if atom.char == " ":
            last_space = len(current)
        if x + atom.advance > limit and current and last_space >= 0 and atom.char != " ":
            out.append(current[:last_space])
            current = current[last_space + 1 :]
            x = sum(a.advance for a in current)
            last_space = -1
        current.append(atom)
        x += atom.advance
    out.append(current)
    return out


def _glyph(laid: Laid, atom: _Atom, char: str, u: float, v: float, size: float) -> float:
    """Draw one character at (u, v) at `size`; its advance."""
    font = atom.font
    if char.isspace():
        return _advance(font, " ") * size * atom.width
    if font.key is FontKey.STROKE:
        found = strokes(char)
        if found is not None:
            sx, sy = size * atom.width, size
            for stroke in found.strokes:
                laid.strokes.append(
                    np.column_stack(
                        [u + sx * stroke[:, 0] + atom.shear * sy * stroke[:, 1], v + sy * stroke[:, 1]]
                    )
                )
            return found.advance * sx
        key = FontKey.SANS
    else:
        key = font.key
    glyph = outline(key, char)
    drawn: str | None = char
    if glyph is None and char == "⌀":
        drawn, glyph = "Ø", outline(key, "Ø")
    if glyph is None:
        drawn = None
        laid.missing += 1
        advance = 0.6
    else:
        advance = glyph.advance
    laid.glyphs.append(PlacedGlyph(key, drawn, u, v, size * atom.width, size, atom.shear * size))
    return advance * size * atom.width


def _decorate(laid: Laid, atom: _Atom, u0: float, u1: float, v: float) -> None:
    style = atom.run.style
    for on, height in ((style.underline, -0.2), (style.overline, 1.2), (style.strike, 0.5)):
        if on and u1 > u0:
            y = v + height * atom.size
            laid.strokes.append(np.array([[u0, y], [u1, y]]))


def _spacing(text: Text) -> tuple[bool, float]:
    """Whether an MTEXT's lines are spaced exactly, and its factor (the module's docstring)."""
    factor = text.line_spacing_factor
    low, high = LINE_SPACING_FACTORS
    usable = factor is not None and math.isfinite(factor) and low <= factor <= high
    return text.line_spacing_style == EXACTLY, factor if usable and factor is not None else 1.0


def _baselines(lines: list[list[_Atom]], mtext: bool, exactly: bool, factor: float) -> list[float]:
    baselines: list[float] = []
    y = 0.0
    for index, line in enumerate(lines):
        tallest = max((a.size for a in line), default=1.0)
        if index == 0:
            y = -tallest if mtext else 0.0  # an MTEXT hangs from its top; a TEXT sits on its baseline
        else:
            y -= LINE_SPACING * factor * (1.0 if exactly else tallest)
        baselines.append(y)
    return baselines


def _inked(line: list[_Atom]) -> float:
    """A line's width without its trailing spaces, as AutoCAD measures its widest line."""
    end = len(line)
    while end and line[end - 1].char == " " and line[end - 1].run.stack is None:
        end -= 1
    return sum(a.advance for a in line[:end])


def _wrapped(paragraphs: list[list[_Atom]], limit: float) -> list[list[_Atom]]:
    if math.isfinite(limit) and limit > 0:
        return [piece for line in paragraphs for piece in _wrap(line, limit)]
    return paragraphs


def _usable(value: float | None, local_height: float) -> float | None:
    if value is None or not math.isfinite(value) or value <= 0:
        return None
    ratio = value / local_height
    return ratio if math.isfinite(ratio) and ratio > 0 else None


def _depth(lines: list[list[_Atom]], exactly: bool, factor: float) -> float:
    """The block's height as AutoCAD measures it, in text units: from its top to below its last line
    (a stacked fraction reaching below the line, its lower part's depth)."""
    if not lines:
        return 0.0
    last = lines[-1]
    tallest = max((a.size for a in last), default=1.0)
    below = max(
        [(FIRST_LINE_DEPTH - 1.0) * tallest]
        + [STACK_BELOW * a.size for a in last if a.run.stack is not None and a.run.stack[2] != "#"]
    )
    return -_baselines(lines, True, exactly, factor)[-1] + below


def _fit(
    text: Text, paragraphs: list[list[_Atom]], local_height: float, exactly: bool, factor: float
) -> tuple[list[list[_Atom]], float]:
    """An MTEXT's lines and the squeeze they are drawn at (the module's docstring)."""
    limit = (text.width or 0.0) / local_height
    wrapping = math.isfinite(limit) and limit > 0
    measured = _usable(text.extents_width, local_height)
    if measured is None or sum(len(line) for line in paragraphs) > MAX_FIT_CHARACTERS:
        return _wrapped(paragraphs, limit), 1.0
    outline = any(a.font.key is not FontKey.STROKE for line in paragraphs for a in line)
    box = measured if outline else limit if wrapping else None
    if box is None:
        return _wrapped(paragraphs, limit), 1.0
    depth = _usable(text.extents_height, local_height)
    best: tuple[tuple[float, float, float], list[list[_Atom]], float] | None = None
    for step in range(round((1.0 - MIN_SQUEEZE) / SQUEEZE_STEP) + 1):
        squeeze = 1.0 - step * SQUEEZE_STEP
        lines = _wrapped(paragraphs, limit / squeeze)
        drawn = max((_inked(line) for line in lines), default=0.0) * squeeze
        if drawn > box * (1 + FIT_TOLERANCE):
            continue
        rows = 0.0 if depth is None else abs(_depth(lines, exactly, factor) - depth)
        miss = abs(drawn - measured) if outline else 0.0
        if squeeze == 1.0 and miss <= FIT_TOLERANCE * measured:
            miss = 0.0  # as drawn without a fit: within the tolerance, nothing to fit
        elif miss <= drawn / squeeze * SQUEEZE_STEP:
            miss = 0.0  # within a step of AutoCAD's width: these lines meet it exactly between steps
        key = (round(rows, 1), round(miss / measured / SQUEEZE_STEP), -squeeze)
        if best is None or key < best[0]:
            best = (key, lines, squeeze)
    if best is None:
        return _wrapped(paragraphs, limit), 1.0
    _, lines, squeeze = best
    if squeeze == 1.0:
        return lines, 1.0
    widest = max((_inked(line) for line in lines), default=0.0)
    return lines, min(1.0, max(MIN_SQUEEZE, box / widest)) if widest > 0 else squeeze


def _squeezed(lines: list[list[_Atom]], squeeze: float) -> list[list[_Atom]]:
    if squeeze == 1.0:
        return lines
    return [
        [replace(a, width=a.width * squeeze, advance=a.advance * squeeze) for a in line]
        for line in lines
    ]


def lay_out(text: Text, local_height: float, style: TextStyle | None = None) -> Laid:
    laid = Laid()
    paragraphs, laid.cut = _atoms(text, local_height, style)
    mtext = text.type == "MTEXT"
    exactly, factor = _spacing(text) if mtext else (False, 1.0)
    if mtext:
        lines, squeeze = _fit(text, paragraphs, local_height, exactly, factor)
        lines = _squeezed(lines, squeeze)
    else:
        lines = paragraphs
    baselines = _baselines(lines, mtext, exactly, factor)
    attachment = (text.attachment or 1) if mtext else 1
    if not 1 <= attachment <= 9:
        attachment = 1
    row, column = (attachment - 1) // 3, (attachment - 1) % 3
    lowest = baselines[-1] if baselines else 0.0
    lift = 0.0 if row == 0 else -lowest / 2 if row == 1 else -lowest
    for line, baseline in zip(lines, baselines, strict=True):
        width = sum(a.advance for a in line)
        u = 0.0 if column == 0 else -width / 2 if column == 1 else -width
        v = baseline + lift
        for atom in line:
            laid.fonts.add(atom.font)
            start = u
            if atom.run.stack is not None:
                _stack(laid, atom, u, v)
                u += atom.advance
            else:
                u += _glyph(laid, atom, atom.char, u, v, atom.size)
            _decorate(laid, atom, start, u, v)
    return laid


def _stack(laid: Laid, atom: _Atom, u: float, v: float) -> None:
    assert atom.run.stack is not None
    upper, lower, kind = atom.run.stack
    size = atom.size * STACK_SIZE
    if kind == "#":
        x = u
        for char in f"{upper}/{lower}":
            x += _glyph(laid, atom, char, x, v, size)
        return
    for part, rise in ((upper, 0.6), (lower, -STACK_BELOW)):
        x = u
        for char in part:
            x += _glyph(laid, atom, char, x, v + rise * atom.size, size)
    if kind == "/":
        y = v + 0.45 * atom.size
        laid.strokes.append(np.array([[u, y], [u + atom.advance, y]]))
