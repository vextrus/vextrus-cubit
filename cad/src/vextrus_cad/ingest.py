"""DXF → EntityGraph v2, in one shot (L-CAD-01 … L-CAD-05).

The extractor reads original entities only. INSERTs explode to world coordinates for rendering,
under a depth cap and a derived-entity budget whose trips are counted; that paint is kept apart in
`derived`, each piece naming the instance that painted it. Block attributes collect separately.
Nothing here reads meaning: no schedule, no view law, no notation — those are TypeScript stages
over the artifact this writes.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

import ezdxf
import ezdxf.recover

from . import colours, geometry, report, units
from .parameters import DERIVED_ENTITY_BUDGET, EXPLODE_DEPTH_CAP, parameter_set_hash
from .resync import resync_tag_stream

#: The version floor this extractor writes and both mirrors demand (L-CAD-05).
ENTITYGRAPH_VERSION: Final = 2

#: The source-key scheme ezdxf mints, and the tool identity that scopes those keys (L-CAD-02).
SCHEME: Final = "DXF_HANDLE"
TOOL: Final = "ezdxf"

#: ezdxf's name for the model layout; the artifact's marker for it is the lowercase word.
_MODEL_LAYOUT: Final = "Model"
MODEL_SPACE: Final = "model"

#: Structural records that are not drawing content: attributes collect separately (L-CAD-03),
#: vertices and sequence ends belong to their owner, and a viewport frames paint rather than being
#: paint. None of them is an atom a source key names.
_NOT_CONTENT: Final = frozenset({"ATTRIB", "ATTDEF", "SEQEND", "VERTEX", "VIEWPORT"})

#: Originals that carry paint of their own (L-CAD-03): a block reference paints its block, and a
#: dimension paints its rendered geometry — its measurement text among it. Both stay originals and
#: the paint they carry becomes derived entities naming them.
_PAINTS_DERIVED: Final = frozenset({"INSERT", "DIMENSION"})

#: The DXF names for "where this entity sits", in the order they are asked for. A type answers to
#: at most one of them, and asking for the other raises rather than returning nothing.
_ANCHOR_ATTRIBUTES: Final = ("insert", "location")

#: How near a full turn an elliptical parameter range must come to count as closed.
_FULL_TURN_EPSILON: Final = 1e-9


class IngestError(Exception):
    """A drawing this extractor refuses: loud failure, nothing written (L-CAD-04).

    Every refusal carries a code from the closed table in `report.py` and says it first, because the
    operator two processes away reads a string: `DXF_UNREADABLE` tells them their export is the
    problem, `SOURCE_NOT_READABLE` tells them it is ours, and a bare traceback tells them neither.
    """

    def __init__(self, code: str, message: str) -> None:
        if code not in report.REFUSAL_CODES:
            raise ValueError(f"{code} is not a refusal this extractor knows")
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass
class _Counters:
    """One space's fidelity counters (R-TO-001)."""

    explode_truncated: bool = False
    explode_losses: dict[str, int] = field(default_factory=dict)
    flatten_capped: dict[str, int] = field(default_factory=dict)

    def lose(self, dxftype: str) -> None:
        self.explode_truncated = True
        self.explode_losses[dxftype] = self.explode_losses.get(dxftype, 0) + 1

    def cap(self, dxftype: str) -> None:
        self.flatten_capped[dxftype] = self.flatten_capped.get(dxftype, 0) + 1

    def record(self, space: str) -> dict[str, Any]:
        return {
            "space": space,
            "explode_truncated": self.explode_truncated,
            "explode_losses": dict(sorted(self.explode_losses.items())),
            "flatten_capped": dict(sorted(self.flatten_capped.items())),
        }


@dataclass
class _Space:
    """Everything one layout contributes to the artifact."""

    name: str
    kind: str
    entities: list[dict[str, Any]] = field(default_factory=list)
    derived: list[dict[str, Any]] = field(default_factory=list)
    attributes: list[dict[str, Any]] = field(default_factory=list)
    boxes: list[tuple[float, float, float, float]] = field(default_factory=list)
    counters: _Counters = field(default_factory=_Counters)

    def is_content_less(self) -> bool:
        return not self.entities and not self.derived


def source_key(handle: str) -> str:
    """`scheme:key` for a DXF entity — the file's own handle, uppercased (L-CAD-02)."""
    return f"{SCHEME}:{handle.upper()}"


