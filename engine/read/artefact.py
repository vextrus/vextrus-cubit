"""The ReadArtefact: everything a reader took from one drawing file, and its versioned JSON.

The contract (docs/plans/M0.md, "The ReadArtefact and the anchors"; review A7) fixes its **summary**:
`source_sha256`, `source_name` (the file's name as uploaded), `format` (the kind and, for a DWG, its
version such as `AC1032`), `reader` and `reader_version`, `entity_counts` per type, `layer_counts` per
layer, `layouts` (their names, in tab order) and `insunits`; plus `notes`, the repairs the reader made
(message codes with counts, engine/messages/read.py).

Its **body** holds every entity, with **raw placement values, unresolved** (s02; 11 resolves them in
`engine.geometry.placement` and `engine.text.mtext`):
- an `Insert` keeps its point, scale, rotation and extrusion exactly as the file stores them (a
  mirrored insert keeps its extrusion (0, 0, -1)); nothing is transformed to world coordinates;
- a `Text` (TEXT, ATTRIB, ATTDEF, MTEXT) keeps its text exactly as `dwgread` decoded it (raw line
  breaks and `\\P` codes included), its height as stored (`None` when the file stores none, as MTEXT
  inside a block may), an MTEXT's direction vector as stored (never an angle), and its style and
  font. `position` is where the text is drawn from: its start point, whatever its alignment
  (docs/knowledge/lessons.md: AutoCAD plots aligned TEXT and ATTRIB from it). Its style is named by
  `style_handle`, a key of `styles` (None when the file names no style the table holds); `style`,
  `font` and `bigfont` are that style's name and fonts, copied for readers that need only those;
- every other `Entity` keeps its DXF values as ezdxf read them, by DXF name, with its vertices,
  control points or boundary paths where it has them.

Every entity names its `owner`: the handle of the block record it lies in (a layout's, or a block
definition's), or for an ATTRIB its INSERT's handle. `blocks` maps each block record to its name,
base point, layout and entities in drawing order, which is how a Trace's insert chain is walked.

`styles` is the text style table (#82): every STYLE the file holds, by handle, shape-file entries
(which have no name) included and marked. A style's name is not a key: shape-file entries share the
empty name and a file may repeat one, so a text names its style by handle. The reader keeps each
number only when it is usable (`usable_size`, `usable_angle`), else `None` (a fixed height of 0 is
AutoCAD's "not fixed"), and `from_json` refuses any other, so a read artefact's table never holds NaN
or Infinity; a style built in code keeps what it is given.

Coordinates are floats in drawing units: drawing geometry stays float inside the read-artefact file
(docs/data-model.md §2). Rotations are named with their unit.

`to_json` writes `{"schema": SCHEMA, "version": VERSION, ...}`; `from_json` refuses any other schema
or version, so a change to this shape is a new VERSION and never a silent reinterpretation. Version 2
added the style table and `Text.style_handle` (#82); version 3 a layout's paper units
(`Block.paper_mm_per_unit`, #87); version 4 a layout's plot settings (`Block.plot`, S15-E2: its paper's
size, margins, plot offset and turn, as the file states them); an older version is refused, so an
artefact stored before it is read again from its drawing.
"""

import math
from collections import Counter
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from engine.messages import Message
from engine.read._json import Fields, Json
from engine.read.anchor import is_handle

SCHEMA = "engine.read.artefact"
VERSION = 4

type Point = tuple[float, float, float]
type StyleSource = Literal["own", "attdef", "none"]

_STYLE_SOURCES: dict[str, StyleSource] = {"own": "own", "attdef": "attdef", "none": "none"}
TEXT_TYPES = frozenset({"TEXT", "ATTRIB", "ATTDEF", "MTEXT"})
INSERT_TYPES = frozenset({"INSERT", "MINSERT"})


@dataclass(frozen=True)
class Format:
    kind: Literal["dwg"]
    version: str  # the file's own version string (AC1021, AC1032…)


