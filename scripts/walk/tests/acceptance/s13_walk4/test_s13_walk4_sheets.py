"""T-WALK-4 acceptance, cases 3 and 10: the Sheet count N and the storeys, against the snapshot.

sheets_match: "per expectation Discipline, `found` = the snapshot Sheets of that Discipline, every one,
including a Sheet proposed out (`proposed_exclusion`) and an empty layout; `phantoms` = sum of max(0,
found - N) plus the Sheets of any Discipline the expectation does not list (including no Discipline);
`missing` = sum of max(0, N - found); ok when missing == 0 and phantoms <= phantom_sheets_max."
storeys: "for each listed Sheet found by {file, number}, product storeys = `storeys` if non-empty else
`storeys_titled` or []; wrong when the sets differ (order ignored), a listed Sheet not found is wrong."
Synthetic data only.
"""

from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    FILE_A,
    FILE_B,
    SET_A,
    STRUCTURAL,
    by_id,
    check,
    judged,
    row,
    sheet,
    standard_expect,
    standard_set,
)


def _structural(n: int, **given: Any) -> dict[str, Any]:
    made: dict[str, Any] = sheet(
        f"s{n}", FILE_A, f"K-{n:02d}", f"Made-up Plan K{n}", STRUCTURAL, **given
    )
    return made


def _sheets(tmp_path: Path, entry: dict[str, Any], expect: dict[str, Any] | None = None) -> Any:
    verdict = judged(tmp_path, {SET_A: entry}, {SET_A: expect or standard_expect()})
    return verdict, check(verdict, "sheets_match")


def test_two_sheets_above_n_are_two_phantoms_and_fail(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] += [_structural(11), _structural(12)]

    verdict, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["phantoms"] == 2
    assert found["measured"]["missing"] == 0
    assert found["measured"]["sheets_found"] == 17
    assert row(verdict, STRUCTURAL)["sheets"] == 12
    assert row(verdict, STRUCTURAL)["sheets_expected"] == 10


def test_one_sheet_below_n_is_one_missing_and_fails(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] = [s for s in entry["sheets"] if s["id"] != "s7"]

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["missing"] == 1
    assert found["measured"]["phantoms"] == 0


def test_sheets_proposed_out_with_empty_layouts_still_count(tmp_path: Path) -> None:
    entry = standard_set()
    for sid in ("s2", "s5", "s8"):
        by_id(entry, sid).update(layout=False, proposed_exclusion="empty_layout")

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "PASS"
    assert found["measured"]["missing"] == 0
    assert found["measured"]["sheets_found"] == 15


def test_twelve_found_with_three_proposed_out_are_still_two_phantoms(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] += [_structural(11), _structural(12)]
    for sid in ("s1", "s11", "s12"):
        by_id(entry, sid).update(layout=False, proposed_exclusion="empty_layout")

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["phantoms"] == 2


@pytest.mark.parametrize("discipline", [None, "electrical"], ids=["no-discipline", "unlisted"])
def test_a_sheet_of_no_or_an_unlisted_discipline_is_a_phantom(
    tmp_path: Path, discipline: str | None
) -> None:
    entry = standard_set()
    entry["sheets"].append(sheet("e1", FILE_B, "Z-01", "Made-up Detail M", discipline))

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["phantoms"] == 1
    assert found["measured"]["missing"] == 0


def test_phantoms_within_the_limit_pass(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] += [_structural(11), _structural(12)]
    expect = standard_expect()
    expect["phantom_sheets_max"] = 2

    _, found = _sheets(tmp_path, entry, expect)

    assert found["status"] == "PASS"


def test_equal_counts_pass_and_each_row_carries_its_n(tmp_path: Path) -> None:
    verdict, found = _sheets(tmp_path, standard_set())

    assert found["status"] == "PASS"
    assert row(verdict, STRUCTURAL)["sheets_expected"] == 10
    assert row(verdict, "architectural")["sheets_expected"] == 5


# Case 10: storeys --------------------------------------------------------------------------------


def _storeys(tmp_path: Path, entry: dict[str, Any], expect: dict[str, Any] | None = None) -> Any:
    verdict = judged(tmp_path, {SET_A: entry}, {SET_A: expect or standard_expect()})
    return check(verdict, "storeys_match")


def test_a_views_union_that_differs_is_one_wrong_and_fails(tmp_path: Path) -> None:
    entry = standard_set()
    by_id(entry, "s1")["storeys"] = ["T1"]

    found = _storeys(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["storeys_wrong"] == 1
    assert found["measured"]["storeys_listed"] == 2


def test_the_views_union_wins_over_the_titled_storeys(tmp_path: Path) -> None:
    entry = standard_set()
    by_id(entry, "s1")["storeys_titled"] = ["T7"]

    assert _storeys(tmp_path, entry)["status"] == "PASS"


def test_an_empty_union_is_judged_on_the_titled_storeys(tmp_path: Path) -> None:
    entry = standard_set()
    by_id(entry, "a1")["storeys_titled"] = ["T4"]

    found = _storeys(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["storeys_wrong"] == 1


@pytest.mark.parametrize("titled", [None, []], ids=["titled-null", "titled-empty"])
def test_no_storeys_at_all_on_a_listed_sheet_is_wrong(tmp_path: Path, titled: Any) -> None:
    entry = standard_set()
    by_id(entry, "a1")["storeys_titled"] = titled

    found = _storeys(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["storeys_wrong"] == 1


def test_order_is_ignored(tmp_path: Path) -> None:
    entry = standard_set()
    by_id(entry, "s1")["storeys"] = ["T2", "T1"]

    assert _storeys(tmp_path, entry)["status"] == "PASS"


def test_a_sheet_not_listed_is_never_judged(tmp_path: Path) -> None:
    entry = standard_set()
    by_id(entry, "s5")["storeys"] = ["T9"]
    by_id(entry, "a3")["storeys_titled"] = ["T8"]

    found = _storeys(tmp_path, entry)

    assert found["status"] == "PASS"
    assert found["measured"]["storeys_wrong"] == 0


def test_a_listed_sheet_missing_from_the_snapshot_is_wrong(tmp_path: Path) -> None:
    expect = standard_expect()
    expect["storeys"].append({"file": FILE_A, "number": "K-77", "storeys": ["T1"]})

    found = _storeys(tmp_path, standard_set(), expect)

    assert found["status"] == "FAIL"
    assert found["measured"]["storeys_listed"] == 3
    assert found["measured"]["storeys_wrong"] == 1


def test_wrong_storeys_within_the_limit_pass(tmp_path: Path) -> None:
    entry = standard_set()
    by_id(entry, "s1")["storeys"] = ["T1"]
    expect = standard_expect()
    expect["storeys_wrong_max"] = 1

    assert _storeys(tmp_path, entry, expect)["status"] == "PASS"
