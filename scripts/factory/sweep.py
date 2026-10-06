"""The session-start sweep of stale `vextrus-test-storage-*` folders and finished worktrees (#274).

    python -m scripts.factory.sweep [--apply] [--only storage|worktrees] [--repo PATH] [--tmp DIR]
                                    [--worktree-hours N] [--storage-hours N]

    python -m scripts.factory.sweep --old-sessions [--days N] [--apply] [--repo PATH]

`--old-sessions` is its own mode: it lists (and with `--apply` removes) each `.venv` and `node_modules`
folder whose newest entry is older than `--days` (default 14), found only under
`<main>/.claude/worktrees/` and `<main>/.private/work/`, links never followed. The folder holding one
stays; nothing else is touched. A build folder is a candidate only when the worktree holding it would
itself be removed by the worktree sweep (`judge`: not current, not in use, not locked, merged, clean,
idle `--worktree-hours`); a scratch folder with no worktree must be neither the cwd's nor in use;
review slots (`rv<N>`, `slot<N>`) are never candidates.

A dry run is the default: it prints `remove ...`, `keep ...: <reason>` and `prune ...` lines and removes
nothing; `--apply` acts on them. A linked worktree under `<main>/.claude/worktrees/` or
`<main>/.private/work/` is removed only when it is unlocked, not the sweep's own, no live process works
in it, no merge, rebase, cherry-pick or revert is in progress, `git status` is empty, its HEAD is in
`origin/main`, and nothing it holds moved in `--worktree-hours` (default 24). Removal is `git worktree
remove` and nothing stronger; a branch is never deleted. A storage folder is a real directory directly in
`--tmp`, owned by this user, its newest entry older than `--storage-hours` (default 6); it is removed
file by file, links never followed.

`--repo` defaults to the main checkout of the cwd; `--tmp` to `tempfile.gettempdir()`. Exit 0 when done,
1 when git refused a removal, 2 on a usage error or a refusal (`REFUSED:` on stderr): no `origin/main`
ref (never fetched: a stale ref only keeps more), or `--repo` not a repository.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from scripts.factory import status

STORAGE_PREFIX = "vextrus-test-storage-"
IN_PROGRESS = ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply")
GIT_TIMEOUT = 120
# A hook's environment can point git elsewhere; `-C` must decide the repository alone.
GIT_ENV_DROP = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR")
# Ignored folders a worktree may lose with nothing of value in them; any other ignored content keeps it.
DISPOSABLE = frozenset(
    {".venv", "node_modules", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
)
# G1's walk checkout, reused and never deleted (`scripts/walk/run.py`).
NEVER = (Path(".private") / "work" / "walks" / "_src",)

Runner = Callable[..., subprocess.CompletedProcess[str]]


class Refused(Exception):
    """The sweep will not run: printed as `REFUSED: <reason>`, exit 2."""


def git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    """The single runner: `git --no-optional-locks -C <repo> <args>`, no shell, never raising on a
    non-zero exit. No optional locks: a read never refreshes and rewrites a worktree's index."""
    env = {k: v for k, v in os.environ.items() if k not in GIT_ENV_DROP}
    try:
        return subprocess.run(
            ["git", "--no-optional-locks", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            env=env,
            timeout=GIT_TIMEOUT,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return subprocess.CompletedProcess(["git", *args], 127, "", str(error))


def proc_cwds() -> Iterator[tuple[int, Path]]:
    """Every live process's cwd from `/proc` (Linux); an entry that cannot be read is skipped."""
    try:
        names = os.listdir("/proc")
    except OSError:
        return
    for name in names:
        if not name.isdigit():
            continue
        try:
            yield int(name), Path(os.readlink(f"/proc/{name}/cwd"))
        except OSError:
            continue


def inside(path: Path, folder: Path) -> bool:
    return path == folder or folder in path.parents


def hours_since(moment: float, clock: datetime) -> float:
    return (clock.timestamp() - moment) / 3600


# Worktrees --------------------------------------------------------------------------------------------


@dataclass
class Worktree:
    path: Path
    head: str = ""
    branch: str | None = None
    locked: bool = False
    prunable: bool = False


def parse_worktrees(text: str) -> list[Worktree]:
    """`git worktree list --porcelain -z`: NUL-ended lines, an empty one between entries."""
    found: list[Worktree] = []
    current: Worktree | None = None
    for line in text.split("\0"):
        if not line:
            current = None
            continue
        word, _, value = line.partition(" ")
        if word == "worktree":
            current = Worktree(Path(value))
            found.append(current)
        elif current is None:
            continue
        elif word == "HEAD":
            current.head = value
        elif word == "branch":
            current.branch = value.removeprefix("refs/heads/")
        elif word == "locked":
            current.locked = True
        elif word == "prunable":
            current.prunable = True
    return found


def kind_of(main: Path, path: Path) -> str:
    if inside(path, main / ".claude" / "worktrees"):
        return "ticket"
    parts = path.relative_to(main).parts if inside(path, main) else path.parts
    if "review" in parts:
        return "review"
    if "red" in parts:
        return "red-proof"
    return "scratch"


def is_candidate(main: Path, path: Path) -> bool:
    homes = (main / ".claude" / "worktrees", main / ".private" / "work")
    if any(inside(path, main / never) for never in NEVER):
        return False
    return any(path != home and inside(path, home) for home in homes)


@dataclass
class Probe:
    """What a worktree's checks read, injectable so each rule is tested without a repository."""

    run: Runner = git
    cwd: Path = field(default_factory=lambda: Path.cwd().resolve())
    pid: int = field(default_factory=os.getpid)
    cwds: Callable[[], Iterable[tuple[int, Path]]] = proc_cwds
    clock: datetime = field(default_factory=status.now)
    hours: float = 24.0

    def current(self, path: Path) -> str | None:
        return "current" if inside(self.cwd, path) else None

    def in_use(self, path: Path) -> str | None:
        for pid, cwd in self.cwds():
            if pid != self.pid and inside(cwd, path):
                return f"in use: pid {pid}"
        return None

    def in_progress(self, path: Path) -> str | None:
        for name in IN_PROGRESS:
            done = self.run(path, "rev-parse", "--path-format=absolute", "--git-path", name)
            if done.returncode != 0 or not done.stdout.strip():
                return f"in progress: git-path {name} unreadable"
            if os.path.lexists(done.stdout.strip()):
                return f"in progress: {name}"
        return None

    def dirty(self, path: Path) -> str | None:
        done = self.run(path, "status", "--porcelain", "--untracked-files=all")
        if done.returncode != 0:
            return f"dirty: git status failed: {first_line(done.stderr)}"
        if done.stdout.strip():
            return f"dirty: {len(done.stdout.splitlines())} changed"
        return None

    def unmerged(self, path: Path, tree: Worktree) -> str | None:
        done = self.run(path, "merge-base", "--is-ancestor", "HEAD", "refs/remotes/origin/main")
        if done.returncode == 0:
            return None
        if tree.branch is None:
            return f"unmerged: detached at {tree.head[:7]}"
        ahead = self.run(path, "rev-list", "--count", "refs/remotes/origin/main..HEAD")
        count = ahead.stdout.strip() if ahead.returncode == 0 else "?"
        return f"unmerged: {count} ahead"

    def ignored(self, path: Path) -> str | None:
        """Ignored content `git worktree remove` would delete unasked, outside the disposable set."""
        done = self.run(
            path, "ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory"
        )
        if done.returncode != 0:
            return f"ignored content unreadable: {first_line(done.stderr)}"
        kept = [
            entry
            for entry in done.stdout.split("\0")
            if entry and not DISPOSABLE.intersection(Path(entry).parts)
        ]
        if kept:
            more = f" and {len(kept) - 3} more" if len(kept) > 3 else ""
            return f"ignored content: {', '.join(kept[:3])}{more}"
        return None

    def newest(self, path: Path) -> float:
        """The newest mtime in the worktree (every entry, ignored ones too, links not followed) and
        of `<gitdir>/HEAD`, `index` and `logs/HEAD`."""
        times = [newest_in_tree(path)]
        for name in ("HEAD", "index", "logs/HEAD"):
            done = self.run(path, "rev-parse", "--path-format=absolute", "--git-path", name)
            if done.returncode != 0:
                return self.clock.timestamp()  # unreadable: count it as touched now, so it is kept
            try:
                times.append(Path(done.stdout.strip()).stat().st_mtime)
            except OSError:
                continue
        return max(times)

    def recheck(self, path: Path) -> str | None:
        """The checks `--apply` repeats immediately before a removal."""
        return (
            self.current(path)
            or self.in_use(path)
            or nested(path, ())
            or self.dirty(path)
            or self.ignored(path)
        )


def nested(path: Path, others: Iterable[Path]) -> str | None:
    """A worktree holding another listed worktree, or any `.git` below its own top: removing it would
    take the inner one with it, whatever state that one is in."""
    for other in others:
        if other != path and inside(other, path):
            return f"holds worktree {other}"
    try:
        found = git_below(path)
    except OSError as error:
        return f"unreadable: {error.strerror}"
    return f"holds a repository at {found}" if found is not None else None


def git_below(top: Path) -> Path | None:
    """The first `.git` file or folder under `top` other than its own, walked without following links."""
    stack = [top]
    while stack:
        folder = stack.pop()
        with os.scandir(folder) as entries:
            for entry in entries:
                if entry.name == ".git" and folder != top:
                    return Path(entry.path)
                if entry.is_dir(follow_symlinks=False) and entry.name != ".git":
                    stack.append(Path(entry.path))
    return None


def judge(
    probe: Probe, main: Path, tree: Worktree, others: Iterable[Path] = ()
) -> tuple[str | None, str]:
    """(the first failing rule's reason, or None when removable; the detail of a removable one).
    `others` are every listed worktree's paths, the main checkout's and the prunable ones' included."""
    path = tree.path
    if any(inside(path, main / never) for never in NEVER):
        return "never swept: G1's walk checkout", ""
    if not is_candidate(main, path):
        return "outside", ""
    if tree.locked:
        return "locked", ""
    reason = probe.current(path) or probe.in_use(path) or nested(path, others)
    if reason:
        return reason, ""
    reason = probe.in_progress(path) or probe.dirty(path) or probe.unmerged(path, tree)
    reason = reason or probe.ignored(path)
    if reason:
        return reason, ""
    try:
        moment = probe.newest(path)
    except OSError as error:
        return f"unreadable: {error.strerror}", ""
    idle = hours_since(moment, probe.clock)
    if idle < probe.hours:
        return f"recent: {int(idle)}h", ""
    head = tree.branch if tree.branch is not None else f"detached {tree.head[:7]}"
    return None, f"({kind_of(main, path)}, {head}, merged, clean, idle {int(idle)}h)"


@dataclass
class Tally:
    removed: int = 0
    kept: int = 0
    stored: int = 0
    failed: bool = False

    def say(self, line: str) -> None:
        print(line, flush=True)


def sweep_worktrees(probe: Probe, main: Path, apply: bool, tally: Tally) -> None:
    listed = probe.run(main, "worktree", "list", "--porcelain", "-z")
    if listed.returncode != 0:
        raise Refused(f"git worktree list failed: {first_line(listed.stderr)}")
    every = parse_worktrees(listed.stdout)
    paths = [tree.path for tree in every]
    trees = every[1:]  # the first entry is the main checkout
    prunable = [tree for tree in trees if tree.prunable]
    for tree in prunable:
        tally.say(f"prune worktree {tree.path}")
        tally.removed += 1
    if apply and prunable:
        done = probe.run(main, "worktree", "prune")
        if done.returncode != 0:
            tally.say(f"keep worktree prune: git refused: {first_line(done.stderr)}")
            tally.failed = True
    for tree in trees:
        if tree.prunable:
            continue
        reason, detail = judge(probe, main, tree, paths)
        if reason is None and apply:
            reason = probe.recheck(tree.path)
        if reason is not None:
            tally.say(f"keep worktree {tree.path}: {reason}")
            tally.kept += 1
            continue
        if apply:
            done = probe.run(main, "worktree", "remove", str(tree.path))
            if done.returncode != 0:
                tally.say(f"keep worktree {tree.path}: git refused: {first_line(done.stderr)}")
                tally.kept += 1
                tally.failed = True
                continue
        tally.say(f"remove worktree {tree.path} {detail}")
        tally.removed += 1


# Storage ----------------------------------------------------------------------------------------------


def newest_in_tree(top: Path) -> float:
    """The newest mtime in the tree under `top`, walked without following a link."""
    newest = top.lstat().st_mtime
    stack = [top]
    while stack:
        with os.scandir(stack.pop()) as entries:
            for entry in entries:
                newest = max(newest, entry.stat(follow_symlinks=False).st_mtime)
                if entry.is_dir(follow_symlinks=False):
                    stack.append(Path(entry.path))
    return newest


def remove_tree(top: Path) -> None:
    """Bottom-up and by name: every file and link unlinked (never followed), each emptied folder
    removed, the top last."""
    stack: list[tuple[Path, bool]] = [(top, False)]
    while stack:
        folder, emptied = stack.pop()
        if emptied:
            os.rmdir(folder)
            continue
        stack.append((folder, True))
        with os.scandir(folder) as entries:
            for entry in entries:
                if entry.is_dir(follow_symlinks=False):
                    stack.append((Path(entry.path), False))
                else:
                    os.unlink(entry.path)


def storage_reason(path: Path, clock: datetime, hours: float) -> tuple[str | None, float]:
    try:
        info = path.lstat()
    except OSError as error:
        return f"unreadable: {error.strerror}", 0.0
    if stat.S_ISLNK(info.st_mode):
        return "a link, not a folder", 0.0
    if not stat.S_ISDIR(info.st_mode):
        return "not a folder", 0.0
    if info.st_uid != os.getuid():
        return f"owned by uid {info.st_uid}", 0.0
    try:
        idle = hours_since(newest_in_tree(path), clock)
    except OSError as error:
        return f"unreadable: {error.strerror}", 0.0
    if idle < hours:
        return f"recent: {int(idle)}h", idle
    return None, idle


def sweep_storage(tmp: Path, clock: datetime, hours: float, apply: bool, tally: Tally) -> None:
    try:
        names = sorted(os.listdir(tmp))
    except OSError as error:
        raise Refused(f"cannot list --tmp {tmp}: {error.strerror}") from error
    for name in names:
        if not name.startswith(STORAGE_PREFIX):
            continue
        path = tmp / name
        reason, idle = storage_reason(path, clock, hours)
        if reason is None and apply:
            try:
                remove_tree(path)
            except OSError as error:
                reason = f"removal failed: {error.strerror}"
                tally.failed = True
        if reason is not None:
            tally.say(f"keep storage {path}: {reason}")
            tally.kept += 1
            continue
        tally.say(f"remove storage {path} (idle {int(idle)}h)")
        tally.stored += 1


# Old sessions -----------------------------------------------------------------------------------------

BUILD_FOLDERS = frozenset({".venv", "node_modules"})


def build_folders(home: Path) -> Iterator[Path]:
    """Every real `.venv` and `node_modules` folder under `home`, not descending into one, into a link
    or into `.git`."""
    stack = [home]
    while stack:
        try:
            with os.scandir(stack.pop()) as entries:
                for entry in entries:
                    if not entry.is_dir(follow_symlinks=False) or entry.name == ".git":
                        continue
                    if entry.name in BUILD_FOLDERS:
                        yield Path(entry.path)
                    else:
                        stack.append(Path(entry.path))
        except OSError:
            continue


REVIEW_SLOT = re.compile(r"(rv|slot)\d+")


def holder_reason(
    probe: Probe, main: Path, folder: Path, trees: list[Worktree], paths: list[Path]
) -> str | None:
    """Why the folder holding a build folder is not one the worktree sweep would remove, or None.
    A listed worktree answers to `judge` (the worktree sweep's own rules); a scratch folder, which has
    no branch, to the checks on use."""
    if any(REVIEW_SLOT.fullmatch(part) for part in folder.relative_to(main).parts):
        return "review slot"
    held = [tree for tree in trees if inside(folder, tree.path)]
    if held:
        tree = max(held, key=lambda found: len(found.path.parts))
        return judge(probe, main, tree, paths)[0]
    return probe.current(folder.parent) or probe.in_use(folder.parent)


def sweep_old_sessions(main: Path, probe: Probe, days: float, apply: bool, tally: Tally) -> None:
    listed = probe.run(main, "worktree", "list", "--porcelain", "-z")
    if listed.returncode != 0:
        raise Refused(f"git worktree list failed: {first_line(listed.stderr)}")
    every = parse_worktrees(listed.stdout)
    paths = [tree.path for tree in every]
    trees = every[1:]  # the first entry is the main checkout
    clock = probe.clock
    for home in (main / ".claude" / "worktrees", main / ".private" / "work"):
        if home.is_symlink() or not home.is_dir():
            continue
        for folder in sorted(build_folders(home)):
            if any(inside(folder, main / never) for never in NEVER):
                continue
            try:
                idle = hours_since(newest_in_tree(folder), clock) / 24
            except OSError as error:
                tally.say(f"keep build folder {folder}: unreadable: {error.strerror}")
                tally.kept += 1
                continue
            if idle < days:
                tally.kept += 1
                continue
            reason = holder_reason(probe, main, folder, trees, paths)
            if reason is not None:
                tally.say(f"keep build folder {folder}: {reason}")
                tally.kept += 1
                continue
            if apply:
                try:
                    remove_tree(folder)
                except OSError as error:
                    tally.say(f"keep build folder {folder}: removal failed: {error.strerror}")
                    tally.kept += 1
                    tally.failed = True
                    continue
            tally.say(f"remove build folder {folder} (idle {int(idle)}d)")
            tally.removed += 1


def run_old_sessions(args: argparse.Namespace, probe: Probe) -> int:
    tally = Tally()
    main = resolve_main(args.repo, probe.run)
    tally.say(f"sweep --old-sessions: {main}, older than {args.days:g} days")
    sweep_old_sessions(main, probe, args.days, args.apply, tally)
    verb = "removed" if args.apply else "dry run: would remove"
    tally.say(f"sweep: {verb} {tally.removed} build folders, kept {tally.kept}")
    if not args.apply and tally.removed:
        tally.say("pass --apply to remove them")
    return 1 if tally.failed else 0


# The command ------------------------------------------------------------------------------------------


def first_line(text: str) -> str:
    lines = text.strip().splitlines()
    return lines[0] if lines else "no message"


def hours(text: str) -> float:
    try:
        value = float(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a number of hours: {text!r}") from None
    if not value >= 0:
        raise argparse.ArgumentTypeError(f"hours must be 0 or more: {text!r}")
    return value


def parse(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.sweep", description=__doc__)
    parser.add_argument("--apply", action="store_true", help="remove; without it, a dry run")
    parser.add_argument("--only", choices=("storage", "worktrees"))
    parser.add_argument("--repo", type=Path, help="default: the main checkout of the cwd")
    parser.add_argument("--tmp", type=Path, help="default: tempfile.gettempdir()")
    parser.add_argument("--worktree-hours", type=hours, default=24.0)
    parser.add_argument("--old-sessions", action="store_true", help="the build folders mode")
    parser.add_argument("--days", type=hours, default=14.0, help="with --old-sessions")
    parser.add_argument("--storage-hours", type=hours, default=6.0)
    return parser.parse_args(argv)


def resolve_main(repo: Path | None, run: Runner) -> Path:
    if repo is None:
        found = status.main_checkout()
        if found is None:
            raise Refused("the cwd is not in a git repository; pass --repo")
        return found.resolve()
    if not repo.is_dir():
        raise Refused(f"--repo {repo} is not a folder")
    done = run(repo, "rev-parse", "--path-format=absolute", "--git-common-dir")
    if done.returncode != 0 or not done.stdout.strip():
        raise Refused(f"--repo {repo} is not a git repository")
    return Path(done.stdout.strip()).resolve().parent


def origin_main(main: Path, run: Runner) -> str:
    done = run(main, "rev-parse", "--verify", "-q", "refs/remotes/origin/main")
    if done.returncode != 0 or not done.stdout.strip():
        raise Refused(f"no origin/main ref in {main}: nothing can be judged merged")
    return done.stdout.strip()


def disk_free(path: Path) -> str:
    try:
        return f"{shutil.disk_usage(path).free / 1e9:.1f} GB"
    except OSError:
        return "unknown"


def run_sweep(args: argparse.Namespace, probe: Probe) -> int:
    tally = Tally()
    main: Path | None = None
    if args.only != "storage":
        main = resolve_main(args.repo, probe.run)
        sha = origin_main(main, probe.run)
        tally.say(f"sweep: {main}, origin/main at {sha}")
    tmp = (args.tmp or Path(tempfile.gettempdir())).resolve()
    disk = main if main is not None else tmp
    before = disk_free(disk)
    if main is not None:
        sweep_worktrees(probe, main, args.apply, tally)
    if args.only != "worktrees":
        sweep_storage(tmp, probe.clock, args.storage_hours, args.apply, tally)
    tally.say(f"disk free: {before} before, {disk_free(disk)} after")
    if tally.removed == 0 and tally.stored == 0:
        tally.say(f"sweep: nothing to sweep, kept {tally.kept}")
    elif args.apply:
        tally.say(
            f"sweep: removed {tally.removed} worktrees and {tally.stored} storage folders, "
            f"kept {tally.kept}"
        )
    else:
        tally.say(
            f"sweep: dry run: would remove {tally.removed} worktrees and {tally.stored} storage "
            f"folders, keep {tally.kept}; pass --apply"
        )
    return 1 if tally.failed else 0


def main(argv: list[str] | None = None) -> int:
    args = parse(argv)
    try:
        probe = Probe(hours=args.worktree_hours)
        if args.old_sessions:
            return run_old_sessions(args, probe)
        return run_sweep(args, probe)
    except Refused as refused:
        print(f"REFUSED: {refused}", file=sys.stderr)
        return 2
    except ValueError as error:  # a bad VEXTRUS_NOW
        print(f"REFUSED: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
