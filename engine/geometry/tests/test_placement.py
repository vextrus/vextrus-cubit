"""The object-to-world transform, checked against ezdxf's own insert matrix as an independent oracle."""

import itertools
import math
import random

import ezdxf
import numpy as np
import pytest
from ezdxf.filemanagement import new

from engine.geometry.placement import (
    MAX_DEPTH,
    PlacementError,
    Refusal,
    Walk,
    chain,
    chain_transform,
    link,
    ocs,
    world,
)
from engine.read.artefact import Insert
from engine.render.fixtures.artefacts import MODEL, Drawing


def _close(a: tuple[float, ...], b: tuple[float, ...], tolerance: float = 1e-9) -> bool:
    return all(
        math.isclose(x, y, rel_tol=tolerance, abs_tol=tolerance) for x, y in zip(a, b, strict=True)
    )


def _ezdxf_point(**attribs: object) -> tuple[float, float, float]:
    """Where ezdxf puts block point (1, 2, 0) for an insert with these attributes."""
    doc = new()
    base = attribs.pop("base", (0, 0, 0))
    doc.blocks.new("B", base_point=base)
    insert = doc.modelspace().add_blockref("B", attribs.pop("insert"), dxfattribs=attribs)
    x, y, z = insert.matrix44().transform((1, 2, 0))
    return (x, y, z)


@pytest.mark.parametrize("seed", range(40))
def test_an_insert_places_its_block_as_ezdxf_does(seed: int) -> None:
    chooser = random.Random(seed)
    point = (chooser.uniform(-1e4, 1e4), chooser.uniform(-1e4, 1e4), 0.0)
    base = (chooser.uniform(-50, 50), chooser.uniform(-50, 50), 0.0)
    scale = (
        chooser.choice([-1, 1]) * chooser.uniform(0.1, 100),
        chooser.choice([-1, 1]) * chooser.uniform(0.1, 100),
        1.0,
    )
    degrees = chooser.uniform(0, 360)
    extrusion = chooser.choice([(0.0, 0.0, 1.0), (0.0, 0.0, -1.0)])
    expected = _ezdxf_point(
        insert=point, base=base, xscale=scale[0], yscale=scale[1], rotation=degrees, extrusion=extrusion
    )

    drawing = Drawing()
    block = drawing.block("B", base)
    handle = drawing.insert(
        block, point, scale=scale, rotation_radians=math.radians(degrees), extrusion=extrusion
    )
    artefact = drawing.artefact()
    placed = chain_transform(chain(artefact, [handle]))

    assert _close(placed.apply((1, 2, 0)), expected, 1e-7)


def test_a_mirrored_insert_flips_x() -> None:
    drawing = Drawing()
    block = drawing.block("PILE")
    line = drawing.line((1, 0), (2, 0), owner=block)
    handle = drawing.insert(block, (100, 50, 0), extrusion=(0.0, 0.0, -1.0))
    artefact = drawing.artefact()
    inner = chain(artefact, [handle])

    placed = world(artefact.entities[line], inner)

    assert placed.mirrored
    assert _close(placed.apply((1, 0, 0)), (-101.0, 50.0, 0.0))


def test_nested_inserts_compose_outermost_first() -> None:
    drawing = Drawing()
    inner_block = drawing.block("INNER", (1, 1, 0))
    drawing.line((0, 0), (1, 0), owner=inner_block)
    outer_block = drawing.block("OUTER")
    nested = drawing.insert(inner_block, (10, 0, 0), rotation_radians=math.pi / 2, owner=outer_block)
    top = drawing.insert(outer_block, (1000, 0, 0), scale=(2.0, 2.0, 1.0))
    artefact = drawing.artefact()

    placed = chain_transform(chain(artefact, [top, nested]))

    # (2, 1) in INNER: minus its base (1, 0), turned 90° (0, 1), moved to (10, 1), doubled, moved.
    assert _close(placed.apply((2, 1, 0)), (1020.0, 2.0, 0.0))


