"""`python -m scripts.factory.crosspr <branch>`: the cross-PR check a builder runs before READY.

For every open PR (read from `gh`) that touches any file the branch changed, the branch's own PR
excluded, it asks `git merge-tree` whether the branch and that PR merge, then runs the union's changed
tests (the test files either side changed) in a temporary worktree on `origin/main` plus both. A conflict
or a failing test refuses, naming the PR and the branch (exit 1); the last line of a pass is
`Cross-PR: #51 #53 ok` (ascending) or `Cross-PR: none ok`, the line the READY commit message carries.

It only reads: no push, no mutating `gh` call, no change to the clone's branches, index or working tree.
Its output is kept under the clone's `.private/work/crosspr/`. Run it from a clone that has `origin` and
`origin/main`. Exit codes: 0 every check passed, 1 a conflict or test failure, 2 it could not run.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

TEST_FILE = re.compile(r"(?:^|/)(?:test_[^/]*|[^/]*_test)\.py$|(?:^|/)tests?/[^/]*\.py$")
IDENTITY = ("-c", "user.name=crosspr", "-c", "user.email=crosspr@example.invalid")
OUTPUT_TAIL = 60


class Refusal(Exception):
    """The check could not run (exit 2)."""


def git(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=False, cwd=cwd)


def git_out(*args: str) -> str:
    done = git(*args)
    if done.returncode != 0:
        raise Refusal(f"git {args[0]} failed: {done.stderr.strip()}")
    return done.stdout.strip()


def gh(*args: str) -> str:
    try:
        done = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    except OSError as error:
        raise Refusal(f"gh could not be run: {error}") from error
    if done.returncode != 0:
        raise Refusal(f"gh {' '.join(args[:2])} failed: {done.stderr.strip()}")
    return done.stdout


def repo_slug() -> str:
    url = git_out("remote", "get-url", "origin")
    match = re.search(r"github\.com[:/]([^/]+/[^/]+?)(?:\.git)?/?$", url)
    if not match:
        raise Refusal(f"origin is not a github.com remote: {url}")
    return match[1]


def open_prs() -> list[dict[str, object]]:
    """Open PRs as `number`, `headRefName`, `headRefOid` and `files` (`[{"path": ...}]`). `gh pr list`
    needs GraphQL, which a cloud session lacks, so the REST API answers when it fails."""
    try:
        listed: list[dict[str, object]] = json.loads(
            gh(
                *("pr", "list", "--state", "open", "--base", "main", "--limit", "200"),
                *("--json", "number,headRefName,headRefOid,files"),
            )
        )
        return listed
    except Refusal:
        pass
    slug = repo_slug()
    prs: list[dict[str, object]] = []
    for pr in json.loads(gh("api", f"repos/{slug}/pulls?state=open&base=main&per_page=100")):
        files = json.loads(gh("api", f"repos/{slug}/pulls/{pr['number']}/files?per_page=100"))
        prs.append(
            {
                "number": pr["number"],
                "headRefName": pr["head"]["ref"],
                "headRefOid": pr["head"]["sha"],
                "files": [{"path": item["filename"]} for item in files],
            }
        )
    return prs


def resolve(ref: str) -> str:
    for candidate in (ref, f"origin/{ref}"):
        done = git("rev-parse", "--verify", "--quiet", f"{candidate}^{{commit}}")
        if done.returncode == 0:
            return done.stdout.strip()
    raise Refusal(f"{ref} is not a commit here")


def pr_head(number: int, oid: str, name: str) -> str:
    if git("cat-file", "-e", f"{oid}^{{commit}}").returncode == 0:
        return oid
    for ref in (f"refs/pull/{number}/head", f"refs/heads/{name}"):
        if git("fetch", "-q", "origin", ref).returncode == 0:
            return git_out("rev-parse", "FETCH_HEAD")
    raise Refusal(f"#{number}: its head {oid} is not fetchable from origin")


def tail(text: str) -> str:
    lines = text.splitlines()
    return "\n".join(lines[-OUTPUT_TAIL:])


def check_pr(root: Path, branch: str, tip: str, number: int, head: str) -> str | None:
    """None when the union passes; otherwise the reason it refuses."""
    merged = git("merge-tree", "--write-tree", "--name-only", tip, head)
    if merged.returncode != 0:
        return f"crosspr: #{number} and {branch} conflict:\n{tail(merged.stdout + merged.stderr)}"
    kept = root / ".private" / "work" / "crosspr"
    kept.mkdir(parents=True, exist_ok=True)
    tree = kept / f"worktree-{number}"
    added = git("worktree", "add", "--detach", "-q", str(tree), "origin/main", cwd=root)
    if added.returncode != 0:
        raise Refusal(f"git worktree add failed: {added.stderr.strip()}")
    try:
        for side in (tip, head):
            joined = git(*IDENTITY, "merge", "--no-edit", "-q", side, cwd=tree)
            if joined.returncode != 0:
                return (
                    f"crosspr: #{number} and {branch} conflict on origin/main:\n"
                    f"{tail(joined.stdout + joined.stderr)}"
                )
        changed = {
            *git_out("diff", "--name-only", "origin/main", tip).splitlines(),
            *git_out("diff", "--name-only", "origin/main", head).splitlines(),
        }
        tests = sorted(p for p in changed if TEST_FILE.search(p) and (tree / p).is_file())
        if not tests:
            return None
        ran = subprocess.run(
            [sys.executable, "-m", "pytest", "-rf", "-q", "-p", "no:cacheprovider", *tests],
            capture_output=True,
            text=True,
            check=False,
            cwd=tree,
        )
        output = ran.stdout + ran.stderr
        (kept / f"pr-{number}.txt").write_text(output)
        if ran.returncode != 0:
            return (
                f"crosspr: #{number} and {branch} break each other: tests failed on their union "
                f"({', '.join(tests)}); output in .private/work/crosspr/pr-{number}.txt\n{tail(output)}"
            )
        return None
    finally:
        git("worktree", "remove", "--force", str(tree), cwd=root)


def run(branch: str) -> int:
    root = Path(git_out("rev-parse", "--show-toplevel"))
    tip = resolve(branch)
    resolve("origin/main")
    mine = set(git_out("diff", "--name-only", f"origin/main...{tip}").splitlines())
    touching = []
    for pr in open_prs():
        if pr["headRefName"] == branch:
            continue
        files = {item["path"] for item in pr["files"]}  # type: ignore[attr-defined]
        if files & mine:
            touching.append(pr)
    touching.sort(key=lambda pr: int(pr["number"]))  # type: ignore[call-overload]
    refused = []
    for pr in touching:
        number = int(pr["number"])  # type: ignore[call-overload]
        head = pr_head(number, str(pr["headRefOid"]), str(pr["headRefName"]))
        problem = check_pr(root, branch, tip, number, head)
        if problem:
            refused.append(problem)
            print(problem, file=sys.stderr)
        else:
            print(f"crosspr: #{number} and {branch} merge and pass together", file=sys.stderr)
    if refused:
        print(f"crosspr: refused: {len(refused)} of {len(touching)} open PRs", file=sys.stderr)
        return 1
    listed = " ".join(f"#{pr['number']}" for pr in touching) or "none"
    print(f"Cross-PR: {listed} ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print("usage: python -m scripts.factory.crosspr <branch>", file=sys.stderr)
        return 2
    try:
        return run(args[0])
    except Refusal as error:
        print(f"crosspr: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
