"""The extractor's named account of a drawing, beside the artifact (L-CAD-04, L-CAD-09).

Two kinds of statement live here, and both are named rather than implied:

* a **note** — something the extractor repaired, or content the drawing carries that no geometry in
  the artifact stands for. A note is never a silent loss: it names the class, says how many, and
  says it in one line whose left half is a code from the closed table below.
* a **refusal** — a drawing this extractor will not write an artifact for. Loud, named, and the only
  way an ingest ends without one (L-CAD-04).

The report travels *beside* the artifact, never inside it. The EntityGraph's top-level key set is
closed and stated twice, once per runtime (`cad/src/vextrus_cad/model.py` and
`src/core/entitygraph/schema.ts`), and a key one mirror does not know is a drift signal rather than
a payload; so the honest channel for an account of the run is the run's own — one named line per
note on stderr, the same lines in the worker protocol's response, and the whole thing as JSON when
`--report` asks for a file.

Both tables are closed. A new class of loss is a new code added here and spelled in the tests
beside it, never an unnamed message that an operator has to read as prose.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Final

#: The tag stream was mis-paired and one resync repaired it; the detail is the sanity number
#: L-CAD-09 asks for — how many lines were dropped to bring the code/value rhythm back.
RESYNCED_TAG_STREAM: Final = "RESYNCED_TAG_STREAM"

#: `ezdxf`'s recover pass repaired structures on the way in; how many, so a silent repair is not one.
AUDIT_REPAIRED: Final = "AUDIT_REPAIRED"

#: The drawing states no unit this extractor can turn into millimetres, so the curve tolerance stood
#: in the drawing's own units instead of the pinned millimetre one (L-CAD-02, L-CAD-05).
CURVE_TOLERANCE_NOT_IN_MM: Final = "CURVE_TOLERANCE_NOT_IN_MM"

#: An external reference whose geometry was bound into this file: the paint is here, but it came
#: from another drawing, and the source keys it mints are this file's rather than that one's.
XREF_BOUND: Final = "XREF_BOUND"

#: An external reference this file only names: its geometry is in a file the extractor was not
#: given, so nothing in the artifact stands for it.
XREF_UNRESOLVED: Final = "XREF_UNRESOLVED"

#: A multileader carries its own rendered paint, which this extractor does not explode (L-CAD-03).
MULTILEADER_NOT_EXPLODED: Final = "MULTILEADER_NOT_EXPLODED"

#: A proxy for an entity written by an application neither this extractor nor AutoCAD can construct.
PROXY_ENTITY: Final = "PROXY_ENTITY"

#: An embedded OLE object — a document in a frame, not geometry.
OLE2FRAME: Final = "OLE2FRAME"

#: A raster image placed by reference; the pixels are in another file and are not geometry.
IMAGE_REFERENCE: Final = "IMAGE_REFERENCE"

#: A mask that hides geometry beneath it. The geometry it hides is still extracted, so what the
#: artifact carries is what the drawing *holds* rather than what a plot of it *shows*.
WIPEOUT: Final = "WIPEOUT"

#: A text style drawn with an AutoCAD shape file. This extractor ships no SHX shapes, so the text
#: crosses the seam raw (L-CAD-01) with no glyph outlines behind it.
SHX_FONT_UNRESOLVED: Final = "SHX_FONT_UNRESOLVED"

#: An entity carrying an embedded object (MTEXT column data is the common one). The embedded tags
#: are not entities, so nothing in the artifact stands for what they say.
EMBEDDED_OBJECT: Final = "EMBEDDED_OBJECT"

#: Every note code, closed and sorted — the table a test reads rather than a list it re-spells.
NOTE_CODES: Final[tuple[str, ...]] = tuple(
    sorted(
        (
            AUDIT_REPAIRED,
            CURVE_TOLERANCE_NOT_IN_MM,
            EMBEDDED_OBJECT,
            IMAGE_REFERENCE,
            MULTILEADER_NOT_EXPLODED,
            OLE2FRAME,
            PROXY_ENTITY,
            RESYNCED_TAG_STREAM,
            SHX_FONT_UNRESOLVED,
            WIPEOUT,
            XREF_BOUND,
            XREF_UNRESOLVED,
        )
    )
)

#: The bytes are not a DXF this extractor can open — not as `ezdxf` recovers them, and not after the
#: one tag-stream resync it is allowed. The detail carries the offending line (L-CAD-04).
DXF_UNREADABLE: Final = "DXF_UNREADABLE"

#: A drawing that opened and could not be read through: malformed geometry, a coordinate outside the
#: finite world, a header field that is not the number it must be.
DXF_UNEXTRACTABLE: Final = "DXF_UNEXTRACTABLE"

#: The file mints one handle twice, so a source key would name two entities (L-CAD-02).
HANDLES_NOT_UNIQUE: Final = "HANDLES_NOT_UNIQUE"

#: The bytes could not be read off the file system at all — an outage, not a drawing's fault.
SOURCE_NOT_READABLE: Final = "SOURCE_NOT_READABLE"

#: Every refusal code, closed and sorted.
REFUSAL_CODES: Final[tuple[str, ...]] = tuple(
    sorted((DXF_UNEXTRACTABLE, DXF_UNREADABLE, HANDLES_NOT_UNIQUE, SOURCE_NOT_READABLE))
)

#: What every note line on stderr begins with, so a reader can find them among whatever else the
#: process said without parsing prose.
NOTE_PREFIX: Final = "vextrus-cad: note: "


@dataclass(frozen=True)
class Note:
    """One named thing the extractor repaired or could not take."""

    code: str
    detail: str
    count: int = 1

    def __post_init__(self) -> None:
        if self.code not in NOTE_CODES:
            raise ValueError(f"{self.code} is not a note this extractor knows")

    def line(self) -> str:
        """The one line this note is said in: `CODE: detail`."""
        return f"{self.code}: {self.detail}"

    def as_dict(self) -> dict[str, object]:
        return {"code": self.code, "count": self.count, "detail": self.detail}


@dataclass
class Report:
    """One ingest's notes, in the order a reader should be given them: by code, then by detail.

    Ordering is sorted rather than chronological because the report is evidence: two runs of one
    drawing say the same thing in the same order, the way the artifact does (L-CAD-02).
    """

    notes: list[Note] = field(default_factory=list)

    def add(self, code: str, detail: str, count: int = 1) -> None:
        self.notes.append(Note(code=code, detail=detail, count=count))

    def sorted_notes(self) -> list[Note]:
        return sorted(self.notes, key=lambda note: (note.code, note.detail))

    def lines(self) -> list[str]:
        return [note.line() for note in self.sorted_notes()]

    def codes(self) -> list[str]:
        return [note.code for note in self.sorted_notes()]

    def as_dict(self) -> dict[str, object]:
        return {"notes": [note.as_dict() for note in self.sorted_notes()]}

    def dumps(self) -> str:
        """The report as one JSON document — the same bytes on every machine."""
        return json.dumps(self.as_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def flatten_tolerance(insunits: int, notes: Report) -> float:
    """The curve tolerance for this drawing, in ITS units, from a tolerance stated in millimetres.

    A drawing whose header states no unit gets the unitless default and a note saying so: the
    tolerance it was flattened at is then a number of drawing units and not an accuracy anybody can
    state in millimetres, which is exactly the kind of thing that must travel rather than be assumed
    (L-MEA-01, L-CAD-02).
    """
    from .parameters import FLATTEN_TOLERANCE, FLATTEN_TOLERANCE_MM
    from .units import mm_per_unit

    per_unit = mm_per_unit(insunits)
    if per_unit is None or per_unit <= 0:
        notes.add(
            CURVE_TOLERANCE_NOT_IN_MM,
            f"$INSUNITS {insunits} states no unit, so curves were flattened at "
            f"{FLATTEN_TOLERANCE} drawing units rather than {FLATTEN_TOLERANCE_MM} mm",
        )
        return FLATTEN_TOLERANCE
    return FLATTEN_TOLERANCE_MM / per_unit


#: What each DXF type a note is kept for is called in the file, and the code it is noted under.
_NOTED_TYPES: Final[dict[str, str]] = {
    "MULTILEADER": MULTILEADER_NOT_EXPLODED,
    "MLEADER": MULTILEADER_NOT_EXPLODED,
    "ACAD_PROXY_ENTITY": PROXY_ENTITY,
    "OLE2FRAME": OLE2FRAME,
    "IMAGE": IMAGE_REFERENCE,
    "WIPEOUT": WIPEOUT,
}


def _handles_in(data: bytes) -> list[str]:
    """Every entity handle the tag stream states, in the order it states them (group code 5).

    Read along the stream's OWN rhythm — a code line, then its value line — rather than by looking
    for lines that say "5": a value that happens to be 5 is not a group code, and a scan that cannot
    tell the two apart reports duplicate handles on a perfectly sound file.
    """
    lines = data.split(b"\n")
    handles: list[str] = []
    for index in range(0, len(lines) - 1, 2):
        if lines[index].strip() == b"5":
            handles.append(lines[index + 1].strip().decode("latin-1"))
    return handles


def duplicate_handles(data: bytes) -> list[str]:
    """The handles this file states more than once, sorted.

    A handle stated twice is two entities one key names: `source_key` would mint one key for both,
    the loader keeps whichever it read last, and everything downstream reads the artifact and
    nothing else. That is not a note — nothing downstream could act on it — so the caller refuses
    the drawing by name (L-CAD-02: one key minted once, L-CAD-04).
    """
    seen: set[str] = set()
    repeated: set[str] = set()
    for handle in _handles_in(data):
        if handle in seen:
            repeated.add(handle)
        seen.add(handle)
    return sorted(repeated)


def survey(doc: Any, notes: Report) -> None:
    """What the drawing carries that no geometry in the artifact stands for (L-CAD-04).

    Nothing here is a refusal: every one of these is a thing the drawing HAS which the extractor
    does not turn into geometry — an external reference, a leader it will not explode, a proxy whose
    producer is not on this machine, a raster, a wipeout, a font it cannot resolve, an embedded
    object. Silence about any of them is the loss the operator never finds out about, so each is
    counted and named. Counting is all: what to do about one is the reader's, not this file's.
    """
    for block in getattr(doc, "blocks", []):
        block_record = getattr(block, "block_record", None)
        if block_record is None:
            continue
        if bool(getattr(block_record.dxf, "flags", 0) & 4) or getattr(block, "is_xref", False):
            resolved = getattr(block_record, "is_xref_loaded", None)
            code = XREF_BOUND if resolved else XREF_UNRESOLVED
            notes.add(code, f"block {getattr(block, 'name', '?')}")

    fonts: set[str] = set()
    for style in getattr(doc, "styles", []):
        font = str(getattr(style.dxf, "font", "") or "")
        if font.lower().endswith(".shx"):
            fonts.add(font)
    if fonts:
        notes.add(SHX_FONT_UNRESOLVED, ", ".join(sorted(fonts)), len(fonts))

    counted: dict[str, int] = {}
    embedded = 0
    for layout in list(getattr(doc, "layouts", []) or []) or []:
        for entity in layout:
            code = _NOTED_TYPES.get(str(entity.dxftype()))
            if code is not None:
                counted[code] = counted.get(code, 0) + 1
            if getattr(entity, "has_embedded_object", False):
                embedded += 1
    for code, count in sorted(counted.items()):
        notes.add(code, f"{count} carried, none turned into geometry", count)
    if embedded:
        notes.add(EMBEDDED_OBJECT, f"{embedded} entity(ies) carry an embedded object", embedded)
