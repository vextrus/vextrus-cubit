"""S15-E2's synthetic sheets: invented frames, drawn with ezdxf and written to DWG by the repo's own
writer (engine/fixtures/dwg), in the test's temporary folder. No office's convention, nothing from a
real drawing; they prove mechanics only.

Every sheet is an ISO A1 sheet (841 x 594 mm) holding one plan: its lines on layer `PLAN_LAYER` (a
grid of 6 by 6 bays, a column square at each inner crossing) and its title, "GROUND FLOOR PLAN",
`TITLE_GAP` paper mm under it on layer `TITLE_LAYER`. Frames are on `FRAME_LAYER`.

- `E2-model.dwg` (millimetres, INSUNITS 4): **bordered A1 frames in model space**, the frame block
  drawn at paper size in mm and inserted at 1:100. The block draws the sheet's border, never its
  trimmed edge: `E-401` a border inset 20 mm at the binding edge and 10 mm elsewhere (811 x 574 mm),
  `E-402` one inset 10 mm all round (821 x 574 mm). The title block is a strip down the border's
  right edge, attributed (`DWG_NO`, `TITLE`, `TITLE2`, `REV`, `DATE`).
- `E2-layouts.dwg` (millimetres): **sheets on layouts**, each layout's plot settings an ISO A1 sheet
  (841 x 594 mm, no margins, no plot offset, 1:1), a viewport showing the layout's plan from model
  space at 1:100 (2 mm wider than the plan each side), and the plan's title in paper space:
  - `E-501`: the bordered frame of `E-401`, inserted at (20, 10): the border's place on its sheet;
  - `E-502`: a frame drawn at the trimmed sheet's size (841 x 594) at the origin, and a line drawn
    off the sheet beside it (a stray construction line), which lies on no paper;
  - `E-503`: no frame: the layout draws its viewport and the title, and only its plot settings say
    which sheet it is on;
  - `E-504` and `E-505` (hostile): the frame of `E-502`, with plot settings stating a sheet of no
    size (0 x 0 mm) and one past any sheet's (a kilometre a side).
  - `E-506`: the frame of `E-502` alone, its sheet the one its frame draws and its plot settings
    state alike (the Plot's sheet, `engine/plot/tests/acceptance/ts15e2`).

The frame blocks are defined before any layout: written after the layouts that insert them, this
writer's blocks were read with their polylines' geometry missing.
"""

from dataclasses import dataclass
from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout
from ezdxf.layouts.layout import Paperspace

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
A1 = (841.0, 594.0)
TITLE = "GROUND FLOOR PLAN"
TITLE_GAP = 14.0
TITLE_HEIGHT = 5.0
PLAN_LAYER = "E2-PLAN"
TITLE_LAYER = "E2-TITLE"
FRAME_LAYER = "E2-FRAME"
STRAY_LAYER = "E2-STRAY"
SCALE = 100.0
"""The plans' scale, 1:100: drawing units (mm) a paper mm."""
STRIP = 120.0
"""The title block's width, paper mm, down the border's right edge."""

type Box = tuple[float, float, float, float]
type Line = tuple[tuple[float, float], tuple[float, float]]


@dataclass(frozen=True)
class Sheet:
    number: str
    """Its number: a framed sheet's `DWG_NO`, and a layout sheet's layout name too."""
    file: str
    border: tuple[float, float]
    """The frame block's border, (width, height) in paper mm."""
    from_border: Box
    """The plan's lines, in paper mm from the border's lower-left corner (a frameless layout's: from
    the layout's origin)."""
    at: tuple[float, float] = (0.0, 0.0)
    """The frame insert's point: in drawing units in model space, in paper mm on a layout."""
    framed: bool = True
    plot_size: tuple[float, float] | None = None
    """A layout's plot settings' paper (width, height), in mm, as stated."""
    stray: bool = False

    @property
    def region(self) -> Box:
        """A layout's plan on its sheet: mm from the sheet's lower-left corner, the layout's origin."""
        x0, y0, x1, y1 = self.from_border
        ax, ay = self.at
        return (ax + x0, ay + y0, ax + x1, ay + y1)

    def model(self, u: float, v: float) -> tuple[float, float]:
        """Model space: a point in paper mm from the border's lower-left corner, in drawing units."""
        return (self.at[0] + u * SCALE, self.at[1] + v * SCALE)


