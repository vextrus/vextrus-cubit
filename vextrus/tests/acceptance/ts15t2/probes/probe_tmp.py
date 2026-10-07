"""Run only by `test_basetemp.py` in an inner pytest session (no `test_` prefix: never collected by
name). A session fixture's folder, a passing test's folder and a failing test's folder, each with a
file."""

from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def shared(tmp_path_factory: pytest.TempPathFactory) -> Path:
    folder = tmp_path_factory.mktemp("shared")
    (folder / "session-fixture.bin").write_bytes(b"x" * 4096)
    return folder


def test_passes(tmp_path: Path, shared: Path) -> None:
    (tmp_path / "passed-test.txt").write_text("a passing test's file")


def test_fails(tmp_path: Path, shared: Path) -> None:
    (tmp_path / "failed-test.txt").write_text("a failing test's file")
    raise AssertionError("the probe fails on purpose")
