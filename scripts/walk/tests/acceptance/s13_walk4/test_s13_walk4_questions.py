"""T-WALK-4 acceptance, cases 4 to 7: true Questions raised, false continuations, stale-title pairs and
the machine-doubt cap.

"A Question matches a listed true Question when its code (or check_code) equals the listed code, its
Discipline equals, and it holds a Sheet for every listed {file, number}." "false_questions: the open
Questions with code engine.conflicts.same_title, same_storey or same_number that match no listed true
Question, however many Sheets or series they span." "stale_grouped: listed pairs whose two Sheets have
equal titles (case and whitespace folded) and are held together by no Question of any kind or code."
"machine_doubt_questions per Discipline: its open Questions minus those matching a listed true Question,
with the numbering-gap Questions ... counted once per file (the file of its first held Sheet)." The
owner's Q5 refined limits count numbering gaps "once per file"; a gap Question holding no Sheet has no
file, so such Questions count once per Discipline (T-WALK-4's first addendum, 5 Oct 2026).
Synthetic data only.
"""

from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    ARCHITECTURAL,
    FILE_A,
    FILE_B,
    GAPS,
    SAME_NUMBER,
    SAME_STOREY,
    SAME_TITLE,
    SET_A,
    STRUCTURAL,
    by_id,
    check,
    conflict,
    gap,
    judged,
    question,
    row,
    standard_expect,
    standard_set,
    which_kind,
)


def _judge(tmp_path: Path, entry: dict[str, Any], expect: dict[str, Any] | None = None) -> Any:
    return judged(tmp_path, {SET_A: entry}, {SET_A: expect or standard_expect()})


def _second_true(expect: dict[str, Any]) -> dict[str, Any]:
    """A second listed true Question: architectural `same_number` over L-02 and L-03."""
    expect["true_questions"].append(
        {
            "discipline": ARCHITECTURAL,
            "code": SAME_NUMBER,
            "sheets": [{"file": FILE_B, "number": "L-02"}, {"file": FILE_B, "number": "L-03"}],
        }
    )
    return expect


# Case 4: true_questions_raised ---------------------------------------------------------------------


def _raised(tmp_path: Path, second: dict[str, Any] | None) -> dict[str, Any]:
    entry = standard_set()
    if second is not None:
        entry["questions"].append(second)
    verdict = _judge(tmp_path, entry, _second_true(standard_expect()))
    found: dict[str, Any] = check(verdict, "true_questions_raised")
    return found


def test_both_listed_true_questions_raised_pass(tmp_path: Path) -> None:
    raised = _raised(tmp_path, conflict("t2", SAME_NUMBER, ARCHITECTURAL, "a2", "a3"))

    assert raised["status"] == "PASS"
    assert raised["measured"]["true_listed"] == 2
    assert raised["measured"]["true_raised"] == 2
    assert raised["expected"] == {"true_questions": 2}


SECOND = {
    "absent": None,
    "another-code": conflict("t2", SAME_TITLE, ARCHITECTURAL, "a2", "a3"),
    "another-discipline": conflict("t2", SAME_NUMBER, STRUCTURAL, "a2", "a3"),
    "one-sheet-short": conflict("t2", SAME_NUMBER, ARCHITECTURAL, "a2"),
    "answered": {**conflict("t2", SAME_NUMBER, ARCHITECTURAL, "a2", "a3"), "status": "answered"},
}


@pytest.mark.parametrize("case", sorted(SECOND))
def test_a_listed_true_question_not_raised_as_listed_fails(tmp_path: Path, case: str) -> None:
    raised = _raised(tmp_path, SECOND[case])

    assert raised["status"] == "FAIL"
    assert raised["measured"]["true_listed"] == 2
    assert raised["measured"]["true_raised"] == 1


RAISED = {
    "with-one-sheet-more": conflict("t2", SAME_NUMBER, ARCHITECTURAL, "a2", "a3", "a5"),
    "by-its-check-code": question(
        "t2",
        "check",
        "engine.check.synthetic_fired",
        ARCHITECTURAL,
        ["a3", "a2"],
        check_code=SAME_NUMBER,
    ),
}


@pytest.mark.parametrize("case", sorted(RAISED))
def test_a_question_holding_the_listed_sheets_under_its_code_is_raised(
    tmp_path: Path, case: str
) -> None:
    raised = _raised(tmp_path, RAISED[case])

    assert raised["status"] == "PASS"
    assert raised["measured"]["true_raised"] == 2


# Case 5: false_continuations -----------------------------------------------------------------------


def _false(tmp_path: Path, *added: dict[str, Any], expect: dict[str, Any] | None = None) -> Any:
    entry = standard_set()
    entry["questions"] += list(added)
    verdict = _judge(tmp_path, entry, expect)
    return verdict, check(verdict, "false_continuations")


