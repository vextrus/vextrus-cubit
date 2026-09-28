"""What the reader takes from `dwgread`'s JSON, on hand-written JSON in its shape (no toolchain needed).

The shapes are LibreDWG 0.14's as seen on the synthetic fixtures (handles `[code, size, value]`,
references `[code, size, value, absolute]`, a null reference `[0, 0]`). The same repairs run on real
DWGs in test_read.py.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from engine.read.libredwg import dwgread


def ref(value: int) -> list[int]:
    return [5, 1, value, value]


def own(value: int) -> list[int]:
    return [0, 1, value]


NULL = [0, 0]


def drawing(*entities: dict[str, Any], model_space: list[int] | None = None) -> dict[str, Any]:
    """A file with model space (0x1F), block TB (0x30) holding an ATTDEF, and the given entities."""
    listed = (
        model_space
        if model_space is not None
        else [e["handle"][2] for e in entities if "entmode" not in e]
    )
    return {
        "FILEHEADER": {"version": "AC1032"},
        "HEADER": {"INSUNITS": 4, "BLOCK_RECORD_MSPACE": ref(0x1F), "BLOCK_RECORD_PSPACE": ref(0x1B)},
        "OBJECTS": [
            {"object": "LAYER", "handle": own(0x10), "name": "0"},
            {"object": "LAYER", "handle": own(0x11), "name": "TITLE-BLOCK"},
            {"object": "STYLE", "handle": own(0x12), "name": "Standard", "font_file": "txt"},
            {"object": "STYLE", "handle": own(0x13), "name": "TITLE", "font_file": "romans.shx"},
            {
                "object": "BLOCK_HEADER",
                "handle": own(0x1F),
                "name": "*Model_Space",
                "base_pt": [0.0, 0.0, 0.0],
                "block_entity": ref(0x20),
                "entities": [ref(h) for h in listed],
            },
            {"entity": "BLOCK", "handle": own(0x20), "name": "*Model_Space"},
            {
                "object": "LAYOUT",
                "handle": own(0x21),
                "layout_name": "Model",
                "tab_order": 0,
                "block_header": ref(0x1F),
            },
            {
                "object": "BLOCK_HEADER",
                "handle": own(0x1B),
                "name": "*Paper_Space",
                "block_entity": ref(0x1C),
            },
            {"entity": "BLOCK", "handle": own(0x1C), "name": "*Paper_Space"},
            {
                "object": "LAYOUT",
                "handle": own(0x1D),
                "layout_name": "Layout1",
                "tab_order": 1,
                "block_header": ref(0x1B),
            },
            {
                "object": "BLOCK_HEADER",
                "handle": own(0x30),
                "name": "TB",
                "base_pt": [1.0, 2.0, 0.0],
                "block_entity": ref(0x31),
                "entities": [ref(0x32)],
            },
            {"entity": "BLOCK", "handle": own(0x31), "name": "TB"},
            {
                "entity": "ATTDEF",
                "handle": own(0x32),
                "ownerhandle": [4, 1, 0x30, 0x30],
                "layer": ref(0x10),
                "tag": "SHEET_NO",
                "height": 5.0,
                "ins_pt": [10.0, 25.0],
                "style": ref(0x13),
            },
            *entities,
        ],
    }


def insert(handle: int, attribs: list[int]) -> dict[str, Any]:
    return {
        "entity": "INSERT",
        "handle": own(handle),
        "layer": ref(0x11),
        "ins_pt": [200.0, 0.0, 0.0],
        "scale": [2.0, -2.0, 1.0],
        "rotation": 0.5235987755983,
        "extrusion": [0.0, 0.0, -1.0],
        "block_header": ref(0x30),
        "attribs": [ref(a) for a in attribs],
    }


def attrib(handle: int, owner: int, tag: str, style: list[int]) -> dict[str, Any]:
    return {
        "entity": "ATTRIB",
        "handle": own(handle),
        "ownerhandle": [4, 1, owner, owner],
        "entmode": 0,
        "layer": ref(0x10),
        "tag": tag,
        "text_value": "A-01",
        "height": 5.0,
        "ins_pt": [10.0, 25.0],
        "alignment_pt": [10.0, 25.0],
        "style": style,
    }


def test_an_attrib_with_no_style_takes_its_attdefs() -> None:
    decoded = dwgread.decode(drawing(insert(0x40, [0x41]), attrib(0x41, 0x40, "SHEET_NO", NULL)))

    text = decoded.texts["41"]
    assert (text.style, text.style_source, text.font) == ("TITLE", "attdef", "romans.shx")
    assert text.owner == "40"
    assert decoded.notes == ({"code": "engine.read.attrib_style_from_attdef", "params": {"count": 1}},)


def test_an_attrib_that_has_its_style_keeps_it() -> None:
    decoded = dwgread.decode(drawing(insert(0x40, [0x41]), attrib(0x41, 0x40, "SHEET_NO", ref(0x12))))

    assert (decoded.texts["41"].style, decoded.texts["41"].style_source) == ("Standard", "own")
    assert decoded.notes == ()


def test_an_attrib_with_no_style_and_no_attdef_of_its_tag_says_so() -> None:
    decoded = dwgread.decode(drawing(insert(0x40, [0x41]), attrib(0x41, 0x40, "OTHER_TAG", NULL)))

    assert (decoded.texts["41"].style, decoded.texts["41"].style_source) == (None, "none")
    assert decoded.notes == ()


def test_an_insert_keeps_its_placement_as_stored() -> None:
    decoded = dwgread.decode(drawing(insert(0x40, [])))

    placed = decoded.inserts["40"]
    assert (placed.block, placed.name, placed.layer, placed.owner) == ("30", "TB", "TITLE-BLOCK", "1F")
    assert placed.point == (200.0, 0.0, 0.0)
    assert placed.scale == (2.0, -2.0, 1.0)
    assert placed.rotation_radians == 0.5235987755983
    assert placed.extrusion == (0.0, 0.0, -1.0)


def text_entity(handle: int, **fields: Any) -> dict[str, Any]:
    return {"entity": "TEXT", "handle": own(handle), "layer": ref(0x10), "style": ref(0x12), **fields}


def test_aligned_text_is_drawn_from_its_start_point_and_counted() -> None:
    centred = text_entity(
        0x50,
        text_value="CENTRED",
        ins_pt=[100.0, 0.0],
        alignment_pt=[100.0, 0.0],
        horiz_alignment=1,
        vert_alignment=2,
        elevation=3.0,
    )
    left = text_entity(0x51, text_value="LEFT", ins_pt=[0.0, 0.0])

    decoded = dwgread.decode(drawing(centred, left))

    text = decoded.texts["50"]
    assert (text.position, text.alignment_point) == ((100.0, 0.0, 3.0), (100.0, 0.0, 3.0))
    assert (text.halign, text.valign) == (1, 2)
    assert decoded.notes == ({"code": "engine.read.aligned_text_from_start", "params": {"count": 1}},)


def test_mtext_keeps_its_direction_vector_and_a_missing_height_is_none() -> None:
    mtext = {
        "entity": "MTEXT",
        "handle": own(0x60),
        "layer": ref(0x10),
        "style": ref(0x12),
        "text": "FIRST\nSECOND\\PTHIRD",
        "text_height": 0.0,
        "ins_pt": [1.0, 2.0, 0.0],
        "x_axis_dir": [0.0, 1.0, 0.0],
        "rect_width": 40.0,
        "attachment": 7,
    }

    text = dwgread.decode(drawing(mtext)).texts["60"]

    assert text.text == "FIRST\nSECOND\\PTHIRD"
    assert text.height is None
    assert text.direction == (0.0, 1.0, 0.0)
    assert (text.rotation_radians, text.attachment, text.width) == (0.0, 7, 40.0)


def test_structure_the_layouts_in_tab_order_blocks_and_counts() -> None:
    decoded = dwgread.decode(drawing(text_entity(0x50, text_value="X", ins_pt=[0.0, 0.0])))

    assert decoded.version == "AC1032"
    assert decoded.insunits == 4
    assert decoded.layouts == ("Model", "Layout1")
    blocks = {block.handle: block for block in decoded.blocks}
    assert (blocks["1F"].layout, blocks["1F"].entities) == ("Model", ("50",))
    assert (blocks["30"].name, blocks["30"].base_point, blocks["30"].layout) == (
        "TB",
        (1.0, 2.0, 0.0),
        None,
    )
    assert [p.handle for p in decoded.entities] == ["32", "50"]


def test_an_entity_no_record_lists_is_placed_by_its_owner_or_its_space() -> None:
    # R2000's records list no entities: the owner handle, else the entity mode, places it.
    in_paper = {"entity": "LINE", "handle": own(0x70), "layer": ref(0x10), "entmode": 1}
    in_model = {"entity": "LINE", "handle": own(0x71), "layer": ref(0x10), "entmode": 2}

    decoded = dwgread.decode(drawing(in_paper, in_model, model_space=[]))

    owners = {p.handle: p.owner for p in decoded.entities}
    assert (owners["70"], owners["71"], owners["32"]) == ("1B", "1F", "30")


@pytest.mark.parametrize(
    ("json_type", "dxf"),
    [
        ("POLYLINE_2D", "POLYLINE"),
        ("POLYLINE_PFACE", "POLYLINE"),
        ("DIMENSION_LINEAR", "DIMENSION"),
        ("3DFACE", "3DFACE"),
        ("_3DSOLID", "3DSOLID"),
        ("LWPOLYLINE", "LWPOLYLINE"),
    ],
)
def test_types_are_named_as_dxf_names_them(json_type: str, dxf: str) -> None:
    assert dwgread.dxf_type(json_type) == dxf


def test_vertices_and_markers_are_not_entities_of_their_own() -> None:
    entities = [
        {"entity": "POLYLINE_2D", "handle": own(0x80), "layer": ref(0x10)},
        {
            "entity": "VERTEX_2D",
            "handle": own(0x81),
            "layer": ref(0x10),
            "ownerhandle": [4, 1, 0x80, 0x80],
        },
        {"entity": "SEQEND", "handle": own(0x82), "layer": ref(0x10), "ownerhandle": [4, 1, 0x80, 0x80]},
    ]

    decoded = dwgread.decode(drawing(*entities, model_space=[0x80]))

    assert [(p.handle, p.type) for p in decoded.entities] == [("32", "ATTDEF"), ("80", "POLYLINE")]


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ([0, 1, 141], "8D"),
        ([5, 1, 166, 166], "A6"),
        ([4, 1, 2, 0x1F], "1F"),
        ([0, 0], None),
        (None, None),
    ],
)
def test_handles_are_written_as_the_file_writes_them(value: object, expected: str | None) -> None:
    assert dwgread.handle(value) == expected


def test_loading_keeps_only_what_is_read(tmp_path: Path) -> None:
    line = {
        "entity": "LINE",
        "handle": own(0x90),
        "layer": ref(0x10),
        "start": [0.0, 0.0, 0.0],
        "color": {"index": 256},
    }
    path = tmp_path / "file.json"
    path.write_text(json.dumps(drawing(line)))

    loaded = dwgread.load(path)

    assert [o for o in loaded["OBJECTS"] if o.get("entity") == "LINE"] == [
        {"entity": "LINE", "handle": [0, 1, 0x90], "layer": [5, 1, 0x10, 0x10]}
    ]
    assert dwgread.decode(loaded) == dwgread.decode(drawing(line))
