"""T-WALK-4 acceptance, cases 1 and 12: the expectation keys the owner's Q5 limits need.

"Expectation keys (per set ...; EXPECT_KEYS and web/e2e/real/expect.schema.json accept them; numbers
non-negative, a key missing makes its check UNSET) ... A wrong shape, a negative or non-integer count, a
share above 1 or an unknown key: Malformed (exit 2, nothing written)." Synthetic data only.
"""

import copy
from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    CHECKS,
    FINISHED,
    SET_A,
    SHA,
    lay_out,
    main_argv,
    standard_expect,
    standard_set,
    status,
)
from _s13_fixture import check as check_  # type: ignore[import-not-found, unused-ignore]
from _s13_fixture import judged as judged_  # type: ignore[import-not-found, unused-ignore]


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    from scripts.walk import verdict

    monkeypatch.setattr(verdict, "utc_now", lambda: FINISHED)


def test_an_expectation_with_every_new_key_is_judged_on_eight_checks(tmp_path: Path) -> None:
    verdict = judged_(tmp_path, {SET_A: standard_set()}, {SET_A: standard_expect()})

    assert [c["check"] for c in verdict["checks"]] == list(CHECKS)
    assert all(c["status"] != "UNSET" for c in verdict["checks"]), verdict["checks"]


def _bad(change: str) -> dict[str, Any]:
    expect: dict[str, Any] = standard_expect()
    match change:
        case "true-question-sheet-without-file":
            del expect["true_questions"][0]["sheets"][0]["file"]
        case "true-question-without-code":
            del expect["true_questions"][0]["code"]
        case "true-question-with-no-sheets":
            expect["true_questions"][0]["sheets"] = []
        case "sheets-per-discipline-negative":
            expect["sheets_per_discipline"]["structural"] = -1
        case "sheets-per-discipline-float":
            expect["sheets_per_discipline"]["structural"] = 9.5
        case "sheets-per-discipline-a-list":
            expect["sheets_per_discipline"] = [10, 5]
        case "storeys-entry-without-a-list":
            expect["storeys"][0]["storeys"] = "T1"
        case "stale-pair-of-one-sheet":
            expect["stale_title_pairs"][0]["sheets"] = expect["stale_title_pairs"][0]["sheets"][:1]
        case "share-above-one":
            expect["bulk_confirmable_share_min"] = 1.5
        case "negative-act-max":
            expect["act_max_ms"] = -5
        case "act-samples-not-integer":
            expect["act_samples_min"] = 2.5
        case "phantoms-max-a-word":
            expect["phantom_sheets_max"] = "none"
        case "unknown-key":
            expect["sheets_wanted_by_eye"] = 3
        case _:
            raise AssertionError(change)
    return expect


BAD = (
    "true-question-sheet-without-file",
    "true-question-without-code",
    "true-question-with-no-sheets",
    "sheets-per-discipline-negative",
    "sheets-per-discipline-float",
    "sheets-per-discipline-a-list",
    "storeys-entry-without-a-list",
    "stale-pair-of-one-sheet",
    "share-above-one",
    "negative-act-max",
    "act-samples-not-integer",
    "phantoms-max-a-word",
    "unknown-key",
)


@pytest.mark.parametrize("change", BAD)
def test_a_malformed_expectation_is_refused_and_nothing_is_written(tmp_path: Path, change: str) -> None:
    from scripts.walk import verdict
    from scripts.walk.verdict import Malformed

    good = standard_set()
    with pytest.raises(Malformed):
        judged_(
            tmp_path / "direct",
            {SET_A: good},
            {SET_A: _bad(change)},
            attach_expect={SET_A: standard_expect()},
        )

    walks, expect_dir = lay_out(tmp_path / "cli", {SET_A: good}, {SET_A: _bad(change)})
    assert verdict.main(main_argv(walks, expect_dir)) == 2
    folder = walks / SHA
    assert not (folder / "verdict.json").exists()
    assert not (folder / "public" / "summary.json").exists()


def test_an_empty_true_questions_list_means_none_and_is_accepted(tmp_path: Path) -> None:
    entry = standard_set()
    entry["questions"] = [q for q in entry["questions"] if q["id"] != "q1"]
    expect = standard_expect()
    expect["true_questions"] = []

    verdict = judged_(tmp_path, {SET_A: entry}, {SET_A: expect})

    raised = check_(verdict, "true_questions_raised")
    assert raised["status"] == "PASS"
    assert raised["measured"]["true_listed"] == 0
    assert raised["measured"]["true_raised"] == 0


# Case 12: each new key, removed, leaves its check UNSET -------------------------------------------

NEW_KEYS = (
    ("act_max_ms", "act_p95_during_read"),
    ("act_samples_min", "act_p95_during_read"),
    ("phantom_sheets_max", "sheets_match"),
    ("sheets_per_discipline", "sheets_match"),
    ("true_questions", "true_questions_raised"),
    ("stale_title_grouped_max", "false_continuations"),
    ("stale_title_pairs", "false_continuations"),
    ("storeys_wrong_max", "storeys_match"),
    ("storeys", "storeys_match"),
    ("bulk_confirmable_share_min", "bulk_confirmable_share"),
    ("false_continuation_max", "false_continuations"),
    ("questions_max_per_discipline", "questions_per_discipline"),
)


@pytest.mark.parametrize(("key", "check"), NEW_KEYS, ids=[k for k, _ in NEW_KEYS])
def test_a_missing_key_leaves_its_check_unset_and_the_walk_fails(
    tmp_path: Path, key: str, check: str
) -> None:
    expect = standard_expect()
    del expect[key]

    verdict = judged_(tmp_path, {SET_A: standard_set()}, {SET_A: expect})

    unset = check_(verdict, check)
    assert unset["status"] == "UNSET", (key, unset)
    assert unset["expected"] is None
    assert verdict["result"] == "FAIL"
    full = judged_(tmp_path / "full", {SET_A: standard_set()}, {SET_A: copy.deepcopy(standard_expect())})
    assert status(full, check) == "PASS", "the same walk with the key passes"
