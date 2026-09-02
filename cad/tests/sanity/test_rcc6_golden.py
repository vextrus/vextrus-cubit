"""AC-7 — the hand takeoff golden recomputes from the authored inputs alone (L-FRM-02/03, L-QTY-06).

Every row's quantity is re-derived here from `inputs.json` by the contract's formulas, in exact
decimal arithmetic so a half-way case rounds half-even on the true value rather than on a binary
float's neighbour, and compared as the three-decimal string the golden spells. The drawing is never
consulted: an input may not be derived from the figure it is compared against.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path
from typing import Any

import pytest

GOLDEN_REL = "takeoff.golden.json"
INPUTS_REL = "inputs.json"

CLASSES = frozenset({"FOOTING", "PILE_CAP", "TIE_BEAM", "COLUMN", "BEAM", "SLAB"})
FOUNDATION_CLASSES = frozenset({"FOOTING", "PILE_CAP", "TIE_BEAM"})
FOUNDATION_LEVEL = "FDN"
CONCRETE = "RCC_CONCRETE"
FORMWORK = "FORMWORK"
UNITS = {CONCRETE: "m3", FORMWORK: "m2"}

THREE_DECIMALS = re.compile(r"^-?\d+\.\d{3}$")
QUANTUM = Decimal("0.001")
MM = Decimal(1000)

#: cad/tests/sanity/<this file> -> the checkout.
_CORPUS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6"

Key = tuple[str, str, str]


def _golden_keys() -> list[Key]:
    path = _CORPUS_DIR / GOLDEN_REL
    if not path.is_file():
        return []
    document = json.loads(path.read_text(encoding="utf-8"))
    rows = document.get("rows") if isinstance(document, dict) else None
    if not isinstance(rows, list):
        return []
    return [
        (str(row.get("class")), str(row.get("kind")), str(row.get("level")))
        for row in rows
        if isinstance(row, dict)
    ]


GOLDEN_KEYS = _golden_keys()


def expected_quantities(inputs: dict[str, Any]) -> dict[Key, Decimal]:
    """Every (class, kind, level) the inputs give rise to, with its exact quantity in m³ / m²."""
    heights = {level["name"]: Decimal(level["storey_height_m"]) for level in inputs["levels"]}
    totals: dict[Key, Decimal] = {}

    def add(cls: str, kind: str, level: str, amount: Decimal) -> None:
        assert level in heights, f"inputs.json names level {level!r} outside its level stack"
        totals[cls, kind, level] = totals.get((cls, kind, level), Decimal(0)) + amount

    for column in inputs["columns"]:
        b, d, count = column["b_mm"] / MM, column["d_mm"] / MM, Decimal(column["count"])
        for level in column["levels"]:
            add("COLUMN", CONCRETE, level, count * b * d * heights[level])
            add("COLUMN", FORMWORK, level, count * 2 * (b + d) * heights[level])
    for beam in inputs["beams"]:
        b, d, span = beam["b_mm"] / MM, beam["d_mm"] / MM, Decimal(beam["span_m"])
        count = Decimal(beam["count"])
        for level in beam["levels"]:
            add("BEAM", CONCRETE, level, count * b * d * span)
            add("BEAM", FORMWORK, level, count * (2 * d + b) * span)
    for slab in inputs["slab"]:
        net = Decimal(slab["area_m2"]) - Decimal(slab["openings_m2"])
        add("SLAB", CONCRETE, slab["level"], net * (slab["thickness_mm"] / MM))
        add("SLAB", FORMWORK, slab["level"], net)
    for cls, key in (("FOOTING", "footings"), ("PILE_CAP", "pile_caps")):
        for item in inputs[key]:
            length, b, depth = item["l_mm"] / MM, item["b_mm"] / MM, item["depth_mm"] / MM
            count = Decimal(item["count"])
            add(cls, CONCRETE, FOUNDATION_LEVEL, count * length * b * depth)
            add(cls, FORMWORK, FOUNDATION_LEVEL, count * 2 * (length + b) * depth)
    for tie in inputs["tie_beams"]:
        b, d, span, count = tie["b_mm"] / MM, tie["d_mm"] / MM, Decimal(tie["span_m"]), Decimal(tie["count"])
        add("TIE_BEAM", CONCRETE, FOUNDATION_LEVEL, count * b * d * span)
        add("TIE_BEAM", FORMWORK, FOUNDATION_LEVEL, count * (2 * d + b) * span)
    return totals


def spelled(amount: Decimal) -> str:
    return format(amount.quantize(QUANTUM, rounding=ROUND_HALF_EVEN), "f")


def _inputs(corpus) -> dict[str, Any]:
    return corpus.read_json(INPUTS_REL, parse_float=Decimal, parse_int=Decimal)


def _golden(corpus) -> dict[str, Any]:
    return corpus.read_json(GOLDEN_REL)


def _rows_by_key(corpus) -> dict[Key, dict[str, Any]]:
    return {(row["class"], row["kind"], row["level"]): row for row in _golden(corpus)["rows"]}


def _expected(corpus) -> dict[Key, Decimal]:
    return corpus.once("golden-expected", lambda: expected_quantities(_inputs(corpus)))


def test_ac7_rows_are_unique_on_class_kind_level(corpus) -> None:
    golden = _golden(corpus)
    assert golden.get("fixture") == "F-RCC6"
    assert golden.get("provenance") == "HAND_FROM_AUTHORED_SOURCE"
    rows = golden.get("rows")
    assert isinstance(rows, list) and rows, "the golden holds no rows"
    keys = Counter((row["class"], row["kind"], row["level"]) for row in rows)
    duplicated = sorted(key for key, seen in keys.items() if seen > 1)
    assert duplicated == [], f"rows repeated on (class, kind, level): {duplicated}"


def test_ac7_every_row_speaks_the_contract_vocabulary(corpus) -> None:
    level_names = {level["name"] for level in _inputs(corpus)["levels"]}
    offences: list[str] = []
    for row in _golden(corpus)["rows"]:
        key = (row.get("class"), row.get("kind"), row.get("level"))
        if row.get("class") not in CLASSES:
            offences.append(f"{key}: class")
        if row.get("kind") not in UNITS:
            offences.append(f"{key}: kind")
        if row.get("level") not in level_names:
            offences.append(f"{key}: level not in inputs.levels")
        if row.get("class") in FOUNDATION_CLASSES and row.get("level") != FOUNDATION_LEVEL:
            offences.append(f"{key}: a foundation class off {FOUNDATION_LEVEL}")
        if row.get("unit") != UNITS.get(row.get("kind")):
            offences.append(f"{key}: unit {row.get('unit')!r}")
        if not isinstance(row.get("quantity"), str) or not THREE_DECIMALS.match(row["quantity"]):
            offences.append(f"{key}: quantity {row.get('quantity')!r} is not a three-decimal string")
    assert offences == [], "\n".join(offences)


def test_ac7_the_row_set_is_exactly_what_the_inputs_give_rise_to(corpus) -> None:
    expected, rows = _expected(corpus), _rows_by_key(corpus)
    assert expected, "inputs.json gives rise to no quantity at all"
    lacking = sorted(set(expected) - set(rows))
    assert lacking == [], f"rows the inputs call for that the golden lacks: {lacking}"
    surplus = sorted(set(rows) - set(expected))
    assert surplus == [], f"golden rows the inputs give no rise to: {surplus}"


@pytest.mark.parametrize("key", GOLDEN_KEYS, ids=[":".join(key) for key in GOLDEN_KEYS])
def test_ac7_each_quantity_recomputes_from_the_inputs(corpus, key: Key) -> None:
    expected, rows = _expected(corpus), _rows_by_key(corpus)
    assert key in expected, f"{key}: the inputs give rise to no such row"
    want = spelled(expected[key])
    assert rows[key]["quantity"] == want, (
        f"{key}: the golden says {rows[key]['quantity']}, the formulas over inputs.json give {want}"
    )
