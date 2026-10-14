"""The main watcher (S29-F3; docs/plans/factory-s29.md item 3, the owner's rulings Q19 and Q20): when
main goes red, find the culprit among the merges since the last green run, open a revert PR at once and
land it by the light path.

    python -m scripts.factory.main_watch once [--log <file>]
    python -m scripts.factory.main_watch run [--interval 120] [--log <file>]

Run it from the main checkout: git runs in the current directory's repository. It never checks out a
branch and never pushes main: the revert is built with `git merge-tree` and `git commit-tree` on main's
tip and pushed to `revert/<short sha>` only.

One pass (`once`):
1. Fetch main and the `revert/*` branches from origin.
2. Walk main's first-parent line from its tip back to the newest commit whose run is green
   (`forge.conclusion(sha) == "success"`). From there forward, oldest first, the first commit with a
   finished run decides: red (`"failure"`) is the culprit; a commit whose run has not finished (None)
   holds the pass (it may be the culprit itself), so nothing after it is blamed. A red merge followed by
   a green one is never reverted: main's newest green bounds the walk.
3. A culprit already reverted (its `revert/<short>` branch on origin, or a commit on main saying
   `This reverts commit <sha>`) is not reverted twice; else the branch is cut from main's tip holding
   only `git revert -m 1 <culprit>`'s tree and the PR is opened against main, its body naming the
   culprit's PR and the red run.
4. Every revert this log opened that is now on main is logged `landed` once, and `after_landed` runs.

The log (default `.private/work/factory/main-watch.log`): one line per event, `YYYY-MM-DDTHH:MM:SSZ
<event> <short> ...`; each (event, short) once. Events: `red`, `culprit`, `revert-opened`, `landed`
(the measure: main red after a bad merge, from `red` to `landed`), and `wait`, `no-green`,
`still-red`, `not-a-merge`, `conflict`, `already-reverted`, `error`.

`light_tier(repo, head, base=)` answers "revert" when the head's tree is exactly main with one
first-parent merge reverted, else None (decided by trees, never a message); the review's no-model
`revert` tier is `watcher_revert`: that, for a merge this log names as a culprit.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

REPOSITORY = "vextrus/vextrus-cubit"
MAIN = "refs/remotes/origin/main"
REVERTS = "refs/remotes/origin/revert/"
SHORT = 10  # the hex digits of a culprit's short sha: its branch and its log lines
WALK = 200  # first-parent commits read back from main's tip for the newest green one
PATHS = 2000  # at most this many paths narrow light_tier's merges on one command line
PR_NUMBER = re.compile(r"^Merge pull request #(\d+)\b")
LOG_LINE = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ (\S+) (\S+)")
DEFAULT_LOG = Path(".private/work/factory/main-watch.log")
# The push-triggered workflows whose runs decide a commit's colour on main (ci, web and engine run on
# every push to main; e2e also runs on a schedule and is left out).
WORKFLOWS = ("ci", "web", "engine")
# Only these finished conclusions are red. A cancelled or skipped run says nothing about the commit:
# main's concurrency group can supersede a queued run.
RED = {"failure", "timed_out", "startup_failure", "action_required"}
GREEN = {"success", "skipped", "neutral"}


class Forge(Protocol):
    def conclusion(self, sha: str) -> str | None: ...

    def run_url(self, sha: str) -> str: ...

    def open_pr(self, *, head: str, base: str, title: str, body: str) -> int: ...


class GitError(Exception):
    pass


# What a light-path answer turns into None. A tuple: `ci_gate` imports this module under the CI runner's
# system python3, which reads no Python 3.14 syntax (scripts/factory/tests/test_main_watch.py).
UNREADABLE = (GitError, OSError)
# What a failed `gh` call raises: no binary, a non-zero exit or a timeout, an answer not as read.
FORGE_FAILED = (OSError, subprocess.SubprocessError, ValueError, KeyError)


def git(repo: Path, *args: str, check: bool = True) -> str:
    done = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=False)
    if check and done.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {done.stderr.strip()}")
    return done.stdout.strip() if done.returncode == 0 else ""


def ok(repo: Path, *args: str) -> bool:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True).returncode == 0


# --- the log -------------------------------------------------------------------------------------


class Log:
    """The event log: one line per (event, short), each line opening with its UTC time."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.seen: set[tuple[str, str]] = set()
        if path.exists():
            for line in path.read_text().splitlines():
                if match := LOG_LINE.match(line):
                    self.seen.add((match.group(1), match.group(2)))

    def has(self, event: str, short: str) -> bool:
        return (event, short) in self.seen

    def write(self, event: str, short: str, rest: str = "") -> None:
        if self.has(event, short):
            return
        self.seen.add((event, short))
        stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        text = " ".join(part for part in (stamp, event, short, rest.replace("\n", " ")) if part)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a") as handle:
            handle.write(text + "\n")

    def opened(self) -> Iterator[str]:
        """The shorts of every revert this log opened."""
        return (short for event, short in sorted(self.seen) if event == "revert-opened")


