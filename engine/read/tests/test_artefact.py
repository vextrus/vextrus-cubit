"""The ReadArtefact and its versioned JSON: the summary the contracts fix, and raw placement values."""

import json
import math
from typing import Any

import pytest

from engine.read.artefact import (
    SCHEMA,
    VERSION,
    Block,
    Entity,
    Format,
    Insert,
    ReadArtefact,
    Text,
    TextStyle,
)

SHA = "0f" * 32
STYLES = (
    TextStyle("C1", "Standard", None, 1.0, 0.0, "txt", None, shape=False),
    TextStyle("C2", "Title", 3.7, 0.8, 0.2617993877991, "romans.shx", "bigfont.shx", shape=False),
    TextStyle("C3", "", None, 1.0, 0.0, "ltypeshp.shx", None, shape=True),  # a shape file's entry
)


def artefact() -> ReadArtefact:
    return ReadArtefact.build(
        source_sha256=SHA,
        source_name="S-01 R0.dwg",
        format=Format("dwg", "AC1032"),
        reader="libredwg",
        reader_version="0.14",
        layouts=["Model", "Sheet A"],
        insunits=4,
        notes=[{"code": "engine.read.attrib_style_from_attdef", "params": {"count": 1}}],
        blocks=[
            Block("1F", "*Model_Space", (0.0, 0.0, 0.0), "Model", ("A1", "A2", "A3")),
            Block("B0", "TITLE", (1.0, 2.0, 0.0), None, ("B1",)),
        ],
        entities=[
            Entity("A1", "LINE", "WALL", "1F", {"start": [0.0, 0.0, 0.0], "end": [100.0, 0.0, 0.0]}),
            Insert(
                handle="A2",
                type="INSERT",
                layer="0",
                owner="1F",
                block="B0",
                name="TITLE",
                point=(200.0, 0.0, 0.0),
                scale=(2.0, -2.0, 1.0),
                rotation_radians=math.pi / 6,
                extrusion=(0.0, 0.0, -1.0),
                attribs=("A4",),
            ),
            Text(
                handle="A3",
                type="MTEXT",
                layer="TXT",
                owner="1F",
                text="line one\nline two",
                style="Standard",
                style_source="own",
                font="txt",
                bigfont=None,
                height=None,
                position=(10.0, 20.0, 0.0),
                alignment_point=None,
                halign=0,
                valign=0,
                rotation_radians=0.0,
                direction=(0.0, 1.0, 0.0),
                width=3.0,
                attachment=1,
                tag=None,
                extrusion=(0.0, 0.0, 1.0),
                style_handle="C1",
            ),
            Text(
                handle="A4",
                type="ATTRIB",
                layer="0",
                owner="A2",
                text="S-01",
                style="Title",
                style_source="attdef",
                font="romans.shx",
                bigfont=None,
                height=2.0,
                position=(-202.7, -0.7, 0.0),
                alignment_point=(-202.7, -0.7, 0.0),
                halign=1,
                valign=2,
                rotation_radians=2.6,
                direction=None,
                width=1.0,
                attachment=None,
                tag="SHEET_NO",
                extrusion=(0.0, 0.0, 1.0),
                style_handle="C2",
            ),
            Entity("B1", "LINE", "0", "B0", {"start": [0.0, 0.0, 0.0], "end": [10.0, 0.0, 0.0]}),
        ],
        styles=STYLES,
    )


def test_the_summary_carries_what_the_contract_fixes() -> None:
    summary = artefact().to_json()["summary"]

    assert summary == {
        "source_sha256": SHA,
        "source_name": "S-01 R0.dwg",
        "format": {"kind": "dwg", "version": "AC1032"},
        "reader": "libredwg",
        "reader_version": "0.14",
        "entity_counts": {"ATTRIB": 1, "INSERT": 1, "LINE": 2, "MTEXT": 1},
        "layer_counts": {"0": 3, "TXT": 1, "WALL": 1},
        "layouts": ["Model", "Sheet A"],
        "insunits": 4,
        "notes": [{"code": "engine.read.attrib_style_from_attdef", "params": {"count": 1}}],
    }