@dataclass(frozen=True)
class Entity:
    """Any entity that is neither text nor an insert: its DXF values as ezdxf read them."""

    handle: str
    type: str
    layer: str
    owner: str
    values: Mapping[str, Json] = field(default_factory=dict)


@dataclass(frozen=True)
class Insert:
    """A block reference, with its placement exactly as stored (DWG: rotation in radians)."""

    handle: str
    type: str  # INSERT or MINSERT
    layer: str
    owner: str
    block: str  # the inserted block record's handle
    name: str  # its name
    point: Point
    scale: Point
    rotation_radians: float
    extrusion: Point
    attribs: tuple[str, ...] = ()
    values: Mapping[str, Json] = field(default_factory=dict)  # MINSERT's rows and columns


@dataclass(frozen=True)
class Text:
    """TEXT, ATTRIB, ATTDEF or MTEXT, as `dwgread` decoded it."""

    handle: str
    type: str
    layer: str
    owner: str
    text: str
    style: str | None
    style_source: StyleSource  # "attdef": an ATTRIB's style taken from its ATTDEF (LibreDWG drops it)
    font: str | None  # the style's font file
    bigfont: str | None
    height: float | None  # as stored; None when the file stores none
    position: Point  # the start point: where the text is drawn from
    alignment_point: Point | None  # as stored, for reference only
    halign: int
    valign: int
    rotation_radians: float  # TEXT, ATTRIB, ATTDEF; 0 for MTEXT, whose angle is its direction
    direction: Point | None  # MTEXT's direction vector (x axis), as stored
    width: float | None  # TEXT's width factor; MTEXT's reference rectangle width
    attachment: int | None  # MTEXT's attachment point (1 to 9)
    tag: str | None  # ATTRIB and ATTDEF
    extrusion: Point
    style_handle: str | None = None  # its style in the artefact's `styles`; for "attdef", the ATTDEF's


type AnyEntity = Entity | Insert | Text


@dataclass(frozen=True)
class TextStyle:
    """A text style (a STYLE table entry), its numbers kept only when usable (the module's docstring).

    `fixed_height` is the height every text on the style is drawn at when the style fixes one (None:
    not fixed); `width_factor` and `oblique_radians` are as stored; `font` and `bigfont` are file names,
    data only (engine.render.fonts substitutes them and never opens one)."""

    handle: str
    name: str  # empty for a shape file's entry
    fixed_height: float | None
    width_factor: float | None
    oblique_radians: float | None
    font: str | None
    bigfont: str | None
    shape: bool = False  # a shape file's entry, not a style a text is drawn in


def usable_size(value: object) -> float | None:
    """A fixed height or width factor as the style table keeps it: a finite number above 0, else None."""
    number = usable_angle(value)
    return number if number is not None and number > 0 else None


def usable_angle(value: object) -> float | None:
    """An oblique angle as the style table keeps it: a finite number, else None."""
    if not isinstance(value, int | float) or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except OverflowError:  # an integer no float holds
        return None
    return number if math.isfinite(number) else None


@dataclass(frozen=True)
class PlotSettings:
    """A layout's plot settings as the file states them (PLOTSETTINGS, S15-E2), every length in paper
    millimetres whatever its paper units: the paper's size as the plotter holds it (`width_mm` by
    `height_mm`, before the turn), its unprintable margins (left, bottom, right, top), the plot offset
    (`origin_mm`, from the printable area's lower-left corner), and the turn of the drawing on the
    paper (`rotation`: 0 none, 1 a quarter turn counterclockwise, 2 a half turn, 3 a quarter turn
    clockwise). Read from a hostile file: every number is finite and `rotation` one of the four, else
    the reader keeps none; whether the size is a sheet's is the reader of the artefact's to judge
    (`engine.recognise.views.paper`)."""

    width_mm: float
    height_mm: float
    margins_mm: tuple[float, float, float, float]
    origin_mm: tuple[float, float]
    rotation: int

    def __post_init__(self) -> None:
        numbers = (self.width_mm, self.height_mm, *self.margins_mm, *self.origin_mm)
        if len(self.margins_mm) != 4 or len(self.origin_mm) != 2:
            raise ValueError("read artefact: plot settings hold four margins and a two-number origin")
        if not all(
            isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v) for v in numbers
        ):
            raise ValueError(f"read artefact: plot settings must be finite numbers, got {numbers!r}")
        if type(self.rotation) is not int or self.rotation not in (0, 1, 2, 3):
            raise ValueError(f"read artefact: a plot's rotation is 0 to 3, got {self.rotation!r}")


