"""The one decode function: drawing text as a QS reads it (the M0 plan, ticket 11).

`decode(raw, mtext=...)` turns a text entity's string, exactly as the reader carries it
(`engine.read.artefact.Text.text`), into the characters it shows: 13 reads titles and numbers through
it, the renderer draws through it (by `runs`, which keeps the formatting) and 21 stores what it gives.
Nothing else in the engine or the product decodes drawing text.

**Codes every text entity has** (TEXT, ATTRIB, ATTDEF and MTEXT):
- `%%C` ⌀, `%%D` °, `%%P` ±, `%%%` a percent sign; `%%U` and `%%O` (underline and overline) switch a
  line on or off and show nothing; `%%nnn` is the character with that number in the drawing's code page
  (Windows-1252; a number past 255 shows nothing); any other `%%x` shows `x`, and a `%%` at the end
  shows nothing;
- `\\U+XXXX`, a Unicode character; `\\M+nXXXX`, a double-byte character in code page n (1 Japanese,
  2 Traditional Chinese, 3 Korean (Wansung), 4 Korean (Johab), 5 Simplified Chinese), as a bigfont
  stores it;
- the caret forms of control characters: `^J` a line break (the Edison dimension text carries 198 of
  them; docs/research/viewer-2d-fidelity.md), `^I` a space (a tab), `^M` nothing. No other caret is a
  code (`2^3` stays as written).

**MTEXT's own codes** (`mtext=True`): `\\P` (and `\\N`, a new column, and `\\X`, a dimension's break) a
line break; `\\~` a no-break space; `\\\\`, `\\{`, `\\}` the characters themselves; `{` and `}` group
formatting and show nothing; `\\L \\l \\O \\o \\K \\k` switch underline, overline and strike through;
`\\A \\C \\c \\F \\f \\H \\Q \\T \\W \\p` take a parameter up to `;` and show nothing (alignment,
colour, font, height, oblique angle, tracking, width, paragraph); `\\Sa/b;` stacks a fraction, shown as
`a/b` (and `a#b` the same; `a^b`, a tolerance, as `a b`; `2^` alone a superscript `²`, `^2` alone a
subscript `₂` where Unicode has one). A backslash before any other character is dropped and the
character kept. In a TEXT, ATTRIB or ATTDEF a backslash is the drawing's own character.

**Hostile text is bounded, never followed:** a parameter longer than `MAX_PARAMETER` characters, or
with no `;`, is not a parameter (only its code's backslash is dropped); braces nest at most
`MAX_NESTING` deep (deeper ones group nothing); a stack's parts are decoded once, never stacked again.
Decoding is one pass, linear in the text's length.
"""

from collections.abc import Iterator
from dataclasses import dataclass, replace

MAX_PARAMETER = 256
"""The longest parameter a code takes (a font name with its flags is under 100 characters)."""
MAX_NESTING = 64

_PERCENT = {"c": "⌀", "d": "°", "p": "±", "%": "%"}
_BIGFONT_CODEPAGES = {"1": "cp932", "2": "cp950", "3": "cp949", "4": "johab", "5": "gb2312"}
_CARETS = {"J": "\n", "I": " ", "M": ""}
_BREAKS = frozenset("PNX")
_TOGGLES = {"L": ("underline", True), "l": ("underline", False), "O": ("overline", True),
            "o": ("overline", False), "K": ("strike", True), "k": ("strike", False)}  # fmt: skip