def test_the_json_names_its_schema_and_version() -> None:
    data = artefact().to_json()

    assert (data["schema"], data["version"]) == (SCHEMA, VERSION) == ("engine.read.artefact", 3)


def test_an_artefact_survives_json_text_unchanged() -> None:
    text = json.dumps(artefact().to_json())

    assert ReadArtefact.from_json(json.loads(text)) == artefact()


def test_placement_stays_raw_a_mirrored_insert_keeps_its_extrusion() -> None:
    insert = artefact().to_json()["entities"][1]

    assert insert["kind"] == "insert"
    assert insert["extrusion"] == [0.0, 0.0, -1.0]
    assert insert["scale"] == [2.0, -2.0, 1.0]
    assert insert["rotation_radians"] == pytest.approx(0.5235987755983)


def test_an_mtext_keeps_no_height_as_none_and_its_direction_vector() -> None:
    mtext = artefact().to_json()["entities"][2]

    assert mtext["height"] is None
    assert mtext["direction"] == [0.0, 1.0, 0.0]
    assert mtext["text"] == "line one\nline two"


@pytest.mark.parametrize(
    ("where", "value", "message"),
    [
        ("version", 1, "version"),  # 04's, which carried no style table (#82)
        ("version", 2, "version"),  # #82's, which carried no layout's paper units (#87)
        ("version", 4, "version"),
        ("schema", "engine.read.other", "schema"),
        ("extra", 1, "unknown fields"),
    ],
)
def test_another_version_or_shape_is_refused(where: str, value: object, message: str) -> None:
    data = {**artefact().to_json(), where: value}

    with pytest.raises(ValueError, match=message):
        ReadArtefact.from_json(data)


def test_a_layouts_paper_units_survive_json_and_only_mm_or_inches_are_read() -> None:
    data = artefact().to_json()
    data["blocks"][0]["paper_mm_per_unit"] = 25.4

    assert ReadArtefact.from_json(data).blocks[data["blocks"][0]["handle"]].paper_mm_per_unit == 25.4
    for wrong in (0.0, -1.0, 1e9, "25.4", True, float("nan")):
        data["blocks"][0]["paper_mm_per_unit"] = wrong
        with pytest.raises(ValueError, match="paper units"):
            ReadArtefact.from_json(data)


def with_entity(change: dict[str, Any], index: int = 2) -> dict[str, Any]:
    data = artefact().to_json()
    data["entities"][index] = {**data["entities"][index], **change}
    return data


@pytest.mark.parametrize(
    "change",
    [
        {"handle": "a3"},
        {"owner": None},
        {"position": [1.0, 2.0]},
        {"height": "2.5"},
        {"style_source": "guessed"},
        {"kind": "shape"},
        {"direction": [0, 1, True]},
    ],
)
def test_a_malformed_entity_is_refused(change: dict[str, Any]) -> None:
    with pytest.raises(ValueError, match="read artefact"):
        ReadArtefact.from_json(with_entity(change))


def test_summary_counts_that_disagree_with_the_body_are_refused() -> None:
    data = artefact().to_json()
    data["summary"]["entity_counts"]["LINE"] = 3

    with pytest.raises(ValueError, match="entity_counts"):
        ReadArtefact.from_json(data)


def test_a_repeated_handle_is_refused() -> None:
    data = artefact().to_json()
    data["entities"].append(data["entities"][0])
    data["summary"]["entity_counts"]["LINE"] = 3
    data["summary"]["layer_counts"]["WALL"] = 2

    with pytest.raises(ValueError, match=r"repeated|counts"):
        ReadArtefact.from_json(data)


# -- the text style table (#82) ---------------------------------------------------------------------


