"""Shared helpers for ticket S14-B1's acceptance tests (not a test file).

The cross-PR check is driven black-box, as a builder runs it from its worktree:
`python -m scripts.factory.crosspr <branch>` as a subprocess whose current directory is a `work` clone,
with `PYTHONPATH` at this repository (so the module is found) and a fake `gh` first on PATH. Nothing real
is read: a temporary bare `origin.git` holds `main` and each open PR's branch (as `refs/heads/<branch>`
and `refs/pull/<n>/head`); the `work` clone has the builder's branch checked out, local only (a local
builder never pushes), and `origin/main` fetched.

The fixture repository is a tiny Python project with no `pyproject.toml`: a root `conftest.py` (so a
test can `import calc`), `calc.py`, and plain pytest files under `tests/` that need only pytest and the
standard library. The cross-PR check runs the changed tests with a Python that has pytest (the tests
start it with this interpreter, `sys.executable`, and inherit this environment).

The fake `gh` (gh 2.45.0's shapes; `--repo R` / `-R R` ignored; every argv logged) answers only reads:

- `pr list [--state open] [--base main] [--limit N] [--json f1,f2,...]`: the open PRs, each with
  `number`, `title`, `headRefName`, `headRefOid`, `baseRefName` (`main`), `isDraft` (false), `state`
  (`OPEN`), `url`, `files` (`[{"path", "additions", "deletions"}]`) and `changedFiles`; `--json` keeps
  only the fields named; without `--json` it prints a tab-separated table;
- `pr view <n> --json f1,...`: that PR's object, the same fields;
- `pr diff <n> --name-only`: its changed paths, one per line;
- `api repos/vextrus/vextrus-cubit/pulls/<n>/files` (GET): `[{"filename": <path>}, ...]`.

`--jq` / `-q` and anything else exit 1 with `unscripted: ...` on stderr.
"""

from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
BRANCH = "s14-b9"
NOW = "2026-10-06T10:00:00Z"
DROPPED_PREFIXES = ("GIT_", "VEXTRUS_", "PYTEST_", "CLAUDE_")

CALC = '''"""A small module the fixture's branches change."""


def rate():
    return 2


def name():
    return "calc"
'''

GH = """#!{python}
import json, sys
from pathlib import Path

STATE = Path({state!r})
LOG = Path({log!r})

argv = sys.argv[1:]
with LOG.open("a") as log:
    log.write(json.dumps(argv) + "\\n")


def fail(message):
    sys.stderr.write(message + "\\n")
    sys.exit(1)


args = []
skip = False
for part in argv:
    if skip:
        skip = False
        continue
    if part in ("--repo", "-R"):
        skip = True
        continue
    if part.startswith("--repo="):
        continue
    args.append(part)
if any(a in ("--jq", "-q") or a.startswith("--jq=") for a in args):
    fail("unscripted: gh " + " ".join(argv))
prs = json.loads(STATE.read_text())


def option(name):
    for index, part in enumerate(args):
        if part == name and index + 1 < len(args):
            return args[index + 1]
        if part.startswith(name + "="):
            return part.split("=", 1)[1]
    return None


def pick(pr):
    fields = option("--json")
    if fields is None:
        return pr
    return {{key: pr[key] for key in fields.split(",") if key in pr}}


def find(ref):
    for pr in prs:
        if str(pr["number"]) == ref.lstrip("#") or pr["headRefName"] == ref:
            return pr
    fail("no pull requests found for branch " + repr(ref))


if args[:2] == ["pr", "list"]:
    if option("--json") is None:
        for pr in prs:
            print(f"{{pr['number']}}\\t{{pr['title']}}\\t{{pr['headRefName']}}\\tOPEN")
    else:
        print(json.dumps([pick(pr) for pr in prs]))
    sys.exit(0)
if args[:2] == ["pr", "view"] and len(args) > 2 and option("--json") is not None:
    print(json.dumps(pick(find(args[2]))))
    sys.exit(0)
if args[:2] == ["pr", "diff"] and len(args) > 2 and "--name-only" in args:
    for item in find(args[2])["files"]:
        print(item["path"])
    sys.exit(0)
if args[:1] == ["api"]:
    method = option("--method") or option("-X") or "GET"
    paths = [a for a in args[1:] if a.lstrip("/").startswith("repos/")]
    if method.upper() == "GET" and len(paths) == 1:
        path = paths[0].lstrip("/").split("?", 1)[0]
        parts = path.split("/")
        if parts[:4] == ["repos", "vextrus", "vextrus-cubit", "pulls"] and len(parts) == 6:
            if parts[5] == "files":
                print(json.dumps([{{"filename": item["path"]}} for item in find(parts[4])["files"]]))
                sys.exit(0)
fail("unscripted: gh " + " ".join(argv))
"""

# gh commands that change something on GitHub: the cross-PR check reads only.
MUTATING = {
    ("pr", "create"),
    ("pr", "edit"),
    ("pr", "comment"),
    ("pr", "merge"),
    ("pr", "ready"),
    ("pr", "close"),
    ("pr", "review"),
    ("pr", "reopen"),
    ("issue", "create"),
    ("issue", "comment"),
    ("issue", "edit"),
}


def clean_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith(DROPPED_PREFIXES)}
    env.update(extra or {})
    return env


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


