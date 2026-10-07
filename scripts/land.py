"""`python -m scripts.land <PR> [<PR> ...]`: land reviewed PRs in order (docs/specs/factory.md 2.2
"Land").

For each PR, engine PRs with a ledger PASS first, then the rest by number (a PR with no PASS is left
out): it refuses (exit 3) unless the local review ledger covers the PR's head (a PASS for it, or for an
older head followed only by clean merges of main, as `merge_ready` decides), then marks the PR ready,
brings main in (`PUT .../pulls/<n>/update-branch`, skipped when main is already in), waits for CI
(read from `gh pr view --json headRefOid,statusCheckRollup`: gh 2.45 has no `gh pr checks --json`),
reruns the failed jobs **once** and only when every failed test is listed in `.github/flaky.txt`, runs
`merge_ready`, merges the head CI was green on (`--match-head-commit`) and pulls main. It never raises
privilege, never runs a shell and never moves a branch or a worktree of its own. Exit codes: 0 landed,
2 usage, 3 refused.
"""

import contextlib
import json
import re
import subprocess
import sys
import time
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any, Protocol

from scripts.ledger import default_ledger_dir
from tools.lint.engine_paths import matching, read_patterns

REPOSITORY = "vextrus/vextrus-cubit"
FLAKY = Path(".github/flaky.txt")
ENGINE_PATHS = Path(".github/engine-paths.txt")
SHA = re.compile(r"[0-9a-f]{40}")
FINE = {"SUCCESS", "SKIPPED", "NEUTRAL"}
PENDING_STATES = {"PENDING", "EXPECTED"}
JOB_URL = re.compile(r"/actions/runs/(\d+)/job/(\d+)")
PYTEST_FAILED = re.compile(r"\bFAILED (\S+?)::(\S+?)(?:\[.*?\])?(?: - |\s*$)")
# vitest 5 may print a project between FAIL and the path: `|node|`, or a label with an optional
# `(browser)`, as in `FAIL   browser (chromium)  src/a.test.tsx > ... > title`.
VITEST_FAIL = re.compile(
    r"\bFAIL\s+(?:\|[^|]*\|\s+|[\w.-]+(?:\s+\([^)]*\))?\s+(?=\S+\s+>\s))?(\S+)\s+>\s+(.+?)\s*$"
)
UNREAD_FAILURE = re.compile(r"\bFAIL(?:ED)?\s|\bERROR\s|Unhandled (?:Error|Rejection)")
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


class Refused(Exception):
    """A plain reason to refuse the landing; `land()` prints it and exits 3."""


class GitHub(Protocol):
    def head_sha(self, pr: int) -> str: ...
    def mark_ready(self, pr: int) -> None: ...
    def update_branch(self, pr: int) -> None: ...
    def wait_ci(self, pr: int) -> list[str]: ...
    def rerun_failed(self, pr: int) -> None: ...
    def merge(self, pr: int) -> None: ...
    def pull_main(self) -> None: ...


def has_pass(ledger_dir: Path, pr: int, head: str) -> bool:
    """The ledger holds a PASS for exactly this head (round 3 only with its exception)."""
    try:
        record = json.loads((ledger_dir / f"{pr}-{head}.json").read_text())
    except OSError, ValueError:
        return False
    return (
        isinstance(record, dict)
        and record.get("pr") == pr
        and record.get("head") == head
        and record.get("verdict") == "PASS"
        and (record.get("round") != 3 or record.get("exception") is not None)
    )


def reviewed(ledger_dir: Path, pr: int, head: str, *, repo: Path, base: str = "origin/main") -> bool:
    """The ledger covers this head: a PASS for it (no git needed), or else the newest record (by
    `comment_id`) among those for this head or an older one followed only by clean merges of main
    (`merge_ready.merges_since`) is a PASS. A newer covering FIX or BLOCK outranks an older PASS, and an
    unreadable record refuses, as `merge_ready.ledger_problems` decides."""
    if has_pass(ledger_dir, pr, head):
        return True
    from scripts.merge_ready import merges_since, record_problems

    newest: tuple[int, str] | None = None
    for path in sorted(ledger_dir.glob(f"{pr}-*.json")) if ledger_dir.is_dir() else []:
        sha = path.stem.removeprefix(f"{pr}-")
        if not SHA.fullmatch(sha):
            continue
        try:
            record = json.loads(path.read_text())
        except OSError, ValueError:
            return False
        if record_problems(record, pr, sha):
            return False
        if sha != head and merges_since(repo, sha, head, base) is not None:
            continue
        if newest is None or int(record["comment_id"]) > newest[0]:
            newest = (int(record["comment_id"]), sha)
    return newest is not None and has_pass(ledger_dir, pr, newest[1])


