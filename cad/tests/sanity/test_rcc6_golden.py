"""AC-7 — the hand takeoff golden recomputes from the authored inputs alone (L-FRM-02/03, L-QTY-06).

F-RCC6 v1.1: BEAM and SLAB are billed under AM-02 (L-MEA-09) — one owner per junction — from the
measured geometry `inputs.json` carries beside each member. COLUMN, FOOTING, PILE_CAP and TIE_BEAM
are unchanged, and the column rows are frozen by AM-01 (proved, not asserted, in
tests/golden/rcc6-column-rows-frozen.test.ts).

Every RCC_CONCRETE and FORMWORK row's quantity is re-derived here from `inputs.json` by the
contract's formulas, in exact decimal arithmetic so a half-way case rounds half-even on the true
value rather than on a binary float's neighbour, and compared as the three-decimal string the
golden spells. The drawing is never consulted: an input may not be derived from the figure it is
compared against.

The recomputation is scoped to the two kinds this increment's formulas define. The golden is a
ledger keyed (class, kind, level); a kind a later increment adds (rebar, per R-TO-035) extends it
without redding these tests — such a row still owes a unique key, a contract class, a level from
the stack and a three-decimal quantity, and nothing more here.

The inputs themselves are F-RCC6's: its level stack and its mark families are the fixture's
definition, so the lean-inputs shortcut (two levels, one column) is closed by name.
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
#: The kinds whose formulas this increment fixes (L-FRM-02 concrete, L-FRM-03 formwork).
UNITS = {CONCRETE: "m3", FORMWORK: "m2"}

#: F-RCC6's level stack, in order, and the marks each family draws (the fixture's definition).
CONTRACT_LEVELS = ("FDN", "GF", "1F", "2F", "3F", "4F", "5F", "ROOF")
CONTRACT_MARKS: dict[str, frozenset[str]] = {
    "columns": frozenset({"C1", "C2", "C3", "C4"}),
    "beams": frozenset({"B1", "B2", "B3", "B4", "B5", "B6"}),
    "footings": frozenset({"F1", "F2", "F3", "F4"}),
    "pile_caps": frozenset({"PC1", "PC2"}),
}

THREE_DECIMALS = re.compile(r"^-?\d+\.\d{3}$")
QUANTUM = Decimal("0.001")
MM = Decimal(1000)

#: cad/tests/sanity/<this file> -> the checkout.
_CORPUS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6"

Key = tuple[str, str, str]


def _golden_keys() -> list[Key]:
    """The (class, kind, level) keys of the committed golden's RCC_CONCRETE / FORMWORK rows."""
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
        if isinstance(row, dict) and row.get("kind") in UNITS
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
    # F-RCC6 v1.1 bills beams and slabs under AM-02 (L-MEA-09, one owner per junction), not at the
    # schedule span and the nominal plate of v1.0: a beam is clear between its support faces and
    # below the slab soffit, so it owns b x (D - t) x clear and the contact faces
    # (D - t_left) + (D - t_right) + b; the slab runs through, out to the edge beams' outer faces,
    # less the column plan areas and the openings. `inputs.json` states the measured geometry as
    # exact decimals under each member's "measured"; the formulas here are this path's own.
    for beam in inputs["beams"]:
        b, d = beam["b_mm"] / MM, beam["d_mm"] / MM
        for level, groups in beam["measured"]["faces"].items():
            for group in groups:
                clear = Decimal(group["clear_m"])
                left, right = (Decimal(face) / MM for face in group["slab_t_mm"])
                add("BEAM", CONCRETE, level, b * (d - max(left, right)) * clear)
                add("BEAM", FORMWORK, level, ((d - left) + (d - right) + b) * clear)
    for slab in inputs["slab"]:
        measured = slab["measured"]
        thickness = slab["thickness_mm"] / MM
        plate = (
            Decimal(measured["plate_m2"])
            - Decimal(measured["columns_m2"])
            - Decimal(measured["openings_m2"])
        )
        add("SLAB", CONCRETE, slab["level"], plate * thickness)
        add(
            "SLAB",
            FORMWORK,
            slab["level"],
            (plate - Decimal(measured["beam_soffit_m2"]))
            + Decimal(measured["free_edge_m"]) * thickness,
        )
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


