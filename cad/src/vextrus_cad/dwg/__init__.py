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
from .dimensions import DrawnDimensions, carries_picture, draw_missing_pictures
from .errors import DwgError
from .heal import WRAP_COLUMN, Rejoined, heal_wrapped_text, rejoin_wrapped_text
from .reconcile import SHORTFALL, UNKNOWN_ENT, RefusedClass, losses_by_space, reconcile
from .tally import geometry_tally
from .toolchain import DEFAULT_TOOLCHAIN, DWG_TIMEOUT_SECONDS, Toolchain

__all__ = [
    "DEFAULT_TOOLCHAIN",
    "DWG_TIMEOUT_SECONDS",
    "SHORTFALL",
    "UNKNOWN_ENT",
    "WRAP_COLUMN",
    "DrawnDimensions",
    "DwgConversion",
    "DwgError",
    "RefusedClass",
    "Rejoined",
    "Toolchain",
    "carries_picture",
    "census_of",
    "convert_dwg",
    "draw_missing_pictures",
    "geometry_tally",
    "heal_wrapped_text",
    "losses_by_space",
    "reconcile",
    "rejoin_wrapped_text",
]
