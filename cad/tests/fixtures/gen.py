"""Author the committed DXF corpus with ezdxf, and nothing else (AS-03, L-CAD-04).

"The vector-PDF fixture is generated inside `cad/` fixtures by a permissive vector writer
(decision D-04); no AGPL library is used in generation either." The same rule holds for
the DXF corpus: the only writer here is ezdxf, MIT, the extractor's own library.

Run it from `cad/`:

    uv run --frozen python tests/fixtures/gen.py

The outputs are committed, so both runtimes and the held-out suites read the same bytes.
Regenerating the drawings means regenerating `fixtures/entitygraph/*.json` from them in
the same commit — the artifact records the file digest, so the two move together.

Every drawing pins its creation stamps, so a regeneration with the same ezdxf produces the
same bytes and the corpus does not churn.
"""

from __future__ import annotations

from pathlib import Path

import ezdxf
from ezdxf import colors
from ezdxf.document import Drawing

HERE = Path(__file__).parent

#: A fixed Julian day, so `$TDCREATE`/`$TDUPDATE` do not make the corpus a moving target.
FROZEN_STAMP = 2461000.5

#: The stray in layouts-strays.dxf sits here, far outside any percentile window.
STRAY_AT = (1_000_000.0, 1_000_000.0)

#: How many clustered entities the stray has to be a stray *among*.
CLUSTER_SIZE = 120

#: Nesting depth of the block chain in inserts.dxf — comfortably past the depth cap of 8.
NEST_DEPTH = 12


def _new(insunits: int) -> Drawing:
    doc = ezdxf.new("R2013", setup=True)
    doc.header["$INSUNITS"] = insunits
    doc.header["$TDCREATE"] = FROZEN_STAMP
    doc.header["$TDUPDATE"] = FROZEN_STAMP
    return doc


def _layers(doc: Drawing) -> None:
    doc.layers.add("WALLS", color=3)
    doc.layers.add("GRID", color=5)
    roof = doc.layers.add("ROOF")
    roof.rgb = (18, 52, 86)


def basic(path: Path) -> None:
    """The plainest drawing that still exercises the vocabulary: units in millimetres."""
    doc = _new(4)
    _layers(doc)
    msp = doc.modelspace()
    msp.add_line((0, 0), (5000, 0), dxfattribs={"layer": "WALLS"})
    msp.add_line((5000, 0), (5000, 3000), dxfattribs={"layer": "WALLS"})
    msp.add_lwpolyline(
        [(0, 0), (5000, 0), (5000, 3000), (0, 3000)],
        close=True,
        dxfattribs={"layer": "ROOF"},
    )
    msp.add_circle((2500, 1500), 400, dxfattribs={"layer": "GRID"})
    msp.add_arc((0, 0), 900, 0, 90, dxfattribs={"layer": "GRID"})
    msp.add_text(
        "GROUND FLOOR",
        height=250,
        dxfattribs={"layer": "WALLS", "insert": (200, 3200)},
    )
    doc.saveas(path)


def units_unmapped(path: Path) -> None:
    """$INSUNITS = 3 (miles) is outside L-CAD-02's closed map: null plus a flag."""
    doc = _new(3)
    _layers(doc)
    msp = doc.modelspace()
    msp.add_line((0, 0), (10, 0), dxfattribs={"layer": "WALLS"})
    msp.add_circle((5, 0), 2, dxfattribs={"layer": "GRID"})
    doc.saveas(path)


def _nested_blocks(doc: Drawing) -> None:
    """A chain of blocks NEST_0 … NEST_11, each holding a line and the next instance."""
    for level in reversed(range(NEST_DEPTH)):
        block = doc.blocks.new(f"NEST_{level}")
        block.add_line((0, 0), (10, 0), dxfattribs={"layer": "GRID"})
        if level + 1 < NEST_DEPTH:
            block.add_blockref(f"NEST_{level + 1}", (1, 1))


