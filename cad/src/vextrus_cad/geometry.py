"""Geometry the artifact carries: flattened curves, shoelace areas and robust extents (L-CAD-05)."""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from typing import Any

from ezdxf import path as dxfpath

from .parameters import (
    COORDINATE_PRECISION,
    FLATTEN_POINT_CAP,
    FLATTEN_TOLERANCE,
    STRAY_LOWER_PERCENTILE,
    STRAY_UPPER_PERCENTILE,
    STRAY_WINDOW_MARGIN,
)

Point = tuple[float, float]

#: Types whose flattening closes back on its start, so the repeated vertex is dropped.
_CLOSING_EPSILON = 10.0**-COORDINATE_PRECISION


def quantise(value: float) -> float:
    """One coordinate as the artifact spells it: fixed precision, and no negative zero."""
    if not math.isfinite(value):
        raise ValueError(f"non-finite coordinate {value!r}")
    rounded = round(float(value), COORDINATE_PRECISION)
    return 0.0 if rounded == 0.0 else rounded


def flatten(entity: Any) -> tuple[list[Point], bool] | None:
    """An entity's geometry as points, coarsened to the pinned cap.

    Returns the points and whether the cap coarsened them, or None when the entity carries no
    path-shaped geometry at all.

    The cap bounds how *finely* a curve may be described, never how much of it is (L-CAD-05): a
    circle handed back as the first slice of its own outline would be a different drawing, and the
    artifact is frozen per revision and never re-opened (L-CAD-01), so every stage downstream — the
    space's extents, the shoelace area, the paint — would read that fragment as the whole. So a
    flattening past the cap is counted, then walked again and resampled to exactly the cap's worth of
    evenly spaced vertices, first and last among them: the whole curve at a coarser spacing rather
    than the first slice of it at the pinned one.

    Only the type test is answered with None. A ValueError is ezdxf saying that a type it *does*
    build paths for carries malformed geometry, and a ValueError out of `quantise` says the
    flattening left the finite world; either is a real loss of an entity's geometry, so it travels
    on and refuses the sheet by name rather than leaving an entity silently point-less in the
    artifact with no counter to show for it (L-CAD-04, R-TO-001).
    """
    try:
        path = dxfpath.make_path(entity)
    except TypeError:
        return None

    total = sum(1 for _ in path.flattening(FLATTEN_TOLERANCE))
    if total == 0:
        return None
    if total <= FLATTEN_POINT_CAP:
        return [(quantise(v.x), quantise(v.y)) for v in path.flattening(FLATTEN_TOLERANCE)], False

    # `total - 1` over `cap - 1` steps lands on 0 and on the last vertex, and every index between
    # them once: the sample is the cap's worth, spread over the whole curve.
    kept = {
        round(step * (total - 1) / (FLATTEN_POINT_CAP - 1)) for step in range(FLATTEN_POINT_CAP)
    }
    points = [
        (quantise(vertex.x), quantise(vertex.y))
        for index, vertex in enumerate(path.flattening(FLATTEN_TOLERANCE))
        if index in kept
    ]
    return points, True


def drop_closing_vertex(points: list[Point]) -> list[Point]:
    """A closed ring's flattening returns to its start; the artifact spells each vertex once."""
    if len(points) > 2 and _same(points[0], points[-1]):
        return points[:-1]
    return points


def _same(a: Point, b: Point) -> bool:
    return abs(a[0] - b[0]) <= _CLOSING_EPSILON and abs(a[1] - b[1]) <= _CLOSING_EPSILON


def shoelace_area(points: Sequence[Point]) -> float:
    """The area a closed ring encloses, taken over the very points the artifact carries."""
    twice = 0.0
    for i, a in enumerate(points):
        b = points[(i + 1) % len(points)]
        twice += a[0] * b[1] - b[0] * a[1]
    return quantise(abs(twice) / 2.0)


def bounds(points: Iterable[Point]) -> tuple[float, float, float, float] | None:
    """(min x, min y, max x, max y) over some points, or None when there are none."""
    xs: list[float] = []
    ys: list[float] = []
    for x, y in points:
        xs.append(x)
        ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def percentile(sorted_values: Sequence[float], fraction: float) -> float:
    """Linear-interpolated percentile over an already sorted sample."""
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (fraction / 100.0) * (len(sorted_values) - 1)
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return sorted_values[low]
    return sorted_values[low] + (rank - low) * (sorted_values[high] - sorted_values[low])


def inter_percentile_window(values: Sequence[float]) -> tuple[float, float]:
    """L-CAD-05's window: the 2nd-98th inter-percentile range, widened by 25% of its span."""
    ordered = sorted(values)
    low = percentile(ordered, STRAY_LOWER_PERCENTILE)
    high = percentile(ordered, STRAY_UPPER_PERCENTILE)
    margin = (high - low) * STRAY_WINDOW_MARGIN
    return (low - margin, high + margin)


def robust_extents(
    boxes: Sequence[tuple[float, float, float, float]],
) -> tuple[tuple[float, float, float, float] | None, int]:
    """The extents of a space with its stray entities rejected, and how many were rejected.

    A stray is an entity whose bbox *centre* falls outside the inter-percentile window on either
    axis; its geometry takes no part in the extents and it is counted (L-CAD-05).
    """
    if not boxes:
        return (None, 0)

    centres = [((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0) for box in boxes]
    window_x = inter_percentile_window([centre[0] for centre in centres])
    window_y = inter_percentile_window([centre[1] for centre in centres])

    kept = [
        box
        for box, centre in zip(boxes, centres, strict=True)
        if window_x[0] <= centre[0] <= window_x[1] and window_y[0] <= centre[1] <= window_y[1]
    ]
    rejected = len(boxes) - len(kept)
    if not kept:
        return (None, rejected)

    return (
        (
            min(box[0] for box in kept),
            min(box[1] for box in kept),
            max(box[2] for box in kept),
            max(box[3] for box in kept),
        ),
        rejected,
    )