# --- one pass ------------------------------------------------------------------------------------


def fetch(repo: Path) -> None:
    git(
        repo,
        "fetch",
        "-q",
        "--prune",
        "--no-tags",
        "origin",
        f"+refs/heads/main:{MAIN}",
        f"+refs/heads/revert/*:{REVERTS}*",
    )


def first_parents(repo: Path) -> list[str]:
    """Main's first-parent line, newest first, at most WALK commits."""
    return git(repo, "rev-list", "--first-parent", f"--max-count={WALK}", MAIN).split()


def culprit(repo: Path, forge: Forge, log: Log) -> str | None:
    """The earliest red first-parent commit after main's newest green one; None while none is red or
    an earlier commit's run has not finished."""
    line = first_parents(repo)
    since: list[str] = []
    for sha in line:
        if forge.conclusion(sha) == "success":
            break
        since.append(sha)
    else:
        if line:
            log.write("no-green", short_of(line[0]), f"no green run in main's last {len(line)} commits")
        return None
    ordered = list(reversed(since))
    for at, sha in enumerate(ordered):
        colour = forge.conclusion(sha)
        if colour is None:
            log.write("wait", short_of(sha), "its run has not finished")
            return None
        if colour == "failure":
            log.write("red", short_of(sha), forge.run_url(sha))
            if reverted_on_main(repo, sha):
                still_red(repo, forge, log, sha, ordered[at + 1 :])
                return None
            return sha
    return None


def still_red(repo: Path, forge: Forge, log: Log, reverted: str, after: list[str]) -> None:
    """The earliest red merge is already reverted on main: every merge between it and the commit that
    brought its revert in inherits its red, so nothing there is blamed. That commit's run decides: not
    finished, wait; red, main is still red without the culprit, which the log says (once) and leaves to
    the orchestrator. Never a revert of the revert."""
    revert = git(
        repo,
        "log",
        "-1",
        "--format=%H",
        "--fixed-strings",
        f"--grep=This reverts commit {reverted}",
        MAIN,
    )
    landing = next((sha for sha in after if ok(repo, "merge-base", "--is-ancestor", revert, sha)), None)
    if landing is None:
        return
    if forge.conclusion(landing) is None:
        log.write("wait", short_of(landing), "the revert's run has not finished")
    else:
        log.write("still-red", short_of(landing), f"red after {short_of(reverted)} was reverted")


def short_of(sha: str) -> str:
    return sha[:SHORT]


def branch_of(sha: str) -> str:
    return f"revert/{short_of(sha)}"


def reverted_on_main(repo: Path, sha: str) -> bool:
    return bool(
        git(repo, "log", "--format=%H", "--fixed-strings", f"--grep=This reverts commit {sha}", MAIN)
    )


def already_reverted(repo: Path, sha: str) -> bool:
    return ok(repo, "rev-parse", "--verify", "-q", f"{REVERTS}{short_of(sha)}") or reverted_on_main(
        repo, sha
    )


def revert_tree(repo: Path, merge: str, base: str) -> str | None:
    """The tree of `git revert -m 1 <merge>` applied on `base`; None on a conflict."""
    out = git(
        repo, "merge-tree", "--write-tree", f"--merge-base={merge}", base, f"{merge}^1", check=False
    )
    return out.split()[0] if out else None


def is_merge(repo: Path, sha: str) -> bool:
    return len(git(repo, "rev-list", "--parents", "-n", "1", sha).split()) == 3


def pr_of(repo: Path, sha: str) -> int | None:
    match = PR_NUMBER.match(git(repo, "log", "-1", "--format=%s", sha))
    return int(match.group(1)) if match else None