def land(
    pr: int,
    gh: GitHub,
    *,
    ledger_dir: Path,
    flaky: set[str],
    ready: Callable[[int], int],
    repo: Path | None = None,
) -> int:
    try:
        return _land(pr, gh, ledger_dir=ledger_dir, flaky=flaky, ready=ready, repo=repo or Path.cwd())
    except Refused as refused:
        print(f"land: refused: PR {pr}: {refused}")
    except subprocess.CalledProcessError as error:
        print(f"land: refused: PR {pr}: {failed_call(error)}")
    except (OSError, ValueError) as error:
        print(f"land: refused: PR {pr}: {type(error).__name__}: {str(error).splitlines()[0][:200]}")
    return 3


def _land(
    pr: int, gh: GitHub, *, ledger_dir: Path, flaky: set[str], ready: Callable[[int], int], repo: Path
) -> int:
    head = gh.head_sha(pr)
    if not reviewed(ledger_dir, pr, head, repo=repo):
        raise Refused(f"no ledger PASS covers its head {head[:12]}: review it first")
    gh.mark_ready(pr)
    gh.update_branch(pr)
    if (moved := gh.head_sha(pr)) != head:
        if not reviewed(ledger_dir, pr, moved, repo=repo):
            raise Refused(f"its new head {moved[:12]} is not covered by a ledger PASS: review it")
        head = moved
    failed = gh.wait_ci(pr)
    if failed:
        if not set(failed) <= flaky:
            raise Refused(f"{len(set(failed) - flaky)} failed test(s) not listed as flaky")
        gh.rerun_failed(pr)
        if again := gh.wait_ci(pr):
            raise Refused(f"still red after its one rerun ({len(again)} failed)")
    if gh.head_sha(pr) != head:
        raise Refused("the head moved while CI ran: land it again")
    if ready(pr) != 0:
        raise Refused("merge_ready refuses it")
    gh.merge(pr)
    try:
        gh.pull_main()
    except (Refused, subprocess.CalledProcessError, OSError) as error:
        why = failed_call(error) if isinstance(error, subprocess.CalledProcessError) else str(error)
        print(f"land: PR {pr} merged, but main was not pulled here: {why}")
        return 0
    print(f"land: PR {pr} merged")
    return 0


def failed_call(error: subprocess.CalledProcessError) -> str:
    """One plain line for a failed `gh` or `git` call: its first words and its last error line."""
    argv = [str(part) for part in error.cmd] if isinstance(error.cmd, list | tuple) else [str(error.cmd)]
    if argv[1:2] == ["-C"]:
        argv = argv[:1] + argv[3:]
    words = " ".join(part for part in argv[:3] if not part.startswith("-"))
    stderr = error.stderr if isinstance(error.stderr, str) else ""
    lines = [line.strip() for line in stderr.splitlines() if line.strip()]
    return f"`{words}` failed (exit {error.returncode})" + (f": {lines[-1][:200]}" if lines else "")


def order(prs: Iterable[dict[str, Any]]) -> list[int]:
    """Engine PRs with a PASS first, then the rest with a PASS, each by number; a PR whose `files`
    overlap a lower-numbered PR's comes after that PR (number order for PRs that touch the same file)."""
    passing = sorted((pr for pr in prs if pr["pass"]), key=lambda pr: (not pr["engine"], pr["number"]))
    waiting = list(passing)
    placed: list[int] = []
    while waiting:
        ready = next(
            pr
            for pr in waiting
            if all(
                other["number"] in placed
                or other["number"] > pr["number"]
                or other is pr
                or not set(other.get("files", ())) & set(pr.get("files", ()))
                for other in waiting
            )
        )
        waiting.remove(ready)
        placed.append(ready["number"])
    return placed


def flaky_list(path: Path = FLAKY) -> set[str]:
    if not path.is_file():
        return set()
    lines = (line.strip() for line in path.read_text().splitlines())
    return {line for line in lines if line and not line.startswith("#")}


