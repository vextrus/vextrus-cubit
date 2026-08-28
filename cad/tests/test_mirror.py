"""The Python half of "both sides parse committed fixtures" (L-CAD-05).

`src/core/entitygraph/schema.ts` is the same vocabulary in Zod and parses these very files. A
mirror that only accepts is not a mirror, so the refusals are proved too: an artifact below the v2
floor and a source key that drops its scheme are both rejected by name (L-CAD-02).
"""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

import pytest

from corpus import artifact_names, artifact_path
from vextrus_cad import ENTITYGRAPH_VERSION, SCHEME, EntityGraphError, parse_entity_graph

NAMES = artifact_names()


def _load(name: str) -> dict[str, Any]:
    return json.loads(artifact_path(name).read_text(encoding="utf-8"))


def test_the_corpus_is_not_empty() -> None:
    # Every rule below is parameterised over the corpus; an empty one would prove nothing.
    assert NAMES, "no committed artifact was found beside the DXF corpus"


@pytest.mark.parametrize("name", NAMES)
def test_every_committed_artifact_parses(name: str) -> None:
    graph = parse_entity_graph(_load(name))
    assert graph.version == ENTITYGRAPH_VERSION


@pytest.mark.parametrize("name", NAMES)
def test_an_artifact_below_the_version_floor_is_refused(name: str) -> None:
    document = _load(name)
    document["entitygraph_version"] = ENTITYGRAPH_VERSION - 1
    with pytest.raises(EntityGraphError, match="entitygraph_version"):
        parse_entity_graph(document)


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


def test_an_unmapped_unit_must_carry_its_flag(basic_document: dict[str, Any]) -> None:
    # L-CAD-02: an unmapped $INSUNITS code reports null plus a flag, never "unitless".
    basic_document["insunits"] = {"code": 3, "unit": None, "unmapped": False}
    with pytest.raises(EntityGraphError, match="unmapped"):
        parse_entity_graph(basic_document)


@pytest.fixture
def basic_document() -> dict[str, Any]:
    assert NAMES, "no committed artifact to mutate"
    return _load(NAMES[0])
