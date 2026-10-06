"""`python -m scripts.factory.crosspr <branch> [--tree <sha>]`: the cross-PR check run before READY.

For every open PR (read from `gh`) that touches any file the branch changed, the branch's own PR
excluded, it asks `git merge-tree` whether the branch and that PR merge, then runs the union's changed
tests (the test files either side changed) in a temporary worktree on `origin/main` plus both. A conflict
or a failing test refuses, naming the PR and the branch (exit 1); the last line of a pass is
`Cross-PR: #51 #53 ok` (ascending) or `Cross-PR: none ok`, the line the READY commit message carries.

Running a PR's tests runs its code, so only a PR from one of this repository's own branches by an author
listed in `trusted-authors.txt` has its tests run; every other PR gets `merge-tree` only and the output
says so. Only Python tests run: when a union changes web tests the last line reads
`Cross-PR: #51 web not run` in place of `ok` (exit 0, the web side unchecked). `--tree <sha>` checks that
tree (verify's staged tree) as a commit on the branch's tip instead of the tip itself.

It only reads: no push, no mutating `gh` call, no change to the clone's branches, index or working tree.
Every subprocess has a time limit (the process group is killed on expiry). Its output is kept under the
clone's `.private/work/crosspr/`. Run it from a clone that has `origin` and `origin/main`. Exit codes:
0 every check passed, 1 a conflict or test failure, 2 it could not run.
"""

import json
import os
import re
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

TEST_FILE = re.compile(r"(?:^|/)(?:test_[^/]*|[^/]*_test)\.py$|(?:^|/)tests?/[^/]*\.py$")
WEB_TEST = re.compile(r"^web/.*\.(?:test|spec)\.tsx?$")
IDENTITY = ("-c", "user.name=crosspr", "-c", "user.email=crosspr@example.invalid")
TRUSTED_AUTHORS = Path(__file__).with_name("trusted-authors.txt")
OUTPUT_TAIL = 60
QUICK = 120
TESTS = 900


class Refusal(Exception):
    """The check could not run (exit 2)."""