def failed_tests(log: str) -> list[str]:
    """The failed tests a `gh run view --log-failed` output names, as `.github/flaky.txt` lists them:
    pytest `FAILED <path>::<name>[...] - ...` is `<path> :: <name>`; vitest
    `FAIL  <path> > ... > <title>` is `web/<path> :: <title>`
    (the vitest line shape is unverified against a live log). Any other failure line (a vitest file or
    unhandled error, a pytest `ERROR`) is named `unread: <line>`, which no flaky entry matches."""
    found: list[str] = []
    for line in ANSI.sub("", log).splitlines():
        if pytest := PYTEST_FAILED.search(line):
            test = f"{pytest[1]} :: {pytest[2]}"
        elif vitest := VITEST_FAIL.search(line):
            path = vitest[1] if vitest[1].startswith("web/") else f"web/{vitest[1]}"
            test = f"{path} :: {vitest[2].split(' > ')[-1].strip()}"
        elif unread := UNREAD_FAILURE.search(line):
            test = f"unread: {line[unread.start() :].strip()[:200]}"
        else:
            continue
        if test not in found:
            found.append(test)
    return found


def check_key(entry: dict[str, Any]) -> str:
    if entry.get("__typename") == "StatusContext":
        return f"status: {entry.get('context')}"
    return f"check: {entry.get('workflowName')} / {entry.get('name')}"


def has_ci(entries: Iterable[dict[str, Any]]) -> bool:
    """The required `ci` check run exists: a head without it is still pending, never green."""
    return any(e.get("__typename") != "StatusContext" and e.get("name") == "ci" for e in entries)


def pending(entry: dict[str, Any]) -> bool:
    if entry.get("__typename") == "StatusContext":
        return entry.get("state") in PENDING_STATES
    return entry.get("status") != "COMPLETED"


def red(entry: dict[str, Any]) -> bool:
    """Not fine: a CheckRun's conclusion or a StatusContext's state other than SUCCESS, SKIPPED or
    NEUTRAL (FAILURE, CANCELLED, TIMED_OUT, ACTION_REQUIRED, STARTUP_FAILURE, ERROR, or anything new)."""
    if entry.get("__typename") == "StatusContext":
        return entry.get("state") not in FINE
    return entry.get("conclusion") not in FINE


