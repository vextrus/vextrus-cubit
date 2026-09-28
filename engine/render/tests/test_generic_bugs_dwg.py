"""The Edison check's three generic bugs, each on its own synthetic DWG read by the real reader.

The positions expected come from ezdxf drawing the generator's own document (its virtual entities,
exploded through ezdxf's insert matrices): an oracle independent of `engine.geometry.placement`.
"""

import math
from collections.abc import Callable
from pathlib import Path

import pytest
from ezdxf.document import Drawing as EzdxfDrawing

from engine.fixtures.dwg import generator
from engine.geometry.placement import Walk, world
from engine.read import read
from engine.read.artefact import Entity, ReadArtefact, Text
from engine.text import mtext
from engine.text.mtext import HeightSource

type Fixture = Callable[[str], Path]
pytestmark = pytest.mark.needs_toolchain


def _model(artefact: ReadArtefact) -> str:
    return next(h for h, b in artefact.blocks.items() if b.layout == "Model")


def _exploded_circles(doc: EzdxfDrawing) -> list[tuple[float, float]]:
    centres: list[tuple[float, float]] = []

    def visit(entities: object) -> None:
        for entity in entities:  # type: ignore[attr-defined]
            if entity.dxftype() == "INSERT":
                visit(entity.virtual_entities())
            elif entity.dxftype() == "CIRCLE":
                x, y, _ = entity.ocs().to_wcs(entity.dxf.center)
                centres.append((round(x, 6), round(y, 6)))

    visit(doc.modelspace())
    return sorted(centres)


def test_mirrored_inserts_land_where_autocad_draws_them(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("mirrored_insert"))
    expected = _exploded_circles(generator("mirrored_insert").draw())

    found = []
    for entity, chain in Walk(artefact).entities(_model(artefact)):
        if entity.type == "CIRCLE":
            assert isinstance(entity, Entity)
            centre = entity.values["center"]
            assert isinstance(centre, list)
            x, y, _ = world(entity, chain).apply([float(v) for v in centre])
            found.append((round(x, 6), round(y, 6)))

    assert len(found) == 5
    assert sorted(found) == pytest.approx(expected)
    assert (-5100.0, 0.0) in found  # the mirrored pile: its circle at x = -(5000 + 100)


def test_an_mtext_without_height_in_a_block_gets_one(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("mtext_no_height"))
    heights = mtext.Heights(artefact)
    found = {
        entity.text: heights.resolve(entity, chain)
        for entity, chain in Walk(artefact).entities(_model(artefact))
        if isinstance(entity, Text) and entity.type == "MTEXT"
    }

    assert all(
        t.height is None for t in artefact.entities.values() if isinstance(t, Text) and t.type == "MTEXT"
    )
    assert (found["NO HEIGHT"].local, found["NO HEIGHT"].value) == (3.0, 150.0)
    assert found["NO HEIGHT"].source is HeightSource.BLOCK
    assert found["ALONE"].source is HeightSource.DEFAULT
    assert found["{\\H4;SET INLINE}"].source is HeightSource.INLINE
    assert found["{\\H4;SET INLINE}"].value == 4.0


def test_an_mtext_angle_comes_from_its_direction_vector(dwg_fixture: Fixture) -> None:
    artefact = read(dwg_fixture("mtext_angle"))
    found = {
        entity.text: math.degrees(mtext.world_angle(entity, chain))
        for entity, chain in Walk(artefact).entities(_model(artefact))
        if isinstance(entity, Text)
    }
    assert found == pytest.approx({"B1 (250 x 500)": 30.0, "UP": 135.0})
