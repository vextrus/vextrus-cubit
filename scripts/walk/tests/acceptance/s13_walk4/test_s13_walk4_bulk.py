"""T-WALK-4 acceptance, case 8: the bulk-confirmable share, its own check, over the expected N.

"bulk_confirmable_sheets per Discipline = the Sheets with `agrees` and not `held` in `sheets` when the
Discipline has no open gap Question in `questions`; otherwise `bulk_after_gaps[discipline]` ...; the
share is that over `sheets_expected` (N), every Discipline of `sheets_per_discipline`, bulk >= share_min
* N." "A Discipline with an open gap Question and no `bulk_after_gaps` entry makes
`bulk_confirmable_share` alone FAIL with `measured.unmeasured == 1` (the other checks are judged)."
Synthetic data only.
"""

from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    FILE_A,
    SET_A,
    STRUCTURAL,
    by_id,
    check,
    gap,
    judged,
    row,
    sheet,
    standard_expect,
    standard_set,
)


def _bulk(tmp_path: Path, entry: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    verdict = judged(tmp_path, {SET_A: entry}, {SET_A: standard_expect()})
    return verdict, check(verdict, "bulk_confirmable_share")


def _agreeing(entry: dict[str, Any], n: int) -> dict[str, Any]:
    """structural's first `n` Sheets agree, the rest do not."""
    for k in range(1, 11):
        by_id(entry, f"s{k}")["agrees"] = k <= n
    return entry


@pytest.mark.parametrize(("agreeing", "want"), [(8, "PASS"), (7, "FAIL")])
def test_the_share_is_judged_over_n(tmp_path: Path, agreeing: int, want: str) -> None:
    verdict, found = _bulk(tmp_path, _agreeing(standard_set(), agreeing))

    assert found["status"] == want
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == agreeing


def test_a_bulk_failure_is_not_a_question_failure(tmp_path: Path) -> None:
    verdict, found = _bulk(tmp_path, _agreeing(standard_set(), 6))

    assert found["status"] == "FAIL"
    assert check(verdict, "questions_per_discipline")["status"] == "PASS"


def test_twelve_found_with_nine_agreeing_is_nine_of_ten(tmp_path: Path) -> None:
    entry = _agreeing(standard_set(), 7)
    entry["sheets"] += [
        sheet(f"s{n}", FILE_A, f"K-{n:02d}", f"Made-up Plan K{n}", STRUCTURAL, agrees=n == 11)
        for n in (11, 12)
    ]
    by_id(entry, "s8")["agrees"] = True  # 9 of the 12 agree

    verdict, found = _bulk(tmp_path, entry)

    assert found["status"] == "PASS"
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == 9
    assert check(verdict, "sheets_match")["status"] == "FAIL"


def test_a_held_sheet_that_agrees_does_not_count(tmp_path: Path) -> None:
    entry = _agreeing(standard_set(), 8)
    by_id(entry, "s3")["held"] = True

    verdict, found = _bulk(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == 7


def test_every_discipline_is_judged_one_source_too(tmp_path: Path) -> None:
    entry = standard_set()
    for n in range(1, 6):
        by_id(entry, f"a{n}")["agrees"] = False  # architectural: one source each, none agreeing

    verdict, found = _bulk(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert row(verdict, "architectural")["bulk_confirmable_sheets"] == 0


def _gapped(after: dict[str, int]) -> dict[str, Any]:
    """structural with an open numbering gap and 3 of 10 agreeing in the snapshot."""
    entry = _agreeing(standard_set(), 3)
    entry["questions"].append(gap("g1", STRUCTURAL, "s2"))
    entry["bulk_after_gaps"] = after
    return entry


@pytest.mark.parametrize(("after", "want"), [(8, "PASS"), (7, "FAIL")])
def test_a_discipline_with_an_open_gap_is_judged_after_the_gap_answer(
    tmp_path: Path, after: int, want: str
) -> None:
    verdict, found = _bulk(tmp_path, _gapped({STRUCTURAL: after}))

    assert found["status"] == want
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == after
    assert found["measured"].get("unmeasured", 0) == 0


def test_bulk_after_gaps_is_ignored_where_no_gap_is_open(tmp_path: Path) -> None:
    entry = standard_set()
    entry["bulk_after_gaps"] = {STRUCTURAL: 2}

    verdict, found = _bulk(tmp_path, entry)

    assert found["status"] == "PASS"
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == 9


@pytest.mark.parametrize(
    "after", [{}, {"architectural": 5}], ids=["no-entry", "another-disciplines-entry"]
)
def test_an_open_gap_with_no_reading_after_it_leaves_bulk_alone_unmeasured(
    tmp_path: Path, after: dict[str, int]
) -> None:
    verdict, found = _bulk(tmp_path, _gapped(after))

    assert found["status"] == "FAIL"
    assert found["measured"]["unmeasured"] == 1
    for judged_check in ("questions_per_discipline", "sheets_match", "true_questions_raised"):
        assert check(verdict, judged_check)["status"] == "PASS", judged_check
        assert check(verdict, judged_check)["measured"].get("unmeasured", 0) == 0
