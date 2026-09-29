"""The committed buffer fixtures and their rasters are what the code makes, and decode as published."""

from pathlib import Path

import numpy as np
import pytest

from engine.render.buffers import SheetBuffers
from engine.render.fixtures import make
from engine.render.raster import Raster, rasterise

HERE = make.HERE


@pytest.mark.parametrize("name", sorted(make.FIXTURES))
def test_the_committed_buffer_is_what_the_code_makes(name: str) -> None:
    committed = SheetBuffers.from_bytes((HERE / f"{name}.bin").read_bytes())
    fresh = make.make(name)

    assert committed.paper == fresh.paper
    assert committed.strings == fresh.strings
    assert committed.chains == fresh.chains
    assert committed.stats == fresh.stats
    for field in ("primitives", "lines", "triangles", "glyphs", "atlas_glyphs", "fonts"):
        a, b = getattr(committed, field), getattr(fresh, field)
        assert len(a) == len(b), field
        for column in a.dtype.names:
            np.testing.assert_allclose(a[column], b[column], atol=1e-3, err_msg=f"{field}.{column}")
    assert committed.atlas.shape == fresh.atlas.shape
    assert np.abs(committed.atlas.astype(int) - fresh.atlas.astype(int)).max(initial=0) <= 1


@pytest.mark.parametrize(("name", "density"), [(n, d) for n, ds in make.IMAGES.items() for d in ds])
def test_the_committed_raster_is_what_the_code_draws(name: str, density: float) -> None:
    committed = Raster.from_png((HERE / f"{name}@{density:g}.png").read_bytes(), density)
    fresh = rasterise(SheetBuffers.from_bytes((HERE / f"{name}.bin").read_bytes()), density)
    assert committed.pixels.shape == fresh.pixels.shape
    differ = np.abs(committed.pixels.astype(int) - fresh.pixels.astype(int)) > 2
    assert differ.mean() < 0.001


@pytest.mark.parametrize("part", sorted(make.PARTS))
def test_the_committed_part_raster_is_what_the_code_draws(part: str) -> None:
    density = make.PART_DENSITY
    committed = Raster.from_png((HERE / f"tiny-sheet-{part}@{density:g}.png").read_bytes(), density)
    tiny = SheetBuffers.from_bytes((HERE / "tiny-sheet.bin").read_bytes())
    fresh = rasterise(make.part(tiny, part), density)
    assert committed.pixels.shape == fresh.pixels.shape
    differ = np.abs(committed.pixels.astype(int) - fresh.pixels.astype(int)) > 2
    assert differ.mean() < 0.001
    assert (committed.pixels < 128).any(), "a part drawn alone has ink"


def test_a_part_keeps_only_its_own_records() -> None:
    tiny = make.make("tiny-sheet")
    text, fills = make.part(tiny, "text"), make.part(tiny, "fills")
    assert (len(text.lines), len(text.triangles), len(text.glyphs)) == (0, 0, len(tiny.glyphs))
    assert (len(fills.lines), len(fills.triangles), len(fills.glyphs)) == (0, len(tiny.triangles), 0)


def test_the_fixtures_are_small_and_hold_one_of_each_thing() -> None:
    sizes = {p.name: p.stat().st_size for p in HERE.iterdir() if p.suffix in (".bin", ".png")}
    assert all(size < 100_000 for size in sizes.values()), sizes
    tiny = SheetBuffers.from_bytes((HERE / "tiny-sheet.bin").read_bytes())
    assert len(tiny.lines)
    assert len(tiny.triangles)
    assert len(tiny.glyphs)
    assert len(tiny.fonts)
    assert any(len(chain) == 2 for chain in tiny.chains)  # the mirrored pile inside the rotated cap
    ramp = SheetBuffers.from_bytes((HERE / "lineweight-ramp.bin").read_bytes())
    assert sorted(set(np.round(ramp.lines["weight"].astype(float), 2).tolist())) == list(
        make.LINEWEIGHTS
    )


def test_make_writes_every_fixture(tmp_path: Path) -> None:
    make.main(tmp_path)
    written = {p.name for p in tmp_path.iterdir()}
    expected = (
        {f"{n}.bin" for n in make.FIXTURES}
        | {f"{n}@{d:g}.png" for n, ds in make.IMAGES.items() for d in ds}
        | {f"tiny-sheet-{p}@{make.PART_DENSITY:g}.png" for p in make.PARTS}
    )
    assert written == expected
