"""The Python half of "both sides parse committed fixtures" (L-CAD-05).

`src/core/entitygraph/schema.ts` is the same vocabulary in Zod and parses these very files. A
mirror that only accepts is not a mirror, so the refusals are proved too: an artifact below the v2
floor and a source key that drops its scheme are both rejected by name (L-CAD-02).

Two versions are read (I-415): v3, which the extractor writes and which REQUIRES its facts
wherever they apply, and the v2 floor an artifact stored before v3 is read at, which carries none
of them. The version rules are proved rule by rule, the same rules `tests/cad/entitygraph-schema`
holds the Zod mirror to.
"""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

import pytest

from corpus import artifact_names, artifact_path
from vextrus_cad import (
    ENTITYGRAPH_FLOOR,
    ENTITYGRAPH_VERSION,
    SCHEME,
    EntityGraphError,
    parse_entity_graph,
)

NAMES = artifact_names()

#: What v3 adds to a drawn record and to a block attribute, and at the top level.
_V3_RECORD_FIELDS = ("rotation", "halign", "valign", "attachment", "align_point", "block", "override")
_V3_ATTRIBUTE_FIELDS = ("rotation", "halign", "valign")


def _load(name: str) -> dict[str, Any]:
    return json.loads(artifact_path(name).read_text(encoding="utf-8"))


def _as_stored_v2(document: dict[str, Any]) -> dict[str, Any]:
    """A committed v3 artifact as the extractor wrote it before v3: the same bytes less v3's facts."""
    stored = deepcopy(document)
    stored["entitygraph_version"] = ENTITYGRAPH_FLOOR
    stored.pop("layers")
    for kind in ("entities", "derived"):
        for record in stored[kind]:
            for field in _V3_RECORD_FIELDS:
                record.pop(field, None)
    for record in stored["block_attributes"]:
        for field in _V3_ATTRIBUTE_FIELDS:
            record.pop(field, None)
    return stored


def _first(document: dict[str, Any], kind: str, **where: Any) -> dict[str, Any]:
    for record in document[kind]:
        if all(record.get(key) == value for key, value in where.items()):
            return record
    raise AssertionError(f"no {kind} record where {where}")


def test_the_corpus_is_not_empty() -> None:
    # Every rule below is parameterised over the corpus; an empty one would prove nothing.
    assert NAMES, "no committed artifact was found beside the DXF corpus"


@pytest.mark.parametrize("name", NAMES)
def test_every_committed_artifact_parses(name: str) -> None:
    graph = parse_entity_graph(_load(name))
    assert graph.version == ENTITYGRAPH_VERSION


@pytest.mark.parametrize("name", NAMES)
def test_an_artifact_below_the_version_floor_is_refused(name: str) -> None:
    document = _as_stored_v2(_load(name))
    document["entitygraph_version"] = ENTITYGRAPH_FLOOR - 1
    with pytest.raises(EntityGraphError, match="entitygraph_version"):
        parse_entity_graph(document)


@pytest.mark.parametrize("name", NAMES)
def test_an_artifact_above_the_current_version_is_refused(name: str) -> None:
    document = _load(name)
    document["entitygraph_version"] = ENTITYGRAPH_VERSION + 1
    with pytest.raises(EntityGraphError, match="entitygraph_version"):
        parse_entity_graph(document)


@pytest.mark.parametrize("name", NAMES)
def test_a_stored_v2_artifact_still_reads_at_the_floor(name: str) -> None:
    assert parse_entity_graph(_as_stored_v2(_load(name))).version == ENTITYGRAPH_FLOOR


@pytest.mark.parametrize("name", NAMES)
def test_a_v2_artifact_spelling_a_v3_fact_is_refused(name: str) -> None:
    """Two dialects in one file: a v2 document carries none of v3's facts, top level or record."""
    document = _as_stored_v2(_load(name))
    document["layers"] = []
    with pytest.raises(EntityGraphError, match="layers"):
        parse_entity_graph(document)

    document = _as_stored_v2(_load(name))
    document["entities"][0]["rotation"] = 0.0
    with pytest.raises(EntityGraphError, match="v2 artifact never carries"):
        parse_entity_graph(document)


