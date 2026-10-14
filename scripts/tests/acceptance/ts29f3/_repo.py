"""The world S29-F3's acceptance tests run the main watcher in: no network, no real `gh`.

`Repo(tmp_path)` builds:

- `origin.git`, a bare repository standing in for GitHub, whose `main` starts at one root commit;
- `dev`, a clone that plays GitHub's merge button: `repo.merge(pr, {path: text or None})` cuts a
  branch from main, commits the change, merges it into main with `--no-ff` and GitHub's message
  (`Merge pull request #<pr> from vextrus/<branch>`) and pushes main; it returns the merge's sha;
- `watch`, the watcher's own clone (the `repo` it is given): identity and hooks set locally.

`FakeForge(runs)` is the gh seam: `conclusion(sha)` answers the required checks' conclusion of a
commit on main (`"success"`, `"failure"`, or None while no run has finished), `run_url(sha)` the run's
address, and `open_pr(head=, base=, title=, body=)` records the PR and returns its number. Nothing
else: what was already reverted is read from git (origin's branches, main's history) or the log.

Every commit date is fixed, so every sha is the same on every run.
"""

import os
import subprocess
from collections.abc import Mapping
from pathlib import Path
from typing import Any

DATE = "2026-10-14T08:00:00+00:00"
IDENTITY = {
    "GIT_AUTHOR_NAME": "Fixture",
    "GIT_AUTHOR_EMAIL": "fixture@example.invalid",
    "GIT_COMMITTER_NAME": "Fixture",
    "GIT_COMMITTER_EMAIL": "fixture@example.invalid",
    "GIT_AUTHOR_DATE": DATE,
    "GIT_COMMITTER_DATE": DATE,
}


def git(where: Path, *args: str) -> str:
    env = {**os.environ, **IDENTITY, "GIT_CONFIG_NOSYSTEM": "1"}
    done = subprocess.run(
        ["git", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", *args],
        cwd=where,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, f"git {' '.join(args)}: {done.stderr}"
    return done.stdout.strip()


class Repo:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.origin = root / "origin.git"
        self.dev = root / "dev"
        self.watch = root / "watch"
        git(root, "init", "--bare", "-q", "-b", "main", str(self.origin))
        git(root, "clone", "-q", str(self.origin), str(self.dev))
        git(self.dev, "checkout", "-q", "-b", "main")
        (self.dev / "README.md").write_text("# fixture\n")
        git(self.dev, "add", "README.md")
        git(self.dev, "commit", "-q", "-m", "root")
        git(self.dev, "push", "-q", "origin", "main")
        self.root_sha = git(self.dev, "rev-parse", "HEAD")
        git(root, "clone", "-q", str(self.origin), str(self.watch))
        for key, value in (
            ("user.name", "Main Watcher"),
            ("user.email", "watcher@example.invalid"),
            ("core.hooksPath", "/dev/null"),
            ("commit.gpgsign", "false"),
        ):
            git(self.watch, "config", key, value)

    def merge(self, pr: int, files: Mapping[str, str | None]) -> str:
        """Merge PR `pr` (the files written, or deleted for None) into origin's main; its sha."""
        branch = f"pr{pr}"
        git(self.dev, "fetch", "-q", "origin")
        git(self.dev, "checkout", "-q", "-B", "main", "origin/main")
        git(self.dev, "checkout", "-q", "-b", branch)
        for path, text in files.items():
            target = self.dev / path
            if text is None:
                git(self.dev, "rm", "-q", path)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
            git(self.dev, "add", path)
        git(self.dev, "commit", "-q", "-m", f"change of PR {pr}")
        git(self.dev, "checkout", "-q", "main")
        git(
            self.dev,
            "merge",
            "-q",
            "--no-ff",
            "-m",
            f"Merge pull request #{pr} from vextrus/{branch}",
            branch,
        )
        git(self.dev, "push", "-q", "origin", "main")
        return git(self.dev, "rev-parse", "HEAD")

    def land(self, pr: int, branch: str) -> str:
        """Merge origin's `branch` into main the way GitHub's button does; the merge's sha."""
        git(self.dev, "fetch", "-q", "origin")
        git(self.dev, "checkout", "-q", "-B", "main", "origin/main")
        git(
            self.dev,
            "merge",
            "-q",
            "--no-ff",
            "-m",
            f"Merge pull request #{pr} from vextrus/{branch}",
            f"origin/{branch}",
        )
        git(self.dev, "push", "-q", "origin", "main")
        return git(self.dev, "rev-parse", "HEAD")

    def origin_main(self) -> str:
        return git(self.origin, "rev-parse", "refs/heads/main")

    def origin_branches(self) -> list[str]:
        out = git(self.origin, "for-each-ref", "--format=%(refname:short)", "refs/heads/")
        return [line for line in out.splitlines() if line]

    def revert_branches(self) -> list[str]:
        return [name for name in self.origin_branches() if name.startswith("revert/")]

    def files_at(self, ref: str) -> set[str]:
        out = git(self.origin, "ls-tree", "-r", "--name-only", ref)
        return set(out.splitlines())

    def diff_names(self, base: str, head: str) -> list[str]:
        out = git(self.origin, "diff", "--no-renames", "--name-status", base, head)
        return sorted(out.splitlines())


class FakeForge:
    """The gh seam: the run list per commit, and the PRs opened."""

    def __init__(self, runs: dict[str, str | None]) -> None:
        self.runs = dict(runs)
        self.opened: list[dict[str, Any]] = []
        self._ids: dict[str, int] = {}

    def conclusion(self, sha: str) -> str | None:
        return self.runs.get(sha)

    def run_url(self, sha: str) -> str:
        number = self._ids.setdefault(sha, 7100 + len(self._ids))
        return f"https://github.com/vextrus/vextrus/actions/runs/{number}"

    def open_pr(self, *, head: str, base: str, title: str, body: str) -> int:
        number = 900 + len(self.opened)
        self.opened.append({"number": number, "head": head, "base": base, "title": title, "body": body})
        return number


def short_of(branch: str, sha: str) -> bool:
    """`branch` is `revert/<short sha>` of `sha`: a prefix of it, 7 hex characters or more."""
    if not branch.startswith("revert/"):
        return False
    short = branch.removeprefix("revert/")
    return len(short) >= 7 and sha.startswith(short)
