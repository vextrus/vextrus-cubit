"""Shared helpers for ticket S22-647's acceptance tests (not a test file).

A world is a tmp bare `hub.git` (GitHub's side: `refs/heads/main` and `refs/pull/<n>/head`), a `work`
clone of it that is the current directory when the lander runs (as the main checkout is), and a stub
`gh` first on PATH. The stub answers `gh pr view <n> --json ...` (with `-q .<field>`), `gh api graphql`
(merge_ready's shape, files capped at 100) and `gh api repos/<repo>/pulls/<n>` from the world's pull
requests; it refuses `gh pr diff` for the big PR as GitHub refuses a diff over 20000 lines (exit 1, HTTP
406 too_large) and answers it for the small ones. Every call is logged. No network, no real drawing.

The pull requests (all forked from main's first commit; main then moves on, MAIN_ONLY):
- BIG (7): 150 files added; the first 149 are not engine paths, the 150th added is `engine/...`.
- SMALL (5): one document. It is no engine PR and touches none of BIG's files.
- NO_REF (8): GitHub names it, but the hub has no `refs/pull/8/head` (the fetch fails).
- GONE_BASE (9): its pull ref exists; GitHub reports a base commit git does not hold.
- GONE_HEAD (10): its pull ref exists; GitHub reports a head commit git does not hold.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

BIG, SMALL, NO_REF, GONE_BASE, GONE_HEAD = 7, 5, 8, 9, 10
GONE = "0123456789abcdef0123456789abcdef01234567"
NAME_SENTINEL = "নমুনা"
SPACED = "docs/f148 with space.md"
NON_ASCII = f"docs/f149 {NAME_SENTINEL}.md"
ENGINE_FILE = "engine/reader/f150.py"
BIG_FILES = [*(f"docs/f{n:03d}.md" for n in range(1, 148)), SPACED, NON_ASCII, ENGINE_FILE]
SMALL_FILES = ["docs/small.md"]
OTHER_FILES = {GONE_BASE: ["pkg/nine.py"], GONE_HEAD: ["pkg/ten.py"]}
MAIN_ONLY = "main-only.txt"
STUB_GH = """import json, os, re, sys
args = sys.argv[1:]
with open(os.environ["S22L647_GH_LOG"], "a") as log:
    log.write(json.dumps(args) + "\\n")
with open(os.environ["S22L647_GH_WORLD"]) as world:
    prs = json.load(world)

def pull(number):
    if str(number) not in prs:
        sys.stderr.write("GraphQL: Could not resolve to a PullRequest %s.\\n" % number)
        sys.exit(1)
    return prs[str(number)]

def value(flag):
    return args[args.index(flag) + 1] if flag in args else None

if args[:2] == ["pr", "view"]:
    pr = pull(args[2])
    fields = {k: v for k, v in pr.items() if k != "files"}
    query = value("-q") or value("--jq")
    if query:
        if not re.fullmatch(r"\\.[A-Za-z]+", query):
            sys.stderr.write("stub gh: unsupported -q\\n")
            sys.exit(1)
        out = fields[query[1:]]
        print(out if isinstance(out, str) else json.dumps(out))
    else:
        wanted = (value("--json") or "").split(",")
        print(json.dumps({k: fields[k] for k in wanted if k in fields}))
    sys.exit(0)
if args[:2] == ["api", "graphql"]:
    number = next(a.split("=", 1)[1] for a in args if a.startswith("pr="))
    pr = pull(number)
    node = {k: v for k, v in pr.items() if k != "files"}
    node |= {"title": "t", "body": "", "comments": {"nodes": []}, "commits": {"nodes": []},
             "files": {"nodes": [{"path": p} for p in sorted(pr["files"])[:100]]}}
    print(json.dumps({"data": {"repository": {"pullRequest": node}}}))
    sys.exit(0)
if args[:1] == ["api"] and len(args) > 1 and re.fullmatch(r"/?repos/[^/]+/[^/]+/pulls/\\d+", args[1]):
    pr = pull(args[1].rsplit("/", 1)[1])
    print(json.dumps({"number": pr["number"], "state": "open",
                      "head": {"sha": pr["headRefOid"], "ref": pr["headRefName"]},
                      "base": {"sha": pr["baseRefOid"], "ref": pr["baseRefName"]}}))
    sys.exit(0)
if args[:2] == ["pr", "diff"]:
    pr = pull(args[2])
    if pr["number"] == BIG_NUMBER:
        sys.stderr.write("could not find pull request diff: HTTP 406: Sorry, the diff exceeded the "
                         "maximum number of lines (20000) (https://api.github.com/graphql)\\n"
                         "PullRequest.diff too_large\\n")
        sys.exit(1)
    print("\\n".join(pr["files"]))
    sys.exit(0)
