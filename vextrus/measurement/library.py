"""`measurement`'s Library rows, which `sync_library` (02) reads (session 16's subset of C11,
docs/plans/M1.md; docs/data-model.md §3.4): a Rule Set with one published Version holding the column
rules F1, FW2 and R2 in Vextrus's own words (each citing its clause, never quoting it), the three
column BOQ Items with their Billing Units, and the column Rebar Ratio.

A row's identity is the one the data model gives it (a rule's `(version, code)`, a BOQ Item's
`(version, item_code)`, a Billing Unit's `(item, unit_system)`, a ratio's `(version, family, band)`):
`sync` updates a row that is there and creates one that is not, so a second run writes nothing.
The Version's `content_hash` is the hash of the rows below, so a change to them is a new hash.
"""

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from vextrus.measurement.models import (
    BoqItem,
    BoqItemBillingUnit,
    MeasurementRule,
    RebarRatio,
    RuleSet,
    RuleSetVersion,
)
from vextrus.platform.services.library import Library

RULE_SET_NAME = "Starter Rule Set"
VERSION_NUMBER = 1

BILLED_SYSTEM = "imperial"
OTHER_SYSTEM = "metric"
"""The unit systems' keys, the same for every Market (which ones a Market offers is its data)."""

FEET = Decimal("0.3048")
CFT_M3 = FEET**3
"""A cubic foot in m3, exactly (0.028316846592)."""
SFT_M2 = FEET**2
"""A square foot in m2, exactly (0.09290304)."""


@dataclass(frozen=True)
class RuleRow:
    code: str
    kind: str
    family_key: str
    words: str
    cites: str
    params: Mapping[str, str] = field(default_factory=dict)
    source: str = ""


RULES: tuple[RuleRow, ...] = (
    RuleRow(
        "F1",
        "quantity",
        "column",
        "A column's concrete is its section, breadth times depth, times its height, measured on "
        "the gross section; its height is the storey's, from the floor to the underside of the "
        "slab above.",
        "IS 1200 Pt 2 cl. 4.2.2.1",
        {"item_code": "RCC-COL-1:1.5:3"},
        "docs/research/qs-defaults.md, F1",
    ),
    RuleRow(
        "FW2",
        "quantity",
        "column",
        "A column's formwork is its perimeter, twice breadth plus depth, times its height, with no "
        "deduction where beams frame in.",
        "IS 1200 Pt 5 cl. 6.6",
        {"item_code": "FW-COL"},
        "docs/research/qs-defaults.md, FW2",
    ),
    RuleRow(
        "R2",
        "quantity",
        "column",
        "Where the drawing's bars are not yet measured, a column's Rebar is its concrete volume "
        "times the Rebar Ratio for columns, and is shown as by ratio.",
        "ADR 0010",
        {"item_code": "REBAR-500W", "concrete_rule": "F1"},
        "docs/research/qs-defaults.md, R2",
    ),
)


@dataclass(frozen=True)
class UnitRow:
    unit_system: str
    billing_unit: str
    unit_si: str
    si_per_unit: Decimal
    total_decimals: int = 2


@dataclass(frozen=True)
class ItemRow:
    item_code: str
    description: str
    group: str
    description_code: str
    description_params: tuple[str, ...]
    units: tuple[UnitRow, ...]
    trade: str = "structure"
    boq_section: str = "super_structure"
    stage_kind: str = "frame"


ITEMS: tuple[ItemRow, ...] = (
    ItemRow(
        "RCC-COL-1:1.5:3",
        "Reinforced cement concrete in columns, 1:1.5:3",
        "columns",
        "boq.item.rcc",
        ("strength_mpa", "mix", "class"),
        (
            UnitRow(BILLED_SYSTEM, "cft", "m3", CFT_M3),
            UnitRow(OTHER_SYSTEM, "m3", "m3", Decimal(1)),
        ),
    ),
    ItemRow(
        "FW-COL",
        "Formwork to columns",
        "columns",
        "boq.item.formwork",
        ("class",),
        (
            UnitRow(BILLED_SYSTEM, "sft", "m2", SFT_M2),
            UnitRow(OTHER_SYSTEM, "m2", "m2", Decimal(1)),
        ),
    ),
    ItemRow(
        "REBAR-500W",
        "Reinforcement, grade 500W",
        "columns",
        "boq.item.rebar",
        ("grade", "class"),
        (
            UnitRow(BILLED_SYSTEM, "kg", "kg", Decimal(1), total_decimals=0),
            UnitRow(OTHER_SYSTEM, "kg", "kg", Decimal(1), total_decimals=0),
        ),
    ),
)


