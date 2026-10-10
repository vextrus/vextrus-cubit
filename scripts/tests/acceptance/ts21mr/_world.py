"""Shared helpers for ticket S21-MR's acceptance tests (not a test file).

A world is a tmp bare `hub.git` (GitHub's side: `refs/heads/main` and `refs/pull/<n>/head`), a `work`
clone of it that is the current directory when `merge_ready` runs (as the main checkout is), and a stub
`gh` first on PATH. The stub answers `gh api graphql` with the world's pull request, capped as GitHub
caps it (`files(first: 100)`, `commits(last: 250)`), refuses `gh pr diff` as GitHub refuses a diff over
20000 lines (exit 1, HTTP 406 too_large), and refuses anything else. No network, no real drawing.

The PR forks main at FORK and adds `PR_FILES` files of `LINES` lines each (21000 added lines in all) in
its first commit, then `PR_COMMITS - 1` empty commits; main then moves on (MAIN_ONLY), so the base the
GraphQL reports is main's newer tip and only the three-dot range is the PR's own change.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

PR = 7
PR_COMMITS = 260
LINES = 140
DOCS = [f"docs/f{n:03d}.md" for n in range(1, 101)]
CODE = [f"pkg/f{n:03d}.py" for n in range(101, 149)]
SPACED = "pkg/f149 with space.py"
# The 150th file: its name carries a non-ASCII word (git quotes such a name unless told not to).
NAME_SENTINEL = "নমুনা"
FILE_150 = f"pkg/f150 {NAME_SENTINEL}.py"
PR_FILES = [*DOCS, *CODE, SPACED, FILE_150]
DIFF_SENTINEL = "diff-sentinel-in-the-150th-file"
FIRST_MESSAGE = "pr commit 1 message-sentinel-beyond-the-last-250"
MAIN_ONLY = "main-only.txt"
MAIN_ONLY_MESSAGE = "main moved on after the fork"
LATE = "pkg/pushed-after-graphql.py"
STUB_GH = """import json, os, sys
args = sys.argv[1:]
with open(os.environ["S21MR_GH_LOG"], "a") as log:
    log.write(json.dumps(args) + "\\n")
if args[:2] == ["api", "graphql"]:
    with open(os.environ["S21MR_GH_ANSWER"]) as answer:
        sys.stdout.write(answer.read())
    sys.exit(0)
if args[:2] == ["pr", "diff"]:
    sys.stderr.write("could not find pull request diff: HTTP 406: Sorry, the diff exceeded the maximum "
                     "number of lines (20000) (https://api.github.com/graphql)\\n"
                     "PullRequest.diff too_large\\n")
    sys.exit(1)
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
        "GIT_AUTHOR_DATE": "2026-10-10T10:00:00Z",
        "GIT_COMMITTER_DATE": "2026-10-10T10:00:00Z",
    }


def build_hub(root: Path) -> dict[str, str]:
    """The hub (`root/hub.git`) and the shas: fork, pr head, a later pr tip, main's tip."""
    hub = root / "hub.git"
    dev = root / "dev"
    subprocess.run(["git", "init", "-q", "--bare", str(hub)], check=True)
    subprocess.run(["git", "init", "-q", str(dev)], check=True)
    (dev / "README.md").write_text("fork\n")
    git(dev, "add", "README.md")
    git(dev, "commit", "-q", "-m", "fork")
    fork = git(dev, "rev-parse", "HEAD")
    git(dev, "checkout", "-q", "-b", "pr")
    for path in PR_FILES:
        target = dev / path
        target.parent.mkdir(parents=True, exist_ok=True)
        rows = [f"line {i} of {path}" for i in range(1, LINES + 1)]
        if path == FILE_150:
            rows[-1] = f"x = '{DIFF_SENTINEL}'"
        target.write_text("\n".join(rows) + "\n")
    git(dev, "add", "--", *PR_FILES)
    git(dev, "commit", "-q", "-m", FIRST_MESSAGE)
    tree = git(dev, "rev-parse", "HEAD^{tree}")
    head = git(dev, "rev-parse", "HEAD")
    for n in range(2, PR_COMMITS + 1):
        head = git(dev, "commit-tree", tree, "-p", head, "-m", f"pr commit {n}")
    git(dev, "reset", "-q", "--hard", head)
    (dev / LATE).write_text("late = 1\n")
    git(dev, "add", LATE)
    git(dev, "commit", "-q", "-m", "pushed after the graphql answer")
    late = git(dev, "rev-parse", "HEAD")
    git(dev, "checkout", "-q", "main")
    (dev / MAIN_ONLY).write_text("main only\n")
    git(dev, "add", MAIN_ONLY)
    git(dev, "commit", "-q", "-m", MAIN_ONLY_MESSAGE)
    base = git(dev, "rev-parse", "HEAD")
    git(dev, "push", "-q", str(hub), "main:refs/heads/main", f"{head}:refs/pull/{PR}/head")
    return {"fork": fork, "head": head, "late": late, "base": base, "dev": str(dev)}


