"""The title block on paper (17): where its texts stand, ruled out to the lines around them (the
segment part's docstring, "The title block is a view")."""

from collections.abc import Sequence

import numpy as np
from numpy.typing import NDArray

from engine.recognise.views.paper import (
    REFERENCE_MM,
    Bounds,
    _area,
    _bounds,
    _centre,
    _inside,
    _Paper,
    _Text,
)
from engine.recognise.views.titles import _mark, _tokens

RULE_MM = 1.0
"""Lines on one line within this on paper, in mm, are one ruled line (a title block's border drawn in
pieces), and a ruled line this near a title block's texts bounds it."""
CLUSTER_MM = 30.0
"""A frame's own text whose centre lies within this on paper, in mm (an A1's, scaled to the paper), of
the band the title block's values stand in, across or down, is one of its texts."""
MAX_BLOCK_SHARE = 0.4
"""A title block covering more of the paper than this is not read as one (no view is left out for it)."""
MAX_BLOCK_TEXTS = 2_000
"""The most frame texts weighed for a sheet's title block."""
MAX_RULES = 200_000
"""The most straight lines along one axis weighed for a sheet's title block."""


def _title_block(paper: _Paper) -> Bounds | None:
    """The title block's extent on paper: the box the centres of its texts fill (the values 13 read, and
    the frame's own texts in their band within `CLUSTER_MM` of it, down or across, whichever holds
    more of them: a strip's or a corner box's; never a zone mark along the border nor a name in a
    far corner), grown on each side to the nearest ruled line across it (the frame's or the
    sheet's), else to the paper's edge. None when 13 read no value on its paper, or when the box
    would cover more than `MAX_BLOCK_SHARE` of the paper (no title block eats the sheet's drawings),
    then sought from the values alone (a real title block beside far frame notes or a separate
    revision table)."""
    rx0, ry0, rx1, ry1 = paper.region
    unit = max(rx1 - rx0, ry1 - ry0) / REFERENCE_MM
    on_paper = [t for t in paper.block if _inside(_centre(t.box), paper.region)]
    held = [t for t in on_paper if t.placed.entity.handle in paper.values]
    if not held:
        return None
    rest = [
        t
        for t in on_paper
        if t.placed.entity.handle not in paper.values
        and not all(_mark(w) for w in _tokens(t.shown))  # a zone mark ("7", "C") is the border's
    ][:MAX_BLOCK_TEXTS]
    vx0, vy0, vx1, vy1 = _bounds([t.box for t in held])
    gap = CLUSTER_MM * unit
    centres = [_centre(t.box) for t in rest]
    column = [t for t, c in zip(rest, centres, strict=True) if vx0 - gap <= c[0] <= vx1 + gap]
    row = [t for t, c in zip(rest, centres, strict=True) if vy0 - gap <= c[1] <= vy1 + gap]
    band = column if len(column) >= len(row) else row  # the strip's direction holds more of them
    return _ruled_box(paper, [*held, *band]) or _ruled_box(paper, held)  # far notes: its values alone


def _ruled_box(paper: _Paper, held: Sequence[_Text]) -> Bounds | None:
    """The box the texts' centres fill, grown on each side to the nearest ruled line across it, else
    to the paper's edge; none when it covers more than `MAX_BLOCK_SHARE` of the paper."""
    rx0, ry0, rx1, ry1 = paper.region
    unit = max(rx1 - rx0, ry1 - ry0) / REFERENCE_MM
    centres = [_centre(t.box) for t in held]
    ex0, ey0 = min(c[0] for c in centres), min(c[1] for c in centres)
    ex1, ey1 = max(c[0] for c in centres), max(c[1] for c in centres)
    tol = RULE_MM * unit
    lines = np.concatenate([paper.frame, paper.segments]) if len(paper.segments) else paper.frame
    across = _rules(lines, 0, tol)  # (y, x from, x to): lines along x
    down = _rules(lines, 1, tol)  # (x, y from, y to): lines along y
    spans_x = (across[:, 1] <= ex0 + tol) & (across[:, 2] >= ex1 - tol)
    spans_y = (down[:, 1] <= ey0 + tol) & (down[:, 2] >= ey1 - tol)
    top = across[spans_x & (across[:, 0] >= ey1 - tol), 0]
    bottom = across[spans_x & (across[:, 0] <= ey0 + tol), 0]
    left = down[spans_y & (down[:, 0] <= ex0 + tol), 0]
    right = down[spans_y & (down[:, 0] >= ex1 - tol), 0]
    box = (
        float(left.max()) if len(left) else rx0,
        float(bottom.max()) if len(bottom) else ry0,
        float(right.min()) if len(right) else rx1,
        float(top.min()) if len(top) else ry1,
    )
    if _area(box) > MAX_BLOCK_SHARE * (rx1 - rx0) * (ry1 - ry0):
        return None
    return box


def _rules(segments: NDArray[np.float64], axis: int, tol: float) -> NDArray[np.float64]:
    """The straight lines along one axis of the paper (0: x, 1: y), those on one line within `tol` of
    each other joined where they meet or nearly meet: (place across, from, to) rows."""
    a, b = segments[:, axis], segments[:, axis + 2]
    c, d = segments[:, 1 - axis], segments[:, 3 - axis]
    along = np.abs(b - a)
    straight = (along > 0) & (np.abs(d - c) <= 0.01 * along)
    rows = np.stack(
        [(c + d)[straight] / 2, np.minimum(a, b)[straight], np.maximum(a, b)[straight]], axis=1
    )
    rows = rows[np.lexsort((rows[:, 1], np.round(rows[:, 0] / tol)))][:MAX_RULES]
    out: list[list[float]] = []
    for place, lo, hi in rows.tolist():
        last = out[-1] if out else None
        if last is not None and abs(last[0] - place) <= tol and lo <= last[2] + tol:
            last[2] = max(last[2], hi)
        else:
            out.append([place, lo, hi])
    return np.array(out, dtype=np.float64).reshape(-1, 3)
