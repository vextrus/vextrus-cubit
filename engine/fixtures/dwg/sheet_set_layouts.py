"""Synthetic set A for 13's sheet finder: sheets on layouts, an attributed frame block, portrait and
landscape. Invented; no office's convention.

In millimetres (INSUNITS 4). Model space draws two regions of lines and circles. Three layouts, each
a sheet: a landscape A1 frame block (`BORDER-L`, its title block a strip down its right edge) or a
portrait A3 one (`BORDER-P`, a strip along its foot), inserted at the origin with its attributes
filled (`DWG_NO`, `TITLE`, `TITLE2`, `REV`, `DATE`; the title in two lines), AutoCAD's own main
viewport over the paper, and a viewport showing one region. A fourth layout is empty. What the finder
must read: 3 sheets, by layout, their numbers, two-line titles, revision marks and dates from the
attributes.
"""

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"

SHEETS = (
    ("S-101", "BORDER-L", ("PILE CAP", "LAYOUT PLAN"), "R1", "12.08.2026", (10_000.0, 5_000.0)),
    ("S-102", "BORDER-P", ("2ND & 4TH FLOOR", "BEAM LAYOUT PLAN"), "R0", "12.08.2026",
     (55_000.0, 5_000.0)),
    ("S-103", "BORDER-L", ("COLUMN SCHEDULE", ""), "R2", "30.09.2026", (10_000.0, 5_000.0)),
)  # fmt: skip
"""Each sheet: its layout's name and number, its frame, its title's two lines, mark, date, and the
model-space point its viewport looks at."""


def _frame(
    block: BlockLayout, width: float, height: float, strip: tuple[float, float, float, float]
) -> None:
    """A border, a title-block strip, the labels, and the attribute definitions under them."""
    block.add_lwpolyline([(0, 0), (width, 0), (width, height), (0, height)], close=True)
    x0, y0, x1, y1 = strip
    block.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True)
    rows = (("DRAWING NO.", "DWG_NO", 6.0), ("DRAWING TITLE", "TITLE", 4.0), ("REV.", "REV", 4.0),
            ("DATE", "DATE", 3.0), ("SCALE", None, 3.0))  # fmt: skip
    for i, (label, tag, size) in enumerate(rows):
        top = y1 - 12 - 22 * i
        block.add_text(label, height=2.5).set_placement((x0 + 4, top))
        if tag is not None:
            block.add_attdef(tag, (x0 + 4, top - 8), dxfattribs={"height": size})
    block.add_attdef("TITLE2", (x0 + 4, y1 - 12 - 22 - 13), dxfattribs={"height": 4.0})


def draw() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)), 841, 594, (700, 0, 841, 594))
    _frame(doc.blocks.new("BORDER-P", base_point=(0, 0)), 297, 420, (0, 0, 297, 130))
    model = doc.modelspace()
    for cx in (10_000.0, 55_000.0):
        for i in range(12):
            model.add_line((cx - 4000 + 700 * i, 1000), (cx - 4000 + 700 * i, 9000))
            model.add_circle((cx - 3500 + 700 * i, 5000), 150)
    for name, frame, (line1, line2), mark, date, (vx, vy) in SHEETS:
        layout = doc.layouts.new(name)
        ref = layout.add_blockref(frame, (0, 0))
        values = {"DWG_NO": name, "TITLE": line1, "TITLE2": line2, "REV": mark, "DATE": date}
        ref.add_auto_attribs(values)
        landscape = frame == "BORDER-L"
        paper = (841, 594) if landscape else (297, 420)
        middle = (paper[0] / 2, paper[1] / 2)
        layout.add_viewport(center=middle, size=paper, view_center_point=middle, view_height=paper[1])
        centre, size = ((350, 297), (650, 520)) if landscape else ((148, 280), (270, 250))
        layout.add_viewport(center=centre, size=size, view_center_point=(vx, vy), view_height=10_000)
    doc.layouts.new("Spare")
    return doc
