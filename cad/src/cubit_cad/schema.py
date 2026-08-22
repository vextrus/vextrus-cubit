"""EntityGraph v2, validated on the Python side of the mirror (L-CAD-05).

"EntityGraph is versioned (v2 as the floor) and mirrored in Zod; both sides parse
committed fixtures." This module is the half of that mirror the CLI answers for: the same
vocabulary, the same closed enumerations, the same refusals as
`src/core/entitygraph/index.ts`. Both sides read `fixtures/entitygraph/`, and neither is
allowed to be the lenient one.

The validator is written by hand rather than pulled from a schema library: the seam ships
one runtime dependency, the extractor, and a vocabulary this small is cheaper to state
than to configure.
"""

from __future__ import annotations

import re
from typing import Any

from . import ENTITY_GRAPH_VERSION

#: L-CAD-02's closed scheme set. A key outside it was minted by no extractor we know.
KEY_SCHEMES = ("DXF_HANDLE", "PDF_OBJECT", "RASTER_TRACE")

KEY_PATTERN = re.compile(rf"^(?:{'|'.join(KEY_SCHEMES)}):.+$")
RGB_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")

COLOUR_SOURCES = ("true_colour", "explicit", "bylayer", "byblock")
LAYOUT_KINDS = ("model", "paper")
UNITS = ("unitless", "inch", "foot", "mm", "cm", "m")


class EntityGraphError(ValueError):
    """The object is not an EntityGraph v2. The message names the path that failed."""


def _fail(path: str, said: str) -> None:
    raise EntityGraphError(f"{path}: {said}")


