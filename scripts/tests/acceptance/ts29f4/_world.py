"""Shared helpers for ticket S29-F4's acceptance tests (not a test file).

A tmp bare `hub.git` (GitHub's side: `refs/heads/main` and `refs/pull/<n>/head`) whose first commit,
`fork`, holds two 10-line files, `pkg/shared.py` and `web/src/screens/Plot.tsx`. Main may move on in
commits after the fork; a PR is one commit cut from `fork` or from main's tip. An edit is `top` (line 1
rewritten), `bottom` (line 10 rewritten) or `new` (a new file): main edits a shared file at its top, a
PR at its bottom, so a PR and main may touch the same file (an overlap) with no conflict between them.

The stub `gh` (first on PATH) answers what `scripts.land.Gh` asks of gh 2.45 for several PRs:
`pr view <n> --json <fields> [-q .<field>]` (`headRefOid`, a green `statusCheckRollup`, `mergeable`
MERGEABLE / `mergeStateStatus` CLEAN unless the PR is scripted `conflicting`: CONFLICTING / DIRTY),
`pr ready <n>`, and `pr merge <n> ... --match-head-commit <sha>` (a merge commit of the head into the
hub's main, as GitHub merges; a sha not the PR's head exits 1). Anything else exits 1; every call is
logged. The PR's files and main's are git's to read (`git diff --name-only`), as the plan says.

`risk(monkeypatch)` scripts the risk tier: `scripts.factory.tiers.is_risk(paths)` (S29-F7's seam) is
True when a path is under `engine/` or `.claude/hooks/` (which the risk tier's paths certainly hold),
False otherwise, patched on the module and on any `is_risk` name `scripts.land` or `scripts.merge_ready`
imported from it.

No network, no real drawing.
"""

from __future__ import annotations

import importlib
import json
import os
import subprocess
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import pytest

from scripts import land, merge_ready
from scripts.tests.acceptance.p6_land._fakegh import rollup

SHARED = "pkg/shared.py"
SCREEN = "web/src/screens/Plot.tsx"
LINES = 10
RISK_ROOTS = ("engine/", ".claude/hooks/")

STUB_GH = """import json, os, subprocess, sys
args = list(sys.argv[1:])
with open(os.environ["S29F4_GH_LOG"], "a") as log:
    log.write(json.dumps(args) + "\\n")
plain, skip = [], False
for part in args:
    if skip:
        skip = False
    elif part in ("--repo", "-R"):
        skip = True
    elif not part.startswith("--repo="):
        plain.append(part)
args = plain
with open(os.environ["S29F4_GH_STATE"]) as handle:
    state = json.load(handle)

def value(flag):
    return args[args.index(flag) + 1] if flag in args and args.index(flag) + 1 < len(args) else None

def pr_of(number):
    if number not in state["prs"]:
        sys.stderr.write("GraphQL: Could not resolve to a PullRequest %s.\\n" % number)
        sys.exit(1)
    return state["prs"][number]

if args[:2] == ["pr", "view"]:
    pr = pr_of(args[2])
    conflicting = pr.get("conflicting", False)
    payload = {"headRefOid": pr["head"], "statusCheckRollup": state["rollup"]["statusCheckRollup"],
               "mergeable": "CONFLICTING" if conflicting else "MERGEABLE",
               "mergeStateStatus": "DIRTY" if conflicting else "CLEAN"}
    fields = [f for f in (value("--json") or "").split(",") if f]
    if not fields or not set(fields) <= set(payload):
        sys.stderr.write("stub gh: unscripted pr view fields\\n")
        sys.exit(1)
    query = value("-q") or value("--jq")
    if query is not None:
        out = payload[query.lstrip(".")]
        print(out if isinstance(out, str) else json.dumps(out))
    else:
        print(json.dumps({f: payload[f] for f in fields}))
    sys.exit(0)
if args[:2] == ["pr", "ready"]:
    sys.exit(0)
if args[:2] == ["pr", "merge"] and value("--match-head-commit"):
    pr = pr_of(args[2])
    sha = value("--match-head-commit")
    if sha != pr["head"]:
        sys.stderr.write("GraphQL: Head branch was modified. Review and try the merge again.\\n")
        sys.exit(1)
    hub = state["hub"]
    def git(*argv):
        return subprocess.run(["git", "--git-dir", hub, *argv], capture_output=True, text=True,
                              check=True).stdout.strip()
    main = git("rev-parse", "refs/heads/main")
    tree = git("merge-tree", "--write-tree", main, sha).split()[0]
    merged = git("commit-tree", tree, "-p", main, "-p", sha, "-m", "Merge pull request #" + args[2])
    git("update-ref", "refs/heads/main", merged, main)
    sys.exit(0)
sys.stderr.write("stub gh: unexpected call\\n")
sys.exit(1)
"""


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return done.stdout.strip()


def git_env(root: Path) -> dict[str, str]:
    """A git that reads no user or system configuration and dates every commit alike."""
    config = root / "gitconfig"
    config.write_text("[init]\n\tdefaultBranch = main\n")
    return {
        "GIT_CONFIG_GLOBAL": str(config),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_AUTHOR_NAME": "t",
        "GIT_AUTHOR_EMAIL": "t@example.com",
        "GIT_COMMITTER_NAME": "t",
        "GIT_COMMITTER_EMAIL": "t@example.com",
        "GIT_AUTHOR_DATE": "2026-10-15T10:00:00Z",
        "GIT_COMMITTER_DATE": "2026-10-15T10:00:00Z",
    }


def _edit(dev: Path, path: str, where: str, label: str) -> None:
    target = dev / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if where == "new":
        target.write_text(f"{label}\n")
    else:
        rows = target.read_text().splitlines()
        rows[0 if where == "top" else -1] = label
        target.write_text("\n".join(rows) + "\n")
    git(dev, "add", path)


