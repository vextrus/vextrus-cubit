"""`$INSUNITS` reporting (L-CAD-02).

Coordinates stay in native drawing units; the header code is reported as it stands. A code the
closed map does not name reports null plus a flag — never "unitless", which is itself a code.
"""

from __future__ import annotations

from typing import Final

#: The closed map L-CAD-02 spells out.
INSUNITS: Final[dict[int, str]] = {0: "unitless", 1: "inch", 2: "foot", 4: "mm", 5: "cm", 6: "m"}


def report(code: int) -> dict[str, object]:
    """The artifact's `insunits` record for a header code."""
    unit = INSUNITS.get(code)
    return {"code": code, "unit": unit, "unmapped": unit is None}


#: How many millimetres one drawing unit is, per `$INSUNITS` code (L-CAD-02, L-MEA-01). A code the
#: table does not hold — `unitless` among them — states no length, and nothing here invents one.
MM_PER_UNIT: Final[dict[int, float]] = {1: 25.4, 2: 304.8, 4: 1.0, 5: 10.0, 6: 1000.0}


def mm_per_unit(code: int) -> float | None:
    """The millimetres one drawing unit measures, or None where the header states no unit."""
    return MM_PER_UNIT.get(code)