@dataclass(frozen=True)
class Block:
    """A block record: model space, a paper-space layout, or a block definition."""

    handle: str
    name: str
    base_point: Point
    layout: str | None  # the layout's name when this record is a layout's
    entities: tuple[str, ...]  # handles in drawing order
    paper_mm_per_unit: float | None = None
    """Millimetres of paper a layout's drawing unit plots at, as its plot settings state them: its paper
    units (25.4 inches, 1 millimetres) times its custom scale; none for any other record, or when the
    settings state neither inches nor millimetres (#87)."""
    plot: PlotSettings | None = None
    """A layout's plot settings (version 4), where its reader has them; none for any other record."""


@dataclass(frozen=True)
class Summary:
    source_sha256: str
    source_name: str
    format: Format
    reader: str
    reader_version: str
    entity_counts: Mapping[str, int]
    layer_counts: Mapping[str, int]
    layouts: tuple[str, ...]
    insunits: int
    notes: tuple[Message, ...]


@dataclass(frozen=True)
class ReadArtefact:
    summary: Summary
    blocks: Mapping[str, Block]
    entities: Mapping[str, AnyEntity]
    styles: Mapping[str, TextStyle] = field(default_factory=dict)

    @classmethod
    def build(
        cls,
        *,
        source_sha256: str,
        source_name: str,
        format: Format,
        reader: str,
        reader_version: str,
        layouts: Sequence[str],
        insunits: int,
        notes: Iterable[Message],
        blocks: Iterable[Block],
        entities: Iterable[AnyEntity],
        styles: Iterable[TextStyle] = (),
    ) -> ReadArtefact:
        """An artefact with its counts taken from its entities, so the two can never disagree; a text
        naming a style handle the table does not hold is refused."""
        by_handle = {entity.handle: entity for entity in entities}
        table = {style.handle: style for style in styles}
        for entity in by_handle.values():
            named = entity.style_handle if isinstance(entity, Text) else None
            if named is not None and named not in table:
                raise ValueError(
                    f"read artefact: text {entity.handle}'s style handle {named!r} names no style "
                    "in the table"
                )
        summary = Summary(
            source_sha256=source_sha256,
            source_name=source_name,
            format=format,
            reader=reader,
            reader_version=reader_version,
            entity_counts=_count(entity.type for entity in by_handle.values()),
            layer_counts=_count(entity.layer for entity in by_handle.values()),
            layouts=tuple(layouts),
            insunits=insunits,
            notes=tuple(notes),
        )
        return cls(summary, {block.handle: block for block in blocks}, by_handle, table)

    def to_json(self) -> dict[str, Any]:
        s = self.summary
        return {
            "schema": SCHEMA,
            "version": VERSION,
            "summary": {
                "source_sha256": s.source_sha256,
                "source_name": s.source_name,
                "format": {"kind": s.format.kind, "version": s.format.version},
                "reader": s.reader,
                "reader_version": s.reader_version,
                "entity_counts": dict(s.entity_counts),
                "layer_counts": dict(s.layer_counts),
                "layouts": list(s.layouts),
                "insunits": s.insunits,
                "notes": [dict(note) for note in s.notes],
            },
            "blocks": [_block_json(block) for block in self.blocks.values()],
            "styles": [_style_json(style) for style in self.styles.values()],
            "entities": [_entity_json(entity) for entity in self.entities.values()],
        }

    @classmethod
    def from_json(cls, data: Mapping[str, Any]) -> ReadArtefact:
        top = Fields(data, "read artefact")
        if top.string("schema") != SCHEMA:
            raise top.fail("schema", repr(SCHEMA))
        if top.integer("version") != VERSION:
            raise top.fail("version", f"{VERSION} (this code reads no other)")
        s = Fields(top.mapping("summary"), "read artefact summary")
        f = Fields(s.mapping("format"), "read artefact format")
        if f.string("kind") != "dwg":
            raise f.fail("kind", "'dwg'")
        file_format = Format("dwg", f.string("version"))
        f.done()
        blocks = [_block_from_json(item) for item in top.array("blocks")]
        styles = [_style_from_json(item) for item in top.array("styles")]
        entities = [_entity_from_json(item) for item in top.array("entities")]
        artefact = cls.build(
            source_sha256=s.string("source_sha256"),
            source_name=s.string("source_name"),
            format=file_format,
            reader=s.string("reader"),
            reader_version=s.string("reader_version"),
            layouts=[_string(name, "a layout's name") for name in s.array("layouts")],
            insunits=s.integer("insunits"),
            notes=[_message(note) for note in s.array("notes")],
            blocks=blocks,
            entities=entities,
            styles=styles,
        )
        if dict(s.mapping("entity_counts")) != artefact.summary.entity_counts:
            raise s.fail("entity_counts", "the counts of the entities it holds")
        if dict(s.mapping("layer_counts")) != artefact.summary.layer_counts:
            raise s.fail("layer_counts", "the counts of the entities it holds")
        s.done()
        top.done()
        if len(artefact.entities) != len(entities):
            raise ValueError("read artefact: an entity handle is repeated")
        if len(artefact.blocks) != len(blocks):
            raise ValueError("read artefact: a block handle is repeated")
        if len(artefact.styles) != len(styles):
            raise ValueError("read artefact: a style handle is repeated")
        return artefact


