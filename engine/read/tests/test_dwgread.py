"""What the reader takes from `dwgread`'s JSON, on hand-written JSON in its shape (no toolchain needed).

The shapes are LibreDWG 0.14's as seen on the synthetic fixtures (handles `[code, size, value]`,
references `[code, size, value, absolute]`, a null reference `[0, 0]`). The same repairs run on real
DWGs in test_read.py.
"""

import io
import json
import random
from pathlib import Path
from typing import Any

import pytest

from engine.read.artefact import Entity, Format, Insert, PlotSettings, ReadArtefact, Text, TextStyle
from engine.read.errors import ReadError
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

    with path.open("rb") as stream:
        loaded = dwgread.load(stream)

    assert [o for o in loaded["OBJECTS"] if o.get("entity") == "LINE"] == [
        {"entity": "LINE", "handle": [0, 1, 0x90], "layer": [5, 1, 0x10, 0x10]}
    ]
    assert dwgread.decode(loaded) == dwgread.decode(drawing(line))


def test_an_attdefs_text_is_its_default_value() -> None:
    data = drawing()
    (attdef,) = [o for o in data["OBJECTS"] if o.get("entity") == "ATTDEF"]
    attdef["default_value"] = "S-101"

    assert dwgread.decode(data).texts["32"].text == "S-101"


def test_a_file_whose_records_list_objects_dwgread_lost_is_refused() -> None:
    # A damaged file: dwgread exits 0 and says SUCCESS, yet decodes almost nothing.
    data = drawing(model_space=[0x90, 0x91])

    with pytest.raises(ReadError) as raised:
        dwgread.decode(data)

    assert raised.value.message == {"code": "engine.read.objects_missing", "params": {"count": 2}}


def test_two_entities_with_one_handle_are_refused() -> None:
    twice = [{"entity": "LINE", "handle": own(0x90), "layer": ref(0x10)} for _ in range(2)]

    with pytest.raises(ValueError, match="handle"):
        dwgread.decode(drawing(*twice))


def test_without_record_lists_blocks_and_inserts_hold_what_names_them_as_owner() -> None:
    # R2000's records and inserts keep no lists: the owner handles give them.
    data = drawing(insert(0x40, []), attrib(0x41, 0x40, "SHEET_NO", NULL))
    for item in data["OBJECTS"]:
        item.pop("entities", None)
        item.pop("attribs", None)
        if item.get("entity") == "INSERT":
            item["entmode"] = 2

    decoded = dwgread.decode(data)

    blocks = {block.handle: block for block in decoded.blocks}
    assert (blocks["30"].entities, blocks["1F"].entities) == (("32",), ("40",))
    assert decoded.inserts["40"].attribs == ("41",)
    assert (decoded.texts["41"].style, decoded.texts["41"].style_source) == ("TITLE", "attdef")


def test_a_layer_the_file_does_not_hold_is_empty_and_counted() -> None:
    stray = {"entity": "LINE", "handle": own(0x90), "layer": ref(0x99)}

    decoded = dwgread.decode(drawing(stray))

    assert {p.handle: p.layer for p in decoded.entities}["90"] == ""
    assert decoded.notes == ({"code": "engine.read.layer_unresolved", "params": {"count": 1}},)


# -- the text style table (#82) ---------------------------------------------------------------------


def style(handle: int, name: object, **fields: Any) -> dict[str, Any]:
    """A STYLE as LibreDWG 0.14 writes it (measured on the text_style_height fixture, 29 Sep 2026)."""
    return {
        "object": "STYLE",
        "handle": own(handle),
        "name": name,
        "is_shape": 0,
        "text_size": 0.0,
        "width_factor": 1.0,
        "oblique_angle": 0.0,
        "font_file": "romans.shx",
        "bigfont_file": "",
        **fields,
    }


def with_styles(*styles: dict[str, Any], entities: tuple[dict[str, Any], ...] = ()) -> dict[str, Any]:
    data = drawing(*entities)
    data["OBJECTS"].extend(styles)
    return data


