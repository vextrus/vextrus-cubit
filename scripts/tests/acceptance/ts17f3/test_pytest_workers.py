"""S17-F3: crosspr's pytest runs with a bounded worker count, verify's rule (session-17 brief, F2 and F3;
verify-ci-speed.md 2, item 1 (a): "add `-n <workers>` to the pytest argv"): 6 by default,
`VEXTRUS_VERIFY_WORKERS` overrides, never `-n auto`; `tools/lint/tests` stays serial (#585)."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts17f3._world import (
    NAME_TEST,
    Check,
    names,
    one_pr_world,
    serial,
    show,
    workers,
)

WORKERS = "pytest workers"
LINT_TEST = "def test_lint():\n    assert True\n"


def test_every_pytest_run_carries_six_workers_by_default(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    check = Check(one_pr_world(tmp_path), monkeypatch, capsys)
    done = check()
    assert done.code == 0, show(done)
    assert done.sides() == ["baseline", "union"], show(done)
    for run in done.runs:
        assert workers(run.argv) == "6", f"{WORKERS}: {show(done)}"
        assert not any("auto" in part for part in run.argv), show(done)


def test_vextrus_verify_workers_sets_the_count(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    check = Check(one_pr_world(tmp_path), monkeypatch, capsys)
    done = check({"VEXTRUS_VERIFY_WORKERS": "3"})
    assert done.code == 0, show(done)
    assert done.sides() == ["baseline", "union"], show(done)
    for run in done.runs:
        assert workers(run.argv) == "3", f"{WORKERS}: {show(done)}"


def test_tools_lint_tests_run_serially_and_the_rest_with_workers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    lint = "tools/lint/tests/test_x1_lint.py"
    other = "tests/test_x1_name.py"
    world = one_pr_world(tmp_path, {lint: LINT_TEST, other: NAME_TEST})
    done = Check(world, monkeypatch, capsys)()
    assert done.code == 0, show(done)
    for side in ("baseline", "union"):
        runs = [run for run in done.runs if run.side == side]
        linted = [run for run in runs if names(run.argv, lint)]
        rest = [run for run in runs if names(run.argv, other)]
        assert linted, f"{side}: {show(done)}"
        assert rest, f"{side}: {show(done)}"
        for run in rest:
            assert workers(run.argv) == "6", f"{WORKERS}: {show(done)}"
        for run in linted:
            assert serial(run.argv), f"{WORKERS} on tools/lint/tests: {show(done)}"