def test_a_minsert_cell_is_offset_along_its_rotated_unscaled_axes() -> None:
    doc = new()
    doc.blocks.new("B")
    minsert = doc.modelspace().add_blockref("B", (0, 0), dxfattribs={"xscale": 3, "rotation": 90})
    minsert.dxf.row_count, minsert.dxf.column_count = 2, 3
    minsert.dxf.row_spacing, minsert.dxf.column_spacing = 10, 7
    expected = [tuple(v.matrix44().transform((0, 0, 0))) for v in minsert.multi_insert()]

    drawing = Drawing()
    block = drawing.block("B")
    values = {"row_count": 2, "column_count": 3, "row_spacing": 10.0, "column_spacing": 7.0}
    handle = drawing.insert(
        block, scale=(3.0, 1.0, 1.0), rotation_radians=math.pi / 2, values=values, kind="MINSERT"
    )
    artefact = drawing.artefact()
    insert = artefact.entities[handle]
    assert isinstance(insert, Insert)
    found = [
        link(artefact, insert, row, column).transform().apply((0, 0, 0))
        for row in range(2)
        for column in range(3)
    ]
    np.testing.assert_allclose(sorted(found), sorted(expected), atol=1e-9)


def test_an_ocs_entity_is_taken_out_of_its_ocs() -> None:
    drawing = Drawing()
    circle = drawing.entity(
        "CIRCLE", {"center": [5.0, 0.0, 0.0], "radius": 1.0, "extrusion": [0.0, 0.0, -1.0]}
    )
    line = drawing.line((5, 0), (6, 0), extrusion=[0.0, 0.0, -1.0])  # a LINE is in the world already
    artefact = drawing.artefact()

    assert _close(world(artefact.entities[circle]).apply((5, 0, 0)), (-5.0, 0.0, 0.0))
    assert _close(world(artefact.entities[line]).apply((5, 0, 0)), (5.0, 0.0, 0.0))


@pytest.mark.parametrize("extrusion", [(0, 0, 1), (0, 0, -1), (0.6, 0, 0.8), (0, 1, 0), (1, 1, 1)])
def test_ocs_matches_ezdxf(extrusion: tuple[float, float, float]) -> None:
    expected = ezdxf.math.OCS(extrusion).to_wcs((1, 2, 3))
    assert _close(ocs(extrusion).apply((1, 2, 3)), tuple(expected))


def test_xy_projects_many_points_as_apply_does() -> None:
    placed = chain_transform(()) @ ocs((0.6, 0.0, 0.8))
    points = np.array([[1.0, 2.0], [3.0, -4.0]])
    projected = placed.xy(points, z=1.5)
    np.testing.assert_allclose(projected, [placed.apply((*p, 1.5))[:2] for p in points], atol=1e-12)


# The trust boundary: a crafted file's inserts are refused or bounded, never followed.


def test_an_insert_loop_is_refused_not_followed() -> None:
    drawing = Drawing()
    a = drawing.block("A")
    b = drawing.block("B")
    drawing.insert(b, owner=a)
    drawing.insert(a, owner=b)
    drawing.line((0, 0), (1, 0), owner=b)
    drawing.insert(a)
    walked = Walk(drawing.artefact())

    found = list(walked.entities(MODEL))

    assert walked.refused[Refusal.LOOP] == 1
    assert len(found) == 4  # insert A, insert B, the line, insert A (refused)


def test_a_chain_deeper_than_the_limit_is_refused() -> None:
    drawing = Drawing()
    blocks = [drawing.block(f"B{i}") for i in range(MAX_DEPTH + 5)]
    for outer, inner in itertools.pairwise(blocks):
        drawing.insert(inner, owner=outer)
    drawing.line((0, 0), (1, 0), owner=blocks[-1])
    drawing.insert(blocks[0])
    walked = Walk(drawing.artefact())

    found = list(walked.entities(MODEL))

    assert walked.refused[Refusal.TOO_DEEP] == 1
    assert max(len(c) for _, c in found) == MAX_DEPTH
    assert not any(e.type == "LINE" for e, _ in found)


def test_thousands_deep_is_refused_quickly() -> None:
    drawing = Drawing()
    blocks = [drawing.block(f"B{i}") for i in range(5000)]
    for outer, inner in itertools.pairwise(blocks):
        drawing.insert(inner, owner=outer)
    drawing.insert(blocks[0])
    artefact = drawing.artefact()
    walked = Walk(artefact)

    list(walked.entities(MODEL))

    assert walked.refused[Refusal.TOO_DEEP] == 1
    handles = list(artefact.blocks[blocks[0]].entities) * 5000
    with pytest.raises(PlacementError, match="deeper"):
        chain(artefact, handles)


