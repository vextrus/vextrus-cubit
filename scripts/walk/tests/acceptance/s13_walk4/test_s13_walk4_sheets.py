"""T-WALK-4 acceptance, cases 3 and 10: the Sheet count N and the storeys, against the snapshot.

sheets_match, as the owner ruled it on 5 Oct 2026 ("Judge the total; report the split"): "`sheets_match`
judges each set's TOTAL: the product's Sheet count equals the sum of `sheets_per_discipline` ... and
phantoms are 0 (a phantom: a proposed Sheet beyond the total that is an empty layout or an unnumbered
blank); the per-Discipline counts are REPORTED in the verdict (expected and found per Discipline), never
judged, because the key and the product file some Sheets under different Disciplines." "A snapshot right
in total but split differently PASSES with the split reported; one Sheet short or one phantom FAILS."
So `sheets_found` counts the set's snapshot Sheets of every Discipline and of none, every one (a Sheet
proposed out too); `missing` = max(0, N - found); `phantoms` = the Sheets beyond the total that are
blanks; a numbered Sheet beyond the total is no phantom, and the count is still not N. Each row reports
its `sheets` and `sheets_expected`. The blanks here are unambiguous: no number, no title, proposed out
`blank` (the product's "proposed out with no number (a cover, a stale layout)").
storeys: "for each listed Sheet found by {file, number}, product storeys = `storeys` if non-empty else
`storeys_titled` or []; wrong when the sets differ (order ignored), a listed Sheet not found is wrong."
Synthetic data only.
"""

from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    ARCHITECTURAL,
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

BLANK = "blank"
"""The product's exclusion reason for a blank Sheet (drawings' ExclusionReason)."""


def _structural(n: int, **given: Any) -> dict[str, Any]:
    made: dict[str, Any] = sheet(
        f"s{n}", FILE_A, f"K-{n:02d}", f"Made-up Plan K{n}", STRUCTURAL, **given
    )
    return made


def _blank(sid: str, file: str, discipline: str | None) -> dict[str, Any]:
    """An empty layout or an unnumbered blank: no number, no title, proposed out `blank`."""
    made: dict[str, Any] = sheet(sid, file, "", "", discipline, proposed_exclusion=BLANK, agrees=False)
    made.update(number=None, title=None)
    return made


def _sheets(tmp_path: Path, entry: dict[str, Any], expect: dict[str, Any] | None = None) -> Any:
    verdict = judged(tmp_path, {SET_A: entry}, {SET_A: expect or standard_expect()})
    return verdict, check(verdict, "sheets_match")


def _split(verdict: dict[str, Any], discipline: str) -> tuple[int, int | None]:
    """A row's reported (sheets, sheets_expected)."""
    found = row(verdict, discipline)
    return found["sheets"], found["sheets_expected"]


# Case 3: the total is judged -----------------------------------------------------------------------


def test_two_numbered_sheets_beyond_the_total_fail_and_are_no_phantoms(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] += [_structural(11), _structural(12)]

    verdict, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["sheets_found"] == 17
    assert found["measured"]["missing"] == 0
    assert found["measured"]["phantoms"] == 0
    assert found["expected"] == {"sheets": 15, "phantoms_max": 0}
    assert _split(verdict, STRUCTURAL) == (12, 10)


def test_numbered_sheets_beyond_the_total_are_not_excused_by_the_phantom_limit(
    tmp_path: Path,
) -> None:
    entry = standard_set()
    entry["sheets"] += [_structural(11), _structural(12)]
    expect = standard_expect()
    expect["phantom_sheets_max"] = 2

    _, found = _sheets(tmp_path, entry, expect)

    assert found["status"] == "FAIL"
    assert found["measured"]["sheets_found"] == 17


def test_one_sheet_below_n_is_one_missing_and_fails(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] = [s for s in entry["sheets"] if s["id"] != "s7"]

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["missing"] == 1
    assert found["measured"]["phantoms"] == 0


