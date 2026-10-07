"""S17-F4: the committed targets file, and the flags the next brief opens with.

The seams (named here; the builder makes them):

    measures.load_targets(path) -> {"<measure key>": <number>, ...}
    measures.compare(current, previous, targets) -> the flags, one per flagged measure

`current` and `previous` are measure dicts as `measures.compute` returns them (`previous` is None for a
first session); `targets` is `load_targets`'s dict. A flag names the measure's key; a measure that
missed its target says "target", one worse than the previous session's says "regress" (regressed,
regression), in any case. Lower is better for every `*_min` measure and `rounds_per_pr`; higher is
better for `prs_merged`.
"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

import pytest

measures: Any = importlib.import_module("scripts.factory.measures")

REPO = Path(__file__).resolve().parents[4]
TARGETS_FILE = REPO / "docs" / "knowledge" / "factory-targets.toml"
TARGETS = {"ci_wall_p50_min": 10.0, "verify_p90_min": 10.0, "crosspr_max_min": 5.0}
HELD = {
    "prs_merged": 6,
    "merge_p50_min": 40.0,
    "rounds_per_pr": 1.5,
    "rdlock_min": 60.0,
    "verify_p50_min": 4.0,
    "verify_p90_min": 8.0,
    "ci_wall_p50_min": 8.0,
    "crosspr_max_min": 3.0,
}


def flag_lines(flags: Any) -> list[str]:
    """Each flag as text: a list of strings, of records, or a dict keyed by measure all read the same."""
    if isinstance(flags, dict):
        return [f"{key} {value}" for key, value in flags.items()]
    return [str(flag) for flag in flags]


def flags_for(key: str, flags: Any) -> list[str]:
    return [line for line in flag_lines(flags) if key in line]


def test_the_committed_targets_file_holds_the_sessions_targets() -> None:
    targets = dict(measures.load_targets(TARGETS_FILE))
    assert targets["ci_wall_p50_min"] == pytest.approx(10)
    assert targets["verify_p90_min"] == pytest.approx(10)
    assert targets["crosspr_max_min"] == pytest.approx(5)


def test_a_measure_over_its_target_is_flagged_as_missing_it() -> None:
    current = {**HELD, "verify_p90_min": 30.0}
    flagged = flags_for("verify_p90_min", measures.compare(current, None, TARGETS))
    assert flagged, "verify_p90_min = 30 against a target of 10 is not flagged"
    assert any("target" in line.lower() for line in flagged), flagged


def test_a_measure_worse_than_the_previous_session_is_flagged_as_regressed() -> None:
    previous = {**HELD, "ci_wall_p50_min": 4.0}
    current = {**HELD, "ci_wall_p50_min": 8.0}
    flagged = flags_for("ci_wall_p50_min", measures.compare(current, previous, TARGETS))
    assert flagged, "ci_wall_p50_min went 4 -> 8 (within its target of 10) and is not flagged"
    assert any("regress" in line.lower() for line in flagged), flagged


def test_a_measure_with_no_target_is_flagged_when_it_regressed() -> None:
    previous = {**HELD, "merge_p50_min": 40.0}
    current = {**HELD, "merge_p50_min": 80.0}
    flagged = flags_for("merge_p50_min", measures.compare(current, previous, TARGETS))
    assert flagged, "merge_p50_min went 40 -> 80 and is not flagged"
    assert any("regress" in line.lower() for line in flagged), flagged


def test_fewer_prs_merged_than_the_previous_session_is_a_regression() -> None:
    previous = {**HELD, "prs_merged": 6}
    current = {**HELD, "prs_merged": 2}
    flagged = flags_for("prs_merged", measures.compare(current, previous, TARGETS))
    assert flagged, "prs_merged went 6 -> 2 and is not flagged"
    assert any("regress" in line.lower() for line in flagged), flagged


def test_a_measure_that_improved_and_meets_its_target_is_not_flagged() -> None:
    previous = {**HELD, "merge_p50_min": 80.0, "ci_wall_p50_min": 9.0, "prs_merged": 2}
    flags = measures.compare(HELD, previous, TARGETS)
    for key in ("merge_p50_min", "ci_wall_p50_min", "prs_merged"):
        assert not flags_for(key, flags), f"{key} improved and is flagged: {flag_lines(flags)}"


def test_nothing_is_flagged_when_every_measure_held_and_met_its_target() -> None:
    flags = measures.compare(dict(HELD), dict(HELD), TARGETS)
    assert not flag_lines(flags), flag_lines(flags)
