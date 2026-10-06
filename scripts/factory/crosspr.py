"""`python -m scripts.factory.crosspr <branch> [--tree <sha>]`: the cross-PR check run before READY.

For every open PR (read from `gh`) that touches any file the branch changed, the branch's own PR
excluded, it asks `git merge-tree` whether the branch and that PR merge, then runs the union's changed
tests (the test files either side changed) in a temporary worktree on `origin/main` plus both. A conflict
or a failing test refuses, naming the PR and the branch (exit 1); the last line of a pass is
`Cross-PR: #51 #53 ok` (ascending) or `Cross-PR: none ok`, the line the READY commit message carries.

Running a PR's tests runs its code, so only a PR from one of this repository's own branches by an author
listed in `trusted-authors.txt` has its tests run; every other PR gets `merge-tree` only and the output
says so. Python tests (test_*.py) and node tests (`*.test.mjs` under .claude/hooks, tools/mod and
scripts/factory) run; an open PR that conflicts with main alone is stale and is reported, not refused.
Web tests do not run: when a union changes them the last line reads
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
import shutil
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

TEST_FILE = re.compile(r"(?:^|/)(?:test_[^/]*|[^/]*_test)\.py$")
NODE_TEST = re.compile(r"^(?:\.claude/hooks|tools/mod|scripts/factory)/.*\.test\.mjs$")
DESELECTED = re.compile(r"(\d+) deselected")
PYTEST_ID = re.compile(r"^(?:FAILED|ERROR) (\S+)", re.MULTILINE)
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
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            # A child that left the group still holds the pipes: let go of them.
            for pipe in (process.stdout, process.stderr):
                if pipe:
                    pipe.close()
            process.wait()
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
) -> tuple[str | None, list[str], list[str], str]:
    """(the reason it refuses or None, notes, what was not run, the PR's status). One baseline rule:
    only what appears when the builder's tree is added on top of main + the PR refuses. A PR that
    conflicts with main alone is `stale`; tests failing on main + the PR alone are the PR's own
    (`fails-on-main`) and never counted against the builder; a PR not trusted is `merge-only`."""
    number = int(pr["number"])  # type: ignore[call-overload]
    notes: list[str] = []
    unrun: list[str] = []
    base = git("merge-tree", "--write-tree", "origin/main", head)
    if base.returncode != 0:
        notes.append(f"crosspr: #{number} conflicts with main: not yours")
        return None, notes, unrun, "stale"
    base_pr = git_out(
        *IDENTITY, "commit-tree", base.stdout.split()[0], "-p", "origin/main", "-p", head, "-m", "x"
    )
    merged = git("merge-tree", "--write-tree", "--name-only", tip, base_pr)
    if merged.returncode != 0:
        said = f"crosspr: #{number} and {branch} conflict:\n"
        return said + tail(merged.stdout + merged.stderr), notes, unrun, "ok"
    if reason := untrusted_reason(pr):
        notes.append(f"crosspr: #{number} tests not run: {reason}; merge-tree only")
        return None, notes, unrun, "merge-only"
    tree = Path(tempfile.mkdtemp(prefix="worktree-", dir=kept))
    added = git("worktree", "add", "--detach", "-q", str(tree), "origin/main", cwd=root)
    if added.returncode != 0:
        raise Refusal(f"git worktree add failed: {added.stderr.strip()}")
    try:
        changed = sorted(
            {
                *git_out("diff", "--name-only", f"origin/main...{tip}").splitlines(),
                *git_out("diff", "--name-only", f"origin/main...{head}").splitlines(),
            }
        )
        if any(WEB_TEST.search(p) for p in changed):
            notes.append(f"crosspr: #{number} web not run: web tests are not run by crosspr")
            unrun.append("web not run")
        joined = git(*IDENTITY, "merge", "--no-edit", "-q", head, cwd=tree)
        if joined.returncode != 0:
            raise Refusal(f"#{number} merged into main alone failed: {joined.stderr.strip()}")
        baseline = Tests(tree, kept, f"pr-{number}-main")
        theirs = baseline.run(changed)
        joined = git(*IDENTITY, "merge", "--no-edit", "-q", tip, cwd=tree)
        if joined.returncode != 0:
            said = f"crosspr: #{number} and {branch} conflict on origin/main:\n"
            return said + tail(joined.stdout + joined.stderr), notes, unrun, "ok"
        union = Tests(tree, kept, f"pr-{number}")
        mine = union.run(changed)
        status = "ok"
        if theirs.failed:
            notes.append(f"crosspr: #{number} fails on main: not yours")
            status = "fails-on-main"
        notes += union.notes
        notes = [
            f"crosspr: #{number} {note}" if not note.startswith("crosspr:") else note for note in notes
        ]
        if mine.timed_out:
            return f"crosspr: #{number} and {branch}: {mine.timed_out}", notes, unrun, status
        new = mine.failed_ids - theirs.failed_ids
        if new or (mine.failed and not mine.failed_ids and not theirs.failed):
            said = f"crosspr: #{number} and {branch} break each other: tests failed on their union "
            said += f"({', '.join(changed)}); output in .private/work/crosspr/pr-{number}.txt\n"
            return said + tail(mine.output), notes, unrun, status
        if mine.node_unrun:
            unrun.append("node not run")
        return None, notes, unrun, status
    finally:
        git("worktree", "remove", "--force", str(tree), cwd=root)


class Tests:
    """One run of the changed Python and node tests in a worktree: what failed, by test id."""

    def __init__(self, tree: Path, kept: Path, name: str) -> None:
        self.tree, self.kept, self.name = tree, kept, name
        self.failed = False
        self.failed_ids: set[str] = set()
        self.output = ""
        self.timed_out = ""
        self.node_unrun = False
        self.notes: list[str] = []

    def run(self, changed: list[str]) -> Tests:
        pytests = [p for p in changed if TEST_FILE.search(p) and (self.tree / p).is_file()]
        nodes = [p for p in changed if NODE_TEST.search(p) and (self.tree / p).is_file()]
        if pytests:
            argv = [sys.executable, "-m", "pytest", "-rf", "-q", "-p", "no:cacheprovider", *pytests]
            self.collect(argv, self.name, "Python", pytests, ok=(0, 5))
        if nodes and shutil.which("node") is None:
            self.notes.append("node not run: node is absent")
            self.node_unrun = True
        elif nodes:
            self.collect(["node", "--test", *nodes], f"{self.name}-node", "node", nodes, ok=(0,))
        return self

    def collect(
        self, argv: list[str], name: str, kind: str, files: list[str], ok: tuple[int, ...]
    ) -> None:
        try:
            ran = call(argv, cwd=self.tree, limit=TESTS)
        except Refusal as error:
            self.timed_out = f"{error} (tests {', '.join(files)})"
            return
        output = ran.stdout + ran.stderr
        (self.kept / f"{name}.txt").write_text(output)
        if ran.returncode == 5:
            self.notes.append("no Python test ran (none collected or all deselected)")
        elif ran.returncode in ok:
            if found := DESELECTED.search(output):
                self.notes.append(f"{found[1]} Python tests deselected, not run")
            return
        if ran.returncode not in ok:
            self.failed = True
            self.output += output
            ids = set(PYTEST_ID.findall(output)) if kind == "Python" else set()
            self.failed_ids |= ids
            if kind == "node":
                self.failed_ids |= {f"node:{f}" for f in files if f in output}


def summary(statuses: dict[int, str], unrun: list[str]) -> str:
    """`#51 #53 ok` when every PR was fully checked, else each PR named with what happened to it."""
    if not statuses:
        return f"none {', '.join(unrun) or 'ok'}"
    if all(status == "ok" for status in statuses.values()):
        return f"{' '.join(f'#{n}' for n in sorted(statuses))} {', '.join(unrun) or 'ok'}"
    parts = [f"#{n} {statuses[n]}" for n in sorted(statuses)]
    return ", ".join([*parts, *unrun])


def run(branch: str, tree: str | None) -> int:
    root = Path(git_out("rev-parse", "--show-toplevel"))
    tip = resolve(branch)
    resolve("origin/main")
    if tree:
        tip = git_out(*IDENTITY, "commit-tree", tree, "-p", tip, "-m", "crosspr: the staged tree")
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
    mine_vs_main = git("merge-tree", "--write-tree", "origin/main", tip)
    if mine_vs_main.returncode != 0:
        said = "crosspr: your branch conflicts with main: merge main\n"
        print(said + tail(mine_vs_main.stdout + mine_vs_main.stderr), file=sys.stderr)
        return 1
    refused, unrun, statuses = [], [], {}
    for pr in touching:
        number = int(pr["number"])  # type: ignore[call-overload]
        head = pr_head(number, str(pr["headRefOid"]), str(pr["headRefName"]))
        problem, notes, missed, status = check_pr(root, kept, branch, tip, pr, head)
        statuses[number] = status
        unrun += [kind for kind in missed if kind not in unrun]
        for note in notes:
            print(note, file=sys.stderr)
        if problem:
            refused.append(problem)
            print(problem, file=sys.stderr)
        elif status == "ok":
            print(f"crosspr: #{number} and {branch} merge together", file=sys.stderr)
    if refused:
        print(f"crosspr: refused: {len(refused)} of {len(touching)} open PRs", file=sys.stderr)
        return 1
    print(f"Cross-PR: {summary(statuses, unrun)}")
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
