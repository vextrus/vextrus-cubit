"""Entity geometry as polylines and fills, in the entity's own coordinates (its OCS, or its block's).

`shape(entity, tolerance)` reads an `Entity`'s DXF values (engine/read/libredwg/dxf.py names them) and
returns what it draws: `Shape.lines` (open or closed polylines, Nx2) and `Shape.fills` (triangles,
Mx3x2, for a SOLID, a TRACE and a polyline with width), or `None` for a type this renderer does not
draw (the caller counts it). Curves are cut so no chord strays more than `tolerance` from the arc (in
the entity's units; the caller converts from paper millimetres), with at most `MAX_SEGMENTS` a curve.
Every value is checked before use: a value that is not a finite number of the right shape makes the
entity undrawable, never an error.

`bounds(entity)` is a box that contains what it draws (larger is allowed), for culling a sheet.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from ezdxf.math import BSpline
from numpy.typing import NDArray

from engine.read.artefact import Entity

MAX_SEGMENTS = 2048
"""The most segments one curve is cut into."""
MAX_VERTICES = 200_000
"""The most vertices one polyline or spline is drawn with."""
MAX_POINTS = 1_000_000
"""The most points one entity's curves are cut into, bulges included."""

type Points = NDArray[np.float64]
type Box = tuple[float, float, float, float]


@dataclass
class Shape:
    lines: list[tuple[Points, bool]] = field(default_factory=list)
    """Polylines and whether each is closed."""
    fills: list[NDArray[np.float64]] = field(default_factory=list)
    """Triangles, each array Mx3x2."""
    elevation: float = 0.0
    """The height of its plane in its own coordinates (an OCS entity's elevation)."""


class Undrawable(ValueError):
    """An entity whose values do not describe something drawable."""


def _number(values: Any, key: str, default: float | None = None) -> float:
    value = values.get(key, default) if isinstance(values, dict) else default
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        if default is not None and value is None:
            return default
        raise Undrawable(f"{key} is not a number")
    return float(value)


def _point(values: Any, key: str) -> tuple[float, float, float]:
    value = values.get(key) if isinstance(values, dict) else None
    return _as_point(value, key)


def _as_point(value: Any, what: str) -> tuple[float, float, float]:
    if not isinstance(value, list | tuple) or len(value) not in (2, 3):
        raise Undrawable(f"{what} is not a point")
    if not all(
        isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v) for v in value
    ):
        raise Undrawable(f"{what} is not finite")
    return (float(value[0]), float(value[1]), float(value[2]) if len(value) == 3 else 0.0)


def arc_steps(radius: float, sweep: float, tolerance: float) -> int:
    """How many chords keep an arc of `radius` and `sweep` radians within `tolerance` of its curve:
    from 1 to MAX_SEGMENTS, whatever the numbers (a radius so large that the tolerance vanishes
    beside it takes MAX_SEGMENTS, never a division by zero)."""
    if not (math.isfinite(sweep) and math.isfinite(radius) and math.isfinite(tolerance)):
        return 1 if not math.isfinite(sweep) else MAX_SEGMENTS
    if radius <= tolerance or tolerance <= 0:
        return max(1, min(MAX_SEGMENTS, math.ceil(abs(sweep) / (math.pi / 4))))
    ratio = tolerance / radius
    # 2·acos(1 - r) loses r to rounding below about 1e-8; 2·sqrt(2r) is its value there.
    step = 2 * math.acos(1 - ratio) if ratio > 1e-8 else 2 * math.sqrt(2 * ratio)
    if not step > 0:
        return MAX_SEGMENTS
    return max(1, min(MAX_SEGMENTS, math.ceil(abs(sweep) / step)))


def arc(cx: float, cy: float, radius: float, start: float, sweep: float, tolerance: float) -> Points:
    n = arc_steps(radius, sweep, tolerance)
    t = start + sweep * np.linspace(0.0, 1.0, n + 1)
    return np.column_stack([cx + radius * np.cos(t), cy + radius * np.sin(t)])


