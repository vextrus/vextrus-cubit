"""The DXF extractor, judged over the committed corpus (L-CAD-01 … L-CAD-05, R-TO-001).

Every claim here is made against `cad/tests/fixtures/*.dxf` — the same bytes the node side
and the held-out suites read — because the facts the Bible states about this seam are
relations between a file and its graph, and a graph read on its own terms satisfies none of
them.

The graphs are built once per session and shared. `ingest_dxf` is pure with respect to the
file, so a second run would only cost time; the one place a second run is the point (the
determinism claim of L-CAD-02) asks for it explicitly.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from cubit_cad.colour import BY_BLOCK, BY_LAYER, EXPLICIT, TRUE_COLOUR
from cubit_cad.geometry import shoelace_area
from cubit_cad.ingest import INSUNITS, SCHEME, ingest_dxf
from cubit_cad.params import (
    DERIVED_ENTITY_BUDGET,
    EXPLODE_DEPTH_CAP,
    FLATTEN_POINT_CAP,
    FLATTEN_TOLERANCE,
    parameter_set_hash,
)
from cubit_cad.schema import parse_entity_graph

FIXTURES = Path(__file__).parent / "fixtures"

#: The lane root — `python -m cubit_cad` is invoked from here, as the contract spells it.
CAD = Path(__file__).parent.parent

Graph = dict[str, Any]


@pytest.fixture(scope="session")
def graphs() -> dict[str, Graph]:
    """Every committed drawing, ingested once."""
    return {path.stem: ingest_dxf(path) for path in sorted(FIXTURES.glob("*.dxf"))}


@pytest.fixture(scope="session")
def basic(graphs: dict[str, Graph]) -> Graph:
    return graphs["basic"]


@pytest.fixture(scope="session")
def inserts(graphs: dict[str, Graph]) -> Graph:
    return graphs["inserts"]


def _handles_in_entities_section(path: Path) -> set[str]:
    """The handles the file's own ENTITIES section wrote, read from the ASCII DXF."""
    tags = path.read_text(encoding="utf-8", errors="replace").splitlines()
    handles: set[str] = set()
    section: str | None = None
    for index in range(0, len(tags) - 1, 2):
        code, value = tags[index].strip(), tags[index + 1].strip()
        if code == "0" and value == "SECTION":
            section = None
        elif code == "2" and section is None:
            section = value
        elif code == "0" and value == "ENDSEC":
            section = None
        elif code == "5" and section == "ENTITIES":
            handles.add(value.upper())
    return handles


# -- L-CAD-01, L-CAD-02: one shot, keys minted from the file ---------------------------


def test_every_graph_is_a_valid_entity_graph_v2(graphs: dict[str, Graph]) -> None:
    for name, graph in graphs.items():
        assert parse_entity_graph(graph)["version"] == 2, name


def test_keys_are_the_files_own_handles(basic: Graph) -> None:
    """L-CAD-02: `DXF_HANDLE` is "the file's own handle" — never a counter or an index."""
    minted = _handles_in_entities_section(FIXTURES / "basic.dxf")
    assert minted
    for entity in basic["entities"]:
        scheme, _, handle = entity["key"].partition(":")
        assert scheme == SCHEME
        assert handle in minted, entity["key"]


def test_each_key_is_minted_once(graphs: dict[str, Graph]) -> None:
    """L-CAD-03: the atom a key names is one original entity, so no two share a key."""
    for name, graph in graphs.items():
        keys = [entity["key"] for entity in graph["entities"]]
        assert len(set(keys)) == len(keys), name


def test_extractor_identity_is_pinned(basic: Graph) -> None:
    """L-CAD-02: "the ingest record pins extractor identity" — version and parameter hash."""
    import ezdxf

    extractor = basic["ingest"]["extractor"]
    assert extractor["name"] == "ezdxf"
    assert extractor["version"] == ezdxf.__version__
    assert extractor["parameter_set_hash"] == parameter_set_hash()
    # The parameter set is a property of the extractor, not of the drawing.
    assert extractor["parameter_set_hash"] != basic["ingest"]["file_sha256"]


