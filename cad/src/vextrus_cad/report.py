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

#: The converter wrapped string values across raw line breaks, or spelled an MTEXT's chunks with
#: their codes rotated, and the conversion healed the file before any reader saw it; the detail is
#: how many lines were joined back and how many chunk runs were re-coded (L-CAD-09).
REJOINED_WRAPPED_TEXT: Final = "REJOINED_WRAPPED_TEXT"

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

#: The DWG lane's two passes disagreed about one class on one sheet: the conversion carried fewer of
#: it than the census counted (`dwg/reconcile.py`'s SHORTFALL), so the artifact stands for that class
#: short by the difference. The class is refused on that sheet and the drawing is not: what was
#: carried is still geometry, and a loss named per space and per class is what an operator can act
#: on (L-CAD-04 — never a silent loss).
CONVERSION_SHORTFALL: Final = "CONVERSION_SHORTFALL"

#: The census itself could not name a class the drawing holds (`dwg/reconcile.py`'s UNKNOWN_ENT), so
#: nothing downstream can say what the conversion did or did not carry across for it.
CONVERSION_UNKNOWN_ENT: Final = "CONVERSION_UNKNOWN_ENT"

#: The reader said something on the way in — a handle it found twice, a structure it distrusted.
#: Its words belong to this process rather than to the caller's streams (`dwg/quiet.py`), so they
#: are held for the duration of the open and counted here instead of leaking beside the answer.
READER_WARNED: Final = "READER_WARNED"

#: A text states an alignment it cannot have: a single-line text's group 72 outside 0-5 or its
#: vertical alignment (TEXT group 73, attribute group 74) outside 0-3, an MTEXT group 71 outside 1-9,
#: or an alignment point that is not finite. v3 restates the alignment (I-415) and applies none
#: of it, so the drawing is not refused over it: the code is read as the value ezdxf's own attribute
#: validator restores (left, baseline, top left) and the point as the insert (ezdxf's reading of an
#: unstated one), and the detail says which tag, how it was read, and how many times.
TEXT_ALIGNMENT_UNREADABLE: Final = "TEXT_ALIGNMENT_UNREADABLE"

#: A text's stated direction names none on the drawing plane: a non-finite group 50 or
#: text_direction, a zero-length direction, or a baseline standing edge-on to the plane. Read as 0
#: (DXF's default angle), named with how many.
TEXT_ROTATION_UNREADABLE: Final = "TEXT_ROTATION_UNREADABLE"

#: A text's extrusion is not a finite direction, so its own coordinate frame is no frame: the text
#: is read in the world's (DXF's default extrusion, +Z), which is where v2 read every text.
TEXT_EXTRUSION_UNREADABLE: Final = "TEXT_EXTRUSION_UNREADABLE"

#: A block definition holds a record the extractor cannot read (a non-finite coordinate, a curve
#: that will not flatten, a nested reference placed nowhere), so no content digest can be stated
#: for it or for any block that nests it (I-416). Its paint is the explode's business, which
#: refuses the drawing where it reaches the record; a definition the explode never reaches — past
#: the depth cap — costs the drawing nothing but its digest, and the detail names which and why.
BLOCK_DEFINITION_UNREADABLE: Final = "BLOCK_DEFINITION_UNREADABLE"

