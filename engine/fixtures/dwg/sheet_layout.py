"""Geometry on named layers in model space, and a paper-space layout with its own entities.

Invented; no real drawing's content. In millimetres (INSUNITS 4). What the reader must carry: each
entity's type, layer and owner, its geometry values (a bulged polyline, a hatch with a polyline and
an edge boundary, a spline), the layouts in tab order and the header's units.
"""

from ezdxf.document import Drawing

from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    for name in ("WALL", "COLUMN", "HATCH", "GRID"):
        doc.layers.add(name)
    model = doc.modelspace()
    model.add_line((0, 0), (6000, 0), dxfattribs={"layer": "WALL"})
    model.add_line((0, 0), (0, 4000), dxfattribs={"layer": "WALL"})
    model.add_lwpolyline(
        [(0, 0, 0, 0, 0), (300, 0, 0, 0, 0.5), (300, 300, 0, 0, 0)],
        format="xyseb",
        close=True,
        dxfattribs={"layer": "COLUMN"},
    )
    model.add_circle((3000, 2000), 150, dxfattribs={"layer": "COLUMN"})
    model.add_arc((3000, 2000), 600, 0, 90, dxfattribs={"layer": "GRID"})
    model.add_spline([(0, 5000), (1000, 5500), (2000, 5000), (3000, 5500)], dxfattribs={"layer": "GRID"})
    hatch = model.add_hatch(color=1, dxfattribs={"layer": "HATCH"})
    hatch.paths.add_polyline_path([(0, 0), (300, 0), (300, 300), (0, 300)])
    edges = hatch.paths.add_edge_path()
    edges.add_line((1000, 0), (1300, 0))
    edges.add_arc((1300, 150), 150, 270, 90)
    edges.add_line((1300, 300), (1000, 0))
    sheet = doc.layouts.new("Sheet A")
    sheet.add_line((0, 0), (841, 0), dxfattribs={"layer": "GRID"})
    sheet.add_line((841, 0), (841, 594), dxfattribs={"layer": "GRID"})
    return doc
