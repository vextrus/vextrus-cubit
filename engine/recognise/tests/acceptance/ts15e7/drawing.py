"""S15-E7's synthetic files (#195): invented sheets, drawn with ezdxf and written to DWG by the repo's
own writer (engine/fixtures/dwg), in the test's temporary folder. No office's convention, nothing from
a real drawing; it proves mechanics only.

Every file is millimetres (INSUNITS 4) and holds one layout, `Notes`, with AutoCAD's main viewport
(drawn first, as a saved layout has) and no other viewport, and an attributed A1 landscape frame block
(`BORDER-L`, 841 x 594, its title block a strip from x 700, labelled "DRAWING NO.", "DRAWING TITLE",
"REV.", "DATE") inserted at the paper's origin. What else the layout holds is the file's (`FILES`):

- `notes_text_block`: the title block filled in (S-901, GENERAL NOTES), and the sheet's notes, forty
  lines of TEXT, drawn inside one block (`NOTES-BLOCK`) inserted once on the layout.
- `notes_mtext_block`: the same title block, and the same forty lines as one MTEXT paragraph inside
  one block inserted once.
- `template`: nothing more, the title block left empty (a template's tab), the frame block itself
  carrying a detailed office logo (a nested block of forty lines) beside its title block.
"""

from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
PAPER = (841.0, 594.0)
LAYOUT = "Notes"
NUMBER = "S-901"
TITLE = ("GENERAL NOTES", "STRUCTURAL")
NOTES = tuple(
    f"{i}. NOTE {i}: CONCRETE, REBAR AND COVER AS PER THE SPECIFICATION." for i in range(1, 41)
)
"""The notes sheet's forty lines (more than any threshold of things drawn a layout could need)."""
FILES = ("notes_text_block", "notes_mtext_block", "template")


def _frame(block: BlockLayout, *, logo: bool) -> None:
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
    if logo:
        block.add_blockref("LOGO", (x0 + 10, 20))


def _logo(block: BlockLayout) -> None:
    """An office's logo drawn in detail: forty short strokes in a 100 x 60 box."""
    for i in range(40):
        x = 2.5 * i
        block.add_line((x, 0), (x + 2.0, 60.0 if i % 2 else 30.0))


def _main_viewport(doc: Drawing) -> None:
    layout = doc.paperspace(LAYOUT)
    middle = (PAPER[0] / 2, PAPER[1] / 2)
    layout.add_viewport(
        center=middle, size=(PAPER[0] * 1.1, PAPER[1] * 1.1), view_center_point=middle,
        view_height=PAPER[1] * 1.1,
    )  # fmt: skip


def _notes_block(doc: Drawing, *, mtext: bool) -> None:
    block = doc.blocks.new("NOTES-BLOCK", base_point=(0, 0))
    if mtext:
        block.add_mtext("\\P".join(NOTES), dxfattribs={"char_height": 3.5}).set_location((40.0, 560.0))
    else:
        for i, line in enumerate(NOTES):
            block.add_text(line, height=3.5).set_placement((40.0, 560.0 - 12.0 * i))


def draw(name: str) -> Drawing:
    """The file named (one of `FILES`)."""
    assert name in FILES, name
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    template = name == "template"
    if template:
        _logo(doc.blocks.new("LOGO", base_point=(0, 0)))
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)), logo=template)
    doc.layouts.new(LAYOUT)
    _main_viewport(doc)
    layout = doc.paperspace(LAYOUT)
    frame = layout.add_blockref("BORDER-L", (0, 0))
    if template:
        return doc
    frame.add_auto_attribs(
        {"DWG_NO": NUMBER, "TITLE": TITLE[0], "TITLE2": TITLE[1], "REV": "R0", "DATE": "01.09.2026"}
    )
    _notes_block(doc, mtext=name == "notes_mtext_block")
    layout.add_blockref("NOTES-BLOCK", (0, 0))
    return doc


def build_all(folder: Path, build: Path) -> dict[str, Path]:
    """Write each file into `folder` through the repo's writer built in `build`; each file's path by
    name."""
    writer = dwg.build_writer(build)
    built = {}
    for name in FILES:
        dxf = build / f"{name}.dxf"
        draw(name).saveas(dxf)
        target = folder / f"{name}.dwg"
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(target), VERSION], 120)
        built[name] = target
    return built
