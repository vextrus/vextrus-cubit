"""The engine raster: ruling 2's lineweights, fills and text on Paper; a scale that would exhaust memory
refused."""

import numpy as np
import pytest

from engine.recognise.types import Box, SheetCandidate, SheetLocation
from engine.render.buffers import SheetBuffers, build
from engine.render.fixtures.artefacts import Drawing
from engine.render.raster import MAX_PIXELS, Raster, RasterError, rasterise, size


def _sheet(drawing: Drawing) -> SheetBuffers:
    return build(drawing.artefact(), SheetCandidate(SheetLocation(box=Box(0, 0, 297, 210))))


def _row(raster: Raster, y_mm: float) -> np.ndarray:
    row = int((210 - y_mm) * raster.px_per_mm)
    return raster.pixels[row - 3 : row + 4, 40:60]


@pytest.mark.parametrize(
    ("weight", "expected_ink"),
    [
        (13, 0.13 * 4 * 1.1),  # 0.52 px wide at 4 px/mm: a 1 px line at alpha 0.572
        (9, 0.42),  # 0.36 px: never fainter than 0.42
        (35, 1.0),  # 1.4 px: alpha 1.54, capped at 1
    ],
)
def test_a_thin_line_is_one_pixel_at_the_rulings_alpha(weight: int, expected_ink: float) -> None:
    drawing = Drawing()
    drawing.line((10, 100.1), (200, 100.1), lineweight=weight)
    raster = rasterise(_sheet(drawing), 4.0)

    band = _row(raster, 100.1)
    darkest = 1 - band.min() / 255
    assert darkest == pytest.approx(min(expected_ink, 1.0), abs=0.01)
    assert (band < 255).any(axis=1).sum() == 1  # one pixel row


def test_a_line_at_one_and_a_half_pixels_or_more_is_drawn_opaque_at_its_width() -> None:
    drawing = Drawing()
    drawing.line((10, 100), (200, 100), lineweight=100)  # 1 mm: 4 px at 4 px/mm
    raster = rasterise(_sheet(drawing), 4.0)

    column = raster.pixels[:, 100]
    dark = np.flatnonzero(column < 128)
    assert len(dark) == 4
    assert column[dark].max() == 0


def test_fills_are_opaque_and_their_holes_stay_paper() -> None:
    outer = [[10, 10, 0], [110, 10, 0], [110, 110, 0], [10, 110, 0]]
    hole = [[50, 50, 0], [70, 50, 0], [70, 70, 0], [50, 70, 0]]
    drawing = Drawing()
    drawing.entity("HATCH", {"solid_fill": 1, "paths": [
        {"type": "polyline", "flags": 1, "closed": True, "vertices": outer},
        {"type": "polyline", "flags": 16, "closed": True, "vertices": hole},
    ]})  # fmt: skip
    raster = rasterise(_sheet(drawing), 2.0)

    def at(x: float, y: float) -> int:
        return int(raster.pixels[int((210 - y) * 2), int(x * 2)])

    assert (at(30, 30), at(60, 60), at(150, 150)) == (0, 255, 255)


def test_text_is_inked_where_its_letters_are() -> None:
    drawing = Drawing()
    drawing.text("I", (100, 100, 0), height=10, font="arial.ttf")
    raster = rasterise(_sheet(drawing), 4.0)

    ink = np.argwhere(raster.pixels < 128)
    rows, cols = ink[:, 0], ink[:, 1]
    # An "I" 10 mm tall: its ink spans 10 mm of rows above the baseline at y = 100.
    assert (rows.max() - rows.min() + 1) / 4 == pytest.approx(10, abs=0.5)
    assert rows.max() / 4 == pytest.approx(210 - 100, abs=0.5)
    assert 100 * 4 <= cols.min() <= cols.max() <= 104 * 4