def test_the_file_digest_is_over_the_input_bytes(basic: Graph) -> None:
    digest = hashlib.sha256((FIXTURES / "basic.dxf").read_bytes()).hexdigest()
    assert basic["ingest"]["file_sha256"] == digest


def test_ingest_is_deterministic(basic: Graph) -> None:
    """L-CAD-02: a key is scoped to (file bytes, extractor identity) and to nothing else."""
    again = ingest_dxf(FIXTURES / "basic.dxf")
    assert sorted(e["key"] for e in again["entities"]) == sorted(
        e["key"] for e in basic["entities"]
    )
    assert json.dumps(again, sort_keys=True) == json.dumps(basic, sort_keys=True)


def test_the_pinned_parameter_set_is_the_one_the_contract_names() -> None:
    assert EXPLODE_DEPTH_CAP == 8
    assert DERIVED_ENTITY_BUDGET == 200_000
    assert FLATTEN_POINT_CAP == 4096
    assert str(FLATTEN_TOLERANCE) == "0.01"


# -- L-CAD-03: derived paint never reaches the extractor --------------------------------


def test_originals_are_never_derived_paint(inserts: Graph) -> None:
    assert any(entity["type"] == "INSERT" for entity in inserts["entities"])
    for entity in inserts["entities"]:
        assert "src" not in entity
        assert entity["type"] not in ("ATTRIB", "ATTDEF")


def test_block_paint_lands_in_derived_with_its_parent_key(inserts: Graph) -> None:
    """L-CAD-03: "every synthesised entity carries `src` (its parent instance's key)"."""
    insert_keys = {e["key"] for e in inserts["entities"] if e["type"] == "INSERT"}
    original_keys = {e["key"] for e in inserts["entities"]}
    assert inserts["derived"]
    assert any(item["src"] in insert_keys for item in inserts["derived"])
    for item in inserts["derived"]:
        # Every parent is an original this graph names — block paint points at its INSERT,
        # a measurement at its DIMENSION, and nothing points outside the graph.
        assert item["src"] in original_keys
        assert "key" not in item, "derived paint is not an atom and mints no key"


def test_nesting_stops_at_the_depth_cap_and_says_so(inserts: Graph) -> None:
    """L-CAD-03: "a cap that trips says so (`explode_truncated` + per-type loss counters)"."""
    counters = inserts["counters"]["per_layout"]["Model"]
    assert counters["explode_truncated"] is True
    assert counters["explode_losses"], "a truncation with no per-type losses names nothing"
    assert all(count > 0 for count in counters["explode_losses"].values())
    # NEST_0 … NEST_11 is twelve deep; the cap is eight, so the deepest instances are lost
    # rather than painted — the graph is short of paint and admits it by name.
    assert "LINE" in counters["explode_losses"]


def test_block_attributes_collect_separately(inserts: Graph) -> None:
    """L-CAD-03: "Block attributes collect separately"."""
    insert_keys = {e["key"] for e in inserts["entities"] if e["type"] == "INSERT"}
    tags = {attribute["tag"]: attribute for attribute in inserts["attributes"]}
    assert set(tags) == {"ROOM", "AREA"}
    assert tags["ROOM"]["text"] == "R-101"
    for attribute in inserts["attributes"]:
        assert attribute["src"] in insert_keys
    # Separately means separately: the text is in no original and in no derived record.
    written = {attribute["text"] for attribute in inserts["attributes"]}
    for entity in [*inserts["entities"], *inserts["derived"]]:
        assert entity.get("text") not in written


