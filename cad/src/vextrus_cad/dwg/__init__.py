"""`vextrus_cad.dwg` — a DWG in, a DXF and its audit out, through LibreDWG only (L-CAD-04).

The lane runs stateless: one drawing per invocation, a scratch directory that does not survive the
call, and the converted DXF the only thing left behind. LibreDWG is reached as an isolated
subprocess and nothing else, twice: a `dwgread -O JSON` census and a `dwg2dxf` conversion read back
through ezdxf, reconciled class by class. A class the conversion lost, or one the census could not
name, refuses that class on that sheet and is returned as data; a drawing that cannot be read, a
program that is not there and a pass that outruns its budget refuse loudly, by name.
"""

from __future__ import annotations

from .census import census_of
from .convert import DwgConversion, convert_dwg
from .errors import DwgError
from .reconcile import SHORTFALL, UNKNOWN_ENT, RefusedClass, reconcile
from .tally import geometry_tally
from .toolchain import DEFAULT_TOOLCHAIN, DWG_TIMEOUT_SECONDS, Toolchain

__all__ = [
    "DEFAULT_TOOLCHAIN",
    "DWG_TIMEOUT_SECONDS",
    "SHORTFALL",
    "UNKNOWN_ENT",
    "DwgConversion",
    "DwgError",
    "RefusedClass",
    "Toolchain",
    "census_of",
    "convert_dwg",
    "geometry_tally",
    "reconcile",
]
