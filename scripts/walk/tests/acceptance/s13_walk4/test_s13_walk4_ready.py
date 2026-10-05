"""T-WALK-4 acceptance, case 13: ready.py counts only a verdict of the eight checks whose every status is
what `status_of` derives from its own measured, expected and burden rows.

"A verdict with the old three checks is refused (consistent false); case 2's verdict is accepted;
changing measured.phantoms to 0 in a verdict whose rows say otherwise, or true_raised above the rows'
truth, makes it inconsistent (the status no longer matches status_of)." Synthetic data only.
"""

import copy
from pathlib import Path
from typing import Any

from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    ARCHITECTURAL,
    FILE_A,
    FILE_B,
    SAME_NUMBER,
    SET_A,
    STRUCTURAL,
    check,
    judged,
    sheet,
    standard_expect,
    standard_set,
)

OLD_THREE = ("reads_complete", "act_p95_during_read", "questions_per_discipline")


def _forged_pass(verdict: dict[str, Any], name: str, **measured: int) -> dict[str, Any]:
    """`verdict` with `name`'s measured changed and its status, and the result, written PASS."""
    forged = copy.deepcopy(verdict)
    target = check(forged, name)
    target["measured"].update(measured)
    target["status"] = "PASS"
    forged["result"] = "PASS"
    return forged


def test_the_passing_eight_check_verdict_is_consistent(tmp_path: Path) -> None:
    from scripts.walk.ready import consistent

    verdict = judged(tmp_path, {SET_A: standard_set()}, {SET_A: standard_expect()})

    assert verdict["result"] == "PASS"
    assert consistent(verdict) is True


def test_a_verdict_of_the_old_three_checks_is_refused(tmp_path: Path) -> None:
    from scripts.walk.ready import consistent

    verdict = judged(tmp_path, {SET_A: standard_set()}, {SET_A: standard_expect()})
    old = copy.deepcopy(verdict)
    old["checks"] = [c for c in old["checks"] if c["check"] in OLD_THREE]

    assert consistent(old) is False


def test_phantoms_written_away_against_the_rows_are_inconsistent(tmp_path: Path) -> None:
    from scripts.walk.ready import consistent
    from scripts.walk.verdict import status_of

    entry = standard_set()
    entry["sheets"] += [
        sheet(f"s{n}", FILE_A, f"K-{n:02d}", f"Made-up Plan K{n}", STRUCTURAL) for n in (11, 12)
    ]
    verdict = judged(tmp_path, {SET_A: entry}, {SET_A: standard_expect()})
    assert check(verdict, "sheets_match")["measured"]["phantoms"] == 2
    assert verdict["result"] == "FAIL"
    assert consistent(verdict) is True, "the honest verdict is consistent"

    forged = _forged_pass(verdict, "sheets_match", phantoms=0)

    rows = [r for r in forged["burden"] if r["set"] == SET_A]
    assert status_of(check(forged, "sheets_match"), rows) != "PASS"
    assert consistent(forged) is False


def test_true_raised_written_above_the_listed_is_inconsistent(tmp_path: Path) -> None:
    from scripts.walk.ready import consistent
    from scripts.walk.verdict import status_of

    expect = standard_expect()
    expect["true_questions"].append(
        {
            "discipline": ARCHITECTURAL,
            "code": SAME_NUMBER,
            "sheets": [{"file": FILE_B, "number": "L-03"}, {"file": FILE_B, "number": "L-05"}],
        }
    )
    verdict = judged(tmp_path, {SET_A: standard_set()}, {SET_A: expect})
    raised = check(verdict, "true_questions_raised")
    assert (raised["measured"]["true_listed"], raised["measured"]["true_raised"]) == (2, 1)
    assert consistent(verdict) is True, "the honest verdict is consistent"

    forged = _forged_pass(verdict, "true_questions_raised", true_raised=3)

    rows = [r for r in forged["burden"] if r["set"] == SET_A]
    assert status_of(check(forged, "true_questions_raised"), rows) != "PASS"
    assert consistent(forged) is False