def test_a_dimension_measurement_is_derived_text(inserts: Graph) -> None:
    """L-CAD-03: "a dimension's measurement text is a derived text entity"."""
    dimensions = [e for e in inserts["entities"] if e["type"] == "DIMENSION"]
    assert dimensions
    keys = {dimension["key"] for dimension in dimensions}
    measurements = [
        item for item in inserts["derived"] if item["src"] in keys and item["type"] == "TEXT"
    ]
    assert measurements
    # The dimension spans (0,-50) to (60,-50): sixty drawing units, measured not guessed.
    assert any(item["text"] == "60" for item in measurements)
    assert all(item["height"] > 0 for item in measurements)


def test_derived_text_carries_the_world_height(inserts: Graph) -> None:
    """L-CAD-05: "text carries world height" — the block is scaled 3x, the glyphs with it."""
    labels = [item for item in inserts["derived"] if item.get("text") == "BLOCK LABEL"]
    assert labels
    assert all(label["height"] == 6.0 for label in labels)


# -- L-CAD-05: colour resolved server-side ----------------------------------------------


def test_every_colour_is_resolved_by_one_of_the_four_rules(graphs: dict[str, Graph]) -> None:
    rules = {TRUE_COLOUR, EXPLICIT, BY_LAYER, BY_BLOCK}
    for name, graph in graphs.items():
        for entity in [*graph["entities"], *graph["derived"]]:
            colour = entity["colour"]
            assert colour["source"] in rules, name
            assert len(colour["rgb"]) == 7 and colour["rgb"].startswith("#"), name


def test_the_palette_block_states_each_rule(inserts: Graph) -> None:
    """The PALETTE block holds one line per rule; the resolution happens here, once."""
    sources = {item["colour"]["source"] for item in inserts["derived"] if item["type"] == "LINE"}
    assert {TRUE_COLOUR, EXPLICIT, BY_LAYER, BY_BLOCK} <= sources


def test_byblock_paint_inherits_the_instance_colour(inserts: Graph) -> None:
    """BYBLOCK is the block reference's colour, which is why it is resolved with the doc open."""
    palette = next(
        entity
        for entity in inserts["entities"]
        if entity["type"] == "INSERT" and entity["geometry"]["name"] == "PALETTE"
    )
    byblock = [
        item
        for item in inserts["derived"]
        if item["src"] == palette["key"] and item["colour"]["source"] == BY_BLOCK
    ]
    assert byblock
    assert all(item["colour"]["rgb"] == palette["colour"]["rgb"] for item in byblock)


def test_a_layer_true_colour_beats_its_aci(basic: Graph) -> None:
    """The ROOF layer carries an RGB; BYLAYER on it resolves to that RGB, not to a palette."""
    roof = [entity for entity in basic["entities"] if entity["layer"] == "ROOF"]
    assert roof
    for entity in roof:
        assert entity["colour"]["source"] == BY_LAYER
        assert entity["colour"]["rgb"] == "#123456"


# -- L-CAD-05: extents, layouts, areas, caps, space markers ------------------------------


def test_a_stray_is_rejected_and_counted(graphs: dict[str, Graph]) -> None:
    """L-CAD-05: "robust extents with stray-entity rejection … the count recorded"."""
    graph = graphs["layouts-strays"]
    model = graph["counters"]["per_layout"]["Model"]
    assert model["strays_rejected"] == 1
    bbox = next(layout for layout in graph["layouts"] if layout["name"] == "Model")["bbox"]
    # The stray sits at 10^6; an extents that kept it would put the whole plan in a corner.
    assert bbox[2] < 1_000.0
    assert bbox[3] < 1_000.0
    # The stray is still an original entity: rejection is about extents, not about the graph.
    assert any(
        entity["geometry"].get("center") == [1_000_000.0, 1_000_000.0]
        for entity in graph["entities"]
    )


def test_a_small_layout_rejects_nothing(basic: Graph) -> None:
    """Rejection is a claim about a population; six entities are not a population."""
    assert basic["counters"]["per_layout"]["Model"]["strays_rejected"] == 0