def test_a_walk_stops_at_its_visit_budget() -> None:
    drawing = Drawing()
    block = drawing.block("MANY")
    for i in range(100):
        drawing.line((i, 0), (i, 1), owner=block)
    for _ in range(100):
        drawing.insert(block)
    walked = Walk(drawing.artefact(), max_visits=1000)

    found = list(walked.entities(MODEL))

    assert walked.visits == 1000  # entities and the inserts' cells alike
    assert len(found) < 1000
    assert walked.refused[Refusal.VISIT_LIMIT] == 1


def test_a_minsert_of_too_many_cells_is_drawn_once() -> None:
    drawing = Drawing()
    block = drawing.block("B")
    drawing.line((0, 0), (1, 0), owner=block)
    values = {"row_count": 100_000, "column_count": 100_000, "row_spacing": 1.0, "column_spacing": 1.0}
    drawing.insert(block, values=values, kind="MINSERT")
    walked = Walk(drawing.artefact())

    found = list(walked.entities(MODEL))

    assert walked.refused[Refusal.TOO_MANY_CELLS] == 1
    assert sum(e.type == "LINE" for e, _ in found) == 1


def test_a_chain_that_is_broken_or_loops_raises() -> None:
    drawing = Drawing()
    a = drawing.block("A")
    b = drawing.block("B")
    inner = drawing.insert(b, owner=a)
    top = drawing.insert(a)
    stray = drawing.insert(a)
    artefact = drawing.artefact()

    assert len(chain(artefact, [top, inner])) == 2
    with pytest.raises(PlacementError, match="not in the block"):
        chain(artefact, [stray, top])
    with pytest.raises(PlacementError, match="not an insert"):
        chain(artefact, [MODEL])
    loop = drawing.insert(a, owner=b)
    with pytest.raises(PlacementError, match="inside itself"):
        chain(drawing.artefact(), [top, inner, loop])


def test_attributes_come_after_their_insert_in_its_space() -> None:
    drawing = Drawing()
    block = drawing.block("TB")
    top = drawing.insert(block, (10, 0, 0))
    attrib = drawing.attrib(top, "A-01", (12, 1, 0))
    found = list(Walk(drawing.artefact()).entities(MODEL))

    assert [(e.handle, len(c)) for e, c in found] == [(top, 0), (attrib, 0)]


def test_nested_minserts_of_empty_blocks_are_bounded_by_the_visit_budget() -> None:
    """The placement refuter's attack: 100 x 100 cells of 100 x 100 cells of nothing (10^8 cells)."""
    drawing = Drawing()
    empty = drawing.block("C")
    middle = drawing.block("B")
    grid = {"row_count": 100, "column_count": 100, "row_spacing": 1.0, "column_spacing": 1.0}
    drawing.insert(empty, owner=middle, values=grid, kind="MINSERT")
    drawing.insert(middle, values=grid, kind="MINSERT")
    walked = Walk(drawing.artefact(), max_visits=50_000)

    list(walked.entities(MODEL))

    assert walked.visits == 50_000
    assert walked.refused[Refusal.VISIT_LIMIT] == 1


def test_a_walk_stops_when_its_caller_says_so() -> None:
    drawing = Drawing()
    many = drawing.block("MANY")
    drawing.line((0, 0), (1, 0), owner=many)
    grid = {"row_count": 100, "column_count": 100, "row_spacing": 1.0, "column_spacing": 1.0}
    drawing.insert(many, values=grid, kind="MINSERT")
    walked = Walk(drawing.artefact(), stop=lambda: True)

    list(walked.entities(MODEL))

    assert walked.visits == 1024
    assert walked.refused[Refusal.STOPPED] == 1


def test_a_block_inserting_the_block_walked_from_is_a_loop() -> None:
    drawing = Drawing()
    drawing.line((0, 0), (1, 0))
    drawing.insert(MODEL)
    walked = Walk(drawing.artefact())

    found = [(e.type, len(c)) for e, c in walked.entities(MODEL)]

    assert found == [("LINE", 0), ("INSERT", 0)]
    assert walked.refused[Refusal.LOOP] == 1
