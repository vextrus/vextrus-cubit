"""The failures log keeps every failed or errored test's id and first error line
(`vextrus.testing.failures`)."""

import os
import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from vextrus.testing import failures

ROOT = Path(__file__).resolve().parents[2]

SUITE = """
import pytest

def test_passes():
    assert True

def test_fails():
    assert 1 + 1 == 3, "the sum is wrong"

@pytest.fixture
def broken():
    raise RuntimeError("no database\\nsecond line")

def test_errors(broken):
    pass

@pytest.fixture
def leaks():
    yield
    raise ValueError("left open")

def test_errors_in_teardown(leaks):
    pass

def test_skipped():
    pytest.skip("not here")
"""

STAMP = r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00"


def run(pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch) -> list[str]:
    monkeypatch.setenv("PYTHONPATH", str(ROOT))
    pytester.makepyfile(test_sample=SUITE)
    pytester.runpytest_subprocess(
        "-p", "vextrus.testing.failures", "-p", "no:django", "-p", "no:cacheprovider"
    )
    return (pytester.path / ".pytest-failures.log").read_text(encoding="utf-8").splitlines()


def test_each_failure_and_error_is_logged_with_its_first_line(
    pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
) -> None:
    lines = run(pytester, monkeypatch)

    fields = [line.split("\t") for line in lines]
    assert all(re.fullmatch(STAMP, stamp) for stamp, *_ in fields)
    assert [rest for _stamp, *rest in fields] == [
        ["failed", "test_sample.py::test_fails", "AssertionError: the sum is wrong"],
        ["error", "test_sample.py::test_errors", "RuntimeError: no database"],
        ["error", "test_sample.py::test_errors_in_teardown", "ValueError: left open"],
    ]


def test_a_second_run_appends(pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch) -> None:
    run(pytester, monkeypatch)

    assert len(run(pytester, monkeypatch)) == 6


@pytest.mark.skipif(
    os.geteuid() == 0, reason="root writes into a read-only folder (cloud sessions run as root)"
)
def test_a_log_that_cannot_be_written_is_said_once_and_every_test_still_runs(
    pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PYTHONPATH", str(ROOT))
    monkeypatch.setenv("PYTHONDONTWRITEBYTECODE", "1")
    checkout = pytester.mkdir("checkout")
    (checkout / "test_sample.py").write_text(SUITE, encoding="utf-8")
    checkout.chmod(0o555)  # a read-only checkout
    try:
        result = pytester.runpytest_subprocess(
            "-p", "vextrus.testing.failures", "-p", "no:django", "-p", "no:cacheprovider",
            "--rootdir", str(checkout), str(checkout),
        )  # fmt: skip
    finally:
        checkout.chmod(0o755)

    assert result.ret == pytest.ExitCode.TESTS_FAILED  # not INTERNAL_ERROR
    result.assert_outcomes(passed=2, failed=1, errors=2, skipped=1)
    assert str(result.stderr).count("The failures log cannot be written") == 1
    assert not (checkout / ".pytest-failures.log").exists()


def test_an_xdist_worker_leaves_the_log_to_its_controller(tmp_path: Path) -> None:
    registered: list[object] = []
    worker = SimpleNamespace(
        workerinput={"workerid": "gw0"},
        rootpath=tmp_path,
        pluginmanager=SimpleNamespace(register=lambda plugin, name: registered.append(plugin)),
    )
    controller = SimpleNamespace(rootpath=tmp_path, pluginmanager=worker.pluginmanager)

    failures.pytest_configure(worker)  # type: ignore[arg-type]
    assert registered == []
    failures.pytest_configure(controller)  # type: ignore[arg-type]
    assert [type(plugin) for plugin in registered] == [failures.FailuresLog]


def test_the_log_is_named_in_the_root_conftest_and_ignored_by_git() -> None:
    assert '"vextrus.testing.failures"' in (ROOT / "conftest.py").read_text(encoding="utf-8")
    assert "/.pytest-failures.log" in (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