#: Every note code, closed and sorted — the table a test reads rather than a list it re-spells.
NOTE_CODES: Final[tuple[str, ...]] = tuple(
    sorted(
        (
            AUDIT_REPAIRED,
            BLOCK_DEFINITION_UNREADABLE,
            CONVERSION_SHORTFALL,
            CONVERSION_UNKNOWN_ENT,
            CURVE_TOLERANCE_NOT_IN_MM,
            EMBEDDED_OBJECT,
            IMAGE_REFERENCE,
            MULTILEADER_NOT_EXPLODED,
            OLE2FRAME,
            PROXY_ENTITY,
            READER_WARNED,
            REJOINED_WRAPPED_TEXT,
            RESYNCED_TAG_STREAM,
            SHX_FONT_UNRESOLVED,
            TEXT_ALIGNMENT_UNREADABLE,
            TEXT_EXTRUSION_UNREADABLE,
            TEXT_ROTATION_UNREADABLE,
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

#: Structural records that are not drawing content and never mint entity keys (L-CAD-03). `BLOCK`
#: and `ENDBLK` stand here for the reason `dwg/vocabulary.py` keeps them out of both tallies: they
#: delimit a block definition rather than drawing anything.
_NOT_CONTENT_BYTES: Final = frozenset(
    {b"ATTRIB", b"ATTDEF", b"SEQEND", b"VERTEX", b"VIEWPORT", b"BLOCK", b"ENDBLK"}
)

#: The sections a drawing's own content stands in. Model space and the active paper layout are
#: written to ENTITIES; every OTHER layout's entities stand in BLOCKS under that layout's space
#: block record (`cad/tests/fixtures/layouts.dxf` keeps SHEET A1's two entities there), and a block
#: definition's paint stands in BLOCKS beside them. Everything in TABLES, CLASSES and OBJECTS is
#: structure rather than drawing content: no source key is ever minted for it.
_CONTENT_SECTIONS: Final = frozenset({b"ENTITIES", b"BLOCKS"})


def _stated_handles(data: bytes) -> list[tuple[str, bool]]:
    """Every handle the tag stream states, in order, each flagged for whether the record that
    states it is drawing content.

    Read along the stream's OWN rhythm — a code line, then its value line — rather than by looking
    for lines that say "5": a value that happens to be 5 is not a group code, and a scan that cannot
    tell the two apart reports duplicate handles on a perfectly sound file.

    Only the FIRST group 5 of a record is that record's handle. An XRECORD's data can quote somebody
    else's handle further in under the same code, and a scan that reads those as handles of their own
    invents collisions — which, where the rule below is a refusal, would lose a sound drawing.
    """
    lines = data.split(b"\n")
    stated: list[tuple[str, bool]] = []
    section: bytes | None = None
    current_type: bytes | None = None
    has_sections = b"SECTION" in data
    taken = True
    for index in range(0, len(lines) - 1, 2):
        code = lines[index].strip()
        val = lines[index + 1].strip()
        if code == b"0" and val == b"SECTION":
            named = index + 3 < len(lines) and lines[index + 2].strip() == b"2"
            section = lines[index + 3].strip() if named else None
            current_type = None
        elif code == b"0" and val == b"ENDSEC":
            section = None
            current_type = None
        elif code == b"0":
            current_type = val
            taken = False
        elif code == b"5" and current_type is not None and not taken:
            taken = True
            in_content = section in _CONTENT_SECTIONS or (section is None and not has_sections)
            stated.append((val.decode("latin-1"), in_content and current_type not in _NOT_CONTENT_BYTES))
    return stated


def duplicate_handles(data: bytes) -> list[str]:
    """The handles this file states more than once where drawing content takes part, sorted.

    A DXF handle names one record in the whole file, and a reader binds every section into one
    handle-keyed database: where two records state one handle, `ezdxf` keeps the one it read last
    and the earlier record is dropped from the layout or block that held it. So a handle a drawing
    entity shares with anything — another entity, or an XRECORD in OBJECTS a converter minted over
    it — costs the artifact that entity, and the artifact then stands for less than the drawing
    holds with nothing naming the loss. Where both records are layout content it costs more still:
    one source key would have named two originals (L-CAD-02, L-CAD-03). Neither is a note — nothing
    downstream could act on either — so the caller refuses the drawing by name (L-CAD-04).

    A repeat between records that are NOT drawing content is left alone, and deliberately: LibreDWG
    writes a converted drawing's TABLES with a hundred repeated `BLOCK_RECORD`, `LTYPE` and `LAYER`
    handles (the committed F-RCC6 corpus's own conversion states 102), no entity is dropped for it,
    and refusing those drawings would refuse the corpora this product is built on.
    """
    seen: dict[str, bool] = {}
    repeated: set[str] = set()
    for handle, content in _stated_handles(data):
        if handle in seen and (content or seen[handle]):
            repeated.add(handle)
        seen[handle] = seen.get(handle, False) or content
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
