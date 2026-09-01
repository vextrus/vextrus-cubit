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
