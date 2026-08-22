"""DXF → EntityGraph v2 (L-CAD-01, L-CAD-02, L-CAD-03, L-CAD-05).

The shape of the pass:

* every entity in a layout's own entity space is an **original**, keyed `DXF_HANDLE:` with
  the handle the file itself minted — never a counter, never an index;
* every INSERT is painted into world space and its expansion lands in **derived**, each
  synthesised entity carrying `src`, the key of the top-level instance it came from;
* block attributes are collected **separately**, and a dimension's measurement text is a
  derived text entity;
* the caps that trip say so, per layout, by name.

Nothing here reads meaning. A block called "DOOR" is an INSERT with a name.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import ezdxf

from . import ENTITY_GRAPH_VERSION
from .colour import resolve_colour
from .extents import robust_extents
from .geometry import BBox, bbox_of, describe, num
from .params import DERIVED_ENTITY_BUDGET, EXPLODE_DEPTH_CAP, parameter_set_hash

#: L-CAD-02's closed map, verbatim: "0 unitless · 1 inch · 2 foot · 4 mm · 5 cm · 6 m".
INSUNITS: dict[int, str] = {0: "unitless", 1: "inch", 2: "foot", 4: "mm", 5: "cm", 6: "m"}

#: The one scheme this extractor may mint (L-CAD-02).
SCHEME = "DXF_HANDLE"

#: Entities whose text belongs in `attributes[]`, never among the originals.
ATTRIBUTE_TYPES = ("ATTRIB", "ATTDEF")

#: The default text height a dimension falls back to when its style says nothing.
DEFAULT_DIMENSION_TEXT_HEIGHT = 2.5


class IngestError(Exception):
    """The drawing could not be read as DXF. Loud, per L-CAD-04."""


@dataclass
class LayoutCounters:
    """R-TO-001's fidelity counters, per layout, recorded whether or not they trip."""

    explode_truncated: bool = False
    explode_losses: dict[str, int] = field(default_factory=dict)
    flatten_capped: int = 0
    strays_rejected: int = 0
    derived_count: int = 0

    def lose(self, dxftype: str, count: int = 1) -> None:
        self.explode_truncated = True
        self.explode_losses[dxftype] = self.explode_losses.get(dxftype, 0) + count

    def as_json(self) -> dict[str, Any]:
        return {
            "explode_truncated": self.explode_truncated,
            "explode_losses": dict(sorted(self.explode_losses.items())),
            "flatten_capped": self.flatten_capped,
            "strays_rejected": self.strays_rejected,
        }


def key_of(entity: Any) -> str:
    """`DXF_HANDLE:<handle>` — the file's own handle, upper-cased as DXF writes hex."""
    return f"{SCHEME}:{str(entity.dxf.handle).upper()}"


def _record(
    entity: Any,
    space: str,
    colour: dict[str, str],
    counters: LayoutCounters,
    key: str | None = None,
    src: str | None = None,
) -> tuple[dict[str, Any], list[list[float]]]:
    """One entity as the artifact writes it, plus the points extents will read."""
    described = describe(entity)
    if described["capped"]:
        counters.flatten_capped += 1
    record: dict[str, Any] = {}
    if key is not None:
        record["key"] = key
    if src is not None:
        record["src"] = src
    record["type"] = entity.dxftype()
    record["layer"] = entity.dxf.get("layer", "0")
    record["space"] = space
    record["colour"] = colour
    record["geometry"] = described["geometry"]
    for name in ("closed", "area", "text", "height", "anchor"):
        if name in described["extras"]:
            record[name] = described["extras"][name]
    return record, described["points"]


def _measurement_text(value: float) -> str:
    """A dimension's measured value as text, with no trailing noise."""
    rendered = f"{value:.4f}".rstrip("0").rstrip(".")
    return rendered if rendered not in ("", "-") else "0"


def _dimension_text_height(doc: Any, dimension: Any) -> float:
    try:
        style = doc.dimstyles.get(dimension.dxf.get("dimstyle", "Standard"))
        return float(style.dxf.get("dimtxt", DEFAULT_DIMENSION_TEXT_HEIGHT))
    except Exception:
        return DEFAULT_DIMENSION_TEXT_HEIGHT