def test_paper_layouts_are_inventoried_with_their_own_bbox(graphs: dict[str, Graph]) -> None:
    """L-CAD-05: "paper layouts get their own bbox … a layout inventory"."""
    graph = graphs["layouts-strays"]
    inventory = {layout["name"]: layout for layout in graph["layouts"]}
    assert inventory["Model"]["kind"] == "model"
    assert inventory["Sheet1"]["kind"] == "paper"
    assert inventory["Sheet1"]["bbox"] == [0.0, 0.0, 420.0, 297.0]
    # "content-less layouts dropped and counted": Sheet2 is empty and is not inventoried.
    assert "Sheet2" not in inventory
    assert graph["counters"]["layouts_dropped"] >= 1


def test_space_markers_name_the_layout_each_entity_lives_in(graphs: dict[str, Graph]) -> None:
    """L-CAD-05: "a space marker per entity (model space or named layout)"."""
    graph = graphs["layouts-strays"]
    spaces = {entity["space"] for entity in graph["entities"]}
    assert spaces == {"model", "Sheet1"}
    for entity in graph["entities"]:
        assert entity["space"] in {"model", *(layout["name"] for layout in graph["layouts"])}


def test_a_closed_polyline_carries_its_shoelace_area(basic: Graph) -> None:
    """L-CAD-05: "closed polylines carry shoelace area"."""
    polylines = [entity for entity in basic["entities"] if entity["type"] == "LWPOLYLINE"]
    assert polylines
    for polyline in polylines:
        assert polyline["closed"] is True
        # The ROOF rectangle is 5000 x 3000, in native drawing units.
        assert polyline["area"] == 15_000_000.0
        assert polyline["area"] == shoelace_area(polyline["geometry"]["points"])


def test_an_open_polyline_carries_no_area(inserts: Graph) -> None:
    for entity in [*inserts["entities"], *inserts["derived"]]:
        if entity.get("closed") is False:
            assert "area" not in entity


def test_the_flatten_cap_trips_and_is_counted(graphs: dict[str, Graph]) -> None:
    """L-CAD-05: "curves flatten at fixed tolerance with a point cap whose trip is counted"."""
    graph = graphs["flatten-cap"]
    assert graph["counters"]["per_layout"]["Model"]["flatten_capped"] == 1
    circles = [entity for entity in graph["entities"] if entity["type"] == "CIRCLE"]
    assert len(circles) == 1
    assert len(circles[0]["geometry"]["points"]) == FLATTEN_POINT_CAP
    # A capped flattening is an open fan, so it states no area: a shoelace over it would be
    # a number about a polyline nobody drew.
    assert "area" not in circles[0]
    # The circle's own parameters survive the cap — they are what a re-flattening reads.
    assert circles[0]["geometry"]["radius"] == 10_000_000.0


def test_an_uncapped_curve_is_not_counted(basic: Graph) -> None:
    """The control: without it, a counter stuck at 1 would pass the test above."""
    assert basic["counters"]["per_layout"]["Model"]["flatten_capped"] == 0
    circles = [entity for entity in basic["entities"] if entity["type"] == "CIRCLE"]
    assert circles and len(circles[0]["geometry"]["points"]) < FLATTEN_POINT_CAP


# -- L-CAD-02: $INSUNITS through the closed map ------------------------------------------


def test_the_closed_unit_map_is_the_clause() -> None:
    """L-CAD-02, verbatim: "0 unitless · 1 inch · 2 foot · 4 mm · 5 cm · 6 m"."""
    assert INSUNITS == {0: "unitless", 1: "inch", 2: "foot", 4: "mm", 5: "cm", 6: "m"}


@pytest.mark.parametrize(("code", "unit"), sorted(INSUNITS.items()))
def test_a_mapped_code_reports_its_unit(tmp_path: Path, code: int, unit: str) -> None:
    graph = ingest_dxf(_with_insunits(tmp_path, code))
    assert graph["units"] == {
        "insunits_code": code,
        "unit": unit,
        "insunits_unmapped": False,
    }


