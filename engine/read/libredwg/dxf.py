"""Geometry from the DXF `dwg2dxf` wrote, as ezdxf reads it (ADR 0029: geometry by DXF → ezdxf).

Each entity's DXF values by DXF name (points as `[x, y, z]`), plus what ezdxf keeps outside them: a
lightweight polyline's points, a polyline's vertices, a spline's points, knots and weights, a
leader's vertices and a hatch's boundary paths. Text is never taken from here (dwgread.py), and an
insert's placement is not either; only a MINSERT's grid is.

A DXF that ezdxf refuses is read again with `ezdxf.recover` (on 0.14 one real file needed it, from
text with raw line breaks; docs/research/dwg-reader-evidence.md), and the recovery is noted.
"""

from collections.abc import Iterable, Mapping
from enum import Enum
from pathlib import Path
from typing import Any

from ezdxf import recover
from ezdxf.document import Drawing
from ezdxf.entities.dxfgfx import DXFGraphic
from ezdxf.filemanagement import readfile
from ezdxf.lldxf.const import DXFStructureError
from ezdxf.math import Vec2, Vec3

from engine.messages import Message
from engine.messages import read as codes
from engine.read._json import Json

_NOT_VALUES = frozenset({"handle", "owner", "layer"})
_GRID = ("row_count", "column_count", "row_spacing", "column_spacing")


def load(path: Path) -> tuple[Drawing, list[Message]]:
    try:
        return readfile(path), []
    except DXFStructureError:
        doc, auditor = recover.readfile(path)
        return doc, [codes.DXF_RECOVERED(errors=len(auditor.errors) + len(auditor.fixes))]


def values_by_handle(doc: Drawing) -> dict[str, dict[str, Json]]:
    """Every graphic entity's values, by handle, from every block record (layouts included)."""
    found: dict[str, dict[str, Json]] = {}
    for block in doc.blocks:
        for entity in block:
            found[entity.dxf.handle] = values(entity)
    return found


def values(entity: DXFGraphic) -> dict[str, Json]:
    kind = entity.dxftype()
    if kind == "INSERT":
        return {key: plain(entity.dxf.get(key)) for key in _GRID if entity.dxf.hasattr(key)}
    found: dict[str, Json] = {
        key: plain(value)
        for key, value in entity.dxf.all_existing_dxf_attribs().items()
        if key not in _NOT_VALUES
    }
    extra: Any = entity  # ezdxf's per-type members, read by name below
    match kind:
        case "LWPOLYLINE":
            found["points"] = [list(point) for point in extra.get_points("xyseb")]
        case "POLYLINE":
            found["vertices"] = [values(vertex) for vertex in extra.vertices]
        case "SPLINE":
            found["control_points"] = plain(list(extra.control_points))
            found["fit_points"] = plain(list(extra.fit_points))
            found["knots"] = plain(list(extra.knots))
            found["weights"] = plain(list(extra.weights))
        case "LEADER":
            found["vertices"] = plain(list(extra.vertices))
        case "HATCH" | "MPOLYGON":
            found["paths"] = [_path(path) for path in extra.paths]
    return found


def _path(path: Any) -> dict[str, Json]:
    if hasattr(path, "vertices"):  # a polyline boundary: (x, y, bulge) per vertex
        return {
            "type": "polyline",
            "flags": int(path.path_type_flags),
            "closed": bool(path.is_closed),
            "vertices": plain([list(vertex) for vertex in path.vertices]),
        }
    return {
        "type": "edges",
        "flags": int(path.path_type_flags),
        "edges": [_edge(edge) for edge in path.edges],
    }


_EDGE_FIELDS = {
    "LINE": ("start", "end"),
    "ARC": ("center", "radius", "start_angle", "end_angle", "ccw"),
    "ELLIPSE": ("center", "major_axis", "ratio", "start_angle", "end_angle", "ccw"),
    "SPLINE": (
        "degree", "rational", "periodic", "knot_values", "control_points", "fit_points", "weights",
        "start_tangent", "end_tangent",
    ),
}  # fmt: skip


def _edge(edge: Any) -> dict[str, Json]:
    kind = edge.type.name
    return {
        "type": kind.lower(),
        **{name: plain(getattr(edge, name)) for name in _EDGE_FIELDS.get(kind, ())},
    }


def plain(value: object) -> Json:
    """A value ezdxf holds, as JSON: vectors as lists of floats."""
    match value:
        case Vec3() | Vec2():
            return [float(v) for v in value]
        case bool() | int() | float() | str() | None:
            return value
        case Enum():
            return plain(value.value)
        case Mapping():
            return {str(key): plain(item) for key, item in value.items()}
        case Iterable():
            return [plain(item) for item in value]
    return str(value)
