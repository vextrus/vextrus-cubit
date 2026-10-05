"""T-SWEEP's acceptance tests: `python -m scripts.factory.sweep`, the session-start sweep of stale
`vextrus-test-storage-*` folders and finished worktrees (#274).

Black box: the command runs as a subprocess against a repository built per test in `tmp_path` with real
`git` (a bare `origin.git`, a clone `main` whose `origin/main` exists), commits dated by a pinned
`GIT_*_DATE`, the clock fixed by `VEXTRUS_NOW`. "Idle" sets every mtime the sweep reads 3 days before
that clock, "recent" 1 hour. Every run names its own `--repo` and `--tmp`, so nothing outside `tmp_path`
is ever read or swept.
"""

from __future__ import annotations

import os
import re
import shutil
import signal
import subprocess
import sys
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
NOW_TEXT = "2026-10-05T12:00:00Z"
NOW = datetime(2026, 10, 5, 12, 0, tzinfo=UTC).timestamp()
IDLE = NOW - 3 * 24 * 3600
RECENT = NOW - 3600
OLDER = NOW - 4 * 24 * 3600  # the worktrees' files: older than their index, so git never rewrites it
COMMIT_DATE = "2026-10-01T09:00:00+0000"
REAL_GIT = shutil.which("git") or "git"
Snapshot = dict[str, tuple[str, bytes | str]]


def _env(extra_path: Path | None = None) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith(("VEXTRUS_", "GIT_"))}
    env.update(
        PYTHONPATH=str(REPO),
        VEXTRUS_NOW=NOW_TEXT,
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_CONFIG_NOSYSTEM="1",
        GIT_AUTHOR_NAME="Acceptance",
        GIT_AUTHOR_EMAIL="acceptance@example.invalid",
        GIT_COMMITTER_NAME="Acceptance",
        GIT_COMMITTER_EMAIL="acceptance@example.invalid",
        GIT_AUTHOR_DATE=COMMIT_DATE,
        GIT_COMMITTER_DATE=COMMIT_DATE,
    )
    if extra_path is not None:
        env["PATH"] = f"{extra_path}{os.pathsep}{env.get('PATH', '')}"
    return env


def git(cwd: Path, *args: str) -> str:
    done = subprocess.run(
        [REAL_GIT, *args],
        cwd=cwd,
        env=_env(),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=60,
        check=False,
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout


def sweep(*args: str, cwd: Path, extra_path: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "scripts.factory.sweep", *args],
        cwd=cwd,
        env=_env(extra_path),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )


def make_repo(root: Path) -> Path:
    """A bare `origin.git` and its clone `main`, one commit pushed, `origin/main` present."""
    origin = root / "origin.git"
    git(root, "init", "-q", "--bare", "-b", "main", str(origin))
    main = root / "main"
    git(root, "init", "-q", "-b", "main", str(main))
    (main / "README").write_text("the fixture\n")
    git(main, "add", "README")
    git(main, "commit", "-q", "-m", "first")
    git(main, "remote", "add", "origin", str(origin))
    git(main, "push", "-q", "origin", "main")
    git(main, "rev-parse", "--verify", "refs/remotes/origin/main")
    return main


def add_worktree(main: Path, path: Path, branch: str | None = None, at: str = "origin/main") -> Path:
    if branch is None:
        git(main, "worktree", "add", "-q", "--detach", str(path), at)
    else:
        git(main, "worktree", "add", "-q", "-b", branch, str(path), at)
    return path


def git_dir(worktree: Path) -> Path:
    return Path(git(worktree, "rev-parse", "--absolute-git-dir").strip())


def set_age(worktree: Path, moment: float) -> None:
    """Every mtime the sweep reads (the folder, its git dir's files) at `moment`; the checked-out files
    older still and the index refreshed first, so `git status` finds nothing racy to rewrite."""
    for folder, _dirs, files in os.walk(worktree):
        for name in files:
            if name != ".git":
                os.utime(Path(folder) / name, (OLDER, OLDER), follow_symlinks=False)
    subprocess.run(
        [REAL_GIT, "update-index", "-q", "--refresh"],
        cwd=worktree,
        env=_env(),
        capture_output=True,
        timeout=60,
        check=False,
    )
    gitdir = git_dir(worktree)
    for top in (gitdir, worktree):
        for folder, _dirs, files in os.walk(top, topdown=False):
            for name in files:
                if top == gitdir or name == ".git":
                    os.utime(Path(folder) / name, (moment, moment), follow_symlinks=False)
            if top == gitdir or Path(folder) == worktree:
                os.utime(folder, (moment, moment))


