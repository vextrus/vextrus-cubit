"""One geometry vocabulary (L-CAD-01), in native drawing units (L-CAD-02).

Every entity is described twice: by the parameters its DXF type is defined with (a circle
has a centre and a radius) and by a flattened polyline standing for the same shape at the
pinned tolerance. The polyline is what extents, areas and rendering read, so a curve, a
polyline and a line are the same kind of thing to everything downstream.

No coordinate is converted. `$INSUNITS` is reported, and that is the whole of the seam's
opinion about units.
"""

from __future__ import annotations

from itertools import islice
from typing import Any

from ezdxf import path as ezpath

from .params import FLATTEN_POINT_CAP, FLATTEN_TOLERANCE

#: A point in the artifact: two numbers, native units, no third dimension in the vocabulary.
Point = list[float]

#: `[minx, miny, maxx, maxy]`, the only bounding box shape the artifact knows.
BBox = list[float]


def num(value: Any) -> float:
    """A coordinate as the artifact writes it: rounded to 9 places, never negative zero."""
    return round(float(value), 9) + 0.0


def _pt(vertex: Any) -> Point:
    return [num(vertex.x), num(vertex.y)]


def _pairs(values: Any) -> list[Point]:
    return [[num(x), num(y)] for x, y in values]


def flatten(entity: Any) -> tuple[list[Point], bool]:
    """The entity as a polyline at `FLATTEN_TOLERANCE`, and whether the point cap tripped.

    The flattening is consumed lazily and cut at the cap: a circle of radius 10^7 wants
    six figures of points at this tolerance, and materialising them to throw them away is
    the same defect as not having a cap.
    """
    try:
        path = ezpath.make_path(entity)
    except Exception:
        return [], False
    points = [_pt(vertex) for vertex in islice(path.flattening(FLATTEN_TOLERANCE), FLATTEN_POINT_CAP + 1)]
    if len(points) > FLATTEN_POINT_CAP:
        return points[:FLATTEN_POINT_CAP], True
    return points, False


def shoelace_area(points: list[Point]) -> float:
    """The area a closed polyline encloses, by the shoelace formula (L-CAD-05)."""
    if len(points) < 3:
        return 0.0
    total = 0.0
    previous = points[-1]
    for current in points:
        total += previous[0] * current[1] - current[0] * previous[1]
        previous = current
    return num(abs(total) / 2)


def bbox_of(points: list[Point]) -> BBox | None:
    """The axis-aligned box around a point list, or None when there are no points."""
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return [min(xs), min(ys), max(xs), max(ys)]


def union_bbox(boxes: list[BBox]) -> BBox | None:
    """The box around a list of boxes."""
    if not boxes:
        return None
    return [
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    ]


def _text_extras(entity: Any) -> dict[str, Any]:
    """`text`, world `height` and `anchor` for the entities that carry writing."""
    dxftype = entity.dxftype()
    if dxftype == "MTEXT":
        anchor = entity.dxf.get("insert", None)
        return {
            "text": entity.text,
            "height": num(entity.dxf.get("char_height", 0.0)),
            "anchor": _pt(anchor) if anchor is not None else [0.0, 0.0],
        }
    anchor = entity.dxf.get("insert", None)
    return {
        "text": entity.dxf.get("text", ""),
        "height": num(entity.dxf.get("height", 0.0)),
        "anchor": _pt(anchor) if anchor is not None else [0.0, 0.0],
    }


def describe(entity: Any) -> dict[str, Any]:
    """Everything the artifact says about one entity's shape.

    Returns `geometry` (the type's own parameters plus the flattened `points`), the
    `points` themselves for extents, whether the flatten cap tripped, and the optional
    top-level fields (`closed`, `area`, `text`, `height`, `anchor`) the vocabulary lifts
    out of geometry because they are read without knowing the type.
    """
    dxftype = entity.dxftype()
    extras: dict[str, Any] = {}
    capped = False

    if dxftype == "LINE":
        points = [_pt(entity.dxf.start), _pt(entity.dxf.end)]
        geometry: dict[str, Any] = {"start": points[0], "end": points[1], "points": points}
    elif dxftype == "POINT":
        points = [_pt(entity.dxf.location)]
        geometry = {"location": points[0], "points": points}
    elif dxftype == "CIRCLE":
        points, capped = flatten(entity)
        geometry = {
            "center": _pt(entity.dxf.center),
            "radius": num(entity.dxf.radius),
            "points": points,
        }
        extras["closed"] = True
        # A capped flattening is an open fan, not the shape: its shoelace area would be a
        # number about a polyline nobody drew.
        if not capped:
            extras["area"] = shoelace_area(points)
    elif dxftype == "ARC":
        points, capped = flatten(entity)
        geometry = {
            "center": _pt(entity.dxf.center),
            "radius": num(entity.dxf.radius),
            "start_angle": num(entity.dxf.start_angle),
            "end_angle": num(entity.dxf.end_angle),
            "points": points,
        }
    elif dxftype == "ELLIPSE":
        points, capped = flatten(entity)
        geometry = {
            "center": _pt(entity.dxf.center),
            "major_axis": _pt(entity.dxf.major_axis),
            "ratio": num(entity.dxf.ratio),
            "points": points,
        }
    elif dxftype in ("LWPOLYLINE", "POLYLINE"):
        points, capped = flatten(entity)
        closed = bool(entity.closed) if dxftype == "LWPOLYLINE" else bool(entity.is_closed)
        geometry = {"points": points, "closed": closed}
        extras["closed"] = closed
        if closed and not capped:
            extras["area"] = shoelace_area(points)
    elif dxftype == "SPLINE":
        points, capped = flatten(entity)
        geometry = {
            "degree": int(entity.dxf.degree),
            "control_points": _pairs((v.x, v.y) for v in entity.control_points),
            "points": points,
        }
    elif dxftype in ("TEXT", "ATTRIB", "ATTDEF", "MTEXT"):
        extras = _text_extras(entity)
        points = [list(extras["anchor"])]
        geometry = {"anchor": extras["anchor"], "points": points}
    elif dxftype == "INSERT":
        insert = _pt(entity.dxf.insert)
        points = [insert]
        geometry = {
            "name": entity.dxf.name,
            "insert": insert,
            "scale": [
                num(entity.dxf.get("xscale", 1.0)),
                num(entity.dxf.get("yscale", 1.0)),
                num(entity.dxf.get("zscale", 1.0)),
            ],
            "rotation": num(entity.dxf.get("rotation", 0.0)),
        }
    elif dxftype == "DIMENSION":
        defpoint = entity.dxf.get("defpoint", None)
        midpoint = entity.dxf.get("text_midpoint", None)
        points = [_pt(p) for p in (defpoint, midpoint) if p is not None]
        geometry = {
            "defpoint": _pt(defpoint) if defpoint is not None else None,
            "text_midpoint": _pt(midpoint) if midpoint is not None else None,
            "points": points,
        }
    else:
        points, capped = flatten(entity)
        geometry = {"points": points}

    return {"geometry": geometry, "points": points, "capped": capped, "extras": extras}
