"""What `dwgread -O JSON` says about a file: its structure, its text and its inserts.

`dwgread` decodes the DWG itself, so everything but geometry is taken from its JSON (ADR 0029; the M0
spec: text never from the DXF, which corrupts raw line breaks): the version, the header's units, the
layouts and block records, every entity's handle, type, layer and owner, every text entity's text,
style and placement, and every insert's placement, all as stored. Geometry comes from the DXF
(`dxf.py`), joined by handle.

Two repairs are made here, each counted in the artefact's notes:
- **an ATTRIB's style from its ATTDEF.** LibreDWG 0.14 decodes a null style handle on ATTRIBs (all
  1,488 in one real structural file; docs/research/viewer-2d-fidelity.md) while the ATTDEFs keep
  theirs, so an ATTRIB with no style takes the style of the ATTDEF with its tag in its INSERT's block;
- **aligned TEXT and ATTRIB drawn from the start point.** LibreDWG gives them start point = alignment
  point (all 3,016 non-left-aligned ones in the Sample Project), and AutoCAD plots them from the start
  point (docs/knowledge/lessons.md), so `position` is the start point, whatever the alignment; the
  alignment point is kept as stored, for reference.

The JSON is loaded with a hook that keeps only the fields read here, so a large file's geometry,
which the DXF supplies, is dropped as it is parsed rather than held.
"""

import json
from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from engine.messages import Message
from engine.messages import read as codes
from engine.read.artefact import TEXT_TYPES, Block, Insert, Point, Text

UNKNOWN_OWNER = "0"  # no record lists the entity, it names no owner and states no space
STRUCTURE = frozenset({"BLOCK", "ENDBLK", "SEQEND"})  # markers, not drawing entities
_ENTITY_KEEP = frozenset({"entity", "handle", "layer", "ownerhandle", "entmode", "name"})
_TEXT_KEEP = _ENTITY_KEEP | {
    "text_value", "text", "style", "height", "text_height", "ins_pt", "alignment_pt", "elevation",
    "horiz_alignment", "vert_alignment", "rotation", "x_axis_dir", "width_factor", "rect_width",
    "attachment", "tag", "extrusion",
}  # fmt: skip
_INSERT_KEEP = _ENTITY_KEEP | {"ins_pt", "scale", "rotation", "extrusion", "block_header", "attribs"}
_OBJECT_KEEP = {
    "LAYER": frozenset({"object", "handle", "name"}),
    "STYLE": frozenset({"object", "handle", "name", "font_file", "bigfont_file"}),
    "BLOCK_HEADER": frozenset(
        {"object", "handle", "name", "base_pt", "entities", "block_entity", "layout"}
    ),
    "LAYOUT": frozenset({"object", "handle", "layout_name", "tab_order", "block_header"}),
}
_OBJECT_ONLY = frozenset({"object", "handle"})


def load(path: Path) -> dict[str, Any]:
    """The JSON `dwgread` wrote, keeping only what this module reads."""
    with path.open("rb") as file:
        data: dict[str, Any] = json.load(file, object_pairs_hook=_slim)
    return data