def snapshot(root: Path) -> Snapshot:
    """Every entry under `root` (links never followed): a file's bytes, a link's target, a folder."""
    found: Snapshot = {}
    for folder, dirs, files in os.walk(root):
        for name in dirs + files:
            path = Path(folder) / name
            key = str(path.relative_to(root))
            if path.is_symlink():
                found[key] = ("link", os.readlink(path))
            elif path.is_dir():
                found[key] = ("dir", "")
            else:
                found[key] = ("file", path.read_bytes())
    return found


def worktree_list(main: Path) -> str:
    return git(main, "worktree", "list", "--porcelain")


def paths_after(output: str, verb: str) -> set[str]:
    """The paths of the stdout lines starting `<verb> ` (`remove worktree`), cut before ` (` or `: `."""
    found = set()
    for line in output.splitlines():
        if line.startswith(verb + " "):
            rest = line[len(verb) + 1 :]
            found.add(re.split(r" \(|: ", rest, maxsplit=1)[0])
    return found


def keep_reason(output: str, path: Path) -> str | None:
    prefix = f"keep worktree {path}: "
    for line in output.splitlines():
        if line.startswith(prefix):
            return line[len(prefix) :]
    return None


def last_line(output: str) -> str:
    lines = [line for line in output.splitlines() if line.strip()]
    return lines[-1] if lines else ""


def no_traceback(done: subprocess.CompletedProcess[str]) -> None:
    assert "Traceback" not in done.stderr + done.stdout, done.stderr


@pytest.fixture
def root(tmp_path: Path) -> Path:
    return tmp_path.resolve()


@pytest.fixture
def repo(root: Path) -> Path:
    return make_repo(root)


@pytest.fixture
def empty_tmp(root: Path) -> Path:
    folder = root / "tmpdir"
    folder.mkdir()
    return folder


def finished_pair(main: Path) -> tuple[Path, Path]:
    """A merged, clean, idle ticket worktree on branch `t1` and a detached review slot at origin/main."""
    ticket = add_worktree(main, main / ".claude" / "worktrees" / "t1", branch="t1")
    slot = add_worktree(main, main / ".private" / "work" / "factory" / "review" / "slot1")
    set_age(ticket, IDLE)
    set_age(slot, IDLE)
    return ticket, slot


def main_state(main: Path) -> tuple[Snapshot, str]:
    tracked = {
        k: v
        for k, v in snapshot(main).items()
        if k.split(os.sep)[0] not in {".git", ".claude", ".private"}
    }
    return tracked, git(main, "rev-parse", "HEAD")


# W1 ---------------------------------------------------------------------------------------------------


def test_w1_a_run_without_apply_lists_the_finished_worktrees_and_removes_nothing(
    repo: Path, empty_tmp: Path
) -> None:
    ticket, slot = finished_pair(repo)
    before = (snapshot(ticket), snapshot(slot), worktree_list(repo))

    done = sweep("--repo", str(repo), "--tmp", str(empty_tmp), cwd=repo)

    assert done.returncode == 0, done.stdout + done.stderr
    assert paths_after(done.stdout, "remove worktree") == {str(ticket), str(slot)}, done.stdout
    final = last_line(done.stdout)
    assert "dry run" in final, done.stdout
    assert re.search(r"\b2 worktrees\b", final), final
    assert re.search(r"\b0 storage folders\b", final), final
    assert ticket.is_dir()
    assert slot.is_dir()
    assert (snapshot(ticket), snapshot(slot), worktree_list(repo)) == before


# W2 ---------------------------------------------------------------------------------------------------