def open_revert(repo: Path, forge: Forge, log: Log, bad: str) -> None:
    short = short_of(bad)
    number = pr_of(repo, bad)
    named = f"#{number}" if number is not None else f"the merge {short}"
    log.write("culprit", short, named)
    if not is_merge(repo, bad):
        log.write("not-a-merge", short, "a red commit that is not a merge is left to the orchestrator")
        return
    if already_reverted(repo, bad) and log.has("revert-opened", short):
        log.write("already-reverted", short, branch_of(bad))
        return
    tip = git(repo, "rev-parse", MAIN)
    branch = branch_of(bad)
    if not ok(repo, "rev-parse", "--verify", "-q", f"{REVERTS}{short}"):
        if reverted_on_main(repo, bad):
            log.write("already-reverted", short, "on main")
            return
        tree = revert_tree(repo, bad, tip)
        if tree is None:
            log.write("conflict", short, "the revert does not apply on main's tip: revert it by hand")
            return
        subject = git(repo, "log", "-1", "--format=%s", bad)
        message = f'Revert "{subject}"\n\nThis reverts commit {bad}.\n\nOpened by the main watcher.\n'
        commit = git(repo, "commit-tree", tree, "-p", tip, "-m", message)
        git(repo, "push", "-q", "origin", f"{commit}:refs/heads/{branch}")
    url = forge.run_url(bad)
    title = f"Revert {named}: main red since {short}"
    body = (
        f"Main went red at {short} ({named}): {url}\n\n"
        f"This branch is main's tip with `git revert -m 1 {bad}` and nothing else, so the review's "
        "light path (`revert` tier, no model) applies.\n\n"
        "Opened by the main watcher (`python -m scripts.factory.main_watch`).\n"
    )
    try:
        number_opened = forge.open_pr(head=branch, base="main", title=title, body=body)
    except (OSError, subprocess.SubprocessError) as error:
        log.write(
            "error", short, f"the revert PR was not opened ({type(error).__name__}): open {branch}"
        )
        return
    log.write("revert-opened", short, f"#{number_opened} {branch}")


def landed(repo: Path, log: Log, hook: Callable[[Path, str], None]) -> None:
    """Every revert this log opened that main now holds: `landed` once, then the hook."""
    for short in list(log.opened()):
        if log.has("landed", short):
            continue
        full = git(repo, "rev-parse", "--verify", "-q", f"{short}^{{commit}}", check=False)
        if full and reverted_on_main(repo, full):
            log.write("landed", short, "the revert is on main")
            hook(repo, full)


def after_landed(repo: Path, culprit_sha: str) -> None:
    """F5's hook point: the post-merge real-drawing run on main after a revert lands. Empty until F5."""


def once(*, repo: Path, forge: Forge, log: Path) -> None:
    """One pass: fetch, find the culprit, open its revert, log what landed."""
    events = Log(log)
    fetch(repo)
    bad = culprit(repo, forge, events)
    if bad is not None:
        open_revert(repo, forge, events, bad)
    landed(repo, events, after_landed)


# --- the light path ------------------------------------------------------------------------------


def light_tier(repo: Path, head: str, base: str = "origin/main") -> str | None:
    """`"revert"` when `head`'s tree is exactly `base` with one first-parent merge of `base` reverted
    (`git revert -m 1`); None otherwise: an extra change, a changed line, two merges, an inner merge
    of a landed PR, an empty change or a message alone are not light. Any git failure is None: the
    PR then gets its model lenses."""
    return "revert" if reverted_merge(repo, head, base) is not None else None


def reverted_merge(repo: Path, head: str, base: str = "origin/main") -> str | None:
    """The one first-parent merge of `base` that `head` reverts exactly (`light_tier`), or None."""
    try:
        return _reverted_merge(repo, head, base)
    except UNREADABLE:
        return None


def _reverted_merge(repo: Path, head: str, base: str) -> str | None:
    base_sha = git(repo, "rev-parse", "--verify", f"{base}^{{commit}}")
    head_sha = git(repo, "rev-parse", "--verify", f"{head}^{{commit}}")
    if not ok(repo, "merge-base", "--is-ancestor", base_sha, head_sha):
        return None
    tree = git(repo, "rev-parse", f"{head_sha}^{{tree}}")
    if tree == git(repo, "rev-parse", f"{base_sha}^{{tree}}"):
        return None
    # The merges to try: those touching the head's paths (-z: a path is never quoted), or, for a
    # change too wide for one command line, main's last WALK merges. The tree comparison decides.
    names = git(repo, "diff", "--name-only", "-z", "--no-renames", base_sha, head_sha)
    paths = [path for path in names.split("\0") if path]
    narrow = ["--", *paths] if len(paths) <= PATHS else [f"--max-count={WALK}"]
    log = ("--literal-pathspecs", "log", "--first-parent", "--merges", "--format=%H", base_sha)
    for merge in git(repo, *log, *narrow).split():
        if revert_tree(repo, merge, base_sha) == tree:
            return merge
    return None


