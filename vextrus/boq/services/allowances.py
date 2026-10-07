"""Vextrus's default allowances per Takeoff Step (S16-B; M1.md C13; docs/specs/bd-defaults.md,
"Allowances per Takeoff Step", from docs/research/tax-and-allowances.md §B.2, G+9).

Each is a consumption per sft of Gross Floor Area of one BOQ Item, in that Item's Billing Unit, priced
through `rates.services.working_rate` like a measured line. Every figure is Low confidence, source
"vextrus_default", until the Developer's own past projects replace it. Storeys and the grid bill
nothing of their own, so they carry no allowance. Foundations has two parts (C13: `piles_caps`,
`rest`); the side formwork's 0.10 sft is split by the reference building's cap and grade-beam side
areas, which M1-07 has not printed yet, so this slice puts it whole in `rest` (Low).
"""

from dataclasses import dataclass
from decimal import Decimal

SOURCE = "vextrus_default"
CONFIDENCE = "low"


@dataclass(frozen=True)
class Consumption:
    item_code: str
    per_area: Decimal
    """Billing Units of the Item per sft of Gross Floor Area."""
    billing_unit: str


@dataclass(frozen=True)
class AllowanceDefault:
    step: str
    part: str
    consumptions: tuple[Consumption, ...]


def _c(item_code: str, per_area: str, unit: str) -> Consumption:
    return Consumption(item_code, Decimal(per_area), unit)


DEFAULTS: tuple[AllowanceDefault, ...] = (
    AllowanceDefault(
        "foundations",
        "piles_caps",
        (
            _c("RCC-PILE-1:1.5:3", "0.27", "cft"),
            _c("PILE-BORING", "0.12", "rft"),
            _c("RCC-PCAP-1:1.5:3", "0.12", "cft"),
            _c("PILE-HEAD-BREAK", "0.00174", "nos"),
            _c("REBAR-500W", "0.759", "kg"),
        ),
    ),
    AllowanceDefault(
        "foundations",
        "rest",
        (
            _c("RCC-GB-1:1.5:3", "0.026", "cft"),
            _c("RCC-SOG-1:1.5:3", "0.042", "cft"),
            _c("CC-1:3:6", "0.017", "cft"),
            _c("REBAR-500W", "0.181", "kg"),
            _c("FW-FDN", "0.10", "sft"),
            _c("EW-EXC", "0.55", "cft"),
            _c("SAND-FILL", "0.20", "cft"),
            _c("BFS", "0.17", "sft"),
        ),
    ),
    AllowanceDefault(
        "columns",
        "whole",
        (
            _c("RCC-COL-1:1.5:3", "0.17", "cft"),
            _c("RCC-SW-1:1.5:3", "0.041", "cft"),
            _c("REBAR-500W", "1.40", "kg"),
            _c("FW-COL", "0.59", "sft"),
        ),
    ),
    AllowanceDefault(
        "beams",
        "whole",
        (
            _c("RCC-BM-1:1.5:3", "0.22", "cft"),
            _c("REBAR-500W", "1.14", "kg"),
            _c("FW-BM", "0.68", "sft"),
        ),
    ),
    AllowanceDefault(
        "slabs",
        "whole",
        (
            _c("RCC-SLB-1:1.5:3", "0.465", "cft"),
            _c("RCC-EDGE-1:1.5:3", "0.021", "cft"),
            _c("REBAR-500W", "1.22", "kg"),
            _c("FW-SLB", "0.88", "sft"),
        ),
    ),
    AllowanceDefault(
        "stairs",
        "whole",
        (
            _c("RCC-STR-1:1.5:3", "0.017", "cft"),
            _c("REBAR-500W", "0.05", "kg"),
            _c("FW-STR", "0.044", "sft"),
        ),
    ),
    AllowanceDefault(
        "tanks",
        "whole",
        (
            _c("RCC-TNK-1:1.5:3", "0.028", "cft"),
            _c("REBAR-500W", "0.10", "kg"),
            _c("FW-TNK", "0.042", "sft"),
        ),
    ),
    AllowanceDefault(
        "walls",
        "whole",
        (
            _c("BW-250", "0.33", "cft"),
            _c("BW-125", "1.24", "sft"),
            _c("RCC-LNT-1:1.5:3", "0.013", "cft"),
            _c("REBAR-500W", "0.03", "kg"),
            _c("FW-LNT", "0.07", "sft"),
            _c("WINDOW", "0.12", "sft"),
            _c("DOOR", "0.010", "nos"),
        ),
    ),
    AllowanceDefault(
        "rooms",
        "whole",
        (
            _c("PLST-12-1:6", "2.87", "sft"),
            _c("PLST-12-1:4", "0.49", "sft"),
            _c("PLST-6-1:4", "1.13", "sft"),
            _c("TILE-FLR", "0.76", "sft"),
            _c("TILE-WALL", "0.53", "sft"),
            _c("SKIRTING", "0.23", "rft"),
            _c("PAINT-INT", "3.49", "sft"),
            _c("PAINT-EXT", "0.50", "sft"),
            _c("FLR-PARK", "0.07", "sft"),
        ),
    ),
    AllowanceDefault(
        "roof",
        "whole",
        (
            _c("ROOF-TREAT", "0.10", "sft"),
            _c("BW-125-PARAPET", "0.020", "sft"),
            _c("RCC-ROOFRM-1:1.5:3", "0.007", "cft"),
            _c("REBAR-500W", "0.03", "kg"),
            _c("BW-125-ROOFRM", "0.016", "sft"),
        ),
    ),
)
"""In Takeoff Step order; the item codes are this slice's until M1-07 names them in the Rule Set."""