def test_w2_apply_removes_exactly_the_finished_worktrees_and_keeps_their_branch(
    repo: Path, empty_tmp: Path
) -> None:
    ticket, slot = finished_pair(repo)
    main_before = main_state(repo)

    done = sweep("--repo", str(repo), "--tmp", str(empty_tmp), "--apply", cwd=repo)

    assert done.returncode == 0, done.stdout + done.stderr
    assert not ticket.exists(), done.stdout
    assert not slot.exists(), done.stdout
    listed = worktree_list(repo)
    assert str(ticket) not in listed
    assert str(slot) not in listed
    assert listed.count("worktree ") == 1, listed  # the main checkout alone
    git(repo, "rev-parse", "--verify", "refs/heads/t1")  # the branch is never deleted
    assert main_state(repo) == main_before


# W3 ---------------------------------------------------------------------------------------------------


def _tracked_change(main: Path, wt: Path) -> None:
    (wt / "README").write_text("changed\n")


def _staged_change(main: Path, wt: Path) -> None:
    (wt / "README").write_text("staged\n")
    git(wt, "add", "README")


def _untracked_file(main: Path, wt: Path) -> None:
    (wt / "notes.txt").write_text("left behind\n")


def _merge_head(main: Path, wt: Path) -> None:
    (git_dir(wt) / "MERGE_HEAD").write_text(git(wt, "rev-parse", "HEAD"))


def _unmerged_branch(main: Path, wt: Path) -> None:
    (wt / "work.txt").write_text("one commit\n")
    git(wt, "add", "work.txt")
    git(wt, "commit", "-q", "-m", "not in origin/main")


def _locked(main: Path, wt: Path) -> None:
    git(main, "worktree", "lock", str(wt))


KEEP_CASES: dict[str, tuple[str, str | None, Callable[[Path, Path], None], str]] = {
    # case: (where under main, branch or None for detached, the change, the reason's first word)
    "tracked change": (".claude/worktrees/t-tracked", "t-tracked", _tracked_change, "dirty"),
    "staged-only change": (".claude/worktrees/t-staged", "t-staged", _staged_change, "dirty"),
    "one untracked file": (".claude/worktrees/t-untracked", "t-untracked", _untracked_file, "dirty"),
    "MERGE_HEAD present": (".claude/worktrees/t-merging", "t-merging", _merge_head, "in progress"),
    "branch ahead of origin/main": (
        ".claude/worktrees/t-ahead",
        "t-ahead",
        _unmerged_branch,
        "unmerged",
    ),
    "detached at an unmerged commit": (
        ".private/work/session-12/phase4/red/r1",
        None,
        _unmerged_branch,
        "unmerged",
    ),
    "locked": (".private/work/factory/review/slot2", None, _locked, "locked"),
}


@pytest.mark.parametrize("case", list(KEEP_CASES))
def test_w3_a_worktree_with_work_in_it_is_kept_with_its_reason(
    case: str, repo: Path, empty_tmp: Path
) -> None:
    where, branch, change, reason = KEEP_CASES[case]
    wt = add_worktree(repo, repo / where, branch=branch)
    change(repo, wt)
    set_age(wt, IDLE)
    _assert_kept(repo, wt, reason, empty_tmp, cwd=repo)


def test_w3_a_worktree_touched_an_hour_ago_is_kept_as_recent(repo: Path, empty_tmp: Path) -> None:
    wt = add_worktree(repo, repo / ".claude" / "worktrees" / "t-fresh", branch="t-fresh")
    set_age(wt, RECENT)
    _assert_kept(repo, wt, "recent", empty_tmp, cwd=repo)


def test_w3_a_worktree_a_live_process_works_in_is_kept_as_in_use(repo: Path, empty_tmp: Path) -> None:
    wt = add_worktree(repo, repo / ".claude" / "worktrees" / "t-busy", branch="t-busy")
    (wt / "deep").mkdir()
    set_age(wt, IDLE)
    with _live_process(wt / "deep"):
        _assert_kept(repo, wt, "in use", empty_tmp, cwd=repo)


def test_w3_the_worktree_the_sweep_runs_in_is_kept_as_current(repo: Path, empty_tmp: Path) -> None:
    wt = add_worktree(repo, repo / ".claude" / "worktrees" / "t-here", branch="t-here")
    set_age(wt, IDLE)
    _assert_kept(repo, wt, "current", empty_tmp, cwd=wt)


