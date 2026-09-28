"""How much of a page its pictures cover: overlaps once, a turned one as it lies, off-page nothing."""

import math

import pytest

from engine.read.pdf.coverage import GRID, share

W, H = 1000.0, 500.0


def strip(fraction: float) -> tuple[float, float, float, float, float, float]:
    """A picture from the page's left edge, its full height, `fraction` of its width."""
    return (0.0, 0.0, W * fraction, 0.0, 0.0, H)


@pytest.mark.parametrize(("fraction", "covered"), [(0.5, 0.5), (0.5 + 2 / GRID, 0.502), (0.49, 0.49)])
def test_either_side_of_half_a_page_is_told_apart(fraction: float, covered: float) -> None:
    assert share([strip(fraction)], W, H) == pytest.approx(covered)


def test_pictures_that_overlap_are_counted_once() -> None:
    small = (100.0, 100.0, 100.0, 0.0, 0.0, 100.0)

    assert share([small] * 300, W, H) == pytest.approx(10_000 / (W * H))


def test_a_turned_picture_covers_what_it_covers_not_its_bounding_box() -> None:
    side = 300.0
    c, s = math.cos(math.radians(45)), math.sin(math.radians(45))
    turned = (500.0, 50.0, side * c, side * s, -side * s, side * c)

    assert share([turned], W, H) == pytest.approx(side * side / (W * H), rel=0.01)


def test_what_lies_off_the_page_counts_nothing() -> None:
    beyond = (-500.0, -500.0, 1000.0, 0.0, 0.0, 1000.0)  # its top-right quarter is the page's left half

    assert share([beyond], W, H) == pytest.approx(0.5)


def test_a_picture_with_no_area_or_a_page_with_none_covers_nothing() -> None:
    assert share([(0.0, 0.0, 100.0, 0.0, 200.0, 0.0)], W, H) == 0.0
    assert share([strip(1.0)], 0.0, H) == 0.0
    assert share([], W, H) == 0.0
