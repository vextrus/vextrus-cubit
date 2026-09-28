"""Mirrored, scaled, rotated and nested inserts (mirrored piles landed 77,000 in away without the
object-to-world transform; the Edison check). Invented; no office's convention.

`PILE` is a circle of radius 10 at (100, 0) and a line from (100, 0) to (120, 0), base point (0, 0).
Model space holds it plainly at (0, 0); mirrored (extrusion (0, 0, -1)) at (5000, 0); scaled (2, -2)
and rotated 30° at (10000, 0); and inside `CAP`, a block holding two PILEs (one mirrored), itself
inserted mirrored and rotated 90° at (20000, 0): a chain of two inserts.
"""

from ezdxf.document import Drawing

from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    pile = doc.blocks.new("PILE", base_point=(0, 0))
    pile.add_circle((100, 0), 10)
    pile.add_line((100, 0), (120, 0))
    cap = doc.blocks.new("CAP", base_point=(0, 0))
    cap.add_blockref("PILE", (0, 0))
    cap.add_blockref("PILE", (300, 0), dxfattribs={"extrusion": (0, 0, -1)})
    model = doc.modelspace()
    model.add_blockref("PILE", (0, 0))
    model.add_blockref("PILE", (5000, 0), dxfattribs={"extrusion": (0, 0, -1)})
    model.add_blockref("PILE", (10000, 0), dxfattribs={"xscale": 2, "yscale": -2, "rotation": 30})
    model.add_blockref("CAP", (20000, 0), dxfattribs={"extrusion": (0, 0, -1), "rotation": 90})
    return doc
