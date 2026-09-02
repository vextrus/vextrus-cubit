"""What both passes agree to count, so the reconciliation compares like with like (L-CAD-04)."""

from __future__ import annotations

from typing import Final

from ..ingest import MODEL_SPACE

#: Records a census tallies that a layout's own iteration never yields as drawing content:
#: `BLOCK`/`ENDBLK` delimit a block header rather than drawing anything, and an attribute, a vertex
#: or a sequence end belongs to the owner that absorbs it. Counting them on one side only would
#: turn a faithful conversion into a shortfall refusal, so neither pass counts them.
NOT_TALLIED: Final = frozenset({"BLOCK", "ENDBLK", "ATTRIB", "SEQEND", "VERTEX"})

#: LibreDWG spells a DWG object by the variant it decoded — `DIMENSION_LINEAR`, `POLYLINE_2D`,
#: `VERTEX_3D`, `MINSERT` — where the DXF it then writes, and ezdxf reads back, spells the class
#: alone. The census is tallied under the DXF spelling so a class is one name on both sides.
_VARIANT_PREFIXES: Final = (("DIMENSION_", "DIMENSION"), ("POLYLINE_", "POLYLINE"), ("VERTEX_", "VERTEX"))
_RENAMED: Final = {"MINSERT": "INSERT", "PROXY_ENTITY": "ACAD_PROXY_ENTITY"}


def dxf_spelling(entity: str) -> str:
    """The DXF class name for a LibreDWG entity name; a name the DXF spells the same way is kept."""
    for prefix, dxftype in _VARIANT_PREFIXES:
        if entity.startswith(prefix):
            return dxftype
    return _RENAMED.get(entity, entity)


__all__ = ["MODEL_SPACE", "NOT_TALLIED", "dxf_spelling"]