def styles_of(decoded: dwgread.Decoded) -> dict[str, TextStyle]:
    return {s.handle: s for s in decoded.styles}


def test_the_style_table_carries_every_style_as_stored_shape_files_marked() -> None:
    fixed = style(
        0x14,
        "FIXED",
        text_size=3.7,
        width_factor=0.8,
        oblique_angle=0.26179938779915,
        bigfont_file="bigfont.shx",
    )
    shape = style(0x15, "", is_shape=1, font_file="ltypeshp.shx")

    decoded = dwgread.decode(with_styles(fixed, shape))

    assert decoded.styles[2:] == (
        TextStyle("14", "FIXED", 3.7, 0.8, 0.26179938779915, "romans.shx", "bigfont.shx", shape=False),
        TextStyle("15", "", None, 1.0, 0.0, "ltypeshp.shx", None, shape=True),
    )
    assert [s.name for s in decoded.styles[:2]] == ["Standard", "TITLE"]  # drawing()'s, in file order


def test_a_text_names_its_style_by_handle_and_a_repaired_attrib_names_its_attdefs() -> None:
    decoded = dwgread.decode(
        drawing(
            insert(0x40, [0x41, 0x42]),
            attrib(0x41, 0x40, "SHEET_NO", NULL),
            attrib(0x42, 0x40, "SHEET_NO", ref(0x12)),
            text_entity(0x50, text_value="X", ins_pt=[0.0, 0.0]),
        )
    )

    found = {h: (t.style, t.style_source, t.style_handle) for h, t in decoded.texts.items()}
    assert found["50"] == ("Standard", "own", "12")
    assert found["32"] == ("TITLE", "own", "13")  # the ATTDEF
    assert found["41"] == ("TITLE", "attdef", "13")  # its null style taken from the ATTDEF
    assert found["42"] == ("Standard", "own", "12")  # an ATTRIB that keeps its own


NAN, INF = float("nan"), float("inf")


@pytest.mark.parametrize("key", ["text_size", "width_factor"])
@pytest.mark.parametrize("value", [NAN, INF, -INF, -3.7, 0.0, 0, "3.7", [3.7], True, None, 10**400])
def test_a_style_size_that_is_no_finite_positive_number_is_none_and_never_fails_the_read(
    key: str, value: object
) -> None:
    decoded = dwgread.decode(with_styles(style(0x14, "ODD", **{key: value})))

    found = styles_of(decoded)["14"]
    assert (found.fixed_height if key == "text_size" else found.width_factor) is None


@pytest.mark.parametrize("key", ["text_size", "width_factor"])
def test_a_huge_but_finite_style_size_is_kept(key: str) -> None:
    found = styles_of(dwgread.decode(with_styles(style(0x14, "HUGE", **{key: 1e308}))))["14"]

    assert (found.fixed_height if key == "text_size" else found.width_factor) == 1e308


@pytest.mark.parametrize(("value", "expected"), [(NAN, None), (INF, None), ("0.2", None), (True, None),
                                                 (-0.2, -0.2), (0.0, 0.0)])  # fmt: skip
def test_an_oblique_angle_is_kept_only_when_finite(value: object, expected: float | None) -> None:
    found = styles_of(dwgread.decode(with_styles(style(0x14, "ODD", oblique_angle=value))))["14"]

    assert found.oblique_radians == expected


def test_nan_and_infinity_in_dwgreads_json_text_are_read_as_none(tmp_path: Path) -> None:
    path = tmp_path / "file.json"
    path.write_text(json.dumps(with_styles(style(0x14, "ODD", text_size=NAN, width_factor=INF))))
    assert "NaN" in path.read_text()

    with path.open("rb") as stream:
        found = styles_of(dwgread.decode(dwgread.load(stream)))["14"]

    assert (found.fixed_height, found.width_factor) == (None, None)