@pytest.mark.parametrize("name", NAMES)
def test_a_v3_artifact_without_its_layer_table_is_refused(name: str) -> None:
    document = _load(name)
    del document["layers"]
    with pytest.raises(EntityGraphError, match="missing layers"):
        parse_entity_graph(document)


def test_every_v3_text_carries_its_rotation_and_alignment(basic_document: dict[str, Any]) -> None:
    required = (("TEXT", "rotation"), ("TEXT", "halign"), ("MTEXT", "rotation"), ("MTEXT", "attachment"))
    for dxftype, field in required:
        document = deepcopy(basic_document)
        del _first(document, "entities", type=dxftype)[field]
        with pytest.raises(EntityGraphError, match=f"missing {field}"):
            parse_entity_graph(document)


@pytest.mark.parametrize(
    ("dxftype", "field", "value", "why"),
    [
        ("TEXT", "rotation", 360.0, r"\[0, 360\)"),
        ("TEXT", "rotation", -90.0, r"\[0, 360\)"),
        ("TEXT", "halign", 6, "outside 0-5"),
        ("TEXT", "valign", 4, "outside 0-3"),
        ("MTEXT", "attachment", 0, "outside 1-9"),
        ("TEXT", "attachment", 1, "only an MTEXT"),
        ("MTEXT", "halign", 0, "as its attachment"),
        ("TEXT", "align_point", [0.0, 0.0], "aligned left on its baseline"),
        ("LINE", "rotation", 0.0, "only a text carries"),
        ("LINE", "override", "14'-2\"", "only a dimension"),
        ("LINE", "block", {}, "only an original block reference"),
    ],
)
def test_a_v3_fact_where_it_does_not_apply_or_out_of_range_is_refused(
    basic_document: dict[str, Any], dxftype: str, field: str, value: Any, why: str
) -> None:
    _first(basic_document, "entities", type=dxftype)[field] = value
    with pytest.raises(EntityGraphError, match=why):
        parse_entity_graph(basic_document)


def test_a_text_aligned_off_its_baseline_carries_the_point_that_places_it(
    basic_document: dict[str, Any],
) -> None:
    text = _first(basic_document, "entities", type="TEXT")
    text["halign"], text["valign"] = 1, 2
    with pytest.raises(EntityGraphError, match="missing align_point"):
        parse_entity_graph(basic_document)
    text["align_point"] = [1.0, 2.0]
    assert parse_entity_graph(basic_document).version == ENTITYGRAPH_VERSION


def test_every_v3_block_reference_carries_its_identity() -> None:
    document = _load("blocks")
    reference = _first(document, "entities", type="INSERT")
    block = deepcopy(reference["block"])
    del reference["block"]
    with pytest.raises(EntityGraphError, match="missing block"):
        parse_entity_graph(document)

    for broken, why in (
        ({**block, "scale": [-1.0, 1.0]}, "a mirror is `mirrored`"),
        ({**block, "rotation": 360.0}, r"\[0, 360\)"),
        ({**block, "definition_sha256": "A" * 64}, "64 lowercase hex"),
        ({**block, "via": "x"}, "closed set"),
        ({key: value for key, value in block.items() if key != "mirrored"}, "missing mirrored"),
    ):
        reference["block"] = broken
        with pytest.raises(EntityGraphError, match=why):
            parse_entity_graph(document)


def test_every_v3_block_attribute_carries_its_rotation_and_alignment() -> None:
    document = _load("blocks")
    assert document["block_attributes"], "the blocks fixture carries attributes"
    del document["block_attributes"][0]["valign"]
    with pytest.raises(EntityGraphError, match="missing valign"):
        parse_entity_graph(document)


def test_a_layer_record_is_closed_and_complete(basic_document: dict[str, Any]) -> None:
    layer = basic_document["layers"][0]
    layer["locked"] = True
    with pytest.raises(EntityGraphError, match="closed set"):
        parse_entity_graph(basic_document)
    del layer["locked"]
    del layer["plot"]
    with pytest.raises(EntityGraphError, match="missing plot"):
        parse_entity_graph(basic_document)


