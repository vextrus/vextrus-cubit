"""Run only by `test_basetemp_xdist.py` in an inner session (no `test_` prefix): one failing test."""

from pathlib import Path


def test_fails(tmp_path: Path) -> None:
    (tmp_path / "failed-test.txt").write_text("a failing test's file")
    raise AssertionError("the probe fails on purpose")
