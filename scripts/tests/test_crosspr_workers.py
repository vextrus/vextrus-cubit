"""crosspr's worker count: 6 by default, `VEXTRUS_VERIFY_WORKERS` overrides, never `auto`."""

import subprocess
from pathlib import Path

import pytest

from scripts.factory import crosspr
from scripts.factory.crosspr import Tests as CrossTests
from scripts.factory.crosspr import baseline_cache_file, worker_count
from scripts.tests.acceptance.ts17f3._world import Check, one_pr_world


def test_cloud_session_defaults_to_four_unless_overridden(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAUDE_CODE_REMOTE", "true")
    monkeypatch.delenv("VEXTRUS_VERIFY_WORKERS", raising=False)
    assert worker_count() == 4
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", "2")
    assert worker_count() == 2


def test_cache_file_is_inside_the_clone_from_a_subfolder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    deeper = tmp_path / "sub" / "deeper"
    deeper.mkdir(parents=True)
    monkeypatch.chdir(deeper)
    assert (tmp_path / ".git").resolve() in baseline_cache_file(["k"]).resolve().parents


@pytest.mark.parametrize(
    ("value", "expected"), [(None, 6), ("3", 3), ("0", 0), ("1", 1), ("auto", 6), ("", 6)]
)
def test_worker_count(monkeypatch: pytest.MonkeyPatch, value: str | None, expected: int) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)
    if value is None:
        monkeypatch.delenv("VEXTRUS_VERIFY_WORKERS", raising=False)
    else:
        monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", value)
    assert worker_count() == expected


@pytest.mark.parametrize(
    ("exits", "timed_out", "kept"),
    [([0], "", True), ([1], "", True), ([0, 1], "", True), ([2], "", False), ([-9], "", False),
     ([3], "", False), ([4], "", False), ([1], "late", False)],
)  # fmt: skip
def test_only_pass_or_failed_tests_are_kept(
    tmp_path: Path, exits: list[int], timed_out: str, kept: bool
) -> None:
    tests = CrossTests(tmp_path, tmp_path, "x")
    tests.exits, tests.timed_out = exits, timed_out
    assert tests.keepable is kept


def test_origin_main_is_read_once_per_pr(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    check = Check(one_pr_world(tmp_path), monkeypatch, capsys)
    reads: list[tuple[str, ...]] = []
    real = crosspr.git_out

    def counting(*args: str) -> str:
        reads.append(args)
        return real(*args)

    monkeypatch.setattr(crosspr, "git_out", counting)
    assert check().code == 0
    assert reads.count(("rev-parse", "origin/main")) == 1