@pytest.mark.parametrize(
    ("reference", "what"),
    [
        (ref(0x99), "nothing"),
        (ref(0x10), "a LAYER"),
        (ref(0x30), "a BLOCK_HEADER"),
        (NULL, "a null reference"),
        ([5, 1, -4, -4], "a negative handle"),
        ("13", "a string"),
    ],
)
def test_a_style_reference_that_names_no_style_gives_no_style_and_never_fails(
    reference: object, what: str
) -> None:
    decoded = dwgread.decode(drawing(text_entity(0x50, text_value="X", style=reference)))

    text = decoded.texts["50"]
    found = (text.style, text.style_source, text.style_handle, text.font)
    assert found == (None, "none", None, None), what


def test_a_style_with_an_empty_or_missing_name_is_named_by_its_handle() -> None:
    nameless = style(0x14, "")
    unnamed = {k: v for k, v in style(0x15, "").items() if k != "name"}
    odd = style(0x16, ["not", "a", "name"])
    texts = [
        text_entity(0x50 + i, text_value="X", style=ref(h)) for i, h in enumerate((0x14, 0x15, 0x16))
    ]

    decoded = dwgread.decode(with_styles(nameless, unnamed, odd, entities=tuple(texts)))

    assert [(t.style, t.style_handle) for t in decoded.texts.values() if t.type == "TEXT"] == [
        ("", "14"),
        ("", "15"),
        ("", "16"),
    ]
    assert [s.name for s in decoded.styles[2:]] == ["", "", ""]


@pytest.mark.parametrize("value", [NAN, 10**400, "x"])
def test_an_object_given_an_entitys_handle_never_lends_it_its_values(value: object) -> None:
    """The refuter's case (29 Sep 2026): a STYLE given a TEXT's handle, after it in the file, was read
    as the text, and a STYLE now keeps `width_factor`, a TEXT's key too (NaN broke the round trip, an
    integer no float holds escaped `read` uncaught). Each entity is read from its own item."""
    text = text_entity(0x50, text_value="MINE", ins_pt=[1.0, 2.0], width_factor=0.9, height=2.0)
    clashes = (
        style(0x50, "CLASH", width_factor=value, text_size=value),
        style(0x40, "CLASH", width_factor=value),
    )
    data = with_styles(*clashes, entities=(insert(0x40, []), text))

    decoded = dwgread.decode(data)

    found = decoded.texts["50"]
    assert (found.text, found.width, found.height, found.position) == ("MINE", 0.9, 2.0, (1.0, 2.0, 0.0))
    assert (decoded.inserts["40"].block, decoded.inserts["40"].point) == ("30", (200.0, 0.0, 0.0))


def test_an_object_given_a_block_entitys_handle_never_renames_its_block() -> None:
    """The review's case (round 1): a STYLE given a BLOCK entity's handle, after it, renamed its block
    and every insert of it. The BLOCK entity's own name is read (paper space's differs from its
    record's here, as a second paper space's does)."""
    data = with_styles(
        style(0x20, "CLASH"), style(0x1C, "CLASH"), style(0x31, "CLASH"), entities=(insert(0x40, []),)
    )
    (paper,) = [o for o in data["OBJECTS"] if o.get("entity") == "BLOCK" and o["name"] == "*Paper_Space"]
    paper["name"] = "*Paper_Space0"

    decoded = dwgread.decode(data)

    blocks = {b.handle: b.name for b in decoded.blocks}
    assert (blocks["1F"], blocks["1B"], blocks["30"]) == ("*Model_Space", "*Paper_Space0", "TB")
    assert decoded.inserts["40"].name == "TB"


def test_an_entity_given_a_styles_handle_never_hides_the_style() -> None:
    """The mirror of the case above: a LINE given a STYLE's handle, after it, took the STYLE out of
    the table, so the text on that style had none. Objects are read from object items only."""
    data = drawing(text_entity(0x50, text_value="T", style=ref(0x13)))
    data["OBJECTS"].append({"entity": "LINE", "handle": own(0x13), "layer": ref(0x10), "entmode": 2})

    decoded = dwgread.decode(data)

    assert "13" in styles_of(decoded)
    assert (decoded.texts["50"].style, decoded.texts["50"].style_handle) == ("TITLE", "13")


