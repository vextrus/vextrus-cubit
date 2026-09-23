"""EntityGraph v3: how a drawing is WRITTEN travels with what it draws (L-CAD-05, I-415/b/c).

v2 carried a text's string, anchor and height and nothing about which way it runs, so a beam mark
written up the sheet read exactly like one written across it. v3 restates, as the entity states
them: a text's world rotation (counter-clockwise, [0, 360)) and its alignment; a block reference's
identity and placement; the layer table's visibility; and a dimension's override text. Nothing here
is derived or applied — what a turned mark or a frozen layer MEANS is a stage over the artifact.

The drawings are built here rather than committed: each is a question about one fact, authored by
this script (L-CAD-09), and the committed corpus is the roster the artifact contract names. The
fixture corpus's own census (F-RCC6-BNBC's 88 turned marks, F-RCC6 all square) is read in
`sanity/test_text_rotation_census.py`, beside the suite that already ingests those drawings once.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import ezdxf
import pytest
from ezdxf.enums import TextEntityAlignment

from corpus import artifact_path
from vextrus_cad import ENTITYGRAPH_VERSION, ingest_dxf, parse_entity_graph
from vextrus_cad import ingest as ingest_module
from vextrus_cad.ingest import ingest_document
from vextrus_cad.parameters import EXPLODE_DEPTH_CAP


def _artifact(doc: Any) -> dict[str, Any]:
    """The artifact of an in-memory drawing, put to the Python mirror before anything reads it."""
    artifact = ingest_document(doc)
    assert artifact["entitygraph_version"] == ENTITYGRAPH_VERSION
    parse_entity_graph(artifact)
    return artifact


def _through_a_file(doc: Any, tmp_path: Path) -> dict[str, Any]:
    """The artifact of a drawing written to DXF and read back the way an upload is (recover mode)."""
    path = tmp_path / "drawing.dxf"
    doc.saveas(path)
    artifact = ingest_dxf(path)
    parse_entity_graph(artifact)
    return artifact


def _by_text(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {record["text"]: record for record in records if "text" in record}


# ---------------------------------------------------------------------------------------- rotation


def test_a_turned_text_carries_its_world_rotation_counter_clockwise_and_normalised(tmp_path: Path) -> None:
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    msp.add_text("SQUARE", dxfattribs={"height": 1}).set_placement((0, 0))
    msp.add_text("UP", dxfattribs={"height": 1, "rotation": 90}).set_placement((10, 0))
    msp.add_text("DOWN", dxfattribs={"height": 1, "rotation": -90}).set_placement((20, 0))
    msp.add_text("WOUND", dxfattribs={"height": 1, "rotation": 450}).set_placement((30, 0))
    msp.add_text("HAIR", dxfattribs={"height": 1, "rotation": -1e-12}).set_placement((40, 0))

    texts = _by_text(_through_a_file(doc, tmp_path)["entities"])

    assert texts["SQUARE"]["rotation"] == 0.0
    assert texts["UP"]["rotation"] == 90.0
    assert texts["DOWN"]["rotation"] == 270.0, "clockwise 90 is counter-clockwise 270"
    assert texts["WOUND"]["rotation"] == 90.0, "a turn and a quarter is a quarter"
    assert texts["HAIR"]["rotation"] == 0.0, "a hair below a whole turn is no turn, never 360"
    # Orientation does not change the string or its anchor (T-TEXT-ROTATED).
    assert texts["UP"]["points"] == [[10.0, 0.0]]
    assert texts["UP"]["text"] == "UP"


def test_an_mtext_reads_its_rotation_through_its_text_direction(tmp_path: Path) -> None:
    """`text_direction` is a world vector that outranks group 50; `dxf.rotation` alone would read
    0 for an MTEXT a writer turned by its direction (the Edison set holds 151 such)."""
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    directed = msp.add_mtext("DIRECTED", dxfattribs={"char_height": 1, "insert": (0, 0)})
    directed.dxf.text_direction = (0, 1, 0)
    directed.dxf.rotation = 0  # stated too, and outranked
    msp.add_mtext("ANGLED", dxfattribs={"char_height": 1, "insert": (10, 0), "rotation": 45})
    msp.add_mtext("PLAIN", dxfattribs={"char_height": 1, "insert": (20, 0)})

    texts = _by_text(_through_a_file(doc, tmp_path)["entities"])

    assert texts["DIRECTED"]["rotation"] == 90.0
    assert texts["ANGLED"]["rotation"] == 45.0
    assert texts["PLAIN"]["rotation"] == 0.0


def test_an_aligned_text_runs_from_its_insert_to_its_alignment_point() -> None:
    """ALIGNED and FIT stretch the text between its two points whatever group 50 states."""
    doc = ezdxf.new("R2018")
    text = doc.modelspace().add_text("STRETCHED", dxfattribs={"height": 1, "rotation": 0})
    text.set_placement((0, 0), (10, 10), align=TextEntityAlignment.ALIGNED)

    record = _artifact(doc)["entities"][0]

    assert record["rotation"] == 45.0
    assert (record["halign"], record["valign"]) == (3, 0)
    assert record["align_point"] == [10.0, 10.0]


# --------------------------------------------------------------------------------------- alignment


def test_a_single_line_text_carries_its_alignment_and_the_point_that_places_it(tmp_path: Path) -> None:
    """A text aligned anywhere but left on its baseline is placed by its alignment point; a writer
    that recomputes the insert (AutoCAD does, ezdxf does not) leaves the two points apart."""
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    msp.add_text("LEFT", dxfattribs={"height": 1}).set_placement((0, 0))
    centred = msp.add_text("B25", dxfattribs={"height": 1, "rotation": 90})
    centred.set_placement((5, 5), align=TextEntityAlignment.MIDDLE_CENTER)
    centred.dxf.insert = (4.7, 3.9)  # the left baseline start a recomputing writer stores

    texts = _by_text(_through_a_file(doc, tmp_path)["entities"])

    assert (texts["LEFT"]["halign"], texts["LEFT"]["valign"]) == (0, 0)
    assert "align_point" not in texts["LEFT"], "a left-baseline text is placed by its insert"
    mark = texts["B25"]
    assert (mark["halign"], mark["valign"]) == (1, 2), "MIDDLE_CENTER is halign 1, valign 2"
    assert mark["align_point"] == [5.0, 5.0]
    assert mark["points"] == [[4.7, 3.9]], "the anchor stays the insert it always was"
    assert mark["rotation"] == 90.0


def test_an_mtext_carries_its_attachment_point_and_no_single_line_alignment() -> None:
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    msp.add_mtext("CENTRED", dxfattribs={"char_height": 1, "insert": (0, 0), "attachment_point": 5})
    msp.add_mtext("DEFAULT", dxfattribs={"char_height": 1, "insert": (10, 0)})

    texts = _by_text(_artifact(doc)["entities"])

    assert texts["CENTRED"]["attachment"] == 5
    assert texts["DEFAULT"]["attachment"] == 1
    for record in texts.values():
        assert not {"halign", "valign", "align_point"} & set(record)


def test_a_block_attribute_carries_its_rotation_and_alignment() -> None:
    doc = ezdxf.new("R2018")
    block = doc.blocks.new("TAG")
    block.add_circle((0, 0), 1)
    block.add_attdef("MARK", (0, 0), dxfattribs={"height": 0.5})
    reference = doc.modelspace().add_blockref("TAG", (100, 100))
    attrib = reference.add_attrib("MARK", "C4", (100, 100), dxfattribs={"height": 0.5, "rotation": 90})
    attrib.set_placement((100, 100), align=TextEntityAlignment.MIDDLE_CENTER)

    (attribute,) = _artifact(doc)["block_attributes"]

    assert attribute["text"] == "C4"
    assert attribute["rotation"] == 90.0
    assert (attribute["halign"], attribute["valign"]) == (1, 2)
    assert "align_point" not in attribute, "an attribute carries no anchor to read a point against"


# ---------------------------------------------------------------------- block references (INSERT)


def _symbol(doc: Any, name: str = "SYM", *, base: tuple[float, float] = (0, 0)) -> Any:
    block = doc.blocks.new(name, base_point=base)
    block.add_line((base[0], base[1]), (base[0] + 5, base[1]))
    block.add_text("AB", dxfattribs={"height": 1, "rotation": 30}).set_placement((base[0] + 2, base[1]))
    return block


def test_a_block_reference_carries_its_identity_and_one_canonical_placement() -> None:
    doc = ezdxf.new("R2018")
    _symbol(doc)
    msp = doc.modelspace()
    plain = msp.add_blockref("SYM", (100, 100))
    turned = msp.add_blockref("SYM", (200, 100), dxfattribs={"rotation": 90, "xscale": 2, "yscale": 3})
    mirrored_x = msp.add_blockref("SYM", (300, 100), dxfattribs={"xscale": -1})
    flipped = msp.add_blockref("SYM", (400, 100), dxfattribs={"extrusion": (0, 0, -1)})

    records = {record["key"]: record for record in _artifact(doc)["entities"]}
    references = {"plain": plain, "turned": turned, "mirrored_x": mirrored_x, "flipped": flipped}
    block = {
        label: records[f"DXF_HANDLE:{ref.dxf.handle.upper()}"]["block"] for label, ref in references.items()
    }

    def placed(label: str) -> tuple[float, list[float], bool]:
        return (block[label]["rotation"], block[label]["scale"], block[label]["mirrored"])

    assert block["plain"]["name"] == "SYM"
    assert block["plain"]["at"] == [100.0, 100.0]
    assert placed("plain") == (0.0, [1.0, 1.0], False)
    assert placed("turned") == (90.0, [2.0, 3.0], False)
    # x scale -1 is the block's x axis turned half a turn with its y axis reflected: one spelling.
    assert placed("mirrored_x") == (180.0, [1.0, 1.0], True)
    # A flipped extrusion is a mirror too, and its insert is an OCS point the world sees at -x.
    assert block["flipped"]["mirrored"] is True
    assert block["flipped"]["at"] == [-400.0, 100.0]
    digests = {entry["definition_sha256"] for entry in block.values()}
    assert len(digests) == 1 and None not in digests, "one block, one definition, however it is placed"


def test_the_text_of_a_mirrored_block_stands_and_turns_where_the_world_sees_it() -> None:
    """ezdxf explodes a mirrored reference's text with its extrusion flipped; its raw insert is then
    an OCS point on the far side of the y axis, and its group 50 the mirror image of its run."""
    doc = ezdxf.new("R2018")
    _symbol(doc)
    doc.modelspace().add_blockref("SYM", (100, 100), dxfattribs={"xscale": -1})

    (text,) = [paint for paint in _artifact(doc)["derived"] if paint["type"] == "TEXT"]

    assert text["points"] == [[98.0, 100.0]], "the block's (2, 0) mirrored in x and moved to (100, 100)"
    assert text["rotation"] == 150.0, "a 30° baseline mirrored in x runs at 150°"


def test_a_definition_digest_is_the_symbols_content_and_nothing_a_writer_varies() -> None:
    doc = ezdxf.new("R2018")
    _symbol(doc, "PASTE_1")
    renamed = doc.blocks.new("PASTE_2")
    # The same content under another name, on another layer and colour, written in the other order.
    elsewhere = {"height": 1, "rotation": 30, "layer": "X", "color": 3}
    renamed.add_text("AB", dxfattribs=elsewhere).set_placement((2, 0))
    renamed.add_line((0, 0), (5, 0), dxfattribs={"layer": "X", "color": 1})
    _symbol(doc, "MOVED_BASE", base=(50, 50))  # the same drawing about another base point
    other = doc.blocks.new("OTHER")
    other.add_line((0, 0), (6, 0))
    msp = doc.modelspace()
    for name in ("PASTE_1", "PASTE_2", "MOVED_BASE", "OTHER"):
        msp.add_blockref(name, (0, 0))

    digest = {
        record["block"]["name"]: record["block"]["definition_sha256"]
        for record in _artifact(doc)["entities"]
        if record["type"] == "INSERT"
    }

    assert digest["PASTE_1"] == digest["PASTE_2"] == digest["MOVED_BASE"]
    assert digest["OTHER"] != digest["PASTE_1"]


def test_a_nested_definition_is_read_by_its_own_digest_not_its_name() -> None:
    doc = ezdxf.new("R2018")
    for outer, inner in (("OUTER_A", "INNER_A"), ("OUTER_B", "INNER_B")):
        doc.blocks.new(inner).add_circle((0, 0), 1)
        doc.blocks.new(outer).add_blockref(inner, (3, 0), dxfattribs={"rotation": 90})
    msp = doc.modelspace()
    msp.add_blockref("OUTER_A", (0, 0))
    msp.add_blockref("OUTER_B", (10, 0))

    digests = [record["block"]["definition_sha256"] for record in _artifact(doc)["entities"]]

    assert digests[0] == digests[1] and digests[0] is not None


def test_a_definition_past_the_depth_cap_or_in_a_cycle_has_no_digest() -> None:
    """The same line past which its paint is not drawn (L-CAD-03); an answer that never depends on
    which reference asked first."""
    doc = ezdxf.new("R2018")
    chain = [f"LINK_{index:02d}" for index in range(EXPLODE_DEPTH_CAP + 1)]
    for index, name in enumerate(chain):
        block = doc.blocks.new(name)
        block.add_line((0, 0), (1, 0))
        if index + 1 < len(chain):
            block.add_blockref(chain[index + 1], (1, 0))
    looped_a, looped_b = doc.blocks.new("LOOP_A"), doc.blocks.new("LOOP_B")
    looped_a.add_blockref("LOOP_B", (0, 0))
    looped_b.add_blockref("LOOP_A", (0, 0))
    msp = doc.modelspace()
    msp.add_blockref(chain[1], (0, 0))  # asked first: a chain of exactly the cap's height
    msp.add_blockref(chain[0], (0, 0))  # one deeper than the cap
    msp.add_blockref("LOOP_A", (0, 0))

    digest = {
        record["block"]["name"]: record["block"]["definition_sha256"]
        for record in ingest_document(doc)["entities"]
        if record["type"] == "INSERT"
    }

    assert digest[chain[1]] is not None, f"{EXPLODE_DEPTH_CAP} deep is inside the cap"
    assert digest[chain[0]] is None, f"{EXPLODE_DEPTH_CAP + 1} deep is past it"
    assert digest["LOOP_A"] is None


def test_a_block_tree_is_read_once_per_definition_however_it_branches_or_nests() -> None:
    """Three references to the next block at every one of 40 levels is 3**39 paths and 40
    definitions: the walk reads the definitions. And 1,500 levels of nesting is no recursion to
    run out of — the walk is iterative."""
    doc = ezdxf.new("R2018")
    levels = 40
    for index in range(levels):
        block = doc.blocks.new(f"TREE_{index:02d}")
        block.add_line((0, 0), (1, 0))
        if index + 1 < levels:
            for offset in range(3):
                block.add_blockref(f"TREE_{index + 1:02d}", (offset, 0))
    chain = 1500
    for index in range(chain):
        block = doc.blocks.new(f"CHAIN_{index:04d}")
        if index + 1 < chain:
            block.add_blockref(f"CHAIN_{index + 1:04d}", (0, 0))

    extractor = ingest_module._Extractor(doc)

    assert extractor.definition("TREE_00") == (None, levels)
    assert extractor.definition(f"TREE_{levels - EXPLODE_DEPTH_CAP:02d}")[0] is not None
    assert extractor.definition("CHAIN_0000") == (None, chain)


def test_the_committed_blocks_fixture_carries_its_references_identity() -> None:
    """INSERT identity on the committed corpus: blocks.dxf's one reference, NEST_00, whose ten-deep
    chain is the fixture's explode-cap trip — so its definition has no digest either."""
    import json

    artifact = json.loads(artifact_path("blocks").read_text(encoding="utf-8"))
    (reference,) = [record for record in artifact["entities"] if record["type"] == "INSERT"]

    assert reference["block"] == {
        "name": "NEST_00",
        "definition_sha256": None,
        "at": [10.0, 10.0],
        "rotation": 0.0,
        "scale": [1.0, 1.0],
        "mirrored": False,
    }