@dataclass(frozen=True)
class RatioRow:
    family_key: str
    value: Decimal
    unit: str
    confidence: str
    source: str


RATIOS: tuple[RatioRow, ...] = (
    RatioRow(
        "column",
        Decimal("240.1397"),
        "kg/m3",
        "Low",
        "docs/research/qs-defaults.md, Rod Ratios: a starter figure of 6.8 kg/cft for columns "
        "(240.1397 kg/m3), an engineering judgement bounded by BNBC and ACI minimums, with no "
        "citable Dhaka ratio; the owner sets it",
    ),
)


def content_hash() -> str:
    """The hash of every row this module writes, so a change to one is a change of hash."""
    payload = {
        "rules": [[r.code, r.kind, r.family_key, r.words, r.cites, dict(r.params)] for r in RULES],
        "items": [
            [
                i.item_code,
                i.description,
                i.group,
                [
                    [u.unit_system, u.billing_unit, u.unit_si, str(u.si_per_unit), u.total_decimals]
                    for u in i.units
                ],
            ]
            for i in ITEMS
        ],
        "ratios": [[r.family_key, str(r.value), r.unit] for r in RATIOS],
    }
    return "sha256:" + hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def sync(libraries: Sequence[Library], using: str) -> int:
    """Write the Rule Set rows into each Market's Library, through `using` (the owner); the rows
    created or changed (0 when every row is already as written here)."""
    written = 0
    for library in libraries:
        tenant = library.library_id
        rule_set, changed = _put(
            RuleSet.objects.using(using), {"tenant_id": tenant, "name": RULE_SET_NAME}, {}
        )
        written += changed
        version, changed = _put(
            RuleSetVersion.objects.using(using),
            {"tenant_id": tenant, "rule_set": rule_set, "number": VERSION_NUMBER},
            {"status": "published", "content_hash": content_hash()},
        )
        written += changed
        for rule in RULES:
            _, changed = _put(
                MeasurementRule.objects.using(using),
                {"tenant_id": tenant, "version": version, "code": rule.code},
                {
                    "kind": rule.kind,
                    "family_key": rule.family_key,
                    "words": {"en": rule.words},
                    "cites": rule.cites,
                    "params": dict(rule.params),
                    "source": rule.source,
                },
            )
            written += changed
        for item in ITEMS:
            row, changed = _put(
                BoqItem.objects.using(using),
                {"tenant_id": tenant, "version": version, "item_code": item.item_code},
                {
                    "labels": {"en": item.description},
                    "trade": item.trade,
                    "boq_section": item.boq_section,
                    "group": item.group,
                    "stage_kind": item.stage_kind,
                    "basis_kind": "measured",
                    "supply_kind": "developer_materials",
                    "labour_measure": False,
                    "description_template": {
                        "code": item.description_code,
                        "params": list(item.description_params),
                    },
                },
            )
            written += changed
            for unit in item.units:
                _, changed = _put(
                    BoqItemBillingUnit.objects.using(using),
                    {"tenant_id": tenant, "item": row, "unit_system": unit.unit_system},
                    {
                        "billing_unit": unit.billing_unit,
                        "unit_si": unit.unit_si,
                        "si_per_unit": unit.si_per_unit,
                        "line_decimals": 2,
                        "total_decimals": unit.total_decimals,
                    },
                )
                written += changed
        for ratio in RATIOS:
            _, changed = _put(
                RebarRatio.objects.using(using),
                {"tenant_id": tenant, "version": version, "family_key": ratio.family_key, "band": None},
                {
                    "value": ratio.value,
                    "unit": ratio.unit,
                    "confidence": ratio.confidence,
                    "source": ratio.source,
                },
            )
            written += changed
    return written


def _put(manager: Any, identity: dict[str, Any], wanted: dict[str, Any]) -> tuple[Any, int]:
    """The row with `identity`, made to hold `wanted`; and 1 if it was created or changed, else 0."""
    row = manager.filter(**identity).first()
    if row is None:
        return manager.create(**identity, **wanted), 1
    changed = [name for name, value in wanted.items() if getattr(row, name) != value]
    if not changed:
        return row, 0
    for name in changed:
        setattr(row, name, wanted[name])
    row.save(using=manager.db, update_fields=changed)
    return row, 1
