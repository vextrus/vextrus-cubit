"""sweep's rules with the runner injected, each tested without a repository (T-SWEEP), and review
round 1's four data-safety cases on a real git fixture."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
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
        (".private/work/session-12/scratch/wt", "scratch"),
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


# Review round 1: real git, the sweep run as a subprocess ----------------------------------------------

REPO = Path(__file__).resolve().parents[3]
NOW_TEXT = "2026-10-05T12:00:00Z"
COMMIT_DATE = "2026-10-01T09:00:00+0000"
REAL_GIT = shutil.which("git") or "git"


def _env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith(("VEXTRUS_", "GIT_"))}
    env.update(
        PYTHONPATH=str(REPO),
        VEXTRUS_NOW=NOW_TEXT,
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_CONFIG_NOSYSTEM="1",
        GIT_AUTHOR_NAME="Unit",
        GIT_AUTHOR_EMAIL="unit@example.invalid",
        GIT_COMMITTER_NAME="Unit",
        GIT_COMMITTER_EMAIL="unit@example.invalid",
        GIT_AUTHOR_DATE=COMMIT_DATE,
        GIT_COMMITTER_DATE=COMMIT_DATE,
    )
    return env


def _git(cwd: Path, *args: str) -> str:
    done = subprocess.run(
        [REAL_GIT, *args], cwd=cwd, env=_env(), capture_output=True, text=True, timeout=60, check=False
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout


def _sweep(main: Path, *args: str) -> subprocess.CompletedProcess[str]:
    tmp = main.parent / "tmpdir"
    tmp.mkdir(exist_ok=True)
    return subprocess.run(
        [sys.executable, "-m", "scripts.factory.sweep", "--repo", str(main), "--tmp", str(tmp), *args],
        cwd=main,
        env=_env(),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )


def _repo(root: Path) -> Path:
    """A bare origin and its clone `main`, whose one commit ignores `.private/` and `__pycache__/`."""
    origin, main = root / "origin.git", root / "main"
    _git(root, "init", "-q", "--bare", "-b", "main", str(origin))
    _git(root, "init", "-q", "-b", "main", str(main))
    (main / "README").write_text("the fixture\n")
    (main / ".gitignore").write_text(".private/\n__pycache__/\n")
    _git(main, "add", "README", ".gitignore")
    _git(main, "commit", "-q", "-m", "first")
    _git(main, "remote", "add", "origin", str(origin))
    _git(main, "push", "-q", "origin", "main")
    return main


def _worktree(main: Path, path: Path, branch: str | None = None) -> Path:
    where = ["-b", branch] if branch else ["--detach"]
    _git(main, "worktree", "add", "-q", *where, str(path), "origin/main")
    return path


def _age(worktree: Path, moment: float = IDLE) -> None:
    """Everything in the worktree and its git dir at `moment`, the index refreshed first: the index is
    then stale against the files' mtimes, so a `git status` that may write would rewrite it."""
    _git(worktree, "update-index", "-q", "--refresh")
    gitdir = Path(_git(worktree, "rev-parse", "--absolute-git-dir").strip())
    for top in (worktree, gitdir):
        for folder, dirs, files in os.walk(top, topdown=False):
            for name in files + dirs:
                os.utime(Path(folder) / name, (moment, moment), follow_symlinks=False)
        os.utime(top, (moment, moment))


@pytest.fixture
def main(tmp_path: Path) -> Path:
    return _repo(tmp_path.resolve())


def test_a_worktree_holding_a_dirty_nested_worktree_is_kept_with_it(main: Path) -> None:
    outer = _worktree(main, main / ".claude" / "worktrees" / "t1", branch="t1")
    inner = _worktree(main, outer / ".private" / "work" / "red" / "wt")
    (inner / "README").write_text("uncommitted\n")
    _age(inner)
    _age(outer)

    done = _sweep(main, "--apply")

    assert done.returncode == 0, done.stdout + done.stderr
    assert f"keep worktree {outer}: holds worktree {inner}" in done.stdout, done.stdout
    assert (inner / "README").read_text() == "uncommitted\n"


def test_a_stray_repository_below_a_worktree_keeps_it(main: Path) -> None:
    wt = _worktree(main, main / ".claude" / "worktrees" / "t1", branch="t1")
    (wt / "__pycache__" / "clone" / ".git").mkdir(parents=True)
    _age(wt)

    done = _sweep(main, "--apply")

    found = wt / "__pycache__" / "clone" / ".git"
    assert f"keep worktree {wt}: holds a repository at {found}" in done.stdout, done.stdout
    assert wt.is_dir()


def test_recent_ignored_notes_keep_the_worktree(main: Path) -> None:
    wt = _worktree(main, main / ".claude" / "worktrees" / "t1", branch="t1")
    notes = wt / ".private" / "work" / "t1" / "NOTES.txt"
    notes.parent.mkdir(parents=True)
    notes.write_text("progress\n")
    _age(wt)
    os.utime(notes, (CLOCK.timestamp() - 60, CLOCK.timestamp() - 60))

    done = _sweep(main, "--apply")

    assert f"keep worktree {wt}: ignored content: .private/" in done.stdout, done.stdout
    assert notes.read_text() == "progress\n"


