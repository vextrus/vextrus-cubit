"""The one refusal this lane raises (L-CAD-04)."""

from __future__ import annotations


class DwgError(Exception):
    """A drawing this lane refuses: loud failure, nothing written.

    An unreadable drawing, an absent program, an unparseable census, a missing or unparseable
    converted DXF and a pass that outruns its budget are all refused this way, and every message
    that leaves `convert_dwg` names the source drawing. A per-class shortfall is not one of these:
    it refuses a class on a sheet and is returned as data on `DwgConversion.refused`.
    """