class World:
    """origin, the builder's `work` clone on BRANCH, the open PRs, and the fake `gh`."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.origin = tmp / "origin.git"
        self.work = tmp / "work"
        self.bin = tmp / "bin"
        self.state = tmp / "gh-prs.json"
        self.log = tmp / "gh-argv.log"
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )
        self.prs: list[dict[str, Any]] = []
        self.state.write_text("[]")
        self.bin.mkdir()
        gh = self.bin / "gh"
        gh.write_text(GH.format(python=sys.executable, state=str(self.state), log=str(self.log)))
        gh.chmod(gh.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

        self.git(tmp, "init", "-q", "--bare", "-b", "main", str(self.origin))
        self.work.mkdir()
        self.git(self.work, "init", "-q", "-b", "main")
        self.git(self.work, "remote", "add", "origin", str(self.origin))
        self.write({"conftest.py": "", "calc.py": CALC, "README": "seed\n"})
        self.git(self.work, "add", "conftest.py", "calc.py", "README")
        self.git(self.work, "commit", "-q", "-m", "seed")
        self.git(self.work, "push", "-q", "origin", "main")

    # --- git
    def env(self) -> dict[str, str]:
        return clean_env(
            {
                "GIT_CONFIG_GLOBAL": str(self.gitconfig),
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_ALLOW_PROTOCOL": "file",
                "GIT_AUTHOR_DATE": NOW,
                "GIT_COMMITTER_DATE": NOW,
            }
        )

    def git(self, cwd: Path, *args: str) -> str:
        done = subprocess.run(
            ["git", *args], cwd=cwd, env=self.env(), capture_output=True, text=True, check=False
        )
        assert done.returncode == 0, f"git {args}: {done.stderr}"
        return done.stdout.strip()

    def write(self, files: dict[str, str]) -> None:
        for name, text in files.items():
            path = self.work / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)

    def _branch(self, branch: str, files: dict[str, str], message: str) -> str:
        self.git(self.work, "switch", "-q", "-c", branch, "main")
        self.write(files)
        self.git(self.work, "add", *files)
        self.git(self.work, "commit", "-q", "-m", message)
        sha = self.git(self.work, "rev-parse", "HEAD")
        self.git(self.work, "switch", "-q", "main")
        return sha

    def open_pr(self, number: int, branch: str, files: dict[str, str]) -> str:
        """An open PR #number: `branch` cut from main with these files written, pushed to origin."""
        sha = self._branch(branch, files, f"{branch}: the change")
        self.git(self.work, "push", "-q", "origin", f"{sha}:refs/heads/{branch}")
        self.git(self.work, "push", "-q", "origin", f"{sha}:refs/pull/{number}/head")
        self.git(self.work, "branch", "-q", "-D", branch)
        self.prs.append(
            {
                "number": number,
                "title": f"{branch.upper()}: the change",
                "headRefName": branch,
                "headRefOid": sha,
                "baseRefName": "main",
                "isDraft": False,
                "state": "OPEN",
                "url": f"https://github.com/vextrus/vextrus-cubit/pull/{number}",
                "files": [{"path": p, "additions": 1, "deletions": 0} for p in sorted(files)],
                "changedFiles": len(files),
            }
        )
        self.state.write_text(json.dumps(self.prs))
        return sha

    def own(self, files: dict[str, str]) -> str:
        """The builder's branch BRANCH, cut from main, committed locally (never pushed), checked out."""
        sha = self._branch(BRANCH, files, f"{BRANCH}: the change")
        self.git(self.work, "switch", "-q", BRANCH)
        self.git(self.work, "fetch", "-q", "origin")
        return sha

    # --- what must not change
    def snapshot(self) -> dict[str, str]:
        """origin's refs, the clone's local branches, HEAD, worktrees and status, and the folder the
        world lives in (every name under it but the fake gh's log, the git folders and the work clone's
        `.private/`, where a run's output may be kept as every suite run's is)."""
        private = self.work / ".private"
        names = sorted(
            str(p.relative_to(self.tmp))
            for p in self.tmp.rglob("*")
            if p != self.log
            and not {".git", "origin.git"} & set(p.relative_to(self.tmp).parts)
            and not p.is_relative_to(private)
        )
        status = [
            line
            for line in self.git(self.work, "status", "--porcelain", "--ignored").splitlines()
            if not line[3:].startswith(".private/")
        ]
        return {
            "origin": self.git(self.tmp, "--git-dir", str(self.origin), "show-ref"),
            "branches": self.git(self.work, "for-each-ref", "refs/heads"),
            "head": self.git(self.work, "rev-parse", "HEAD")
            + self.git(self.work, "symbolic-ref", "HEAD"),
            "worktrees": self.git(self.work, "worktree", "list", "--porcelain"),
            "status": "\n".join(status),
            "names": "\n".join(names),
        }

    def gh_calls(self) -> list[list[str]]:
        if not self.log.is_file():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    # --- the check
    def crosspr(self, branch: str = BRANCH) -> subprocess.CompletedProcess[str]:
        env = self.env()
        env["PATH"] = f"{self.bin}{os.pathsep}{os.environ.get('PATH', '')}"
        env["PYTHONPATH"] = str(REPO)
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.crosspr", branch],
            cwd=self.work,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