def answer(head: str, base: str, files: list[str], messages: list[str]) -> dict[str, Any]:
    """The REVIEW_QUERY answer GitHub gives: the first 100 files, the last 250 commits."""
    return {
        "data": {
            "repository": {
                "pullRequest": {
                    "headRefOid": head,
                    "headRefName": "s21-big",
                    "baseRefOid": base,
                    "baseRefName": "main",
                    "title": "a big train",
                    "body": "",
                    "comments": {"nodes": [{"databaseId": 7, "body": marker(head)}]},
                    "files": {"nodes": [{"path": path} for path in sorted(files)[:100]]},
                    "commits": {"nodes": [{"commit": {"message": m}} for m in messages[-250:]]},
                }
            }
        }
    }


def marker(head: str) -> str:
    return f"<!-- vextrus-review round=1 head={head} verdict=PASS findings=0 -->"


def pr_messages() -> list[str]:
    return [FIRST_MESSAGE, *(f"pr commit {n}" for n in range(2, PR_COMMITS + 1))]


def enter(root: Path, hub: Path, gh_answer: dict[str, Any], monkeypatch: Any) -> Path:
    """A fresh `work` clone of the hub as the current directory, the stub gh first on PATH."""
    for key, value in git_env(root).items():
        monkeypatch.setenv(key, value)
    work = root / "work"
    subprocess.run(["git", "clone", "-q", str(hub), str(work)], check=True)
    bin_dir = root / "bin"
    bin_dir.mkdir()
    stub = bin_dir / "gh"
    stub.write_text(f"#!{sys.executable}\n{STUB_GH}")
    stub.chmod(0o755)
    (root / "gh-answer.json").write_text(json.dumps(gh_answer))
    monkeypatch.setenv("S21MR_GH_ANSWER", str(root / "gh-answer.json"))
    monkeypatch.setenv("S21MR_GH_LOG", str(root / "gh-calls.log"))
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.chdir(work)
    return work


def statuses(head: str) -> dict[str, Any]:
    """`fetch`'s answer for a head both gates and CI passed."""
    gate = {"state": "SUCCESS", "description": "", "creator": {"login": "vextrus-status"}}
    return {
        "state": "OPEN",
        "headRefOid": head,
        "commits": {
            "nodes": [
                {
                    "commit": {
                        "oid": head,
                        "status": {
                            "contexts": [
                                {"context": "real-drawings", **gate},
                                {"context": "design-gate", **gate},
                            ]
                        },
                        "checkSuites": {
                            "nodes": [
                                {
                                    "checkRuns": {
                                        "nodes": [
                                            {
                                                "name": "ci",
                                                "status": "COMPLETED",
                                                "conclusion": "SUCCESS",
                                            }
                                        ]
                                    }
                                }
                            ]
                        },
                    }
                }
            ]
        },
    }


def ledger(root: Path, pr: int, head: str) -> Path:
    """A ledger PASS for the head, its marker comment 7 (as `answer` puts on the PR)."""
    folder = root / "ledger"
    folder.mkdir()
    counts = dict.fromkeys(
        ("reviewers", "findings", "findings_ge_50", "confirmed", "refuted", "unproven"), 0
    ) | {"reviewers": 2, "unrefuted_ge_50": 0}
    record = {
        "schema_version": 1,
        "pr": pr,
        "head": head,
        "round": 1,
        "verdict": "PASS",
        "counts": counts,
        "decision_input_sha256": "ab" * 32,
        "comment_id": 7,
        "exception": None,
        "source": "review-pr",
        "recorded_at": "2026-10-10T10:00:00Z",
    }
    (folder / f"{pr}-{head}.json").write_text(json.dumps(record))
    return folder