def test_w3_a_worktree_outside_the_factory_folders_is_kept_as_outside(
    repo: Path, root: Path, empty_tmp: Path
) -> None:
    wt = add_worktree(repo, root / "elsewhere" / "wt", branch="t-elsewhere")
    set_age(wt, IDLE)
    _assert_kept(repo, wt, "outside", empty_tmp, cwd=repo)


@contextmanager
def _live_process(folder: Path) -> Iterator[subprocess.Popen[bytes]]:
    """A `sleep` whose cwd is `folder`, killed on exit."""
    process = subprocess.Popen(["sleep", "600"], cwd=folder, stdin=subprocess.DEVNULL)
    try:
        yield process
    finally:
        process.send_signal(signal.SIGKILL)
        process.wait(timeout=30)


def _assert_kept(main: Path, wt: Path, reason: str, tmp: Path, cwd: Path) -> None:
    before = (snapshot(wt), worktree_list(main))

    dry = sweep("--repo", str(main), "--tmp", str(tmp), cwd=cwd)
    applied = sweep("--repo", str(main), "--tmp", str(tmp), "--apply", cwd=cwd)

    for done in (dry, applied):
        assert done.returncode == 0, done.stdout + done.stderr
        said = keep_reason(done.stdout, wt)
        assert said is not None, f"no 'keep worktree {wt}: ...' line:\n{done.stdout}"
        assert said.startswith(reason), f"kept for {said!r}, expected {reason!r}"
        assert str(wt) not in paths_after(done.stdout, "remove worktree")
    assert wt.is_dir()
    assert (snapshot(wt), worktree_list(main)) == before


# W4 ---------------------------------------------------------------------------------------------------


def _shims(root: Path, git_body: str) -> tuple[Path, Path, Path]:
    """A folder for PATH holding `git` (`git_body`) and an `rm` that only logs; the two log files."""
    shims = root / "shims"
    shims.mkdir()
    git_log, rm_log = root / "git.log", root / "rm.log"
    (shims / "git").write_text(f"#!/bin/sh\n{git_body}\n")
    (shims / "rm").write_text(f"#!/bin/sh\nprintf '%s\\n' \"$*\" >> '{rm_log}'\nexit 1\n")
    for shim in ("git", "rm"):
        (shims / shim).chmod(0o755)
    return shims, git_log, rm_log


def _logged_calls(log: Path) -> list[list[str]]:
    if not log.exists():
        return []
    calls = log.read_text().split("\0\n")
    return [call.split("\0") for call in calls if call]


def test_w4_apply_removes_worktrees_without_force_and_never_calls_rm(
    repo: Path, root: Path, empty_tmp: Path
) -> None:
    ticket, slot = finished_pair(repo)
    log = root / "git.log"
    body = f"printf '%s\\0' \"$@\" >> '{log}'\nprintf '\\n' >> '{log}'\nexec '{REAL_GIT}' \"$@\""
    shims, git_log, rm_log = _shims(root, body)

    done = sweep("--repo", str(repo), "--tmp", str(empty_tmp), "--apply", cwd=repo, extra_path=shims)

    assert done.returncode == 0, done.stdout + done.stderr
    assert not ticket.exists(), done.stdout
    assert not slot.exists(), done.stdout
    removes = [
        call
        for call in _logged_calls(git_log)
        if "worktree" in call
        and call.index("worktree") + 1 < len(call)
        and call[call.index("worktree") + 1] == "remove"
    ]
    assert len(removes) >= 2, _logged_calls(git_log)
    for call in removes:
        assert "--force" not in call, call
        assert "-f" not in call, call
    assert not rm_log.exists(), rm_log.read_text()


# W5 ---------------------------------------------------------------------------------------------------


def test_w5_a_worktree_whose_folder_is_gone_is_pruned(repo: Path, empty_tmp: Path) -> None:
    gone = add_worktree(repo, repo / ".claude" / "worktrees" / "t-gone", branch="t-gone")
    (gone / "README").unlink()
    (gone / ".git").unlink()
    gone.rmdir()
    assert str(gone) in worktree_list(repo)

    dry = sweep("--repo", str(repo), "--tmp", str(empty_tmp), cwd=repo)

    assert dry.returncode == 0, dry.stdout + dry.stderr
    assert paths_after(dry.stdout, "prune worktree") == {str(gone)}, dry.stdout
    assert str(gone) in worktree_list(repo), "a dry run pruned"

    applied = sweep("--repo", str(repo), "--tmp", str(empty_tmp), "--apply", cwd=repo)

    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert str(gone) not in worktree_list(repo)