# ------------------------------------------------------------------- layers and dimension overrides


def test_the_layer_table_travels_as_stated_visibility() -> None:
    doc = ezdxf.new("R2018")
    doc.layers.add("FROZEN").freeze()
    doc.layers.add("OFF").off()
    doc.layers.add("NOPLOT").dxf.plot = 0
    doc.modelspace().add_line((0, 0), (1, 0), dxfattribs={"layer": "FROZEN"})

    layers = {layer["name"]: layer for layer in _artifact(doc)["layers"]}

    assert layers["FROZEN"] == {"name": "FROZEN", "on": True, "frozen": True, "plot": True}
    assert layers["OFF"] == {"name": "OFF", "on": False, "frozen": False, "plot": True}
    assert layers["NOPLOT"] == {"name": "NOPLOT", "on": True, "frozen": False, "plot": False}
    assert layers["0"] == {"name": "0", "on": True, "frozen": False, "plot": True}


@pytest.mark.parametrize(
    ("stated", "carried"),
    [("", None), ("<>", None), ('<>"', '<>"'), ("14'-2\"", "14'-2\""), (" ", " ")],
    ids=["measured", "placeholder", "suffixed", "overridden", "suppressed"],
)
def test_a_dimension_carries_the_text_its_drawing_states(stated: str, carried: str | None) -> None:
    """Group 1 as stated: empty and a bare `<>` are the measurement, which the dimension's derived
    paint already carries; anything else — a suffix around `<>`, a figure the designer wrote over the
    geometry (T-DIM-OVERRIDE), a blank that suppresses the text — is the drawing's own words."""
    doc = ezdxf.new("R2018", setup=True)
    dimension = doc.modelspace().add_linear_dim(base=(0, 5), p1=(0, 0), p2=(10, 0))
    dimension.render()
    # Stated after the render: ezdxf's own renderer cannot lay out a blank override, and what is
    # judged here is what the extractor reads off the entity, not how ezdxf paints it.
    dimension.dimension.dxf.text = stated

    (original,) = _artifact(doc)["entities"]

    assert original["type"] == "DIMENSION"
    assert original.get("override") == carried