def test_an_object_given_a_lost_entitys_handle_does_not_hide_the_loss() -> None:
    """The review's case (round 1): a record lists an entity dwgread lost, and an object holds its
    handle; the loss is still refused, not read as the object."""
    data = drawing(model_space=[0x90])
    data["OBJECTS"].append(style(0x90, "CLASH"))

    with pytest.raises(ReadError) as raised:
        dwgread.decode(data)

    assert raised.value.message == {"code": "engine.read.objects_missing", "params": {"count": 1}}


HOSTILE: list[object] = [
    None, "x", "", "3.5", [], {}, [1], True, False, 0, -1, 1, 0.0, -0.0, 1e-320, 5e-324, 1e308, NAN, INF,
    -INF, 10**400, -(10**400), 2**53 + 1, "\ud800", "a\x00b", "romans.shx",
]  # fmt: skip
STYLE_KEYS = [
    "name",
    "text_size",
    "width_factor",
    "oblique_angle",
    "font_file",
    "bigfont_file",
    "is_shape",
]


def artefact_of(decoded: dwgread.Decoded) -> ReadArtefact:
    """The artefact `libredwg.read` builds from `decoded` (with no geometry)."""
    entities: list[Text | Insert | Entity] = []
    for p in decoded.entities:
        found = decoded.texts.get(p.handle) or decoded.inserts.get(p.handle)
        entities.append(found or Entity(p.handle, p.type, p.layer, p.owner, {}))
    return ReadArtefact.build(
        source_sha256="0" * 64,
        source_name="fuzz.dwg",
        format=Format("dwg", decoded.version),
        reader="libredwg",
        reader_version="0.14",
        layouts=decoded.layouts,
        insunits=decoded.insunits,
        notes=decoded.notes,
        blocks=decoded.blocks,
        entities=entities,
        styles=decoded.styles,
    )


def test_hostile_style_values_never_fail_the_read_and_the_artefact_survives_its_json() -> None:
    """The refuter's fuzz (29 Sep 2026), bounded and seeded: every STYLE key given each hostile value,
    each key missing, and 300 random STYLEs, each with a text or an ATTRIB naming it. `decode` never
    raises, the table never holds NaN or an infinity, and the artefact survives its JSON text."""
    cases: list[dict[str, Any]] = []
    for key in STYLE_KEYS:
        for value in HOSTILE:
            cases.append({**style(0x14, "S"), key: value})
        cases.append({k: v for k, v in style(0x14, "S").items() if k != key})
    chosen = random.Random(82)
    for _ in range(300):
        odd = style(chosen.randint(0x14, 0x60), chosen.choice([*HOSTILE, "N"]))
        odd.update(
            {k: chosen.choice(HOSTILE) for k in chosen.sample(STYLE_KEYS[1:], chosen.randint(0, 6))}
        )
        cases.append(odd)

    for number, odd in enumerate(cases):
        at = ref(odd["handle"][2])
        for data in (
            with_styles(odd, entities=(text_entity(0x50, text_value="T", style=at),)),
            with_styles(odd, entities=(insert(0x40, [0x41]), attrib(0x41, 0x40, "SHEET_NO", NULL))),
        ):
            artefact = artefact_of(dwgread.decode(data))
            json.dumps(artefact.to_json()["styles"], allow_nan=False)  # raises on NaN or an infinity
            stored = json.dumps(artefact.to_json())
            assert ReadArtefact.from_json(json.loads(stored)) == artefact, number


def test_two_styles_with_one_name_stay_two_and_each_text_names_its_own() -> None:
    small = style(0x14, "NOTES", text_size=1.8)
    large = style(0x15, "NOTES", text_size=5.0)
    texts = (
        text_entity(0x50, text_value="SMALL", style=ref(0x14)),
        text_entity(0x51, text_value="LARGE", style=ref(0x15)),
    )

    decoded = dwgread.decode(with_styles(small, large, entities=texts))

    assert (decoded.texts["50"].style_handle, decoded.texts["51"].style_handle) == ("14", "15")
    assert (styles_of(decoded)["14"].fixed_height, styles_of(decoded)["15"].fixed_height) == (1.8, 5.0)


