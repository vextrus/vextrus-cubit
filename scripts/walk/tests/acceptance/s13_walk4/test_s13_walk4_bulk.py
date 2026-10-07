"""T-WALK-4 acceptance, case 8: the bulk-confirmable share, its own check, judged in two halves.

The owner's ruling (5 Oct 2026, "Total + own split"): `bulk_confirmable_share` passes only when both
hold: (a) the set's total of bulk-confirmable Sheets is at least `share_min` of the key's N for the set
(N = the sum of `sheets_per_discipline`); and (b) each Discipline's bulk-confirmable Sheets are at least
`share_min` of the Sheets the product itself files under that Discipline (not the key's N for it). The
per-Discipline numbers against the key's N are reported in the burden rows, never judged, so a filing
difference between the key and the product does not fail the check by itself.

bulk-confirmable per Discipline: "the Sheets with `agrees` and not `held` in `sheets` when the Discipline
has no open gap Question in `questions`; otherwise `bulk_after_gaps[discipline]`". "A Discipline with an
open gap Question and no `bulk_after_gaps` entry makes `bulk_confirmable_share` alone FAIL with
`measured.unmeasured == 1` (the other checks are judged)." Synthetic data only: the standard set's key
files 10 structural and 5 architectural Sheets (N = 15, so the total needs 12).
"""

from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    ARCHITECTURAL,
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


def _found_only(entry: dict[str, Any], *ids: str) -> dict[str, Any]:
    """The product found only these structural Sheets (the others are missing from the snapshot)."""
    entry["sheets"] = [s for s in entry["sheets"] if s["discipline"] != STRUCTURAL or s["id"] in ids]
    return entry


def _split(verdict: dict[str, Any], discipline: str) -> tuple[int, int, int]:
    """A row's reported (bulk_confirmable_sheets, sheets, sheets_expected)."""
    found = row(verdict, discipline)
    return found["bulk_confirmable_sheets"], found["sheets"], found["sheets_expected"]


# (a) The set's total over the key's N ---------------------------------------------------------------


@pytest.mark.parametrize(("found", "want"), [(7, "PASS"), (6, "FAIL")])
def test_the_share_is_judged_over_n(tmp_path: Path, found: int, want: str) -> None:
    """structural finds only `found` of its 10 Sheets, every one agreeing; architectural 5 of 5: each
    Discipline is at 100 % of what the product files under it, and the total is `found` + 5 over N 15
    (12 needed)."""
    entry = _found_only(standard_set(), *(f"s{k}" for k in range(1, found + 1)))

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == want
    assert check_["measured"] == {"bulk_confirmable_sheets": found + 5, "sheets_expected": 15}
    assert _split(verdict, STRUCTURAL) == (found, found, 10)


def test_a_total_below_n_fails_though_every_discipline_meets_its_own_count(tmp_path: Path) -> None:
    """Case (1): structural 6 of the 6 it files, architectural 5 of 5, total 11 of N 15: FAIL."""
    entry = _found_only(standard_set(), *(f"s{k}" for k in range(1, 7)))

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "FAIL"
    assert check_["measured"].get("unmeasured", 0) == 0
    assert _split(verdict, STRUCTURAL) == (6, 6, 10)
    assert _split(verdict, ARCHITECTURAL) == (5, 5, 5)


# (b) Each Discipline over the Sheets the product files under it ------------------------------------


def test_one_discipline_below_its_own_count_fails_though_the_total_meets_n(tmp_path: Path) -> None:
    """Case (2): structural 7 of the 10 it files (70 %), architectural 5 of 5, total 12 of N 15: FAIL."""
    verdict, check_ = _bulk(tmp_path, _agreeing(standard_set(), 7))

    assert check_["status"] == "FAIL"
    assert check_["measured"] == {"bulk_confirmable_sheets": 12, "sheets_expected": 15}
    assert _split(verdict, STRUCTURAL) == (7, 10, 10)


