"""`cad/` — file formats in (DXF, DWG, vector PDF), one EntityGraph vocabulary out, and stop (L-CAD-01)."""

from __future__ import annotations

from .ingest import ENTITYGRAPH_FLOOR, ENTITYGRAPH_VERSION, SCHEME, IngestError, ingest_dxf
from .model import EntityGraph, EntityGraphError, parse_entity_graph
from .pdf import ingest_pdf
from .serialise import dumps, write_artifact

__all__ = [
    "ENTITYGRAPH_FLOOR",
    "ENTITYGRAPH_VERSION",
    "SCHEME",
    "EntityGraph",
    "EntityGraphError",
    "IngestError",
    "dumps",
    "ingest_dxf",
    "ingest_pdf",
    "parse_entity_graph",
    "write_artifact",
]