def inserts(path: Path) -> None:
    """Block expansion: nesting past the cap, attributes, colour rules, a dimension."""
    doc = _new(4)
    _layers(doc)
    msp = doc.modelspace()

    _nested_blocks(doc)

    # A block whose content states each colour rule: BYLAYER, BYBLOCK, an explicit ACI and
    # a true colour. Resolution happens here, so the app never sees a sentinel.
    palette = doc.blocks.new("PALETTE")
    palette.add_line((0, 0), (10, 0), dxfattribs={"layer": "WALLS", "color": 256})
    palette.add_line((0, 2), (10, 2), dxfattribs={"layer": "WALLS", "color": 0})
    palette.add_line((0, 4), (10, 4), dxfattribs={"layer": "WALLS", "color": 1})
    palette.add_line(
        (0, 6),
        (10, 6),
        dxfattribs={"layer": "WALLS", "true_color": colors.rgb2int((200, 100, 50))},
    )
    # Text inside a block is painted at the instance's scale, so the derived entity's
    # height is a world height and not the block's own.
    palette.add_text("BLOCK LABEL", height=2, dxfattribs={"layer": "WALLS", "insert": (0, 8)})

    tag_block = doc.blocks.new("ROOM_TAG")
    tag_block.add_attdef("ROOM", (0, 0), height=2.5, dxfattribs={"layer": "WALLS"})
    tag_block.add_attdef("AREA", (0, -4), height=2.5, dxfattribs={"layer": "WALLS"})
    tag_block.add_circle((0, 0), 1, dxfattribs={"layer": "GRID"})

    msp.add_blockref("NEST_0", (0, 0), dxfattribs={"layer": "GRID"})
    msp.add_blockref(
        "PALETTE",
        (100, 0),
        dxfattribs={"layer": "WALLS", "xscale": 3, "yscale": 3, "color": 2},
    )
    tag = msp.add_blockref("ROOM_TAG", (200, 0), dxfattribs={"layer": "WALLS"})
    tag.add_auto_attribs({"ROOM": "R-101", "AREA": "18.5 sqm"})

    msp.add_lwpolyline(
        [(0, -50), (60, -50), (60, -20), (0, -20)],
        close=True,
        dxfattribs={"layer": "ROOF"},
    )
    msp.add_text(
        "PLAN AT LEVEL ONE",
        height=5,
        dxfattribs={"layer": "WALLS", "insert": (0, 60)},
    )
    dimension = msp.add_linear_dim(
        base=(0, -70),
        p1=(0, -50),
        p2=(60, -50),
        dimstyle="EZDXF",
        dxfattribs={"layer": "GRID"},
    )
    dimension.render()
    doc.saveas(path)


def layouts_strays(path: Path) -> None:
    """A stray far outside the population, one populated paper layout, one content-less."""
    doc = _new(4)
    _layers(doc)
    msp = doc.modelspace()
    for index in range(CLUSTER_SIZE):
        x = float(index % 12) * 10
        y = float(index // 12) * 10
        msp.add_line((x, y), (x + 8, y + 8), dxfattribs={"layer": "WALLS"})
    msp.add_circle(STRAY_AT, 5, dxfattribs={"layer": "GRID"})

    # The default paper layout becomes the populated one; Sheet2 is left content-less so
    # the drop counter has something real to count.
    doc.layouts.rename("Layout1", "Sheet1")
    sheet = doc.layouts.get("Sheet1")
    sheet.add_lwpolyline(
        [(0, 0), (420, 0), (420, 297), (0, 297)],
        close=True,
        dxfattribs={"layer": "GRID"},
    )
    sheet.add_text("A3 SHEET", height=10, dxfattribs={"layer": "WALLS", "insert": (10, 10)})
    doc.layouts.new("Sheet2")
    doc.saveas(path)


def flatten_cap(path: Path) -> None:
    """A circle so large that its flattening wants far more than the point cap allows."""
    doc = _new(4)
    _layers(doc)
    msp = doc.modelspace()
    msp.add_circle((0, 0), 10_000_000, dxfattribs={"layer": "GRID"})
    msp.add_line((0, 0), (100, 100), dxfattribs={"layer": "WALLS"})
    doc.saveas(path)


def main() -> None:
    basic(HERE / "basic.dxf")
    inserts(HERE / "inserts.dxf")
    units_unmapped(HERE / "units-unmapped.dxf")
    layouts_strays(HERE / "layouts-strays.dxf")
    flatten_cap(HERE / "flatten-cap.dxf")


if __name__ == "__main__":
    main()
