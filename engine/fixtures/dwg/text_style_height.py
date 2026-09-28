"""Text with no height of its own on a style with a fixed height (#82: the style step of the height).

Invented; no office's convention:
- `FIXED`: a style with a fixed height of 3.7 (unlike ezdxf's 2.5 default and the block's usual 1),
  a width factor of 0.8, an oblique angle of 15°, the font `romans.shx` and the big font
  `bigfont.shx` (names only: no font file is needed to read them);
- `LOOSE`: a style with no fixed height;
- a shape-file entry (`ltypeshp.shx`), which has no name;
- `NOTE`: two TEXTs of height 1 beside an MTEXT and a TEXT on `FIXED` with no height (the style
  gives 3.7) and an MTEXT on `LOOSE` with no height (the block gives 1);
- `TAG`: an ATTDEF on `FIXED` with no height; its insert's ATTRIB, which LibreDWG 0.14 decodes at
  AC1024 and AC1032 with a null style (engine/fixtures/dwg/__init__.py), so its style is its ATTDEF's.
"""

from ezdxf.document import Drawing

from engine.fixtures.dwg import NO_HEIGHT, new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    doc.styles.add("FIXED", font="romans.shx").dxf.update(
        {"height": 3.7, "width": 0.8, "oblique": 15, "bigfont": "bigfont.shx"}
    )
    doc.styles.add("LOOSE", font="romans.shx")
    doc.styles.add_shx("ltypeshp.shx")

    note = doc.blocks.new("NOTE", base_point=(0, 0))
    for i in range(2):
        note.add_text("SIBLING", dxfattribs={"height": 1}).set_placement((0, 10 * (i + 1)))
    fixed = {"insert": (0, 30, 0), "char_height": NO_HEIGHT, "style": "FIXED"}
    note.add_mtext("MTEXT ON FIXED", dxfattribs=fixed)
    note.add_text("TEXT ON FIXED", dxfattribs={"height": NO_HEIGHT, "style": "FIXED"}).set_placement(
        (0, 40)
    )
    loose = {"insert": (0, 50, 0), "char_height": NO_HEIGHT, "style": "LOOSE"}
    note.add_mtext("MTEXT ON LOOSE", dxfattribs=loose)

    tag = doc.blocks.new("TAG", base_point=(0, 0))
    tag.add_attdef("MARK", (0, 0), "M-0", dxfattribs={"height": NO_HEIGHT, "style": "FIXED"})

    model = doc.modelspace()
    model.add_blockref("NOTE", (0, 0))
    model.add_blockref("TAG", (100, 0)).add_auto_attribs({"MARK": "M-1"})
    return doc
