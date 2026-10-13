"""Ticket S24-W1's acceptance tests (#716): when every read of the acts Project ends before each kind of
act has its samples, the walk records it and `act_p95_during_read` FAILs naming it, never a silent
pass and never a slow product.

G1 walk 59524e39 gave 4 answers during reads on a set whose reads are short; the 5th answer landed after
the last read ended. The walk's act driver (web/e2e/real/act-driver.ts) now says so, and walk.spec.ts
records it in walk.json:

- `walk.json`: `sets.<slug>.reads_ended_before_samples`, a boolean (true: every read ended before each
  kind had `act_samples_min` samples while a read ran);
- `verdict.json` and `public/summary.json`: the act check's `measured.reads_ended_before_samples` 1 when
  it was true (a number, as every measured value), and the check FAILs.

Guards: an act after the reads ended is still in walk.json, never a sample; the limit (`act_samples_min`
5) is the expectation's, unchanged. Synthetic data only, through T-WALK-4's fixture (loaded by path).
"""

import importlib.util
import json
from pathlib import Path
from types import ModuleType
from typing import Any


def _fixture() -> ModuleType:
    path = Path(__file__).resolve().parent.parent / "s13_walk4" / "_s13_fixture.py"
    spec = importlib.util.spec_from_file_location("_s24_w1_s13_fixture", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


F = _fixture()
KEY = "reads_ended_before_samples"


def _acts(*, answers_during: int, answers_after: int) -> list[dict[str, Any]]:
    """Five confirms, undos and excludes during reads; `answers_during` answers during them and
    `answers_after` once the reads ended. All answered 200."""
    during = [
        {"kind": kind, "ms": 100 + 10 * n, "read_running": True, "status": 200}
        for n in range(5)
        for kind in ("confirm", "undo", "exclude")
    ]
    during += [
        {"kind": "answer", "ms": 150 + n, "read_running": True, "status": 200}
        for n in range(answers_during)
    ]
    after = [
        {"kind": "answer", "ms": 160 + n, "read_running": False, "status": 200}
        for n in range(answers_after)
    ]
    return during + after


def _record(acts: list[dict[str, Any]], ended: bool | None) -> dict[str, Any]:
    sets = {F.SET_A: F.standard_set()}
    record: dict[str, Any] = F.walk(sets)
    record["sets"][F.SET_A]["acts"] = acts
    if ended is not None:
        record["sets"][F.SET_A][KEY] = ended
    return record


def _act_check(tmp_path: Path, acts: list[dict[str, Any]], ended: bool | None) -> dict[str, Any]:
    sets = {F.SET_A: F.standard_set()}
    verdict = F.judged(tmp_path, sets, {F.SET_A: F.standard_expect()}, record=_record(acts, ended))
    found: dict[str, Any] = F.check(verdict, "act_p95_during_read")
    return found


def test_reads_ended_before_the_samples_fails_the_act_check_naming_it(tmp_path: Path) -> None:
    found = _act_check(tmp_path, _acts(answers_during=4, answers_after=1), True)

    assert found["status"] == "FAIL"
    assert found["measured"].get(KEY) == 1, f"reads ended before the samples not named: {found}"


def test_the_answer_after_the_reads_ended_is_recorded_but_not_a_sample(tmp_path: Path) -> None:
    found = _act_check(tmp_path, _acts(answers_during=4, answers_after=1), True)

    assert found["measured"]["answer"] == 4
    assert found["measured"]["samples"] == 19
    assert found["measured"]["failed_acts"] == 0


def test_samples_met_while_reads_ran_pass_without_naming_reads_ended(tmp_path: Path) -> None:
    found = _act_check(tmp_path, _acts(answers_during=5, answers_after=1), False)

    assert found["status"] == "PASS"
    assert found["measured"].get(KEY, 0) == 0
    assert found["measured"]["answer"] == 5


def test_the_limit_is_unchanged_four_answers_fail_without_the_flag(tmp_path: Path) -> None:
    found = _act_check(tmp_path, _acts(answers_during=4, answers_after=0), None)

    assert found["status"] == "FAIL"
    assert found["expected"]["samples_each_min"] == 5


def test_the_summary_names_reads_ended_before_the_samples_as_a_number(tmp_path: Path) -> None:
    from scripts.walk import verdict as verdict_module

    sets = {F.SET_A: F.standard_set()}
    record = _record(_acts(answers_during=4, answers_after=1), True)
    walks, expect_dir = F.lay_out(tmp_path, sets, {F.SET_A: F.standard_expect()}, record=record)

    code = verdict_module.main(F.main_argv(walks, expect_dir))

    assert code == 1, f"the walk with reads ended before the samples was not judged FAIL: exit {code}"
    summary = json.loads((walks / F.SHA / "public" / "summary.json").read_text())
    [acts] = [c for c in summary["checks"] if c["check"] == "act_p95_during_read"]
    assert acts["status"] == "FAIL"
    assert acts["measured"].get(KEY) == 1
    assert not isinstance(acts["measured"][KEY], bool)
