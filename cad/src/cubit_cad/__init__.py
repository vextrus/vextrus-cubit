"""The `cad/` seam: file formats in, one EntityGraph out, and nothing else (L-CAD-01).

Nothing in this package reads meaning. It opens a drawing, names every original entity
with the file's own handle, paints block instances into world space as derived geometry,
records the fidelity counters R-TO-001 asks for, and stops. Everything downstream of the
artifact is TypeScript.
"""

__all__ = ["ENTITY_GRAPH_VERSION"]

#: The EntityGraph vocabulary this package writes and reads. L-CAD-05 makes v2 the floor.
ENTITY_GRAPH_VERSION = 2