sys.stderr.write("stub gh: unexpected call\\n")
sys.exit(1)
""".replace("BIG_NUMBER", str(BIG))


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
        "GIT_AUTHOR_DATE": "2026-10-11T10:00:00Z",
        "GIT_COMMITTER_DATE": "2026-10-11T10:00:00Z",
    }


def _branch(dev: Path, fork: str, name: str, files: list[str]) -> str:
    git(dev, "checkout", "-q", "-b", name, fork)
    for path in files:
        target = dev / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f"{name}: {path}\n")
    git(dev, "add", "--", *files)
    git(dev, "commit", "-q", "-m", f"{name} change")
    return git(dev, "rev-parse", "HEAD")


def build_hub(root: Path) -> dict[str, str]:
    """The hub (`root/hub.git`) and its shas: fork, main's tip (`base`), and each PR's head."""
    hub = root / "hub.git"
    dev = root / "dev"
    subprocess.run(["git", "init", "-q", "--bare", str(hub)], check=True)
    subprocess.run(["git", "init", "-q", str(dev)], check=True)
    (dev / "README.md").write_text("fork\n")
    (dev / ".github").mkdir()
    (dev / ".github" / "engine-paths.txt").write_text("# the engine paths\nengine/**\n")
    git(dev, "add", "README.md", ".github/engine-paths.txt")
    git(dev, "commit", "-q", "-m", "fork")
    fork = git(dev, "rev-parse", "HEAD")
    shas = {"fork": fork}
    shas[str(BIG)] = _branch(dev, fork, "big", BIG_FILES)
    shas[str(SMALL)] = _branch(dev, fork, "small", SMALL_FILES)
    shas[str(GONE_BASE)] = _branch(dev, fork, "nine", OTHER_FILES[GONE_BASE])
    shas[str(GONE_HEAD)] = _branch(dev, fork, "ten", OTHER_FILES[GONE_HEAD])
    git(dev, "checkout", "-q", "main")
    (dev / MAIN_ONLY).write_text("main only\n")
    git(dev, "add", MAIN_ONLY)
    git(dev, "commit", "-q", "-m", "main moved on after the fork")
    shas["base"] = git(dev, "rev-parse", "HEAD")
    refs = [f"{shas[str(n)]}:refs/pull/{n}/head" for n in (BIG, SMALL, GONE_BASE, GONE_HEAD)]
    git(dev, "push", "-q", str(hub), "main:refs/heads/main", *refs)
    return shas


def pulls(shas: dict[str, str]) -> dict[str, dict[str, Any]]:
    """What GitHub says of each PR (head and base as `gh pr view --json` names them)."""

    def one(number: int, head: str, base: str, files: list[str]) -> dict[str, Any]:
        return {
            "number": number,
            "state": "OPEN",
            "isDraft": True,
            "headRefOid": head,
            "headRefName": f"s22-pr{number}",
            "baseRefOid": base,
            "baseRefName": "main",
            "mergeable": "MERGEABLE",
            "mergeStateStatus": "CLEAN",
            "files": files,
        }

    base = shas["base"]
    return {
        str(BIG): one(BIG, shas[str(BIG)], base, BIG_FILES),
        str(SMALL): one(SMALL, shas[str(SMALL)], base, SMALL_FILES),
        str(NO_REF): one(NO_REF, GONE, base, ["pkg/eight.py"]),
        str(GONE_BASE): one(GONE_BASE, shas[str(GONE_BASE)], GONE, OTHER_FILES[GONE_BASE]),
        str(GONE_HEAD): one(GONE_HEAD, GONE, base, OTHER_FILES[GONE_HEAD]),
    }


def enter(root: Path, hub: Path, shas: dict[str, str], monkeypatch: Any) -> Path:
    """A fresh `work` clone of the hub as the current directory, the stub gh first on PATH, and a
    ledger PASS for the head GitHub names of every PR (in the clone's default ledger folder)."""
    for key, value in git_env(root).items():
        monkeypatch.setenv(key, value)
    work = root / "work"
    subprocess.run(["git", "clone", "-q", str(hub), str(work)], check=True)
    bin_dir = root / "bin"
    bin_dir.mkdir()
    stub = bin_dir / "gh"
    stub.write_text(f"#!{sys.executable}\n{STUB_GH}")
    stub.chmod(0o755)
    world = pulls(shas)
    (root / "gh-world.json").write_text(json.dumps(world))
    monkeypatch.setenv("S22L647_GH_WORLD", str(root / "gh-world.json"))
    monkeypatch.setenv("S22L647_GH_LOG", str(root / "gh-calls.log"))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    ledger = work / ".private" / "work" / "factory" / "ledger"
    ledger.mkdir(parents=True)
    for number, pr in world.items():
        record = {
            "schema_version": 1,
            "pr": int(number),
            "head": pr["headRefOid"],
            "round": 1,
            "verdict": "PASS",
            "comment_id": 7,
            "exception": None,
        }
        (ledger / f"{number}-{pr['headRefOid']}.json").write_text(json.dumps(record))
    monkeypatch.chdir(work)
    return work


def gh_calls(root: Path) -> list[list[str]]:
    log = root / "gh-calls.log"
    return [json.loads(line) for line in log.read_text().splitlines()] if log.is_file() else []
