"""`sweep-remote`'s own seams beyond the acceptance pins: a branch named by a corpus string, the hits
file when empty, and exit 2 winning over exit 1."""

from __future__ import annotations

from pathlib import Path

from tools.leakscan.tests.acceptance._leak import QUILLMOOR, commit, git
from tools.leakscan.tests.acceptance.ts27sweep.test_sweep_remote import (
    BROKEN_BRANCH,
    _world,
    out_lines,
    sweep,
)

NAMED = "quillmoor-estates-fix"


def _push_named(work: Path, content: str) -> None:
    git(work, "checkout", "-q", "-b", NAMED, "main")
    commit(work, {"n.txt": content}, "feat: a clean change")
    git(work, "push", "-q", "origin", NAMED)
    git(work, "checkout", "-q", "main")


def test_a_branch_named_by_a_corpus_string_prints_an_index_never_its_name(tmp_path: Path) -> None:
    world = _world(tmp_path, hits=False)
    _push_named(world.work, "clean\n")
    done = sweep(world)
    assert done.returncode == 1, done.stdout + done.stderr
    # sorted branches: clean, quillmoor-estates-fix
    assert "ref:1 name" in out_lines(done), done.stdout
    assert "quillmoor" not in (done.stdout + done.stderr).lower()
    assert QUILLMOOR.lower() not in (done.stdout + done.stderr).lower()


def test_the_hits_file_keeps_the_real_name_of_a_named_branch(tmp_path: Path) -> None:
    world = _world(tmp_path, hits=False)
    _push_named(world.work, "clean\n")
    path = tmp_path / "hits.txt"
    sweep(world, "--hits-file", str(path))
    assert path.read_text().split() == [NAMED]


def test_the_hits_file_is_written_empty_for_a_clean_sweep(tmp_path: Path) -> None:
    world = _world(tmp_path, hits=False)
    path = tmp_path / "hits.txt"
    path.write_text("stale\n")
    done = sweep(world, "--hits-file", str(path))
    assert done.returncode == 0, done.stdout + done.stderr
    assert path.read_text() == ""


def test_exit_2_wins_over_exit_1(tmp_path: Path) -> None:
    world = _world(tmp_path, hits=True, broken=True)
    done = sweep(world)
    assert done.returncode == 2, done.stdout + done.stderr
    assert f"{BROKEN_BRANCH} cannot-scan" in out_lines(done)
    assert any(line.endswith("new.txt:3") for line in out_lines(done))


def test_an_unresolvable_main_exits_2_and_still_writes_the_hits_file(tmp_path: Path) -> None:
    world = _world(tmp_path, hits=False)
    git(world.work, "update-ref", "-d", "refs/remotes/origin/main")
    path = tmp_path / "hits.txt"
    path.write_text("stale\n")
    done = sweep(world, "--hits-file", str(path))
    assert done.returncode == 2, done.stdout + done.stderr
    assert path.read_text() == ""
