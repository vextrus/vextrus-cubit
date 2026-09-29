"""The failures log keeps every failed or errored test's id and first error line
(`vextrus.testing.failures`)."""

import re
from pathlib import Path

import pytest

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


def test_the_log_is_named_in_the_root_conftest_and_ignored_by_git() -> None:
    assert '"vextrus.testing.failures"' in (ROOT / "conftest.py").read_text(encoding="utf-8")
    assert "/.pytest-failures.log" in (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
