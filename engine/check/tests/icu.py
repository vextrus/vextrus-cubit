"""A test-only ICU MessageFormat formatter: enough of it to render 19b's catalogues in English and fail
on a message that does not format (an unknown placeholder, a plural or select with no branch for a
value, an unbalanced brace). The web formats them with Lingui; this proves the words hold for every
value the code can pass, from Python, without a browser.

Supported: `{name}`, `{name, number}`, `{name, plural, offset:K =N {…} one {…} other {…}}` with
`#` (the value less the offset), and
`{name, select, key {…} other {…}}`.
"""

import re
from collections.abc import Mapping

_OPTION = re.compile(r"\s*(=\d+|[A-Za-z_][A-Za-z0-9_]*)\s*\{")
_OFFSET = re.compile(r"\s*offset:(\d+)")


class FormatError(ValueError):
    pass


def render(message: str, params: Mapping[str, str | int]) -> str:
    text, end = _body(message, 0, params, None)
    if end != len(message):
        raise FormatError(f"an unmatched brace at {end} in {message!r}")
    return text


def _body(message: str, at: int, params: Mapping[str, str | int], count: int | None) -> tuple[str, int]:
    out: list[str] = []
    while at < len(message):
        char = message[at]
        if char == "}":
            return "".join(out), at
        if char == "{":
            text, at = _argument(message, at + 1, params)
            out.append(text)
            continue
        if char == "#" and count is not None:
            out.append(f"{count:,}")
        else:
            out.append(char)
        at += 1
    return "".join(out), at


def _argument(message: str, at: int, params: Mapping[str, str | int]) -> tuple[str, int]:
    close = message.find("}", at)
    head_end = min(i for i in (close, message.find(",", at)) if i != -1)
    name = message[at:head_end].strip()
    if name not in params:
        raise FormatError(f"{name!r} is not a parameter given ({sorted(params)})")
    value = params[name]
    if message[head_end] == "}":
        return str(value), head_end + 1
    rest = message[head_end + 1 :]
    kind = rest.split(",", 1)[0].split("}", 1)[0].strip()
    at = head_end + 1 + rest.index(kind) + len(kind)
    if kind == "number":
        if not isinstance(value, int):
            raise FormatError(f"{name} is formatted as a number, and is {value!r}")
        end = message.index("}", at)
        return f"{value:,}", end + 1
    if kind not in ("plural", "select"):
        raise FormatError(f"{name}'s format {kind!r} is not supported")
    at = message.index(",", at) + 1
    offset = 0
    shifted = _OFFSET.match(message, at)
    if kind == "plural" and shifted is not None:
        offset, at = int(shifted[1]), shifted.end()
    options: dict[str, tuple[int, int]] = {}
    while True:
        match = _OPTION.match(message, at)
        if match is None:
            break
        start = match.end()
        _, end = _body(message, start, params, 0)
        options[match[1]] = (start, end)
        at = end + 1
    at = message.index("}", at) + 1
    if "other" not in options:
        raise FormatError(f"{name}'s {kind} has no `other` branch")
    if kind == "plural":
        if isinstance(value, bool) or not isinstance(value, int):
            raise FormatError(f"{name} is a plural, and is {value!r}")
        shown = value - offset  # an exact =N matches the value; `#` and one/other the value less offset
        key = (
            f"={value}"
            if f"={value}" in options
            else ("one" if shown == 1 and "one" in options else "other")
        )
        start, end = options[key]
        text, _ = _body(message, start, params, shown)
        return text, at
    key = str(value) if str(value) in options else "other"
    start, end = options[key]
    text, _ = _body(message, start, params, None)
    return text, at


def branches(message: str, name: str) -> set[str]:
    """The option keys of `name`'s select or plural in the message."""
    found: set[str] = set()
    for match in re.finditer(r"\{\s*" + re.escape(name) + r"\s*,\s*(?:select|plural)\s*,", message):
        at = match.end()
        if (shifted := _OFFSET.match(message, at)) is not None:
            at = shifted.end()
        while (option := _OPTION.match(message, at)) is not None:
            found.add(option[1])
            depth, at = 1, option.end()
            while depth:
                depth += {"{": 1, "}": -1}.get(message[at], 0)
                at += 1
    return found


def arguments(message: str) -> set[str]:
    """Every argument the message names, in every branch."""
    found: set[str] = set()
    _walk(message, 0, found)
    return found


def _walk(message: str, at: int, found: set[str]) -> int:
    """Walk a body from `at` to its closing brace (or the end), collecting argument names."""
    while at < len(message):
        if message[at] == "}":
            return at
        if message[at] != "{":
            at += 1
            continue
        close, comma = message.find("}", at), message.find(",", at)
        head_end = close if comma == -1 or close < comma else comma
        found.add(message[at + 1 : head_end].strip())
        if message[head_end] == "}":
            at = head_end + 1
            continue
        rest = message[head_end + 1 :]
        kind = rest.split(",", 1)[0].split("}", 1)[0].strip()
        at = head_end + 1 + rest.index(kind) + len(kind)
        if kind in ("plural", "select"):
            at = message.index(",", at) + 1
            if (shifted := _OFFSET.match(message, at)) is not None:
                at = shifted.end()
            while (option := _OPTION.match(message, at)) is not None:
                at = _walk(message, option.end(), found) + 1
        at = message.index("}", at) + 1
    return at
