"""The python half of the EntityGraph mirror (L-CAD-05).

"EntityGraph is versioned (v2 as the floor) and mirrored in Zod; both sides parse committed
fixtures." The committed corpus lives at `fixtures/entitygraph/` in the repository root —
outside `cad/`, because it is read by both runtimes and belongs to neither. The node half
of these same claims is `src/core/entitygraph/__tests__/mirror.test.ts`, and the two files
are deliberately the same shape: a mirror where one side is the lenient one is not a mirror.

Each refusal below bends one field of a committed artifact. A graph written out longhand
would drift from the corpus the moment the vocabulary grows, and would then prove that the
schema refuses a shape the extractor never emits.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from cubit_cad.schema import KEY_SCHEMES, EntityGraphError, parse_entity_graph

#: cad/tests/test_schema.py → cad/tests → cad → the repository root.
REPO = Path(__file__).parent.parent.parent
VALID = REPO / "fixtures" / "entitygraph"
MALFORMED = VALID / "malformed"

Graph = dict[str, Any]


def _json_files(directory: Path) -> list[Path]:
    return sorted(directory.glob("*.json"))


def _read(path: Path) -> Graph:
    return json.loads(path.read_text(encoding="utf-8"))


def _bend(name: str) -> Graph:
    """A deep copy of a committed artifact, to be broken one field at a time."""
    return copy.deepcopy(_read(VALID / name))


@pytest.mark.parametrize("path", _json_files(VALID), ids=lambda p: p.name)
def test_every_committed_fixture_parses(path: Path) -> None:
    graph = parse_entity_graph(_read(path))
    assert graph["version"] == 2
    assert graph["layouts"]


@pytest.mark.parametrize("path", _json_files(MALFORMED), ids=lambda p: p.name)
def test_every_malformed_fixture_is_refused(path: Path) -> None:
    with pytest.raises(EntityGraphError):
        parse_entity_graph(_read(path))


def test_the_corpus_is_not_empty() -> None:
    """Both parametrised sets above would be vacuously green over an empty directory."""
    assert len(_json_files(VALID)) >= 5
    assert len(_json_files(MALFORMED)) >= 3


def test_the_scheme_set_is_the_one_l_cad_02_closes() -> None:
    assert set(KEY_SCHEMES) == {"DXF_HANDLE", "PDF_OBJECT", "RASTER_TRACE"}


def test_v2_is_the_floor() -> None:
    graph = _bend("basic.json")
    graph["version"] = 3
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_an_original_without_a_key_is_refused() -> None:
    graph = _bend("basic.json")
    del graph["entities"][0]["key"]
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_a_key_outside_the_closed_scheme_set_is_refused() -> None:
    graph = _bend("basic.json")
    graph["entities"][0]["key"] = "SVG_NODE:8D"
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_derived_paint_mints_no_key_and_an_original_claims_no_parent() -> None:
    """L-CAD-03: "The atom a source key names is one EntityGraph original entity"."""
    with_key = _bend("inserts.json")
    with_key["derived"][0]["key"] = with_key["derived"][0]["src"]
    with pytest.raises(EntityGraphError):
        parse_entity_graph(with_key)

    with_src = _bend("inserts.json")
    with_src["entities"][0]["src"] = with_src["entities"][0]["key"]
    with pytest.raises(EntityGraphError):
        parse_entity_graph(with_src)


def test_derived_paint_without_a_parent_is_refused() -> None:
    graph = _bend("inserts.json")
    del graph["derived"][0]["src"]
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_a_colour_resolved_by_no_named_rule_is_refused() -> None:
    """L-CAD-05 names four rules; an ACI index crossing the seam is not one of them."""
    graph = _bend("basic.json")
    graph["entities"][0]["colour"]["source"] = "aci_index"
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_an_unresolved_colour_is_refused() -> None:
    graph = _bend("basic.json")
    graph["entities"][0]["colour"]["rgb"] = "BYLAYER"
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


@pytest.mark.parametrize(
    ("fixture", "unit"),
    [("basic.json", None), ("units-unmapped.json", "unitless")],
)
def test_the_unit_and_the_flag_are_one_statement(fixture: str, unit: str | None) -> None:
    """L-CAD-02: "an unmapped code reports null + a flag, never unitless"."""
    graph = _bend(fixture)
    graph["units"]["unit"] = unit
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_a_layout_bbox_is_four_numbers() -> None:
    graph = _bend("basic.json")
    graph["layouts"][0]["bbox"] = graph["layouts"][0]["bbox"][:3]
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_a_layout_kind_outside_the_closed_set_is_refused() -> None:
    graph = _bend("basic.json")
    graph["layouts"][0]["kind"] = "sheet"
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_the_counters_block_is_required() -> None:
    """R-TO-001 shows the counters as named facts; a graph without them shows nothing."""
    graph = _bend("basic.json")
    del graph["counters"]
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_a_negative_counter_is_refused() -> None:
    graph = _bend("basic.json")
    graph["counters"]["per_layout"]["Model"]["strays_rejected"] = -1
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_an_attribute_without_a_tag_is_refused() -> None:
    graph = _bend("inserts.json")
    graph["attributes"][0]["tag"] = ""
    with pytest.raises(EntityGraphError):
        parse_entity_graph(graph)


def test_the_refusal_names_where_it_failed() -> None:
    """A refusal a reader cannot act on is a refusal that gets worked around."""
    graph = _bend("basic.json")
    graph["entities"][0]["key"] = "SVG_NODE:8D"
    with pytest.raises(EntityGraphError) as raised:
        parse_entity_graph(graph)
    assert "entities[0].key" in str(raised.value)


def test_something_that_is_not_a_graph_at_all_is_refused() -> None:
    for value in (None, [], "entitygraph", 2):
        with pytest.raises(EntityGraphError):
            parse_entity_graph(value)
