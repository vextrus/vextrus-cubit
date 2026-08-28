"""`cad/` — file formats in, one EntityGraph vocabulary out, and stop (L-CAD-01)."""

from __future__ import annotations

from .ingest import ENTITYGRAPH_VERSION, SCHEME, IngestError, ingest_dxf
from .model import EntityGraph, EntityGraphError, parse_entity_graph
from .serialise import dumps, write_artifact

__all__ = [
    "ENTITYGRAPH_VERSION",
    "SCHEME",
    "EntityGraph",
    "EntityGraphError",
    "IngestError",
    "dumps",
    "ingest_dxf",
    "parse_entity_graph",
    "write_artifact",
]