def watcher_revert(repo: Path, head: str, base: str, log: Path, forge: Forge) -> bool:
    """The review's no-model `revert` tier: `light_tier`'s exact inverse, of a merge this watcher
    logged as its `culprit` in `log` AND whose run on main the forge reads red (a line appended to the
    log alone earns nothing), and never of a merge that itself reverts one (a revert of the watcher's
    revert would land its culprit again). Any other revert, of any old merge, gets its lenses: a
    wall's removal is never passed by code. A forge that cannot answer is no."""
    merge = reverted_merge(repo, head, base)
    if merge is None or not Log(log).has("culprit", short_of(merge)):
        return False
    if reverted_merge(repo, merge, f"{merge}^1") is not None:
        return False
    try:
        return forge.conclusion(merge) == "failure"
    except FORGE_FAILED:
        return False


# --- the real forge (gh) ---------------------------------------------------------------------------


class Gh:
    """The forge through `gh`: the push runs of WORKFLOWS on a commit of main, and `gh pr create`."""

    def __init__(self, repository: str = REPOSITORY, *, rerun: bool = True) -> None:
        self.repository = repository
        self.rerun = rerun  # the review only reads; the watcher re-runs a cancelled run
        self._runs: dict[str, list[dict[str, Any]]] = {}
        self._rerun: set[str] = set()

    def _gh(self, *args: str) -> str:
        done = subprocess.run(["gh", *args], capture_output=True, text=True, check=True, timeout=120)
        return done.stdout

    def runs(self, sha: str) -> list[dict[str, Any]]:
        if sha not in self._runs:
            out = self._gh(
                "run", "list", "--repo", self.repository, "--commit", sha, "--event", "push",
                "--json", "databaseId,workflowName,status,conclusion,url", "--limit", "50",
            )  # fmt: skip
            self._runs[sha] = [run for run in json.loads(out) if run["workflowName"] in WORKFLOWS]
        return self._runs[sha]

    def conclusion(self, sha: str) -> str | None:
        """ "failure" once any run is red; "success" when every run finished green; else None. A
        cancelled run (main's concurrency group supersedes a queued one) would hold the watcher for
        good, so it is re-run once and the commit waits for that run."""
        runs = self.runs(sha)
        if any(run["conclusion"] in RED for run in runs):
            return "failure"
        for run in runs:
            ident = str(run.get("databaseId", ""))
            cancelled = run["conclusion"] == "cancelled"
            if self.rerun and cancelled and ident and ident not in self._rerun:
                self._rerun.add(ident)
                self._gh("run", "rerun", ident, "--repo", self.repository)
        finished = all(run["status"] == "completed" for run in runs)
        if runs and finished and all(run["conclusion"] in GREEN for run in runs):
            return "success"
        return None

    def run_url(self, sha: str) -> str:
        runs = self.runs(sha)
        red = [run for run in runs if run["conclusion"] in RED]
        return str((red or runs or [{"url": f"(no run of {sha})"}])[0]["url"])

    def open_pr(self, *, head: str, base: str, title: str, body: str) -> int:
        url = self._gh(
            "pr", "create", "--repo", self.repository, "--head", head, "--base", base,
            "--title", title, "--body", body,
        ).strip()  # fmt: skip
        return int(url.rstrip("/").rsplit("/", 1)[-1])

    def forget(self) -> None:
        self._runs.clear()


# --- the command ---------------------------------------------------------------------------------


def run(*, repo: Path, forge: Gh, log: Path, interval: float, sleep: Callable[[float], None]) -> None:
    """`once` every `interval` seconds until interrupted; a failed pass is logged, the loop goes on."""
    while True:
        forge.forget()
        try:
            once(repo=repo, forge=forge, log=log)
        except (GitError, *FORGE_FAILED) as error:
            hour = datetime.now(UTC).strftime("pass-%Y%m%d%H")  # at most one such line an hour
            Log(log).write("error", hour, f"{type(error).__name__}: {error}")
        sleep(interval)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.main_watch")
    sub = parser.add_subparsers(dest="command", required=True)
    for name, text in (("once", "one pass"), ("run", "a pass every --interval seconds")):
        command = sub.add_parser(name, help=text)
        command.add_argument("--log", type=Path, default=DEFAULT_LOG)
        if name == "run":
            command.add_argument("--interval", type=float, default=120.0)
    args = parser.parse_args(argv)
    repo = Path.cwd()
    if args.command == "once":
        once(repo=repo, forge=Gh(), log=args.log)
        return 0
    if args.interval < 10:
        parser.error("--interval is at least 10 seconds")
    try:
        run(repo=repo, forge=Gh(), log=args.log, interval=args.interval, sleep=time.sleep)
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
