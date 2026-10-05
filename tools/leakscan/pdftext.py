"""The text a PDF content stream draws, reassembled from its show operators (contract section 2).

A producer may draw a string one glyph per `Tj`, as a kerned `TJ` array, as a hex string, one glyph per
`BT ... ET`, or with octal escapes: none holds the text as one run of bytes. `assemble` reads the
stream's tokens in one iterative pass (no recursion, no regex that backtracks) and returns the text it
shows three times: tight (nothing between shown strings), spaced (a space wherever the text moves on)
and measured (a space where a glyph lands further on than the stream's typical glyph advance, for
glyphs placed one by one with no space glyph drawn). The work and memory are linear in the stream's
size; an unclosed string or array runs to the stream's end, scanned.
"""

import re
import statistics
from array import array

_WHITE = b"\x00\t\n\x0c\r "
_DELIMITERS = b"()<>[]{}/%"
_SKIP = re.compile(rb"[\x00\t\n\x0c\r ]+|%[^\r\n]*")
_REGULAR = re.compile(rb"[^\x00\t\n\x0c\r ()<>\[\]{}/%]+")
_HEX = re.compile(rb"<([^>]*)>?")
_HEX_DIGITS = re.compile(rb"[^0-9A-Fa-f]+")
_LITERAL_STOP = re.compile(rb"[()\\]")
_OCTAL = re.compile(rb"[0-7]{1,3}")
_NUMBER = re.compile(rb"[+-]?[0-9.]+")  # one quantifier: linear on a long run of digits
_INLINE_IMAGE_END = re.compile(rb"(?:[\x00\t\n\x0c\r >])EI(?=[\x00\t\n\x0c\r ]|$)")
_ESCAPES = {
    ord("n"): b"\n",
    ord("r"): b"\r",
    ord("t"): b"\t",
    ord("b"): b"\b",
    ord("f"): b"\x0c",
}
_SHOW = {b"Tj", b"TJ", b"'", b'"'}
_MOVE = {b"Td", b"TD", b"Tm", b"T*", b"'", b'"', b"BT", b"ET"}
WORD_GAP = -200  # a TJ number this far or further moves the next glyph a word's width (spaced)
NARROW_GAP = -100  # the same for the measured text: a narrow font's word space
MAX_DEPTH = 64  # array nesting kept; deeper brackets are counted, their strings kept in the innermost
MAX_OPERANDS = 4096  # operands held before an operator; beyond, the oldest are shown (never dropped)


def decode(raw: bytes) -> str:
    """A string's bytes as text: UTF-16BE when it starts with its byte-order mark or most of its high
    bytes are NUL (any character outside ASCII replaced, never the whole string lost); else latin-1."""
    if len(raw) >= 2 and len(raw) % 2 == 0:
        if raw.startswith(b"\xfe\xff"):
            return raw[2:].decode("utf-16-be", "replace")
        if raw[0::2].count(0) * 4 >= len(raw) // 2 * 3:
            return raw.decode("utf-16-be", "replace")
    return raw.decode("latin-1")


def _literal(data: bytes, start: int) -> tuple[bytes, int]:
    """The literal string opening at `data[start]` and the position after it (or the stream's end):
    nesting by a counter, the escapes, up to three octal digits and backslash-newline continuation."""
    out = bytearray()
    depth = 1
    position = start + 1
    end = len(data)
    while position < end:
        stop = _LITERAL_STOP.search(data, position)
        if stop is None:
            out += data[position:]
            return bytes(out), end
        out += data[position : stop.start()]
        char = data[stop.start()]
        position = stop.start() + 1
        if char == 0x5C:  # backslash
            if position >= end:
                break
            following = data[position]
            octal = _OCTAL.match(data, position)
            if octal:
                out.append(int(octal[0], 8) & 0xFF)
                position = octal.end()
            elif following in _ESCAPES:
                out += _ESCAPES[following]
                position += 1
            elif following == 0x0D:  # backslash-newline: CR or CR LF, nothing kept
                position += 2 if data[position + 1 : position + 2] == b"\n" else 1
            elif following == 0x0A:
                position += 1
            else:  # `\(`, `\)`, `\\`, and an unknown escape: the character itself
                out.append(following)
                position += 1
        elif char == 0x28:  # (
            depth += 1
            out.append(char)
        else:  # )
            depth -= 1
            if depth == 0:
                return bytes(out), position
            out.append(char)
    return bytes(out), end


def _hex(digits: bytes) -> bytes:
    """A hex string's bytes: anything not a hex digit skipped, an odd last digit padded with 0."""
    clean = _HEX_DIGITS.sub(b"", digits)
    if len(clean) % 2:
        clean += b"0"
    return bytes.fromhex(clean.decode("ascii"))


def _number(word: bytes) -> float:
    try:
        return float(word)
    except ValueError:  # `1.2.3`, `.`: a malformed number is still a number, not an operator
        return 0.0


