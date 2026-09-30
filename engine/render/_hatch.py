"""Hatches: their boundaries, a solid fill as triangles, and a pattern as line segments.

A HATCH's values (engine/read/libredwg/dxf.py) hold its boundary paths (polylines with bulges, or
edges: lines, arcs, ellipse arcs and splines) in its OCS, `solid_fill`, and, for a pattern, only its
`pattern_name`, `pattern_scale` and `pattern_angle`: the pattern's own lines are not read, so a pattern
is drawn from the standard definitions of that name (ezdxf's table of AutoCAD's standard patterns,
`ezdxf.tools.pattern`, used at run time and never copied; acadiso.pat's or acad.pat's by the
drawing's units). A name the table lacks is not drawn, and counted.

Both fills follow the **even-odd rule** (a hatch's normal island style: an island inside a boundary is
left empty, and one inside that is filled). The fill is cut into horizontal trapezoids between
consecutive boundary vertices' heights, each two triangles.

**A pathological boundary is bounded, never followed:** more than `MAX_EDGES` edges, a fill whose
sweep would cost more than `MAX_WORK` edge-slab steps, a pattern of more than `MAX_PATTERN_LINES` lines
in one family (a pattern too fine for its area) or `MAX_PATTERN_SEGMENTS` segments, each raise
`TooComplex` and the hatch is not drawn, but counted.
"""

import itertools
import math
from functools import cache
from typing import Any

import numpy as np
from ezdxf.math import BSpline
from ezdxf.tools import pattern as patterns
from numpy.typing import NDArray

from engine.render._shapes import Undrawable, _as_point, _number, arc, arc_steps, bulge_path

MAX_EDGES = 100_000
MAX_WORK = 20_000_000
MAX_PATTERN_LINES = 5_000
MAX_PATTERN_SEGMENTS = 500_000
MAX_PATTERN_WORK = 20_000_000
"""Pattern lines x boundary edges, counted before any line is cut, so a refusal costs nothing."""

type Points = NDArray[np.float64]


class TooComplex(ValueError):
    """A hatch past one of the module's bounds."""


def boundary(values: dict[str, Any], tolerance: float) -> list[Points]:
    """The hatch's boundary loops, each Nx2 in its OCS (closed; the first point not repeated)."""
    paths = values.get("paths")
    if not isinstance(paths, list):
        raise Undrawable("no paths")
    loops: list[Points] = []
    edges = 0
    for path in paths:
        if not isinstance(path, dict):
            raise Undrawable("a path")
        if path.get("type") == "polyline":
            vertices = path.get("vertices")
            if not isinstance(vertices, list):
                raise Undrawable("vertices")
            if len(vertices) > MAX_EDGES:
                raise TooComplex("vertices")
            rows = []
            for v in vertices:
                if not isinstance(v, list) or len(v) < 2:
                    raise Undrawable("a vertex")
                x, y, _ = _as_point(v[:2], "a vertex")
                bulge = v[2] if len(v) > 2 and isinstance(v[2], int | float) else 0.0
                rows.append((x, y, float(bulge) if math.isfinite(bulge) else 0.0))
            loop = bulge_path(rows, True, tolerance)
        else:
            loop = _edges(path.get("edges"), tolerance)
        edges += len(loop)
        if edges > MAX_EDGES:
            raise TooComplex("edges")
        if len(loop) >= 3:
            if np.allclose(loop[0], loop[-1]):
                loop = loop[:-1]
            loops.append(loop)
    return loops


