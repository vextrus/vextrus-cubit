"""Ticket T-249 (PR A), A1 case 8: `engine/export.schema.json` takes the burden block, and only as
the block is fixed (section 3, A1): an optional top-level `burden`, `additionalProperties: false`
throughout, every count an integer >= 0, every key from a closed list or a Discipline key. Today
`burden` is an unknown top-level key (`additionalProperties: false`). A document with no `burden` (the
harness's) still passes. Checked by the check's own validator, `scripts.real_drawings.schema.problems`.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.real_drawings.schema import problems
from scripts.real_drawings.tests import exports

ROOT = Path(__file__).resolve().parents[5]
SCHEMA = json.loads((ROOT / "engine" / "export.schema.json").read_text())


def row(**values: Any) -> dict[str, Any]:
    made: dict[str, Any] = {
        "sheets": 6,
        "sheets_counted": 5,
        "bulk_confirmable": 2,
        "one_source": 4,
        "held": 1,
        "questions_open": {"low_confidence": 2, "conflict": 1, "check": 3},
        "conflicts": {"same_number": 1, "same_title": 0, "same_storey": 0},
        "gap_questions": 3,
        "gap_files": 2,
        "machine_doubt": 2,
        "counted_toward_cap": 4,
        "plan_sheets_no_storey": 1,
        "proposed_out": 1,
        "proposed_out_by_reason": {"cover_index": 1},
    }
    return made | values


def document(**block: Any) -> dict[str, Any]:
    made = exports.export(exports.dwg(exports.SHA_A, exports.sheet("Invented layout two")))
    made["burden"] = {
        "version": 1,
        "disciplines": {"plumbing": row(), "none": row(sheets=1, sheets_counted=1)},
    } | block
    return made


def test_a_document_with_a_conforming_burden_block_passes() -> None:
    assert problems(document(), SCHEMA) == []


def test_a_block_with_no_discipline_row_passes() -> None:
    assert problems(document(disciplines={}), SCHEMA) == []


def _under_burden(found: list[str]) -> bool:
    """The breach is inside the block (`$.burden.…`), not the block itself refused as unknown."""
    return bool(found) and all(p.startswith(("$.burden.", "$.burden:")) for p in found)


def _with(change: Any) -> dict[str, Any]:
    made = document()
    change(made["burden"])
    return made


BREACHES = {
    "a string count": lambda b: b["disciplines"]["plumbing"].update(sheets="6"),
    "a negative count": lambda b: b["disciplines"]["plumbing"].update(gap_files=-1),
    "a float count": lambda b: b["disciplines"]["plumbing"].update(held=1.5),
    "a row key outside the list": lambda b: b["disciplines"]["plumbing"].update(burden_score=3),
    "a kind outside QuestionKind": lambda b: b["disciplines"]["plumbing"]["questions_open"].update(
        invented_kind=1
    ),
    "a reason outside the exclusion reasons": lambda b: b["disciplines"]["plumbing"][
        "proposed_out_by_reason"
    ].update(invented_reason=1),
    "a conflict code outside the three": lambda b: b["disciplines"]["plumbing"]["conflicts"].update(
        same_scale=1
    ),
    "a row that is not a Discipline key": lambda b: b["disciplines"].update({"Qx Marker Row": row()}),
    "a text where the rows go": lambda b: b.update(disciplines="none"),
    "another version": lambda b: b.update(version=2),
    "a block key outside the list": lambda b: b.update(titles=["Invented"]),
}


@pytest.mark.parametrize("breach", sorted(BREACHES))
def test_a_block_breaking_its_shape_fails_inside_the_block(breach: str) -> None:
    found = problems(_with(BREACHES[breach]), SCHEMA)

    assert _under_burden(found), found


def test_a_row_missing_a_count_fails_inside_the_block() -> None:
    made = document()
    del made["burden"]["disciplines"]["plumbing"]["gap_questions"]

    assert _under_burden(problems(made, SCHEMA))


def test_a_top_level_key_beside_burden_still_fails_and_burden_does_not() -> None:
    made = document()
    made["burden_extra"] = {"version": 1}

    found = problems(made, SCHEMA)

    assert any("burden_extra" in p for p in found), found
    assert not [p for p in found if p.startswith("$.burden.") or p == "$: burden is not allowed"], found


def test_a_document_with_no_burden_still_passes() -> None:
    made = document()
    del made["burden"]

    assert problems(made, SCHEMA) == []