def _closed_flag(entity: Any, dxftype: str) -> bool | None:
    """Whether this entity's geometry closes, or None when its type has no such notion."""
    if dxftype == "LWPOLYLINE":
        return bool(entity.closed)
    if dxftype == "POLYLINE":
        return bool(entity.is_closed)
    if dxftype == "SPLINE":
        return bool(entity.closed)
    if dxftype == "CIRCLE":
        return True
    if dxftype == "ELLIPSE":
        # An ellipse carries no closed flag of its own: it closes when its parameter range spans a
        # whole turn, and an elliptical arc does not.
        span = abs(float(entity.dxf.end_param) - float(entity.dxf.start_param))
        return span >= math.tau - _FULL_TURN_EPSILON
    return None


def _text_of(entity: Any, dxftype: str) -> tuple[str, float] | None:
    """An entity's raw text and its world height, or None when it carries no text.

    Text crosses the seam raw (L-CAD-01): the AutoCAD escapes are the app's parsers' business.
    """
    if dxftype == "MTEXT":
        return (str(entity.text), geometry.quantise(float(entity.dxf.char_height)))
    if dxftype in {"TEXT", "ATTRIB", "ATTDEF"}:
        return (str(entity.dxf.text), geometry.quantise(float(entity.dxf.height)))
    return None


def _anchor(entity: Any) -> tuple[float, float] | None:
    """An entity's own location, for spaces whose extents nothing else would place it in."""
    for name in _ANCHOR_ATTRIBUTES:
        try:
            anchor = entity.dxf.get(name, None)
        except ezdxf.DXFAttributeError:
            # The name is not part of this type's namespace at all, which is not the same as unset.
            continue
        if anchor is not None:
            return (geometry.quantise(anchor.x), geometry.quantise(anchor.y))
    return None


class _Extractor:
    """One invocation's state: stateless between runs, budgeted within one (L-CAD-03, L-CAD-04)."""

    def __init__(self, doc: Any, notes: report.Report | None = None) -> None:
        notes = report.Report() if notes is None else notes
        self._doc = doc
        self._layers = colours.LayerColours.of(doc)
        #: How finely a curve of THIS drawing is described, in this drawing's units — derived from
        #: `$INSUNITS` so the accuracy is the same length on every file (L-MEA-01).
        self._tolerance = report.flatten_tolerance(int(doc.header.get("$INSUNITS", 0)), notes)
        #: How much of the pinned derived-entity budget this invocation has spent walking (L-CAD-03).
        self._expanded = 0

    def entity_record(
        self,
        entity: Any,
        space: _Space,
        inherited: colours.Channels | None,
    ) -> dict[str, Any] | None:
        dxftype = entity.dxftype()
        if dxftype in _NOT_CONTENT:
            return None

        record: dict[str, Any] = {
            "type": dxftype,
            "space": space.name,
            "layer": str(entity.dxf.layer),
            "colour": colours.resolve(entity, self._layers, inherited),
        }

        closed = _closed_flag(entity, dxftype)
        flattened = geometry.flatten(entity, self._tolerance)
        points: list[geometry.Point] | None = None
        if flattened is not None:
            points, capped = flattened
            if capped:
                space.counters.cap(dxftype)
            if closed:
                # A coarsened flattening still comes back round to its start, so the closing vertex
                # is dropped there too — the artifact spells each vertex once whichever it is.
                points = geometry.drop_closing_vertex(points)
            record["points"] = [[x, y] for x, y in points]
        elif dxftype == "POINT":
            anchor = _anchor(entity)
            if anchor is not None:
                points = [anchor]
                record["points"] = [[anchor[0], anchor[1]]]

        if closed is not None:
            record["closed"] = closed
            if closed and points is not None and len(points) >= 3:
                record["area"] = geometry.shoelace_area(points)

        text = _text_of(entity, dxftype)
        if text is not None:
            record["text"], record["height"] = text
            if points is None:
                # A text has no path for ezdxf to build, so nothing above places it — and a text
                # nothing places is a text no stage over the artifact can read as standing anywhere.
                # L-CAD-06 partitions model space by the captions drawn in it, which means a caption
                # has to say where it stands; so a text-bearing original carries its own insertion
                # point, the same anchor the space's extents are already taken from below.
                anchor = _anchor(entity)
                if anchor is not None:
                    points = [anchor]
                    record["points"] = [[anchor[0], anchor[1]]]

        box = geometry.bounds(points) if points else None
        if box is None:
            anchor = _anchor(entity) if dxftype not in _PAINTS_DERIVED else None
            if anchor is not None:
                box = (anchor[0], anchor[1], anchor[0], anchor[1])
        if box is not None:
            space.boxes.append(box)
        return record

    def collect_attributes(self, insert: Any, key: str, space: _Space) -> None:
        for attrib in getattr(insert, "attribs", ()):
            text = _text_of(attrib, attrib.dxftype())
            if text is None:
                continue
            space.attributes.append(
                {"src": key, "tag": str(attrib.dxf.tag), "text": text[0], "height": text[1]}
            )

    def explode(
        self,
        instance: Any,
        key: str,
        space: _Space,
        inherited: colours.Channels,
        depth: int,
    ) -> None:
        """Explode one painting original to world coordinates, for rendering only (L-CAD-03).

        The budget bounds the walk, not merely the mint. A block tree that branches even modestly is
        an exponential number of instances below the depth cap, and an instance whose paint is
        refused still costs the expansion that discovered it, so charging only minted entities would
        leave a few kilobytes of lawful drawing able to spend a quarter of an hour of one shot
        (L-CAD-04's generous timeouts are not an unbounded one). Every virtual entity this extractor
        looks at is charged against `DERIVED_ENTITY_BUDGET`; once it is spent nothing further is
        entered, and what is skipped is counted as lost paint.
        """
        for virtual in instance.virtual_entities():
            dxftype = virtual.dxftype()
            if self._expanded >= DERIVED_ENTITY_BUDGET:
                # Structural records are not paint (L-CAD-03), so they are not lost paint either:
                # a SEQEND or a VERTEX would never have become a derived entity to begin with.
                if dxftype not in _NOT_CONTENT:
                    space.counters.lose(dxftype)
                continue
            self._expanded += 1

            if dxftype == "INSERT":
                if depth + 1 > EXPLODE_DEPTH_CAP:
                    # The instance is not entered, so its attributes are no more collected than its
                    # geometry is: the counters and `block_attributes` say the same thing about it.
                    space.counters.lose(dxftype)
                    continue
                self.collect_attributes(virtual, key, space)
                self.explode(virtual, key, space, inherited, depth + 1)
                continue

            record = self.entity_record(virtual, space, inherited)
            if record is None:
                continue
            record["src"] = key
            space.derived.append(record)

    def read_space(self, layout: Any, name: str, kind: str) -> _Space:
        space = _Space(name=name, kind=kind)
        for entity in layout:
            handle = entity.dxf.get("handle", None)
            if handle is None:
                # Nothing to mint a source key from, so this is no atom of the extraction surface
                # (L-CAD-02) — and it must not reach the extents of a space it does not appear in.
                continue
            record = self.entity_record(entity, space, None)
            if record is None:
                continue
            key = source_key(str(handle))
            record["key"] = key
            space.entities.append(record)

            if entity.dxftype() in _PAINTS_DERIVED:
                if entity.dxftype() == "INSERT":
                    self.collect_attributes(entity, key, space)
                rgb = record["colour"]["rgb"]
                painted: colours.Channels = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
                self.explode(entity, key, space, painted, 1)
        return space