# W6 ---------------------------------------------------------------------------------------------------


def test_w6_without_origin_main_the_sweep_refuses_and_removes_nothing(repo: Path, root: Path) -> None:
    ticket, slot = finished_pair(repo)
    git(repo, "update-ref", "-d", "refs/remotes/origin/main")
    tmp = _plant_storage(root)
    before = (snapshot(ticket), snapshot(slot), worktree_list(repo), snapshot(tmp))

    done = sweep("--repo", str(repo), "--tmp", str(tmp), "--apply", cwd=repo)

    assert done.returncode == 2, done.stdout + done.stderr
    assert "REFUSED:" in done.stderr
    assert "origin/main" in done.stderr
    no_traceback(done)
    assert (snapshot(ticket), snapshot(slot), worktree_list(repo), snapshot(tmp)) == before


def test_w6_a_repo_that_is_not_a_repository_is_refused(root: Path, empty_tmp: Path) -> None:
    plain = root / "plain"
    plain.mkdir()

    done = sweep("--repo", str(plain), "--tmp", str(empty_tmp), cwd=root)

    assert done.returncode == 2, done.stdout + done.stderr
    assert "REFUSED:" in done.stderr
    no_traceback(done)


@pytest.mark.parametrize(
    "bad",
    [["--worktree-hours", "-1"], ["--storage-hours", "abc"], ["--no-such-flag"]],
    ids=["negative worktree hours", "storage hours not a number", "unknown flag"],
)
def test_w6_a_usage_error_exits_2(bad: list[str], repo: Path, empty_tmp: Path) -> None:
    done = sweep("--repo", str(repo), "--tmp", str(empty_tmp), *bad, cwd=repo)

    assert done.returncode == 2, done.stdout + done.stderr
    no_traceback(done)


# S1 ---------------------------------------------------------------------------------------------------


def _age_tree(top: Path, moment: float) -> None:
    for folder, dirs, files in os.walk(top, topdown=False):
        for name in files + dirs:
            os.utime(Path(folder) / name, (moment, moment), follow_symlinks=False)
    os.utime(top, (moment, moment), follow_symlinks=False)


def _plant_storage(root: Path) -> Path:
    """`<root>/tmpdir` with one stale storage folder and five entries that must survive."""
    outside = root / "outside"
    (outside / "dir").mkdir(parents=True)
    (outside / "target.txt").write_text("the link's target\n")
    (outside / "dir" / "kept.txt").write_text("an outside folder\n")
    _age_tree(outside, IDLE)

    tmp = root / "tmpdir"
    old = tmp / "vextrus-test-storage-old"
    (old / "media" / "nested").mkdir(parents=True)
    (old / "media" / "nested" / "upload.bin").write_bytes(b"\x00stored\x01")
    (old / "top.txt").write_text("a file\n")
    (old / "media" / "outside-link").symlink_to(outside / "target.txt")
    _age_tree(old, IDLE)

    new = tmp / "vextrus-test-storage-new"
    new.mkdir()
    (new / "upload.bin").write_bytes(b"new")
    _age_tree(new, RECENT)

    oldtop = tmp / "vextrus-test-storage-oldtop"
    (oldtop / "media").mkdir(parents=True)
    (oldtop / "media" / "upload.bin").write_bytes(b"written an hour ago")
    _age_tree(oldtop, IDLE)
    os.utime(oldtop / "media" / "upload.bin", (RECENT, RECENT))

    scratch = tmp / "scratch-old"
    scratch.mkdir()
    (scratch / "file.txt").write_text("another prefix\n")
    _age_tree(scratch, IDLE)

    plain_file = tmp / "vextrus-test-storage-file"
    plain_file.write_text("a file, not a folder\n")
    os.utime(plain_file, (IDLE, IDLE))

    link = tmp / "vextrus-test-storage-link"
    link.symlink_to(outside / "dir")
    os.utime(link, (IDLE, IDLE), follow_symlinks=False)
    os.utime(tmp, (IDLE, IDLE))
    return tmp


