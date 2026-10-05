"""sweep's rules with the runner injected: each one tested without a repository (T-SWEEP)."""

from __future__ import annotations

import argparse
import os
import subprocess
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

import pytest

from scripts.factory import sweep

CLOCK = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)
IDLE = CLOCK.timestamp() - 3 * 24 * 3600
MAIN = Path("/repo")
SHA = "c0ffee" + "0" * 34


class FakeGit:
    """Answers git by its arguments; logs every call. `answers` maps an argument tuple's prefix to
    (exit, stdout, stderr); git paths answer with a file under `gitdir`."""

    def __init__(self, gitdir: Path, answers: dict[tuple[str, ...], tuple[int, str, str]]) -> None:
        self.gitdir = gitdir
        self.answers = answers
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
        self.calls.append(args)
        for prefix, (code, out, err) in self.answers.items():
            if args[: len(prefix)] == prefix:
                return subprocess.CompletedProcess(list(args), code, out, err)
        if args[:3] == ("rev-parse", "--path-format=absolute", "--git-path"):
            return subprocess.CompletedProcess(list(args), 0, f"{self.gitdir / args[3]}\n", "")
        return subprocess.CompletedProcess(list(args), 0, "", "")


def idle_worktree(tmp_path: Path) -> tuple[Path, Path]:
    tree = tmp_path / "wt"
    gitdir = tmp_path / "gitdir"
    (gitdir / "logs").mkdir(parents=True)
    tree.mkdir()
    for path in (gitdir / "HEAD", gitdir / "index", gitdir / "logs" / "HEAD"):
        path.write_text("x")
        os.utime(path, (IDLE, IDLE))
    os.utime(tree, (IDLE, IDLE))
    return tree, gitdir


def probe(run: FakeGit, cwds: Iterable[tuple[int, Path]] = ()) -> sweep.Probe:
    listed = list(cwds)
    return sweep.Probe(run=run, cwd=Path("/elsewhere"), pid=1, cwds=lambda: listed, clock=CLOCK)


def listing(main: Path, tree: Path, extra: str = "") -> str:
    return (
        f"worktree {main}\0HEAD {SHA}\0branch refs/heads/main\0\0"
        f"worktree {tree}\0HEAD {SHA}\0branch refs/heads/t1\0{extra}\0"
    )


