"""MTEXT whose angle is stored only as its direction vector (read as 0°, it left 98 of 139 beam labels
unbound; the Edison check). Invented; no office's convention:
- in model space, an MTEXT with direction (cos 30°, sin 30°, 0);
- `TAG`, holding an MTEXT with direction (0, 1, 0), inserted rotated 45°: 135° in the world.
"""

import math

from ezdxf.document import Drawing

from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    thirty = (math.cos(math.radians(30)), math.sin(math.radians(30)), 0)
    model = doc.modelspace()
    model.add_mtext(
        "B1 (250 x 500)", dxfattribs={"insert": (0, 0, 0), "char_height": 3, "text_direction": thirty}
    )
    tag = doc.blocks.new("TAG", base_point=(0, 0))
    tag.add_mtext("UP", dxfattribs={"insert": (0, 0, 0), "char_height": 3, "text_direction": (0, 1, 0)})
    model.add_blockref("TAG", (500, 0), dxfattribs={"rotation": 45})
    return doc
