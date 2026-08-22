"""Robust extents with stray-entity rejection (L-CAD-05).

"robust extents with stray-entity rejection (bbox centre outside the 2nd–98th
inter-percentile window +25%, the count recorded)". One entity left at the far corner of
the coordinate system — a stray title block, an accidental point at 10^7 — otherwise sets
the sheet's scale and every view of it becomes a dot. The window is computed from the
population of bbox centres, so the drawing decides what "far" means, not a constant.
"""

from __future__ import annotations

from .geometry import BBox, union_bbox

#: The inter-percentile window: the middle 96% of bbox centres on each axis.
LOWER_PERCENTILE = 0.02
UPPER_PERCENTILE = 0.98

#: The window is then enlarged by a quarter of its own span, half at each end.
WINDOW_MARGIN = 0.25

#: Below this many boxes no entity is rejected.
#:
#: The 2nd percentile of fewer than 51 values interpolates *between the lowest two*, so on
#: a small drawing the window excludes the extreme entity by arithmetic alone — a dimension
#: below the plan, the one label above it. Rejection is a claim about a population, and
#: under fifty boxes there is no population to be strange within.
MINIMUM_POPULATION = 51


def percentile(values: list[float], fraction: float) -> float:
    """The linear-interpolated percentile of an unsorted list (the numpy convention)."""
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = fraction * (len(ordered) - 1)
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    weight = position - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


def _window(values: list[float]) -> tuple[float, float]:
    low = percentile(values, LOWER_PERCENTILE)
    high = percentile(values, UPPER_PERCENTILE)
    margin = (high - low) * WINDOW_MARGIN / 2
    return low - margin, high + margin


def robust_extents(boxes: list[BBox]) -> tuple[BBox | None, int]:
    """`(bbox, strays_rejected)` over a layout's boxes; None when the layout has none."""
    if not boxes:
        return None, 0
    if len(boxes) < MINIMUM_POPULATION:
        return union_bbox(boxes), 0
    centres_x = [(box[0] + box[2]) / 2 for box in boxes]
    centres_y = [(box[1] + box[3]) / 2 for box in boxes]
    min_x, max_x = _window(centres_x)
    min_y, max_y = _window(centres_y)
    kept: list[BBox] = []
    strays = 0
    for box, centre_x, centre_y in zip(boxes, centres_x, centres_y, strict=True):
        if min_x <= centre_x <= max_x and min_y <= centre_y <= max_y:
            kept.append(box)
            continue
        strays += 1
    # The median centre is inside the window by construction, so `kept` is never empty
    # while `boxes` is not; the guard is here because an extents of None would silently
    # drop a populated layout.
    return union_bbox(kept if kept else boxes), strays