class Gh:
    """The real calls, through `gh` and read-only `git` (no shell, no privilege, no branch moved)."""

    def __init__(
        self, repo: Path | None = None, *, sleep: Callable[[float], None] = time.sleep, polls: int = 90
    ) -> None:
        self.repo = repo or Path.cwd()
        self.sleep = sleep
        self.polls = polls
        self._tested: str | None = None
        self._red: list[dict[str, Any]] = []
        self._rerun_from: dict[str, Any] = {}

    def _run(self, *argv: str) -> str:
        done = subprocess.run(list(argv), capture_output=True, text=True, check=True, cwd=self.repo)
        return done.stdout

    def _git(self, *args: str) -> int:
        done = subprocess.run(
            ["git", "-C", str(self.repo), *args], capture_output=True, text=True, check=False
        )
        return done.returncode

    def fetch(self, pr: int) -> None:
        """Read-only: main and the PR's head into the local object store (no branch moves)."""
        self._run("git", "-C", str(self.repo), "fetch", "-q", "origin", "main", f"refs/pull/{pr}/head")

    def head_sha(self, pr: int) -> str:
        return self._run(
            "gh",
            "pr",
            "view",
            str(pr),
            "--repo",
            REPOSITORY,
            "--json",
            "headRefOid",
            "-q",
            ".headRefOid",
        ).strip()

    def files(self, pr: int) -> list[str]:
        return self._run("gh", "pr", "diff", str(pr), "--repo", REPOSITORY, "--name-only").split()

    def mark_ready(self, pr: int) -> None:
        subprocess.run(
            ["gh", "pr", "ready", str(pr), "--repo", REPOSITORY],
            capture_output=True,
            check=False,
            cwd=self.repo,
        )

    def update_branch(self, pr: int) -> None:
        """A server-side merge of main into the PR's branch (`PUT .../pulls/<n>/update-branch`: gh 2.45
        has no `gh pr update-branch`), skipped when main is already in it; then the new head is waited
        for and fetched. GitHub's own reason is reported; a conflict is named only when GitHub
        says so."""
        self.fetch(pr)
        old = self.head_sha(pr)
        if self._git("merge-base", "--is-ancestor", "origin/main", old) == 0:
            return
        try:
            self._run(
                "gh",
                "api",
                "--method",
                "PUT",
                f"repos/{REPOSITORY}/pulls/{pr}/update-branch",
                "-f",
                f"expected_head_sha={old}",
            )
        except subprocess.CalledProcessError as error:
            said = f"{error.stdout or ''}\n{error.stderr or ''}".lower()
            if "up to date" in said or "no new commits" in said:
                return
            if "expected head" in said:
                raise Refused(
                    f"its head moved: GitHub refused the update (expected head sha {old[:12]}); "
                    "look at the new head and ask again"
                ) from None
            if "conflict" in said:
                raise Refused(
                    f"its branch conflicts with main ({failed_call(error)}): its builder must fix it"
                ) from None
            raise Refused(
                f"GitHub would not bring main into its branch ({failed_call(error)})"
            ) from None
        for _ in range(self.polls):
            if self.head_sha(pr) != old:
                self.fetch(pr)
                return
            self.sleep(20)
        raise Refused("GitHub accepted the update of its branch but the head never moved")

    def rollup(self, pr: int) -> dict[str, Any]:
        payload = json.loads(
            self._run(
                "gh",
                "pr",
                "view",
                str(pr),
                "--repo",
                REPOSITORY,
                "--json",
                "headRefOid,statusCheckRollup",
            )
        )
        if not isinstance(payload, dict):
            raise Refused("gh pr view returned no rollup")
        return payload

    def wait_ci(self, pr: int) -> list[str]:
        """The failed tests (or checks) of the PR's current head, once CI settles on it: a rollup for
        another head, a pending check, an empty rollup, or a rerun check still showing its old result
        is polled again."""
        head = self.head_sha(pr)
        for attempt in range(self.polls):
            if attempt:
                self.sleep(20)
            payload = self.rollup(pr)
            if payload.get("headRefOid") != head:
                continue
            entries = [e for e in payload.get("statusCheckRollup") or [] if isinstance(e, dict)]
            if not has_ci(entries) or any(pending(entry) for entry in entries):
                continue
            completed = {check_key(e): e.get("completedAt") for e in entries}
            if any(completed.get(key) == old for key, old in self._rerun_from.items()):
                continue
            self._tested, self._rerun_from = head, {}
            self._red = [entry for entry in entries if red(entry)]
            return self.failed_ids()
        raise Refused("CI did not settle")

    def wait_ci_check(self, pr: int) -> str:
        """The PR's head once it has a `ci` check run (any state), polled a bounded number of times."""
        for attempt in range(self.polls):
            if attempt:
                self.sleep(20)
            payload = self.rollup(pr)
            head = str(payload.get("headRefOid"))
            entries = [e for e in payload.get("statusCheckRollup") or [] if isinstance(e, dict)]
            if has_ci(entries):
                return head
        raise Refused("its head never got a `ci` check")

    def job_log(self, run: str, job: str) -> str:
        """A failed job's log: `gh run view --log-failed`, and when that names no test (gh 2.45 printed
        nothing for a failed web job) the whole log from `GET .../actions/jobs/<job>/logs`."""
        failed = ""
        with contextlib.suppress(subprocess.CalledProcessError):
            failed = self._run(
                "gh", "run", "view", run, "--job", job, "--log-failed", "--repo", REPOSITORY
            )
        if failed_tests(failed):
            return failed
        try:
            return failed + "\n" + self._run("gh", "api", f"repos/{REPOSITORY}/actions/jobs/{job}/logs")
        except subprocess.CalledProcessError:
            return failed

    def failed_ids(self) -> list[str]:
        """The failed tests of the red checks; a red check with no test line is named by itself. A red
        aggregate (a job named as its workflow, `ci / ci`, `engine / engine`: `if: always()` and red
        when a job it needs failed) is followed instead when another job of its run is red."""
        found: list[str] = []
        named: dict[str, list[str]] = {}
        for entry in self._red:
            job = JOB_URL.search(str(entry.get("detailsUrl") or ""))
            tests: list[str] = []
            if entry.get("__typename") != "StatusContext" and job:
                tests = failed_tests(self.job_log(job[1], job[2]))
            named[check_key(entry)] = tests
        for entry in self._red:
            tests = named[check_key(entry)]
            if not tests and self._aggregate_followed(entry):
                continue
            found.extend(test for test in tests or [check_key(entry)] if test not in found)
        return found

    def _aggregate_followed(self, entry: dict[str, Any]) -> bool:
        """The other red jobs of its run then stand for it: each yields its tests or its own check."""
        if entry.get("__typename") == "StatusContext" or entry.get("name") != entry.get("workflowName"):
            return False
        run = JOB_URL.search(str(entry.get("detailsUrl") or ""))
        others = [
            other
            for other in self._red
            if other is not entry
            and (job := JOB_URL.search(str(other.get("detailsUrl") or ""))) is not None
            and run is not None
            and job[1] == run[1]
        ]
        return bool(others)

    def rerun_failed(self, pr: int) -> None:
        """One `gh run rerun <run> --failed` per run of the last red checks; the next `wait_ci` waits for
        each of those checks to carry a new `completedAt`."""
        runs: list[str] = []
        for entry in self._red:
            job = JOB_URL.search(str(entry.get("detailsUrl") or ""))
            if entry.get("__typename") == "StatusContext" or not job:
                raise Refused(f"{check_key(entry)} has no run to rerun")
            if job[1] not in runs:
                runs.append(job[1])
        if not runs:
            raise Refused("no failed run to rerun")
        self._rerun_from = {check_key(entry): entry.get("completedAt") for entry in self._red}
        for run in runs:
            self._run("gh", "run", "rerun", run, "--failed", "--repo", REPOSITORY)

    def merge(self, pr: int) -> None:
        """Merges only the head CI settled on."""
        if self._tested is None:
            raise Refused("CI was not read before the merge")
        if self.head_sha(pr) != self._tested:
            raise Refused("the head moved after CI")
        self._run(
            "gh",
            "pr",
            "merge",
            str(pr),
            "--repo",
            REPOSITORY,
            "--merge",
            "--match-head-commit",
            self._tested,
        )

    def pull_main(self) -> None:
        """Fast-forwards main, and only when main is what this checkout has checked out. Never `git
        pull`: it reads `FETCH_HEAD`, which every other fetch in this checkout rewrites ("Cannot
        fast-forward to multiple branches"); main is fetched into `origin/main` and fast-forwarded to
        that ref. Another fetch moving `origin/main` at the same moment makes ours fail ("cannot lock
        ref"), so the fetch is tried at most twice more, 2 s apart."""
        branch = self._run("git", "-C", str(self.repo), "symbolic-ref", "-q", "--short", "HEAD").strip()
        if branch != "main":
            raise Refused(f"this checkout is on {branch!r}, not main")
        for attempt in range(3):
            try:
                self._run("git", "-C", str(self.repo), "fetch", "-q", "origin", "main")
                break
            except subprocess.CalledProcessError:
                if attempt == 2:
                    raise
                self.sleep(2)
        self._run("git", "-C", str(self.repo), "merge", "-q", "--ff-only", "refs/remotes/origin/main")


