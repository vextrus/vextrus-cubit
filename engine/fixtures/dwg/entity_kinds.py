"""One of each entity kind a drawing may hold, for the decoder cross-check (ticket 10).

Invented; no office's convention. The two decoders name some kinds differently and expose some
differently (a polyline's vertices, a dimension's kind); this fixture is the evidence for each rule
engine/check/decoders_agree.py writes down. Model space holds the curves, polylines of every kind (2D,
3D, a polyface mesh and a polygon mesh, whose vertices neither artefact lists), the dimensions of every
kind, a LEADER and a MULTILEADER, points, rays, construction lines, faces, solids, a trace, a wipeout,
an MLINE, a tolerance, a MESH, an image, a PDF underlay and a multiple insert (MINSERT), each on a layer
of its own kind; a paper-space layout holds a viewport. What the fixture writer (ACadSharp) drops never
reaches either decoder, so it proves nothing either way.
"""

from ezdxf.document import Drawing
from ezdxf.math import Vec2, Vec3
from ezdxf.render.mleader import ConnectionSide

from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    for name in ("CURVES", "POLYLINES", "DIMENSIONS", "LEADERS", "SOLIDS", "OTHER"):
        doc.layers.add(name)
    model = doc.modelspace()

    curves = {"layer": "CURVES"}
    model.add_line((0, 0), (10, 0), dxfattribs=curves)
    model.add_circle((0, 0), 5, dxfattribs=curves)
    model.add_arc((0, 0), 5, 0, 90, dxfattribs=curves)
    model.add_ellipse((0, 0), major_axis=(10, 0), ratio=0.5, dxfattribs=curves)
    model.add_spline([(0, 0), (5, 5), (10, 0), (15, 5)], dxfattribs=curves)
    model.add_ray((0, 0), (1, 1), dxfattribs=curves)
    model.add_xline((0, 0), (1, 0), dxfattribs=curves)
    model.add_point((3, 3), dxfattribs=curves)

    polylines = {"layer": "POLYLINES"}
    model.add_lwpolyline([(0, 0), (10, 0), (10, 10)], dxfattribs=polylines)
    model.add_polyline2d([(0, 20), (10, 20), (10, 30)], dxfattribs=polylines)
    model.add_polyline3d([(0, 40, 0), (10, 40, 5), (10, 50, 10)], dxfattribs=polylines)
    face = model.add_polyface(dxfattribs=polylines)
    face.append_face([Vec3(0, 60, 0), Vec3(10, 60, 0), Vec3(10, 70, 0), Vec3(0, 70, 0)])
    mesh = model.add_polymesh(size=(2, 2), dxfattribs=polylines)
    for m in range(2):
        for n in range(2):
            mesh.set_mesh_vertex((m, n), (m * 10, 80 + n * 10, m * n))

    dimensions = {"layer": "DIMENSIONS"}
    model.add_linear_dim(base=(0, -10), p1=(0, 0), p2=(10, 0), dxfattribs=dimensions).render()
    model.add_aligned_dim(p1=(0, 0), p2=(10, 10), distance=2, dxfattribs=dimensions).render()
    model.add_radius_dim(center=(0, 0), radius=5, angle=45, dxfattribs=dimensions).render()
    model.add_diameter_dim(center=(0, 0), radius=5, angle=135, dxfattribs=dimensions).render()
    model.add_angular_dim_2l(
        base=(5, 5), line1=((0, 0), (10, 0)), line2=((0, 0), (0, 10)), dxfattribs=dimensions
    ).render()
    model.add_angular_dim_3p(
        base=(5, 5), center=(0, 0), p1=(10, 0), p2=(0, 10), dxfattribs=dimensions
    ).render()
    model.add_ordinate_x_dim(feature_location=(5, 5), offset=(2, 2), dxfattribs=dimensions).render()
    model.add_arc_dim_3p(
        base=(5, 8), center=(0, 0), p1=(10, 0), p2=(0, 10), dxfattribs=dimensions
    ).render()

    leaders = {"layer": "LEADERS"}
    model.add_leader([(0, 0), (5, 5), (10, 5)], dxfattribs=leaders)
    multileader = model.add_multileader_mtext("Standard", dxfattribs=leaders)
    multileader.set_content("NOTE")
    multileader.add_leader_line(ConnectionSide.left, [Vec2(-5, -5)])
    multileader.build(insert=Vec2(0, 0))

    solids = {"layer": "SOLIDS"}
    model.add_3dface([(0, 0, 0), (10, 0, 0), (10, 10, 0), (0, 10, 0)], dxfattribs=solids)
    model.add_solid([(0, 0), (10, 0), (0, 10), (10, 10)], dxfattribs=solids)
    model.add_trace([(20, 0), (30, 0), (20, 10), (30, 10)], dxfattribs=solids)
    model.add_wipeout([(40, 0), (50, 0), (50, 10), (40, 10)], dxfattribs=solids)

    other = {"layer": "OTHER"}
    model.add_mline([(0, 100), (20, 100), (20, 120)], dxfattribs=other)
    model.new_entity(
        "TOLERANCE", dxfattribs={**other, "content": "{\\Fgdt;j}%%v0.1", "insert": (0, 130)}
    )
    mesh3 = model.add_mesh(dxfattribs=other)
    with mesh3.edit_data() as data:
        data.vertices = [(0, 140, 0), (10, 140, 0), (10, 150, 0)]
        data.faces = [(0, 1, 2)]
    image = doc.add_image_def(filename="plan.png", size_in_pixel=(10, 10))
    model.add_image(image, insert=(0, 160), size_in_units=(10, 10), dxfattribs=other)
    underlay = doc.add_underlay_def(filename="plan.pdf", fmt="pdf", name="1")
    model.add_underlay(underlay, insert=(0, 180), dxfattribs=other)

    # A multiple insert: 2 columns by 3 rows of one block.
    cell = doc.blocks.new("CELL", base_point=(0, 0))
    cell.add_circle((0, 0), 1)
    model.add_blockref(
        "CELL",
        (0, 200),
        dxfattribs={**other, "column_count": 2, "row_count": 3, "column_spacing": 5, "row_spacing": 5},
    )

    layout = doc.layouts.new("SHEET")
    layout.add_viewport(center=(100, 100), size=(150, 100), view_center_point=(0, 0), view_height=200)
    return doc
