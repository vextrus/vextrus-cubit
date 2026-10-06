"""S14-F12 (issue #462): `sweep.py --old-sessions` lists, by name, the build folders (`.venv`,
`node_modules`) the factory left in its own folders, and removes only those.

The authority:
- Issue #462, "Fix": "`sweep.py --old-sessions` lists build folders, by name, older than N days ...
  and prints them"; "Acceptance check": "a fixture tree lists exactly the by-name build folders ...
  and nothing else". Session 13: "50 GB sat in 398 rebuildable `node_modules` and `.venv` folders
  under old session folders".
- The orchestrator's brief (session 14): "A sweep, by name, of the factory's own leftover worktrees and
  scratch dirs; never a recursive delete of anything else ... it lists before deleting, deletes only
  names it made, and refuses paths outside .claude/worktrees/ and .private/work/." So the delete is
  the sweep's existing `--apply` (a dry run is the default, as for the rest of `sweep.py`).

Pinned at the boundary: the command's exit code, the paths its output names, and what is on disk
after. Not pinned: the words of its lines, the age flag's name or default (the fixtures are 400 days
old or fresh, so any N from 1 to 399 days gives the same answer), or the order of its lines. "Belongs
to merged or closed branches" is not pinned: a scratch folder under `.private/work/` has no branch.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[4]
OLD = time.time() - 400 * 86400

# The build folders the sweep must list and, with --apply, remove (relative to the main checkout).
BUILD = (
    ".private/work/session-01/scratch/.venv",
    ".private/work/session-01/vt/web/node_modules",
    ".claude/worktrees/gone-ticket/.venv",
)
# Old, inside the factory's folders, but not a build folder: kept.
NOT_BUILD = (
    ".private/work/session-01/scratch/src/keep.py",
    ".private/work/session-01/notes.md",
    ".private/work/session-01/data/table.csv",
)
# A build folder younger than any N: kept.
FRESH = ".private/work/session-14/scratch/.venv"
# Old build folders outside `.claude/worktrees/` and `.private/work/`: never listed, never removed.
OUTSIDE = (
    ".venv",
    "web/node_modules",
    ".private/reference/set-a/.venv",
)


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


def age(top: Path) -> None:
    """Every entry under `top` (links not followed) dated 400 days back, folders last."""
    for root, dirs, files in os.walk(top, topdown=False, followlinks=False):
        for name in [*files, *dirs]:
            os.utime(Path(root) / name, (OLD, OLD), follow_symlinks=False)
    os.utime(top, (OLD, OLD), follow_symlinks=False)


class Tree:
    def __init__(self, base: Path) -> None:
        self.main = base / "main"
        self.tmp = base / "tmp"
        self.outside = base / "outside"
        self.main.mkdir()
        self.tmp.mkdir()
        git(self.main, "init", "-q", "-b", "main")
        (self.main / ".gitignore").write_text(".private/\n.claude/worktrees/\n.venv/\nnode_modules/\n")
        git(self.main, "add", ".gitignore")
        git(self.main, "commit", "-q", "-m", "base")
        git(self.main, "update-ref", "refs/remotes/origin/main", "HEAD")

        for relative in (*BUILD, *OUTSIDE):
            fill(self.main / relative)
        for relative in NOT_BUILD:
            (self.main / relative).parent.mkdir(parents=True, exist_ok=True)
            (self.main / relative).write_text("keep\n")
        # Outside the checkout: a build folder and a folder holding one, each reached by a link
        # from inside `.private/work/`.
        fill(self.outside / ".venv")
        fill(self.outside / "elsewhere" / "node_modules")
        linked = self.main / ".private/work/session-01/linked"
        linked.mkdir(parents=True)
        (linked / ".venv").symlink_to(self.outside / ".venv", target_is_directory=True)
        (self.main / ".private/work/session-02").symlink_to(
            self.outside / "elsewhere", target_is_directory=True
        )
        age(self.main / ".private")
        age(self.main / ".claude")
        for relative in OUTSIDE:
            age(self.main / relative)
        age(self.outside)
        fill(self.main / FRESH)  # made now: fresh

    def sweep(self, *extra: str) -> subprocess.CompletedProcess[str]:
        env = {
            key: value
            for key, value in os.environ.items()
            if not key.startswith("GIT_") and key != "VEXTRUS_NOW"
        }
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
            cwd=REPO,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )

    def files(self) -> set[Path]:
        """Every file under the base, links not followed."""
        found: set[Path] = set()
        for top in (self.main, self.outside):
            for root, _dirs, names in os.walk(top, followlinks=False):
                found.update(Path(root) / name for name in names)
        return found


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


@pytest.fixture
def tree(tmp_path: Path) -> Tree:
    return Tree(tmp_path)


def test_a_dry_run_lists_each_old_build_folder_by_path_and_removes_nothing(tree: Tree) -> None:
    before = tree.files()
    done = tree.sweep()
    assert done.returncode == 0, show(done)
    for relative in BUILD:
        assert relative in done.stdout, f"{relative} is not listed\n{show(done)}"
    assert tree.files() == before, "a dry run removed something"


def test_apply_lists_and_removes_exactly_the_old_build_folders(tree: Tree) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in BUILD:
        assert relative in done.stdout, f"{relative} was not named before its removal\n{show(done)}"
        assert not (tree.main / relative).exists(), f"{relative} is still there\n{show(done)}"
        assert (tree.main / relative).parent.is_dir(), f"the folder holding {relative} went too"


def test_apply_keeps_every_old_folder_that_is_not_a_build_folder(tree: Tree) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in NOT_BUILD:
        assert (tree.main / relative).is_file(), f"{relative} was removed\n{show(done)}"


def test_a_build_folder_younger_than_the_age_is_kept(tree: Tree) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    assert (tree.main / FRESH / "lib/pkg/index.py").is_file(), f"the fresh {FRESH} was removed"


def test_a_build_folder_outside_the_factory_folders_is_never_listed_or_removed(tree: Tree) -> None:
    dry = tree.sweep()
    assert dry.returncode == 0, show(dry)
    assert ".private/reference" not in dry.stdout, f"a folder outside is listed\n{show(dry)}"
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for relative in OUTSIDE:
        assert (tree.main / relative / "lib/pkg/index.py").is_file(), (
            f"{relative}, outside .claude/worktrees/ and .private/work/, was touched\n{show(done)}"
        )


def test_a_link_out_of_the_factory_folders_is_never_followed(tree: Tree) -> None:
    done = tree.sweep("--apply")
    assert done.returncode == 0, show(done)
    for target in (tree.outside / ".venv", tree.outside / "elsewhere" / "node_modules"):
        assert (target / "lib/pkg/index.py").is_file(), (
            f"{target}, reached through a link, lost its files\n{show(done)}"
        )
        assert (target / "marker.txt").is_file(), f"{target} lost its files\n{show(done)}"