@pytest.mark.parametrize(("agreeing", "want"), [(8, "PASS"), (7, "FAIL")])
def test_each_discipline_is_judged_over_the_sheets_it_files(
    tmp_path: Path, agreeing: int, want: str
) -> None:
    verdict, check_ = _bulk(tmp_path, _agreeing(standard_set(), agreeing))

    assert check_["status"] == want
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == agreeing


def test_a_bulk_failure_is_not_a_question_failure(tmp_path: Path) -> None:
    verdict, check_ = _bulk(tmp_path, _agreeing(standard_set(), 6))

    assert check_["status"] == "FAIL"
    assert check(verdict, "questions_per_discipline")["status"] == "PASS"


@pytest.mark.parametrize(("agreeing", "want"), [(9, "FAIL"), (10, "PASS")])
def test_twelve_filed_are_judged_over_twelve_not_the_keys_ten(
    tmp_path: Path, agreeing: int, want: str
) -> None:
    """structural files 12 Sheets (the key says 10): 9 agreeing is 75 % of 12 (FAIL), 10 is 83 %."""
    entry = _agreeing(standard_set(), 10)
    entry["sheets"] += [
        sheet(f"s{n}", FILE_A, f"K-{n:02d}", f"Made-up Plan K{n}", STRUCTURAL, agrees=False)
        for n in (11, 12)
    ]
    for k in range(agreeing + 1, 11):
        by_id(entry, f"s{k}")["agrees"] = False

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == want
    assert _split(verdict, STRUCTURAL) == (agreeing, 12, 10)
    assert check(verdict, "sheets_match")["status"] == "FAIL"


def test_every_discipline_is_judged_one_source_too(tmp_path: Path) -> None:
    entry = standard_set()
    for n in range(1, 6):
        by_id(entry, f"a{n}")["agrees"] = False  # architectural: one source each, none agreeing

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "FAIL"
    assert row(verdict, ARCHITECTURAL)["bulk_confirmable_sheets"] == 0


def test_a_discipline_the_key_does_not_name_is_judged_over_its_own_count(tmp_path: Path) -> None:
    """The product files K-09 and K-10 under plumbing, which the key does not name, neither agreeing:
    structural 8 of 8, architectural 5 of 5, total 13 of N 15; plumbing 0 of 2 fails half (b)."""
    entry = _agreeing(standard_set(), 8)
    for k in (9, 10):
        by_id(entry, f"s{k}")["discipline"] = "plumbing"

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "FAIL"
    found = row(verdict, "plumbing")
    assert (found["bulk_confirmable_sheets"], found["sheets"]) == (0, 2)


# A filing difference between the key and the product ------------------------------------------------


def test_a_filing_difference_from_the_key_passes_when_both_halves_hold(tmp_path: Path) -> None:
    """Case (3): the key files K-01..K-04 under structural, the product under architectural.
    structural files 6 (K-05..K-10), 5 agreeing (83 %); architectural files 9, all agreeing; total 14
    of N 15. The split against the key's N (structural 5 of 10) is reported, not judged: PASS."""
    entry = standard_set()
    for k in range(1, 5):
        by_id(entry, f"s{k}")["discipline"] = ARCHITECTURAL

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "PASS"
    assert check_["measured"] == {"bulk_confirmable_sheets": 14, "sheets_expected": 15}
    assert _split(verdict, STRUCTURAL) == (5, 6, 10)
    assert _split(verdict, ARCHITECTURAL) == (9, 9, 5)


def test_a_filing_difference_still_fails_a_discipline_below_its_own_count(tmp_path: Path) -> None:
    """The same filing difference with K-01..K-04 not agreeing: architectural 5 of the 9 it files."""
    entry = standard_set()
    for k in range(1, 5):
        by_id(entry, f"s{k}")["discipline"] = ARCHITECTURAL
        by_id(entry, f"s{k}")["agrees"] = False

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "FAIL"
    assert _split(verdict, ARCHITECTURAL) == (5, 9, 5)


# (4) Held Sheets and open gaps, as before ------------------------------------------------------------


