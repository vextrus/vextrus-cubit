"""The ReadArtefact and its versioned JSON: the summary the contracts fix, and raw placement values."""

import json
import math
from typing import Any

import pytest

from engine.read.artefact import SCHEMA, VERSION, Block, Entity, Format, Insert, ReadArtefact, Text

SHA = "0f" * 32


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
            ),
            Entity("B1", "LINE", "0", "B0", {"start": [0.0, 0.0, 0.0], "end": [10.0, 0.0, 0.0]}),
        ],
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

    assert (data["schema"], data["version"]) == (SCHEMA, VERSION) == ("engine.read.artefact", 1)


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
        ("version", 2, "version"),
        ("schema", "engine.read.other", "schema"),
        ("extra", 1, "unknown fields"),
    ],
)
def test_another_version_or_shape_is_refused(where: str, value: object, message: str) -> None:
    data = {**artefact().to_json(), where: value}

    with pytest.raises(ValueError, match=message):
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