def test_the_png_round_trips() -> None:
    raster = rasterise(_sheet(Drawing()), 1.0)
    back = Raster.from_png(raster.to_png(), 1.0)
    assert np.array_equal(back.pixels, raster.pixels)
    assert raster.pixels.shape == (210, 297)


@pytest.mark.parametrize("density", [0, -1, float("nan"), float("inf"), True, "4"])
def test_a_density_that_is_no_positive_number_is_refused(density: object) -> None:
    with pytest.raises(RasterError):
        rasterise(_sheet(Drawing()), density)  # type: ignore[arg-type]


def test_a_scale_that_would_exhaust_memory_is_refused_before_any_memory_is_taken() -> None:
    built = _sheet(Drawing())
    assert size(built, 30.0) == (8_910, 6_300)
    with pytest.raises(RasterError, match="past its"):
        rasterise(built, 1000.0)  # 297,000 x 210,000 px
    per_mm = (MAX_PIXELS / (297 * 210)) ** 0.5
    width, height = size(built, per_mm * 0.99)
    assert width * height <= MAX_PIXELS


def test_the_harness_reads_its_counts() -> None:
    from engine.export import to_json
    from engine.harness import counts_of

    drawing = Drawing()
    drawing.line((0, 10), (100, 10), lineweight=50)
    counts = counts_of(to_json(rasterise(_sheet(drawing), 1.0)))
    assert counts is not None
    assert counts["ink_px"] > 0


# The format refuter's attacks on the raster (28 Sep 2026): bounded, never followed.


def _with_lines(ends: list[tuple[float, float, float, float]], weight: float) -> SheetBuffers:
    built = _sheet(Drawing())
    lines = np.zeros(len(ends), dtype=built.lines.dtype)
    for name, column in zip(("x0", "y0", "x1", "y1"), np.array(ends).T, strict=True):
        lines[name] = column
    lines["weight"] = weight
    built.lines = lines
    return built


def test_values_that_are_not_finite_are_left_out() -> None:
    built = _with_lines([(float("inf"), 0, 1, 1), (float("nan"), 0, 1, 1), (10, 10, 100, 10)], 0.25)
    built.lines["weight"][2] = float("nan")
    tris = np.zeros(1, dtype=built.triangles.dtype)
    tris["x0"] = float("inf")
    built.triangles = tris
    assert rasterise(built, 2.0).pixels.min() == 255


def test_huge_thin_lines_are_cut_to_the_image_first() -> None:
    built = _with_lines([(-1e30, 100 + i * 0.01, 1e30, 100 + i * 0.01) for i in range(2000)], 0.1)
    image = rasterise(built, 4.0)
    assert (image.pixels < 255).any()


def test_a_sheet_drawn_over_itself_too_often_is_refused() -> None:
    built = _with_lines([(0, 0, 297, 210)] * 20_000, 2.11)
    with pytest.raises(RasterError, match="over itself"):
        rasterise(built, 4.0)


def test_glyphs_naming_what_the_atlas_lacks_are_left_out() -> None:
    drawing = Drawing()
    drawing.text("A", (10, 10, 0), font="arial.ttf")
    built = _sheet(drawing)
    built.glyphs["glyph"][0] = 99
    assert rasterise(built, 2.0).pixels.min() == 255
    built = _sheet(drawing)
    built.atlas_glyphs["u0"][0] = 65535
    assert rasterise(built, 2.0).pixels.min() == 255


def test_a_paper_with_a_side_of_no_length_is_refused_before_any_memory() -> None:
    """Review item 4: size() checked the signed product, then clamped each side to at least 1."""
    from dataclasses import replace

    built = _sheet(Drawing())
    built.paper = replace(built.paper, width_mm=-1.0, height_mm=3e8)
    with pytest.raises(RasterError):
        rasterise(built, 4.0)
    built.paper = replace(built.paper, width_mm=1e-9, height_mm=3e8)
    with pytest.raises(RasterError, match="past its"):
        rasterise(built, 4.0)