def _bbox_record(box: tuple[float, float, float, float] | None) -> dict[str, list[float]] | None:
    if box is None:
        return None
    return {"max": [box[2], box[3]], "min": [box[0], box[1]]}


def ingest_document(doc: Any, notes: report.Report | None = None) -> dict[str, Any]:
    """The whole artifact for an already-opened drawing, with what it carries but does not draw
    written into `notes` (L-CAD-04: never a silent loss)."""
    notes = report.Report() if notes is None else notes
    report.survey(doc, notes)
    extractor = _Extractor(doc, notes)

    spaces: list[_Space] = []
    dropped: list[str] = []
    for layout_name in doc.layouts.names_in_taborder():
        is_model = layout_name == _MODEL_LAYOUT
        space = extractor.read_space(
            doc.layouts.get(layout_name),
            MODEL_SPACE if is_model else layout_name,
            "model" if is_model else "paper",
        )
        # A paper layout with nothing on it is inventory, not a sheet: dropped and counted.
        if not is_model and space.is_content_less():
            dropped.append(layout_name)
            continue
        spaces.append(space)

    layouts: list[dict[str, Any]] = []
    for space in spaces:
        box, strays = geometry.robust_extents(space.boxes)
        layouts.append(
            {
                "name": space.name,
                "kind": space.kind,
                "bbox": _bbox_record(box),
                "strays_rejected": strays,
            }
        )

    return {
        "block_attributes": [record for space in spaces for record in space.attributes],
        "counters": [space.counters.record(space.name) for space in spaces],
        "derived": [record for space in spaces for record in space.derived],
        "dropped_layouts": dropped,
        "entities": [record for space in spaces for record in space.entities],
        "entitygraph_version": ENTITYGRAPH_VERSION,
        "ingest": {
            "parameter_set_hash": parameter_set_hash(),
            "scheme": SCHEME,
            "tool": TOOL,
            "tool_version": ezdxf.__version__,
        },
        "insunits": units.report(int(doc.header.get("$INSUNITS", 0))),
        "layouts": layouts,
    }