_PARAMETERS = frozenset("ACcFfHQTWp")
_LITERALS = {"\\": "\\", "{": "{", "}": "}", "~": "\u00a0"}
_SUPERSCRIPT = str.maketrans("0123456789+-=()n", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ")
_SUBSCRIPT = str.maketrans("0123456789+-=()", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎")


@dataclass(frozen=True)
class Style:
    """The inline formatting in force for a run of MTEXT (a TEXT's runs carry the defaults)."""

    font: str | None = None
    """The inline font as written: a family (`\\fArial|b1;`) or an SHX file (`\\Fromans.shx;`)."""
    bold: bool = False
    italic: bool = False
    height: float | None = None
    """An absolute height (`\\H2.5;`), in drawing units; none keeps the entity's."""
    scale: float = 1.0
    """A relative height (`\\H0.8x;`), times the height in force."""
    width: float | None = None
    """A width factor (`\\W0.8;`)."""
    oblique: float = 0.0
    """An oblique angle in degrees (`\\Q15;`)."""
    tracking: float = 1.0
    colour: int | None = None
    """An AutoCAD colour index (`\\C1;`), or a true colour as 0x1RRGGBB (`\\c255;`: 0x10000FF)."""
    underline: bool = False
    overline: bool = False
    strike: bool = False


PLAIN = Style()


@dataclass(frozen=True)
class Run:
    """Characters drawn with one style: `text` decoded, `"\\n"` alone for a line break; a stacked
    fraction has `stack` (upper, lower, and its kind `/`, `#` or `^`) and its plain form as `text`."""

    text: str
    style: Style = PLAIN
    stack: tuple[str, str, str] | None = None

    @property
    def plain(self) -> str:
        return self.text


def decode(raw: str, *, mtext: bool = False) -> str:
    """The text as drawn: every code above replaced by what it shows (`mtext=True` for an MTEXT)."""
    return "".join(run.text for run in _scan(raw, mtext))


def runs(raw: str, *, mtext: bool = True) -> tuple[Run, ...]:
    """The decoded runs with their formatting, for the renderer (an MTEXT's inline codes, or a TEXT's
    `%%U` and `%%O`); joined, `decode`."""
    return tuple(_merge(_scan(raw, mtext)))


def _merge(found: Iterator[Run]) -> Iterator[Run]:
    pending: Run | None = None
    for run in found:
        if run.text == "" and run.stack is None:
            continue
        mergeable = (
            pending is not None
            and pending.stack is None
            and run.stack is None
            and pending.style == run.style
            and "\n" not in (pending.text, run.text)
        )
        if pending is not None and mergeable:
            pending = replace(pending, text=pending.text + run.text)
            continue
        if pending is not None:
            yield pending
        pending = run
    if pending is not None:
        yield pending


def _scan(raw: str, mtext: bool, stacked: bool = False) -> Iterator[Run]:
    style = PLAIN
    groups: list[Style] = []
    depth = 0  # braces opened, pushed or not
    text: list[str] = []
    i, n = 0, len(raw)

    def flush() -> Iterator[Run]:
        if text:
            yield Run("".join(text), style)
            text.clear()

    while i < n:
        char = raw[i]
        if char == "%" and raw.startswith("%%", i):
            shown, i, toggle = _percent(raw, i)
            if toggle is not None:
                yield from flush()
                style = _toggled(style, toggle, not getattr(style, toggle))
            text.append(shown)
            continue
        if char == "^" and i + 1 < n and raw[i + 1] in _CARETS:
            shown = _CARETS[raw[i + 1]]
            i += 2
            if shown == "\n":
                yield from flush()
                yield Run("\n", style)
            else:
                text.append(shown)
            continue
        if char in "\r\n":
            i += 2 if raw.startswith("\r\n", i) else 1
            yield from flush()
            yield Run("\n", style)
            continue
        if char == "\\":
            unicode = _unicode(raw, i)
            if unicode is not None:
                shown, i = unicode
                text.append(shown)
                continue
            if not mtext:
                text.append(char)
                i += 1
                continue
            code = raw[i + 1] if i + 1 < n else ""
            if code in _LITERALS:
                text.append(_LITERALS[code])
                i += 2
            elif code in _BREAKS:
                yield from flush()
                yield Run("\n", style)
                i += 2
            elif code in _TOGGLES:
                yield from flush()
                name, on = _TOGGLES[code]
                style = _toggled(style, name, on)
                i += 2
            elif code in _PARAMETERS or code == "S":
                end = raw.find(";", i + 2, i + 2 + MAX_PARAMETER + 1)
                if end < 0:  # not a parameter: drop the backslash, keep what follows
                    i += 1
                    continue
                parameter = raw[i + 2 : end]
                i = end + 1
                yield from flush()
                if code == "S":
                    if not stacked:
                        yield _stack(parameter, style)
                else:
                    style = _apply(style, code, parameter)
            else:  # an unknown code, or a backslash at the end: drop the backslash
                i += 1
            continue
        if mtext and char == "{":
            yield from flush()
            if depth < MAX_NESTING:
                groups.append(style)
            depth += 1
            i += 1
            continue
        if mtext and char == "}":
            yield from flush()
            if depth > 0:
                depth -= 1
                if depth < MAX_NESTING:
                    style = groups.pop()
            i += 1
            continue
        text.append(char)
        i += 1
    yield from flush()


def _toggled(style: Style, line: str, on: bool) -> Style:
    """The style with one of its lines (underline, overline, strike) switched on or off."""
    if line == "underline":
        return replace(style, underline=on)
    if line == "overline":
        return replace(style, overline=on)
    return replace(style, strike=on)


def _percent(raw: str, i: int) -> tuple[str, int, str | None]:
    """A `%%` code at `i`: what it shows, where the scan goes on, and the line it toggles, if any."""
    code = raw[i + 2 : i + 3]
    lower = code.lower()
    if lower in _PERCENT:
        return _PERCENT[lower], i + 3, None
    if lower in ("u", "o"):
        return "", i + 3, "underline" if lower == "u" else "overline"
    digits = raw[i + 2 : i + 5]
    if len(digits) == 3 and digits.isascii() and digits.isdigit():
        number = int(digits)
        return (bytes([number]).decode("cp1252", "ignore") if number < 256 else ""), i + 5, None
    return "", i + 2, None  # an unknown code, or `%%` at the end: its marker shows nothing


def _unicode(raw: str, i: int) -> tuple[str, int] | None:
    """A `\\U+XXXX` or `\\M+nXXXX` at `i`: the character and where the scan goes on."""
    if raw.startswith("\\U+", i):
        digits = raw[i + 3 : i + 7]
        if len(digits) == 4 and _is_hex(digits):
            value = int(digits, 16)
            return ("" if 0xD800 <= value <= 0xDFFF else chr(value)), i + 7
        return None
    if raw.startswith("\\M+", i):
        page, digits = raw[i + 3 : i + 4], raw[i + 4 : i + 8]
        if page in _BIGFONT_CODEPAGES and len(digits) == 4 and _is_hex(digits):
            shown = bytes.fromhex(digits).decode(_BIGFONT_CODEPAGES[page], "replace")
            return shown, i + 8
    return None


def _is_hex(text: str) -> bool:
    return text.isascii() and all(c in "0123456789abcdefABCDEF" for c in text)


def _number(text: str) -> float | None:
    try:
        value = float(text)
    except ValueError:
        return None
    return value if value == value and abs(value) < 1e12 else None


def _apply(style: Style, code: str, parameter: str) -> Style:
    """The style after a code with a parameter; a parameter that is not a number changes nothing."""
    if code in "Ff":
        name, *flags = parameter.split("|")
        found = {flag[:1]: flag[1:] for flag in flags if flag}
        return replace(
            style,
            font=name.strip() or None,
            bold=found.get("b", "0") == "1",
            italic=found.get("i", "0") == "1",
        )
    if code == "H":
        relative = parameter.lower().endswith("x")
        value = _number(parameter[:-1] if relative else parameter)
        if value is None or value <= 0:
            return style
        if relative:
            return replace(style, scale=style.scale * value)
        return replace(style, height=value, scale=1.0)
    value = _number(parameter)
    if value is None:
        return style
    if code == "W" and value > 0:
        return replace(style, width=value)
    if code == "Q":
        return replace(style, oblique=value)
    if code == "T" and value > 0:
        return replace(style, tracking=value)
    if code == "C" and value.is_integer() and 0 <= value <= 257:
        return replace(style, colour=int(value))
    if code == "c" and value.is_integer() and 0 <= value <= 0xFFFFFF:
        return replace(style, colour=0x1000000 | int(value))
    return style  # \A and \p: alignment and paragraph, which the renderer does not use


def _stack(parameter: str, style: Style) -> Run:
    kind = next((c for c in parameter if c in "/#^"), None)
    if kind is None:
        whole = _part(parameter)
        return Run(whole, style, (whole, "", "/"))
    upper_raw, lower_raw = parameter.split(kind, 1)
    upper, lower = _part(upper_raw), _part(lower_raw)
    if kind == "^" and not lower and upper and all(c in "0123456789+-=()n" for c in upper):
        plain = upper.translate(_SUPERSCRIPT)
    elif kind == "^" and not upper and lower and all(c in "0123456789+-=()" for c in lower):
        plain = lower.translate(_SUBSCRIPT)
    elif kind == "^":
        plain = " ".join(part for part in (upper, lower) if part)
    else:
        plain = f"{upper}/{lower}"
    return Run(plain, style, (upper, lower, kind))


def _part(raw: str) -> str:
    """One part of a stack, decoded (never stacked again), without its escaped separators."""
    return "".join(run.text for run in _scan(raw.replace("\\;", ";"), True, stacked=True)).strip()
