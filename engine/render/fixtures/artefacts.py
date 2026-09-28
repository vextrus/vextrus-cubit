"""Synthetic ReadArtefacts, built in Python for unit tests and the committed buffer fixtures.

A `Drawing` makes the artefact 04's reader would give for a small invented drawing, with no DWG and no
toolchain: model space, one layout, blocks, and entities with the raw values the reader carries (an
entity's DXF values by name; an insert's placement unresolved; a text's height as stored). It proves
mechanics only, never a reading (docs/sdlc.md). The DWG fixtures (`engine/fixtures/dwg/`) prove the
same mechanics through the real reader.
"""

from dataclasses import dataclass, field
from typing import Any

from engine.read.artefact import AnyEntity, Block, Entity, Format, Insert, Point, ReadArtefact, Text

MODEL = "1F"
PAPER = "1E"
SHA256 = "0" * 63 + "1"


@dataclass
class _Record:
    handle: str
    name: str
    base_point: Point
    layout: str | None
    entities: list[str] = field(default_factory=list)


class Drawing:
    """An artefact under construction; every add returns the new entity's handle."""

    def __init__(self, insunits: int = 4) -> None:
        self.insunits = insunits
        self._next = 0x100
        self.records: dict[str, _Record] = {
            MODEL: _Record(MODEL, "*Model_Space", (0.0, 0.0, 0.0), "Model"),
            PAPER: _Record(PAPER, "*Paper_Space", (0.0, 0.0, 0.0), "Layout1"),
        }
        self.entities: dict[str, AnyEntity] = {}

    def _handle(self) -> str:
        self._next += 1
        return f"{self._next:X}"

    def block(self, name: str, base_point: Point = (0.0, 0.0, 0.0)) -> str:
        handle = self._handle()
        self.records[handle] = _Record(handle, name, base_point, None)
        return handle

    def _add(self, entity: AnyEntity, owner: str) -> str:
        self.entities[entity.handle] = entity
        if owner in self.records:
            self.records[owner].entities.append(entity.handle)
        return entity.handle

    def entity(self, kind: str, values: dict[str, Any], *, layer: str = "0", owner: str = MODEL) -> str:
        return self._add(Entity(self._handle(), kind, layer, owner, values), owner)

    def line(
        self,
        start: tuple[float, float],
        end: tuple[float, float],
        *,
        layer: str = "0",
        owner: str = MODEL,
        **values: Any,
    ) -> str:
        return self.entity(
            "LINE", {"start": [*start, 0.0], "end": [*end, 0.0], **values}, layer=layer, owner=owner
        )

    def insert(
        self,
        block: str,
        point: Point = (0.0, 0.0, 0.0),
        *,
        scale: Point = (1.0, 1.0, 1.0),
        rotation_radians: float = 0.0,
        extrusion: Point = (0.0, 0.0, 1.0),
        owner: str = MODEL,
        layer: str = "0",
        values: dict[str, Any] | None = None,
        kind: str = "INSERT",
    ) -> str:
        insert = Insert(
            handle=self._handle(),
            type=kind,
            layer=layer,
            owner=owner,
            block=block,
            name=self.records[block].name if block in self.records else "",
            point=point,
            scale=scale,
            rotation_radians=rotation_radians,
            extrusion=extrusion,
            values=values or {},
        )
        return self._add(insert, owner)

    def text(
        self,
        text: str,
        position: Point = (0.0, 0.0, 0.0),
        *,
        kind: str = "TEXT",
        height: float | None = 2.5,
        rotation_radians: float = 0.0,
        direction: Point | None = None,
        style: str | None = "Standard",
        font: str | None = "arial.ttf",
        width: float | None = None,
        attachment: int | None = None,
        owner: str = MODEL,
        layer: str = "0",
        extrusion: Point = (0.0, 0.0, 1.0),
        tag: str | None = None,
    ) -> str:
        mtext = kind == "MTEXT"
        entity = Text(
            handle=self._handle(),
            type=kind,
            layer=layer,
            owner=owner,
            text=text,
            style=style,
            style_source="own" if style else "none",
            font=font,
            bigfont=None,
            height=height,
            position=position,
            alignment_point=None,
            halign=0,
            valign=0,
            rotation_radians=0.0 if mtext else rotation_radians,
            direction=(direction or (1.0, 0.0, 0.0)) if mtext else None,
            width=width if width is not None else (0.0 if mtext else 1.0),
            attachment=(attachment or 1) if mtext else None,
            tag=tag,
            extrusion=extrusion,
        )
        return self._add(entity, owner)

    def attrib(self, insert: str, text: str, position: Point, **options: object) -> str:
        """An ATTRIB of `insert`, placed in the insert's space (as the file stores it)."""
        handle = self.text(text, position, kind="ATTRIB", owner=insert, **options)  # type: ignore[arg-type]
        found = self.entities[insert]
        assert isinstance(found, Insert)
        self.entities[insert] = Insert(**{**found.__dict__, "attribs": (*found.attribs, handle)})
        return handle

    def artefact(self) -> ReadArtefact:
        return ReadArtefact.build(
            source_sha256=SHA256,
            source_name="synthetic.dwg",
            format=Format("dwg", "AC1032"),
            reader="synthetic",
            reader_version="1",
            layouts=["Model", "Layout1"],
            insunits=self.insunits,
            notes=[],
            blocks=[
                Block(r.handle, r.name, r.base_point, r.layout, tuple(r.entities))
                for r in self.records.values()
            ],
            entities=self.entities.values(),
        )