def _slim(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    item = dict(pairs)
    if isinstance(kind := item.get("entity"), str):
        if kind in TEXT_TYPES:
            keep = _TEXT_KEEP
        else:
            keep = _INSERT_KEEP if kind.endswith("INSERT") else _ENTITY_KEEP
    elif isinstance(kind := item.get("object"), str):
        keep = _OBJECT_KEEP.get(kind, _OBJECT_ONLY)
    else:
        return item
    return {key: value for key, value in item.items() if key in keep}


def handle(value: object) -> str | None:
    """A handle as the file writes it (`8D`), from the JSON's own (`[0, 1, 141]`) or a reference's
    (`[5, 1, 166, 166]`, whose last item is absolute); None for a null reference (`[0, 0]`)."""
    if not isinstance(value, list) or len(value) < 3:
        return None
    number = value[-1]
    if not isinstance(number, int) or number <= 0:
        return None
    return f"{number:X}"


def dxf_type(json_type: str) -> str:
    """The DXF name of a `dwgread` entity type (POLYLINE_2D → POLYLINE, DIMENSION_LINEAR → DIMENSION)."""
    for family in ("POLYLINE", "DIMENSION", "VERTEX"):
        if json_type.startswith(f"{family}_"):
            return family
    return json_type.lstrip("_")


@dataclass(frozen=True)
class Placed:
    """An entity as the JSON places it: its owner, layer and type (a DXF name)."""

    handle: str
    type: str
    layer: str
    owner: str


@dataclass(frozen=True)
class Decoded:
    version: str
    insunits: int
    layouts: tuple[str, ...]
    blocks: tuple[Block, ...]
    entities: tuple[Placed, ...]  # every drawing entity, text and inserts included
    texts: Mapping[str, Text]
    inserts: Mapping[str, Insert]
    notes: tuple[Message, ...]


def decode(data: Mapping[str, Any]) -> Decoded:
    objects: list[dict[str, Any]] = data["OBJECTS"]
    by_handle = {h: item for item in objects if (h := handle(item.get("handle")))}
    of_kind = _objects_of_kind(by_handle)
    names = {h: str(item.get("name", "")) for h, item in of_kind("LAYER").items()}
    styles = of_kind("STYLE")
    headers = of_kind("BLOCK_HEADER")
    layout_objects = sorted(
        (item for item in objects if item.get("object") == "LAYOUT"),
        key=lambda item: int(item.get("tab_order", 0)),
    )
    layout_of = {
        handle(item.get("block_header")): str(item.get("layout_name", "")) for item in layout_objects
    }

    owner_of: dict[str, str] = {}
    for header_handle, header in headers.items():
        for ref in header.get("entities", []):
            if child := handle(ref):
                owner_of[child] = header_handle
    header_vars: Mapping[str, Any] = data.get("HEADER", {})
    space_of = {  # an entity's entmode when no record lists it: 2 model space, 1 paper space
        2: handle(header_vars.get("BLOCK_RECORD_MSPACE")),
        1: handle(header_vars.get("BLOCK_RECORD_PSPACE")),
    }

    blocks = tuple(
        Block(
            handle=h,
            name=_block_name(header, by_handle),
            base_point=_point3(header.get("base_pt")),
            layout=layout_of.get(h),
            entities=tuple(c for ref in header.get("entities", []) if (c := handle(ref))),
        )
        for h, header in headers.items()
    )

    placed: list[Placed] = []
    for item in objects:
        kind = item.get("entity")
        h = handle(item.get("handle"))
        if kind is None or h is None or kind in STRUCTURE or kind.startswith("VERTEX"):
            continue
        owner = (
            owner_of.get(h) or handle(item.get("ownerhandle")) or space_of.get(item.get("entmode", -1))
        )
        layer = names.get(handle(item.get("layer")) or "", "")
        placed.append(Placed(h, dxf_type(kind), layer, owner or UNKNOWN_OWNER))
    where = {p.handle: p for p in placed}

    inserts = {
        p.handle: _insert(by_handle[p.handle], p, headers, by_handle)
        for p in placed
        if p.type in ("INSERT", "MINSERT")
    }
    texts: dict[str, Text] = {}
    from_attdef = aligned = 0
    for p in placed:
        if p.type not in TEXT_TYPES:
            continue
        text = _text(by_handle[p.handle], p, styles)
        if text.type == "ATTRIB" and text.style is None:
            attdef = _attdef_style(text, where, inserts, headers, by_handle, styles)
            if attdef is not None:
                text = attdef
                from_attdef += 1
        if text.type in ("TEXT", "ATTRIB", "ATTDEF") and (text.halign or text.valign):
            aligned += 1
        texts[p.handle] = text

    notes = []
    if from_attdef:
        notes.append(codes.ATTRIB_STYLE_FROM_ATTDEF(count=from_attdef))
    if aligned:
        notes.append(codes.ALIGNED_TEXT_FROM_START(count=aligned))
    file_header: Mapping[str, Any] = data.get("FILEHEADER", {})
    return Decoded(
        version=str(file_header.get("version", "")),
        insunits=int(header_vars.get("INSUNITS", 0)),
        layouts=tuple(str(item.get("layout_name", "")) for item in layout_objects),
        blocks=blocks,
        entities=tuple(placed),
        texts=texts,
        inserts=inserts,
        notes=tuple(notes),
    )


def _objects_of_kind(
    by_handle: Mapping[str, dict[str, Any]],
) -> Callable[[str], dict[str, dict[str, Any]]]:
    def of_kind(kind: str) -> dict[str, dict[str, Any]]:
        return {h: item for h, item in by_handle.items() if item.get("object") == kind}

    return of_kind


def _block_name(header: Mapping[str, Any], by_handle: Mapping[str, Mapping[str, Any]]) -> str:
    # The BLOCK entity carries the name DXF uses (a second paper space's is *Paper_Space0, while its
    # record may say *Paper_Space).
    block_entity = by_handle.get(handle(header.get("block_entity")) or "")
    if block_entity is not None and block_entity.get("name"):
        return str(block_entity["name"])
    return str(header.get("name", ""))


def _point3(value: object, z: float = 0.0) -> Point:
    if isinstance(value, list) and len(value) >= 2:
        third = value[2] if len(value) > 2 else z
        return (float(value[0]), float(value[1]), float(third))
    return (0.0, 0.0, z)


def _optional_point3(value: object, z: float = 0.0) -> Point | None:
    return _point3(value, z) if isinstance(value, list) and len(value) >= 2 else None


def _number(value: object, default: float = 0.0) -> float:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else default


def _insert(
    item: Mapping[str, Any],
    placed: Placed,
    headers: Mapping[str, Mapping[str, Any]],
    by_handle: Mapping[str, Mapping[str, Any]],
) -> Insert:
    block = handle(item.get("block_header")) or "0"
    header = headers.get(block)
    scale = item.get("scale")
    return Insert(
        handle=placed.handle,
        type=placed.type,
        layer=placed.layer,
        owner=placed.owner,
        block=block,
        name=_block_name(header, by_handle) if header is not None else "",
        point=_point3(item.get("ins_pt")),
        scale=_point3(scale, 1.0) if isinstance(scale, list) else (1.0, 1.0, 1.0),
        rotation_radians=_number(item.get("rotation")),
        extrusion=_point3(item.get("extrusion"), 1.0) if item.get("extrusion") else (0.0, 0.0, 1.0),
        attribs=tuple(a for ref in item.get("attribs", []) if (a := handle(ref))),
    )


def _text(item: Mapping[str, Any], placed: Placed, styles: Mapping[str, Mapping[str, Any]]) -> Text:
    style_handle = handle(item.get("style"))
    style = styles.get(style_handle or "")
    is_mtext = placed.type == "MTEXT"
    elevation = _number(item.get("elevation"))
    stored_height = _number(item.get("text_height" if is_mtext else "height"))
    return Text(
        handle=placed.handle,
        type=placed.type,
        layer=placed.layer,
        owner=placed.owner,
        text=str(item.get("text" if is_mtext else "text_value", "")),
        style=str(style["name"]) if style else None,
        style_source="own" if style else "none",
        font=_font(style, "font_file"),
        bigfont=_font(style, "bigfont_file"),
        height=stored_height or None,
        position=_point3(item.get("ins_pt"), elevation),
        alignment_point=None if is_mtext else _optional_point3(item.get("alignment_pt"), elevation),
        halign=int(item.get("horiz_alignment", 0)),
        valign=int(item.get("vert_alignment", 0)),
        rotation_radians=0.0 if is_mtext else _number(item.get("rotation")),
        direction=_optional_point3(item.get("x_axis_dir")) if is_mtext else None,
        width=_number(item.get("rect_width")) if is_mtext else _number(item.get("width_factor"), 1.0),
        attachment=int(item.get("attachment", 1)) if is_mtext else None,
        tag=str(item["tag"]) if "tag" in item else None,
        extrusion=_point3(item.get("extrusion"), 1.0) if item.get("extrusion") else (0.0, 0.0, 1.0),
    )


def _font(style: Mapping[str, Any] | None, key: str) -> str | None:
    value = style.get(key) if style else None
    return str(value) if value else None


def _attdef_style(
    attrib: Text,
    where: Mapping[str, Placed],
    inserts: Mapping[str, Insert],
    headers: Mapping[str, Mapping[str, Any]],
    by_handle: Mapping[str, Mapping[str, Any]],
    styles: Mapping[str, Mapping[str, Any]],
) -> Text | None:
    insert = inserts.get(attrib.owner)
    if insert is None or attrib.tag is None:
        return None
    for child in _block_entities(headers.get(insert.block)):
        item = by_handle.get(child, {})
        if item.get("entity") == "ATTDEF" and item.get("tag") == attrib.tag:
            style = styles.get(handle(item.get("style")) or "")
            if style is None:
                return None
            return replace(
                attrib,
                style=str(style["name"]),
                style_source="attdef",
                font=_font(style, "font_file"),
                bigfont=_font(style, "bigfont_file"),
            )
    return None


def _block_entities(header: Mapping[str, Any] | None) -> Iterator[str]:
    for ref in (header or {}).get("entities", []):
        if child := handle(ref):
            yield child
