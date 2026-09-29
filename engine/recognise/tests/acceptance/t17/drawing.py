"""Ticket 17's synthetic set: invented sheets, drawn with ezdxf and written to DWG by the repo's own
writer (engine/fixtures/dwg), in the test's temporary folder. No office's convention, nothing from a
real drawing; it proves mechanics only.

Two files, both millimetres (INSUNITS 4), with one attributed A1 landscape frame block (`BORDER-L`,
841 x 594, its title block a strip from x 700):

- `S-layouts.dwg`: sheets on layouts, the views drawn in paper space.
  - S-201: four views on a 2 x 2 grid (rows unambiguous): a plan, a section, a schedule, a detail.
  - S-202: two plans ("TYPICAL FLOOR BEAM ..." and "1ST FLOOR SLAB ...") and a typical section.
- `S-model.dwg`: frames in model space at 1:100 (the insert scaled 100).
  - S-203: a plan and a section, at the same paper places as S-201's top row.
  - S-204: body lines only, no view title anywhere.

Each view is its drawing (lines filling `REGION`) and its title under it (and, for a plan, a stated
scale beside the title). `EXPECTED` is each view's box on paper, in mm, drawing and title together.
"""

from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
PAPER = (841.0, 594.0)
TOP_LEFT = (40.0, 350.0, 340.0, 560.0)
TOP_RIGHT = (400.0, 350.0, 660.0, 560.0)
BOTTOM_LEFT = (40.0, 60.0, 340.0, 260.0)
BOTTOM_RIGHT = (400.0, 60.0, 660.0, 260.0)
TITLE_GAP = 18.0
"""The title's baseline sits this far below its view's drawing."""
TITLE_HEIGHT = 6.0

LAYOUT_SHEETS = {
    "S-201": (
        ("GROUND FLOOR BEAM", "LAYOUT PLAN"),
        (
            ("GROUND FLOOR BEAM LAYOUT PLAN", TOP_LEFT, "plan"),
            ("SECTION A-A", TOP_RIGHT, "section"),
            ("BEAM SCHEDULE", BOTTOM_LEFT, "schedule"),
            ("TYPICAL BEAM DETAIL", BOTTOM_RIGHT, "detail"),
        ),
    ),
    "S-202": (
        ("TYPICAL FLOOR BEAM &", "1ST FLOOR SLAB PLANS"),
        (
            ("TYPICAL FLOOR BEAM LAYOUT PLAN", TOP_LEFT, "plan"),
            ("1ST FLOOR SLAB LAYOUT PLAN", TOP_RIGHT, "plan"),
            ("TYPICAL BEAM SECTION", BOTTOM_LEFT, "section"),
        ),
    ),
}
"""Each layout sheet: its title's two lines and its views (title, region on paper, kind)."""

MODEL_SCALE = 100.0
MODEL_SHEETS = {
    "S-203": (
        (100_000.0, 0.0),
        ("2ND FLOOR BEAM", "LAYOUT PLAN"),
        (
            ("2ND FLOOR BEAM LAYOUT PLAN", TOP_LEFT, "plan"),
            ("SECTION B-B", TOP_RIGHT, "section"),
        ),
    ),
    "S-204": ((300_000.0, 0.0), ("GENERAL", "ARRANGEMENT"), ((None, TOP_LEFT, "plan"),)),
}
"""Each model-space sheet: the frame's insert point, its title's two lines and its views (a title of
None: the view's drawing is there, no title is written)."""


def expected_box(region: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    """The view's box on paper in mm: its drawing and the title line under it."""
    x0, y0, x1, y1 = region
    return (x0, y0 - TITLE_GAP, x1, y1)


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


def _view(space: object, title: str | None, region: tuple[float, float, float, float],
          kind: str, at: tuple[float, float], scale: float) -> None:  # fmt: skip
    """Draw one view's lines filling `region` (paper mm), its title under it, placed at `at` and
    scaled by `scale` (1 on a layout; the frame's scale in model space)."""
    ox, oy = at
    x0, y0, x1, y1 = region

    def p(x: float, y: float) -> tuple[float, float]:
        return (ox + x * scale, oy + y * scale)

    add_line = space.add_line  # type: ignore[attr-defined]
    add_text = space.add_text  # type: ignore[attr-defined]
    add_poly = space.add_lwpolyline  # type: ignore[attr-defined]
    steps = 6
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i / steps
        add_line(p(x, y0), p(x, y1))
        y = y0 + (y1 - y0) * i / steps
        add_line(p(x0, y), p(x1, y))
    if kind == "plan":
        for i in range(1, steps):
            cx = x0 + (x1 - x0) * i / steps
            cy = y0 + (y1 - y0) / 2
            add_poly([p(cx - 3, cy - 3), p(cx + 3, cy - 3), p(cx + 3, cy + 3), p(cx - 3, cy + 3)],
                     close=True)  # fmt: skip
    if title is not None:
        add_text(title, height=TITLE_HEIGHT * scale).set_placement(p(x0, y0 - TITLE_GAP))
        if kind == "plan":
            add_text("SCALE 1:100", height=3.5 * scale).set_placement(p(x1 - 60, y0 - TITLE_GAP))


def _attributes(number: str, title: tuple[str, str]) -> dict[str, str]:
    return {"DWG_NO": number, "TITLE": title[0], "TITLE2": title[1], "REV": "R0",
            "DATE": "12.08.2026"}  # fmt: skip


def draw_layouts() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)))
    for number, (title, views) in LAYOUT_SHEETS.items():
        layout = doc.layouts.new(number)
        layout.add_blockref("BORDER-L", (0, 0)).add_auto_attribs(_attributes(number, title))
        middle = (PAPER[0] / 2, PAPER[1] / 2)
        layout.add_viewport(center=middle, size=PAPER, view_center_point=middle,
                            view_height=PAPER[1])  # fmt: skip
        for view_title, region, kind in views:
            _view(layout, view_title, region, kind, (0.0, 0.0), 1.0)
    return doc


def draw_model() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)))
    model = doc.modelspace()
    s = MODEL_SCALE
    for number, (at, title, views) in MODEL_SHEETS.items():
        ref = model.add_blockref("BORDER-L", at, dxfattribs={"xscale": s, "yscale": s, "zscale": s})
        ref.add_auto_attribs(_attributes(number, title))
        for view_title, region, kind in views:
            _view(model, view_title, region, kind, at, s)
    return doc


def build_set(folder: Path, build: Path) -> Path:
    """Write both files into `folder/structural/` (the path names the Discipline) through the repo's
    writer built in `build`; returns the set's folder."""
    writer = dwg.build_writer(build)
    target = folder / "structural"
    target.mkdir(parents=True)
    for name, doc in (("S-layouts", draw_layouts()), ("S-model", draw_model())):
        dxf = build / f"{name}.dxf"
        doc.saveas(dxf)
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(target / f"{name}.dwg"), VERSION], 120)
    return folder
