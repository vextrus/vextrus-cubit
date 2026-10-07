"""T-WALK-4 acceptance, case 9: act timing measured for each kind, by its worst act, failures apart.

"Acts: samples count only `read_running` acts with a status of 1 to 399 (or no status); `p95_ms` and
`max_ms` over those; `failed_acts` = acts with status 0 or 400+; ok when each kind has
`samples_each_min` or more, p95_ms <= p95_ms_max, max_ms <= max_ms_max, failed_acts == 0."
Synthetic data only: twenty acts, five of each kind, at invented times.
"""

from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    SET_A,
    acts,
    check,
    judged,
    standard_expect,
    standard_set,
    walk,
)


def _timed(tmp_path: Path, recorded: list[dict[str, Any]]) -> dict[str, Any]:
    sets = {SET_A: standard_set()}
    record = walk(sets)
    record["sets"][SET_A]["acts"] = recorded
    found: dict[str, Any] = check(
        judged(tmp_path, sets, {SET_A: standard_expect()}, record=record), "act_p95_during_read"
    )
    return found


def _times(*, last: float = 290) -> list[float]:
    """Twenty times, all fast, the last `last`."""
    return [100 + 10 * n for n in range(19)] + [last]


def test_five_of_each_kind_within_p95_and_a_worst_act_under_the_max_pass(tmp_path: Path) -> None:
    found = _timed(tmp_path, acts(_times(last=2950)))

    assert found["status"] == "PASS"
    assert found["measured"]["max_ms"] == 2950
    assert found["measured"]["p95_ms"] <= 1000
    assert found["measured"]["failed_acts"] == 0


def test_one_act_over_the_max_fails_though_p95_is_fine(tmp_path: Path) -> None:
    found = _timed(tmp_path, acts(_times(last=3050)))

    assert found["status"] == "FAIL"
    assert found["measured"]["max_ms"] == 3050
    assert found["measured"]["p95_ms"] <= 1000


def test_a_p95_over_its_limit_fails(tmp_path: Path) -> None:
    found = _timed(tmp_path, acts([1004] * 20))

    assert found["status"] == "FAIL"
    assert found["measured"]["p95_ms"] == 1004


@pytest.mark.parametrize(("kind", "left"), [("confirm", 0), ("undo", 4)])
def test_a_kind_below_its_sample_minimum_fails(tmp_path: Path, kind: str, left: int) -> None:
    recorded = acts()
    of_kind = [a for a in recorded if a["kind"] == kind]
    for act in of_kind[left:]:
        recorded.remove(act)

    found = _timed(tmp_path, recorded)

    assert found["status"] == "FAIL"
    assert found["measured"][kind] == left


def test_acts_with_no_read_running_are_not_samples(tmp_path: Path) -> None:
    recorded = acts()
    for act in recorded:
        if act["kind"] == "answer":
            act["read_running"] = False
    recorded.append({"kind": "exclude", "ms": 9000, "read_running": False, "status": 200})

    found = _timed(tmp_path, recorded)

    assert found["status"] == "FAIL"
    assert found["measured"]["answer"] == 0
    assert found["measured"]["samples"] == 15
    assert found["measured"]["max_ms"] == 280


def test_slow_acts_outside_a_read_change_nothing(tmp_path: Path) -> None:
    recorded = acts()
    recorded += [{"kind": "confirm", "ms": 9000, "read_running": False, "status": 200}] * 3

    found = _timed(tmp_path, recorded)

    assert found["status"] == "PASS"
    assert found["measured"]["samples"] == 20
    assert found["measured"]["max_ms"] == 290


@pytest.mark.parametrize("answered", [403, 0, 500], ids=["refused", "never-answered", "broken"])
def test_an_act_that_failed_is_counted_apart_and_fails(tmp_path: Path, answered: int) -> None:
    recorded = acts()
    recorded.append({"kind": "confirm", "ms": 150, "read_running": True, "status": answered})

    found = _timed(tmp_path, recorded)

    assert found["status"] == "FAIL"
    assert found["measured"]["failed_acts"] == 1
    assert found["measured"]["samples"] == 20
    assert found["measured"]["confirm"] == 5


def test_an_act_with_no_status_recorded_is_a_sample(tmp_path: Path) -> None:
    recorded = acts()
    for act in recorded:
        del act["status"]

    found = _timed(tmp_path, recorded)

    assert found["status"] == "PASS"
    assert found["measured"]["samples"] == 20
    assert found["measured"]["failed_acts"] == 0
