"""Geometry the artifact carries: flattened curves, shoelace areas and robust extents (L-CAD-05)."""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence

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


def flatten(entity: object) -> tuple[list[Point], bool] | None:
    """An entity's geometry as points, truncated at the pinned cap.

    Returns the points and whether the cap truncated them, or None when the entity carries no
    path-shaped geometry at all.
    """
    try:
        path = dxfpath.make_path(entity)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None

    points: list[Point] = []
    capped = False
    for vertex in path.flattening(FLATTEN_TOLERANCE):
        if len(points) >= FLATTEN_POINT_CAP:
            capped = True
            break
        points.append((quantise(vertex.x), quantise(vertex.y)))
    if not points:
        return None
    return points, capped


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
    """L-CAD-05's window: the 2nd–98th inter-percentile range, widened by 25% of its span."""
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
