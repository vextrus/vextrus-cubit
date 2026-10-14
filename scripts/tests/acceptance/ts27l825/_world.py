"""Shared helpers for ticket S27-L825's acceptance tests (not a test file).

The multi-PR world: a tmp bare `hub.git` (GitHub's side: `refs/heads/main` and `refs/pull/<n>/head`), a
`work` clone of it on `main` (the main checkout), and a stub `gh` first on PATH that answers what
`scripts.land.Gh` asks of gh 2.45 for several PRs at once:

- `pr view <n> --json <fields> [-q .<field>]`: `headRefOid`, `statusCheckRollup` (the recorded green
  rollup of `p6_land/fixtures`, for the PR's head), `mergeable` MERGEABLE, `mergeStateStatus` CLEAN;
- `pr ready <n>`: ok;
- `pr merge <n> ... --match-head-commit <sha>`: as GitHub merges, a merge commit of the head into the
  hub's `main` (`main` moves on); a sha that is not the PR's head exits 1;
- anything else exits 1. Every call is logged.

No network, no real drawing.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from scripts.tests.acceptance.p6_land._fakegh import rollup

STUB_GH = """import json, os, subprocess, sys
args = [a for a in sys.argv[1:]]
with open(os.environ["S27L825_GH_LOG"], "a") as log:
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
state_path = os.environ["S27L825_GH_STATE"]
with open(state_path) as handle:
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
    rollup = dict(state["rollup"])
    rollup["headRefOid"] = pr["head"]
    payload = {"headRefOid": pr["head"], "statusCheckRollup": rollup["statusCheckRollup"],
               "mergeable": "MERGEABLE", "mergeStateStatus": "CLEAN"}
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
        "GIT_AUTHOR_DATE": "2026-10-14T10:00:00Z",
        "GIT_COMMITTER_DATE": "2026-10-14T10:00:00Z",
    }


def build_hub(root: Path, branches: dict[int, tuple[str, str]], *, main_moves: bool) -> dict[str, str]:
    """The hub (`root/hub.git`) and its shas. Main starts at `fork`; with `main_moves`, main moves on
    to `tip` after the fork. Each PR `n: (file, at)` adds one file on a branch cut from `fork` or
    `tip` (`at`); its head is `shas[str(n)]`, pushed as `refs/pull/<n>/head`."""
    hub = root / "hub.git"
    dev = root / "dev"
    subprocess.run(["git", "init", "-q", "--bare", str(hub)], check=True)
    subprocess.run(["git", "init", "-q", str(dev)], check=True)
    (dev / "README.md").write_text("fork\n")
    git(dev, "add", "README.md")
    git(dev, "commit", "-q", "-m", "fork")
    shas = {"fork": git(dev, "rev-parse", "HEAD")}
    shas["tip"] = shas["fork"]
    if main_moves:
        (dev / "main-only.txt").write_text("main moved on\n")
        git(dev, "add", "main-only.txt")
        git(dev, "commit", "-q", "-m", "main moves on")
        shas["tip"] = git(dev, "rev-parse", "HEAD")
    for number, (path, at) in branches.items():
        git(dev, "checkout", "-q", "-b", f"pr{number}", shas[at])
        target = dev / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f"pr {number}\n")
        git(dev, "add", path)
        git(dev, "commit", "-q", "-m", f"pr {number} change")
        shas[str(number)] = git(dev, "rev-parse", "HEAD")
    git(dev, "checkout", "-q", "main")
    refs = [f"{shas[str(n)]}:refs/pull/{n}/head" for n in branches]
    git(dev, "push", "-q", str(hub), "main:refs/heads/main", *refs)
    return shas


def enter(root: Path, hub: Path, heads: dict[int, str], monkeypatch: Any) -> Path:
    """A fresh `work` clone of the hub on `main` as the current directory, the stub gh first on PATH
    answering for `heads` (PR number to head sha)."""
    for key, value in git_env(root).items():
        monkeypatch.setenv(key, value)
    work = root / "work"
    subprocess.run(["git", "clone", "-q", str(hub), str(work)], check=True)
    bin_dir = root / "bin"
    bin_dir.mkdir()
    stub = bin_dir / "gh"
    stub.write_text(f"#!{sys.executable}\n{STUB_GH}")
    stub.chmod(0o755)
    state = {
        "hub": str(hub),
        "rollup": rollup("green", "0" * 40),
        "prs": {str(n): {"head": head} for n, head in heads.items()},
    }
    (root / "gh-state.json").write_text(json.dumps(state))
    monkeypatch.setenv("S27L825_GH_STATE", str(root / "gh-state.json"))
    monkeypatch.setenv("S27L825_GH_LOG", str(root / "gh-calls.log"))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.chdir(work)
    return work


def gh_calls(root: Path) -> list[list[str]]:
    log = root / "gh-calls.log"
    return [json.loads(line) for line in log.read_text().splitlines()] if log.is_file() else []


def merges(root: Path) -> list[list[str]]:
    """Every `gh pr merge` call, oldest first."""
    return [call for call in gh_calls(root) if call[:2] == ["pr", "merge"]]


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
        "recorded_at": "2026-10-14T10:00:00Z",
    }
    store.mkdir(parents=True, exist_ok=True)
    (store / f"{pr}-{head}.json").write_text(json.dumps(body))
