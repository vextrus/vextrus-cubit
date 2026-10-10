"""S19-B7's synthetic sets: invented sheets in model space, drawn with ezdxf and written to DWG by the
repo's own writer (engine/fixtures/dwg) in the test's temporary folder. No office's convention and
nothing from a real drawing: every title, layer and block name here is made up. They prove mechanics
only.

Each file is millimetres (INSUNITS 4) with one attributed A1 frame block (`ZQ-FRAME`, 841 x 594 mm,
its title block a strip from x 700), inserted at 1:100 on a grid in model space: column `c` at x
`c * COLUMN`, row 1 above row 2, numbered down the columns as an electrical file's grid of floor
groups and drawing types is. Inside each frame the sheet's content is short lines, `count` of them on
each of its layers: the per-sheet layer histogram (entities per layer) the rule reads.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
PAPER = (841.0, 594.0)
SCALE = 100.0
COLUMN = 100_000.0
ROW = 70_000.0
FRAME = "ZQ-FRAME"

type Layers = Mapping[str, int]
"""Entities per layer inside one sheet's frame."""


@dataclass(frozen=True)
class Sheet:
    number: str
    title: tuple[str, str]
    """The title block's two title lines."""
    column: int
    row: int
    """1 (upper) or 2 (lower)."""
    layers: Layers


def changed(layers: Layers, **counts: int) -> dict[str, int]:
    """`layers` with some layers' counts replaced (a layer's name with `-` written `_`)."""
    result = dict(layers)
    for name, count in counts.items():
        result[name.replace("_", "-")] = count
    return result


def overlap(a: Layers, b: Layers) -> float:
    """The weighted layer overlap of two histograms: the sum over layers of the lesser count over the
    sum of the greater (1 the same content, 0 nothing shared)."""
    keys = set(a) | set(b)
    high = sum(max(a.get(k, 0), b.get(k, 0)) for k in keys)
    return sum(min(a.get(k, 0), b.get(k, 0)) for k in keys) / max(1, high)


def _frame(block: BlockLayout) -> None:
    width, height = PAPER
    block.add_lwpolyline([(0, 0), (width, 0), (width, height), (0, height)], close=True)
    x0, y0, x1, y1 = 700.0, 0.0, width, height
    block.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True)
    rows = (("DRAWING NO.", "DWG_NO", 6.0), ("DRAWING TITLE", "TITLE", 4.0), ("REV.", "REV", 4.0),
            ("DATE", "DATE", 3.0))  # fmt: skip
    for i, (label, tag, size) in enumerate(rows):
        top = y1 - 12 - 22 * i
        block.add_text(label, height=2.5).set_placement((x0 + 4, top))
        block.add_attdef(tag, (x0 + 4, top - 8), dxfattribs={"height": size})
    block.add_attdef("TITLE2", (x0 + 4, y1 - 12 - 22 - 13), dxfattribs={"height": 4.0})


def _content(doc: Drawing, at: tuple[float, float], layers: Layers) -> None:
    """`count` short lines per layer, each layer a band of the drawing area (paper x 40 to 660)."""
    model = doc.modelspace()
    ox, oy = at
    for band, (layer, count) in enumerate(sorted(layers.items())):
        if layer not in doc.layers:
            doc.layers.add(layer)
        assert band < 9, "the drawing area holds 9 layers"
        assert count <= 90, "a layer holds up to 90 lines"
        for k in range(count):
            x = 40.0 + (k % 30) * 20.0
            y = 40.0 + band * 56.0 + (k // 30) * 15.0
            start = (ox + x * SCALE, oy + y * SCALE)
            end = (ox + (x + 12.0) * SCALE, oy + (y + 8.0) * SCALE)
            model.add_line(start, end, dxfattribs={"layer": layer})


def draw(sheets: Sequence[Sheet]) -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new(FRAME, base_point=(0, 0)))
    model = doc.modelspace()
    for sheet in sheets:
        at = (sheet.column * COLUMN, (2 - sheet.row) * ROW)
        ref = model.add_blockref(FRAME, at, dxfattribs={"xscale": SCALE, "yscale": SCALE,
                                                         "zscale": SCALE})  # fmt: skip
        ref.add_auto_attribs({"DWG_NO": sheet.number, "TITLE": sheet.title[0],
                              "TITLE2": sheet.title[1], "REV": "R0", "DATE": "03.09.2026"})  # fmt: skip
        _content(doc, at, sheet.layers)
    return doc


def build_set(folder: Path, build: Path, files: Mapping[str, Sequence[Sheet]]) -> Path:
    """Write each file (by its path in the set, e.g. `electrical/EL-grid`) as DWG into `folder`
    through the repo's writer built in `build`; returns the set's folder."""
    writer = dwg.build_writer(build)
    for name, sheets in files.items():
        target = folder / f"{name}.dwg"
        target.parent.mkdir(parents=True, exist_ok=True)
        dxf = build / f"{name.replace('/', '-')}.dxf"
        draw(sheets).saveas(dxf)
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(target), VERSION], 120)
    return folder
