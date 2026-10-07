"""S16-B's stand-ins for the two seams `boq` reads but does not own, so `boq` is tested alone.

The session-16 contract (boq and GFA section; M1.md C13, C15) names them:
- `measurement.services.measure(building_id, model_version_seq, rule_set_version_id) -> Measured(lines)`
  (ticket M), stood in here by fixed Measurement Lines;
- `rates.services.working_rate(item_code, project_id) -> WorkingRate(amount, per_unit) | RateNotEntered`
  (ticket RT), stood in here by fixed rates.
A third seam is `boq`'s own: `vextrus.boq.services.steps.confirmed(building_id) -> frozenset[str]`, the
Takeoff Steps confirmed in the Building (the step keys `storeys`, `grid`, `columns`), which `boq` reads
from `takeoff` however its builder chooses; the tests set it, so "a confirmed step" is fixed here.

The lines are C13's worked example: the columns' concrete measured at 1245.37 cft in two lines, one
held Element awaiting an answer at 12.50 cft, rated 512.40; the columns' formwork with no rate entered;
the columns' Rebar by ratio, 200.00 kg rated 95.00. All invented.
"""

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import pytest

CONCRETE = "RCC-COL-1:1.5:3"
FORMWORK = "FW-COL"
REBAR = "REBAR-500W"

RATES: dict[str, tuple[Decimal, str] | None] = {
    CONCRETE: (Decimal("512.40"), "cft"),
    FORMWORK: None,  # rate not entered
    REBAR: (Decimal("95.00"), "kg"),
}


@dataclass(frozen=True)
class Line:
    """A Measurement Line as `measure` gives it (the fields `boq` needs; quantity in Billing Units)."""

    element_id: uuid.UUID
    item_code: str
    step: str
    family: str
    storey: str
    billing_unit: str
    quantity: Decimal
    state: str  # "measured" | "awaiting_answer"
    rebar_basis: str | None
    trace: tuple[dict[str, str], ...]


@dataclass(frozen=True)
class Measured:
    lines: tuple[Line, ...]


@dataclass(frozen=True)
class WorkingRate:
    amount: Decimal
    per_unit: str


def _trace(n: int) -> tuple[dict[str, str], ...]:
    return (
        {
            "sheet_id": str(uuid.UUID(int=100 + n)),
            "view_id": str(uuid.UUID(int=200 + n)),
            "anchor": f"C{n}",
        },
    )


C1, C2, C3 = (uuid.UUID(int=n) for n in (1, 2, 3))


def column_lines() -> tuple[Line, ...]:
    """The confirmed columns C1 and C2 measured, C3 held awaiting its size answer."""

    def line(element: uuid.UUID, code: str, unit: str, qty: str, state: str, n: int) -> Line:
        rebar = "by_ratio" if code == REBAR else None
        return Line(
            element, code, "columns", "column", "floor_1", unit, Decimal(qty), state, rebar, _trace(n)
        )

    return (
        line(C1, CONCRETE, "cft", "622.68", "measured", 1),
        line(C2, CONCRETE, "cft", "622.69", "measured", 2),
        line(C3, CONCRETE, "cft", "12.50", "awaiting_answer", 3),
        line(C1, FORMWORK, "sft", "60.00", "measured", 1),
        line(C2, FORMWORK, "sft", "40.00", "measured", 2),
        line(C1, REBAR, "kg", "100.00", "measured", 1),
        line(C2, REBAR, "kg", "100.00", "measured", 2),
    )


@dataclass
class Seams:
    lines: tuple[Line, ...] = ()
    confirmed: frozenset[str] = frozenset()


def _not_entered(code: str) -> Any:
    from vextrus.rates import services as rates

    kind = rates.RateNotEntered
    try:
        return kind(item_code=code)
    except TypeError:
        return kind()


@pytest.fixture
def seams(monkeypatch: pytest.MonkeyPatch) -> Seams:
    """Fixed lines, rates and confirmed steps; each test sets `lines` and `confirmed`."""
    from vextrus.measurement import services as measurement
    from vextrus.rates import services as rates

    state = Seams()

    def measure(
        building_id: uuid.UUID, model_version_seq: Any = None, rule_set_version_id: Any = None
    ) -> Measured:
        return Measured(state.lines)

    def working_rate(item_code: str, project_id: uuid.UUID) -> Any:
        rate = RATES.get(item_code)
        if rate is None:
            return _not_entered(item_code)
        made = getattr(rates, "WorkingRate", WorkingRate)
        return made(amount=rate[0], per_unit=rate[1])

    def confirmed(building_id: uuid.UUID) -> frozenset[str]:
        return state.confirmed

    from vextrus.boq.services import steps

    monkeypatch.setattr(measurement, "measure", measure, raising=False)
    monkeypatch.setattr(rates, "working_rate", working_rate, raising=False)
    monkeypatch.setattr(steps, "confirmed", confirmed)
    return state
