"""Ticket S16-R1's synthetic file: invented column plans, drawn with ezdxf and written to DWG by the
repo's own writer (engine/fixtures/dwg), in the test's temporary folder. No office's convention and
nothing from a real drawing; it proves mechanics only.

One millimetre file (INSUNITS 4), model space only, three plans side by side:

- `plan_1`: a grid of four lettered lines A to D (drawn vertically, at x 0, 6000, 11000, 17000) and
  four numbered lines 1 to 4 (drawn horizontally, at y 0, 5000, 9500, 15000), each with a bubble (a
  circle with its label as text at the centre) at one end; one column outline at B/2 with its mark
  "C1" beside it (not in a bubble).
- `plan_2`: the same plan drawn again 40000 to the right and 3000 up (`PLAN_2_AT`).
- `no_grid`: column outlines and their marks only; no grid line, no bubble.

Every layer name is invented and names nothing (`QX-…`), so no reader can find the grid by a layer
or block name (ADR 0039).

The views the recogniser takes are made by `views()`: the read artefact and an M0 `ViewCandidate`
(a plan, its box around one plan) per plan. `engine.families.types.ViewArtefact`'s fields are K0's
(C4 names the type, not its fields): this file is the one place the tests build one, with keywords
`view_id`, `sheet_id`, `artefact` (the `engine.read.ReadArtefact`) and `view` (the
`engine.recognise.types.ViewCandidate`).
"""

from decimal import Decimal
from pathlib import Path

from ezdxf.document import Drawing
from ezdxf.enums import TextEntityAlignment
from ezdxf.layouts import Modelspace

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
LETTERS = (("A", 0.0), ("B", 6000.0), ("C", 11000.0), ("D", 17000.0))
"""Each lettered grid line: its label and its x (the line is drawn vertically)."""
NUMBERS = (("1", 0.0), ("2", 5000.0), ("3", 9500.0), ("4", 15000.0))
"""Each numbered grid line: its label and its y (the line is drawn horizontally)."""
MARKS = tuple(label for label, _ in LETTERS + NUMBERS)
PLAN_1_AT = (0.0, 0.0)
PLAN_2_AT = (40000.0, 3000.0)
NO_GRID_AT = (80000.0, 0.0)
BUBBLE_RADIUS = 450.0
LINE_LAYER = "QX-7"
BUBBLE_LAYER = "QX-8"
LABEL_LAYER = "QX-9"
COLUMN_LAYER = "QX-3"
INVENTED_LAYERS = (LINE_LAYER, BUBBLE_LAYER, LABEL_LAYER, COLUMN_LAYER)


def spacing(labels: tuple[tuple[str, float], ...], a: str, b: str) -> Decimal:
    at = dict(labels)
    return Decimal(str(at[b] - at[a]))


def _column(model: Modelspace, x: float, y: float, mark: str) -> None:
    half = 200.0
    model.add_lwpolyline(
        [(x - half, y - half), (x + half, y - half), (x + half, y + half), (x - half, y + half)],
        close=True,
        dxfattribs={"layer": COLUMN_LAYER},
    )
    model.add_text(mark, height=250.0, dxfattribs={"layer": COLUMN_LAYER}).set_placement(
        (x + 300.0, y + 300.0)
    )


def _bubble(model: Modelspace, x: float, y: float, label: str) -> None:
    model.add_circle((x, y), BUBBLE_RADIUS, dxfattribs={"layer": BUBBLE_LAYER})
    model.add_text(label, height=400.0, dxfattribs={"layer": LABEL_LAYER}).set_placement(
        (x, y), align=TextEntityAlignment.MIDDLE_CENTER
    )


def _plan(model: Modelspace, at: tuple[float, float]) -> None:
    ox, oy = at
    low, high = -1500.0, 16500.0
    for label, x in LETTERS:
        line = {"layer": LINE_LAYER}
        model.add_line((ox + x, oy + low), (ox + x, oy + high + 1500.0), dxfattribs=line)
        _bubble(model, ox + x, oy + low - BUBBLE_RADIUS, label)
    for label, y in NUMBERS:
        line = {"layer": LINE_LAYER}
        model.add_line((ox + low, oy + y), (ox + high + 3000.0, oy + y), dxfattribs=line)
        _bubble(model, ox + low - BUBBLE_RADIUS, oy + y, label)
    _column(model, ox + 6000.0, oy + 5000.0, "C1")


def _no_grid(model: Modelspace, at: tuple[float, float]) -> None:
    ox, oy = at
    for i, (x, y) in enumerate(((0.0, 0.0), (6000.0, 0.0), (6000.0, 5000.0), (0.0, 5000.0)), start=1):
        _column(model, ox + x, oy + y, f"C{i}")


def draw() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    for name in INVENTED_LAYERS:
        doc.layers.add(name)
    model = doc.modelspace()
    _plan(model, PLAN_1_AT)
    _plan(model, PLAN_2_AT)
    _no_grid(model, NO_GRID_AT)
    return doc


def build(folder: Path, build_dir: Path) -> Path:
    """Write the file into `folder` through the repo's writer built in `build_dir`; returns its path."""
    writer = dwg.build_writer(build_dir)
    dxf = build_dir / "ts16r1_plans.dxf"
    draw().saveas(dxf)
    target = folder / "ts16r1_plans.dwg"
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(target), VERSION], 120)
    return target


def box_of(at: tuple[float, float]) -> tuple[float, float, float, float]:
    ox, oy = at
    return (ox - 3500.0, oy - 3500.0, ox + 20500.0, oy + 18500.0)