def call(
    argv: list[str], *, cwd: Path | None = None, limit: int = QUICK
) -> subprocess.CompletedProcess[str]:
    """Run argv in its own process group; at the time limit kill the group and raise Refusal."""
    try:
        process = subprocess.Popen(
            argv,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
    except OSError as error:
        raise Refusal(f"{argv[0]} could not be run: {error}") from error
    try:
        out, err = process.communicate(timeout=limit)
    except subprocess.TimeoutExpired as error:
        os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        raise Refusal(f"timed out after {limit}s: {' '.join(argv[:4])}") from error
    return subprocess.CompletedProcess(argv, process.returncode, out, err)


def git(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return call(["git", *args], cwd=cwd)


def git_out(*args: str) -> str:
    done = git(*args)
    if done.returncode != 0:
        raise Refusal(f"git {args[0]} failed: {done.stderr.strip()}")
    return done.stdout.strip()


def gh(*args: str) -> str:
    done = call(["gh", *args])
    if done.returncode != 0:
        raise Refusal(f"gh {' '.join(args[:2])} failed: {done.stderr.strip()}")
    return done.stdout


def trusted_authors() -> set[str]:
    lines = TRUSTED_AUTHORS.read_text().splitlines() if TRUSTED_AUTHORS.is_file() else []
    return {line.strip() for line in lines if line.strip() and not line.startswith("#")}


def untrusted_reason(pr: dict[str, object]) -> str | None:
    """Why this PR's tests are not run, or None. A fork is never run; an author outside the committed
    list is never run. (gh always supplies both fields; a bare fixture without them is judged by what
    it does carry.)"""
    if pr.get("isCrossRepository"):
        return "it comes from a fork"
    author = pr.get("author")
    login = author.get("login") if isinstance(author, dict) else None
    if login is not None and login not in trusted_authors():
        return f"its author {login} is not in trusted-authors.txt"
    return None


def repo_slug() -> str:
    url = git_out("remote", "get-url", "origin")
    match = re.search(r"github\.com[:/]([^/]+/[^/]+?)(?:\.git)?/?$", url)
    if not match:
        raise Refusal(f"origin is not a github.com remote: {url}")
    return match[1]


def open_prs() -> list[dict[str, object]]:
    """Open PRs as `number`, `headRefName`, `headRefOid`, `files` (`[{"path": ...}]`), `author` and
    `isCrossRepository`. `gh pr list` needs GraphQL, which a cloud session lacks, so the REST API
    answers when it fails."""
    try:
        listed: list[dict[str, object]] = json.loads(
            gh(
                *("pr", "list", "--state", "open", "--base", "main", "--limit", "200"),
                *("--json", "number,headRefName,headRefOid,files,author,isCrossRepository"),
            )
        )
        return listed
    except Refusal:
        pass
    slug = repo_slug()
    prs: list[dict[str, object]] = []
    for pr in json.loads(gh("api", f"repos/{slug}/pulls?state=open&base=main&per_page=100")):
        files = json.loads(gh("api", f"repos/{slug}/pulls/{pr['number']}/files?per_page=100"))
        repo = pr["head"]["repo"]
        prs.append(
            {
                "number": pr["number"],
                "headRefName": pr["head"]["ref"],
                "headRefOid": pr["head"]["sha"],
                "author": {"login": pr["user"]["login"]},
                "isCrossRepository": repo is None or repo["full_name"] != slug,
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
    return "\n".join(text.splitlines()[-OUTPUT_TAIL:])


def drop_stale_worktrees(root: Path, kept: Path) -> None:
    """A killed run leaves its worktree registered: remove every crosspr one, then prune."""
    listing = git_out("worktree", "list", "--porcelain")
    for line in listing.splitlines():
        if line.startswith("worktree "):
            path = Path(line.removeprefix("worktree "))
            if path.parent == kept:
                git("worktree", "remove", "--force", str(path), cwd=root)
    git("worktree", "prune", cwd=root)


def check_pr(
    root: Path, kept: Path, branch: str, tip: str, pr: dict[str, object], head: str
) -> tuple[str | None, list[str]]:
    """(the reason it refuses or None, notes): a PR not trusted gets `merge-tree` only."""
    number = int(pr["number"])  # type: ignore[call-overload]
    notes: list[str] = []
    merged = git("merge-tree", "--write-tree", "--name-only", tip, head)
    if merged.returncode != 0:
        return f"crosspr: #{number} and {branch} conflict:\n{tail(merged.stdout + merged.stderr)}", notes
    if reason := untrusted_reason(pr):
        notes.append(f"crosspr: #{number} tests not run: {reason}; merge-tree only")
        return None, notes
    tree = Path(tempfile.mkdtemp(prefix="worktree-", dir=kept))
    added = git("worktree", "add", "--detach", "-q", str(tree), "origin/main", cwd=root)
    if added.returncode != 0:
        raise Refusal(f"git worktree add failed: {added.stderr.strip()}")
    try:
        for side in (tip, head):
            joined = git(*IDENTITY, "merge", "--no-edit", "-q", side, cwd=tree)
            if joined.returncode != 0:
                said = f"crosspr: #{number} and {branch} conflict on origin/main:\n"
                return said + tail(joined.stdout + joined.stderr), notes
        changed = {
            *git_out("diff", "--name-only", "origin/main", tip).splitlines(),
            *git_out("diff", "--name-only", "origin/main", head).splitlines(),
        }
        if any(WEB_TEST.search(p) for p in changed):
            notes.append(f"crosspr: #{number} web not run: web tests are not run by crosspr")
        tests = sorted(p for p in changed if TEST_FILE.search(p) and (tree / p).is_file())
        if not tests:
            return None, notes
        argv = [sys.executable, "-m", "pytest", "-rf", "-q", "-p", "no:cacheprovider", *tests]
        try:
            ran = call(argv, cwd=tree, limit=TESTS)
        except Refusal as error:
            return f"crosspr: #{number} and {branch}: {error} (tests {', '.join(tests)})", notes
        output = ran.stdout + ran.stderr
        (kept / f"pr-{number}.txt").write_text(output)
        if ran.returncode != 0:
            said = f"crosspr: #{number} and {branch} break each other: tests failed on their union "
            said += f"({', '.join(tests)}); output in .private/work/crosspr/pr-{number}.txt\n"
            return said + tail(output), notes
        return None, notes
    finally:
        git("worktree", "remove", "--force", str(tree), cwd=root)


def run(branch: str, tree: str | None) -> int:
    root = Path(git_out("rev-parse", "--show-toplevel"))
    tip = resolve(branch)
    resolve("origin/main")
    if tree:
        tip = git_out("commit-tree", tree, "-p", tip, "-m", "crosspr: the staged tree")
    mine = set(git_out("diff", "--name-only", f"origin/main...{tip}").splitlines())
    touching = []
    for pr in open_prs():
        if pr["headRefName"] == branch:
            continue
        files = {item["path"] for item in pr["files"]}  # type: ignore[attr-defined]
        if files & mine:
            touching.append(pr)
    touching.sort(key=lambda pr: int(pr["number"]))  # type: ignore[call-overload]
    kept = root / ".private" / "work" / "crosspr"
    kept.mkdir(parents=True, exist_ok=True)
    drop_stale_worktrees(root, kept)
    refused, web = [], False
    for pr in touching:
        number = int(pr["number"])  # type: ignore[call-overload]
        head = pr_head(number, str(pr["headRefOid"]), str(pr["headRefName"]))
        problem, notes = check_pr(root, kept, branch, tip, pr, head)
        for note in notes:
            print(note, file=sys.stderr)
        web = web or any("web not run" in note for note in notes)
        if problem:
            refused.append(problem)
            print(problem, file=sys.stderr)
        else:
            print(f"crosspr: #{number} and {branch} merge together", file=sys.stderr)
    if refused:
        print(f"crosspr: refused: {len(refused)} of {len(touching)} open PRs", file=sys.stderr)
        return 1
    listed = " ".join(f"#{pr['number']}" for pr in touching) or "none"
    print(f"Cross-PR: {listed} {'web not run' if web else 'ok'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    tree = None
    if len(args) == 3 and args[1] == "--tree":
        args, tree = args[:1], args[2]
    if len(args) != 1:
        print("usage: python -m scripts.factory.crosspr <branch> [--tree <sha>]", file=sys.stderr)
        return 2
    try:
        return run(args[0], tree)
    except Refusal as error:
        print(f"crosspr: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