def test_a_held_sheet_that_agrees_does_not_count(tmp_path: Path) -> None:
    """structural 8 of 10 agree but K-03 is held: 7 of the 10 it files (70 %), total 12 of 15: FAIL."""
    entry = _agreeing(standard_set(), 8)
    by_id(entry, "s3")["held"] = True

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "FAIL"
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == 7


def test_held_sheets_do_not_count_toward_the_total(tmp_path: Path) -> None:
    """structural files 8 (K-01..K-08), all agreeing, K-01 held: 7 of 8 (87.5 %); architectural 5,
    L-01 held: 4 of 5 (80 %). Each meets its own count, but the total is 11 of N 15 (13 if a held
    Sheet counted): FAIL."""
    entry = _found_only(standard_set(), *(f"s{k}" for k in range(1, 9)))
    by_id(entry, "s1")["held"] = True
    by_id(entry, "a1")["held"] = True

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "FAIL"
    assert check_["measured"] == {"bulk_confirmable_sheets": 11, "sheets_expected": 15}
    assert _split(verdict, STRUCTURAL) == (7, 8, 10)
    assert _split(verdict, ARCHITECTURAL) == (4, 5, 5)


def _gapped(after: dict[str, int], *, filed: int = 10) -> dict[str, Any]:
    """structural files its first `filed` Sheets, with an open numbering gap and 3 agreeing in the
    snapshot."""
    entry = _found_only(_agreeing(standard_set(), 3), *(f"s{k}" for k in range(1, filed + 1)))
    entry["questions"].append(gap("g1", STRUCTURAL, "s2"))
    entry["bulk_after_gaps"] = after
    return entry


@pytest.mark.parametrize(("after", "want"), [(7, "PASS"), (6, "FAIL")])
def test_a_discipline_with_an_open_gap_is_judged_after_the_gap_answer(
    tmp_path: Path, after: int, want: str
) -> None:
    """structural files 8 Sheets (the key says 10), 3 agreeing in the snapshot, an open gap: judged on
    the count after the gap answer over its own 8 (7 is 87.5 %, 6 is 75 %); total 12 or 11 of 15."""
    verdict, check_ = _bulk(tmp_path, _gapped({STRUCTURAL: after}, filed=8))

    assert check_["status"] == want
    assert _split(verdict, STRUCTURAL) == (after, 8, 10)
    assert check_["measured"].get("unmeasured", 0) == 0


def test_the_gap_answer_count_is_what_the_total_adds(tmp_path: Path) -> None:
    """structural files 10, 3 agreeing in the snapshot, 8 after the gap answer: 8 of 10 and a total of
    13 of 15 (3 + 5 = 8 would fail it): PASS."""
    verdict, check_ = _bulk(tmp_path, _gapped({STRUCTURAL: 8}))

    assert check_["status"] == "PASS"
    assert check_["measured"] == {"bulk_confirmable_sheets": 13, "sheets_expected": 15}
    assert _split(verdict, STRUCTURAL) == (8, 10, 10)


def test_bulk_after_gaps_is_ignored_where_no_gap_is_open(tmp_path: Path) -> None:
    entry = standard_set()
    entry["bulk_after_gaps"] = {STRUCTURAL: 2}

    verdict, check_ = _bulk(tmp_path, entry)

    assert check_["status"] == "PASS"
    assert row(verdict, STRUCTURAL)["bulk_confirmable_sheets"] == 9


@pytest.mark.parametrize(
    "after", [{}, {ARCHITECTURAL: 5}], ids=["no-entry", "another-disciplines-entry"]
)
def test_an_open_gap_with_no_reading_after_it_leaves_bulk_alone_unmeasured(
    tmp_path: Path, after: dict[str, int]
) -> None:
    verdict, check_ = _bulk(tmp_path, _gapped(after))

    assert check_["status"] == "FAIL"
    assert check_["measured"]["unmeasured"] == 1
    for judged_check in ("questions_per_discipline", "sheets_match", "true_questions_raised"):
        assert check(verdict, judged_check)["status"] == "PASS", judged_check
        assert check(verdict, judged_check)["measured"].get("unmeasured", 0) == 0