class _Pass:
    """One drawing, one pass. Holds the growing artifact and the per-layout counters."""

    def __init__(self, doc: Any) -> None:
        self.doc = doc
        self.entities: list[dict[str, Any]] = []
        self.derived: list[dict[str, Any]] = []
        self.attributes: list[dict[str, str]] = []
        self.layouts: list[dict[str, Any]] = []
        self.counters: dict[str, LayoutCounters] = {}
        self.layouts_dropped = 0

    # -- attributes ------------------------------------------------------------------

    def collect_attributes(self, insert: Any, src: str) -> None:
        """"Block attributes collect separately" (L-CAD-03) — never as originals."""
        for attribute in insert.attribs:
            self.attributes.append(
                {
                    "src": src,
                    "tag": str(attribute.dxf.get("tag", "")),
                    "text": str(attribute.dxf.get("text", "")),
                }
            )

    # -- explosion -------------------------------------------------------------------

    def _block_losses(self, block_name: str, counters: LayoutCounters) -> None:
        """What an un-expanded block would have painted, counted by type."""
        try:
            block = self.doc.blocks.get(block_name)
        except Exception:
            counters.lose("INSERT")
            return
        found = False
        for entity in block:
            if entity.dxftype() in ATTRIBUTE_TYPES:
                continue
            counters.lose(entity.dxftype())
            found = True
        if not found:
            counters.lose("INSERT")

    def explode(
        self,
        insert: Any,
        root_key: str,
        space: str,
        parent_rgb: str,
        depth: int,
        counters: LayoutCounters,
        boxes: list[BBox],
    ) -> None:
        """Paint one block instance into world space (L-CAD-03).

        `root_key` is the top-level INSERT's key and stays the same all the way down:
        derived paint is not an atom, so nesting mints no new keys — every synthesised
        entity names the instance a reader can point at.
        """
        for sub in insert.virtual_entities():
            dxftype = sub.dxftype()
            if dxftype in ATTRIBUTE_TYPES:
                continue
            if counters.derived_count >= DERIVED_ENTITY_BUDGET:
                counters.lose(dxftype)
                continue
            colour = resolve_colour(sub, self.doc, parent_rgb)
            record, points = _record(sub, space, colour, counters, src=root_key)
            self.derived.append(record)
            counters.derived_count += 1
            box = bbox_of(points)
            if box is not None:
                boxes.append(box)
            if dxftype != "INSERT":
                continue
            self.collect_attributes(sub, root_key)
            if depth + 1 > EXPLODE_DEPTH_CAP:
                self._block_losses(sub.dxf.get("name", ""), counters)
                continue
            self.explode(sub, root_key, space, colour["rgb"], depth + 1, counters, boxes)

    # -- dimensions ------------------------------------------------------------------

    def dimension_text(
        self,
        dimension: Any,
        key: str,
        space: str,
        colour: dict[str, str],
    ) -> dict[str, Any] | None:
        """"a dimension's measurement text is a derived text entity" (L-CAD-03)."""
        override = str(dimension.dxf.get("text", ""))
        if override in ("", "<>"):
            try:
                measurement = dimension.get_measurement()
            except Exception:
                return None
            if not isinstance(measurement, (int, float)):
                return None
            text = _measurement_text(float(measurement))
        else:
            # Text crosses the seam raw (L-CAD-01): the app's parsers own the escapes.
            text = override
        anchor_point = dimension.dxf.get("text_midpoint", None) or dimension.dxf.get(
            "defpoint", None
        )
        if anchor_point is None:
            return None
        anchor = [num(anchor_point.x), num(anchor_point.y)]
        return {
            "src": key,
            "type": "TEXT",
            "layer": dimension.dxf.get("layer", "0"),
            "space": space,
            "colour": colour,
            "geometry": {"anchor": anchor, "points": [anchor]},
            "text": text,
            "height": num(_dimension_text_height(self.doc, dimension)),
            "anchor": anchor,
        }

    # -- the layouts -----------------------------------------------------------------

    def run(self) -> None:
        for name in self.doc.layouts.names_in_taborder():
            layout = self.doc.layouts.get(name)
            paper = bool(layout.is_any_paperspace)
            space = name if paper else "model"
            members = list(layout)
            if not members:
                # "content-less layouts dropped and counted" (L-CAD-05).
                self.layouts_dropped += 1
                continue
            counters = LayoutCounters()
            boxes: list[BBox] = []
            for entity in members:
                if entity.dxftype() in ATTRIBUTE_TYPES:
                    continue
                key = key_of(entity)
                colour = resolve_colour(entity, self.doc)
                record, points = _record(entity, space, colour, counters, key=key)
                self.entities.append(record)
                box = bbox_of(points)
                if box is not None:
                    boxes.append(box)
                if entity.dxftype() == "INSERT":
                    self.collect_attributes(entity, key)
                    self.explode(entity, key, space, colour["rgb"], 1, counters, boxes)
                elif entity.dxftype() == "DIMENSION":
                    text = self.dimension_text(entity, key, space, colour)
                    if text is not None:
                        self.derived.append(text)
                        counters.derived_count += 1
            bbox, strays = robust_extents(boxes)
            counters.strays_rejected = strays
            self.counters[name] = counters
            self.layouts.append(
                {
                    "name": name,
                    "kind": "paper" if paper else "model",
                    "bbox": bbox if bbox is not None else [0.0, 0.0, 0.0, 0.0],
                }
            )


def _units(doc: Any) -> dict[str, Any]:
    code = int(doc.header.get("$INSUNITS", 0))
    unit = INSUNITS.get(code)
    return {"insunits_code": code, "unit": unit, "insunits_unmapped": unit is None}


def ingest_dxf(path: Path) -> dict[str, Any]:
    """Read one DXF file and answer the whole EntityGraph. Raises `IngestError`, loudly."""
    try:
        payload = path.read_bytes()
    except OSError as error:
        raise IngestError(f"cannot read {path}: {error}") from error
    try:
        doc = ezdxf.readfile(str(path))
    except (OSError, ezdxf.DXFError, UnicodeDecodeError) as error:
        raise IngestError(f"{path} is not a DXF this extractor can read: {error}") from error

    pass_ = _Pass(doc)
    pass_.run()
    return {
        "version": ENTITY_GRAPH_VERSION,
        "ingest": {
            "extractor": {
                "name": "ezdxf",
                "version": ezdxf.__version__,
                "parameter_set_hash": parameter_set_hash(),
            },
            "file_sha256": hashlib.sha256(payload).hexdigest(),
        },
        "units": _units(doc),
        "layouts": pass_.layouts,
        "entities": pass_.entities,
        "derived": pass_.derived,
        "attributes": pass_.attributes,
        "counters": {
            "layouts_dropped": pass_.layouts_dropped,
            "per_layout": {name: c.as_json() for name, c in pass_.counters.items()},
        },
    }