def _open_recovered(stream: io.BytesIO, notes: report.Report) -> Any:
    """One recover-mode open, with what the audit repaired on the way in recorded as a note.

    `ezdxf.recover` is the open this extractor uses rather than `readfile`, because the drawings this
    product is given are converter output: a file AutoCAD wrote, a file LibreDWG wrote from a file
    AutoCAD wrote, a file a consultant's 2009 seat wrote. `readfile` refuses all of them over one
    flaw; recover mode repairs what it can and hands back an auditor saying what it did — and a
    repair nobody is told about is a silent edit of somebody's drawing, so the count travels
    (L-CAD-09).
    """
    doc, auditor = ezdxf.recover.read(stream)
    if auditor.fixes or auditor.errors:
        notes.add(
            report.AUDIT_REPAIRED,
            f"{len(auditor.fixes)} repaired, {len(auditor.errors)} left unrepaired",
            len(auditor.fixes) + len(auditor.errors),
        )
    return doc


def read_document(source: Path, notes: report.Report) -> Any:
    """Open a drawing, repairing its tag stream at most once, or refuse it by name (L-CAD-04).

    The order is: recover mode, and if the tag stream itself is mis-paired, ONE resync and recover
    mode again. Once, not until it works — a resync that has to run twice is not repairing a stray
    line, it is guessing at a file, and a guessed drawing is worse than a refused one because
    everything downstream reads the artifact and nothing else (L-CAD-01).

    A drawing that still will not open leaves as `DXF_UNREADABLE` carrying the line that broke the
    rhythm, never as a bare exception: a traceback names this file where the operator needs the line
    of their own export to take back to whoever produced it.
    """
    try:
        data = source.read_bytes()
    except OSError as error:
        raise IngestError(report.SOURCE_NOT_READABLE, str(error)) from error

    repeated = report.duplicate_handles(data)
    if repeated:
        raise IngestError(
            report.HANDLES_NOT_UNIQUE,
            f"{len(repeated)} handle(s) are stated more than once, first {repeated[0]}",
        )

    try:
        return _open_recovered(io.BytesIO(data), notes)
    except ezdxf.DXFStructureError as structure_error:
        first = structure_error
    except ezdxf.DXFError as error:
        # Recover mode failed for a reason no re-pairing of lines can address.
        raise IngestError(report.DXF_UNREADABLE, str(error)) from error

    repair = resync_tag_stream(data)
    where = f'line {repair.line}: "{repair.text}"' if repair.line else "no mis-paired line was found"
    if repair.repaired is None or repair.dropped == 0:
        raise IngestError(report.DXF_UNREADABLE, f"{first} ({where})") from first

    try:
        doc = _open_recovered(io.BytesIO(repair.repaired), notes)
    except ezdxf.DXFError as error:
        raise IngestError(
            report.DXF_UNREADABLE,
            f"{error} after a tag-stream resync dropped {repair.dropped} lines ({where})",
        ) from error

    notes.add(
        report.RESYNCED_TAG_STREAM,
        f"{repair.dropped} lines dropped, first at {where}",
        repair.dropped,
    )
    return doc


def ingest_dxf(source: Path, notes: report.Report | None = None) -> dict[str, Any]:
    """Read a DXF file and return its EntityGraph v2 artifact, or refuse the drawing by name.

    `notes` is the caller's report: what the open repaired and what the drawing carries that no
    geometry in the artifact stands for is written into it. A caller that passes none is asking only
    for the artifact, and the notes are collected and dropped — never suppressed, because the
    refusals travel as exceptions whatever the caller asked for.
    """
    notes = report.Report() if notes is None else notes
    doc = read_document(source, notes)
    try:
        return ingest_document(doc, notes)
    except (ezdxf.DXFError, ValueError) as error:
        # A drawing ezdxf opens but cannot be read through refuses the sheet by name rather than
        # writing half an artifact (L-CAD-04). ValueError is the extractor's own half of that: a
        # coordinate that is not finite, an area that overflowed the double it is computed in, a
        # header field spelling $INSUNITS as something other than a number. Each is a drawing this
        # extractor cannot read through, and none of them may leave as a traceback, because a
        # traceback names geometry.py where the contract requires the drawing's own name.
        raise IngestError(report.DXF_UNEXTRACTABLE, f"unextractable DXF: {error}") from error
