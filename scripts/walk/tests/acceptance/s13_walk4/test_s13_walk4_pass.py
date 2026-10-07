"""T-WALK-4 acceptance, case 2: a passing set is judged on eight checks, in the ticket's order.

"A synthetic walk, snapshot and expectation inside every limit: evaluate returns eight checks per set
in the order above, all PASS; schema.verdict_errors empty; ready.consistent true; main exit 0 with a
PASS agent layer." And `measures.attach` returns a copy (the seam: "a copy of `walk`"). Synthetic only.
"""

import copy
import json
from pathlib import Path

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    ARCHITECTURAL,
    CHECKS,
    FINISHED,
    MEASURED,
    SET_A,
    SET_B,
    SHA,
    STRUCTURAL,
    check,
    judged,
    lay_out,
    main_argv,
    measures,
    row,
    snapshot,
    standard_expect,
    standard_set,
    walk,
)


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    from scripts.walk import verdict

    monkeypatch.setattr(verdict, "utc_now", lambda: FINISHED)


def _sets() -> dict[str, dict[str, object]]:
    return {SET_A: standard_set(), SET_B: standard_set()}


def _expects() -> dict[str, object]:
    return {SET_A: standard_expect(), SET_B: standard_expect()}


def test_a_set_inside_every_limit_has_eight_passing_checks_in_order(tmp_path: Path) -> None:
    from scripts.walk.ready import consistent

    verdict = judged(tmp_path, _sets(), _expects())

    for set_ in (SET_A, SET_B):
        names = [c["check"] for c in verdict["checks"] if c["set"] == set_]
        assert names == list(CHECKS), names
    assert all(c["status"] == "PASS" for c in verdict["checks"]), verdict["checks"]
    assert verdict["result"] == "PASS"
    assert consistent(verdict) is True


def test_each_check_measures_the_seams_keys(tmp_path: Path) -> None:
    verdict = judged(tmp_path, _sets(), _expects())

    for name, keys in MEASURED.items():
        measured = check(verdict, name)["measured"]
        assert keys <= set(measured), (name, measured)
        assert set(measured) <= keys | {"unmeasured"}, (name, measured)
        assert measured.get("unmeasured", 0) == 0, (name, measured)
    acts = check(verdict, "act_p95_during_read")
    assert acts["measured"]["samples"] == 20
    assert {k: acts["measured"][k] for k in ("confirm", "undo", "exclude", "answer")} == {
        "confirm": 5,
        "undo": 5,
        "exclude": 5,
        "answer": 5,
    }
    assert acts["measured"]["failed_acts"] == 0
    assert acts["measured"]["max_ms"] == 290
    assert acts["expected"] == {"p95_ms_max": 1000, "max_ms_max": 3000, "samples_each_min": 5}
    sheets = check(verdict, "sheets_match")
    assert sheets["measured"]["sheets_found"] == 15
    assert sheets["measured"]["missing"] == 0
    assert sheets["measured"]["phantoms"] == 0
    assert sheets["expected"] == {"sheets": 15, "phantoms_max": 0}
    raised = check(verdict, "true_questions_raised")
    assert (raised["measured"]["true_listed"], raised["measured"]["true_raised"]) == (1, 1)
    assert raised["expected"] == {"true_questions": 1}
    false = check(verdict, "false_continuations")
    assert (false["measured"]["false_questions"], false["measured"]["stale_grouped"]) == (0, 0)
    assert false["expected"] == {"false_continuation_max": 0, "stale_title_grouped_max": 0}
    assert check(verdict, "bulk_confirmable_share")["expected"] == {"bulk_confirmable_share_min": 0.8}
    storeys = check(verdict, "storeys_match")
    assert (storeys["measured"]["storeys_listed"], storeys["measured"]["storeys_wrong"]) == (2, 0)
    assert storeys["expected"] == {"storeys_wrong_max": 0}
    questions = check(verdict, "questions_per_discipline")
    assert questions["measured"]["questions_max_per_discipline"] == 2
    assert questions["expected"] == {"questions_max_per_discipline": 3}


def test_the_burden_rows_carry_the_new_counts(tmp_path: Path) -> None:
    verdict = judged(tmp_path, _sets(), _expects())

    structural = row(verdict, STRUCTURAL)
    assert structural["sheets"] == 10
    assert structural["sheets_expected"] == 10
    assert structural["machine_doubt_questions"] == 2
    assert structural["questions_total"] == 3
    assert structural["continuation_questions"] == 1
    assert structural["false_continuation_questions"] == 0
    assert structural["bulk_confirmable_sheets"] == 9
    architectural = row(verdict, ARCHITECTURAL)
    assert architectural["sheets_expected"] == 5
    assert architectural["machine_doubt_questions"] == 1
    assert architectural["continuation_questions"] == 0
    for gone in ("false_continuation_questions_qs_view", "continuation_questions_unsure"):
        assert gone not in structural, gone


def test_attach_returns_a_measured_copy_and_leaves_the_walk_as_it_was(tmp_path: Path) -> None:
    sets = _sets()
    folder = tmp_path / "folder"
    folder.mkdir()
    (folder / "snapshot.json").write_text(json.dumps(snapshot(sets)))
    given = walk(sets)
    before = copy.deepcopy(given)

    measured = measures().attach(given, folder, _expects())

    assert given == before, "attach changed the walk it was given"
    for set_ in (SET_A, SET_B):
        found = measured["sets"][set_]["measures"]
        assert found == {
            "unmeasured": 0,
            "true_listed": 1,
            "true_raised": 1,
            "stale_grouped": 0,
            "storeys_listed": 2,
            "storeys_wrong": 0,
        }, found
        rows = measured["sets"][set_]["burden"]
        assert rows[STRUCTURAL]["sheets_expected"] == 10
        assert rows[STRUCTURAL]["machine_doubt_questions"] == 2
        assert rows[STRUCTURAL]["false_continuation_questions"] == 0
        assert rows[STRUCTURAL]["continuation_questions"] == 1


def test_main_judges_the_passing_walk_pass_and_writes_its_verdict(tmp_path: Path) -> None:
    from scripts.walk import verdict as verdict_module
    from scripts.walk.ready import consistent
    from scripts.walk.schema import verdict_errors

    walks, expect_dir = lay_out(tmp_path, _sets(), _expects())

    code = verdict_module.main(main_argv(walks, expect_dir))

    written = json.loads((walks / SHA / "verdict.json").read_text())
    assert verdict_errors(written) == []
    assert code == 0, [(c["set"], c["check"], c["status"]) for c in written["checks"]]
    assert written["result"] == "PASS"
    assert len(written["checks"]) == 16
    assert consistent(written) is True
