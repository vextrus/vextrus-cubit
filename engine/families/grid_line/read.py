"""Reading one view's grid from what it draws (`drawn.Drawn`): bubbles, then the line each one heads.

**A bubble** is a circle with exactly one short text inside it, near its centre and smaller than it,
that reads as a grid label: one or two capital letters, or one to three digits, with an optional
prime, a lower-case letter or a decimal part ("A", "AA", "B'", "1", "12", "3a", "2.5"). A column mark
("C1") mixes a letter and digits and is no grid label; a bubble block's attribute is read like any
text, since the walk places it.

**Its line** is the longest straight segment, at least `MIN_LENGTH` radii long, that the bubble's centre
lies on (within `ON_LINE` radii of the line through it) and that ends at the bubble: its near end within
`END_GAP` radii beyond the centre, or reaching into the bubble at most `INTO` radii past it. Collinear
pieces of the same line (a dashed line drawn in pieces) within `JOIN_GAP` radii of each other join it.

**A line drawn as tails only** (a plan that leaves the grid line out across its drawing and keeps a
bubble at each end with a short tail, at least `MIN_TAIL` radii, leaving it): two bubbles of one label
whose tails point at each other (within `FACING`), each centre on the other's tail line and at least
`MIN_LENGTH` radii apart, make the line from one centre to the other. A lone bubble with a tail
(a section or detail callout) is no grid line.

**The grid's direction** is the median of the lines' angles taken modulo a right angle, snapped to zero
when the drawing is square to its axes; each line is then "x" (drawn along the grid's first direction)
or "y" (along its second), and its `offset` is its place across that direction, in drawing units.

**One label, one line**: two bubbles of the same label (one at each end) on one line are one grid line;
two different lines under one label in one view are a `label_twice` finding, the longer line kept.
"""

import math
import re
from collections.abc import Sequence
from dataclasses import dataclass
from statistics import median

import numpy as np

from engine.families.grid_line.drawn import Circle, Drawn, Label

LABEL_SHAPE = re.compile(r"(?:[A-Z]{1,2}|[0-9]{1,3})(?:['\u2032\u2019`]{1,2}|[a-z]|\.[0-9]{1,2})?")
"""A grid label's shape (the module's docstring); a profile's `label_patterns` replace it."""
MIN_LENGTH = 6.0
ON_LINE = 0.25
END_GAP = 4.0
INTO = 1.5
JOIN_GAP = 6.0
MIN_TAIL = 2.0
FACING = 0.999
"""How nearly two tails must point at each other (the cosine of the angle between them, reversed)."""
MAX_NEAR = 512
"""The most label-shaped texts in a circle's column (its width, any height) it is weighed against: a
column crowded past this is a crafted pile, not a drawing, and its circle is skipped, so no circle
costs more than this."""
MAX_BUBBLES = 2_000
"""The most bubbles one view is read with (a plan's grid has tens): the rest are not followed, so a
crafted view costs at most this many passes over its segments."""
TEXT_NEAR = 0.6
"""A label's centre lies within this many radii of its bubble's centre."""
TEXT_MIN, TEXT_MAX = 0.15, 1.7
"""A label's height, in radii of its bubble."""
SNAP = 1e-9
"""Angles nearer a drawing axis than this (radians) are taken as square to it."""
DECIMALS = 6


@dataclass(frozen=True)
class Bubble:
    label: Label
    circle: Circle


@dataclass(frozen=True)
class GridLine:
    mark: str
    axis: str  # "x" | "y"
    offset: float
    start: tuple[float, float]
    end: tuple[float, float]
    bubble: Bubble
    line_entity: int  # the index into Drawn.entities of the longest piece

    @property
    def length(self) -> float:
        return math.dist(self.start, self.end)


@dataclass(frozen=True)
class ViewGrid:
    lines: tuple[GridLine, ...]
    twice: tuple[str, ...]  # labels drawn on two different lines
    angle: float


def is_label(text: str, patterns: Sequence[re.Pattern[str]] = ()) -> bool:
    return any(p.fullmatch(text) for p in patterns) if patterns else bool(LABEL_SHAPE.fullmatch(text))