def _count(keys: Iterable[str]) -> dict[str, int]:
    return dict(sorted(Counter(keys).items()))


def _point(value: object, what: str) -> Point:
    if (
        not isinstance(value, list | tuple)
        or len(value) != 3
        or not all(isinstance(v, int | float) and not isinstance(v, bool) for v in value)
    ):
        raise ValueError(f"read artefact: {what} must be three numbers, got {value!r}")
    return (float(value[0]), float(value[1]), float(value[2]))


def _optional_point(value: object, what: str) -> Point | None:
    return None if value is None else _point(value, what)


def _number(value: object, what: str) -> float:
    if not isinstance(value, int | float) or isinstance(value, bool):
        raise ValueError(f"read artefact: {what} must be a number, got {value!r}")
    return float(value)


def _optional_number(value: object, what: str) -> float | None:
    return None if value is None else _number(value, what)


def _optional_int(value: object, what: str) -> int | None:
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"read artefact: {what} must be an integer, got {value!r}")
    return value


def _string(value: object, what: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"read artefact: {what} must be a string, got {value!r}")
    return value


def _optional_handle(value: object, what: str) -> str | None:
    return None if value is None else _handle(value, what)


def _handle(value: object, what: str) -> str:
    if not is_handle(value):
        raise ValueError(f"read artefact: {what} must be an upper-case hex handle, got {value!r}")
    assert isinstance(value, str)
    return value


def _message(value: object) -> Message:
    fields = Fields(value, "read artefact note")
    note: Message = {"code": fields.string("code"), "params": dict(fields.mapping("params"))}
    fields.done()
    return note


def _block_json(block: Block) -> dict[str, Any]:
    return {
        "handle": block.handle,
        "name": block.name,
        "base_point": list(block.base_point),
        "layout": block.layout,
        "entities": list(block.entities),
        "paper_mm_per_unit": block.paper_mm_per_unit,
        "plot": None if block.plot is None else _plot_json(block.plot),
    }