def _edges(edges: Any, tolerance: float) -> Points:
    if not isinstance(edges, list):
        raise Undrawable("edges")
    if len(edges) > MAX_EDGES:
        raise TooComplex("edges")
    pieces: list[Points] = []
    for edge in edges:
        if not isinstance(edge, dict):
            raise Undrawable("an edge")
        kind = edge.get("type")
        if kind == "line":
            a, b = _as_point(edge.get("start"), "start"), _as_point(edge.get("end"), "end")
            pieces.append(np.array([a[:2], b[:2]]))
        elif kind == "arc":
            cx, cy, _ = _as_point(edge.get("center"), "center")
            radius = _number(edge, "radius")
            a0, a1 = math.radians(_number(edge, "start_angle")), math.radians(_number(edge, "end_angle"))
            ccw = bool(edge.get("ccw", True))
            sweep = (a1 - a0) % (2 * math.pi) or 2 * math.pi
            if ccw:
                pieces.append(arc(cx, cy, radius, a0, sweep, tolerance))
            else:  # stored as angles measured clockwise
                pieces.append(arc(cx, cy, radius, -a0, -sweep, tolerance))
        elif kind == "ellipse":
            cx, cy, _ = _as_point(edge.get("center"), "center")
            mx, my, _ = _as_point(edge.get("major_axis"), "major axis")
            ratio = _number(edge, "ratio", 1.0)
            t0, t1 = math.radians(_number(edge, "start_angle")), math.radians(_number(edge, "end_angle"))
            sweep = (t1 - t0) % (2 * math.pi) or 2 * math.pi
            if not edge.get("ccw", True):
                t0, sweep = -t0, -sweep
            n = arc_steps(math.hypot(mx, my), sweep, tolerance)
            t = t0 + sweep * np.linspace(0.0, 1.0, n + 1)
            x = cx + mx * np.cos(t) - my * ratio * np.sin(t)
            y = cy + my * np.cos(t) + mx * ratio * np.sin(t)
            pieces.append(np.column_stack([x, y]))
        elif kind == "spline":
            control = edge.get("control_points") or edge.get("fit_points")
            if not isinstance(control, list) or not 2 <= len(control) <= MAX_EDGES:
                raise Undrawable("a spline edge")
            points = [_as_point(p, "a spline point") for p in control]
            try:
                spline = BSpline(
                    points,
                    order=int(_number(edge, "degree", 3.0)) + 1,
                    knots=edge.get("knot_values") or None,
                    weights=edge.get("weights") or None,
                )
                pieces.append(
                    np.array([(v.x, v.y) for v in spline.approximate(max(8, len(points) * 4))])
                )
            except MemoryError:
                raise  # the job's memory limit, never a shape left out (24)
            except Exception as error:
                raise Undrawable("a spline edge ezdxf cannot evaluate") from error
        else:
            raise Undrawable("an edge of unknown type")
    if not pieces:
        return np.zeros((0, 2))
    joined = np.concatenate(pieces)
    if not np.isfinite(joined).all():
        raise Undrawable("an edge off to infinity")
    return joined


def _segments(loops: list[Points]) -> tuple[Points, Points]:
    a = np.concatenate(loops)
    b = np.concatenate([np.roll(loop, -1, axis=0) for loop in loops])
    return a, b


def fill(loops: list[Points]) -> NDArray[np.float64]:
    """The even-odd fill of the loops as triangles (Mx3x2)."""
    if not loops:
        return np.zeros((0, 3, 2))
    a, b = _segments(loops)
    keep = a[:, 1] != b[:, 1]  # horizontal edges bound no slab
    a, b = a[keep], b[keep]
    ys = np.unique(np.concatenate([a[:, 1], b[:, 1]]))
    if len(ys) * len(a) > MAX_WORK:
        raise TooComplex("fill")
    low = np.minimum(a[:, 1], b[:, 1])
    high = np.maximum(a[:, 1], b[:, 1])
    slope = (b[:, 0] - a[:, 0]) / (b[:, 1] - a[:, 1])
    triangles: list[NDArray[np.float64]] = []
    for y0, y1 in itertools.pairwise(ys):
        active = (low <= y0) & (high >= y1)
        if not active.any():
            continue
        mid = (y0 + y1) / 2
        ax, ay, sl = a[active, 0], a[active, 1], slope[active]
        order = np.argsort(ax + (mid - ay) * sl)
        x0s, x1s = (ax + (y0 - ay) * sl)[order], (ax + (y1 - ay) * sl)[order]
        pairs = len(order) // 2 * 2
        l0, r0 = x0s[0:pairs:2], x0s[1:pairs:2]
        l1, r1 = x1s[0:pairs:2], x1s[1:pairs:2]
        n = len(l0)
        first = np.stack([np.column_stack([l0, np.full(n, y0)]), np.column_stack([r0, np.full(n, y0)]),
                          np.column_stack([r1, np.full(n, y1)])], axis=1)  # fmt: skip
        second = np.stack([np.column_stack([l0, np.full(n, y0)]), np.column_stack([r1, np.full(n, y1)]),
                           np.column_stack([l1, np.full(n, y1)])], axis=1)  # fmt: skip
        triangles.extend([first, second])
    return np.concatenate(triangles) if triangles else np.zeros((0, 3, 2))


@cache
def _table(iso: bool) -> dict[str, Any]:
    table: dict[str, Any] = patterns.load(measurement=1 if iso else 0)
    return {name.upper(): lines for name, lines in table.items()}


def has_pattern(name: str, iso: bool) -> bool:
    return name.upper() in _table(iso)


