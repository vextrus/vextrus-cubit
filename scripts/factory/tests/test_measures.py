"""Ordinary tests of the measures' edges (S17-F4): no data, gh failure, the lessons parser."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import pytest

from scripts.factory import measures, stamp, status

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


def ci(
    sha: str,
    workflow: str,
    created: str,
    minutes: int,
    status_: str = "completed",
    conclusion: str = "success",
) -> dict[str, object]:
    done = status.utc(status.parse_utc(created) + timedelta(minutes=minutes))
    return {
        "headSha": sha,
        "workflowName": workflow,
        "status": status_,
        "conclusion": conclusion,
        "createdAt": created,
        "startedAt": created,
        "updatedAt": done,
    }


def test_ci_wall_is_per_head_over_the_required_workflows_only() -> None:
    runs = [
        ci("a" * 40, "ci", "2026-10-08T07:00:00Z", 20),
        ci("a" * 40, "web", "2026-10-08T07:00:01Z", 0),  # skipped by its changes job
        ci("a" * 40, "real-drawings-na", "2026-10-08T07:00:01Z", 0),  # posts a status
        ci("a" * 40, "engine", "2026-10-08T07:01:00Z", 24),  # ends 5 minutes after ci
    ]
    got = measures.compute(**WINDOW, prs=[], ledger=[], lock_spans=[], verify_spans=[], ci_runs=runs)
    assert got["ci_wall_p50_min"] == pytest.approx(25)


def test_a_head_with_an_unfinished_required_run_is_not_counted() -> None:
    runs = [ci("b" * 40, "ci", "2026-10-08T07:00:00Z", 3, "in_progress")]
    got = measures.compute(**WINDOW, prs=[], ledger=[], lock_spans=[], verify_spans=[], ci_runs=runs)
    assert got["ci_wall_p50_min"] is None


def test_verify_spans_come_from_the_shared_records_and_skip_those_without_started_at(
    tmp_path: Path,
) -> None:
    folder = tmp_path / "vextrus"
    folder.mkdir()
    (folder / "verify-a.json").write_text(
        '{"started_at": "2026-10-08T07:00:00Z", "written_at": "2026-10-08T07:20:00Z"}'
    )
    (folder / "verify-b.json").write_text('{"written_at": "2026-10-08T08:00:00Z"}')
    assert measures.read_verify_spans(tmp_path) == [("2026-10-08T07:00:00Z", "2026-10-08T07:20:00Z")]


@pytest.mark.parametrize(
    "line",
    [
        "2026-10-08T07:00:00Z #287 r2 PASS. LESSON: run ruff first",
        "- 10:40Z D1 done. LESSON: run ruff first",
        "- LESSON (this session): run ruff first",
        "2026-10-08T07:00:00Z LESSON: run ruff first",
    ],
)
def test_a_lesson_is_found_anywhere_on_a_line(line: str) -> None:
    found = stamp.LESSON_LINE.search(line)
    assert found is not None
    assert found.group(1) == "run ruff first"


def test_superseded_cancelled_heads_do_not_drag_the_ci_wall_down() -> None:
    runs = [
        ci("c" * 40, "ci", "2026-10-08T07:00:00Z", 1, conclusion="cancelled"),
        ci("d" * 40, "ci", "2026-10-08T08:00:00Z", 1, conclusion="cancelled"),
        ci("e" * 40, "ci", "2026-10-08T09:00:00Z", 20),
    ]
    got = measures.compute(**WINDOW, prs=[], ledger=[], lock_spans=[], verify_spans=[], ci_runs=runs)
    assert got["ci_wall_p50_min"] == pytest.approx(20)


def test_one_cancelled_required_run_leaves_the_whole_head_out_and_a_skipped_one_does_not() -> None:
    runs = [
        ci("f" * 40, "ci", "2026-10-08T07:00:00Z", 20),
        ci("f" * 40, "engine", "2026-10-08T07:00:30Z", 2, conclusion="cancelled"),
        ci("1" * 40, "ci", "2026-10-08T08:00:00Z", 12),
        ci("1" * 40, "engine", "2026-10-08T08:00:30Z", 0, conclusion="skipped"),
    ]
    got = measures.compute(**WINDOW, prs=[], ledger=[], lock_spans=[], verify_spans=[], ci_runs=runs)
    assert got["ci_wall_p50_min"] == pytest.approx(12)
