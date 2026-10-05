"""T-LAND-PULL: the lander updates the main checkout without `FETCH_HEAD`.

`git pull` reads `.git/FETCH_HEAD`, which every other `git fetch` in the main checkout rewrites (the
push watcher, the factory watcher, the review slots). When it holds several branches, `git pull` stops
with "Cannot fast-forward to multiple branches" and main stays behind. So `Gh.pull_main` fetches main
into `refs/remotes/origin/main` and fast-forwards to that ref: `git -C <repo> fetch -q origin main`, then
`git -C <repo> merge -q --ff-only refs/remotes/origin/main` (or `origin/main`).

(b) and (c) run real git. Another fetch rewriting `FETCH_HEAD` just after ours is made deterministic by
`GIT_EXEC_PATH`: a copy of git's exec path whose `git` writes two branch lines into `FETCH_HEAD` after
every fetch, the internal fetch `git pull` runs among them.

Seam (fixed by T-LAND): `scripts.land.Gh(repo).pull_main()`.
"""

import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import land

MERGES = (
    ["merge", "-q", "--ff-only", "refs/remotes/origin/main"],
    ["merge", "-q", "--ff-only", "origin/main"],
)


def git(cwd: Path, *args: str) -> str:
    done = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True)
    return done.stdout.strip()


def new_repo(path: Path) -> Path:
    git(path.parent, "init", "-q", "-b", "main", str(path))
    git(path, "config", "user.email", "writer@example.com")
    git(path, "config", "user.name", "writer")
    git(path, "config", "commit.gpgsign", "false")
    return path


def commit(repo: Path, name: str, text: str) -> str:
    (repo / name).write_text(text)
    git(repo, "add", name)
    git(repo, "commit", "-q", "-m", name)
    return git(repo, "rev-parse", "HEAD")


class Checkout:
    """The main checkout on `main`, and an origin whose `main` is one commit ahead of it (pushed from a
    second clone). Origin also holds `other`, the second branch `FETCH_HEAD` names."""

    def __init__(self, root: Path) -> None:
        self.origin = root / "origin.git"
        git(root, "init", "-q", "--bare", "-b", "main", str(self.origin))
        self.repo = new_repo(root / "main-checkout")
        git(self.repo, "remote", "add", "origin", str(self.origin))
        self.base = commit(self.repo, "README", "base\n")
        git(self.repo, "push", "-q", "origin", "main", "main:other")
        self.other = commit(self.repo, "other.txt", "another branch\n")
        git(self.repo, "push", "-q", "origin", "HEAD:other")
        git(self.repo, "reset", "-q", "--hard", self.base)
        git(self.repo, "fetch", "-q", "origin")
        elsewhere = root / "elsewhere"
        git(root, "clone", "-q", str(self.origin), str(elsewhere))
        git(elsewhere, "config", "user.email", "writer@example.com")
        git(elsewhere, "config", "user.name", "writer")
        git(elsewhere, "config", "commit.gpgsign", "false")
        self.ahead = commit(elsewhere, "merged.txt", "the PR just merged\n")
        git(elsewhere, "push", "-q", "origin", "main")
        self.fetch_head = self.repo / ".git" / "FETCH_HEAD"
        self.two_branches = (
            f"{self.base}\t\tbranch 'main' of {self.origin}\n"
            f"{self.other}\t\tbranch 'other' of {self.origin}\n"
        )
        self.fetch_head.write_text(self.two_branches)

    def head(self) -> str:
        return git(self.repo, "rev-parse", "HEAD")


