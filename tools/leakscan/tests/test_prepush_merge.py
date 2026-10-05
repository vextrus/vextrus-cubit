"""PR #356's review round 1 (T-LEAK-HOOK): what the pre-push hook rescans after a merge of main.

A merge of main's added lines are not rescanned (the acceptance file pins that). Its file names and
binary blobs are: the scanner lists a merge's changed paths against its first parent
(`tools/leakscan/scan.py`, `scan_commit`), which is everything main changed since the branch last met it.
The contract says so (leakscan-cli.md 6, the pre-push row); it refuses more, never less. This file pins
that documented gap, so the scanner's fix (the cut issue "leakscan: a merge of main rescans main's names
and binaries") must flip these tests and the contract together.
"""

import subprocess
from pathlib import Path

import pytest

from tools.leakscan.tests.acceptance._leak import (
    MARIGOLD,
    REPO,
    ZEBRA,
    Leak,
    assert_no_text,
    commit,
    git,
    temp_repo,
)

HOOKS = REPO / "scripts/git-hooks"


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


def _push(leak: Leak, repo: Path) -> subprocess.CompletedProcess[str]:
    env = leak.env()
    env.pop("PYTHONPATH", None)
    return subprocess.run(
        ["git", "push", "origin", "feature"],
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _merged_feature(leak: Leak, main_files: dict[str, str | bytes]) -> Path:
    """`feature` pushed clean; main publishes `main_files` (past the hook); `feature` merges it."""
    remote = leak.tmp / "remote.git"
    git(leak.tmp, "init", "-q", "--bare", str(remote))
    repo, _ = temp_repo(leak.tmp / "work")
    git(repo, "remote", "add", "origin", str(remote))
    git(repo, "push", "-q", "origin", "main")
    git(repo, "fetch", "-q", "origin")
    git(repo, "config", "core.hooksPath", str(HOOKS))
    git(repo, "checkout", "-q", "-b", "feature")
    commit(repo, {"b.txt": "clean\n"}, "feat: clean")
    assert _push(leak, repo).returncode == 0
    git(repo, "checkout", "-q", "main")
    for path, data in main_files.items():
        (repo / path).parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, bytes):
            (repo / path).write_bytes(data)
        else:
            (repo / path).write_text(data)
    git(repo, "add", "--", *main_files)
    git(repo, "commit", "-q", "-m", "main: an already public commit")
    git(repo, "push", "-q", "--no-verify", "origin", "main")
    git(repo, "fetch", "-q", "origin")
    git(repo, "checkout", "-q", "feature")
    git(repo, "merge", "-q", "--no-ff", "--no-edit", "origin/main")
    return repo


def test_a_merge_of_mains_binary_blob_is_rescanned(leak: Leak) -> None:
    repo = _merged_feature(leak, {"fixtures/m.bin": b"\0\1\2" + ZEBRA.encode() + b"\0"})
    done = _push(leak, repo)
    assert done.returncode != 0
    assert_no_text(done)


def test_a_merge_of_mains_file_name_is_rescanned(leak: Leak) -> None:
    repo = _merged_feature(leak, {f"plans/{MARIGOLD}.txt": "clean\n"})
    done = _push(leak, repo)
    assert done.returncode != 0
    assert_no_text(done)


def test_a_merge_of_mains_added_line_is_not_rescanned(leak: Leak) -> None:
    repo = _merged_feature(leak, {"m.txt": f"{ZEBRA}\n"})
    done = _push(leak, repo)
    assert done.returncode == 0, done.stderr