FALSE_ONE = {
    "same-title-over-two-runs": conflict("f1", SAME_TITLE, STRUCTURAL, "s1", "s2", "s8", "s9"),
    "same-storey-run-and-outsider": conflict("f1", SAME_STOREY, STRUCTURAL, "s5", "s6", "a1"),
    "same-number-on-no-list": conflict("f1", SAME_NUMBER, STRUCTURAL, "s7", "s8"),
    "same-title-over-a-mark-range": conflict("f1", SAME_TITLE, STRUCTURAL, "s5", "s6", "s7"),
}


@pytest.mark.parametrize("case", sorted(FALSE_ONE))
def test_a_conflict_question_on_no_true_list_is_one_false_and_fails(tmp_path: Path, case: str) -> None:
    verdict, found = _false(tmp_path, FALSE_ONE[case])

    assert found["status"] == "FAIL"
    assert found["measured"]["false_questions"] == 1
    assert row(verdict, STRUCTURAL)["false_continuation_questions"] == 1


def test_one_false_within_its_limit_passes(tmp_path: Path) -> None:
    expect = standard_expect()
    expect["false_continuation_max"] = 1

    _, found = _false(tmp_path, FALSE_ONE["same-title-over-two-runs"], expect=expect)

    assert found["status"] == "PASS"
    assert found["measured"]["false_questions"] == 1


def test_listed_true_conflicts_and_machine_doubt_count_none(tmp_path: Path) -> None:
    verdict, found = _false(
        tmp_path,
        conflict("t2", SAME_NUMBER, ARCHITECTURAL, "a2", "a3"),
        which_kind("w9", STRUCTURAL, "s9"),
        expect=_second_true(standard_expect()),
    )

    assert found["status"] == "PASS"
    assert found["measured"]["false_questions"] == 0
    assert row(verdict, STRUCTURAL)["false_continuation_questions"] == 0
    assert row(verdict, ARCHITECTURAL)["false_continuation_questions"] == 0


def test_continuation_questions_count_same_title_and_same_storey_true_or_false(
    tmp_path: Path,
) -> None:
    verdict, found = _false(
        tmp_path,
        FALSE_ONE["same-title-over-two-runs"],
        conflict("f2", SAME_STOREY, STRUCTURAL, "s5", "s6"),
        conflict("f3", SAME_NUMBER, STRUCTURAL, "s7", "s8"),
    )

    assert found["measured"]["false_questions"] == 3
    # The listed same_title (true) and two false same_title/same_storey; same_number is not one.
    assert row(verdict, STRUCTURAL)["continuation_questions"] == 3
    assert row(verdict, ARCHITECTURAL)["continuation_questions"] == 0


# Case 6: stale_title_pairs -------------------------------------------------------------------------


def _stale(tmp_path: Path, titles: tuple[str, str], *added: dict[str, Any]) -> dict[str, Any]:
    entry = standard_set()
    by_id(entry, "a4")["title"], by_id(entry, "a5")["title"] = titles
    entry["questions"] += list(added)
    found: dict[str, Any] = check(_judge(tmp_path, entry), "false_continuations")
    return found


def test_a_listed_pair_of_equal_titles_grouped_by_no_question_fails(tmp_path: Path) -> None:
    found = _stale(tmp_path, ("Made-up Section M", "Made-up Section M"))

    assert found["status"] == "FAIL"
    assert found["measured"]["stale_grouped"] == 1
    assert found["measured"]["false_questions"] == 0


def test_titles_differing_only_in_case_or_spacing_are_equal(tmp_path: Path) -> None:
    found = _stale(tmp_path, ("Made-up  Section M ", "made-up section m"))

    assert found["measured"]["stale_grouped"] == 1


@pytest.mark.parametrize(
    "holder",
    [
        which_kind("h1", ARCHITECTURAL, "a4", "a5"),
        conflict("h1", SAME_TITLE, ARCHITECTURAL, "a5", "a4"),
        question("h1", "check", "engine.check.synthetic_pair", ARCHITECTURAL, ["a1", "a4", "a5"]),
    ],
    ids=["which-kind", "same-title", "another-code"],
)
def test_a_question_of_any_code_holding_both_groups_the_pair(
    tmp_path: Path, holder: dict[str, Any]
) -> None:
    found = _stale(tmp_path, ("Made-up Section M", "Made-up Section M"), holder)

    assert found["measured"]["stale_grouped"] == 0


def test_a_pair_whose_titles_differ_is_not_stale(tmp_path: Path) -> None:
    found = _stale(tmp_path, ("Made-up Section M", "Made-up Section N"))

    assert found["status"] == "PASS"
    assert found["measured"]["stale_grouped"] == 0


# Case 7: the machine-doubt cap ---------------------------------------------------------------------


def _doubt(tmp_path: Path, entry: dict[str, Any], expect: dict[str, Any] | None = None) -> Any:
    verdict = _judge(tmp_path, entry, expect)
    return verdict, check(verdict, "questions_per_discipline")