def build_hub(
    root: Path,
    main_moves: list[dict[str, str]],
    prs: dict[int, tuple[str, dict[str, str]]],
) -> dict[str, str]:
    """The hub (`root/hub.git`) and its shas. `fork` holds the two shared files; each of `main_moves`
    is one commit on main after it (`main1`, `main2`, ...; `tip` is main's last); each PR `n: (at,
    edits)` is one commit cut from `fork` or `tip`, its head `shas[str(n)]` pushed as
    `refs/pull/<n>/head`. Run with `git_env` set."""
    hub = root / "hub.git"
    dev = root / "dev"
    subprocess.run(["git", "init", "-q", "--bare", str(hub)], check=True)
    subprocess.run(["git", "init", "-q", str(dev)], check=True)
    for path in (SHARED, SCREEN):
        target = dev / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("".join(f"line {i} of {path}\n" for i in range(1, LINES + 1)))
    (dev / "README.md").write_text("fork\n")
    git(dev, "add", "README.md", SHARED, SCREEN)
    git(dev, "commit", "-q", "-m", "fork")
    shas = {"fork": git(dev, "rev-parse", "HEAD")}
    shas["tip"] = shas["fork"]
    for index, edits in enumerate(main_moves, start=1):
        for path, where in edits.items():
            _edit(dev, path, where, f"main {index} changed {path}")
        git(dev, "commit", "-q", "-m", f"main moves on ({index})")
        shas[f"main{index}"] = shas["tip"] = git(dev, "rev-parse", "HEAD")
    for number, (at, edits) in prs.items():
        git(dev, "checkout", "-q", "-b", f"pr{number}", shas[at])
        for path, where in edits.items():
            _edit(dev, path, where, f"pr {number} changed {path}")
        git(dev, "commit", "-q", "-m", f"pr {number} change")
        shas[str(number)] = git(dev, "rev-parse", "HEAD")
        git(dev, "checkout", "-q", "main")
    refs = [f"{shas[str(n)]}:refs/pull/{n}/head" for n in prs]
    git(dev, "push", "-q", str(hub), "main:refs/heads/main", *refs)
    return shas


def hub_world(
    root: Path,
    main_moves: list[dict[str, str]],
    prs: dict[int, tuple[str, dict[str, str]]],
) -> dict[str, str]:
    """`build_hub` under a clean git environment that is undone afterwards."""
    with pytest.MonkeyPatch.context() as patch:
        for key, value in git_env(root).items():
            patch.setenv(key, value)
        return build_hub(root, main_moves, prs)


def enter_land(
    root: Path,
    heads: dict[int, str],
    monkeypatch: pytest.MonkeyPatch,
    *,
    conflicting: Iterable[int] = (),
) -> Path:
    """A fresh `work` clone of the hub on `main` as the current directory, the stub gh first on PATH
    answering for `heads` (PR number to head sha); PRs in `conflicting` are reported CONFLICTING."""
    for key, value in git_env(root).items():
        monkeypatch.setenv(key, value)
    hub = root / "hub.git"
    work = root / "work"
    subprocess.run(["git", "clone", "-q", str(hub), str(work)], check=True)
    bin_dir = root / "bin"
    bin_dir.mkdir()
    stub = bin_dir / "gh"
    stub.write_text(f"#!{sys.executable}\n{STUB_GH}")
    stub.chmod(0o755)
    clash = set(conflicting)
    state = {
        "hub": str(hub),
        "rollup": rollup("green", "0" * 40),
        "prs": {str(n): {"head": head, "conflicting": n in clash} for n, head in heads.items()},
    }
    (root / "gh-state.json").write_text(json.dumps(state))
    monkeypatch.setenv("S29F4_GH_STATE", str(root / "gh-state.json"))
    monkeypatch.setenv("S29F4_GH_LOG", str(root / "gh-calls.log"))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.chdir(work)
    return work


def merges(root: Path) -> list[list[str]]:
    """Every `gh pr merge` call, oldest first."""
    log = root / "gh-calls.log"
    calls = [json.loads(line) for line in log.read_text().splitlines()] if log.is_file() else []
    return [call for call in calls if call[:2] == ["pr", "merge"]]


def record(store: Path, pr: int, head: str) -> None:
    """A ledger PASS for this head, in `scripts.ledger`'s shape."""
    body = {
        "schema_version": 1,
        "pr": pr,
        "head": head,
        "round": 1,
        "verdict": "PASS",
        "counts": {
            "reviewers": 2,
            "findings": 0,
            "findings_ge_50": 0,
            "confirmed": 0,
            "refuted": 0,
            "unproven": 0,
            "unrefuted_ge_50": 0,
        },
        "decision_input_sha256": "ab" * 32,
        "comment_id": 100,
        "exception": None,
        "source": "review-pr",
        "recorded_at": "2026-10-15T10:00:00Z",
    }
    store.mkdir(parents=True, exist_ok=True)
    (store / f"{pr}-{head}.json").write_text(json.dumps(body))


def is_risk(paths: Iterable[str]) -> bool:
    """The scripted risk tier: a path under `engine/` or `.claude/hooks/`."""
    return any(str(path).startswith(RISK_ROOTS) for path in paths)


def risk(monkeypatch: pytest.MonkeyPatch) -> None:
    """Script `scripts.factory.tiers.is_risk` (S29-F7's seam) as `is_risk` above."""
    tiers: Any = importlib.import_module("scripts.factory.tiers")
    monkeypatch.setattr(tiers, "is_risk", is_risk)
    for module in (land, merge_ready):
        if hasattr(module, "is_risk"):
            monkeypatch.setattr(module, "is_risk", is_risk)