def test_an_unmapped_code_reports_null_and_a_flag(graphs: dict[str, Graph]) -> None:
    """L-CAD-02: "an unmapped code reports null + a flag, never unitless"."""
    units = graphs["units-unmapped"]["units"]
    assert units["insunits_code"] == 3
    assert units["unit"] is None
    assert units["insunits_unmapped"] is True


def _with_insunits(tmp_path: Path, code: int) -> Path:
    """basic.dxf with one header variable rewritten, and nothing else touched."""
    lines = (FIXTURES / "basic.dxf").read_text(encoding="utf-8").splitlines(keepends=True)
    for index, line in enumerate(lines):
        if line.strip() == "$INSUNITS":
            lines[index + 2] = f"{code:>6}\n"
            break
    else:  # pragma: no cover - the corpus writes the variable
        raise AssertionError("basic.dxf declares no $INSUNITS")
    path = tmp_path / f"insunits-{code}.dxf"
    path.write_text("".join(lines), encoding="utf-8")
    return path


def test_coordinates_stay_in_native_drawing_units(tmp_path: Path) -> None:
    """L-CAD-02: "Coordinates stay in native drawing units" — the seam converts nothing."""
    as_foot = ingest_dxf(_with_insunits(tmp_path, 2))
    as_mm = ingest_dxf(_with_insunits(tmp_path, 4))
    assert as_foot["units"]["unit"] == "foot"
    assert as_mm["units"]["unit"] == "mm"
    geometry = [(e["key"], e["geometry"]) for e in as_foot["entities"]]
    assert geometry == [(e["key"], e["geometry"]) for e in as_mm["entities"]]
    assert as_foot["layouts"] == as_mm["layouts"]


# -- SEAM-CAD: the one-shot process, and its loud failures -------------------------------


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "cubit_cad", *args],
        cwd=CAD,
        capture_output=True,
        text=True,
        check=False,
    )


def test_the_cli_writes_one_artifact_and_stops(tmp_path: Path) -> None:
    """SEAM-CAD: `ingestDrawing(bytes, format) → EntityGraph` via the `cad/` CLI."""
    out = tmp_path / "graph.json"
    ran = _run("ingest", str(FIXTURES / "basic.dxf"), "--out", str(out))
    assert ran.returncode == 0, ran.stderr
    graph = parse_entity_graph(json.loads(out.read_text(encoding="utf-8")))
    assert graph["version"] == 2
    # Stateless: nothing but the artifact is left behind, and stdout stays quiet.
    assert ran.stdout == ""


@pytest.mark.parametrize(
    ("label", "args"),
    [
        ("a path that does not exist", ("ingest", "tests/fixtures/no-such-drawing.dxf")),
        ("a file that is not a DXF", ("ingest", "SENTENCE")),
        ("a format this extractor does not read", ("ingest", "BASIC", "--format", "dwg")),
    ],
)
def test_a_refusal_is_loud_and_leaves_nothing(
    tmp_path: Path, label: str, args: tuple[str, ...]
) -> None:
    """L-CAD-04: "loud failures" — non-zero, a reason on stderr, no partial artifact."""
    sentence = tmp_path / "unreadable.dxf"
    sentence.write_text("this is not a DXF file, it is a sentence\n", encoding="utf-8")
    resolved = [
        {"SENTENCE": str(sentence), "BASIC": str(FIXTURES / "basic.dxf")}.get(arg, arg)
        for arg in args
    ]
    out = tmp_path / "refused.json"
    ran = _run(*resolved, "--out", str(out))
    assert ran.returncode != 0, label
    assert ran.stderr.strip() != "", label
    assert not out.exists(), label


def test_the_control_run_succeeds(tmp_path: Path) -> None:
    """Without this, the refusals above would pass over a CLI that refuses everything."""
    out = tmp_path / "control.json"
    assert _run("ingest", str(FIXTURES / "basic.dxf"), "--out", str(out)).returncode == 0
    assert out.exists()
