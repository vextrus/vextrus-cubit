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
  when it has one; lines are 5/3 of their tallest run apart (AutoCAD's single spacing); the block sits on
  its attachment point (1-9: top, middle or bottom; left, centre or right), each line aligned by it.
- Bounded: at most `MAX_CHARACTERS` characters of one text are laid out; the rest are counted.
"""

import math
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from engine.read.artefact import Text, TextStyle
from engine.render.fonts import Substitute, substitute
from engine.render.fonts.glyphs import FontKey, outline, strokes
from engine.text.decode import Run, runs

MAX_CHARACTERS = 20_000
LINE_SPACING = 5 / 3
ITALIC_SLANT = math.tan(math.radians(12))
STACK_SIZE = 0.7


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


def lay_out(text: Text, local_height: float, style: TextStyle | None = None) -> Laid:
    laid = Laid()
    lines, laid.cut = _atoms(text, local_height, style)
    mtext = text.type == "MTEXT"
    limit = (text.width or 0.0) / local_height if mtext else 0.0
    if mtext and math.isfinite(limit) and limit > 0:
        lines = [piece for line in lines for piece in _wrap(line, limit)]
    baselines: list[float] = []
    y = 0.0
    for index, line in enumerate(lines):
        tallest = max((a.size for a in line), default=1.0)
        if index == 0:
            y = -tallest if mtext else 0.0  # an MTEXT hangs from its top; a TEXT sits on its baseline
        else:
            y -= LINE_SPACING * tallest
        baselines.append(y)
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
    for part, rise in ((upper, 0.6), (lower, -0.35)):
        x = u
        for char in part:
            x += _glyph(laid, atom, char, x, v + rise * atom.size, size)
    if kind == "/":
        y = v + 0.45 * atom.size
        laid.strokes.append(np.array([[u, y], [u + atom.advance, y]]))
