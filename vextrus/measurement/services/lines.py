"""The Measurement Line as `measurement` gives it (docs/plans/M1.md C11, frozen by M1-00): what
`measurement.services.preview` and `measure` return (the services are M1-45's).

This is the service's type, SI only, never a float (A16). It is not `boq`'s table of the same name
(C13's `boq.MeasurementLine`, the cache `boq` keeps of these lines). A line carries its Element's
`mark`, `storey_id` and `trace` (A8), so a BOQ figure opens its sheet.
"""

import uuid
from dataclasses import dataclass
from decimal import Decimal

from vextrus.live_model.services import TraceEntry


@dataclass(frozen=True)
class MeasurementLine:
    """One measured line of one BOQ Item for one Element: `qty_si` in `unit_si`, with its dimensions
    (m, m²), the rules it was measured by, and its Element's Traces."""

    item_code: str
    element_id: uuid.UUID
    mark: str
    storey: str | None
    storey_id: uuid.UUID | None
    rule_codes: tuple[str, ...]
    nos: int
    l_m: Decimal | None
    b_m: Decimal | None
    h_m: Decimal | None
    area_m2: Decimal | None
    qty_si: Decimal
    unit_si: str
    rebar_basis: str | None
    diameter_mm: int | None
    assumed_split: bool
    lap: bool
    held: bool
    trace: tuple[TraceEntry, ...]