def test_disposable_ignored_content_is_read_for_idle_time(main: Path) -> None:
    wt = _worktree(main, main / ".claude" / "worktrees" / "t1", branch="t1")
    cache = wt / "__pycache__" / "m.pyc"
    cache.parent.mkdir()
    cache.write_bytes(b"x")
    _age(wt)
    os.utime(cache, (CLOCK.timestamp() - 60, CLOCK.timestamp() - 60))

    recent = _sweep(main)
    assert f"keep worktree {wt}: recent: 0h" in recent.stdout, recent.stdout

    _age(wt)
    idle = _sweep(main, "--apply")
    assert idle.returncode == 0, idle.stdout + idle.stderr
    assert not wt.exists(), idle.stdout


def test_the_walk_checkout_is_never_picked_and_a_locked_worktree_is_kept(main: Path) -> None:
    src = _worktree(main, main / ".private" / "work" / "walks" / "_src")
    slot = _worktree(main, main / ".private" / "work" / "factory" / "review" / "slot1")
    _git(main, "worktree", "lock", str(slot))
    _age(src)
    _age(slot)

    done = _sweep(main, "--apply")

    assert done.returncode == 0, done.stdout + done.stderr
    assert f"keep worktree {src}: never swept" in done.stdout, done.stdout
    assert f"keep worktree {slot}: locked" in done.stdout, done.stdout
    assert src.is_dir()
    assert slot.is_dir()
    assert not sweep.is_candidate(MAIN, MAIN / ".private/work/walks/_src/web")


def test_a_dry_run_never_rewrites_an_index(main: Path) -> None:
    wt = _worktree(main, main / ".private" / "work" / "factory" / "review" / "slot1")
    _age(wt)
    index = Path(_git(wt, "rev-parse", "--path-format=absolute", "--git-path", "index").strip())
    before = index.stat().st_mtime_ns

    done = _sweep(main)

    assert done.returncode == 0, done.stdout + done.stderr
    assert index.stat().st_mtime_ns == before
    assert f"remove worktree {wt}" in done.stdout, done.stdout


# --old-sessions: a build folder goes only with a holder the worktree sweep would remove (#519)


def _holder_with_venv(main: Path, relative: str, branch: str | None = None) -> tuple[Path, Path]:
    (main / ".git" / "info" / "exclude").write_text(".venv/\n.claude/\n")
    tree = _worktree(main, main / relative, branch)
    venv = tree / ".venv"
    (venv / "lib").mkdir(parents=True)
    (venv / "lib" / "pkg.py").write_text("x = 1\n")
    _age(tree)
    return tree, venv


def _old_sessions(main: Path, probe_: sweep.Probe, apply: bool = True) -> sweep.Tally:
    tally = sweep.Tally()
    sweep.sweep_old_sessions(main, probe_, 1.0, apply, tally)
    return tally


def _live(main: Path, cwd: Path, cwds: Iterable[tuple[int, Path]] = ()) -> sweep.Probe:
    listed = list(cwds)
    return sweep.Probe(cwd=cwd, pid=1, cwds=lambda: listed, clock=CLOCK)


def test_old_sessions_removes_the_venv_of_a_merged_idle_worktree(main: Path) -> None:
    tree, venv = _holder_with_venv(main, ".claude/worktrees/t1", "t1")

    tally = _old_sessions(main, _live(main, main))

    assert tally.removed == 1
    assert not venv.exists()
    assert tree.is_dir()


def test_old_sessions_keeps_the_venv_of_a_worktree_a_live_process_holds(main: Path) -> None:
    _tree, venv = _holder_with_venv(main, ".claude/worktrees/t1", "t1")

    tally = _old_sessions(main, _live(main, main, [(42, _tree / "web")]))

    assert tally.removed == 0
    assert (venv / "lib" / "pkg.py").is_file()


def test_old_sessions_keeps_the_venv_of_a_review_slot(main: Path) -> None:
    _tree, venv = _holder_with_venv(main, ".claude/worktrees/rv1", "rv1")

    tally = _old_sessions(main, _live(main, main))

    assert tally.removed == 0
    assert (venv / "lib" / "pkg.py").is_file()


def test_old_sessions_keeps_the_venv_under_the_sweeps_own_cwd(main: Path) -> None:
    tree, venv = _holder_with_venv(main, ".claude/worktrees/t1", "t1")

    tally = _old_sessions(main, _live(main, tree / "web"))

    assert tally.removed == 0
    assert (venv / "lib" / "pkg.py").is_file()


def test_old_sessions_keeps_the_venv_of_an_unmerged_worktree(main: Path) -> None:
    tree, venv = _holder_with_venv(main, ".claude/worktrees/t1", "t1")
    (tree / "new.txt").write_text("work\n")
    _git(tree, "add", "new.txt")
    _git(tree, "commit", "-q", "-m", "ahead")
    _age(tree)

    tally = _old_sessions(main, _live(main, main))

    assert tally.removed == 0
    assert (venv / "lib" / "pkg.py").is_file()