def test_s1_only_an_idle_storage_folder_is_listed_and_a_dry_run_removes_nothing(
    repo: Path, root: Path
) -> None:
    tmp = _plant_storage(root)
    before = (snapshot(tmp), snapshot(root / "outside"))

    done = sweep("--repo", str(repo), "--tmp", str(tmp), cwd=repo)

    assert done.returncode == 0, done.stdout + done.stderr
    assert paths_after(done.stdout, "remove storage") == {str(tmp / "vextrus-test-storage-old")}, (
        done.stdout
    )
    assert (snapshot(tmp), snapshot(root / "outside")) == before


def test_s1_apply_removes_the_idle_storage_folder_whole_and_follows_no_link(
    repo: Path, root: Path
) -> None:
    tmp = _plant_storage(root)
    old = tmp / "vextrus-test-storage-old"
    others = {k: v for k, v in snapshot(tmp).items() if k.split(os.sep)[0] != old.name}
    outside = snapshot(root / "outside")

    done = sweep("--repo", str(repo), "--tmp", str(tmp), "--apply", cwd=repo)

    assert done.returncode == 0, done.stdout + done.stderr
    assert not old.exists(), done.stdout
    assert not old.is_symlink(), done.stdout
    assert snapshot(tmp) == others
    assert snapshot(root / "outside") == outside


# S2 ---------------------------------------------------------------------------------------------------


def test_s2_a_second_apply_has_nothing_to_sweep(repo: Path, root: Path) -> None:
    finished_pair(repo)
    tmp = root / "tmpdir"
    stale = tmp / "vextrus-test-storage-stale"
    (stale / "media").mkdir(parents=True)
    (stale / "media" / "upload.bin").write_bytes(b"stale")
    _age_tree(stale, IDLE)

    first = sweep("--repo", str(repo), "--tmp", str(tmp), "--apply", cwd=repo)
    assert first.returncode == 0, first.stdout + first.stderr
    assert not stale.exists()

    second = sweep("--repo", str(repo), "--tmp", str(tmp), "--apply", cwd=repo)

    assert second.returncode == 0, second.stdout + second.stderr
    assert "nothing to sweep" in second.stdout, second.stdout


def test_s2_only_storage_never_runs_git(repo: Path, root: Path) -> None:
    tmp = root / "tmpdir"
    stale = tmp / "vextrus-test-storage-stale"
    stale.mkdir(parents=True)
    (stale / "upload.bin").write_bytes(b"stale")
    _age_tree(stale, IDLE)
    marker = root / "git-was-called"
    shims, _git_log, rm_log = _shims(root, f"touch '{marker}'\nexit 1")

    done = sweep(
        "--only",
        "storage",
        "--repo",
        str(repo),
        "--tmp",
        str(tmp),
        "--apply",
        cwd=root,
        extra_path=shims,
    )

    assert done.returncode == 0, done.stdout + done.stderr
    assert not marker.exists(), "git ran under --only storage"
    assert not rm_log.exists()
    assert not stale.exists(), done.stdout


def test_s2_only_worktrees_never_lists_or_removes_storage(repo: Path, root: Path) -> None:
    ticket, _slot = finished_pair(repo)
    tmp = root / "tmpdir"
    stale = tmp / "vextrus-test-storage-stale"
    stale.mkdir(parents=True)
    (stale / "upload.bin").write_bytes(b"stale")
    _age_tree(stale, IDLE)

    dry = sweep("--only", "worktrees", "--repo", str(repo), "--tmp", str(tmp), cwd=repo)
    applied = sweep("--only", "worktrees", "--repo", str(repo), "--tmp", str(tmp), "--apply", cwd=repo)

    for done in (dry, applied):
        assert done.returncode == 0, done.stdout + done.stderr
        assert not [
            line for line in done.stdout.splitlines() if re.match(r"(remove|keep) storage ", line)
        ]
    assert stale.is_dir()
    assert not ticket.exists(), applied.stdout
