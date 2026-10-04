"""Ticket 162's synthetic files: invented sheets, drawn with ezdxf and written to DWG by the repo's own
writer (engine/fixtures/dwg), in the test's temporary folder. No office's convention, nothing from a
real drawing; it proves mechanics only.

Every file is millimetres (INSUNITS 4) and holds the same three real sheets: an attributed A1
landscape frame block (`BORDER-L`, 841 x 594, its title block a strip from x 700, labelled "DRAWING
NO.", "DRAWING TITLE", "REV.", "DATE") inserted side by side in model space at 1:100, each filled in
and drawing a body of lines. Each file adds one would-be phantom (`PHANTOMS`):

- `empty_layout1`: nothing more; its `Layout1` holds no entity (as ezdxf leaves a new drawing's).
- `template_layout1`: `Layout1` holds a template: AutoCAD's main viewport (drawn first, as a saved
  layout has), the frame inserted with its title block empty (no attribute given), and paper-space
  annotation around it (dimension-like ticks and two small empty boxes), no other viewport.
- `template_layout1_bare`: `Layout1` holds only the main viewport and the frame with its empty title
  block.
- `notes_loose`: a cluster of general-notes lines in model space beside the sheets, no rectangle round
  them.
- `notes_boxed`: the same notes inside a plain closed rectangle the frames' size and shape, with no
  title block, beside the sheets.
"""

from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
PAPER = (841.0, 594.0)
SCALE = 100.0
SHEETS = (
    ("S-301", ("PILE CAP", "LAYOUT PLAN"), (0.0, 0.0)),
    ("S-302", ("GROUND FLOOR BEAM", "LAYOUT PLAN"), (100_000.0, 0.0)),
    ("S-303", ("COLUMN", "SCHEDULE"), (200_000.0, 0.0)),
)
"""Each real sheet: its number, its title's two lines and where its frame is inserted in model space."""
NUMBERS = [number for number, _, _ in SHEETS]
NOTES = (
    "GENERAL NOTES",
    "1. ALL DIMENSIONS ARE IN MILLIMETRES UNLESS NOTED OTHERWISE.",
    "2. DO NOT SCALE FROM THE DRAWING.",
    "3. CONCRETE STRENGTH AS PER THE SPECIFICATION.",
    "4. CLEAR COVER TO REBAR AS PER THE SCHEDULE.",
    "5. LAP LENGTHS AS PER THE DETAIL SHEET.",
    "6. READ WITH THE ARCHITECTURAL DRAWINGS.",
)
NOTES_AT = (300_000.0, 0.0)
"""The notes' place in model space: right of the last sheet, where a next frame would stand."""
PHANTOMS = (
    "empty_layout1",
    "template_layout1",
    "template_layout1_bare",
    "notes_loose",
    "notes_boxed",
)


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


def _attributes(number: str, title: tuple[str, str]) -> dict[str, str]:
    return {"DWG_NO": number, "TITLE": title[0], "TITLE2": title[1], "REV": "R0",
            "DATE": "12.08.2026"}  # fmt: skip


def _sheets(doc: Drawing) -> None:
    model = doc.modelspace()
    s = SCALE
    for number, title, at in SHEETS:
        ref = model.add_blockref("BORDER-L", at, dxfattribs={"xscale": s, "yscale": s, "zscale": s})
        ref.add_auto_attribs(_attributes(number, title))
        ox, oy = at
        for i in range(7):
            x = ox + (40 + 100 * i) * s
            model.add_line((x, oy + 60 * s), (x, oy + 540 * s))
            y = oy + (60 + 80 * i) * s
            model.add_line((ox + 40 * s, y), (ox + 640 * s, y))


def _notes(doc: Drawing, *, boxed: bool) -> None:
    model = doc.modelspace()
    ox, oy = NOTES_AT
    s = SCALE
    if boxed:
        width, height = PAPER
        model.add_lwpolyline(
            [(ox, oy), (ox + width * s, oy), (ox + width * s, oy + height * s), (ox, oy + height * s)],
            close=True,
        )
    for i, line in enumerate(NOTES):
        model.add_text(line, height=(6.0 if i == 0 else 3.5) * s).set_placement(
            (ox + 40 * s, oy + (540 - 14 * i) * s)
        )


def _template(doc: Drawing, *, annotated: bool) -> None:
    layout = doc.paperspace("Layout1")
    middle = (PAPER[0] / 2, PAPER[1] / 2)
    layout.add_viewport(
        center=middle, size=(PAPER[0] * 1.1, PAPER[1] * 1.1), view_center_point=middle,
        view_height=PAPER[1] * 1.1,
    )  # fmt: skip
    layout.add_blockref("BORDER-L", (0, 0))  # its title block left empty: a template's
    if not annotated:
        return
    for i in range(12):  # dimension-like ticks along the top and left edges
        x = 20 + 60 * i
        layout.add_line((x, PAPER[1] + 10), (x, PAPER[1] + 20))
        y = 20 + 45 * i
        layout.add_line((-20, y), (-10, y))
    for x0 in (900.0, 1000.0):  # two small empty boxes beside the frame
        layout.add_lwpolyline([(x0, 0), (x0 + 80, 0), (x0 + 80, 110), (x0, 110)], close=True)


def draw(phantom: str) -> Drawing:
    """The three real sheets, and the phantom named (one of `PHANTOMS`)."""
    assert phantom in PHANTOMS, phantom
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)))
    _sheets(doc)
    if phantom == "template_layout1":
        _template(doc, annotated=True)
    elif phantom == "template_layout1_bare":
        _template(doc, annotated=False)
    elif phantom == "notes_loose":
        _notes(doc, boxed=False)
    elif phantom == "notes_boxed":
        _notes(doc, boxed=True)
    return doc


def build_all(folder: Path, build: Path) -> dict[str, Path]:
    """Write each phantom's file into `folder` through the repo's writer built in `build`; returns
    each file's path by phantom."""
    writer = dwg.build_writer(build)
    built = {}
    for phantom in PHANTOMS:
        dxf = build / f"{phantom}.dxf"
        draw(phantom).saveas(dxf)
        target = folder / f"{phantom}.dwg"
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(target), VERSION], 120)
        built[phantom] = target
    return built