def _obj(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(path, f"expected an object, got {type(value).__name__}")
    return value


def _list(value: Any, path: str) -> list[Any]:
    if not isinstance(value, list):
        _fail(path, f"expected an array, got {type(value).__name__}")
    return value


def _str(container: dict[str, Any], key: str, path: str, *, allow_empty: bool = True) -> str:
    if key not in container:
        _fail(f"{path}.{key}", "is required")
    value = container[key]
    if not isinstance(value, str):
        _fail(f"{path}.{key}", f"expected a string, got {type(value).__name__}")
    if not allow_empty and value == "":
        _fail(f"{path}.{key}", "must not be empty")
    return value


def _int(container: dict[str, Any], key: str, path: str, *, minimum: int | None = None) -> int:
    if key not in container:
        _fail(f"{path}.{key}", "is required")
    value = container[key]
    if isinstance(value, bool) or not isinstance(value, int):
        _fail(f"{path}.{key}", f"expected an integer, got {type(value).__name__}")
    if minimum is not None and value < minimum:
        _fail(f"{path}.{key}", f"must be at least {minimum}")
    return value


def _bool(container: dict[str, Any], key: str, path: str) -> bool:
    if key not in container:
        _fail(f"{path}.{key}", "is required")
    value = container[key]
    if not isinstance(value, bool):
        _fail(f"{path}.{key}", f"expected a boolean, got {type(value).__name__}")
    return value


def _number(value: Any, path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _fail(path, f"expected a number, got {type(value).__name__}")
    return float(value)


def _one_of(value: str, allowed: tuple[str, ...], path: str) -> str:
    if value not in allowed:
        _fail(path, f"{value!r} is outside the closed set {allowed}")
    return value


def _pattern(value: str, pattern: re.Pattern[str], path: str, said: str) -> str:
    if pattern.match(value) is None:
        _fail(path, said)
    return value


def _point(value: Any, path: str) -> None:
    values = _list(value, path)
    if len(values) != 2:
        _fail(path, "expected two coordinates")
    for index, coordinate in enumerate(values):
        _number(coordinate, f"{path}[{index}]")


def _colour(value: Any, path: str) -> None:
    colour = _obj(value, path)
    _pattern(_str(colour, "rgb", path), RGB_PATTERN, f"{path}.rgb", "is not #RRGGBB")
    _one_of(_str(colour, "source", path), COLOUR_SOURCES, f"{path}.source")


def _entity(value: Any, path: str, *, original: bool) -> None:
    """One entity. Originals carry `key` and never `src`; derived paint is the reverse."""
    entity = _obj(value, path)
    if original:
        _pattern(
            _str(entity, "key", path),
            KEY_PATTERN,
            f"{path}.key",
            f"is not one of the closed schemes {KEY_SCHEMES}",
        )
        if entity.get("src") is not None:
            _fail(f"{path}.src", "an original entity is not derived paint")
    else:
        _pattern(
            _str(entity, "src", path),
            KEY_PATTERN,
            f"{path}.src",
            f"is not one of the closed schemes {KEY_SCHEMES}",
        )
        if entity.get("key") is not None:
            _fail(f"{path}.key", "derived paint is not an atom and mints no key")
    _str(entity, "type", path, allow_empty=False)
    _str(entity, "layer", path)
    _str(entity, "space", path, allow_empty=False)
    _colour(entity.get("colour"), f"{path}.colour")
    _obj(entity.get("geometry"), f"{path}.geometry")
    if "closed" in entity and not isinstance(entity["closed"], bool):
        _fail(f"{path}.closed", "expected a boolean")
    if "area" in entity:
        _number(entity["area"], f"{path}.area")
    if "text" in entity and not isinstance(entity["text"], str):
        _fail(f"{path}.text", "expected a string")
    if "height" in entity:
        _number(entity["height"], f"{path}.height")
    if "anchor" in entity:
        _point(entity["anchor"], f"{path}.anchor")


def _ingest(value: Any, path: str) -> None:
    ingest = _obj(value, path)
    extractor = _obj(ingest.get("extractor"), f"{path}.extractor")
    _str(extractor, "name", f"{path}.extractor", allow_empty=False)
    _str(extractor, "version", f"{path}.extractor", allow_empty=False)
    _pattern(
        _str(extractor, "parameter_set_hash", f"{path}.extractor"),
        SHA256_PATTERN,
        f"{path}.extractor.parameter_set_hash",
        "is not a sha256 digest",
    )
    _pattern(
        _str(ingest, "file_sha256", path),
        SHA256_PATTERN,
        f"{path}.file_sha256",
        "is not a sha256 digest",
    )


def _units(value: Any, path: str) -> None:
    units = _obj(value, path)
    _int(units, "insunits_code", path, minimum=0)
    unmapped = _bool(units, "insunits_unmapped", path)
    if "unit" not in units:
        _fail(f"{path}.unit", "is required")
    unit = units["unit"]
    if unit is not None:
        if not isinstance(unit, str):
            _fail(f"{path}.unit", "expected a string or null")
        _one_of(unit, UNITS, f"{path}.unit")
    # "an unmapped code reports null + a flag, never unitless" (L-CAD-02): the flag and
    # the null are one statement, so a graph that raises one without the other is not one.
    if (unit is None) != unmapped:
        _fail(f"{path}.unit", "an unmapped code reports null, and only an unmapped code does")


def _layout(value: Any, path: str) -> None:
    layout = _obj(value, path)
    _str(layout, "name", path, allow_empty=False)
    _one_of(_str(layout, "kind", path), LAYOUT_KINDS, f"{path}.kind")
    bbox = _list(layout.get("bbox"), f"{path}.bbox")
    if len(bbox) != 4:
        _fail(f"{path}.bbox", "expected [minx, miny, maxx, maxy]")
    for index, coordinate in enumerate(bbox):
        _number(coordinate, f"{path}.bbox[{index}]")


def _counters(value: Any, path: str) -> None:
    counters = _obj(value, path)
    _int(counters, "layouts_dropped", path, minimum=0)
    per_layout = _obj(counters.get("per_layout"), f"{path}.per_layout")
    for name, entry in per_layout.items():
        where = f"{path}.per_layout[{name!r}]"
        layout_counters = _obj(entry, where)
        _bool(layout_counters, "explode_truncated", where)
        losses = _obj(layout_counters.get("explode_losses"), f"{where}.explode_losses")
        for dxftype in losses:
            if not isinstance(dxftype, str) or dxftype == "":
                _fail(f"{where}.explode_losses", "is keyed by entity type")
            _int(losses, dxftype, f"{where}.explode_losses", minimum=0)
        _int(layout_counters, "flatten_capped", where, minimum=0)
        _int(layout_counters, "strays_rejected", where, minimum=0)


def parse_entity_graph(obj: Any) -> dict[str, Any]:
    """Validate one EntityGraph v2 and hand it back. Raises `EntityGraphError`."""
    graph = _obj(obj, "entitygraph")
    version = graph.get("version")
    if version != ENTITY_GRAPH_VERSION or isinstance(version, bool):
        _fail("entitygraph.version", f"expected {ENTITY_GRAPH_VERSION}, got {version!r}")
    _ingest(graph.get("ingest"), "entitygraph.ingest")
    _units(graph.get("units"), "entitygraph.units")
    for index, layout in enumerate(_list(graph.get("layouts"), "entitygraph.layouts")):
        _layout(layout, f"entitygraph.layouts[{index}]")
    for index, entity in enumerate(_list(graph.get("entities"), "entitygraph.entities")):
        _entity(entity, f"entitygraph.entities[{index}]", original=True)
    for index, entity in enumerate(_list(graph.get("derived"), "entitygraph.derived")):
        _entity(entity, f"entitygraph.derived[{index}]", original=False)
    for index, attribute in enumerate(_list(graph.get("attributes"), "entitygraph.attributes")):
        where = f"entitygraph.attributes[{index}]"
        record = _obj(attribute, where)
        _pattern(
            _str(record, "src", where),
            KEY_PATTERN,
            f"{where}.src",
            f"is not one of the closed schemes {KEY_SCHEMES}",
        )
        _str(record, "tag", where, allow_empty=False)
        _str(record, "text", where)
    _counters(graph.get("counters"), "entitygraph.counters")
    return graph