def _plot_json(plot: PlotSettings) -> dict[str, Any]:
    return {
        "width_mm": plot.width_mm,
        "height_mm": plot.height_mm,
        "margins_mm": list(plot.margins_mm),
        "origin_mm": list(plot.origin_mm),
        "rotation": plot.rotation,
    }


def _plot_from_json(value: object) -> PlotSettings | None:
    if value is None:
        return None
    fields = Fields(value, "read artefact plot settings")
    margins = fields.array("margins_mm")
    origin = fields.array("origin_mm")
    plot = PlotSettings(
        width_mm=_number(fields.raw("width_mm"), "a plot's paper width"),
        height_mm=_number(fields.raw("height_mm"), "a plot's paper height"),
        margins_mm=tuple(_number(v, "a plot's margin") for v in margins),  # type: ignore[arg-type]
        origin_mm=tuple(_number(v, "a plot's offset") for v in origin),  # type: ignore[arg-type]
        rotation=fields.integer("rotation"),
    )
    fields.done()
    return plot


def _block_from_json(value: object) -> Block:
    fields = Fields(value, "read artefact block")
    block = Block(
        handle=_handle(fields.raw("handle"), "a block's handle"),
        name=fields.string("name"),
        base_point=_point(fields.raw("base_point"), "a block's base point"),
        layout=fields.optional_string("layout"),
        entities=tuple(_handle(h, "a block's entity") for h in fields.array("entities")),
        paper_mm_per_unit=_paper_units(fields.raw("paper_mm_per_unit")),
        plot=_plot_from_json(fields.raw("plot")),
    )
    fields.done()
    return block


PAPER_MM_RANGE = (1e-4, 1e4)
"""The millimetres of paper a layout's drawing unit may plot at: its paper units (inches or
millimetres) times its custom plot scale."""


def _paper_units(value: object) -> float | None:
    if value is None:
        return None
    low, high = PAPER_MM_RANGE
    if (
        isinstance(value, bool)
        or not isinstance(value, int | float)
        or not (math.isfinite(value) and low <= value <= high)
    ):
        raise ValueError(f"read artefact: a layout's paper units, {value!r}, are no millimetres a unit")
    return float(value)


def _style_json(style: TextStyle) -> dict[str, Any]:
    return {
        "handle": style.handle,
        "name": style.name,
        "fixed_height": style.fixed_height,
        "width_factor": style.width_factor,
        "oblique_radians": style.oblique_radians,
        "font": style.font,
        "bigfont": style.bigfont,
        "shape": style.shape,
    }


def _style_from_json(value: object) -> TextStyle:
    fields = Fields(value, "read artefact style")
    handle = _handle(fields.raw("handle"), "a style's handle")
    fields.what = f"read artefact style {handle}"

    def number(key: str, usable: Callable[[object], float | None], expected: str) -> float | None:
        raw = fields.raw(key)
        found = usable(raw)
        if raw is not None and found is None:
            raise fields.fail(key, f"{expected} or null")
        return found

    shape = fields.raw("shape")
    if not isinstance(shape, bool):
        raise fields.fail("shape", "true or false")
    style = TextStyle(
        handle=handle,
        name=fields.string("name"),
        fixed_height=number("fixed_height", usable_size, "a finite number above 0"),
        width_factor=number("width_factor", usable_size, "a finite number above 0"),
        oblique_radians=number("oblique_radians", usable_angle, "a finite number"),
        font=fields.optional_string("font"),
        bigfont=fields.optional_string("bigfont"),
        shape=shape,
    )
    fields.done()
    return style


