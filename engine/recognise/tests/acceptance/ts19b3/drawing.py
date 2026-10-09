"""Ticket S19-B3's synthetic files: invented sheets, drawn with ezdxf and written to DWG by the repo's
own writer (engine/fixtures/dwg), in the test's temporary folder. No office's convention, nothing from a
real drawing; it proves mechanics only.

Every file is millimetres (INSUNITS 4). Its model space holds two real sheets: an attributed A1
landscape frame block (`BORDER-L`, 841 x 594, its title block a strip from x 700, labelled "DRAWING
NO.", "DRAWING TITLE", "REV.", "DATE") inserted side by side at 1:100, each filled in and drawing a
body of lines (`lines_only` holds the bodies only, no frame). Beside them stands a stale layout
(`STALE_TAB`): AutoCAD's main viewport drawn first (as a saved layout has), then `EMPTY_VIEWS`
viewports each looking at a region of model space far from everything drawn, the frame inserted in
paper space with its title block filled (a number of digits only that matches no model-space sheet, a
title and a date), and loose paper lines. Each variant (`FILES`) changes one thing:

- `stale_noted`: `MIN_PAPER_CONTENT + 5` paper lines (notes beside an empty key plan, by count).
- `stale_bare`: 2 paper lines.
- `lines_only`: as `stale_noted`, its model space lines only (no titled frame).
- `named_tab`: as `stale_noted`, the tab named `NAMED_TAB` (a sheet number of the structural prefix).
- `views_a_frame`: as `stale_noted`, its first empty viewport looking at the second sheet's frame.
- `unreadable_view`: as `stale_noted`, its first empty viewport's centre past what is read.
- `notes_main_only`: as `stale_noted` with no viewport but AutoCAD's main one, its title block
  numbered `NOTES_NUMBER` (a notes sheet drawn on a layout).
"""

from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout
from ezdxf.layouts.layout import Paperspace

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing
from engine.recognise.sheets import MIN_PAPER_CONTENT

VERSION = "AC1032"
PAPER = (841.0, 594.0)
SCALE = 100.0
SHEETS = (
    ("S-101", ("PILE CAP", "LAYOUT PLAN"), (0.0, 0.0)),
    ("S-102", ("GROUND FLOOR BEAM", "LAYOUT PLAN"), (100_000.0, 0.0)),
)
"""Each real sheet: its number, its title's two lines and where its frame is inserted in model space."""
NUMBERS = [number for number, _, _ in SHEETS]
STALE_TAB = "Layout1"
NAMED_TAB = "S-901 NOTES"
STALE_NUMBER = "99"
"""The stale layout's number: digits only, no Discipline's prefix, no model-space sheet's."""
NOTES_NUMBER = "S-103"
EMPTY_VIEWS = (
    (-900_000.0, -900_000.0),
    (-900_000.0, -600_000.0),
    (-600_000.0, -900_000.0),
)
"""Where each of the stale layout's viewports (besides the main one) looks: nothing is drawn there."""
FAR = (5e12, 5e12)
"""A viewport centre past what the finder reads (`MAX_COORDINATE`)."""
FILES = (
    "stale_noted",
    "stale_bare",
    "lines_only",
    "named_tab",
    "views_a_frame",
    "unreadable_view",
    "notes_main_only",
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


def _model(doc: Drawing, *, framed: bool) -> None:
    model = doc.modelspace()
    s = SCALE
    for number, title, at in SHEETS:
        if framed:
            ref = model.add_blockref("BORDER-L", at, dxfattribs={"xscale": s, "yscale": s, "zscale": s})
            ref.add_auto_attribs(_attributes(number, title))
        ox, oy = at
        for i in range(7):
            x = ox + (40 + 100 * i) * s
            model.add_line((x, oy + 60 * s), (x, oy + 540 * s))
            y = oy + (60 + 80 * i) * s
            model.add_line((ox + 40 * s, y), (ox + 640 * s, y))


def _stale(doc: Drawing, variant: str) -> None:
    tab = NAMED_TAB if variant == "named_tab" else STALE_TAB
    layout: Paperspace = doc.paperspace(tab) if tab in doc.layouts else doc.layouts.new(tab)
    middle = (PAPER[0] / 2, PAPER[1] / 2)
    layout.add_viewport(
        center=middle, size=(PAPER[0] * 1.1, PAPER[1] * 1.1), view_center_point=middle,
        view_height=PAPER[1] * 1.1,
    )  # fmt: skip
    if variant != "notes_main_only":
        looks = list(EMPTY_VIEWS)
        if variant == "views_a_frame":
            ox, oy = SHEETS[1][2]
            looks[0] = (ox + PAPER[0] * SCALE / 2, oy + PAPER[1] * SCALE / 2)
        elif variant == "unreadable_view":
            looks[0] = FAR
        for i, look in enumerate(looks):
            height = PAPER[1] * SCALE * 1.2 if variant == "views_a_frame" and i == 0 else 5_000.0
            layout.add_viewport(
                center=(80.0 + 180.0 * i, 120.0), size=(150.0, 100.0), view_center_point=look,
                view_height=height,
            )  # fmt: skip
    number = NOTES_NUMBER if variant == "notes_main_only" else STALE_NUMBER
    ref = layout.add_blockref("BORDER-L", (0, 0))
    ref.add_auto_attribs(_attributes(number, ("GENERAL", "ARRANGEMENT")))
    lines = 2 if variant == "stale_bare" else MIN_PAPER_CONTENT + 5
    for i in range(lines):
        y = 560.0 - 12.0 * i
        layout.add_line((40.0, y), (40.0 + 300.0 + 5.0 * i, y))


def draw(variant: str) -> Drawing:
    """The model space and the stale layout of the variant named (one of `FILES`)."""
    assert variant in FILES, variant
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)))
    _model(doc, framed=variant != "lines_only")
    _stale(doc, variant)
    return doc


def build_all(folder: Path, build: Path) -> dict[str, Path]:
    """Write each variant's file into its own folder under `folder` through the repo's writer built in
    `build`; returns each file's path by variant."""
    writer = dwg.build_writer(build)
    built = {}
    for variant in FILES:
        dxf = build / f"{variant}.dxf"
        draw(variant).saveas(dxf)
        target = folder / variant / f"{variant}.dwg"
        target.parent.mkdir()
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(target), VERSION], 120)
        built[variant] = target
    return built
