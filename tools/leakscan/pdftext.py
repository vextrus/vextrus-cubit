"""The text a PDF content stream draws, reassembled from its show operators (contract section 2).

A producer may draw a string one glyph per `Tj`, as a kerned `TJ` array, as a hex string, one glyph per
`BT ... ET`, or with octal escapes: none holds the text as one run of bytes. `assemble` reads the
stream's tokens in one iterative pass (no recursion, no regex over the whole stream) and returns the text
it shows twice: tight (nothing between shown strings) and spaced (a space wherever the text moves on).
The work is linear in the stream's size; an unclosed string or array runs to the stream's end, scanned.
"""

import re

_WHITE = b"\x00\t\n\x0c\r "
_DELIMITERS = b"()<>[]{}/%"
_SKIP = re.compile(rb"[\x00\t\n\x0c\r ]+|%[^\r\n]*")
_REGULAR = re.compile(rb"[^\x00\t\n\x0c\r ()<>\[\]{}/%]+")
_HEX = re.compile(rb"<([^>]*)>?")
_HEX_DIGITS = re.compile(rb"[^0-9A-Fa-f]+")
_LITERAL_STOP = re.compile(rb"[()\\]")
_OCTAL = re.compile(rb"[0-7]{1,3}")
_NUMBER = re.compile(rb"[+-]?(?:\d+\.?\d*|\.\d+)")
_INLINE_IMAGE_END = re.compile(rb"[\x00\t\n\x0c\r ]EI(?=[\x00\t\n\x0c\r ]|$)")
_ESCAPES = {
    ord("n"): b"\n",
    ord("r"): b"\r",
    ord("t"): b"\t",
    ord("b"): b"\b",
    ord("f"): b"\x0c",
}
_SHOW = {b"Tj", b"TJ", b"'", b'"'}
_MOVE = {b"Td", b"TD", b"Tm", b"T*", b"'", b'"', b"BT", b"ET"}
WORD_GAP = -200  # a TJ number this far or further moves the next glyph a word's width


def decode(raw: bytes) -> str:
    """A string's bytes as text: latin-1, or UTF-16BE when its bytes alternate NUL and printable."""
    body = raw[2:] if raw.startswith(b"\xfe\xff") else raw
    if body and len(body) % 2 == 0 and not body[0::2].strip(b"\0"):
        wide = body[1::2]
        if all(0x20 <= byte <= 0x7E for byte in wide):
            return wide.decode("ascii")
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


class _Text:
    """The two texts being assembled, and the strings an operand list or array holds."""

    def __init__(self) -> None:
        self.tight: list[str] = []
        self.spaced: list[str] = []

    def show(self, text: str) -> None:
        self.tight.append(text)
        self.spaced.append(text)

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
            elif isinstance(item, float) and item <= WORD_GAP:
                self.gap()

    def aside(self, operands: list[object]) -> None:
        """Strings no show operator draws (a malformed stream, a marked-content dictionary): read in the
        spaced text only, each set apart, so a literal hidden there is still found."""
        for operand in operands:
            if isinstance(operand, str | list):
                self.gap()
                self.shown(operand)
                self.gap()


def assemble(stream: bytes) -> list[str]:
    """The text a content stream shows, as `[tight, spaced]` (see the module's docstring)."""
    text = _Text()
    operands: list[object] = []
    arrays: list[list[object]] = []  # the open arrays, innermost last
    position = 0
    end = len(stream)

    def push(item: object) -> None:
        (arrays[-1] if arrays else operands).append(item)

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
            arrays.append([])
            position += 1
        elif char == 0x5D:  # ]
            if arrays:
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
                push(float(word))
                continue
            if word in (b"true", b"false", b"null"):
                push(None)
                continue
            while arrays:  # an operator inside an array: the array ends here
                closed = arrays.pop()
                push(closed)
            if word in _MOVE:
                text.gap()
            if word in _SHOW and operands:
                text.aside(operands[:-1])
                text.shown(operands[-1])
            else:
                text.aside(operands)
            operands = []
            if word == b"ID":  # inline image data: skipped to its `EI`
                image_end = _INLINE_IMAGE_END.search(stream, position)
                position = image_end.end() if image_end else end
    while arrays:
        closed = arrays.pop()
        push(closed)
    for operand in operands:  # a stream that ends before its operator: its strings are still shown
        text.shown(operand)
    return ["".join(text.tight), "".join(text.spaced)]
