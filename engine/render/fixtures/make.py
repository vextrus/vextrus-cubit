"""The committed buffer fixtures and their engine rasters, made from invented drawings.

    uv run --no-sync python -m engine.render.fixtures.make

writes, beside this file:
- `tiny-sheet.bin`: an A5 sheet in model space holding one of each thing the buffers carry: a frame
  at 0.5 mm, lines at 0.13 and 0.35 mm, a dashed line, a circle, a polyline with width (quads), a solid
  and a pattern hatch, Arial text with ⌀, SHX text (single-stroke lines), an MTEXT with a bold run
  and a stacked fraction, an MTEXT at 30° by its direction vector, an MTEXT with no height inside a
  block, and a mirrored insert inside a rotated one;
- `lineweight-ramp.bin`: an A5 sheet of AutoCAD's lineweights from 0.09 mm to 1.0 mm, one 190 mm
  line each, 8 mm apart;
- their engine rasters at the densities in `IMAGES` (`<name>@<px_per_mm>.png`).

The viewer's tests (16) decode the `.bin` files and compare what WebGL draws with the PNGs; 18's F1
scores against the same raster. `engine/render/tests/test_fixtures.py` fails when the committed files
no longer match what this module makes, so they cannot drift from the code. Invented; no real drawing.
"""

import math
import sys
from pathlib import Path

from engine.read.artefact import ReadArtefact
from engine.recognise.types import Box, SheetCandidate, SheetLocation
from engine.render import buffers, raster
from engine.render.fixtures.artefacts import Drawing

HERE = Path(__file__).parent
LINEWEIGHTS = (
    0.09,
    0.13,
    0.15,
    0.18,
    0.20,
    0.25,
    0.30,
    0.35,
    0.40,
    0.50,
    0.53,
    0.60,
    0.70,
    0.80,
    0.90,
    1.00,
)
IMAGES = {"tiny-sheet": (4.0, 8.0), "lineweight-ramp": (4.0, 16.0)}
"""Each fixture's raster densities: the harness's 4 px/mm, and one closer in (the ramp at 4x)."""


def _rectangle(x0: float, y0: float, x1: float, y1: float) -> list[list[float]]:
    return [[x0, y0, 0, 0, 0], [x1, y0, 0, 0, 0], [x1, y1, 0, 0, 0], [x0, y1, 0, 0, 0]]


def tiny_sheet() -> tuple[ReadArtefact, SheetCandidate]:
    d = Drawing()
    d.entity(
        "LWPOLYLINE", {"points": _rectangle(0, 0, 210, 148), "flags": 1, "lineweight": 50}, layer="FRAME"
    )
    d.line((10, 10), (200, 10), lineweight=13)
    d.line((10, 14), (200, 14), lineweight=35)
    d.line((10, 20), (200, 20), linetype="DASHED", lineweight=25)
    d.entity("CIRCLE", {"center": [150.0, 105.0, 0.0], "radius": 15.0, "lineweight": 25})
    wide = [[20, 128, 3, 3, 0], [60, 128, 3, 3, 0.5], [90, 138, 3, 3, 0]]
    d.entity("LWPOLYLINE", {"points": wide, "flags": 0})
    square = [[170, 30, 0], [200, 30, 0], [200, 60, 0], [170, 60, 0]]
    d.entity(
        "HATCH",
        {
            "solid_fill": 1,
            "paths": [{"type": "polyline", "flags": 1, "closed": True, "vertices": square}],
        },
    )
    patch = [[120, 30, 0], [160, 30, 0], [160, 60, 0], [120, 60, 0]]
    d.entity(
        "HATCH",
        {"solid_fill": 0, "pattern_name": "ANSI31", "pattern_scale": 1.0, "pattern_angle": 0.0,
         "paths": [{"type": "polyline", "flags": 1, "closed": True, "vertices": patch}]},
    )  # fmt: skip
    d.text("%%C12 @ 150 BEAM", (15, 40, 0), height=5, font="arial.ttf")
    d.text("ROMANS SHX 45%%D", (15, 52, 0), height=5, font="romans.shx")
    d.text(
        "{\\fArial|b1;B1} (250 x 500)\\PSECOND LINE \\S1/2;",
        (15, 90, 0),
        kind="MTEXT",
        height=4,
        font="arial.ttf",
    )
    thirty = (math.cos(math.radians(30)), math.sin(math.radians(30)), 0.0)
    d.text("AT 30 DEGREES", (110, 70, 0), kind="MTEXT", height=3.5, direction=thirty, font="arial.ttf")
    label = d.block("LABEL")
    d.text("NO HEIGHT", (0, 0, 0), kind="MTEXT", height=None, owner=label, font="arial.ttf")
    d.text("SIBLING", (0, -10, 0), height=3.0, owner=label, font="arial.ttf")
    d.insert(label, (15, 70, 0))
    pile = d.block("PILE")
    d.entity("CIRCLE", {"center": [10.0, 0.0, 0.0], "radius": 3.0}, owner=pile)
    d.line((10, 0), (16, 0), owner=pile)
    cap = d.block("CAP")
    d.insert(pile, (0, 0, 0), owner=cap)
    d.insert(pile, (30, 0, 0), extrusion=(0.0, 0.0, -1.0), owner=cap)
    d.insert(cap, (170, 120, 0), rotation_radians=math.radians(90))
    return d.artefact(), SheetCandidate(SheetLocation(box=Box(0.0, 0.0, 210.0, 148.0)))


def lineweight_ramp() -> tuple[ReadArtefact, SheetCandidate]:
    d = Drawing()
    for i, weight in enumerate(LINEWEIGHTS):
        y = 134 - 8 * i
        d.line((10, y), (200, y), lineweight=round(weight * 100))
    return d.artefact(), SheetCandidate(SheetLocation(box=Box(0.0, 0.0, 210.0, 148.0)))


FIXTURES = {"tiny-sheet": tiny_sheet, "lineweight-ramp": lineweight_ramp}


def make(name: str) -> buffers.SheetBuffers:
    artefact, sheet = FIXTURES[name]()
    return buffers.build(artefact, sheet)


def main(folder: Path = HERE) -> None:
    for name in FIXTURES:
        built = make(name)
        (folder / f"{name}.bin").write_bytes(built.to_bytes())
        for density in IMAGES[name]:
            image = raster.rasterise(built, density)
            (folder / f"{name}@{density:g}.png").write_bytes(image.to_png())


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE)
