"""The Python half of the EntityGraph mirror (L-CAD-05).

`src/core/entitygraph/schema.ts` is the same vocabulary in Zod; both sides parse the committed
fixtures, which is what keeps the artifact one shape rather than two dialects of one. This module
is a validator, not a reader of meaning: it says whether a document *is* an EntityGraph and
refuses it by name when it is not.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Final

from .ingest import ENTITYGRAPH_VERSION, SCHEME
from .units import INSUNITS

#: A source key: the closed scheme, then the file's own handle in uppercase hex (L-CAD-02).
#: `\Z` rather than `$`, so a trailing newline is no more admissible here than it is to the Zod
#: mirror's `$` — the two sides are one shape, not two tolerances (L-CAD-05).
SOURCE_KEY: Final = re.compile(rf"^{SCHEME}:[0-9A-F]+\Z")

PARAMETER_SET_HASH: Final = re.compile(r"^[0-9a-f]{64}\Z", re.IGNORECASE)

COLOUR_SOURCES: Final = frozenset({"truecolor", "explicit", "bylayer", "byblock"})
LAYOUT_KINDS: Final = frozenset({"model", "paper"})
UNITS: Final = frozenset(INSUNITS.values())

TOP_LEVEL_KEYS: Final = frozenset(
    {
        "block_attributes",
        "counters",
        "derived",
        "dropped_layouts",
        "entities",
        "entitygraph_version",
        "ingest",
        "insunits",
        "layouts",
    }
)

#: Every field an entity record may carry beyond the four every one of them carries.
_OPTIONAL_ENTITY_FIELDS: Final = frozenset({"text", "height", "points", "closed", "area"})


class EntityGraphError(ValueError):
    """A document that is not an EntityGraph artifact, named by where it broke."""


@dataclass(frozen=True)
class EntityGraph:
    """A parsed artifact, held as the document it was — the mirror validates, it does not reshape."""

    document: dict[str, Any]

    @property
    def version(self) -> int:
        return int(self.document["entitygraph_version"])


def _fail(where: str, why: str) -> None:
    raise EntityGraphError(f"{where}: {why}")


def _object(value: Any, where: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(where, f"expected an object, found {type(value).__name__}")
    return value


def _array(value: Any, where: str) -> list[Any]:
    if not isinstance(value, list):
        _fail(where, f"expected an array, found {type(value).__name__}")
    return value


def _string(value: Any, where: str, *, non_empty: bool = False) -> str:
    if not isinstance(value, str):
        _fail(where, f"expected a string, found {type(value).__name__}")
    if non_empty and not value:
        _fail(where, "is empty")
    return value


def _number(value: Any, where: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        _fail(where, f"expected a number, found {type(value).__name__}")
    return float(value)


def _integer(value: Any, where: str, *, minimum: int | None = None) -> int:
    """A whole number, however JSON spelled it.

    JSON draws no line between `3` and `3.0`, and the Zod mirror's `z.number().int()` reads both as
    an integer; this side reads them the same way rather than being the stricter of two tolerances.
    """
    if isinstance(value, bool) or not isinstance(value, int | float):
        _fail(where, f"expected an integer, found {type(value).__name__}")
    if isinstance(value, float) and not value.is_integer():
        _fail(where, f"expected an integer, found {value!r}")
    number = int(value)
    if minimum is not None and number < minimum:
        _fail(where, f"must be at least {minimum}")
    return number


def _boolean(value: Any, where: str) -> bool:
    if not isinstance(value, bool):
        _fail(where, f"expected a boolean, found {type(value).__name__}")
    return value


def _closed_keys(record: dict[str, Any], allowed: frozenset[str], where: str) -> None:
    extra = sorted(set(record) - allowed)
    if extra:
        _fail(where, f"carries keys outside the closed set: {', '.join(extra)}")


def _required(record: dict[str, Any], key: str, where: str) -> None:
    """A key that must be present even when its value is null.

    The nullable fields (`layouts[].bbox`, `insunits.unit`) are the one place where reading a value
    with `.get()` cannot tell an explicit null from an absent key. The Zod mirror can — `.nullable()`
    without `.optional()` inside a strict object — so this side asks the question outright.
    """
    if key not in record:
        _fail(where, f"is missing {key}")


def _counts(value: Any, where: str) -> None:
    for dxftype, count in _object(value, where).items():
        _integer(count, f"{where}.{dxftype}", minimum=0)


def _colour(value: Any, where: str) -> None:
    colour = _object(value, where)
    _closed_keys(colour, frozenset({"rgb", "source"}), where)
    channels = _array(colour.get("rgb"), f"{where}.rgb")
    if len(channels) != 3:
        _fail(f"{where}.rgb", "a colour is three channels")
    for index, channel in enumerate(channels):
        value_ = _integer(channel, f"{where}.rgb[{index}]", minimum=0)
        if value_ > 255:
            _fail(f"{where}.rgb[{index}]", "a channel is 0-255")
    if _string(colour.get("source"), f"{where}.source") not in COLOUR_SOURCES:
        _fail(f"{where}.source", f"{colour['source']!r} is outside the closed set")


def _points(value: Any, where: str) -> None:
    for index, point in enumerate(_array(value, where)):
        pair = _array(point, f"{where}[{index}]")
        if len(pair) != 2:
            _fail(f"{where}[{index}]", "a point is an [x, y] pair")
        _number(pair[0], f"{where}[{index}][0]")
        _number(pair[1], f"{where}[{index}][1]")


def _entity_fields(record: dict[str, Any], where: str) -> None:
    _string(record.get("type"), f"{where}.type", non_empty=True)
    _string(record.get("space"), f"{where}.space", non_empty=True)
    _string(record.get("layer"), f"{where}.layer")
    _colour(record.get("colour"), f"{where}.colour")
    if "text" in record:
        _string(record["text"], f"{where}.text")
    if "height" in record:
        _number(record["height"], f"{where}.height")
    if "points" in record:
        _points(record["points"], f"{where}.points")
    if "closed" in record:
        _boolean(record["closed"], f"{where}.closed")
    if "area" in record:
        _number(record["area"], f"{where}.area")


def _source_key(value: Any, where: str) -> str:
    key = _string(value, where)
    if SOURCE_KEY.match(key) is None:
        _fail(where, f"{key!r} is not a {SCHEME} source key")
    return key


def _entity(value: Any, where: str) -> str:
    record = _object(value, where)
    _closed_keys(record, _OPTIONAL_ENTITY_FIELDS | {"key", "type", "space", "layer", "colour"}, where)
    _entity_fields(record, where)
    return _source_key(record.get("key"), f"{where}.key")


def _derived(value: Any, where: str, keys: set[str]) -> None:
    record = _object(value, where)
    _closed_keys(record, _OPTIONAL_ENTITY_FIELDS | {"src", "type", "space", "layer", "colour"}, where)
    _entity_fields(record, where)
    if _source_key(record.get("src"), f"{where}.src") not in keys:
        _fail(f"{where}.src", "names no original entity (L-CAD-03)")


def _ingest_record(value: Any) -> None:
    record = _object(value, "ingest")
    _closed_keys(record, frozenset({"scheme", "tool", "tool_version", "parameter_set_hash"}), "ingest")
    if _string(record.get("scheme"), "ingest.scheme") != SCHEME:
        _fail("ingest.scheme", f"a DXF ingest mints {SCHEME} keys")
    _string(record.get("tool"), "ingest.tool", non_empty=True)
    _string(record.get("tool_version"), "ingest.tool_version", non_empty=True)
    digest = _string(record.get("parameter_set_hash"), "ingest.parameter_set_hash")
    if PARAMETER_SET_HASH.match(digest) is None:
        _fail("ingest.parameter_set_hash", "must be 64 hex characters")


def _insunits(value: Any) -> None:
    record = _object(value, "insunits")
    _closed_keys(record, frozenset({"code", "unit", "unmapped"}), "insunits")
    _integer(record.get("code"), "insunits.code")
    unmapped = _boolean(record.get("unmapped"), "insunits.unmapped")
    # Nullable is not optional: the Zod mirror's `z.enum(UNITS).nullable()` inside a strict object
    # demands the key, spelled `null` when there is no unit. A missing key is a different document
    # and both sides refuse it — one shape, not two tolerances (L-CAD-05).
    _required(record, "unit", "insunits")
    unit = record.get("unit")
    if unit is None:
        if not unmapped:
            _fail("insunits", "reports no unit yet is not flagged unmapped (L-CAD-02)")
        return
    if _string(unit, "insunits.unit") not in UNITS:
        _fail("insunits.unit", f"{unit!r} is outside the closed set")
    if unmapped:
        _fail("insunits", "names a unit yet is flagged unmapped")


def _layout(value: Any, where: str) -> None:
    record = _object(value, where)
    _closed_keys(record, frozenset({"name", "kind", "bbox", "strays_rejected"}), where)
    _string(record.get("name"), f"{where}.name", non_empty=True)
    if _string(record.get("kind"), f"{where}.kind") not in LAYOUT_KINDS:
        _fail(f"{where}.kind", f"{record['kind']!r} is outside the closed set")
    _integer(record.get("strays_rejected"), f"{where}.strays_rejected", minimum=0)

    # As with `insunits.unit`: a layout with no extents spells `"bbox": null`, and a layout record
    # that drops the key altogether is refused here exactly as the Zod mirror refuses it.
    _required(record, "bbox", where)
    bbox = record.get("bbox")
    if bbox is None:
        return
    box = _object(bbox, f"{where}.bbox")
    _closed_keys(box, frozenset({"min", "max"}), f"{where}.bbox")
    for corner in ("min", "max"):
        pair = _array(box.get(corner), f"{where}.bbox.{corner}")
        if len(pair) != 2:
            _fail(f"{where}.bbox.{corner}", "a corner is an [x, y] pair")
        _number(pair[0], f"{where}.bbox.{corner}[0]")
        _number(pair[1], f"{where}.bbox.{corner}[1]")


def _counter(value: Any, where: str) -> None:
    record = _object(value, where)
    _closed_keys(
        record, frozenset({"space", "explode_truncated", "explode_losses", "flatten_capped"}), where
    )
    _string(record.get("space"), f"{where}.space", non_empty=True)
    _boolean(record.get("explode_truncated"), f"{where}.explode_truncated")
    _counts(record.get("explode_losses"), f"{where}.explode_losses")
    _counts(record.get("flatten_capped"), f"{where}.flatten_capped")


def _block_attribute(value: Any, where: str, keys: set[str]) -> None:
    record = _object(value, where)
    _closed_keys(record, frozenset({"src", "tag", "text", "height"}), where)
    if _source_key(record.get("src"), f"{where}.src") not in keys:
        _fail(f"{where}.src", "names no original entity (L-CAD-03)")
    _string(record.get("tag"), f"{where}.tag", non_empty=True)
    _string(record.get("text"), f"{where}.text")
    _number(record.get("height"), f"{where}.height")


def parse_entity_graph(value: Any) -> EntityGraph:
    """Parse a document as an EntityGraph v2 artifact, or refuse it by name."""
    document = _object(value, "artifact")
    missing = sorted(TOP_LEVEL_KEYS - set(document))
    if missing:
        _fail("artifact", f"is missing {', '.join(missing)}")
    _closed_keys(document, frozenset(TOP_LEVEL_KEYS), "artifact")

    if _integer(document["entitygraph_version"], "entitygraph_version") != ENTITYGRAPH_VERSION:
        _fail("entitygraph_version", f"v{ENTITYGRAPH_VERSION} is the floor (L-CAD-05)")

    _ingest_record(document["ingest"])
    _insunits(document["insunits"])

    for index, layout in enumerate(_array(document["layouts"], "layouts")):
        _layout(layout, f"layouts[{index}]")
    for index, name in enumerate(_array(document["dropped_layouts"], "dropped_layouts")):
        _string(name, f"dropped_layouts[{index}]", non_empty=True)

    keys: set[str] = set()
    for index, entity in enumerate(_array(document["entities"], "entities")):
        key = _entity(entity, f"entities[{index}]")
        if key in keys:
            _fail(f"entities[{index}].key", f"{key} is minted twice (L-CAD-02)")
        keys.add(key)

    for index, record in enumerate(_array(document["derived"], "derived")):
        _derived(record, f"derived[{index}]", keys)
    for index, record in enumerate(_array(document["block_attributes"], "block_attributes")):
        _block_attribute(record, f"block_attributes[{index}]", keys)
    for index, record in enumerate(_array(document["counters"], "counters")):
        _counter(record, f"counters[{index}]")

    return EntityGraph(document=document)
