"""S17-F2: "`scripts/verify.py` runs pytest with a bounded worker count (default 6, overridable by an
environment variable; 4 in cloud; never `-n auto`, which starts 24 workers here at ~9 GB)"
(`docs/handoff/session-17-prompt.md`, F2; `verify-ci-speed.md` §2 item 2: "default 6,
`VEXTRUS_VERIFY_WORKERS` overrides; 4 in cloud containers ... Never via `PYTEST_ADDOPTS`"). The brief:
"a value of 1 or 0 means serial (no -n)".

Seam: `scripts.verify.plan_with_notes(paths)`, reading `VEXTRUS_VERIFY_WORKERS` and the cloud flag from
the environment when it is called. A cloud session is `CLAUDE_CODE_REMOTE=true`, as the repo's other
code detects it (`.claude/hooks/stop-gate.mjs`, `docs/specs/factory.md` 2.2). Checked on the argv the
plan builds, whatever its checks are named.
"""

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts17f2._argv import Pytest, pytests
from scripts.verify import plan_with_notes

MODULE = ["vextrus/takeoff/views.py"]


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("VEXTRUS_VERIFY_WORKERS", "CLAUDE_CODE_REMOTE", "PYTEST_ADDOPTS"):
        monkeypatch.delenv(name, raising=False)


def the_run(root: Path, paths: list[str] = MODULE) -> Pytest:
    """The one pytest invocation for a module change."""
    found = pytests(paths, root)
    assert len(found) == 1, f"one pytest invocation for {paths}, got {[r.argv for r in found]}"
    return found[0]


def test_pytest_runs_on_six_workers_by_default(tmp_path: Path) -> None:
    run = the_run(tmp_path)
    assert run.workers == "6", f"pytest workers: expected -n 6 by default, got {run.argv}"


def test_vextrus_verify_workers_sets_the_worker_count(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", "3")
    run = the_run(tmp_path)
    assert run.workers == "3", f"pytest workers: expected -n 3 from the variable, got {run.argv}"


@pytest.mark.parametrize("value", ["1", "0"])
def test_a_worker_count_of_one_or_zero_runs_pytest_serially(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", value)
    run = the_run(tmp_path)
    assert run.workers is None, f"pytest workers: {value} means no -n at all, got {run.argv}"
    # Red on the base as the other tests are: the variable only matters once there is a default.
    monkeypatch.delenv("VEXTRUS_VERIFY_WORKERS")
    assert the_run(tmp_path).parallel, (
        f"pytest workers: without the variable the same plan runs in parallel, got {run.argv}"
    )


def test_a_cloud_session_runs_pytest_on_four_workers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CLAUDE_CODE_REMOTE", "true")
    run = the_run(tmp_path)
    assert run.workers == "4", f"pytest workers: expected -n 4 in a cloud session, got {run.argv}"


def test_a_cloud_flag_other_than_true_is_not_a_cloud_session(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CLAUDE_CODE_REMOTE", "false")
    run = the_run(tmp_path)
    assert run.workers == "6", f"pytest workers: expected the local -n 6, got {run.argv}"


@pytest.mark.parametrize(
    "setting",
    [{}, {"CLAUDE_CODE_REMOTE": "true"}, {"VEXTRUS_VERIFY_WORKERS": "auto"}],
    ids=["local", "cloud", "variable-auto"],
)
def test_pytest_is_never_given_an_automatic_worker_count(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, setting: dict[str, str]
) -> None:
    """`-n auto` (or `logical`) starts a worker per core: 24 here, ~9 GB. A variable asking for it is
    refused or replaced by a number; it never reaches pytest."""
    for name, value in setting.items():
        monkeypatch.setenv(name, value)
    refused: BaseException | None = None
    try:
        found = pytests(["pyproject.toml", *MODULE], tmp_path)
    except (SystemExit, ValueError) as error:
        refused, found = error, []
    if refused is not None:
        assert setting.get("VEXTRUS_VERIFY_WORKERS") == "auto", f"only a bad value refuses: {refused}"
        return
    for run in found:
        assert run.workers is None or run.workers.isdigit(), f"a counted worker number: {run.argv}"
        assert not {"auto", "logical"} & {*run.argv, f"-n{run.workers}"}, run.argv
    if not setting.get("VEXTRUS_VERIFY_WORKERS"):
        assert any(run.parallel for run in found), f"pytest workers: no parallel run in {found}"


def test_every_pytest_run_keeps_the_failure_lines_and_the_acceptance_plugin(tmp_path: Path) -> None:
    """`-rf` feeds the flake and root-only readings; the plugin fails a run that dropped an acceptance
    test. Neither may be lost to the worker split."""
    found = pytests(["pyproject.toml", "tools/lint/acceptance.py", *MODULE], tmp_path)
    assert found, "verify plans a pytest run"
    for run in found:
        assert "-rf" in run.flags, f"-rf in {run.argv}"
        assert "tools.lint.acceptance_pytest" in run.plugins, f"the acceptance plugin in {run.argv}"
    assert any(run.parallel for run in found), f"pytest workers: no parallel run in {found}"


def test_the_worker_count_is_never_passed_through_pytest_addopts(tmp_path: Path) -> None:
    """`.claude/rules/backend.md`: never put `-n` in `PYTEST_ADDOPTS` (the tests that spawn pytest
    would inherit it). The count is on the argv."""
    checks, _ = plan_with_notes(["pyproject.toml", *MODULE], have=lambda tool: False, root=tmp_path)
    for check in checks:
        assert "-n" not in check.env.get("PYTEST_ADDOPTS", ""), check.command
    assert any(run.parallel for run in pytests(MODULE, tmp_path)), (
        "pytest workers: the count is on the argv"
    )
