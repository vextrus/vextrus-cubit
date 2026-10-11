"""Shared helpers for ticket S21-MR's `pr` scan tests (not a test file).

A world is a tmp bare `hub.git` (GitHub's side: `refs/heads/main` and `refs/pull/7/head`), a `work`
clone of it that is the scanner's current directory (as the main checkout is), and a stub `gh` first on
PATH, written after `tools/leakscan/tests/acceptance/_gh_stub.py` but answering from this world's file:

- `gh pr view <n> --json ...` returns every field whatever is asked, `files` capped at the first 100
  and `commits` at the first 100 (gh reads one page);
- `gh api [--paginate] repos/{owner}/{repo}/...`: `pulls/<n>` (head and base shas), `pulls/<n>/files`
  and `pulls/<n>/commits` (capped alike), `pulls/<n>/comments`, `pulls/<n>/reviews`,
  `issues/<n>/comments`;
- `gh pr diff` exits 1 with GitHub's HTTP 406 too_large words, unless `S21MR_DIFF_OK=1`, when it
  prints a small clean diff (and `--name-only` its one name);
- anything else exits 1 "stub: unsupported".

The PR forks main at a commit whose message holds a corpus string (main's, not the PR's), then adds
file k in commit k for k = 1..150 (140 lines each: 21000 added lines) and 150 empty commits, the 300th's
message holding a corpus string; main moves on after the fork. So the files past the 100th arrive in
commits past the 100th: neither gh list reaches them. Every corpus string is the invented one of
`_leak.py`.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from tools.leakscan.tests.acceptance._leak import (
    COPPERFIELD,
    INDIGO,
    MARIGOLD,
    QUILLMOOR,
    SAFFRON,
    ZEBRA,
    git,
    git_env,
)

PR = 7
FILES = 150
COMMITS = 300
LINES = 140
FILE_150 = "pkg/f150.py"
NAMED = f"pkg/f149 {SAFFRON}.py"
BRANCH = "feature/quillmoor-estates-x"


def path_of(k: int) -> str:
    if k == 149:
        return NAMED
    if k == 150:
        return FILE_150
    return f"pkg/f{k:03d}.py"


STUB = r"""
import json, os, re, sys

args = sys.argv[1:]
log = os.environ.get("S21MR_GH_LOG")
if log:
    with open(log, "a") as handle:
        handle.write(json.dumps(args) + "\n")
with open(os.environ["S21MR_GH_WORLD"]) as handle:
    W = json.load(handle)


def out(value):
    sys.stdout.write(value if isinstance(value, str) else json.dumps(value))
    sys.exit(0)


def unsupported():
    sys.stderr.write("stub: unsupported " + " ".join(args) + "\n")
    sys.exit(1)


if args[:2] == ["auth", "status"]:
    out("")
if args[:2] == ["repo", "view"]:
    out({"nameWithOwner": "vextrus/vextrus-cubit", "name": "vextrus-cubit"})
if args[:2] == ["pr", "view"]:
    out(W["view"])
if args[:2] == ["pr", "diff"]:
    if os.environ.get("S21MR_DIFF_OK") == "1":
        out("docs/small.md\n" if "--name-only" in args else W["small_diff"])
    sys.stderr.write(
        "could not find pull request diff: HTTP 406: Sorry, the diff exceeded the maximum number of "
        "lines (20000) (https://api.github.com/graphql)\nPullRequest.diff too_large\n"
    )
    sys.exit(1)
if args[:1] == ["api"]:
    paths = [a for a in args[1:] if not a.startswith("-") and ("repos/" in a or a.startswith("/"))]
    if not paths:
        unsupported()
    path = paths[0].split("?")[0].rstrip("/")
    for pattern, key in (
        (r"/pulls/\d+$", "rest_pr"),
        (r"/pulls/\d+/files$", "rest_files"),
        (r"/pulls/\d+/commits$", "rest_commits"),
        (r"/pulls/\d+/comments$", "review_comments"),
        (r"/pulls/\d+/reviews$", "rest_reviews"),
        (r"/issues/\d+/comments$", "rest_comments"),
    ):
        if re.search(pattern, path):
            out(W[key])
