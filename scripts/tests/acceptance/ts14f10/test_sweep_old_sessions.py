"""S14-F12 (issue #462), re-submitted as S15-F10b: `sweep.py --old-sessions` lists, by name, the build
folders (`.venv`, `node_modules`) left in the factory's registered worktrees, and removes only those.

The authority:
- Issue #462, "Fix": "`sweep.py --old-sessions` lists build folders, by name, older than N days ...
  and prints them"; "Acceptance check": "a fixture tree lists exactly the by-name build folders ...
  and nothing else". Session 13: "50 GB sat in 398 rebuildable `node_modules` and `.venv` folders
  under old session folders".
- The orchestrator's brief (session 14): "it lists before deleting, deletes only names it made". So the
  delete is the sweep's existing `--apply` (a dry run is the default, as for the rest of `sweep.py`).
- The orchestrator's brief (session 15, S15-F10b; PR #519 closed at the review cap, its round-3 finding:
  a copy's top folder under `.private/work/` was guessed two levels down, so a copy one level down lost
  its `web/node_modules` while in use): "`--old-sessions` sweeps ONLY registered git worktrees under
  `.claude/worktrees/` (from `git worktree list --porcelain`; each worktree's root is known, so
  `current` and `in use` are judged on that root), and never anything under `.private/work/`."

Pinned at the boundary: the command's exit code, the paths its output names, and what is on disk
after. The worktree swept here is merged into `origin/main`, clean and idle 400 days, so whether the
sweep also asks the worktree sweep's other rules (locked, merged, clean, idle) is the builder's choice;
so are the words of its lines, the age flag's name or default (the fixtures are 400 days old or fresh,
so any N from 1 to 399 days gives the same answer), the order of its lines, and review slots.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[4]
OLD = time.time() - 400 * 86400
GITDIR_OLD = OLD + 3600  # the worktrees' git files: still 400 days old, newer than the files they index

# A registered worktree under `.claude/worktrees/`, merged, clean and idle: its build folders go.
SWEPT_TREE = ".claude/worktrees/gone-ticket"
SWEPT = (f"{SWEPT_TREE}/.venv", f"{SWEPT_TREE}/web/node_modules")
# Tracked files of every worktree (the fixture's commit): never a build folder, kept.
TRACKED = ("docs/readme.md", "src/keep.py", "data/table.csv", "web/package.json")
# Another such worktree: idle too, unless a live process, or the sweep itself, works in it.
BUSY_TREE = ".claude/worktrees/busy-ticket"
BUSY = (f"{BUSY_TREE}/.venv", f"{BUSY_TREE}/web/node_modules")
IDLE = (*SWEPT, *BUSY)
# A registered worktree whose `.venv` is younger than any N.
FRESH = ".claude/worktrees/fresh-ticket/.venv"
# An old folder under `.claude/worktrees/` that is not a registered worktree: kept.
LEFTOVER = (".claude/worktrees/leftover/.venv", ".claude/worktrees/leftover/web/node_modules")
# Under `.private/work/`, at every depth, a registered worktree among them: never touched.
PRIVATE_TREE = ".private/work/s1/scratch-wt"
PRIVATE = (
    ".private/work/.venv",
    ".private/work/copy-1/.venv",
    ".private/work/copy-1/web/node_modules",
    ".private/work/s1/copy-2/.venv",
    ".private/work/s1/copy-2/web/node_modules",
    ".private/work/s1/a/b/copy-3/web/node_modules",
    f"{PRIVATE_TREE}/.venv",
    f"{PRIVATE_TREE}/web/node_modules",
)
# Old build folders of the main checkout (a registered worktree, not under `.claude/worktrees/`).
OUTSIDE = (".venv", "web/node_modules", ".private/reference/set-a/.venv")
# A registered worktree outside the checkout: never touched.
FAR_TREE = "far/elsewhere-wt"


def git(cwd: Path, *args: str) -> None:
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(
        GIT_AUTHOR_NAME="t",
        GIT_AUTHOR_EMAIL="t@example.invalid",
        GIT_COMMITTER_NAME="t",
        GIT_COMMITTER_EMAIL="t@example.invalid",
    )
    subprocess.run(["git", *args], cwd=cwd, env=env, check=True, capture_output=True, timeout=120)


def fill(folder: Path) -> None:
    """A build folder with a nested file, as uv or npm leaves one."""
    (folder / "lib" / "pkg").mkdir(parents=True, exist_ok=True)
    (folder / "lib" / "pkg" / "index.py").write_text("x = 1\n")
    (folder / "marker.txt").write_text("build\n")


def age(top: Path, moment: float = OLD) -> None:
    """Every entry under `top` (links not followed) dated `moment`, folders last."""
    for root, dirs, files in os.walk(top, topdown=False, followlinks=False):
        for name in [*files, *dirs]:
            os.utime(Path(root) / name, (moment, moment), follow_symlinks=False)
    os.utime(top, (moment, moment), follow_symlinks=False)


class Tree:
    def __init__(self, base: Path) -> None:
        self.base = base
        self.main = base / "main"
        self.tmp = base / "tmp"
        self.outside = base / "outside"
        self.far = base / "far"
        self.main.mkdir()
        self.tmp.mkdir()
        self.far.mkdir()
        git(self.main, "init", "-q", "-b", "main")
        (self.main / ".gitignore").write_text(".private/\n.claude/worktrees/\n.venv\nnode_modules\n")
        for relative in TRACKED:
            (self.main / relative).parent.mkdir(parents=True, exist_ok=True)
            (self.main / relative).write_text("keep\n")
        git(self.main, "add", ".gitignore", *TRACKED)
        git(self.main, "commit", "-q", "-m", "base")
        git(self.main, "update-ref", "refs/remotes/origin/main", "HEAD")

        self.worktrees = [
            self.main / SWEPT_TREE,
            self.main / BUSY_TREE,
            self.main / FRESH.removesuffix("/.venv"),
            self.main / PRIVATE_TREE,
            base / FAR_TREE,
        ]
        for number, tree in enumerate(self.worktrees):
            tree.parent.mkdir(parents=True, exist_ok=True)
            git(self.main, "worktree", "add", "-q", "-b", f"wt-{number}", str(tree))

        for relative in (*SWEPT, *BUSY, *LEFTOVER, *PRIVATE, *OUTSIDE):
            fill(self.main / relative)
        fill(base / FAR_TREE / ".venv")
        # Outside the checkout: a build folder and a folder holding one, each reached by a link from
        # inside `.claude/worktrees/` (one inside the swept worktree, one where a worktree would be).
        fill(self.outside / ".venv")
        fill(self.outside / "elsewhere" / "node_modules")
        (self.main / SWEPT_TREE / "web" / ".venv").symlink_to(
            self.outside / ".venv", target_is_directory=True
        )
        (self.main / ".claude/worktrees/via-link").symlink_to(
            self.outside / "elsewhere", target_is_directory=True
        )

        for top in (self.main / ".private", self.main / ".claude", self.outside, self.far):
            age(top)
        for relative in OUTSIDE[:2]:
            age(self.main / relative)
        # Each worktree's index records its files' aged dates, then its git files are aged too.
        for tree in self.worktrees:
            git(tree, "update-index", "-q", "--refresh")
        age(self.main / ".git" / "worktrees", GITDIR_OLD)
        fill(self.main / FRESH)  # made now: fresh

    def sweep(self, *extra: str, cwd: Path = REPO) -> subprocess.CompletedProcess[str]:
        env = {
            key: value
            for key, value in os.environ.items()
            if not key.startswith("GIT_") and key not in {"VEXTRUS_NOW", "PYTHONPATH"}
        }
        env["PYTHONPATH"] = str(REPO)
        return subprocess.run(
            [
                sys.executable,
                "-m",
                "scripts.factory.sweep",
                "--old-sessions",
                "--repo",
                str(self.main),
                "--tmp",
                str(self.tmp),
                *extra,
            ],
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )

    def files(self) -> set[Path]:
        """Every file under the base (the main checkout's `.git` aside), links not followed."""
        found: set[Path] = set()
        for root, dirs, names in os.walk(self.base, followlinks=False):
            if Path(root) == self.main:
                dirs[:] = [name for name in dirs if name != ".git"]
            found.update(Path(root) / name for name in names)
        return found

    def under(self, relative: str) -> set[Path]:
        return {path for path in self.files() if path.is_relative_to(self.main / relative)}


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


@contextmanager
def working_in(folder: Path) -> Iterator[int]:
    """A live process whose cwd is `folder` for the length of the block."""
    process = subprocess.Popen(
        [sys.executable, "-c", "import sys; sys.stdin.read()"], cwd=folder, stdin=subprocess.PIPE
    )
    try:
        yield process.pid
    finally:
        assert process.stdin is not None
        process.stdin.close()
        try:
            process.wait(timeout=60)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


@pytest.fixture
def tree(tmp_path: Path) -> Tree:
    return Tree(tmp_path)


def test_a_dry_run_lists_each_old_build_folder_of_a_registered_worktree_and_removes_nothing(
    tree: Tree,
) -> None:
    before = tree.files()
    done = tree.sweep()
    assert done.returncode == 0, show(done)
    for relative in IDLE:
        assert relative in done.stdout, f"{relative} is not listed\n{show(done)}"
    assert tree.files() == before, "a dry run removed something"


def test_apply_removes_exactly_the_old_build_folders_of_idle_registered_worktrees(
    tree: Tree,
) -> None:
    expected = set().union(*(tree.under(relative) for relative in IDLE))
    before = tree.files()
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in IDLE:
        assert relative in done.stdout, f"{relative} was not named before its removal\n{show(done)}"
        assert not (tree.main / relative).exists(), f"{relative} is still there\n{show(done)}"
        assert (tree.main / relative).parent.is_dir(), f"the folder holding {relative} went too"
    gone = sorted(str(path.relative_to(tree.base)) for path in before - tree.files())
    assert set(gone) == {str(path.relative_to(tree.base)) for path in expected}, (
        f"removed other than the idle worktrees' build folders: {gone}\n{show(done)}"
    )


def test_apply_keeps_the_worktree_and_its_files_that_are_not_in_a_build_folder(tree: Tree) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in TRACKED:
        assert (tree.main / SWEPT_TREE / relative).is_file(), f"{relative} was removed\n{show(done)}"
    assert (tree.main / SWEPT_TREE / ".git").is_file(), f"the worktree itself went\n{show(done)}"


def test_a_build_folder_younger_than_the_age_is_kept(tree: Tree) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    assert (tree.main / FRESH / "lib/pkg/index.py").is_file(), f"the fresh {FRESH} was removed"


def test_nothing_under_private_work_is_ever_removed_at_any_depth(tree: Tree) -> None:
    before = tree.under(".private/work")
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    lost = sorted(str(path.relative_to(tree.main)) for path in before - tree.under(".private/work"))
    assert not lost, f"files under .private/work/ were removed: {lost}\n{show(done)}"
    for relative in PRIVATE:
        assert (tree.main / relative / "lib/pkg/index.py").is_file(), f"{relative} was touched"


def test_an_old_folder_under_claude_worktrees_that_is_not_a_registered_worktree_is_kept(
    tree: Tree,
) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in LEFTOVER:
        assert (tree.main / relative / "lib/pkg/index.py").is_file(), (
            f"{relative}, in no registered worktree, was removed\n{show(done)}"
        )


def test_a_build_folder_outside_claude_worktrees_is_never_listed_or_removed(tree: Tree) -> None:
    dry = tree.sweep()
    assert dry.returncode == 0, show(dry)
    assert ".private/reference" not in dry.stdout, f"a folder outside is listed\n{show(dry)}"
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in OUTSIDE:
        assert (tree.main / relative / "lib/pkg/index.py").is_file(), (
            f"{relative}, of the main checkout, was touched\n{show(done)}"
        )
    assert (tree.base / FAR_TREE / ".venv/lib/pkg/index.py").is_file(), (
        f"the .venv of a registered worktree outside .claude/worktrees/ was touched\n{show(done)}"
    )


def test_a_link_out_of_the_worktrees_is_never_followed(tree: Tree) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for target in (tree.outside / ".venv", tree.outside / "elsewhere" / "node_modules"):
        assert (target / "lib/pkg/index.py").is_file(), (
            f"{target}, reached through a link, lost its files\n{show(done)}"
        )
        assert (target / "marker.txt").is_file(), f"{target} lost its files\n{show(done)}"


@pytest.mark.parametrize("where", ["", "web", "docs"], ids=["at-its-root", "in-web", "in-docs"])
def test_a_worktree_a_live_process_works_in_keeps_every_build_folder(tree: Tree, where: str) -> None:
    with working_in(tree.main / BUSY_TREE / where) as pid:
        done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in BUSY:
        assert (tree.main / relative / "lib/pkg/index.py").is_file(), (
            f"{relative} was removed while pid {pid} works in {BUSY_TREE}/{where}\n{show(done)}"
        )
    for relative in SWEPT:  # the same run swept the idle worktree: it did run
        assert not (tree.main / relative).exists(), f"{relative} is still there\n{show(done)}"


@pytest.mark.parametrize("where", ["", "web"], ids=["at-its-root", "in-web"])
def test_the_worktree_the_sweep_runs_in_keeps_every_build_folder(tree: Tree, where: str) -> None:
    done = tree.sweep("--apply", cwd=tree.main / BUSY_TREE / where)
    assert done.returncode == 0, show(done)
    for relative in BUSY:
        assert (tree.main / relative / "lib/pkg/index.py").is_file(), (
            f"{relative} was removed by a sweep run from {BUSY_TREE}/{where}\n{show(done)}"
        )
    for relative in SWEPT:
        assert not (tree.main / relative).exists(), f"{relative} is still there\n{show(done)}"