def race(root: Path, checkout: Checkout, monkeypatch: pytest.MonkeyPatch) -> None:
    """Every fetch is followed at once by another process's fetch of two branches."""
    real = Path(git(root, "--exec-path"))
    shadow = root / "exec-path"
    shadow.mkdir()
    for entry in real.iterdir():
        if entry.name != "git":
            (shadow / entry.name).symlink_to(entry)
    lines = root / "two-branches"
    lines.write_text(checkout.two_branches)
    wrapper = shadow / "git"
    wrapper.write_text(
        "#!/bin/sh\n"
        f'"{real / "git"}" "$@"\n'
        "code=$?\n"
        'for arg in "$@"; do\n'
        '  if [ "$arg" = fetch ] && [ "$code" -eq 0 ]; then\n'
        f'    cat "{lines}" > "{checkout.fetch_head}"\n'
        "  fi\n"
        "done\n"
        'exit "$code"\n'
    )
    wrapper.chmod(0o755)
    monkeypatch.setenv("GIT_EXEC_PATH", str(shadow))
    monkeypatch.setenv("PATH", f"{shadow}{os.pathsep}{os.environ['PATH']}")


class Recorder:
    """A fake `subprocess.run` recording each argv; the checkout is on `main`."""

    def __init__(self) -> None:
        self.argvs: list[list[str]] = []

    def __call__(self, argv: Any, *args: Any, **kwargs: Any) -> subprocess.CompletedProcess[str]:
        argv = [str(part) for part in argv]
        self.argvs.append(argv)
        reads_branch = "symbolic-ref" in argv or "--abbrev-ref" in argv
        return subprocess.CompletedProcess(argv, 0, stdout="main\n" if reads_branch else "", stderr="")

    def git_runs(self, repo: Path) -> list[list[str]]:
        """Each git call's subcommand and arguments, after its `-C <repo>` (asserted)."""
        runs = []
        for argv in self.argvs:
            assert Path(argv[0]).name == "git", argv
            assert argv[1:3] == ["-C", str(repo)], argv
            runs.append(argv[3:])
        return runs


def recorded(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Recorder:
    recorder = Recorder()
    monkeypatch.setattr(subprocess, "run", recorder)
    land.Gh(tmp_path).pull_main()
    return recorder


def test_a1_pull_main_never_runs_git_pull_nor_reads_fetch_head(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recorder = recorded(tmp_path, monkeypatch)
    runs = recorder.git_runs(tmp_path)
    assert not [run for run in runs if "pull" in run], runs
    assert not [argv for argv in recorder.argvs if any("FETCH_HEAD" in part for part in argv)]


def test_a2_pull_main_fetches_main_then_fast_forwards_to_the_remote_ref(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runs = recorded(tmp_path, monkeypatch).git_runs(tmp_path)
    moves = [run for run in runs if run[0] in ("fetch", "merge", "pull")]
    assert len(moves) == 2, runs
    assert moves[0] == ["fetch", "-q", "origin", "main"]
    assert moves[1] in MERGES


def test_b_main_is_brought_up_to_origin_while_fetch_head_holds_two_branches(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    checkout = Checkout(tmp_path)
    race(tmp_path, checkout, monkeypatch)
    assert checkout.head() == checkout.base
    land.Gh(checkout.repo).pull_main()
    assert checkout.head() == checkout.ahead, "the main checkout is at origin's main"


def test_c_a_diverged_main_raises_and_is_neither_merged_nor_reset(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    checkout = Checkout(tmp_path)
    local = commit(checkout.repo, "local.txt", "a commit only this checkout has\n")
    race(tmp_path, checkout, monkeypatch)
    with pytest.raises((land.Refused, subprocess.CalledProcessError)) as raised:
        land.Gh(checkout.repo).pull_main()
    error = raised.value
    said = f"{error} {getattr(error, 'stderr', '') or ''}"
    assert "multiple branches" not in said, "refused for FETCH_HEAD, not for the divergence"
    assert checkout.head() == local, "main was not moved: no merge commit, no reset"
    assert git(checkout.repo, "rev-list", "--parents", "-n", "1", "HEAD").split()[1:] == [checkout.base]
    assert git(checkout.repo, "status", "--porcelain") == ""
    assert not (checkout.repo / ".git" / "MERGE_HEAD").exists()
