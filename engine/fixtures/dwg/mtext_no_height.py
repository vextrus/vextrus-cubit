"""MTEXT with no height of its own inside a block (step 1 crashed on it; the Edison check).

Invented; no office's convention:
- `LABEL`: an MTEXT stored with no height, beside two TEXTs of height 3 and one of height 5, so its
  block's usual height is 3; inserted in model space at scale 50;
- `BARE`: an MTEXT with no height and nothing else, so only the default is left;
- `INLINE`: an MTEXT with no height whose text sets `\\H4;` before its first character.
"""

from ezdxf.document import Drawing

from engine.fixtures.dwg import NO_HEIGHT, new_drawing

VERSION = "AC1032"


def draw() -> Drawing:
    doc = new_drawing()
    label = doc.blocks.new("LABEL", base_point=(0, 0))
    label.add_mtext("NO HEIGHT", dxfattribs={"insert": (0, 0, 0), "char_height": NO_HEIGHT})
    for i, size in enumerate((3, 3, 5)):
        label.add_text("SIBLING", dxfattribs={"height": size}).set_placement((0, 10 * (i + 1)))
    bare = doc.blocks.new("BARE", base_point=(0, 0))
    bare.add_mtext("ALONE", dxfattribs={"insert": (0, 0, 0), "char_height": NO_HEIGHT})
    inline = doc.blocks.new("INLINE", base_point=(0, 0))
    inline.add_mtext("{\\H4;SET INLINE}", dxfattribs={"insert": (0, 0, 0), "char_height": NO_HEIGHT})
    model = doc.modelspace()
    model.add_blockref("LABEL", (1000, 0), dxfattribs={"xscale": 50, "yscale": 50})
    model.add_blockref("BARE", (2000, 0))
    model.add_blockref("INLINE", (3000, 0))
    return doc
