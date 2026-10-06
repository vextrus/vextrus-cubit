"""The READY gate's edges the acceptance tests leave: a merge of what is not main, and the usage."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from scripts.factory import ci_gate

REPO = Path(__file__).resolve().parents[3]


def _git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        [
            "git",
            "-c",
            "user.name=T",
            "-c",
            "user.email=t@example.com",
            "-c",
            "commit.gpgsign=false",
            "-C",
            str(repo),
            *args,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return done.stdout.strip()


def _commit(repo: Path, name: str, ready: bool) -> str:
    (repo / name).write_text(name)
    _git(repo, "add", name)
    message = f"{name}\n"
    if ready:
        tree = _git(repo, "write-tree")
        message += f"\nFactory-State: READY\nFactory-Verify: {tree} ok\n"
    _git(repo, "commit", "-q", "--cleanup=verbatim", "-m", message)
    return _git(repo, "rev-parse", "HEAD")


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    _git(tmp_path, "init", "-q", "-b", "main")
    _commit(tmp_path, "base", False)
    monkeypatch.chdir(tmp_path)
    return tmp_path


def test_a_merge_of_a_branch_that_is_not_main_is_not_ready(repo: Path) -> None:
    _git(repo, "switch", "-q", "-c", "feature")
    _commit(repo, "one", True)
    _git(repo, "switch", "-q", "-c", "side", "main")
    _commit(repo, "two", False)
    _git(repo, "switch", "-q", "feature")
    _git(repo, "merge", "-q", "--no-ff", "-m", "Merge side", "side")
    assert ci_gate.is_ready(_git(repo, "rev-parse", "HEAD")) is False


def test_an_octopus_merge_is_not_ready(repo: Path) -> None:
    _git(repo, "switch", "-q", "-c", "feature")
    ready = _commit(repo, "one", True)
    _git(repo, "switch", "-q", "main")
    _commit(repo, "two", False)
    _git(repo, "switch", "-q", "-c", "other", "main")
    _commit(repo, "three", False)
    _git(repo, "switch", "-q", "feature")
    _git(repo, "merge", "-q", "--no-ff", "-m", "Merge both", "main", "other")
    assert ci_gate.is_ready(ready) is True
    assert ci_gate.is_ready(_git(repo, "rev-parse", "HEAD")) is False


def test_it_takes_one_commit_and_prints_nothing_else(repo: Path) -> None:
    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.ci_gate"],
        capture_output=True,
        text=True,
        env={"PYTHONPATH": str(REPO), "GITHUB_EVENT_NAME": "pull_request", "PATH": "/usr/bin:/bin"},
        check=False,
    )
    assert done.returncode == 2
    assert done.stdout == ""
