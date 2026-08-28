"""DXF → EntityGraph v2, in one shot (L-CAD-01 … L-CAD-05).

The extractor reads original entities only. INSERTs explode to world coordinates for rendering,
under a depth cap and a derived-entity budget whose trips are counted; that paint is kept apart in
`derived`, each piece naming the instance that painted it. Block attributes collect separately.
Nothing here reads meaning: no schedule, no view law, no notation — those are TypeScript stages
over the artifact this writes.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

import ezdxf

from . import colours, geometry, units
from .parameters import DERIVED_ENTITY_BUDGET, EXPLODE_DEPTH_CAP, parameter_set_hash

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
    """A drawing this extractor refuses: loud failure, nothing written (L-CAD-04)."""


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

    def __init__(self, doc: Any) -> None:
        self._doc = doc
        self._layers = colours.LayerColours.of(doc)
        self._derived_minted = 0

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
        flattened = geometry.flatten(entity)
        points: list[geometry.Point] | None = None
        if flattened is not None:
            points, capped = flattened
            if capped:
                space.counters.cap(dxftype)
            elif closed:
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
        """Explode one painting original to world coordinates, for rendering only (L-CAD-03)."""
        for virtual in instance.virtual_entities():
            dxftype = virtual.dxftype()
            if dxftype == "INSERT":
                self.collect_attributes(virtual, key, space)
                if depth + 1 > EXPLODE_DEPTH_CAP:
                    space.counters.lose(dxftype)
                    continue
                self.explode(virtual, key, space, inherited, depth + 1)
                continue

            if self._derived_minted >= DERIVED_ENTITY_BUDGET:
                space.counters.lose(dxftype)
                continue

            record = self.entity_record(virtual, space, inherited)
            if record is None:
                continue
            record["src"] = key
            self._derived_minted += 1
            space.derived.append(record)

    def read_space(self, layout: Any, name: str, kind: str) -> _Space:
        space = _Space(name=name, kind=kind)
        for entity in layout:
            record = self.entity_record(entity, space, None)
            if record is None:
                continue
            handle = entity.dxf.get("handle", None)
            if handle is None:
                continue
            key = source_key(str(handle))
            record["key"] = key
            space.entities.append(record)

            if entity.dxftype() in _PAINTS_DERIVED:
                if entity.dxftype() == "INSERT":
                    self.collect_attributes(entity, key, space)
                painted = tuple(int(channel) for channel in record["colour"]["rgb"])
                self.explode(entity, key, space, painted, 1)  # type: ignore[arg-type]
        return space


def _bbox_record(box: tuple[float, float, float, float] | None) -> dict[str, list[float]] | None:
    if box is None:
        return None
    return {"max": [box[2], box[3]], "min": [box[0], box[1]]}


def ingest_document(doc: Any) -> dict[str, Any]:
    """The whole artifact for an already-opened drawing."""
    extractor = _Extractor(doc)

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


def ingest_dxf(source: Path) -> dict[str, Any]:
    """Read a DXF file and return its EntityGraph v2 artifact, or refuse the drawing by name."""
    try:
        doc = ezdxf.readfile(str(source))
    except OSError as error:
        raise IngestError(str(error)) from error
    except ezdxf.DXFError as error:
        raise IngestError(f"unparseable DXF: {error}") from error
    try:
        return ingest_document(doc)
    except ezdxf.DXFError as error:
        # A drawing ezdxf opens but cannot be read through refuses the sheet by name rather than
        # writing half an artifact (L-CAD-04).
        raise IngestError(f"unextractable DXF: {error}") from error
