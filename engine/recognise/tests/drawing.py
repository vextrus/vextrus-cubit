"""Hand-built ReadArtefacts for the sheet finder's unit tests: invented frames, title blocks and
layouts, no toolchain. They prove mechanics only, never a reading (docs/sdlc.md).

`Sheets` is 11's `Drawing` with layouts of its own and a file name; `frame_block` draws a frame block
whose title block is a strip along its right edge, with labels (and, where asked, attribute
definitions) at invented places.
"""

import json
from pathlib import Path

from engine.read.artefact import Block, Format, ReadArtefact
from engine.recognise.types import SheetConventions
from engine.render.fixtures.artefacts import Drawing, _Record

DEFAULT = SheetConventions.from_json(
    json.loads(
        (Path(__file__).parents[1] / "conventions" / "sheet-default.json").read_text(encoding="utf-8")
    )
)
W, H = 841.0, 594.0
"""The invented frame: an A1 sheet at 1:1, its title block a strip from 0.8 of its width."""


def rectangle(x0: float, y0: float, x1: float, y1: float) -> dict[str, object]:
    points = [[x0, y0, 0, 0, 0], [x1, y0, 0, 0, 0], [x1, y1, 0, 0, 0], [x0, y1, 0, 0, 0]]
    return {"points": points, "flags": 1}


class Sheets(Drawing):
    """A Drawing with named layouts and a file name."""

    def __init__(self, insunits: int = 4, source_name: str = "invented.dwg") -> None:
        super().__init__(insunits)
        self.source_name = source_name
        self.tabs = ["Model", "Layout1"]

    def layout(self, name: str) -> str:
        handle = self._handle()
        self.records[handle] = _Record(handle, f"*Paper_Space{len(self.tabs)}", (0.0, 0.0, 0.0), name)
        self.tabs.append(name)
        return handle

    def artefact(self) -> ReadArtefact:
        return ReadArtefact.build(
            source_sha256="0" * 63 + "2",
            source_name=self.source_name,
            format=Format("dwg", "AC1032"),
            reader="synthetic",
            reader_version="1",
            layouts=self.tabs,
            insunits=self.insunits,
            notes=[],
            blocks=[
                Block(r.handle, r.name, r.base_point, r.layout, tuple(r.entities))
                for r in self.records.values()
            ],
            entities=self.entities.values(),
        )


def frame_block(
    drawing: Drawing,
    name: str = "SHEET",
    *,
    labels: tuple[str, ...] = ("SHEET TITLE", "SCALE", "SHEET NO", "DATE"),
    attdefs: tuple[str, ...] = (),
    base: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> str:
    """A frame block: its border, the title-block strip's border, and each label at the top-left
    of a cell 60 high down the strip (`label_at`); an attribute definition per tag, at the place
    of the value under its label (`value_at`)."""
    block = drawing.block(name, base)
    drawing.entity("LWPOLYLINE", rectangle(0, 0, W, H), owner=block)
    drawing.entity("LWPOLYLINE", rectangle(0.8 * W, 0, W, H), owner=block)
    for i, label in enumerate(labels):
        drawing.text(label, label_at(i), height=3.0, owner=block)
    for i, tag in enumerate(attdefs):
        drawing.text("", value_at(i), kind="ATTDEF", height=5.0, owner=block, tag=tag)
    return block


def label_at(cell: int) -> tuple[float, float, float]:
    return (0.8 * W + 10.0, H - 20.0 - 60.0 * cell, 0.0)


def value_at(cell: int) -> tuple[float, float, float]:
    """Under the cell's label, where a person writes its value."""
    return (0.8 * W + 12.0, H - 35.0 - 60.0 * cell, 0.0)