def test_a_style_named_like_a_path_with_fonts_named_like_urls_is_kept_as_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    odd = style(
        0x14,
        "../../etc/passwd",
        font_file="https://fonts.example.invalid/x.ttf",
        bigfont_file="C:\\Windows\\Fonts\\big.shx",
    )
    data = with_styles(odd, entities=(text_entity(0x50, text_value="X", style=ref(0x14)),))

    def refused(*args: object, **kwargs: object) -> None:
        raise AssertionError(f"opened {args!r}")

    for target in ("builtins.open", "io.open", "os.open", "socket.socket"):
        monkeypatch.setattr(target, refused)
    decoded = dwgread.decode(data)
    monkeypatch.undo()

    text = decoded.texts["50"]
    assert (text.style, text.font, text.bigfont, text.style_handle) == (
        "../../etc/passwd",
        "https://fonts.example.invalid/x.ttf",
        "C:\\Windows\\Fonts\\big.shx",
        "14",
    )
    assert styles_of(decoded)["14"].font == "https://fonts.example.invalid/x.ttf"


def test_loading_keeps_only_the_style_fields_read(tmp_path: Path) -> None:
    stored = style(
        0x14,
        "FIXED",
        text_size=3.7,
        is_vertical=0,
        generation=0,
        last_height=2.5,
        flag=0,
        xdicobjhandle=[3, 0, 0],
        eed=[{"size": 9000, "data": "x" * 64}],
    )
    path = tmp_path / "file.json"
    path.write_text(json.dumps(with_styles(stored)))

    with path.open("rb") as stream:
        loaded = dwgread.load(stream)

    kept = [o for o in loaded["OBJECTS"] if o.get("object") == "STYLE" and o["name"] == "FIXED"]
    assert kept == [
        {
            "object": "STYLE",
            "handle": [0, 1, 0x14],
            "name": "FIXED",
            "is_shape": 0,
            "text_size": 3.7,
            "width_factor": 1.0,
            "oblique_angle": 0.0,
            "font_file": "romans.shx",
            "bigfont_file": "",
        }
    ]


def test_a_hundred_thousand_styles_each_texts_style_is_found_by_handle(tmp_path: Path) -> None:
    """A hostile file's table: every style is kept and each text finds its own (a lookup per text
    that scanned the table would be 10^10 steps here, so the result alone shows there is none)."""
    count = 100_000
    first = 0x1000
    styles = [style(first + i, f"S{i}", text_size=1.0 + i % 7) for i in range(count)]
    texts = tuple(
        text_entity(first + count + i, text_value="X", style=ref(first + i)) for i in range(count)
    )
    path = tmp_path / "file.json"
    path.write_text(json.dumps(with_styles(*styles, entities=texts)))

    with path.open("rb") as stream:
        decoded = dwgread.decode(dwgread.load(stream))

    assert [(s.handle, s.name) for s in decoded.styles[2:]] == [
        (f"{first + i:X}", f"S{i}") for i in range(count)
    ]
    found = {t.handle: t.style_handle for t in decoded.texts.values() if t.type == "TEXT"}
    assert found == {f"{first + count + i:X}": f"{first + i:X}" for i in range(count)}


@pytest.mark.parametrize(("unit", "mm"), [(0, 25.4), (1, 1.0), (2, None), ("1", None), (None, None)])
def test_a_layouts_paper_units_are_its_plot_settings_inches_or_millimetres(
    unit: object, mm: float | None
) -> None:
    """#87: paper space is drawn in the layout's plot-paper units (0 inches, 1 mm, 2 pixels)."""
    data = drawing()
    layout = next(o for o in data["OBJECTS"] if o.get("layout_name") == "Layout1")
    if unit is not None:
        layout[dwgread.PLOT_PAPER_UNIT] = unit

    blocks = {b.layout: b for b in dwgread.decode(data).blocks}

    assert blocks["Layout1"].paper_mm_per_unit == mm
    assert blocks[None].paper_mm_per_unit is None  # a block definition states none


