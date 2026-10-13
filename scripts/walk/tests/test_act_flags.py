"""S24-W1 fix round (PR 724): the act check names why the walk could not time its acts, each by its own
key, and fails: `reads_ended_before_samples`, `kind_not_offered` and `reads_timed_out`. Synthetic data
only, through T-WALK-4's fixture (loaded by path), as the ticket's acceptance tests do."""

import importlib.util
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest


def _fixture() -> ModuleType:
    path = Path(__file__).resolve().parent / "acceptance" / "s13_walk4" / "_s13_fixture.py"
    spec = importlib.util.spec_from_file_location("_s24_w1_flags_fixture", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


F = _fixture()


def _acts() -> list[dict[str, Any]]:
    return [
        {"kind": kind, "ms": 100 + n, "read_running": True, "status": 200}
        for n in range(5)
        for kind in ("confirm", "undo", "exclude", "answer")
    ]


def _check(tmp_path: Path, **flags: Any) -> dict[str, Any]:
    sets = {F.SET_A: F.standard_set()}
    record: dict[str, Any] = F.walk(sets)
    record["sets"][F.SET_A]["acts"] = _acts()
    record["sets"][F.SET_A].update(flags)
    verdict = F.judged(tmp_path, sets, {F.SET_A: F.standard_expect()}, record=record)
    found: dict[str, Any] = F.check(verdict, "act_p95_during_read")
    return found


def test_the_samples_met_with_no_flag_pass(tmp_path: Path) -> None:
    assert _check(tmp_path)["status"] == "PASS"


@pytest.mark.parametrize("flag", ["reads_ended_before_samples", "kind_not_offered"])
def test_a_flag_fails_the_act_check_even_with_the_samples_met(tmp_path: Path, flag: str) -> None:
    found = _check(tmp_path, **{flag: True})

    assert found["status"] == "FAIL"
    assert found["measured"][flag] == 1


def test_a_false_flag_names_nothing(tmp_path: Path) -> None:
    found = _check(tmp_path, kind_not_offered=False, reads_ended_before_samples=False)

    assert found["status"] == "PASS"
    assert "kind_not_offered" not in found["measured"]
    assert "reads_ended_before_samples" not in found["measured"]


def test_reads_timed_out_fails_the_act_check_naming_the_count(tmp_path: Path) -> None:
    found = _check(tmp_path, reads_timed_out=2)

    assert found["status"] == "FAIL"
    assert found["measured"]["reads_timed_out"] == 2


def test_no_timeout_names_nothing(tmp_path: Path) -> None:
    found = _check(tmp_path, reads_timed_out=0)

    assert found["status"] == "PASS"
    assert "reads_timed_out" not in found["measured"]