def pattern(
    loops: list[Points], name: str, scale: float, angle_degrees: float, iso: bool
) -> NDArray[np.float64]:
    """The pattern's line segments clipped to the loops (even-odd), Kx4 (x0, y0, x1, y1)."""
    definition = _table(iso).get(name.upper())
    if definition is None:
        raise Undrawable("a pattern not in the standard table")
    if not loops or not math.isfinite(scale) or scale <= 0 or not math.isfinite(angle_degrees):
        return np.zeros((0, 4))
    a, b = _segments(loops)
    corners = np.concatenate(loops)
    out: list[NDArray[np.float64]] = []
    total = 0
    turn = math.radians(angle_degrees)
    families = []
    work = 0
    for line_angle, base, offset, dashes in definition:
        theta = math.radians(line_angle) + turn
        n = np.array([-math.sin(theta), math.cos(theta)])
        rot = np.array([[math.cos(turn), -math.sin(turn)], [math.sin(turn), math.cos(turn)]])
        spacing = float((rot @ (np.array(offset, dtype=float) * scale)) @ n)
        if abs(spacing) >= 1e-12:
            reach = corners @ n
            work += (int((reach.max() - reach.min()) / abs(spacing)) + 2) * len(a)
        families.append((line_angle, base, offset, dashes))
    if work > MAX_PATTERN_WORK:
        raise TooComplex("pattern work")
    for line_angle, base, offset, dashes in families:
        theta = math.radians(line_angle) + turn
        d = np.array([math.cos(theta), math.sin(theta)])
        n = np.array([-d[1], d[0]])
        rot = np.array([[math.cos(turn), -math.sin(turn)], [math.sin(turn), math.cos(turn)]])
        origin = rot @ (np.array(base, dtype=float) * scale)
        step = rot @ (np.array(offset, dtype=float) * scale)
        spacing = float(step @ n)
        if abs(spacing) < 1e-12:
            continue
        reach = corners @ n - origin @ n
        k0, k1 = math.floor(reach.min() / spacing), math.ceil(reach.max() / spacing)
        if k1 < k0:
            k0, k1 = k1, k0
        if k1 - k0 > MAX_PATTERN_LINES:
            raise TooComplex("pattern lines")
        dash = [float(x) * scale for x in dashes]
        for k in range(k0, k1 + 1):
            start = origin + k * step
            segments = _clip_line(start, d, a, b)
            if dash:
                segments = _dash(segments, start, d, dash)
            total += len(segments)
            if total > MAX_PATTERN_SEGMENTS:
                raise TooComplex("pattern segments")
            if len(segments):
                out.append(segments)
    return np.concatenate(out) if out else np.zeros((0, 4))


def _clip_line(start: Points, d: Points, a: Points, b: Points) -> NDArray[np.float64]:
    """The pieces of the infinite line start + t·d inside the loops, by the even-odd rule."""
    e = b - a
    denom = e[:, 0] * d[1] - e[:, 1] * d[0]
    ok = np.abs(denom) > 1e-15
    w = a - start
    t = (e[:, 0] * w[:, 1] - e[:, 1] * w[:, 0]) / np.where(ok, denom, 1.0)
    s = (d[0] * w[:, 1] - d[1] * w[:, 0]) / np.where(ok, denom, 1.0)
    hit = ok & (s >= 0) & (s < 1)
    ts = np.sort(t[hit])
    pairs = len(ts) // 2 * 2
    t0, t1 = ts[0:pairs:2], ts[1:pairs:2]
    return np.column_stack(
        [start[0] + t0 * d[0], start[1] + t0 * d[1], start[0] + t1 * d[0], start[1] + t1 * d[1]]
    )


def _dash(
    segments: NDArray[np.float64], start: Points, d: Points, dash: list[float]
) -> NDArray[np.float64]:
    """The dashes of a pattern line (positive lengths drawn, negative gaps, zero a dot), in phase
    with the line's own origin."""
    period = sum(abs(x) for x in dash)
    if period <= 0:
        return segments
    out = []
    work = 0
    for x0, y0, x1, y1 in segments:
        t0 = (np.array([x0, y0]) - start) @ d
        t1 = (np.array([x1, y1]) - start) @ d
        first = math.floor(t0 / period)
        cycles = math.ceil(t1 / period) - first
        work += cycles * len(dash)
        if work > MAX_PATTERN_SEGMENTS:
            raise TooComplex("pattern dashes")
        base = first * period
        for _ in range(cycles):
            position = base
            for length in dash:
                a0, a1 = position, position + abs(length)
                if length >= 0:
                    lo, hi = max(a0, t0), min(a1 if length > 0 else a0, t1)
                    if lo <= hi and (length == 0 or lo < hi):
                        out.append([*(start + lo * d), *(start + hi * d)])
                position = a1
            base += period
    return np.array(out, dtype=np.float64).reshape(-1, 4)