class _Text:
    """The texts being assembled, and where each shown string was placed (for the measured text)."""

    def __init__(self) -> None:
        self.tight: list[str] = []
        self.spaced: list[str] = []
        self.xs = array("d")
        self.ys = array("d")
        self.breaks = bytearray()  # 1 where the measured text takes a space before the string
        self.x = self.y = 0.0  # the start of the current text line, in user space
        self.scale = 1.0
        self.pending = False

    def show(self, text: str) -> None:
        self.tight.append(text)
        self.spaced.append(text)
        self.xs.append(self.x)
        self.ys.append(self.y)
        self.breaks.append(1 if self.pending else 0)
        self.pending = False

    def gap(self) -> None:
        self.spaced.append(" ")

    def shown(self, operand: object) -> None:
        """Every string an operand holds, in order (array numbers are kerning), without recursion."""
        pending: list[object] = [operand]
        while pending:
            item = pending.pop()
            if isinstance(item, str):
                self.show(item)
            elif isinstance(item, list):
                pending.extend(reversed(item))
            elif isinstance(item, float):
                if item <= WORD_GAP:
                    self.gap()
                if item <= NARROW_GAP:
                    self.pending = True

    def aside(self, operands: list[object]) -> None:
        """Strings no show operator draws (a malformed stream, a marked-content dictionary): read as
        shown, set apart in the spaced text, so a literal hidden there is still found."""
        for operand in operands:
            if isinstance(operand, str | list):
                self.gap()
                self.shown(operand)
                self.gap()

    def move(self, word: bytes, numbers: list[float]) -> None:
        """Where a text-positioning operator puts the next line (its operands, numbers only)."""
        self.gap()
        if word == b"BT":
            self.x = self.y = 0.0
            self.scale = 1.0
        elif word == b"Tm" and len(numbers) >= 6:
            a, _, _, _, self.x, self.y = numbers[-6:]
            self.scale = abs(a) or 1.0
        elif word in (b"Td", b"TD") and len(numbers) >= 2:
            self.x += numbers[-2] * self.scale
            self.y += numbers[-1] * self.scale
        elif word in (b"T*", b"'", b'"'):
            self.y -= self.scale  # a new line: any change of line is a break
        self.pending = self.pending or word in (b"T*", b"'", b'"')

    def measured(self) -> str:
        """The shown strings, a space wherever the next lands on another line, back, or further on than
        its predecessor's length in typical glyph advances (the median over the stream) and a half."""
        count = len(self.tight)
        advances = array("d")
        for i in range(1, count):
            step = self.xs[i] - self.xs[i - 1]
            if self.ys[i] == self.ys[i - 1] and step > 0 and self.tight[i - 1]:
                advances.append(step / len(self.tight[i - 1]))
        typical = statistics.median(advances) if advances else 0.0
        out: list[str] = []
        for i in range(count):
            if i and (
                self.breaks[i]
                or self.ys[i] != self.ys[i - 1]
                or self.xs[i] < self.xs[i - 1]
                or (typical and self.xs[i] - self.xs[i - 1] > typical * (len(self.tight[i - 1]) + 0.5))
            ):
                out.append(" ")
            out.append(self.tight[i])
        return "".join(out)


def assemble(stream: bytes) -> list[str]:
    """The text a content stream shows, as `[tight, spaced, measured]` (see the module's docstring)."""
    text = _Text()
    operands: list[object] = []
    arrays: list[list[object]] = []  # the open arrays, innermost last
    deeper = 0  # brackets opened past MAX_DEPTH
    position = 0
    end = len(stream)

    def push(item: object) -> None:
        nonlocal operands
        if arrays:
            arrays[-1].append(item)
            return
        operands.append(item)
        if len(operands) > MAX_OPERANDS:
            for operand in operands[: MAX_OPERANDS // 2]:
                text.shown(operand)
            operands = operands[MAX_OPERANDS // 2 :]

    def close_all() -> None:
        nonlocal deeper
        deeper = 0
        while arrays:
            closed = arrays.pop()
            push(closed)

    while position < end:
        char = stream[position]
        if char in _WHITE or char == 0x25:  # whitespace or a comment
            skipped = _SKIP.match(stream, position)
            position = skipped.end() if skipped else position + 1
        elif char == 0x28:  # (
            raw, position = _literal(stream, position)
            push(decode(raw))
        elif char == 0x3C:  # <
            if stream[position + 1 : position + 2] == b"<":
                position += 2
                continue
            digits = _HEX.match(stream, position)
            assert digits is not None  # `<` alone matches
            push(decode(_hex(digits[1])))
            position = digits.end()
        elif char == 0x5B:  # [
            if len(arrays) < MAX_DEPTH:
                arrays.append([])
            else:
                deeper += 1
            position += 1
        elif char == 0x5D:  # ]
            if deeper:
                deeper -= 1
            elif arrays:
                closed = arrays.pop()
                push(closed)
            position += 1
        elif char == 0x2F:  # a name: read and dropped
            name = _REGULAR.match(stream, position + 1)
            position = name.end() if name else position + 1
        elif char in _DELIMITERS:  # `>`, `{`, `}`, a stray `)`
            position += 1
        else:
            token = _REGULAR.match(stream, position)
            assert token is not None  # a regular byte matches
            position = token.end()
            word = token[0]
            if _NUMBER.fullmatch(word):
                push(_number(word))
                continue
            if word in (b"true", b"false", b"null"):
                push(None)
                continue
            close_all()  # an operator inside an array: the array ends here
            if word in _MOVE:
                text.move(word, [item for item in operands if isinstance(item, float)])
            if word in _SHOW and operands:
                text.aside(operands[:-1])
                text.shown(operands[-1])
            else:
                text.aside(operands)
            operands = []
            if word == b"ID":  # inline image data: skipped to its `EI` (none: read on as tokens)
                image_end = _INLINE_IMAGE_END.search(stream, position)
                if image_end:
                    position = image_end.end()
    close_all()
    for operand in operands:  # a stream that ends before its operator: its strings are still shown
        text.shown(operand)
    return ["".join(text.tight), "".join(text.spaced), text.measured()]
