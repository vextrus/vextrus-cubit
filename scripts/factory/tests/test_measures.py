"""Ordinary tests of the measures' edges (S17-F4): no data, gh failure, the lessons parser."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.factory import measures, stamp

WINDOW = {"started_utc": "2026-10-08T06:00:00Z", "ended_utc": "2026-10-08T18:00:00Z"}


def test_a_session_with_no_data_has_none_for_every_percentile() -> None:
    got = measures.compute(**WINDOW, prs=[], ledger=[], lock_spans=[], verify_spans=[], ci_runs=[])
    assert got["prs_merged"] == 0
    assert got["rdlock_min"] == 0
    for key in ("merge_p50_min", "rounds_per_pr", "verify_p50_min", "verify_p90_min", "ci_wall_p50_min"):
        assert got[key] is None


def test_a_failed_gh_leaves_the_gh_measures_unmeasured() -> None:
    got = measures.compute(**WINDOW, prs=None, ledger=[], lock_spans=[], verify_spans=[], ci_runs=None)
    assert got["prs_merged"] is None
    assert got["ci_wall_p50_min"] is None


def test_an_unmeasured_value_is_never_flagged() -> None:
    assert (
        measures.compare({"verify_p90_min": None}, {"verify_p90_min": 3.0}, {"verify_p90_min": 1.0})
        == []
    )


def test_the_percentile_interpolates() -> None:
    assert measures.percentile([1, 2, 3, 4], 0.5) == pytest.approx(2.5)
    assert measures.percentile([], 0.5) is None


def test_the_targets_file_loads_its_numbers(tmp_path: Path) -> None:
    path = tmp_path / "t.toml"
    path.write_text("# c\na_min = 3\nb = 2.5\n")
    assert measures.load_targets(path) == {"a_min": 3.0, "b": 2.5}


def test_a_bullet_runs_on_over_its_indented_lines_and_ends_at_a_blank_line() -> None:
    text = "# H\n- one\n  two\n  Check: x\n\n  stray\n- three\n"
    assert stamp.lesson_bullets(text) == ["one two Check: x", "three"]
