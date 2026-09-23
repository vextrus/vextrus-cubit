"""Source keys: the closed scheme set, and the content digest two of its schemes mint (L-CAD-02).

A source key is `scheme:key`. The scheme is closed and names who minted the key; it rides per key,
never per drawing, because one page may mint two of them (a drafted sheet with a pasted scan). A DXF
key is the file's own handle. A PDF key — and, once the raster lane lands, a trace key — is a content
digest: sha256 over a canonical string of page index, object type and the object's resolved
page-space geometry quantised to 0.001 pt half-even, spelled at fixed precision. Never a counter, a
byte offset or a page label, so the same object on the same page keys the same way however the file
was written; colour, line width, dash, fill and font name take no part.

The canonical strings themselves are the reader's (`pdf.py` spells them); this module owns only the
grammar every lane shares — the schemes, the quantum and the digest — so the three cannot drift
apart (B-17). The Zod mirror (`src/core/entitygraph/schema.ts`) states the same grammar.
"""

from __future__ import annotations

import hashlib
import re
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Final

#: The file's own handle, as ezdxf reads a DXF (or LibreDWG's conversion of a DWG).
DXF_HANDLE: Final = "DXF_HANDLE"

#: A content digest over a PDF page object, as pdfium reads the page (R-TO-002).
PDF_OBJECT: Final = "PDF_OBJECT"

#: A content digest over a traced primitive, as the pinned vectoriser draws it (R-TO-003).
RASTER_TRACE: Final = "RASTER_TRACE"

#: L-CAD-02's closed universe, in the law's order.
SCHEMES: Final[tuple[str, ...]] = (DXF_HANDLE, PDF_OBJECT, RASTER_TRACE)

#: The schemes whose key is a content digest rather than a handle the file states.
DIGEST_SCHEMES: Final = frozenset({PDF_OBJECT, RASTER_TRACE})

#: A source key: a closed scheme, one colon, uppercase hex. `\Z` rather than `$`, so a trailing
#: newline is no more admissible here than to the Zod mirror (L-CAD-05).
SOURCE_KEY: Final = re.compile(rf"^(?:{'|'.join(SCHEMES)}):[0-9A-F]+\Z")

#: A digest key's own half: the whole sha256, never a prefix of it — a truncated digest collides
#: where the drawing does not, and a false collapse is geometry lost.
DIGEST: Final = re.compile(r"^[0-9A-F]{64}\Z")

#: The grid page-space geometry is quantised to before it is digested: 0.001 pt.
QUANTUM: Final = Decimal("0.001")


def scheme_of(key: str) -> str:
    """The scheme half of a well-formed source key."""
    return key.split(":", 1)[0]


def quantum(value: float) -> str:
    """One page-space coordinate as the canonical string spells it: rounded half-even to 0.001 pt,
    at fixed precision, with no negative zero.

    The float is taken exactly (a `Decimal` of a binary double is its exact value), so the rounding
    is the law's and never the formatter's: `0.0005` rounds to `0.000` and `0.0015` to `0.002` only
    where the double really stands at the half.
    """
    rounded = Decimal(value).quantize(QUANTUM, rounding=ROUND_HALF_EVEN)
    return format(rounded.copy_abs() if rounded.is_zero() else rounded, "f")


def point(x: float, y: float) -> str:
    """A page-space point as the canonical string spells it."""
    return f"{quantum(x)},{quantum(y)}"


def digest(canonical: str) -> str:
    """The content digest of one canonical string: sha256, uppercase hex, whole."""
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest().upper()


def content_key(scheme: str, canonical: str) -> str:
    """`scheme:DIGEST` for a digest scheme's object."""
    if scheme not in DIGEST_SCHEMES:
        raise ValueError(f"{scheme} keys are not content digests")
    return f"{scheme}:{digest(canonical)}"