@pytest.mark.parametrize("name", NAMES)
def test_a_source_key_without_its_scheme_is_refused(name: str) -> None:
    document = deepcopy(_load(name))
    entities = document["entities"]
    assert entities, f"{name} carries no entity whose key could be stripped"
    entities[0]["key"] = entities[0]["key"].removeprefix(f"{SCHEME}:")
    with pytest.raises(EntityGraphError, match="key"):
        parse_entity_graph(document)


@pytest.mark.parametrize("name", NAMES)
def test_a_key_outside_the_closed_top_level_set_is_refused(name: str) -> None:
    document = _load(name)
    document["sheet_card"] = []
    with pytest.raises(EntityGraphError, match="closed set"):
        parse_entity_graph(document)


def test_derived_paint_must_name_an_original(basic_document: dict[str, Any]) -> None:
    basic_document["derived"] = [
        {
            "colour": {"rgb": [0, 0, 0], "source": "bylayer"},
            "layer": "0",
            "space": "model",
            "src": f"{SCHEME}:FFFFFFFF",
            "type": "LINE",
        }
    ]
    with pytest.raises(EntityGraphError, match="no original entity"):
        parse_entity_graph(basic_document)


def test_a_key_minted_twice_is_refused(basic_document: dict[str, Any]) -> None:
    entities = basic_document["entities"]
    assert len(entities) > 1, "one entity cannot show a key minted twice"
    entities[1]["key"] = entities[0]["key"]
    with pytest.raises(EntityGraphError, match="minted twice"):
        parse_entity_graph(basic_document)


def test_a_conversion_loss_on_a_counters_row_parses_and_must_be_a_tally(
    basic_document: dict[str, Any],
) -> None:
    """The counters' one additive key: optional, and a per-class count where it is there.

    A DXF ingest crosses no converter and writes no such key — every committed artifact here is one
    — so the mirror has to admit both the row without it and the row with it, exactly as the Zod
    mirror's `counts.optional()` does (L-CAD-05: one shape, not two tolerances).
    """
    counters = basic_document["counters"]
    assert counters, "no counters row for a conversion loss to stand on"
    assert "conversion_losses" not in counters[0], "a DXF ingest wrote a conversion's loss"

    counters[0]["conversion_losses"] = {"LWPOLYLINE": 12691}
    assert parse_entity_graph(basic_document).version == ENTITYGRAPH_VERSION

    counters[0]["conversion_losses"] = {"LWPOLYLINE": -1}
    with pytest.raises(EntityGraphError, match="conversion_losses"):
        parse_entity_graph(basic_document)


def test_an_unmapped_unit_must_carry_its_flag(basic_document: dict[str, Any]) -> None:
    # L-CAD-02: an unmapped $INSUNITS code reports null plus a flag, never "unitless".
    basic_document["insunits"] = {"code": 3, "unit": None, "unmapped": False}
    with pytest.raises(EntityGraphError, match="unmapped"):
        parse_entity_graph(basic_document)


def test_a_nullable_key_that_is_absent_is_refused_as_the_zod_mirror_refuses_it(
    basic_document: dict[str, Any],
) -> None:
    # `insunits.unit` and `layouts[].bbox` are nullable, not optional: the Zod mirror spells them
    # `.nullable()` inside a strict object, which demands the key and admits `null` as its value.
    # A document that drops the key is a different document, and both sides say so (L-CAD-05).
    document = deepcopy(basic_document)
    document["insunits"] = {"code": 3, "unmapped": True}
    with pytest.raises(EntityGraphError, match="missing unit"):
        parse_entity_graph(document)

    document = deepcopy(basic_document)
    layouts = document["layouts"]
    assert layouts, "no layout record whose bbox could be dropped"
    del layouts[0]["bbox"]
    with pytest.raises(EntityGraphError, match="missing bbox"):
        parse_entity_graph(document)


def test_a_nullable_key_spelled_null_is_admitted(basic_document: dict[str, Any]) -> None:
    # The other half of the same rule: `null` is the lawful spelling, and it parses.
    basic_document["insunits"] = {"code": 3, "unit": None, "unmapped": True}
    basic_document["layouts"][0]["bbox"] = None
    assert parse_entity_graph(basic_document).version == ENTITYGRAPH_VERSION


@pytest.fixture
def basic_document() -> dict[str, Any]:
    assert NAMES, "no committed artifact to mutate"
    return _load(NAMES[0])