def _entity_json(entity: AnyEntity) -> dict[str, Any]:
    common: dict[str, Any] = {
        "handle": entity.handle,
        "type": entity.type,
        "layer": entity.layer,
        "owner": entity.owner,
    }
    match entity:
        case Text():
            return {
                "kind": "text",
                **common,
                "text": entity.text,
                "style": entity.style,
                "style_source": entity.style_source,
                "style_handle": entity.style_handle,
                "font": entity.font,
                "bigfont": entity.bigfont,
                "height": entity.height,
                "position": list(entity.position),
                "alignment_point": _list_or_none(entity.alignment_point),
                "halign": entity.halign,
                "valign": entity.valign,
                "rotation_radians": entity.rotation_radians,
                "direction": _list_or_none(entity.direction),
                "width": entity.width,
                "attachment": entity.attachment,
                "tag": entity.tag,
                "extrusion": list(entity.extrusion),
            }
        case Insert():
            return {
                "kind": "insert",
                **common,
                "block": entity.block,
                "name": entity.name,
                "point": list(entity.point),
                "scale": list(entity.scale),
                "rotation_radians": entity.rotation_radians,
                "extrusion": list(entity.extrusion),
                "attribs": list(entity.attribs),
                "values": dict(entity.values),
            }
        case Entity():
            return {"kind": "entity", **common, "values": dict(entity.values)}


def _list_or_none(point: Point | None) -> list[float] | None:
    return None if point is None else list(point)


def _entity_from_json(value: object) -> AnyEntity:
    fields = Fields(value, "read artefact entity")
    kind = fields.string("kind")
    handle = _handle(fields.raw("handle"), "an entity's handle")
    common = {
        "handle": handle,
        "type": fields.string("type"),
        "layer": fields.string("layer"),
        "owner": _handle(fields.raw("owner"), f"entity {handle}'s owner"),
    }
    entity: AnyEntity
    if kind == "entity":
        entity = Entity(**common, values=dict(fields.mapping("values")))
    elif kind == "insert":
        entity = Insert(
            **common,
            block=_handle(fields.raw("block"), f"insert {handle}'s block"),
            name=fields.string("name"),
            point=_point(fields.raw("point"), f"insert {handle}'s point"),
            scale=_point(fields.raw("scale"), f"insert {handle}'s scale"),
            rotation_radians=_number(fields.raw("rotation_radians"), f"insert {handle}'s rotation"),
            extrusion=_point(fields.raw("extrusion"), f"insert {handle}'s extrusion"),
            attribs=tuple(_handle(h, f"insert {handle}'s attrib") for h in fields.array("attribs")),
            values=dict(fields.mapping("values")),
        )
    elif kind == "text":
        style_source = _STYLE_SOURCES.get(fields.string("style_source"))
        if style_source is None:
            raise fields.fail("style_source", "own, attdef or none")
        entity = Text(
            **common,
            text=fields.string("text"),
            style=fields.optional_string("style"),
            style_source=style_source,
            style_handle=_optional_handle(fields.raw("style_handle"), f"text {handle}'s style handle"),
            font=fields.optional_string("font"),
            bigfont=fields.optional_string("bigfont"),
            height=_optional_number(fields.raw("height"), f"text {handle}'s height"),
            position=_point(fields.raw("position"), f"text {handle}'s position"),
            alignment_point=_optional_point(fields.raw("alignment_point"), f"text {handle}'s alignment"),
            halign=fields.integer("halign"),
            valign=fields.integer("valign"),
            rotation_radians=_number(fields.raw("rotation_radians"), f"text {handle}'s rotation"),
            direction=_optional_point(fields.raw("direction"), f"text {handle}'s direction"),
            width=_optional_number(fields.raw("width"), f"text {handle}'s width"),
            attachment=_optional_int(fields.raw("attachment"), f"text {handle}'s attachment"),
            tag=fields.optional_string("tag"),
            extrusion=_point(fields.raw("extrusion"), f"text {handle}'s extrusion"),
        )
    else:
        raise fields.fail("kind", "entity, insert or text")
    fields.done()
    return entity