def update(pr: int, gh: Gh) -> int:
    """`land update <PR>`: main into the PR's branch (one request), the new head printed once its `ci`
    check exists; merges nothing."""
    try:
        gh.update_branch(pr)
        head = gh.wait_ci_check(pr)
    except Refused as refused:
        print(f"land: refused: PR {pr}: {refused}")
        return 3
    except subprocess.CalledProcessError as error:
        print(f"land: refused: PR {pr}: {failed_call(error)}")
        return 3
    print(f"land: PR {pr} head {head}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    command = args[0] if args and args[0] in ("update", "order") else None
    if command:
        args = args[1:]
    if not args or not all(arg.isdigit() for arg in args) or (command == "update" and len(args) != 1):
        print(
            "usage: python -m scripts.land <PR> [<PR> ...] | update <PR> | order <PR> [<PR> ...]",
            file=sys.stderr,
        )
        return 2
    if command == "update":
        return update(int(args[0]), Gh())
    from scripts.merge_ready import main as merge_ready

    gh, store = Gh(), default_ledger_dir()
    patterns = read_patterns(ENGINE_PATHS.read_text()) if ENGINE_PATHS.is_file() else []
    prs = []
    heads: dict[int, str] = {}
    for arg in args:
        try:
            gh.fetch(int(arg))
            covered = reviewed(store, int(arg), gh.head_sha(int(arg)), repo=gh.repo)
            files = gh.files(int(arg))
            heads[int(arg)] = gh.head_sha(int(arg))
            prs.append(
                {
                    "number": int(arg),
                    "engine": bool(matching(files, patterns)),
                    "pass": covered,
                    "files": files,
                }
            )
        except Refused as refused:
            print(f"land: refused: PR {arg}: {refused}")
            return 3
        except subprocess.CalledProcessError as error:
            print(f"land: refused: PR {arg}: {failed_call(error)}")
            return 3
    skipped = sorted({int(arg) for arg in args} - set(order(prs)))
    for pr in skipped:
        print(f"land: PR {pr} has no ledger PASS covering its head: left out")
    if command == "order":
        for pr in order(prs):
            print(f"land: PR {pr} {heads[pr]}")
        return 0
    for pr in order(prs):
        code = land(pr, gh, ledger_dir=store, flaky=flaky_list(), ready=lambda n: merge_ready([str(n)]))
        if code != 0:
            return code
    return 3 if skipped else 0


if __name__ == "__main__":
    sys.exit(main())