def _formula_rows_by_key(corpus) -> dict[Key, dict[str, Any]]:
    """The rows of the kinds whose formulas this increment fixes."""
    return {key: row for key, row in _rows_by_key(corpus).items() if key[1] in UNITS}


def _expected(corpus) -> dict[Key, Decimal]:
    return corpus.once("golden-expected", lambda: expected_quantities(_inputs(corpus)))


def test_ac7_inputs_carry_f_rcc6s_level_stack_and_mark_families(corpus) -> None:
    inputs = _inputs(corpus)
    assert [level["name"] for level in inputs["levels"]] == list(CONTRACT_LEVELS), (
        "inputs.json's level stack is not F-RCC6's FDN, GF, 1F … 5F, ROOF in order"
    )
    offences: list[str] = []
    for family, marks in sorted(CONTRACT_MARKS.items()):
        members = inputs.get(family)
        if not isinstance(members, list):
            offences.append(f"{family}: not a list")
            continue
        drawn = {str(item.get("mark")) for item in members}
        lacking = sorted(marks - drawn)
        if lacking:
            offences.append(f"{family}: F-RCC6's marks {lacking} are not authored")
        countless = sorted(str(item.get("mark")) for item in members if Decimal(item.get("count", 0)) < 1)
        if countless:
            offences.append(f"{family}: marks with count < 1: {countless}")
    assert offences == [], "\n".join(offences)


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
        if not isinstance(row.get("kind"), str) or not row["kind"]:
            offences.append(f"{key}: kind is not a name")
        if row.get("level") not in level_names:
            offences.append(f"{key}: level not in inputs.levels")
        if row.get("class") in FOUNDATION_CLASSES and row.get("level") != FOUNDATION_LEVEL:
            offences.append(f"{key}: a foundation class off {FOUNDATION_LEVEL}")
        if row.get("kind") in UNITS and row.get("unit") != UNITS[row["kind"]]:
            offences.append(f"{key}: unit {row.get('unit')!r}, the contract's is {UNITS[row['kind']]}")
        if not isinstance(row.get("quantity"), str) or not THREE_DECIMALS.match(row["quantity"]):
            offences.append(f"{key}: quantity {row.get('quantity')!r} is not a three-decimal string")
    assert offences == [], "\n".join(offences)


def test_ac7_the_concrete_and_formwork_rows_are_exactly_what_the_inputs_give_rise_to(corpus) -> None:
    expected, rows = _expected(corpus), _formula_rows_by_key(corpus)
    assert expected, "inputs.json gives rise to no quantity at all"
    assert rows, f"the golden holds no {CONCRETE} or {FORMWORK} row"
    lacking = sorted(set(expected) - set(rows))
    assert lacking == [], f"rows the inputs call for that the golden lacks: {lacking}"
    surplus = sorted(set(rows) - set(expected))
    assert surplus == [], f"{CONCRETE}/{FORMWORK} rows the inputs give no rise to: {surplus}"


@pytest.mark.parametrize("key", GOLDEN_KEYS, ids=[":".join(key) for key in GOLDEN_KEYS])
def test_ac7_each_quantity_recomputes_from_the_inputs(corpus, key: Key) -> None:
    expected, rows = _expected(corpus), _formula_rows_by_key(corpus)
    assert key in expected, f"{key}: the inputs give rise to no such row"
    want = spelled(expected[key])
    assert rows[key]["quantity"] == want, (
        f"{key}: the golden says {rows[key]['quantity']}, the formulas over inputs.json give {want}"
    )
