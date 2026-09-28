"""Every text drawings keeps passes through here (ticket 14; review round 1): PostgreSQL holds no NUL
in text or jsonb and no NaN in jsonb, UTF-8 no lone surrogate, and each column its length, so none of
these ever reaches a write as a bare error, whoever the caller.

- **Text a reading supplied** (a drawing's own: a sheet's number, title, revision mark, date and
  storeys; a layout's name; a view's title, scale, subject and layer; a finding's or a report's
  words): its tabs and line breaks become one space, its other C0 controls and DEL go, and a lone
  surrogate (a byte the reader could not decode) becomes U+FFFD (`read`; `read_json` for a jsonb
  value, where a NaN or an infinity also becomes null). A value still longer than its column
  refuses its item alone (`fits`): that sheet or view is not kept, and the file's report counts it.
- **Text a person typed** (an exclusion's words) is never cleaned behind their back: holding a
  control other than a tab or a line break, or a lone surrogate, it is refused in words (`typed`).
"""

import math
import re
from collections.abc import Mapping
from typing import Any

_BREAKS = re.compile("[\t\n\r]+")
_CONTROLS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SURROGATES = re.compile("[\ud800-\udfff]")
_NOT_TYPED = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ud800-\udfff]")


def read(value: object) -> str:
    """A reading's text as it may be kept (none: the empty text)."""
    if value is None:
        return ""
    text = _BREAKS.sub(" ", str(value))
    text = _CONTROLS.sub("", text)
    return _SURROGATES.sub("\ufffd", text)


def read_json(value: Any) -> Any:
    """A reading's jsonb value as it may be kept: each text as `read` keeps it; a NaN, null."""
    if isinstance(value, str):
        return read(value)
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, Mapping):
        return {read(key): read_json(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [read_json(item) for item in value]
    return value


def fits(*pairs: tuple[str, int]) -> bool:
    """Whether each text fits its column's length."""
    return all(len(text) <= length for text, length in pairs)


def typed(value: str) -> bool:
    """Whether a person's words may be kept as typed."""
    return not _NOT_TYPED.search(value)