def test_a_layouts_paper_units_survive_the_loader() -> None:
    data = drawing()
    layout = next(o for o in data["OBJECTS"] if o.get("layout_name") == "Layout1")
    layout[dwgread.PLOT_PAPER_UNIT] = 0

    loaded = dwgread.load(io.BytesIO(json.dumps(data).encode()))

    assert {b.layout: b for b in dwgread.decode(loaded).blocks}["Layout1"].paper_mm_per_unit == 25.4


@pytest.mark.parametrize(
    ("paper", "drawn", "mm"),
    [(1.0, 25.4, 1.0), (1.0, 1.0, 25.4), (1.0, 0.0, 25.4), (float("nan"), 1.0, 25.4), (1.0, 1e12, 25.4)],
)
def test_an_inch_layouts_custom_plot_scale_is_read_with_its_units(
    paper: float, drawn: float, mm: float
) -> None:
    """The review of 18, round 1: inch paper units over a drawing made in millimetres state a scale of
    1 in = 25.4 units, so a unit plots at 1 mm; an unusable scale leaves the units alone."""
    data = drawing()
    layout = next(o for o in data["OBJECTS"] if o.get("layout_name") == "Layout1")
    layout[dwgread.PLOT_PAPER_UNIT] = 0
    layout[dwgread.PLOT_SCALE[0]], layout[dwgread.PLOT_SCALE[1]] = paper, drawn

    blocks = {b.layout: b for b in dwgread.decode(data).blocks}

    assert blocks["Layout1"].paper_mm_per_unit == pytest.approx(mm)


def test_a_layouts_plot_settings_are_kept_as_the_file_states_them() -> None:
    """S15-E2: a layout's plot sheet (its paper's size, margins, plot offset and turn, all in mm) is
    kept on its block; a block definition has none."""
    data = drawing()
    layout = next(o for o in data["OBJECTS"] if o.get("layout_name") == "Layout1")
    width, height, left, bottom, right, top, origin, turn = dwgread.PLOT_SHEET
    layout.update({width: 594.0, height: 841.0, left: 5.0, bottom: 6.0, right: 7.0, top: 8.0,
                   origin: [1.5, -2.5], turn: 1})  # fmt: skip

    loaded = dwgread.load(io.BytesIO(json.dumps(data).encode()))
    blocks = {b.layout: b for b in dwgread.decode(loaded).blocks}

    assert blocks["Layout1"].plot == PlotSettings(594.0, 841.0, (5.0, 6.0, 7.0, 8.0), (1.5, -2.5), 1)
    assert blocks[None].plot is None


@pytest.mark.parametrize(
    ("key", "value"),
    [(0, None), (0, "841"), (1, float("nan")), (2, float("inf")), (5, True), (6, [0.0]),
     (6, "0,0"), (6, [0.0, float("nan")]), (7, 4), (7, 1.0), (7, None)],
)  # fmt: skip
def test_a_layouts_plot_settings_with_a_value_no_sheet_has_are_not_kept(key: int, value: object) -> None:
    """A hostile file's plot settings: a size, margin or offset that is no finite number, or a turn
    not 0 to 3, leave the layout with none (its frame then gives its sheet)."""
    data = drawing()
    layout = next(o for o in data["OBJECTS"] if o.get("layout_name") == "Layout1")
    width, height, left, bottom, right, top, origin, turn = dwgread.PLOT_SHEET
    layout.update({width: 841.0, height: 594.0, left: 0.0, bottom: 0.0, right: 0.0, top: 0.0,
                   origin: [0.0, 0.0], turn: 0})  # fmt: skip
    layout[dwgread.PLOT_SHEET[key]] = value

    blocks = {b.layout: b for b in dwgread.decode(data).blocks}

    assert blocks["Layout1"].plot is None