PLAN: Box = (40.0, 90.0, 400.0, 390.0)
ON_A1: Box = (60.0, 100.0, 420.0, 400.0)
SHEETS = (
    Sheet("E-401", "E2-model", (811.0, 574.0), PLAN),
    Sheet("E-402", "E2-model", (821.0, 574.0), PLAN, at=(200_000.0, 0.0)),
    Sheet("E-501", "E2-layouts", (811.0, 574.0), PLAN, at=(20.0, 10.0), plot_size=A1),
    Sheet("E-502", "E2-layouts", A1, ON_A1, plot_size=A1, stray=True),
    Sheet("E-503", "E2-layouts", A1, ON_A1, framed=False, plot_size=A1),
    Sheet("E-504", "E2-layouts", A1, ON_A1, plot_size=(0.0, 0.0)),
    Sheet("E-505", "E2-layouts", A1, ON_A1, plot_size=(1e6, 1e6)),
    Sheet("E-506", "E2-layouts", A1, ON_A1, plot_size=A1),
)
FILES = ("E2-model", "E2-layouts")
MODEL_AT = {s.number: (1_000_000.0 + 100_000.0 * i, 0.0) for i, s in enumerate(SHEETS)}
"""Where each layout's plan is drawn in model space (its lower-left corner), apart from each other."""


def sheet(number: str) -> Sheet:
    return next(s for s in SHEETS if s.number == number)


def _rectangle(space: BlockLayout, box: Box, attribs: dict[str, str]) -> None:
    x0, y0, x1, y1 = box
    space.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True, dxfattribs=attribs)


def _block(doc: Drawing, border: tuple[float, float]) -> str:
    """The frame block for `border`, drawn at paper size in mm: the border, the title-block strip, its
    labels and its attribute definitions."""
    name = f"BORDER-{border[0]:g}x{border[1]:g}"
    if name in doc.blocks:
        return name
    block = doc.blocks.new(name, base_point=(0, 0))
    width, height = border
    frame = {"layer": FRAME_LAYER}
    _rectangle(block, (0.0, 0.0, width, height), frame)
    x0, y1 = width - STRIP, height
    _rectangle(block, (x0, 0.0, width, height), frame)
    rows = (("DRAWING NO.", "DWG_NO", 6.0), ("DRAWING TITLE", "TITLE", 4.0), ("REV.", "REV", 4.0),
            ("DATE", "DATE", 3.0))  # fmt: skip
    for i, (label, tag, size) in enumerate(rows):
        top = y1 - 12 - 22 * i
        block.add_text(label, height=2.5, dxfattribs=frame).set_placement((x0 + 4, top))
        block.add_attdef(tag, (x0 + 4, top - 8), dxfattribs={"height": size, "layer": FRAME_LAYER})
    second = {"height": 4.0, "layer": FRAME_LAYER}
    block.add_attdef("TITLE2", (x0 + 4, y1 - 12 - 22 - 13), dxfattribs=second)
    return name


def _values(number: str) -> dict[str, str]:
    return {"DWG_NO": number, "TITLE": "GROUND FLOOR", "TITLE2": "PLAN", "REV": "R0",
            "DATE": "06.10.2026"}  # fmt: skip


