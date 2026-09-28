"""Title blocks as block inserts: with attributes, without, mirrored, and nested in a frame.

Invented; no office's convention. What the reader must carry, unresolved:
- `TB-ATTR`: a title block whose number and title are ATTDEFs in the style `TITLE` (font
  `romans.shx`); written as AC1032, LibreDWG 0.14 decodes its ATTRIBs with a null style, which the
  reader takes from the ATTDEF with the same tag;
- `TB-PLAIN`: a title block without attributes, its number plain TEXT;
- an insert of `TB-ATTR` rotated 30° and scaled (2, -2, 1), and one mirrored (extrusion (0, 0, -1));
- `FRAME`, holding an insert of `TB-PLAIN`, inserted in model space: a chain of two inserts.
"""

from ezdxf.document import Drawing

from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    doc.styles.add("TITLE", font="romans.shx")
    doc.layers.add("TITLE-BLOCK")

    attributed = doc.blocks.new("TB-ATTR", base_point=(0, 0))
    attributed.add_lwpolyline([(0, 0), (180, 0), (180, 40), (0, 40)], close=True)
    attributed.add_attdef("SHEET_NO", (10, 25), "X-00", dxfattribs={"height": 5, "style": "TITLE"})
    attributed.add_attdef("SHEET_TITLE", (10, 10), dxfattribs={"height": 3.5, "style": "TITLE"})

    plain = doc.blocks.new("TB-PLAIN", base_point=(0, 0))
    plain.add_lwpolyline([(0, 0), (180, 0), (180, 40), (0, 40)], close=True)
    plain.add_text("X-01", dxfattribs={"height": 5, "style": "TITLE"}).set_placement((10, 25))

    frame = doc.blocks.new("FRAME", base_point=(0, 0))
    frame.add_lwpolyline([(0, 0), (841, 0), (841, 594), (0, 594)], close=True)
    frame.add_blockref("TB-PLAIN", (661, 0))

    model = doc.modelspace()
    layer = {"layer": "TITLE-BLOCK"}
    model.add_blockref("TB-ATTR", (0, 0), dxfattribs=layer).add_auto_attribs(
        {"SHEET_NO": "A-01", "SHEET_TITLE": "GROUND FLOOR PLAN"}
    )
    model.add_blockref(
        "TB-ATTR",
        (1000, 0),
        dxfattribs={**layer, "xscale": 2, "yscale": -2, "zscale": 1, "rotation": 30},
    ).add_auto_attribs({"SHEET_NO": "A-02", "SHEET_TITLE": "FIRST FLOOR PLAN"})
    model.add_blockref(
        "TB-ATTR", (2000, 0), dxfattribs={**layer, "extrusion": (0, 0, -1)}
    ).add_auto_attribs({"SHEET_NO": "A-03", "SHEET_TITLE": "ROOF PLAN"})
    model.add_blockref("FRAME", (0, 1000), dxfattribs=layer)
    return doc