def test_four_machine_doubt_questions_in_a_discipline_fail(tmp_path: Path) -> None:
    entry = standard_set()
    entry["questions"] += [which_kind("w7", STRUCTURAL, "s7"), which_kind("w8", STRUCTURAL, "s8")]

    verdict, found = _doubt(tmp_path, entry)

    assert found["status"] == "FAIL"
    assert found["measured"]["questions_max_per_discipline"] == 4
    assert row(verdict, STRUCTURAL)["machine_doubt_questions"] == 4


def test_thirteen_gap_questions_of_one_file_count_once(tmp_path: Path) -> None:
    entry = standard_set()
    entry["questions"] += [gap(f"g{n}", STRUCTURAL, f"s{1 + n % 9}") for n in range(13)]
    entry["bulk_after_gaps"] = {STRUCTURAL: 9}

    verdict, found = _doubt(tmp_path, entry)

    assert found["status"] == "PASS"
    assert found["measured"]["questions_max_per_discipline"] == 3
    assert row(verdict, STRUCTURAL)["machine_doubt_questions"] == 3
    assert row(verdict, STRUCTURAL)["questions_total"] == 16


def test_one_gaps_question_counts_once(tmp_path: Path) -> None:
    entry = standard_set()
    entry["questions"].append(gap("g1", STRUCTURAL, "s2", "s7", code=GAPS))
    entry["bulk_after_gaps"] = {STRUCTURAL: 9}

    verdict, found = _doubt(tmp_path, entry)

    assert found["status"] == "PASS"
    assert row(verdict, STRUCTURAL)["machine_doubt_questions"] == 3


def test_gaps_over_two_files_count_twice(tmp_path: Path) -> None:
    entry = standard_set()
    for sid in ("s8", "s9"):
        by_id(entry, sid)["file"] = FILE_B
    entry["questions"] = [q for q in entry["questions"] if q["id"] != "q3"]  # one which_kind left
    entry["questions"] += [
        gap("g1", STRUCTURAL, "s1"),
        gap("g2", STRUCTURAL, "s2"),
        gap("g3", STRUCTURAL, "s8"),
        gap("g4", STRUCTURAL, "s9", "s1"),
    ]
    entry["bulk_after_gaps"] = {STRUCTURAL: 9}

    verdict, found = _doubt(tmp_path, entry)

    # One which_kind, and the gaps of kilo.dwg and of lima.dwg (g4's first held Sheet is in lima.dwg).
    assert row(verdict, STRUCTURAL)["machine_doubt_questions"] == 3
    assert found["status"] == "PASS"


def test_gap_questions_holding_no_sheet_count_once_per_discipline(tmp_path: Path) -> None:
    entry = standard_set()
    entry["questions"] += [gap("g1", STRUCTURAL, "s1"), gap("g2", STRUCTURAL), gap("g3", STRUCTURAL)]
    entry["bulk_after_gaps"] = {STRUCTURAL: 9}

    verdict, found = _doubt(tmp_path, entry)

    # Two which_kind, kilo.dwg's gap once, and the two gaps holding no Sheet once: 4 against 3.
    assert row(verdict, STRUCTURAL)["machine_doubt_questions"] == 4
    assert found["measured"]["questions_max_per_discipline"] == 4
    assert found["status"] == "FAIL"


def test_many_gap_questions_holding_no_sheet_count_once_in_each_discipline(tmp_path: Path) -> None:
    entry = standard_set()
    entry["questions"] += [gap(f"g{n}", STRUCTURAL) for n in range(11)]
    entry["questions"].append(gap("h1", ARCHITECTURAL))
    entry["bulk_after_gaps"] = {STRUCTURAL: 9, ARCHITECTURAL: 5}

    verdict, found = _doubt(tmp_path, entry)

    assert row(verdict, STRUCTURAL)["machine_doubt_questions"] == 3
    assert row(verdict, ARCHITECTURAL)["machine_doubt_questions"] == 2
    assert row(verdict, STRUCTURAL)["questions_total"] == 14
    assert found["measured"]["questions_max_per_discipline"] == 3
    assert found["status"] == "PASS"


def test_listed_true_questions_fall_outside_the_cap(tmp_path: Path) -> None:
    entry = standard_set()
    entry["questions"] += [
        which_kind("w7", STRUCTURAL, "s7"),
        conflict("t2", SAME_NUMBER, STRUCTURAL, "s8", "s9"),
    ]
    expect = standard_expect()
    expect["true_questions"].append(
        {
            "discipline": STRUCTURAL,
            "code": SAME_NUMBER,
            "sheets": [{"file": FILE_A, "number": "K-08"}, {"file": FILE_A, "number": "K-09"}],
        }
    )

    verdict, found = _doubt(tmp_path, entry, expect)

    assert found["status"] == "PASS"
    assert found["measured"]["questions_max_per_discipline"] == 3
    assert row(verdict, STRUCTURAL)["machine_doubt_questions"] == 3
    assert row(verdict, STRUCTURAL)["questions_total"] == 5