def bubbles(drawn: Drawn, patterns: Sequence[re.Pattern[str]] = ()) -> list[Bubble]:
    """Each circle holding exactly one grid-label text (the module's docstring)."""
    labels = [t for t in drawn.labels if is_label(t.shown, patterns)]
    if not labels or not drawn.circles:
        return []
    xs = np.array([t.x for t in labels])
    ys = np.array([t.y for t in labels])
    hs = np.array([t.height for t in labels])
    order = np.argsort(xs)
    sorted_x = xs[order]
    found: list[Bubble] = []
    for circle in drawn.circles:
        r = circle.radius
        lo = np.searchsorted(sorted_x, circle.x - TEXT_NEAR * r, side="left")
        hi = np.searchsorted(sorted_x, circle.x + TEXT_NEAR * r, side="right")
        if hi - lo > MAX_NEAR:
            continue
        near = order[lo:hi]
        near = near[np.hypot(xs[near] - circle.x, ys[near] - circle.y) <= TEXT_NEAR * r]
        near = near[(hs[near] >= TEXT_MIN * r) & (hs[near] <= TEXT_MAX * r)]
        shown = {labels[i].shown for i in near}
        if len(shown) == 1:
            nearest = min(near, key=lambda i: math.hypot(xs[i] - circle.x, ys[i] - circle.y))
            found.append(Bubble(labels[int(nearest)], circle))
            if len(found) >= MAX_BUBBLES:
                break
    return found


type Ends = tuple[tuple[float, float], tuple[float, float], int]


def _line_of(drawn: Drawn, bubble: Bubble) -> Ends | None:
    """The line the bubble heads, joined from its collinear pieces: (start, end, entity index)."""
    s = drawn.segments
    if not len(s):
        return None
    c = bubble.circle
    r = c.radius
    p0, p1 = s[:, 0:2], s[:, 2:4]
    d = p1 - p0
    length = np.hypot(d[:, 0], d[:, 1])
    ok = length >= MIN_LENGTH * r
    if not ok.any():
        return None
    safe = np.where(length > 0, length, 1.0)
    u = d / safe[:, None]
    rel = np.array([c.x, c.y]) - p0
    t = rel[:, 0] * u[:, 0] + rel[:, 1] * u[:, 1]  # along, from p0
    off = np.abs(rel[:, 0] * u[:, 1] - rel[:, 1] * u[:, 0])  # across
    beyond = np.maximum(np.maximum(-t, t - length), 0.0)
    inside = np.minimum(t, length - t)
    at_end = np.where((t >= 0) & (t <= length), inside <= INTO * r, beyond <= END_GAP * r)
    ok &= (off <= ON_LINE * r) & at_end
    if not ok.any():
        return None
    best = int(np.argmax(np.where(ok, length, -1.0)))
    direction = u[best]
    origin = p0[best]
    lo, hi = 0.0, float(length[best])
    # Join collinear pieces: both ends on the line, within JOIN_GAP radii of what is held.
    rel0, rel1 = p0 - origin, p1 - origin
    across0 = np.abs(rel0[:, 0] * direction[1] - rel0[:, 1] * direction[0])
    across1 = np.abs(rel1[:, 0] * direction[1] - rel1[:, 1] * direction[0])
    on = (across0 <= ON_LINE * r) & (across1 <= ON_LINE * r)
    a = rel0[on] @ direction
    b = rel1[on] @ direction
    spans = sorted(zip(np.minimum(a, b).tolist(), np.maximum(a, b).tolist(), strict=True))
    grew = True
    while grew:
        grew = False
        for start, end in spans:
            if end >= lo - JOIN_GAP * r and start <= hi + JOIN_GAP * r and (start < lo or end > hi):
                lo, hi = min(lo, start), max(hi, end)
                grew = True
    start = (float(origin[0] + lo * direction[0]), float(origin[1] + lo * direction[1]))
    end = (float(origin[0] + hi * direction[0]), float(origin[1] + hi * direction[1]))
    return start, end, int(drawn.segment_entity[best])


