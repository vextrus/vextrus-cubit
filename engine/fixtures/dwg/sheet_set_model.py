"""Synthetic set B for 13's sheet finder: frames side by side in model space, drawn otherwise than set A.
Invented; no office's convention.

In inches (INSUNITS 1). One frame block without attributes (`SHEET`, A3 landscape at 1:1, its title
block a strip down its right edge, labelled with words the default conventions do not hold: "DRG.
REF." and "SUBJECT", and "SCALE" and "DATE"), its base point far from its geometry. Five inserts: one
plain, one turned a quarter turn, one scaled 48, one mirrored (extrusion -Z) and one turned 30°; each
sheet's number and title are loose TEXT in model space, under their labels, where the insert puts
them. A cover (a plain rectangle holding three lines of text, no title block) stands left of them. A
stale layout's viewport looks at an empty region, over a copy of the frame holding a template's
number and title (AutoCAD's own main viewport drawn first, as a saved layout has). What the finder must
read, with this set's own conventions: 6 sheets (5 numbered,
the cover without a number) and the stale layout proposed out as blank.
"""

import math

from ezdxf.document import Drawing
from ezdxf.layouts.layout import Modelspace
from ezdxf.math import Matrix44

from engine.fixtures.dwg import new_drawing

VERSION = "AC1032"
WIDTH, HEIGHT = 16.54, 11.69
BASE = (-250_000.0, 90_000.0)
"""The frame block's base point, far from its geometry."""
LABELS = (("DRG. REF.", 1.2), ("SUBJECT", 3.2), ("SCALE", 5.2), ("DATE", 7.2))
"""Each label and how far below the strip's top it stands."""
FRAMES = (
    ("B-01", "GROUND FLOOR SLAB LAYOUT", {"insert": (0.0, 0.0)}),
    ("B-02", "TIE BEAM LAYOUT PLAN", {"insert": (40.0, 0.0), "rotation": 90.0}),
    ("B-03", "1ST TO TOP FLOOR COLUMN LAYOUT", {"insert": (100.0, 0.0), "scale": 48.0}),
    ("B-04", "ROOF BEAM DETAILS", {"insert": (2000.0, 0.0), "mirror": True}),
    ("B-05", "STAIR DETAILS", {"insert": (0.0, -60.0), "rotation": 30.0}),
)


def _strip(x: float) -> float:
    return x + 0.85 * WIDTH


def draw() -> Drawing:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 1
    bx, by = BASE
    frame = doc.blocks.new("SHEET", base_point=(bx, by))
    frame.add_lwpolyline(
        [(bx, by), (bx + WIDTH, by), (bx + WIDTH, by + HEIGHT), (bx, by + HEIGHT)], close=True
    )
    frame.add_lwpolyline(
        [(_strip(bx), by), (bx + WIDTH, by), (bx + WIDTH, by + HEIGHT), (_strip(bx), by + HEIGHT)],
        close=True,
    )
    for label, below in LABELS:
        frame.add_text(label, height=0.08).set_placement((_strip(bx) + 0.1, by + HEIGHT - below))
    frame.add_line((bx + 1, by + 1), (bx + 10, by + 8))
    model = doc.modelspace()
    for number, title, placement in FRAMES:
        _sheet(model, number, title, **placement)
    model.add_lwpolyline([(-30, 0), (-30 + 0.6 * WIDTH, 0), (-30 + 0.6 * WIDTH, 0.6 * HEIGHT),
                          (-30, 0.6 * HEIGHT)], close=True)  # fmt: skip
    for i, line in enumerate(("RIVERSIDE TOWER", "STRUCTURAL DRAWINGS", "ISSUED FOR TENDER")):
        model.add_text(line, height=0.3).set_placement((-29, 5 - i))
    stale = doc.paperspace("Layout1")
    stale.add_blockref("SHEET", (0, 0))
    stale.add_text("01", height=0.2).set_placement((_strip(0) + 0.1, HEIGHT - 1.2 - 0.4))
    stale.add_text("TEMPLATE TITLE", height=0.15).set_placement((_strip(0) + 0.1, HEIGHT - 3.2 - 0.4))
    stale.add_viewport(center=(8.3, 5.8), size=(18, 13), view_center_point=(8.3, 5.8), view_height=13)
    empty = (-900_000, -900_000)
    stale.add_viewport(center=(8, 6), size=(10, 8), view_center_point=empty, view_height=50)
    return doc


def _sheet(
    model: Modelspace,
    number: str,
    title: str,
    *,
    insert: tuple[float, float],
    rotation: float = 0.0,
    scale: float = 1.0,
    mirror: bool = False,
) -> None:
    """Insert the frame and write its number and title where the insert puts the places under
    their labels (ezdxf's own insert matrix places them)."""
    attribs: dict[str, object] = {"xscale": scale, "yscale": scale, "zscale": scale}
    attribs["rotation"] = rotation
    if mirror:
        attribs["extrusion"] = (0, 0, -1)
    ref = model.add_blockref("SHEET", insert, dxfattribs=attribs)
    matrix: Matrix44 = ref.matrix44()
    bx, by = BASE
    baseline = matrix.transform_direction((1, 0, 0))
    angle = math.degrees(math.atan2(baseline.y, baseline.x))
    for text, below, size in ((number, 1.2, 0.2), (title, 3.2, 0.15)):
        x, y, _ = matrix.transform((_strip(bx) + 0.1, by + HEIGHT - below - 0.4, 0))
        model.add_text(text, height=size * scale, rotation=angle).set_placement((x, y))