def test_a_worktree_dirtied_between_plan_and_apply_is_kept(tmp_path: Path) -> None:
    main = tmp_path
    tree, gitdir = idle_worktree(tmp_path / ".claude" / "worktrees")
    statuses = iter([(0, "", ""), (0, " M README\n", "")])
    run = FakeGit(gitdir, {("worktree", "list"): (0, listing(main, tree), "")})

    def answer(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
        if args[0] == "status":
            code, out, err = next(statuses)
            run.calls.append(args)
            return subprocess.CompletedProcess(list(args), code, out, err)
        return run(repo, *args)

    p = probe(run)
    p.run = answer
    tally = sweep.Tally()
    sweep.sweep_worktrees(p, main, apply=True, tally=tally)

    assert tally.kept == 1
    assert tally.removed == 0
    assert not [call for call in run.calls if call[:2] == ("worktree", "remove")]


def test_a_git_refusal_keeps_the_worktree_and_never_forces(tmp_path: Path) -> None:
    main = tmp_path
    tree, gitdir = idle_worktree(tmp_path / ".claude" / "worktrees")
    run = FakeGit(
        gitdir,
        {
            ("worktree", "list"): (0, listing(main, tree), ""),
            ("worktree", "remove"): (128, "", "fatal: cannot remove\nmore\n"),
        },
    )
    tally = sweep.Tally()
    sweep.sweep_worktrees(probe(run), main, apply=True, tally=tally)

    removes = [call for call in run.calls if call[:2] == ("worktree", "remove")]
    assert removes == [("worktree", "remove", str(tree))]
    assert tally.failed
    assert tally.kept == 1


def test_a_failing_git_status_keeps_the_worktree_as_dirty(tmp_path: Path) -> None:
    tree, gitdir = idle_worktree(tmp_path / ".claude" / "worktrees")
    run = FakeGit(gitdir, {("status",): (128, "", "fatal: broken\n")})
    worktree = sweep.Worktree(tree, SHA, "t1")

    reason, _ = sweep.judge(probe(run), tmp_path, worktree)

    assert reason == "dirty: git status failed: fatal: broken"


def test_an_idle_merged_clean_worktree_is_removable(tmp_path: Path) -> None:
    tree, gitdir = idle_worktree(tmp_path / ".claude" / "worktrees")
    reason, detail = sweep.judge(probe(FakeGit(gitdir, {})), tmp_path, sweep.Worktree(tree, SHA, "t1"))

    assert reason is None
    assert detail == "(ticket, t1, merged, clean, idle 72h)"


def test_a_process_working_inside_is_in_use_and_the_sweeps_own_is_not(tmp_path: Path) -> None:
    tree, gitdir = idle_worktree(tmp_path / ".claude" / "worktrees")
    worktree = sweep.Worktree(tree, SHA, "t1")
    own = probe(FakeGit(gitdir, {}), cwds=[(1, tree / "deep")])
    other = probe(FakeGit(gitdir, {}), cwds=[(1, tree), (42, tree / "deep")])

    assert sweep.judge(own, tmp_path, worktree)[0] is None
    assert sweep.judge(other, tmp_path, worktree)[0] == "in use: pid 42"


def test_an_unreadable_proc_entry_is_ignored(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def listdir(path: str) -> list[str]:
        return ["self", "12", "13"]

    def readlink(path: str) -> str:
        if "12" in path:
            raise PermissionError(13, "Permission denied")
        return "/somewhere"

    monkeypatch.setattr(os, "listdir", listdir)
    monkeypatch.setattr(os, "readlink", readlink)

    assert list(sweep.proc_cwds()) == [(13, Path("/somewhere"))]


def test_a_detached_unmerged_head_names_its_sha(tmp_path: Path) -> None:
    tree, gitdir = idle_worktree(tmp_path / ".claude" / "worktrees")
    run = FakeGit(gitdir, {("merge-base",): (1, "", "")})

    reason, _ = sweep.judge(probe(run), tmp_path, sweep.Worktree(tree, SHA, None))

    assert reason == "unmerged: detached at c0ffee0"


@pytest.mark.parametrize(
    ("text", "ok"),
    [("0", True), ("24", True), ("1.5", True), ("-1", False), ("abc", False), ("nan", False)],
)
def test_hours_parsing(text: str, ok: bool) -> None:
    if ok:
        assert sweep.hours(text) == float(text)
    else:
        with pytest.raises(argparse.ArgumentTypeError):
            sweep.hours(text)


@pytest.mark.parametrize(
    ("relative", "kind"),
    [
        (".claude/worktrees/T-1", "ticket"),
        (".private/work/factory/review/slot1", "review"),
        (".private/work/session-12/review/pr-3-r1", "review"),
        (".private/work/session-12/phase4/red/r1", "red-proof"),
        (".private/work/walks/_src", "scratch"),
    ],
)
def test_kind_naming(relative: str, kind: str) -> None:
    assert sweep.kind_of(MAIN, MAIN / relative) == kind
    assert sweep.is_candidate(MAIN, MAIN / relative)


def test_the_factory_folders_themselves_and_outside_paths_are_not_candidates() -> None:
    assert not sweep.is_candidate(MAIN, MAIN / ".claude" / "worktrees")
    assert not sweep.is_candidate(MAIN, MAIN / ".private" / "work")
    assert not sweep.is_candidate(MAIN, Path("/elsewhere/wt"))
    assert not sweep.is_candidate(MAIN, MAIN / ".privateer" / "work" / "x")


def test_a_link_in_a_storage_tree_is_unlinked_not_followed(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    (outside / "dir").mkdir(parents=True)
    (outside / "dir" / "kept.txt").write_text("kept")
    top = tmp_path / "vextrus-test-storage-x"
    (top / "a" / "b").mkdir(parents=True)
    (top / "a" / "b" / "file").write_text("gone")
    (top / "a" / "to-dir").symlink_to(outside / "dir")
    (top / "to-file").symlink_to(outside / "dir" / "kept.txt")

    sweep.remove_tree(top)

    assert not top.exists()
    assert (outside / "dir" / "kept.txt").read_text() == "kept"


def test_a_link_named_like_storage_is_kept() -> None:
    reason, _ = sweep.storage_reason(Path("/proc/self/cwd"), CLOCK, 6)
    assert reason == "a link, not a folder"


def test_the_source_never_names_a_forced_or_recursive_delete() -> None:
    source = Path(sweep.__file__).read_text()
    for word in ("rmtree", '"rm"', "--force", '"-f"'):
        assert word not in source, word