def _tail_of(drawn: Drawn, bubble: Bubble) -> tuple[tuple[float, float], int] | None:
    """The longest short tail leaving the bubble (a segment of at least `MIN_TAIL` radii on the line
    through its centre, its near end within `END_GAP` radii, the centre beyond it): the unit direction
    away from the bubble, and its entity index."""
    s = drawn.segments
    if not len(s):
        return None
    c = bubble.circle
    r = c.radius
    p0, p1 = s[:, 0:2], s[:, 2:4]
    d = p1 - p0
    length = np.hypot(d[:, 0], d[:, 1])
    safe = np.where(length > 0, length, 1.0)
    u = d / safe[:, None]
    rel = np.array([c.x, c.y]) - p0
    t = rel[:, 0] * u[:, 0] + rel[:, 1] * u[:, 1]
    off = np.abs(rel[:, 0] * u[:, 1] - rel[:, 1] * u[:, 0])
    beyond = np.maximum(-t, t - length)
    ok = (length >= MIN_TAIL * r) & (off <= ON_LINE * r) & (beyond >= 0) & (beyond <= END_GAP * r)
    if not ok.any():
        return None
    best = int(np.argmax(np.where(ok, length, -1.0)))
    away = u[best] if t[best] < 0 else -u[best]
    return (float(away[0]), float(away[1])), int(drawn.segment_entity[best])


def _tailed(
    drawn: Drawn, lone: Sequence[Bubble]
) -> list[tuple[Bubble, tuple[float, float], tuple[float, float], int]]:
    """Lines drawn only as tails: two bubbles of one label, each tail pointing at the other's centre,
    at least `MIN_LENGTH` radii apart. The line runs from one centre to the other."""
    tails = {id(b): t for b in lone if (t := _tail_of(drawn, b)) is not None}
    by_label: dict[str, list[Bubble]] = {}
    for bubble in lone:
        if id(bubble) in tails:
            by_label.setdefault(bubble.label.shown, []).append(bubble)
    found = []
    for same in by_label.values():
        for i, first in enumerate(same):
            (ux, uy), entity = tails[id(first)]
            for second in same[i + 1 :]:
                (vx, vy), _ = tails[id(second)]
                r = first.circle.radius
                dx, dy = second.circle.x - first.circle.x, second.circle.y - first.circle.y
                along = dx * ux + dy * uy
                across = abs(dx * uy - dy * ux)
                facing = ux * vx + uy * vy <= -FACING
                if along >= MIN_LENGTH * r and across <= ON_LINE * r and facing:
                    start = (first.circle.x, first.circle.y)
                    end = (second.circle.x, second.circle.y)
                    found.append((first, start, end, entity))
    return found


def _angle(start: tuple[float, float], end: tuple[float, float]) -> float:
    return math.atan2(end[1] - start[1], end[0] - start[0])


def _square(angle: float) -> float:
    """An angle modulo a right angle, in [-pi/4, pi/4)."""
    quarter = math.pi / 2
    return (angle + math.pi / 4) % quarter - math.pi / 4


def read_grid(drawn: Drawn, patterns: Sequence[re.Pattern[str]] = ()) -> ViewGrid:
    headed: list[tuple[Bubble, tuple[float, float], tuple[float, float], int]] = []
    lone: list[Bubble] = []
    for bubble in bubbles(drawn, patterns):
        ends = _line_of(drawn, bubble)
        if ends is not None:
            headed.append((bubble, *ends))
        else:
            lone.append(bubble)
    headed.extend(_tailed(drawn, lone))
    if not headed:
        return ViewGrid((), (), 0.0)
    angle = median(_square(_angle(start, end)) for _, start, end, _ in headed)
    if abs(angle) < SNAP:
        angle = 0.0
    cos, sin = math.cos(angle), math.sin(angle)

    def turned(x: float, y: float) -> tuple[float, float]:
        return (x * cos + y * sin, -x * sin + y * cos) if angle else (x, y)

    by_label: dict[str, list[GridLine]] = {}
    for bubble, start, end, entity in headed:
        (x0, y0), (x1, y1) = turned(*start), turned(*end)
        along_x = abs(x1 - x0) >= abs(y1 - y0)
        axis = "x" if along_x else "y"
        offset = (y0 + y1) / 2 if along_x else (x0 + x1) / 2
        line = GridLine(bubble.label.shown, axis, round(offset, DECIMALS), start, end, bubble, entity)
        by_label.setdefault(line.mark, []).append(line)
    lines: list[GridLine] = []
    twice: list[str] = []
    for mark, found in by_label.items():
        longest = max(found, key=lambda line: line.length)
        tolerance = ON_LINE * longest.bubble.circle.radius
        if any(g.axis != longest.axis or abs(g.offset - longest.offset) > tolerance for g in found):
            twice.append(mark)
        lines.append(longest)
    lines.sort(key=lambda line: (line.axis, line.offset, line.mark))
    return ViewGrid(tuple(lines), tuple(sorted(twice)), angle)
