"""S27-SWEEP (issue #836): `python -m tools.leakscan sweep-remote` sweeps every origin branch.

Issue #836: "a committed command (e.g. `uv run python -m tools.leakscan sweep-remote`) that range-scans
every origin branch against main and prints branch and file:line only (never the text), so the owner can
delete the hit branches". The ticket: every `refs/remotes/origin/*` but HEAD and main, commit by commit
(`scan.scan_range`, `--ref` the branch name); a hit prints `<branch> <file>:<line>`, then one summary
line; exit 1 with a hit, 0 with none, 2 when a branch cannot be scanned (naming it); `--hits-file <path>`
writes the hit branches (no `origin/`) one per line; a branch sharing no history with main is scanned in
full (`rev-list main..<branch>`); no leak stamp is written.

The world is a bare `origin.git` and a `work` clone of it (the command's current directory). Every
corpus string is an invented one of `_leak.py`; corpus and home are the test seam's, in `tmp_path`.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import pytest

from tools.leakscan.tests.acceptance._leak import (
    COPPERFIELD,
    INDIGO,
    LITERALS,
    MARIGOLD,
    SAFFRON,
    WORDS,
    ZEBRA,
    Leak,
    assert_no_text,
    commit,
    git,
    normalise,
)

HIT_BRANCH = "feature/hit"
UNDO_BRANCH = "s15-undo"
LONE_BRANCH = "lone"
CLEAN_BRANCH = "clean"
LOCAL_BRANCH = "local-only"
BROKEN_BRANCH = "s16-gone"

HIT_LINES = {
    f"{HIT_BRANCH} new.txt:3",
    f"{UNDO_BRANCH} notes.txt:2",
    f"{LONE_BRANCH} lone.txt:2",
}
HIT_BRANCHES = {HIT_BRANCH, UNDO_BRANCH, LONE_BRANCH}


@dataclass
class World:
    leak: Leak
    work: Path


def _world(tmp: Path, *, hits: bool, broken: bool = False) -> World:
    """origin.git and its clone `work`. Origin's main is one commit ahead of the clone's local main, that
    commit holding a corpus string (so scanning main, or against the local main, would show it). Every
    branch forks from the older main. With `hits`: a branch adding a corpus string, a branch adding one
    and removing it in its next commit, a branch sharing no history with main, and a local branch with
    a corpus string never pushed. Always: a clean branch. With `broken`: an origin ref that is no
    commit (it cannot be scanned)."""
    leak = Leak(tmp)
    leak.build()
    bare = tmp / "origin.git"
    git(tmp, "init", "-q", "--bare", "-b", "main", str(bare))
    git(tmp, "clone", "-q", str(bare), "work")
    work = tmp / "work"
    git(work, "symbolic-ref", "HEAD", "refs/heads/main")
    commit(work, {"docs/a.md": "a clean first line\n"}, "base: the first commit")
    git(work, "push", "-q", "origin", "main")
    commit(work, {"docs/later.md": f"one\n{SAFFRON}\n"}, "docs: main moves on")
    git(work, "push", "-q", "origin", "main")
    git(work, "reset", "-q", "--hard", "HEAD~1")
    git(work, "remote", "set-head", "origin", "main")

    git(work, "checkout", "-q", "-b", CLEAN_BRANCH, "main")
    commit(work, {"b.txt": "clean\n"}, "feat: a clean change")
    git(work, "push", "-q", "origin", CLEAN_BRANCH)

    if hits:
        git(work, "checkout", "-q", "-b", HIT_BRANCH, "main")
        commit(work, {"new.txt": f"alpha\nbeta\n{ZEBRA}\n"}, "feat: a clean message")
        git(work, "push", "-q", "origin", HIT_BRANCH)

        git(work, "checkout", "-q", "-b", UNDO_BRANCH, "main")
        commit(work, {"notes.txt": f"one\n{COPPERFIELD}\n"}, "feat: notes")
        commit(work, {"notes.txt": "one\n"}, "fix: notes trimmed")
        git(work, "push", "-q", "origin", UNDO_BRANCH)

        git(work, "checkout", "-q", "main")
        git(work, "checkout", "-q", "--orphan", LONE_BRANCH)
        commit(work, {"lone.txt": f"first\n{MARIGOLD}\n"}, "init: a history of its own")
        git(work, "push", "-q", "origin", LONE_BRANCH)

        git(work, "checkout", "-q", "-b", LOCAL_BRANCH, "main")
        commit(work, {"local.txt": f"{INDIGO}\n"}, "wip: never pushed")

    if broken:
        tree = git(work, "rev-parse", "main^{tree}")
        git(work, "update-ref", f"refs/remotes/origin/{BROKEN_BRANCH}", tree)

    git(work, "checkout", "-q", "main")
    return World(leak, work)


def sweep(world: World, *args: str) -> subprocess.CompletedProcess[str]:
    done = world.leak.run("sweep-remote", *args, cwd=world.work)
    assert done.returncode != 64, "tools.leakscan has no sweep-remote command: " + done.stderr.strip()
    return done


def out_lines(done: subprocess.CompletedProcess[str]) -> list[str]:
    return [line.strip() for line in done.stdout.splitlines() if line.strip()]


def names(done: subprocess.CompletedProcess[str], branch: str) -> list[str]:
    """The stdout lines that start with `branch` (bare or as `origin/<branch>`)."""
    return [
        line
        for line in out_lines(done)
        if line.startswith((f"{branch} ", f"origin/{branch} ", f"{branch}:", f"origin/{branch}:"))
    ]


@pytest.fixture
def hit_world(tmp_path: Path) -> World:
    return _world(tmp_path, hits=True)


@pytest.fixture
def clean_world(tmp_path: Path) -> World:
    return _world(tmp_path, hits=False)


# ---------------------------------------------------------------- what it prints


def test_a_branch_adding_a_corpus_string_is_reported_as_branch_and_file_line(hit_world: World) -> None:
    done = sweep(hit_world)
    assert f"{HIT_BRANCH} new.txt:3" in out_lines(done), done.stdout


def test_the_output_never_holds_the_matched_text(hit_world: World) -> None:
    done = sweep(hit_world)
    assert_no_text(done)


def test_a_string_added_then_removed_on_a_branch_is_still_reported(hit_world: World) -> None:
    # Commit by commit: the branch's net diff is clean, its first commit is not.
    done = sweep(hit_world)
    assert f"{UNDO_BRANCH} notes.txt:2" in out_lines(done), done.stdout


def test_a_branch_sharing_no_history_with_main_is_scanned_in_full(hit_world: World) -> None:
    done = sweep(hit_world)
    assert f"{LONE_BRANCH} lone.txt:2" in out_lines(done), done.stdout


def test_a_clean_branch_is_not_reported(hit_world: World) -> None:
    done = sweep(hit_world)
    assert names(done, CLEAN_BRANCH) == []


def test_main_and_head_are_skipped(hit_world: World) -> None:
    # Origin's main holds a corpus string one commit past the clone's main: scanning it shows it.
    done = sweep(hit_world)
    assert names(done, "main") == []
    assert names(done, "HEAD") == []


def test_a_local_branch_never_pushed_is_not_scanned(hit_world: World) -> None:
    done = sweep(hit_world)
    assert names(done, LOCAL_BRANCH) == []


def test_the_hits_print_as_branch_file_line_and_one_summary_line(hit_world: World) -> None:
    done = sweep(hit_world)
    lines = out_lines(done)
    assert {line for line in lines if line in HIT_LINES} == HIT_LINES, done.stdout
    assert len(lines) == len(HIT_LINES) + 1, done.stdout


def test_a_clean_sweep_prints_one_summary_line(clean_world: World) -> None:
    done = sweep(clean_world)
    assert len(out_lines(done)) == 1, done.stdout


# ---------------------------------------------------------------- exit codes


def test_a_sweep_with_a_hit_exits_1(hit_world: World) -> None:
    done = sweep(hit_world)
    assert done.returncode == 1, done.stdout + done.stderr


def test_a_sweep_with_no_hit_exits_0(clean_world: World) -> None:
    done = sweep(clean_world)
    assert done.returncode == 0, done.stdout + done.stderr


def test_a_branch_that_cannot_be_scanned_exits_2_naming_it(tmp_path: Path) -> None:
    world = _world(tmp_path, hits=False, broken=True)
    done = sweep(world)
    assert done.returncode == 2, done.stdout + done.stderr
    assert BROKEN_BRANCH in done.stdout + done.stderr


# ---------------------------------------------------------------- --hits-file


def test_the_hits_file_lists_exactly_the_hit_branches_without_origin(hit_world: World) -> None:
    path = hit_world.leak.tmp / "hits.txt"
    done = sweep(hit_world, "--hits-file", str(path))
    assert done.returncode == 1, done.stdout + done.stderr
    listed = [line.strip() for line in path.read_text().splitlines() if line.strip()]
    assert sorted(listed) == sorted(HIT_BRANCHES)
    text = path.read_text()
    for word in WORDS:
        assert word not in text.upper()
    for literal in LITERALS:
        assert normalise(literal) not in normalise(text)


# ---------------------------------------------------------------- no leak stamps


def test_a_sweep_with_hits_writes_no_leak_stamp(hit_world: World) -> None:
    sweep(hit_world)
    assert hit_world.leak.stamps() == []


def test_a_clean_sweep_writes_no_leak_stamp(clean_world: World) -> None:
    done = sweep(clean_world)
    assert done.returncode == 0, done.stdout + done.stderr
    assert clean_world.leak.stamps() == []