def test_one_sheet_short_in_total_fails_though_a_discipline_is_over(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] = [s for s in entry["sheets"] if s["id"] not in ("s7", "s8")]
    entry["sheets"].append(sheet("a6", FILE_B, "L-06", "Made-up Elevation L6", ARCHITECTURAL))

    verdict, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["sheets_found"] == 14
    assert found["measured"]["missing"] == 1
    assert found["measured"]["phantoms"] == 0
    assert _split(verdict, STRUCTURAL) == (8, 10)
    assert _split(verdict, ARCHITECTURAL) == (6, 5)


SPLIT = {"listed": ARCHITECTURAL, "no-discipline": None, "unlisted": "electrical"}


@pytest.mark.parametrize("case", sorted(SPLIT))
def test_the_right_total_in_another_split_passes_and_reports_the_split(
    tmp_path: Path, case: str
) -> None:
    entry = standard_set()
    by_id(entry, "s10")["discipline"] = SPLIT[case]

    verdict, found = _sheets(tmp_path, entry)

    assert found["status"] == "PASS"
    assert found["measured"]["sheets_found"] == 15
    assert found["measured"]["missing"] == 0
    assert found["measured"]["phantoms"] == 0
    assert _split(verdict, STRUCTURAL) == (9, 10)
    if case == "listed":
        assert _split(verdict, ARCHITECTURAL) == (6, 5)
    else:
        assert _split(verdict, SPLIT[case] or "none") == (1, None)
        assert _split(verdict, ARCHITECTURAL) == (5, 5)


@pytest.mark.parametrize(
    "discipline", [STRUCTURAL, None, "electrical"], ids=["listed", "no-discipline", "unlisted"]
)
def test_one_blank_beyond_the_total_is_a_phantom_and_fails(
    tmp_path: Path, discipline: str | None
) -> None:
    entry = standard_set()
    entry["sheets"].append(_blank("p1", FILE_B, discipline))

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["sheets_found"] == 16
    assert found["measured"]["phantoms"] == 1
    assert found["measured"]["missing"] == 0


@pytest.mark.parametrize("discipline", [None, "electrical"], ids=["no-discipline", "unlisted"])
def test_a_numbered_sheet_of_no_or_an_unlisted_discipline_beyond_the_total_fails_unexcused(
    tmp_path: Path, discipline: str | None
) -> None:
    entry = standard_set()
    entry["sheets"].append(sheet("e1", FILE_B, "Z-01", "Made-up Detail M", discipline))

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["sheets_found"] == 16
    assert found["measured"]["phantoms"] == 0
    assert found["measured"]["missing"] == 0


def test_sheets_proposed_out_with_empty_layouts_still_count(tmp_path: Path) -> None:
    entry = standard_set()
    for sid in ("s2", "s5", "s8"):
        by_id(entry, sid).update(layout=False, proposed_exclusion="empty_layout")

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "PASS"
    assert found["measured"]["missing"] == 0
    assert found["measured"]["sheets_found"] == 15


def test_three_blanks_with_two_sheets_beyond_the_total_are_two_phantoms(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] += [_blank("p1", FILE_A, STRUCTURAL), _blank("p2", FILE_A, STRUCTURAL)]
    by_id(entry, "s10").update(number=None, title=None, proposed_exclusion=BLANK)

    _, found = _sheets(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["sheets_found"] == 17
    assert found["measured"]["phantoms"] == 2
    assert found["measured"]["missing"] == 0


def test_phantoms_within_the_limit_pass(tmp_path: Path) -> None:
    entry = standard_set()
    entry["sheets"] += [_blank("p1", FILE_A, STRUCTURAL), _blank("p2", FILE_B, None)]
    expect = standard_expect()
    expect["phantom_sheets_max"] = 2

    _, found = _sheets(tmp_path, entry, expect)

    assert found["status"] == "PASS"
    assert found["measured"]["phantoms"] == 2


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