unsupported()
"""


def build(root: Path) -> dict[str, Any]:
    """The hub (`root/hub.git`) and the world's shas."""
    hub = root / "hub.git"
    dev = root / "dev"
    root.mkdir(parents=True, exist_ok=True)
    git(root, "init", "-q", "--bare", str(hub))
    dev.mkdir()
    git(dev, "init", "-q", "-b", "main")
    (dev / "README.md").write_text("fork\n")
    git(dev, "add", "README.md")
    git(dev, "commit", "-q", "-m", f"fork: a commit of main's\n\n{QUILLMOOR} on main")
    fork = git(dev, "rev-parse", "HEAD")
    git(dev, "checkout", "-q", "-b", "pr")
    commits: list[str] = []
    for k in range(1, FILES + 1):
        path = path_of(k)
        rows = [f"line {i} of file {k}" for i in range(1, LINES + 1)]
        if k == FILES:
            rows[-1] = f"name = '{ZEBRA}'"
        (dev / path).parent.mkdir(parents=True, exist_ok=True)
        (dev / path).write_text("\n".join(rows) + "\n")
        git(dev, "add", "--", path)
        git(dev, "commit", "-q", "-m", f"pr commit {k}")
        commits.append(git(dev, "rev-parse", "HEAD"))
    tree = git(dev, "rev-parse", "HEAD^{tree}")
    head = commits[-1]
    for k in range(FILES + 1, COMMITS + 1):
        message = f"pr commit {k}" if k < COMMITS else f"pr commit {k}\n\n{INDIGO} noted"
        head = git(dev, "commit-tree", tree, "-p", head, "-m", message)
        commits.append(head)
    git(dev, "checkout", "-q", "main")
    (dev / "main-only.txt").write_text("main only\n")
    git(dev, "add", "main-only.txt")
    git(dev, "commit", "-q", "-m", "main moved on after the fork")
    base = git(dev, "rev-parse", "HEAD")
    git(dev, "push", "-q", str(hub), "main:refs/heads/main", f"{head}:refs/pull/{PR}/head")
    return {"hub": hub, "fork": fork, "head": head, "base": base, "commits": commits}


def gh_world(shas: dict[str, Any]) -> dict[str, Any]:
    """What GitHub answers for the PR, capped as gh reads it."""
    head, base, commits = shas["head"], shas["base"], shas["commits"]
    names = [path_of(k) for k in range(1, FILES + 1)]
    view_commits = [
        {"oid": oid, "messageHeadline": f"pr commit {k}", "messageBody": ""}
        for k, oid in enumerate(commits, start=1)
    ][:100]
    title = f"fix: {COPPERFIELD} in the title"
    body = f"line one of the body\n{MARIGOLD}\n"
    return {
        "view": {
            "number": PR,
            "title": title,
            "body": body,
            "headRefName": BRANCH,
            "headRefOid": head,
            "baseRefOid": base,
            "baseRefName": "main",
            "state": "OPEN",
            "comments": [{"id": 1001, "body": f"looks fine\n\n{COPPERFIELD}"}],
            "reviews": [{"id": 2002, "body": f"ok\n{SAFFRON}"}],
            "files": [{"path": path, "additions": LINES, "deletions": 0} for path in names][:100],
            "commits": view_commits,
        },
        "rest_pr": {
            "number": PR,
            "title": title,
            "body": body,
            "head": {"ref": BRANCH, "sha": head},
            "base": {"ref": "main", "sha": base},
            "state": "open",
        },
        "rest_files": [{"filename": path, "status": "added"} for path in names][:100],
        "rest_commits": [{"sha": oid, "commit": {"message": "c"}} for oid in commits][:100],
        "review_comments": [{"id": 3003, "body": f"nit\n{INDIGO}"}],
        "rest_reviews": [{"id": 2002, "body": f"ok\n{SAFFRON}"}],
        "rest_comments": [{"id": 1001, "body": f"looks fine\n\n{COPPERFIELD}"}],
        "small_diff": (
            "diff --git a/docs/small.md b/docs/small.md\nnew file mode 100644\n"
            "index 0000000..1111111\n--- /dev/null\n+++ b/docs/small.md\n@@ -0,0 +1 @@\n"
            "+a clean line\n"
        ),
    }


def install(folder: Path, world_file: Path, shas: dict[str, Any]) -> None:
    """The stub as `<folder>/gh`, answering from `world_file`."""
    folder.mkdir(parents=True, exist_ok=True)
    world_file.write_text(json.dumps(gh_world(shas)))
    gh = folder / "gh"
    gh.write_text(f"#!{sys.executable}\n" + STUB)
    gh.chmod(0o755)


def clone(hub: Path, where: Path) -> Path:
    subprocess.run(
        ["git", "clone", "-q", str(hub), str(where)], env=git_env(), check=True, capture_output=True
    )
    return where
