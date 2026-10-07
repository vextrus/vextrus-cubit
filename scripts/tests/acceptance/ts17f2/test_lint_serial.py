"""S17-F2: "`tools/lint/tests` serial until #585 is fixed" (`docs/handoff/session-17-prompt.md`, F2);
the brief: "`tools/lint/tests` targets run in a separate serial pytest invocation until #585 is fixed";
`verify-ci-speed.md` §2 item 2: "Run `tools/lint/tests` with `-p no:xdist` as its own check". #585: a
full xdist run fails 27 acceptance-lint tests.

Seam: `scripts.verify.plan_with_notes(paths)`; read on the argv each pytest check carries. Serial is no
`-n` (or `-p no:xdist`); what a run collects is its positional folders (none: the whole suite) less its
`--ignore` / `--ignore-glob`.
"""

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts17f2._argv import pytests

LINT_TESTS = "tools/lint/tests"
# Test folders of the tree at the time of writing, one per top-level package and module kind.
PROBES = [
    "vextrus/takeoff/tests",
    "vextrus/tests",
    "engine/read/tests",
    "scripts/tests",
    "scripts/factory/tests",
    "tools/leakscan/tests",
    LINT_TESTS,
]


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("VEXTRUS_VERIFY_WORKERS", "CLAUDE_CODE_REMOTE", "PYTEST_ADDOPTS"):
        monkeypatch.delenv(name, raising=False)


def test_a_tools_lint_change_runs_its_tests_serially_beside_a_parallel_module_run(
    tmp_path: Path,
) -> None:
    found = pytests(["tools/lint/acceptance.py", "vextrus/takeoff/views.py"], tmp_path)
    parallel = [run for run in found if run.parallel]
    assert parallel, f"no parallel pytest invocation in the plan: {[r.argv for r in found]}"
    assert any(run.collects_all("vextrus/takeoff/tests") for run in parallel), (
        f"the takeoff tests run in parallel: {[r.argv for r in found]}"
    )
    assert any(run.serial and run.collects_all(LINT_TESTS) for run in found), (
        f"tools/lint/tests run serially: {[r.argv for r in found]}"
    )
    assert not any(run.collects_any(LINT_TESTS) for run in parallel), (
        f"no parallel run collects tools/lint/tests (#585): {[r.argv for r in parallel]}"
    )


@pytest.mark.parametrize("shared", ["pyproject.toml", "uv.lock", "conftest.py"])
def test_the_whole_suite_runs_in_parallel_except_tools_lint_tests(tmp_path: Path, shared: str) -> None:
    found = pytests([shared], tmp_path)
    parallel = [run for run in found if run.parallel]
    assert parallel, f"no parallel pytest invocation in the plan: {[r.argv for r in found]}"
    for probe in PROBES:
        assert any(run.collects_all(probe) for run in found), f"{probe} is run: {found}"
    assert not any(run.collects_any(LINT_TESTS) for run in parallel), (
        f"no parallel run collects tools/lint/tests (#585): {[r.argv for r in parallel]}"
    )
    assert all(run.serial for run in found if run.collects_any(LINT_TESTS)), found
    for probe in PROBES[:-1]:
        assert any(run.collects_all(probe) for run in parallel), f"{probe} runs in parallel: {found}"


def test_a_change_only_in_tools_lint_does_not_run_the_whole_suite(tmp_path: Path) -> None:
    """Taking `tools/lint` out of the parallel run must not leave that run with no folder, which pytest
    reads as the whole suite."""
    found = pytests(["tools/lint/acceptance.py"], tmp_path)
    assert any(run.serial and run.collects_all(LINT_TESTS) for run in found), found
    for probe in PROBES[:-1]:
        assert not any(run.collects_any(probe) for run in found), f"{probe} is not run: {found}"


def test_a_change_outside_tools_lint_runs_no_tools_lint_tests(tmp_path: Path) -> None:
    found = pytests(["vextrus/takeoff/views.py"], tmp_path)
    assert not any(run.collects_any(LINT_TESTS) for run in found), found


def test_a_serial_setting_still_runs_every_test_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", "1")
    found = pytests(["pyproject.toml"], tmp_path)
    assert all(run.workers is None for run in found), [r.argv for r in found]
    for probe in PROBES:
        assert any(run.collects_all(probe) for run in found), f"{probe} is run: {found}"