def test_the_style_table_is_in_the_body_beside_the_blocks_and_texts_name_their_style_by_handle() -> None:
    data = artefact().to_json()

    assert "styles" not in data["summary"]  # the summary is the contract's fixed list
    assert data["styles"][1] == {
        "handle": "C2",
        "name": "Title",
        "fixed_height": 3.7,
        "width_factor": 0.8,
        "oblique_radians": 0.2617993877991,
        "font": "romans.shx",
        "bigfont": "bigfont.shx",
        "shape": False,
    }
    assert data["styles"][2]["shape"] is True
    assert [e.get("style_handle") for e in data["entities"] if e["kind"] == "text"] == ["C1", "C2"]
    assert artefact().styles["C2"].fixed_height == 3.7


def test_an_artefact_built_without_styles_has_an_empty_table() -> None:
    """Every constructor written before #82 still builds: the table and a text's handle default."""
    text = artefact().entities["A3"]
    assert isinstance(text, Text)
    plain = Text(**{**text.__dict__, "style_handle": None})
    bare = ReadArtefact.build(
        source_sha256=SHA,
        source_name="bare.dwg",
        format=Format("dwg", "AC1032"),
        reader="libredwg",
        reader_version="0.14",
        layouts=["Model"],
        insunits=4,
        notes=[],
        blocks=[Block("1F", "*Model_Space", (0.0, 0.0, 0.0), "Model", ("A3",))],
        entities=[plain],
    )

    assert bare.styles == {}
    assert ReadArtefact(bare.summary, bare.blocks, bare.entities) == bare
    assert ReadArtefact.from_json(json.loads(json.dumps(bare.to_json()))) == bare


def test_a_style_handle_the_table_does_not_hold_is_refused() -> None:
    with pytest.raises(ValueError, match=r"text A3's style handle 'C9' names no style"):
        ReadArtefact.from_json(with_entity({"style_handle": "C9"}))


def test_a_repeated_style_handle_is_refused() -> None:
    data = artefact().to_json()
    data["styles"].append({**data["styles"][1], "name": "Other"})

    with pytest.raises(ValueError, match="a style handle is repeated"):
        ReadArtefact.from_json(data)


def with_style(change: dict[str, Any]) -> dict[str, Any]:
    data = artefact().to_json()
    data["styles"][1] = {**data["styles"][1], **change}
    return data


@pytest.mark.parametrize("key", ["fixed_height", "width_factor"])
@pytest.mark.parametrize(
    "value", ["NaN", "Infinity", "-Infinity", "0", "-3.7", '"3.7"', "[3.7]", "true", "1" + "0" * 400]
)
def test_a_style_height_or_width_that_is_no_finite_positive_number_is_refused(
    key: str, value: str
) -> None:
    with pytest.raises(ValueError, match=rf"read artefact style C2: {key} must be"):
        ReadArtefact.from_json(stored_with(key, value))


def stored_with(key: str, value: str) -> dict[str, Any]:
    """The artefact's JSON text with style C2's `key` written as `value`, read back as a stored
    artefact is: Python's json.loads accepts NaN and Infinity."""
    text = json.dumps(with_style({key: "MARK"})).replace('"MARK"', value)
    data: dict[str, Any] = json.loads(text)
    return data


@pytest.mark.parametrize("value", ["NaN", "Infinity", '"0.26"', "true", "1" + "0" * 400])
def test_an_oblique_angle_that_is_no_finite_number_is_refused(value: str) -> None:
    with pytest.raises(ValueError, match=r"read artefact style C2: oblique_radians must be"):
        ReadArtefact.from_json(stored_with("oblique_radians", value))


@pytest.mark.parametrize(
    "change",
    [
        {"handle": "c2"},
        {"name": None},
        {"font": 3},
        {"shape": 1},
        {"extra": 1},
    ],
)
def test_a_malformed_style_is_refused(change: dict[str, Any]) -> None:
    with pytest.raises(ValueError, match="read artefact"):
        ReadArtefact.from_json(with_style(change))


def test_a_style_with_no_fixed_height_keeps_none() -> None:
    data = with_style({"fixed_height": None, "width_factor": None, "oblique_radians": None})

    style = ReadArtefact.from_json(data).styles["C2"]

    assert (style.fixed_height, style.width_factor, style.oblique_radians) == (None, None, None)