def bulge_path(vertices: Sequence[tuple[float, float, float]], closed: bool, tolerance: float) -> Points:
    """A polyline's path, its bulges drawn as arcs: vertices are (x, y, bulge)."""
    if len(vertices) > MAX_VERTICES:
        raise Undrawable("too many vertices")
    out: list[Points] = []
    points = 0
    count = len(vertices)
    for i in range(count if closed else count - 1):
        x0, y0, bulge = vertices[i]
        x1, y1, _ = vertices[(i + 1) % count]
        chord = math.hypot(x1 - x0, y1 - y0)
        # A bulge whose arc strays less than the tolerance from its chord is drawn straight (its
        # sagitta is |bulge| x chord / 2); a tiny one would otherwise divide by a vanishing angle.
        if not math.isfinite(bulge) or chord == 0 or abs(bulge) * chord / 2 <= tolerance:
            out.append(np.array([[x0, y0]]))
            continue
        sweep = 4 * math.atan(bulge)
        radius = chord / (2 * abs(math.sin(sweep / 2)))
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        sagitta_to_centre = radius * math.cos(sweep / 2)
        nx, ny = -(y1 - y0) / chord, (x1 - x0) / chord
        cx, cy = (
            mx + nx * sagitta_to_centre * math.copysign(1, bulge),
            my + ny * sagitta_to_centre * math.copysign(1, bulge),
        )
        start = math.atan2(y0 - cy, x0 - cx)
        piece = arc(cx, cy, radius, start, sweep, tolerance)[:-1]
        points += len(piece)
        if points > MAX_POINTS:
            raise Undrawable("too many points")
        out.append(piece)
    if count:
        last = vertices[0] if closed else vertices[-1]
        out.append(np.array([[last[0], last[1]]]))
    return np.concatenate(out) if out else np.zeros((0, 2))


def _wide(path: Points, widths: Sequence[tuple[float, float]], closed: bool) -> NDArray[np.float64]:
    """A polyline with width as quads (two triangles a segment), each segment its own start and end
    width; consecutive segments share their joint's corners (a mitre, capped at 4 x the width), so a
    curved piece leaves no wedge between its quads."""
    count = len(path) - 1
    if count < 1:
        return np.zeros((0, 3, 2))
    steps = np.diff(path, axis=0)
    lengths = np.hypot(steps[:, 0], steps[:, 1])
    safe = np.where(lengths > 0, lengths, 1.0)
    normals = np.column_stack([-steps[:, 1] / safe, steps[:, 0] / safe])
    joints = np.zeros((count + 1, 2))
    joints[0], joints[-1] = normals[0], normals[-1]
    for i in range(1, count):
        a, b = normals[i - 1], normals[i]
        mitre = a + b
        norm2 = float(mitre @ mitre)
        if lengths[i - 1] == 0 or lengths[i] == 0 or norm2 < 1e-12:
            joints[i] = b
            continue
        mitre = mitre * (2.0 / norm2)  # a vector whose projection on each normal is 1
        length = math.hypot(*mitre)
        joints[i] = mitre if length <= 4.0 else mitre / length * 4.0
    quads = []
    for i in range(count):
        if lengths[i] == 0:
            continue
        w0, w1 = widths[min(i, len(widths) - 1)] if widths else (0.0, 0.0)
        if w0 <= 0 and w1 <= 0:
            continue
        p0, p1 = path[i], path[i + 1]
        a, b = p0 + joints[i] * w0 / 2, p0 - joints[i] * w0 / 2
        c, d = p1 - joints[i + 1] * w1 / 2, p1 + joints[i + 1] * w1 / 2
        quads.append([a, b, c])
        quads.append([a, c, d])
    return np.array(quads, dtype=np.float64).reshape(-1, 3, 2)


def _lwpolyline(values: dict[str, Any], tolerance: float, shape: Shape) -> None:
    points = values.get("points")
    if not isinstance(points, list) or len(points) > MAX_VERTICES:
        raise Undrawable("points")
    rows = []
    for p in points:
        if not isinstance(p, list) or len(p) != 5:
            raise Undrawable("a point")
        x, y, _ = _as_point(p[:2], "a point")
        rows.append((x, y, _scalar(p[2]), _scalar(p[3]), _scalar(p[4])))
    if len(rows) < 2:
        raise Undrawable("fewer than two points")
    closed = bool(int(_number(values, "flags", 0.0)) & 1)
    const = _number(values, "const_width", 0.0)
    shape.elevation = _number(values, "elevation", 0.0)
    _polyline(rows, closed, const, tolerance, shape)


