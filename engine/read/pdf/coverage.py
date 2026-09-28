"""How much of a page its pictures cover (the scan rule's measure; engine/read/pdf).

A picture fills the unit square of its CTM, so on the page it is a parallelogram: a corner and two
edges, turned and skewed as the CTM has it. The share is measured on a grid of `GRID` by `GRID` cells
over the page: a cell counts once when its centre lies inside any picture (edges included), so pictures
that overlap are counted once, a turned picture covers what it covers (not its bounding box), and
whatever lies off the page counts nothing. The grid's step is a thousandth of each side, fixed before
any real result: fine enough that a share either side of the scan rule's half is told apart, coarse
enough that a page costs one small array. It runs in the sandboxed child, under its limits.
"""

import math
from collections.abc import Sequence

import numpy as np

GRID = 1000

type Picture = tuple[float, float, float, float, float, float]
"""A corner (x, y) and the two edges from it, (ux, uy) and (vx, vy), in the page's frame."""


def share(pictures: Sequence[Picture], width: float, height: float) -> float:
    """The share of the page, 0 to 1, that the pictures cover."""
    if not pictures or not (width > 0 and height > 0):
        return 0.0
    covered = np.zeros((GRID, GRID), dtype=bool)
    xs = (np.arange(GRID) + 0.5) * (width / GRID)
    ys = (np.arange(GRID) + 0.5) * (height / GRID)
    for ox, oy, ux, uy, vx, vy in pictures:
        det = ux * vy - uy * vx
        if not (math.isfinite(det) and det != 0):
            continue  # a picture drawn with no area covers nothing
        corners_x = (ox, ox + ux, ox + vx, ox + ux + vx)
        corners_y = (oy, oy + uy, oy + vy, oy + uy + vy)
        i0, i1 = np.searchsorted(xs, min(corners_x)), np.searchsorted(xs, max(corners_x), side="right")
        j0, j1 = np.searchsorted(ys, min(corners_y)), np.searchsorted(ys, max(corners_y), side="right")
        if i0 >= i1 or j0 >= j1:
            continue
        dx = xs[None, i0:i1] - ox
        dy = ys[j0:j1, None] - oy
        s = (dx * vy - dy * vx) / det
        t = (dy * ux - dx * uy) / det
        covered[j0:j1, i0:i1] |= (s >= 0) & (s <= 1) & (t >= 0) & (t <= 1)
    return float(covered.mean())