def _plan(box: Box) -> list[Line]:
    """A plan's lines over `box` (paper mm): a grid of 6 by 6 bays and a column square, 6 mm a side,
    at each inner crossing."""
    x0, y0, x1, y1 = box
    lines: list[Line] = []
    for i in range(7):
        x = x0 + (x1 - x0) * i / 6
        y = y0 + (y1 - y0) * i / 6
        lines.append(((x, y0), (x, y1)))
        lines.append(((x0, y), (x1, y)))
    for i in range(1, 6):
        for j in range(1, 6):
            cx, cy = x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * j / 6
            c = [(cx - 3, cy - 3), (cx + 3, cy - 3), (cx + 3, cy + 3), (cx - 3, cy + 3)]
            lines += list(zip(c, c[1:] + c[:1], strict=True))
    return lines


def _model_sheet(doc: Drawing, s: Sheet) -> None:
    model = doc.modelspace()
    scaled = {"xscale": SCALE, "yscale": SCALE, "zscale": SCALE}
    ref = model.add_blockref(_block(doc, s.border), s.at, dxfattribs=scaled)
    ref.add_auto_attribs(_values(s.number))
    for a, b in _plan(s.from_border):
        model.add_line(s.model(*a), s.model(*b), dxfattribs={"layer": PLAN_LAYER})
    title = model.add_text(TITLE, height=TITLE_HEIGHT * SCALE, dxfattribs={"layer": TITLE_LAYER})
    title.set_placement(s.model(s.from_border[0], s.from_border[1] - TITLE_GAP))


def _layout_sheet(doc: Drawing, s: Sheet) -> None:
    layout: Paperspace = doc.layouts.new(s.number)
    assert s.plot_size is not None
    layout.page_setup(size=s.plot_size, margins=(0, 0, 0, 0), units="mm", scale=(1, 1), name="ISO_A1")
    if s.framed:
        ref = layout.add_blockref(_block(doc, s.border), s.at)
        ref.add_auto_attribs(_values(s.number))
    if s.stray:
        layout.add_line((A1[0] + 150, -40), (A1[0] + 400, -40), dxfattribs={"layer": STRAY_LAYER})
    x0, y0, x1, y1 = s.region
    mx, my = MODEL_AT[s.number]
    model = doc.modelspace()
    plan = {"layer": PLAN_LAYER}
    for (ax, ay), (bx, by) in _plan((0.0, 0.0, x1 - x0, y1 - y0)):
        model.add_line(
            (mx + ax * SCALE, my + ay * SCALE), (mx + bx * SCALE, my + by * SCALE), dxfattribs=plan
        )
    width, height = x1 - x0 + 4, y1 - y0 + 4
    centre = ((x0 + x1) / 2, (y0 + y1) / 2)
    looks_at = (mx + (x1 - x0) / 2 * SCALE, my + (y1 - y0) / 2 * SCALE)
    layout.add_viewport(
        center=centre, size=(width, height), view_center_point=looks_at, view_height=height * SCALE
    )
    title = layout.add_text(TITLE, height=TITLE_HEIGHT, dxfattribs={"layer": TITLE_LAYER})
    title.set_placement((x0, y0 - TITLE_GAP))


def draw(file: str) -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    for layer in (PLAN_LAYER, TITLE_LAYER, FRAME_LAYER, STRAY_LAYER):
        doc.layers.add(layer)
    mine = [s for s in SHEETS if s.file == file]
    for s in mine:
        _block(doc, s.border)
    for s in mine:
        (_model_sheet if file == "E2-model" else _layout_sheet)(doc, s)
    return doc


def build_set(folder: Path, build: Path) -> dict[str, Path]:
    """Write each file into `folder/structural/` through the repo's writer built in `build` (once:
    `build/writer/Writer.dll`); returns each file's path by its name."""
    writer = build / "writer" / "Writer.dll"
    if not writer.is_file():
        writer = dwg.build_writer(build)
    target = folder / "structural"
    target.mkdir(parents=True)
    paths: dict[str, Path] = {}
    for file in FILES:
        dxf = build / f"{file}.dxf"
        draw(file).saveas(dxf)
        paths[file] = target / f"{file}.dwg"
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(paths[file]), VERSION], 120)
    return paths