def _scalar(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise Undrawable("a vertex value")
    return float(value)


def _polyline(
    rows: list[tuple[float, float, float, float, float]],
    closed: bool,
    const_width: float,
    tolerance: float,
    shape: Shape,
) -> None:
    """Rows of (x, y, start width, end width, bulge)."""
    widths = [(const_width or r[2], const_width or r[3]) for r in rows]
    if any(w0 > 0 or w1 > 0 for w0, w1 in widths):
        # A polyline with width: each straight or arc piece as quads of its vertex's widths.
        points: list[Points] = []
        ramp: list[tuple[float, float]] = []
        count = len(rows)
        for i in range(count if closed else count - 1):
            a, b = rows[i], rows[(i + 1) % count]
            piece = bulge_path([(a[0], a[1], a[4]), (b[0], b[1], 0.0)], False, tolerance)
            w0, w1 = widths[i]
            steps = len(piece) - 1
            ramp += [
                (w0 + (w1 - w0) * k / steps, w0 + (w1 - w0) * (k + 1) / steps) for k in range(steps)
            ]
            points.append(piece if not points else piece[1:])
        if points:
            shape.fills.append(_wide(np.concatenate(points), ramp, closed))
        return
    shape.lines.append((bulge_path([(r[0], r[1], r[4]) for r in rows], closed, tolerance), closed))


def _polyline_entity(values: dict[str, Any], tolerance: float, shape: Shape) -> None:
    flags = int(_number(values, "flags", 0.0))
    if flags & (16 | 64):  # a polygon mesh or a polyface mesh
        raise Undrawable("a mesh")
    vertices = values.get("vertices")
    if not isinstance(vertices, list) or len(vertices) > MAX_VERTICES:
        raise Undrawable("vertices")
    rows = []
    for v in vertices:
        if not isinstance(v, dict):
            raise Undrawable("a vertex")
        x, y, _ = _point(v, "location")
        rows.append(
            (
                x,
                y,
                _number(v, "start_width", 0.0),
                _number(v, "end_width", 0.0),
                _number(v, "bulge", 0.0),
            )
        )
    if len(rows) < 2:
        raise Undrawable("fewer than two vertices")
    if not flags & 8:
        shape.elevation = _point(values, "elevation")[2] if "elevation" in values else 0.0
    _polyline(rows, bool(flags & 1), _number(values, "default_start_width", 0.0), tolerance, shape)


def _ellipse(values: dict[str, Any], tolerance: float, shape: Shape) -> None:
    cx, cy, cz = _point(values, "center")
    mx, my, mz = _point(values, "major_axis")
    ratio = _number(values, "ratio", 1.0)
    ex, ey, ez = _point(values, "extrusion") if "extrusion" in values else (0.0, 0.0, 1.0)
    # The minor axis: the extrusion x the major axis, times the ratio.
    nx, ny, nz = ey * mz - ez * my, ez * mx - ex * mz, ex * my - ey * mx
    major = math.sqrt(mx * mx + my * my + mz * mz)
    normal = math.sqrt(nx * nx + ny * ny + nz * nz)
    if major == 0 or normal == 0:
        raise Undrawable("a degenerate ellipse")
    scale = ratio * major / normal
    start = _number(values, "start_param", 0.0)
    end = _number(values, "end_param", 2 * math.pi)
    sweep = (end - start) % (2 * math.pi) or 2 * math.pi
    n = arc_steps(major, sweep, tolerance)
    t = start + sweep * np.linspace(0.0, 1.0, n + 1)
    x = cx + mx * np.cos(t) + nx * scale * np.sin(t)
    y = cy + my * np.cos(t) + ny * scale * np.sin(t)
    shape.lines.append((np.column_stack([x, y]), False))
    shape.elevation = cz


def _spline(values: dict[str, Any], tolerance: float, shape: Shape) -> None:
    control = values.get("control_points")
    fit = values.get("fit_points")
    points = control if isinstance(control, list) and control else fit
    if not isinstance(points, list) or not 2 <= len(points) <= MAX_VERTICES:
        raise Undrawable("no points")
    xyz = [_as_point(p, "a spline point") for p in points]
    if points is fit:
        shape.lines.append((np.array([p[:2] for p in xyz]), False))
        return
    degree = int(_number(values, "degree", 3.0))
    knots = values.get("knots") or None
    weights = values.get("weights") or None
    try:
        spline = BSpline(xyz, order=degree + 1, knots=knots, weights=weights)
        segments = min(MAX_SEGMENTS, max(8, len(xyz) * 8))
        path = np.array([(v.x, v.y) for v in spline.approximate(segments)])
    except Exception as error:  # ezdxf refuses knots or weights that do not fit the points
        raise Undrawable("a spline ezdxf cannot evaluate") from error
    if not np.isfinite(path).all():
        raise Undrawable("a spline off to infinity")
    shape.lines.append((path, False))


def shape(entity: Entity, tolerance: float) -> Shape | None:
    """What the entity draws, in its own coordinates; none for a type not drawn here."""
    values: dict[str, Any] = dict(entity.values)
    found = Shape()
    kind = entity.type
    try:
        if kind == "LINE":
            (x0, y0, _), (x1, y1, _) = _point(values, "start"), _point(values, "end")
            found.lines.append((np.array([[x0, y0], [x1, y1]]), False))
        elif kind == "LWPOLYLINE":
            _lwpolyline(values, tolerance, found)
        elif kind == "POLYLINE":
            _polyline_entity(values, tolerance, found)
        elif kind in ("CIRCLE", "ARC"):
            cx, cy, cz = _point(values, "center")
            radius = _number(values, "radius")
            if radius <= 0:
                raise Undrawable("a radius")
            start, sweep = 0.0, 2 * math.pi
            if kind == "ARC":
                a0 = math.radians(_number(values, "start_angle"))
                a1 = math.radians(_number(values, "end_angle"))
                start, sweep = a0, (a1 - a0) % (2 * math.pi) or 2 * math.pi
            found.lines.append((arc(cx, cy, radius, start, sweep, tolerance), kind == "CIRCLE"))
            found.elevation = cz
        elif kind == "ELLIPSE":
            _ellipse(values, tolerance, found)
        elif kind == "SPLINE":
            _spline(values, tolerance, found)
        elif kind in ("SOLID", "TRACE"):
            v = [_point(values, f"vtx{i}") for i in range(4)] if "vtx3" in values else None
            if v is None:
                v = [_point(values, f"vtx{i}") for i in range(3)]
                v.append(v[2])
            # A SOLID's corners run 0, 1, 3, 2 around its edge.
            found.fills.append(
                np.array([[v[0][:2], v[1][:2], v[2][:2]], [v[1][:2], v[3][:2], v[2][:2]]])
            )
            found.elevation = v[0][2]
        elif kind == "3DFACE":
            v = [_point(values, f"vtx{i}") for i in range(4)]
            hidden = int(_number(values, "invisible_edges", 0.0))
            for i in range(4):
                if not hidden & (1 << i):
                    a, b = v[i], v[(i + 1) % 4]
                    found.lines.append((np.array([a[:2], b[:2]]), False))
        elif kind == "LEADER":
            vertices = values.get("vertices")
            if not isinstance(vertices, list) or not 2 <= len(vertices) <= MAX_VERTICES:
                raise Undrawable("vertices")
            found.lines.append((np.array([_as_point(p, "a vertex")[:2] for p in vertices]), False))
        else:
            return None
    except Undrawable:
        return None
    return found


_NOT_POINTS = frozenset(
    {"extrusion", "major_axis", "text_direction", "normal_vector", "view_direction_vector", "u_pixel",
     "v_pixel", "start_tangent", "end_tangent", "knots", "weights", "horizontal_direction",
     "x_axis_direction", "normal",
     # 13's analysts on the real sets: an elevation (0, 0, z), a size in pixels, offsets and scale
     # vectors, and a viewport's grid and snap settings are no locations
     "elevation", "image_size", "leader_offset_block_ref", "leader_offset_annotation_placement",
     "block_scale_vector", "grid_spacing", "snap_spacing", "snap_base_point", "ucs_origin",
     "ucs_x_axis", "ucs_y_axis"}
)  # fmt: skip
_NOT_POINTS_OF = {"POLYLINE": frozenset({"location"})}
"""Keys that are no location for one type only: a 2D polyline's dummy vertex point (0, 0, elevation)."""


def bounds(entity: Entity) -> Box | None:
    """A box containing the entity in its own coordinates, from every point its values hold, grown by
    its radius or axis; none when it holds no point."""
    xs: list[float] = []
    ys: list[float] = []

    skipped = _NOT_POINTS | _NOT_POINTS_OF.get(entity.type, frozenset())

    def visit(value: Any, depth: int) -> None:
        if depth > 6:
            return
        if isinstance(value, dict):
            for key, item in value.items():
                if key not in skipped:
                    visit(item, depth + 1)
        elif isinstance(value, list):
            if 2 <= len(value) <= 5 and all(
                isinstance(v, int | float) and not isinstance(v, bool) for v in value
            ):
                x, y = float(value[0]), float(value[1])
                if math.isfinite(x) and math.isfinite(y):
                    xs.append(x)
                    ys.append(y)
            else:
                for item in value[:MAX_VERTICES]:
                    visit(item, depth + 1)

    visit(dict(entity.values), 0)
    if not xs:
        return None
    grow = 0.0
    for key in ("radius", "const_width"):
        value = entity.values.get(key)
        if isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value):
            grow = max(grow, abs(float(value)))
    axis = entity.values.get("major_axis")
    if isinstance(axis, list) and len(axis) >= 2 and all(isinstance(v, int | float) for v in axis):
        grow = max(grow, math.hypot(float(axis[0]), float(axis[1])))
    return (min(xs) - grow, min(ys) - grow, max(xs) + grow, max(ys) + grow)
