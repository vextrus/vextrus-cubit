"""Ticket 160's synthetic sheets: invented model-space frames, drawn with ezdxf and written to DWG by
the repo's own writer (engine/fixtures/dwg), in the test's temporary folder. No office's convention,
nothing from a real drawing; it proves mechanics only.

One A3 landscape frame block (`BORDER-A3`, 420 x 297 mm, drawn at paper size, its title block a strip
from x 340, attributed), inserted in model space:

- `T-mm.dwg` (millimetres, INSUNITS 4):
  - T-301: at 1:37 (a scale no standard list holds), unturned.
  - T-302: at 1:45, turned 90 degrees (a landscape frame stood up as a portrait sheet).
  - T-303: at 1:100 (a standard scale), unturned.
  - T-305: T-301's sheet, its frame block (`BORDER-A3-TENTH`) drawn at a tenth of its paper size and
    inserted scaled 370 (the real sets' frames drawn at a fraction of their plotted size): its insert
    gives no paper, so what paper it is on is a reading, not a fact.
- `T-m.dwg` (metres, INSUNITS 6):
  - T-304: at 1:37, the insert scaled 0.037 (the frame's millimetres in a drawing in metres).

Each sheet holds one view: a plan's lines on layer `T160-PLAN` filling `REGION` (paper mm from the
sheet's lower-left corner, as the frame stands in model space's axes) and its title,
"GROUND FLOOR PLAN", `TITLE_GAP` mm under it on layer `T160-TITLE`, drawn in model space's axes.
"""

from dataclasses import dataclass
from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
A3 = (420.0, 297.0)
TITLE = "GROUND FLOOR PLAN"
TITLE_GAP = 14.0
TITLE_HEIGHT = 5.0
PLAN_LAYER = "T160-PLAN"
TITLE_LAYER = "T160-TITLE"


@dataclass(frozen=True)
class Frame:
    number: str
    file: str
    at: tuple[float, float]
    """The insert point, in drawing units."""
    scale: float
    """The insert's scale: drawing units per paper mm."""
    turned: bool
    """Turned 90 degrees anticlockwise."""
    region: tuple[float, float, float, float]
    """The plan's lines, on the sheet's paper in mm from its lower-left corner (in model space's axes:
    a turned frame's paper is 297 wide and 420 tall)."""
    fraction: float = 1.0
    """The frame block drawn at this fraction of its paper size (1: at paper size, in mm); its insert
    is scaled `scale / fraction`, so the frame's box in model space is the same."""

    @property
    def paper(self) -> tuple[float, float]:
        """The frame's paper as it lies in model space's axes (width, height), mm."""
        return (A3[1], A3[0]) if self.turned else A3

    def lower_left(self) -> tuple[float, float]:
        """The sheet's lower-left corner in drawing units."""
        x, y = self.at
        return (x - A3[1] * self.scale, y) if self.turned else (x, y)

    def model(self, u: float, v: float) -> tuple[float, float]:
        """A paper point (mm from the sheet's lower-left corner) in drawing units."""
        x0, y0 = self.lower_left()
        return (x0 + u * self.scale, y0 + v * self.scale)


FRAMES = (
    Frame("T-301", "T-mm", (0.0, 0.0), 37.0, False, (30.0, 60.0, 220.0, 190.0)),
    Frame("T-302", "T-mm", (80_000.0, 0.0), 45.0, True, (60.0, 100.0, 200.0, 300.0)),
    Frame("T-303", "T-mm", (100_000.0, 0.0), 100.0, False, (30.0, 60.0, 220.0, 190.0)),
    Frame("T-304", "T-m", (0.0, 0.0), 0.037, False, (30.0, 60.0, 220.0, 190.0)),
    Frame("T-305", "T-mm", (200_000.0, 0.0), 37.0, False, (30.0, 60.0, 220.0, 190.0), fraction=0.1),
)
INSUNITS = {"T-mm": 4, "T-m": 6}


def _frame(block: BlockLayout, k: float = 1.0) -> None:
    """The frame drawn at `k` of its paper size."""
    width, height = A3[0] * k, A3[1] * k
    block.add_lwpolyline([(0, 0), (width, 0), (width, height), (0, height)], close=True)
    x0, y0, x1, y1 = 340.0 * k, 0.0, width, height
    block.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True)
    rows = (("DRAWING NO.", "DWG_NO", 4.0), ("DRAWING TITLE", "TITLE", 3.0), ("REV.", "REV", 3.0),
            ("DATE", "DATE", 2.5))  # fmt: skip
    for i, (label, tag, size) in enumerate(rows):
        top = y1 - (10 + 18 * i) * k
        block.add_text(label, height=2.0 * k).set_placement((x0 + 4 * k, top))
        block.add_attdef(tag, (x0 + 4 * k, top - 7 * k), dxfattribs={"height": size * k})
    block.add_attdef("TITLE2", (x0 + 4 * k, y1 - 39 * k), dxfattribs={"height": 3.0 * k})


def _plan(doc: Drawing, frame: Frame) -> None:
    model = doc.modelspace()
    x0, y0, x1, y1 = frame.region
    plan = {"layer": PLAN_LAYER}
    steps = 6
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i / steps
        model.add_line(frame.model(x, y0), frame.model(x, y1), dxfattribs=plan)
        y = y0 + (y1 - y0) * i / steps
        model.add_line(frame.model(x0, y), frame.model(x1, y), dxfattribs=plan)
    for i in range(1, steps):
        cx, cy = x0 + (x1 - x0) * i / steps, (y0 + y1) / 2
        square = [frame.model(cx - 3, cy - 3), frame.model(cx + 3, cy - 3), frame.model(cx + 3, cy + 3),
                  frame.model(cx - 3, cy + 3)]  # fmt: skip
        model.add_lwpolyline(square, close=True, dxfattribs=plan)
    title = model.add_text(TITLE, height=TITLE_HEIGHT * frame.scale, dxfattribs={"layer": TITLE_LAYER})
    title.set_placement(frame.model(x0, y0 - TITLE_GAP))


def draw(file: str) -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = INSUNITS[file]
    for layer in (PLAN_LAYER, TITLE_LAYER):
        doc.layers.add(layer)
    _frame(doc.blocks.new("BORDER-A3", base_point=(0, 0)))
    _frame(doc.blocks.new("BORDER-A3-TENTH", base_point=(0, 0)), 0.1)
    model = doc.modelspace()
    for frame in FRAMES:
        if frame.file != file:
            continue
        s = frame.scale / frame.fraction
        block = "BORDER-A3" if frame.fraction == 1 else "BORDER-A3-TENTH"
        attribs = {"xscale": s, "yscale": s, "zscale": s, "rotation": 90.0 if frame.turned else 0.0}
        ref = model.add_blockref(block, frame.at, dxfattribs=attribs)
        ref.add_auto_attribs({"DWG_NO": frame.number, "TITLE": "GROUND FLOOR", "TITLE2": "PLAN",
                              "REV": "R0", "DATE": "02.10.2026"})  # fmt: skip
        _plan(doc, frame)
    return doc


def build_set(folder: Path, build: Path) -> dict[str, Path]:
    """Write each file into `folder/structural/` through the repo's writer built in `build`; returns
    each file's path by its name."""
    writer = dwg.build_writer(build)
    target = folder / "structural"
    target.mkdir(parents=True)
    paths: dict[str, Path] = {}
    for file in INSUNITS:
        dxf = build / f"{file}.dxf"
        draw(file).saveas(dxf)
        paths[file] = target / f"{file}.dwg"
        dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(paths[file]), VERSION], 120)
    return paths
