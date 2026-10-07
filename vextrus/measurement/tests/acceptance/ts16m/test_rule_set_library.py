"""Ticket S16-M: the measurement subset's Rule Set rows in the Market's Library.

The plan (docs/plans/M1.md C11; session 16's contract, "measurement (M)"): "three column BoqItems:
`RCC-COL-1:1.5:3` (concrete, billing cft), `FW-COL` (formwork, sft), `REBAR-500W` (rebar, kg) with
BoqItemBillingUnit; RebarRatio for columns (kg/m3, Low, source cited)", and the rules F1, FW2 and R2,
each "citing its clause" (C11: "Each rule is printed in Vextrus's own words, citing its clause").

The rows are Library rows (docs/data-model.md §3.4, scope L): `sync_library` writes them from
`vextrus/measurement/library.py` into each Market's Library, idempotently, as every module's do.
"""

from decimal import Decimal
from importlib import import_module
from typing import Any

import pytest

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import library as platform_library
from vextrus.platform.services.markets import MarketProfile

COLUMN_ITEMS = {"RCC-COL-1:1.5:3": "cft", "FW-COL": "sft", "REBAR-500W": "kg"}
"""Each column BOQ Item and its imperial Billing Unit (the contract's "billing cft", "sft", "kg")."""

DB = pytest.mark.django_db(databases=["default", "owner"])


def model(name: str) -> Any:
    """A `measurement` model S16-M adds, found when the test runs (so the file collects before)."""
    return getattr(import_module("vextrus.measurement.models"), name)


def the_version(market: MarketProfile) -> Any:
    """The Market's one Rule Set Version in this subset."""
    [version] = model("RuleSetVersion").objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    return version


@DB
def test_sync_library_writes_the_three_column_boq_items(market: MarketProfile) -> None:
    platform_library.sync()
    version = the_version(market)

    codes = set(
        model("BoqItem")
        .objects.using(OWNER_ALIAS)
        .filter(tenant_id=market.library_id, version=version)
        .values_list("item_code", flat=True)
    )

    assert set(COLUMN_ITEMS) <= codes


@DB
def test_each_column_boq_item_bills_imperial_in_cft_sft_and_kg(market: MarketProfile) -> None:
    platform_library.sync()
    version = the_version(market)

    billed = {
        unit.item.item_code: unit.billing_unit
        for unit in model("BoqItemBillingUnit")
        .objects.using(OWNER_ALIAS)
        .filter(tenant_id=market.library_id, item__version=version, unit_system="imperial")
        .select_related("item")
    }

    assert {code: billed.get(code) for code in COLUMN_ITEMS} == COLUMN_ITEMS


@pytest.mark.parametrize("code", ["F1", "FW2", "R2"])
@DB
def test_rules_f1_fw2_and_r2_carry_a_clause_citation(market: MarketProfile, code: str) -> None:
    platform_library.sync()
    version = the_version(market)

    rule = (
        model("MeasurementRule")
        .objects.using(OWNER_ALIAS)
        .get(tenant_id=market.library_id, version=version, code=code)
    )

    assert rule.cites, f"{code} cites no clause"
    assert rule.words, f"{code} has no words"


@DB
def test_the_column_rebar_ratio_is_a_decimal_in_kg_per_m3(market: MarketProfile) -> None:
    platform_library.sync()
    version = the_version(market)

    [ratio] = (
        model("RebarRatio")
        .objects.using(OWNER_ALIAS)
        .filter(tenant_id=market.library_id, version=version, family_key="column", band__isnull=True)
    )

    assert ratio.unit == "kg/m3"
    assert isinstance(ratio.value, Decimal)
    assert ratio.value > 0


@DB
def test_a_second_sync_library_writes_no_measurement_row(market: MarketProfile) -> None:
    platform_library.sync()
    version = the_version(market)
    items = model("BoqItem").objects.using(OWNER_ALIAS).filter(tenant_id=market.library_id)
    before = sorted(items.values_list("id", flat=True))

    again = platform_library.sync()

    assert again.get("measurement", 0) == 0
    assert sorted(items.values_list("id", flat=True)) == before
    assert items.filter(version=version).count() >= len(COLUMN_ITEMS)
