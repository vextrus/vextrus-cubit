"""S21-MR: `python -m tools.leakscan pr <n>` scans a PR of any size, all of it.

GitHub refuses `gh pr diff` over 20000 lines (HTTP 406 too_large) and gh reads one page of a PR's files
and commits, so `merge_ready`'s default scan cut a big PR short or could not scan it at all. The scan
takes the net diff, the file names and the commits from git, after fetching `refs/pull/<n>/head` and the
base: `git diff <base>...<head>`, its names uncapped, every commit of `<base>..<head>`; gh is used only
for the title, body, branch, comments, reviews and review comments (and the head and base shas). A fetch
failure is `cannot-scan gh-failed` (the contract's word for a PR commit the clone cannot get), never a
crash. Hits print as leakscan-cli.md 5 prints them, never the text.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from tools.leakscan.tests.acceptance._leak import Leak, assert_no_text, hits
from tools.leakscan.tests.acceptance.ts21mr import _world as w


def run_pr(
    leak: Leak, pr: int, cwd: Path, stub: Path, world_file: Path, **extra: str
) -> subprocess.CompletedProcess[str]:
    env = leak.env(path_prefix=stub)
    env.update(S21MR_GH_WORLD=str(world_file), S21MR_GH_LOG=str(leak.tmp / "gh-calls.log"), **extra)
    return subprocess.run(
        [sys.executable, "-m", "tools.leakscan", "pr", str(pr)],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.fixture(scope="module")
def big(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    """One scan of the 150-file, 300-commit PR from a clone, gh refusing its diff."""
    root = tmp_path_factory.mktemp("big")
    leak = Leak(root)
    leak.build()
    shas = w.build(root / "world")
    stub, world_file = root / "bin", root / "gh-world.json"
    w.install(stub, world_file, shas)
    work = w.clone(shas["hub"], root / "work")
    done = run_pr(leak, w.PR, work, stub, world_file)
    return {"leak": leak, "shas": shas, "done": done, "work": work, "stub": stub, "world": world_file}


def wheres(big: dict[str, Any]) -> list[str]:
    done = big["done"]
    assert done.returncode == 1, done.stdout + done.stderr
    return [where for where, _ in hits(done)]


def test_a_leak_in_the_150th_files_added_line_is_a_hit(big: dict[str, Any]) -> None:
    assert f"{w.FILE_150}:{w.LINES}" in wheres(big)


def test_a_leak_in_a_file_name_past_the_hundredth_is_a_hit(big: dict[str, Any]) -> None:
    assert any(where.startswith("name:") for where in wheres(big))


def test_a_leak_in_the_300th_commit_message_is_a_hit(big: dict[str, Any]) -> None:
    sha = big["shas"]["commits"][w.COMMITS - 1]
    assert f"commit:{sha[:12]}:3" in wheres(big)


def test_a_commit_of_mains_before_the_fork_is_not_the_prs(big: dict[str, Any]) -> None:
    fork = big["shas"]["fork"][:12]
    assert not any(where.startswith(f"commit:{fork}:") for where in wheres(big))


def test_title_body_branch_comments_reviews_and_review_comments_are_still_scanned(
    big: dict[str, Any],
) -> None:
    found = wheres(big)
    assert f"pr:{w.PR}:title" in found
    assert f"pr:{w.PR}:body:2" in found
    assert f"pr:{w.PR}:branch" in found
    assert f"pr:{w.PR}:comment:1001:3" in found
    assert f"pr:{w.PR}:comment:2002:2" in found
    assert f"pr:{w.PR}:comment:3003:2" in found


def test_the_big_scan_prints_no_text_and_writes_no_stamp(big: dict[str, Any]) -> None:
    wheres(big)
    assert big["leak"].stamps() == []
    assert_no_text(big["done"])


def test_a_pull_ref_the_clone_cannot_fetch_cannot_scan_and_does_not_crash(
    big: dict[str, Any], tmp_path: Path
) -> None:
    """PR 8 has no `refs/pull/8/head` on the hub."""
    work = w.clone(big["shas"]["hub"], tmp_path / "work")
    done = run_pr(big["leak"], 8, work, big["stub"], big["world"])
    assert done.returncode == 2, done.stdout + done.stderr
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan gh-failed"
    assert "Traceback" not in done.stderr


def test_outside_a_clone_the_pr_cannot_scan_even_when_gh_gives_a_small_diff(
    big: dict[str, Any], tmp_path: Path
) -> None:
    """The diff, names and commits come from git; with no clone to fetch into there are none."""
    outside = tmp_path / "not-a-clone"
    outside.mkdir()
    env = {"S21MR_DIFF_OK": "1", "GIT_CEILING_DIRECTORIES": str(tmp_path)}
    done = run_pr(big["leak"], w.PR, outside, big["stub"], big["world"], **env)
    assert done.returncode == 2, done.stdout + done.stderr
    assert done.stdout.strip().splitlines()[-1] == "leakscan: cannot-scan gh-failed"
    assert "Traceback" not in done.stderr
    assert os.listdir(outside) == []
