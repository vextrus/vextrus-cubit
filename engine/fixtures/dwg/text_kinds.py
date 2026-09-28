"""The kinds of text the reader must carry exactly as decoded. Invented; no real drawing's words.

- TEXT left-aligned, centred and right-aligned (the aligned ones are drawn from their start point);
- MTEXT with a direction vector (0, 1, 0), never an angle;
- MTEXT with a raw line break (DXF's `^J`, stored as the break itself), which `dwg2dxf` does not keep
  as written: the reader takes text from `dwgread`'s JSON;
- MTEXT inside a block with no height of its own (as on real consultants' sheets).
"""

from ezdxf.document import Drawing
from ezdxf.enums import TextEntityAlignment

from engine.fixtures.dwg import NO_HEIGHT, new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    doc.layers.add("TEXT")
    layer = {"layer": "TEXT"}
    model = doc.modelspace()
    model.add_text("LEFT", dxfattribs={**layer, "height": 2.5}).set_placement((0, 0))
    model.add_text("CENTRED", dxfattribs={**layer, "height": 2.5}).set_placement(
        (100, 0), align=TextEntityAlignment.MIDDLE_CENTER
    )
    model.add_text("RIGHT", dxfattribs={**layer, "height": 2.5}).set_placement(
        (200, 0), align=TextEntityAlignment.BOTTOM_RIGHT
    )
    upright = {**layer, "insert": (0, 50, 0), "char_height": 3, "text_direction": (0, 1, 0)}
    model.add_mtext("B1 (250 x 500)", dxfattribs=upright)
    two_lines = {**layer, "insert": (0, 100, 0), "char_height": 3}
    model.add_mtext("FIRST LINE^JSECOND LINE", dxfattribs=two_lines)
    label = doc.blocks.new("LABEL", base_point=(0, 0))
    label.add_mtext("NO HEIGHT", dxfattribs={"insert": (0, 0, 0), "char_height": NO_HEIGHT})
    model.add_blockref("LABEL", (0, 150), dxfattribs=layer)
    return doc
