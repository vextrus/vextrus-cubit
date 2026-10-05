"""The factory's only door for launching a session (docs/specs/factory/contracts/launch-cli.md; ticket
f1). Run from the main checkout:

    uv run python -m scripts.factory.launch cloud --branch B --prompt-file F --ticket T --effort E
        [--model M] [--role builder|acceptance-writer|reviewer|refuter] [--untestable "<why>"]
        [--preflight "<lines>"] [--usage-checked "<lines>"] [--prompt-scanned "<count line>"]
        [--budget-minutes N] [--review-file JSON] [--log PATH] [--repository HOST/OWNER/REPO]
        [--record-dir DIR]
    uv run python -m scripts.factory.launch say <session_id> --file F [--ticket T] [--elapsed N/M]
    uv run python -m scripts.factory.launch local --ticket T --branch B --effort E --name N
        --prompt-file F [--model M] [--role builder|acceptance-writer] [--budget-minutes N]

Exit 0: launched (sent) and judged good, first line `OK <reason> <session_id>`. Exit 2: refused, first
line `REFUSED <code>: <reason>` (plus the session id when one exists). Exit 3: the governor refused.
Exit 1: the launcher itself failed (`ERROR <one line>`). Exit 64: a usage error. The prompt or message
text is never printed and never written to a record.

Why the judge: `claude --cloud` silently uploads a local copy of the checkout (a git bundle, no
`origin`) when the Claude GitHub App does not cover the repository; such a session cannot push or open
a PR. Session 05's six cloud tickets and session 06's first diagnostics came up that way (29 Sep 2026;
the cause was read from the CLI's own debug log: "GitHub app is not installed ... Bundling (reason:
github_preflight_failed)"). So every launch runs with a debug log and the log is judged; and since a
refused session keeps running, it is sent STOP at once and listed for deletion in claude.ai/code.
"""

from __future__ import annotations

import argparse
import contextlib
import fcntl
import importlib
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import time
from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import NoReturn

from scripts.factory import stamp, status

REPOSITORY = "github.com/vextrus/vextrus-cubit"
MODEL = "claude-opus-5-5"
ROLES = ("builder", "acceptance-writer", "reviewer", "refuter")
NO_ACCEPTANCE_NEEDED = ("acceptance-writer", "reviewer", "refuter")
EFFORTS = ("low", "medium", "high")
STOP = "STOP: launched wrongly. Do nothing; push nothing."
FACTORY = Path(".private/work/factory")
USAGE = 64

BRANCH = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")
TICKET = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
SESSION = re.compile(r"^session_[A-Za-z0-9]+$")
ELAPSED = re.compile(r"^(\d+)/(\d+)$")
HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX32 = re.compile(r"^[0-9a-f]{32}$")

# The judge's patterns match only at the start of a line's message, after the CLI's `<ISO> [LEVEL] `:
# the CLI writes the prompt into the same log (one `Creating session with payload: {...}` line), and
# a prompt quoting these lines must never choose the session, the source or the environment.
# Lines are split at "\n" only: `str.splitlines()` also breaks at U+2028, U+2029 and U+0085, which
# JSON leaves raw inside the payload line. An own line must carry `[DEBUG] ` (after the CLI's ISO time).
LINE_PREFIX = re.compile(r"^(?:\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z )?\[DEBUG\] ")
BUNDLED = re.compile(r"\[teleportToRemote\] Bundling \(reason: ([^)]*)\)")
SOURCE = re.compile(r"\[teleportToRemote\] Git source: (\S+), revision: (\S+)")
CREATED = re.compile(r"Successfully created remote session: (session_\w+)")
ENV = re.compile(r"Selected environment: (env_\w+) \(([^,]+),")
FALLBACK = re.compile(r"Configured default environment \S+ not found, using first available")
ENVIRONMENT = "vextrus"
# A log with no `Selected environment` line is refused: how the session's environment was chosen is
# then unknown (fail closed; review round 1 of PR #286, F1).
REQUIRE_ENVIRONMENT_LINE = True
LAUNCH_TIMEOUT = 180
KILL_GRACE = 5  # seconds a timed-out launch's processes get between SIGTERM and SIGKILL
LOG_GRACE = 5  # seconds to wait after a timeout before the log is read again (a late session)
MESSAGE_TIMEOUT = 120
TOOL_TIMEOUT = 60
TIMED_OUT = 124  # what a ClaudeRunner returns when the CLI ran out of time (as timeout(1) does)
NOT_FOUND = 127  # what a ClaudeRunner returns when there is no `claude` to run
MAIN_CHECKOUT_DEFAULT = "/home/riz/vextrus-cubit"


# --- the judge -------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Verdict:
    ok: bool
    reason: str
    session: str | None = None
    code: str = "ok"


def judge(log: str, *, repository: str, branch: str, environment: str = ENVIRONMENT) -> Verdict:
    """Read a `claude --debug-file` log of one `--cloud` launch. The environment is checked by name:
    the CLI takes it from the user's `remote.defaultEnvironmentId` and, when that id is unknown,
    silently falls back to the first environment (which carries the drawings token). Only the
    CLI's own lines count (`LINE_PREFIX`); a line that must appear once naming two values is refused."""
    messages = [line[m.end() :] for line in log.split("\n") if (m := LINE_PREFIX.match(line))]

    def found(pattern: re.Pattern[str]) -> list[re.Match[str]]:
        return [m for text in messages if (m := pattern.match(text))]

    sessions = {m.group(1) for m in found(CREATED)}
    session = next(iter(sessions)) if len(sessions) == 1 else None
    for what, pattern in (("session", CREATED), ("git source", SOURCE), ("environment", ENV)):
        if len({m.groups() for m in found(pattern)}) > 1:
            why = f"the log names more than one {what}: which one is meant is unknown"
            return Verdict(False, why, session, "ambiguous-log")
    if bundled := next(iter(found(BUNDLED)), None):
        why = f"bundled, not cloned ({bundled.group(1)}): the session has no origin"
        return Verdict(False, why, session, "bundled")
    source = next(iter(found(SOURCE)), None)
    if source is None:
        why = "the log names no git source: how it was seeded is unknown"
        return Verdict(False, why, session, "no-git-source")
    if source.group(1) != repository:
        return Verdict(False, f"cloned {source.group(1)}, not {repository}", session, "wrong-repository")
    if source.group(2) != branch:
        why = f"cloned at revision {source.group(2)}, not the ticket's branch {branch}"
        return Verdict(False, why, session, "wrong-revision")
    selected = next(iter(found(ENV)), None)
    name = selected.group(2).strip() if selected else None
    fell_back = bool(found(FALLBACK))
    if (
        fell_back
        or (name is not None and name != environment)
        or (name is None and REQUIRE_ENVIRONMENT_LINE)
    ):
        why = f"ran in environment {name or 'unknown'}, not {environment}"
        why += " (the configured default was not found; the CLI took the first)" if fell_back else ""
        return Verdict(False, why, session, "wrong-environment")
    if session is None:
        return Verdict(False, "cloned, but no session was created", None, "no-session")
    return Verdict(True, f"cloned {repository} at {branch}", session)


# --- the seams -------------------------------------------------------------------------------------


@dataclass(frozen=True)
class ScanResult:
    clean: bool
    counts: str


@dataclass(frozen=True)
class Reading:
    ok: bool
    text: str


@dataclass(frozen=True)
class Outcome:
    exit_code: int
    line: str
    session: str | None = None


ClaudeRunner = Callable[[list[str]], int]
Scan = Callable[[str], ScanResult]
Govern = Callable[[], Reading]
Send = Callable[[list[str]], tuple[int, str]]


def default_claude(argv: list[str]) -> int:
    """Run one CLI command. A launch wants a terminal: `script` gives it one and keeps its screen out
    of ours (`shlex.join` quotes the prompt for `/bin/sh`). A `-p` message needs none."""
    if shutil.which(argv[0]) is None:
        return NOT_FOUND
    if "-p" in argv:
        code, out = default_send(argv)
        return 0 if code == 0 and _json_ok(out) else 1
    try:
        child = subprocess.Popen(
            ["script", "-q", "-c", shlex.join(argv), "/dev/null"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            env={**os.environ, "SHELL": "/bin/sh"},
            start_new_session=True,
        )
    except OSError:
        return NOT_FOUND
    try:
        return child.wait(timeout=LAUNCH_TIMEOUT)
    except subprocess.TimeoutExpired:
        _kill_tree(child)
        return TIMED_OUT
    except BaseException:
        _kill_tree(child)
        raise


def _proc_stats() -> Iterator[tuple[int, str, int, int]]:
    """(pid, state, parent pid, session id) of every process `/proc` lists (Linux: the factory runs
    on WSL and cloud Linux)."""
    for stat in Path("/proc").glob("[0-9]*/stat"):
        try:
            fields = stat.read_text().rpartition(")")[2].split()
        except OSError:
            continue
        yield int(stat.parent.name), fields[0], int(fields[1]), int(fields[3])


def _tree(root: int, known: set[int]) -> set[int]:
    """`root`, `known`, their descendants, and every process in one of their sessions: `script`
    gives the CLI a session of its own, and a child the CLI forks late (in its SIGTERM handler, say)
    stays in that session after it is reparented, so each round finds it again."""
    # Never the launcher's own session, itself or init, whatever /proc says (a wrong field once
    # took in every process on the machine).
    spared = {0, os.getsid(0)}
    stats = [s for s in _proc_stats() if s[0] not in (1, os.getpid()) and s[3] not in spared]
    tree = {root, *known}
    sessions = {sid for pid, _, _, sid in stats if pid in tree}
    grown = True
    while grown:
        more = {pid for pid, _, parent, sid in stats if parent in tree or sid in sessions} - tree
        sessions |= {sid for pid, _, _, sid in stats if pid in more}
        tree |= more
        grown = bool(more)
    return tree


def _alive(pids: set[int]) -> set[int]:
    """Those of `pids` still running (a zombie is dead: only its parent's wait is missing)."""
    return pids & {pid for pid, state, _, _ in _proc_stats() if state != "Z"}


def _kill_tree(child: subprocess.Popen[bytes]) -> None:
    """SIGTERM the child's whole tree (`_tree`) and process groups, then SIGKILL what outlives
    `KILL_GRACE`, and return only when each is gone. The tree is read again before every signal and
    while waiting, so neither an orphan nor a late fork escapes."""
    tree: set[int] = set()
    for sig in (signal.SIGTERM, signal.SIGKILL):
        tree = _tree(child.pid, tree)
        for pid in _alive(tree):
            with contextlib.suppress(OSError):
                os.kill(pid, sig)
            with contextlib.suppress(OSError):
                os.killpg(pid, sig)
        deadline = time.monotonic() + KILL_GRACE
        while child.poll() is None or _alive(tree := _tree(child.pid, tree)):
            if time.monotonic() > deadline:
                break
            time.sleep(0.05)


def _json_ok(out: str) -> bool:
    try:
        reply = json.loads(out)
    except ValueError:
        return False
    return isinstance(reply, dict) and reply.get("ok") is True


def default_scan(root: Path) -> Scan | None:
    """This tree's leak scan (f2's `tools/leakscan`), or None when the tree has none."""
    if not (root / "tools" / "leakscan" / "__main__.py").is_file():
        return None

    def scan(text: str) -> ScanResult:
        try:
            done = subprocess.run(
                [sys.executable, "-m", "tools.leakscan", "text", "--stdin"],
                cwd=root,
                input=text,
                capture_output=True,
                text=True,
                check=False,
                timeout=TOOL_TIMEOUT,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            return ScanResult(False, f"leakscan did not run ({type(error).__name__})")
        counts = _last_line(done.stdout) or f"leakscan exited {done.returncode}"
        return ScanResult(done.returncode == 0, counts)

    return scan


def default_govern(root: Path, usage_checked: str | None = None) -> Govern | None:
    """This tree's governor (f3's `scripts/factory/governor.py`), or None when the tree has none."""
    if not (root / "scripts" / "factory" / "governor.py").is_file():
        return None
    command = [sys.executable, "-m", "scripts.factory.governor", "check", "cloud-session"]
    command += ["--usage-checked", usage_checked] if usage_checked else []

    def govern() -> Reading:
        try:
            done = subprocess.run(
                command, cwd=root, capture_output=True, text=True, check=False, timeout=TOOL_TIMEOUT
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            return Reading(False, f"the governor did not run ({type(error).__name__})")
        said = " ".join(done.stdout.split())
        if done.returncode == 0:
            return Reading(True, said)
        if done.returncode == 3:
            return Reading(False, said or "the governor refused without a reason")
        return Reading(False, f"the governor failed (exit {done.returncode})")

    return govern


def default_snapshot() -> str:
    try:
        done = subprocess.run(
            ["claude", "agents", "--json", "--all"],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=False,
            timeout=TOOL_TIMEOUT,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return json.dumps({"error": f"claude agents did not run ({type(error).__name__})"})
    if done.returncode != 0:
        return json.dumps({"error": f"claude agents exited {done.returncode}"})
    return done.stdout


def default_send(argv: list[str]) -> tuple[int, str]:
    try:
        done = subprocess.run(
            argv,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=False,
            timeout=MESSAGE_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return 1, f"the CLI did not answer in {MESSAGE_TIMEOUT} s"
    except OSError as error:
        return 1, f"the CLI did not run ({type(error).__name__})"
    return done.returncode, done.stdout


class Default:
    """Marks a seam left out: `launch_cloud` then uses this tree's own leak scan or governor."""


DEFAULT = Default()


def utcnow() -> datetime:
    return datetime.now(UTC)


def _last_line(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[-1] if lines else ""


# --- arguments -------------------------------------------------------------------------------------


class Parser(argparse.ArgumentParser):
    """A usage error is exit 64, so a REFUSED (2) is never mistaken for a typo."""

    def error(self, message: str) -> NoReturn:
        self.print_usage(sys.stderr)
        self.exit(USAGE, f"{self.prog}: error: {message}\n")


def _shaped(pattern: re.Pattern[str], what: str) -> Callable[[str], str]:
    def check(value: str) -> str:
        if not pattern.match(value) or ".." in value:
            raise argparse.ArgumentTypeError(f"not a valid {what}")
        return value

    return check


def _minutes(value: str) -> int:
    if not value.isdigit():
        raise argparse.ArgumentTypeError("not a whole number of minutes")
    return int(value)


@dataclass(frozen=True)
class Review:
    pr: int
    head_sha: str
    nonce: str

    @property
    def branch(self) -> str:
        return f"review/{self.pr}-{self.nonce[:8]}"

    def as_record(self) -> dict[str, object]:
        return {"pr": self.pr, "head_sha": self.head_sha, "nonce": self.nonce, "branch": self.branch}


@dataclass(frozen=True)
class CloudRequest:
    branch: str
    prompt_file: Path
    ticket: str
    effort: str
    model: str = MODEL
    role: str = "builder"
    untestable: str | None = None
    preflight: str | None = None
    usage_checked: str | None = None
    prompt_scanned: str | None = None
    budget_minutes: int | None = None
    review: Review | None = None
    log: Path | None = None
    repository: str = REPOSITORY
    record_dir: Path | None = None


def _read_review(path: Path) -> Review | None:
    """The review file, or None when it is unreadable or malformed (its content is never echoed)."""
    try:
        data = json.loads(path.read_text())
    except OSError, ValueError:
        return None
    if not isinstance(data, dict) or set(data) != {"pr", "head_sha", "nonce"}:
        return None
    pr, head, nonce = data["pr"], data["head_sha"], data["nonce"]
    if not (isinstance(pr, int) and not isinstance(pr, bool) and pr > 0):
        return None
    if not (
        isinstance(head, str) and HEX40.match(head) and isinstance(nonce, str) and HEX32.match(nonce)
    ):
        return None
    return Review(pr, head, nonce)


def parse_cloud(argv: list[str]) -> CloudRequest:
    """The `cloud` subcommand's arguments (without the word `cloud`); a usage error exits 64."""
    p = Parser(prog="scripts.factory.launch cloud")
    p.add_argument("--branch", required=True, type=_shaped(BRANCH, "branch name"))
    p.add_argument("--prompt-file", required=True, type=Path)
    p.add_argument("--ticket", required=True, type=_shaped(TICKET, "ticket id"))
    p.add_argument("--effort", required=True, choices=EFFORTS)
    p.add_argument("--model", default=MODEL, type=_shaped(TICKET, "model id"))
    p.add_argument("--role", default="builder", choices=ROLES)
    p.add_argument("--untestable")
    p.add_argument("--preflight")
    p.add_argument("--usage-checked")
    p.add_argument("--prompt-scanned")
    p.add_argument("--budget-minutes", type=_minutes)
    p.add_argument("--review-file", type=Path)
    p.add_argument("--log", type=Path)
    p.add_argument("--repository", default=REPOSITORY)
    p.add_argument("--record-dir", type=Path)
    a = p.parse_args(argv)
    review = None
    if a.review_file is not None:
        if a.role not in ("reviewer", "refuter"):
            p.error("--review-file is for --role reviewer or refuter only")
        review = _read_review(a.review_file)
        if review is None:
            p.error('--review-file is not {"pr": <int>, "head_sha": "<40 hex>", "nonce": "<32 hex>"}')
    return CloudRequest(
        branch=a.branch,
        prompt_file=a.prompt_file,
        ticket=a.ticket,
        effort=a.effort,
        model=a.model,
        role=a.role,
        untestable=a.untestable,
        preflight=a.preflight,
        usage_checked=a.usage_checked,
        prompt_scanned=a.prompt_scanned,
        budget_minutes=a.budget_minutes,
        review=review,
        log=a.log,
        repository=a.repository,
        record_dir=a.record_dir,
    )


# --- git -------------------------------------------------------------------------------------------


class GitFailed(Exception):
    """A git command that did not answer (failed, timed out or missing): the launcher's own error,
    never a refusal saying the branch or the checkout is wrong."""


def _git_ok(root: Path, *args: str) -> str:
    """One git command's output, or GitFailed naming it."""
    done = _git(root, *args)
    if done.returncode:
        raise GitFailed(f"git {args[0]} failed: {_last_line(done.stderr) or f'exit {done.returncode}'}")
    return done.stdout


def _git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    """One git command; a hang or a missing git reads as a failed command, never a traceback."""
    command = ["git", "-C", str(root), *args]
    try:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            stdin=subprocess.DEVNULL,
            timeout=TOOL_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(
            command, 124, "", f"git {args[0]} timed out after {TOOL_TIMEOUT} s"
        )
    except OSError as error:
        return subprocess.CompletedProcess(command, 127, "", f"git did not run ({type(error).__name__})")


def launches_dir() -> Path:
    """Where `cloud` writes its records by default, and where `say` reads a ticket's budget."""
    return main_checkout() / FACTORY / "launches"


def account_problem(environ: Mapping[str, str], home: Path) -> str | None:
    """None when this is account A's config (`CLAUDE_CONFIG_DIR` unset, empty or `~/.claude`), else
    why not, in one line: a session can message only sessions of its own config (CLAUDE.md)."""
    value = environ.get("CLAUDE_CONFIG_DIR", "")
    if not value or Path(value).expanduser().resolve() == (home / ".claude").resolve():
        return None
    return (
        f"CLAUDE_CONFIG_DIR is {value}, not account A's {home / '.claude'}:"
        " launch from the default config, whose sessions the orchestrator can message"
    )


def _wrong_account() -> int | None:
    """2 after printing the refusal when this is not account A's config; None when it is."""
    problem = account_problem(os.environ, Path.home())
    return None if problem is None else _refused("wrong-account", problem).exit_code


def main_checkout() -> Path:
    """The one folder launches run from (`VEXTRUS_MAIN_CHECKOUT` moves it, for tests)."""
    return Path(os.environ.get("VEXTRUS_MAIN_CHECKOUT", MAIN_CHECKOUT_DEFAULT)).resolve()


def is_main_checkout(root: Path) -> bool:
    """True only at the top of the main checkout: the configured folder, its own top level, and a
    git dir that is the common one (a linked worktree's is not). A standalone clone elsewhere hangs
    at the CLI's trust dialog; a subdirectory is not the checkout. GitFailed when git did not answer."""
    if root.resolve() != main_checkout():
        return False
    top = _git_ok(root, "rev-parse", "--show-toplevel")
    own = _git_ok(root, "rev-parse", "--path-format=absolute", "--absolute-git-dir")
    common = _git_ok(root, "rev-parse", "--path-format=absolute", "--git-common-dir")
    if Path(top.strip()).resolve() != root.resolve():
        return False
    return Path(own.strip()).resolve() == Path(common.strip()).resolve()


def origin_sha(root: Path, branch: str) -> str | None:
    """The sha of exactly `refs/heads/<branch>` on origin, by `git ls-remote` (never a local ref);
    None when origin answers without it, GitFailed when it does not answer."""
    for line in _git_ok(root, "ls-remote", "--heads", "origin", branch).splitlines():
        sha, _, ref = line.partition("\t")
        if ref.strip() == f"refs/heads/{branch}":
            return sha.strip()
    return None


def has_acceptance_commit(root: Path, branch: str, sha: str) -> bool | str:
    """True when origin's branch tip carries an `acceptance:` commit ahead of origin/main; a string
    names why it could not be read."""
    fetched = _git(
        root,
        "fetch",
        "-q",
        "origin",
        f"+refs/heads/{branch}:refs/remotes/origin/{branch}",
        "+refs/heads/main:refs/remotes/origin/main",
    )
    if fetched.returncode:
        return f"git fetch origin {branch} failed: {_last_line(fetched.stderr)}"
    tip = _git(root, "rev-parse", f"refs/remotes/origin/{branch}").stdout.strip()
    if tip != sha:
        return f"origin's {branch} moved while launching ({sha[:12]} then {tip[:12]})"
    subjects = _git(root, "log", "--format=%s", f"refs/remotes/origin/main..{sha}")
    if subjects.returncode:
        return f"git log origin/main..{branch} failed: {_last_line(subjects.stderr)}"
    return any(line.startswith("acceptance:") for line in subjects.stdout.splitlines())


def cli_version() -> str:
    try:
        done = subprocess.run(
            ["claude", "--version"],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=False,
            timeout=TOOL_TIMEOUT,
        )
    except OSError, subprocess.TimeoutExpired:
        return "unknown"
    words = done.stdout.split()
    return words[0] if done.returncode == 0 and words else "unknown"


# --- cloud -----------------------------------------------------------------------------------------


def preamble(branch: str, repository: str) -> str:
    return (
        "Before anything else run `git remote get-url origin` and `git branch --show-current`. "
        f"The remote must be {repository} and the branch `{branch}`. If either differs, "
        "stop without pushing: push nothing, comment nothing, say why and end.\n"
    )


def _refused(code: str, reason: str, session: str | None = None, exit_code: int = 2) -> Outcome:
    line = f"REFUSED {code}: {reason}" + (f" {session}" if session else "")
    print(line)
    return Outcome(exit_code, line, session)


def _error(message: str) -> Outcome:
    line = f"ERROR {message}"
    print(line)
    return Outcome(1, line)


@dataclass
class _Proving:
    """The proven-CLI rule: a version not yet in `proven-cli.txt` is allowed one launch at a time;
    an OK verdict adds it. The lock is a `flock` on `proven-cli.lock`, held on a descriptor open for
    the whole launch, so the kernel lets it go when the launcher dies however it dies."""

    folder: Path
    version: str
    fd: int | None = field(default=None)

    @property
    def listed(self) -> Path:
        return self.folder / "proven-cli.txt"

    @property
    def lock(self) -> Path:
        return self.folder / "proven-cli.lock"

    def proven(self) -> bool:
        try:
            return self.version in self.listed.read_text().split()
        except OSError:
            return False

    def acquire(self) -> bool:
        self.folder.mkdir(parents=True, exist_ok=True)
        fd = os.open(self.lock, os.O_CREAT | os.O_WRONLY, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(fd)
            return False
        os.ftruncate(fd, 0)
        os.write(fd, f"{os.getpid()} {self.version}\n".encode())
        self.fd = fd
        return True

    def release(self, ok: bool) -> None:
        if self.fd is None:
            return
        if ok and self.version != "unknown":
            with self.listed.open("a") as out:
                out.write(f"{self.version}\n")
        fcntl.flock(self.fd, fcntl.LOCK_UN)
        os.close(self.fd)
        self.fd = None


@dataclass
class _Run:
    """One `cloud` run's record: written for every run past the argument check, refused or not."""

    req: CloudRequest
    record_dir: Path
    started: datetime
    snapshot: Callable[[], str]
    governor: dict[str, object] = field(default_factory=dict)
    leak_scan: dict[str, str] = field(default_factory=lambda: {"status": "not-run", "line": ""})
    cli_version: str = "unknown"

    @property
    def stamp(self) -> str:
        return self.started.strftime("%Y%m%dT%H%M%SZ")

    def write(self, verdict: Verdict, *, stop_sent: bool = False) -> None:
        record = {
            "ticket": self.req.ticket,
            "branch": self.req.branch,
            "where": "cloud",
            "role": self.req.role,
            "effort": self.req.effort,
            "model": self.req.model,
            "budget_minutes": self.req.budget_minutes,
            "session_id": verdict.session,
            "cli_version": self.cli_version,
            # The moment as given; `launch_cloud` gives whole seconds, the canonical `status.utc`
            # form the watcher reads (`status.parse_utc` reads an older record's fraction too).
            "started_at": self.started.isoformat().replace("+00:00", "Z"),
            "governor": self.governor,
            "leak_scan": self.leak_scan,
            "judge": {"ok": verdict.ok, "code": verdict.code, "reason": verdict.reason},
            "stop_sent": stop_sent,
            "untestable": self.req.untestable,
            "review": self.req.review.as_record() if self.req.review else None,
        }
        try:
            self.record_dir.mkdir(parents=True, exist_ok=True)
            path, agents = self._free_name()
            with path.open("x") as out:
                out.write(json.dumps(record, indent=2) + "\n")
            agents.write_text(self.snapshot())
        except OSError as error:
            print(f"ERROR the launch record was not written ({type(error).__name__}: {error.filename})")
            return
        print(f"record: {path}")

    def _free_name(self) -> tuple[Path, Path]:
        """`<ticket>-<utc>.json`, or `-2`, `-3`... after it: a record is never overwritten."""
        base = f"{self.req.ticket}-{self.stamp}"
        for n in range(1, 1000):
            name = base if n == 1 else f"{base}-{n}"
            if not (self.record_dir / f"{name}.json").exists():
                return self.record_dir / f"{name}.json", self.record_dir / f"{name}.agents.json"
        raise FileExistsError(f"{base}: too many records this second")

    def refuse(self, code: str, reason: str, exit_code: int = 2) -> Outcome:
        if code == "governor":
            line = f"REFUSED governor: {reason}"
            print(line)
            outcome = Outcome(exit_code, line)
        else:
            outcome = _refused(code, reason)
        self.write(Verdict(False, reason, None, code))
        return outcome

    def error(self, message: str) -> Outcome:
        """The launcher's own failure (exit 1), recorded like a refusal with the code `error`."""
        outcome = _error(message)
        self.write(Verdict(False, message, None, "error"))
        return outcome


def launch_cloud(
    req: CloudRequest,
    *,
    root: Path,
    claude: ClaudeRunner = default_claude,
    scan: Scan | Default | None = DEFAULT,
    govern: Govern | Default | None = DEFAULT,
    snapshot: Callable[[], str] = default_snapshot,
    now: Callable[[], datetime] = utcnow,
    sleep: Callable[[float], None] = time.sleep,
) -> Outcome:
    """Refuse, or launch and judge one cloud session; print the run's lines and write its record
    (refusals before the launch too, with no session). `scan` and `govern` None mean the tree has no
    leak scan or governor yet (then `--prompt-scanned` and `--preflight` stand in for them); left
    out, they are this tree's own. Every run past the usage checks writes one record."""
    scan = default_scan(root) if isinstance(scan, Default) else scan
    govern = default_govern(root, req.usage_checked) if isinstance(govern, Default) else govern
    if not BRANCH.match(req.branch) or ".." in req.branch or not TICKET.match(req.ticket):
        print("error: a malformed --branch or --ticket", file=sys.stderr)
        return Outcome(USAGE, "usage: a malformed --branch or --ticket")
    if req.untestable is not None and not req.untestable.strip():
        print("error: --untestable needs a reason", file=sys.stderr)
        return Outcome(USAGE, "usage: --untestable needs a reason")
    record_dir = req.record_dir or launches_dir()
    run = _Run(req, record_dir, now().astimezone(UTC).replace(microsecond=0), snapshot)
    if problem := account_problem(os.environ, Path.home()):
        return run.refuse("wrong-account", problem)
    try:
        text = req.prompt_file.read_text()
    except (OSError, UnicodeDecodeError) as error:
        return run.error(f"cannot read the prompt file ({type(error).__name__})")
    run.cli_version = cli_version()

    try:
        at_main = is_main_checkout(root)
        sha = origin_sha(root, req.branch) if at_main else None
    except GitFailed as error:
        return run.error(str(error))
    if not at_main:
        return run.refuse(
            "not-main-checkout",
            f"{root} is not the top of the main checkout {main_checkout()}"
            " (a linked worktree, another clone or a subdirectory)",
        )
    if sha is None:
        return run.refuse(
            "branch-not-on-origin", f"git ls-remote finds no refs/heads/{req.branch} on origin"
        )
    if req.role not in NO_ACCEPTANCE_NEEDED and req.untestable is None:
        found = has_acceptance_commit(root, req.branch, sha)
        if isinstance(found, str):
            return run.error(found)
        if not found:
            return run.refuse(
                "no-acceptance-commit",
                f"origin/{req.branch} has no `acceptance:` commit ahead of origin/main"
                " (or give --untestable)",
            )

    if govern is not None:
        reading = govern()
        run.governor = {"source": "governor", "reading": reading.text}
        if not reading.ok:
            return run.refuse("governor", reading.text, exit_code=3)
    elif req.preflight:
        run.governor = {"source": "preflight", "reading": req.preflight}
    else:
        return run.refuse(
            "no-preflight",
            "no governor on this tree: give --preflight with the df, free and /usage lines",
        )
    if req.usage_checked:
        run.governor["usage_checked"] = req.usage_checked

    prompt = preamble(req.branch, req.repository) + "\n" + text
    if scan is not None:
        scanned = scan(prompt)
        run.leak_scan = {"status": "clean" if scanned.clean else "hit", "line": scanned.counts}
        if not scanned.clean:
            return run.refuse(
                "prompt-leak", f"the leak scan found a hit in the prompt ({scanned.counts})"
            )
    elif req.prompt_scanned:
        run.leak_scan = {"status": "interim", "line": req.prompt_scanned}
    else:
        return run.refuse(
            "leakscan-unavailable",
            "no leak scan on this tree: give --prompt-scanned with the count line",
        )

    log = req.log or record_dir / f"{req.ticket}-{run.stamp}.debug.log"
    if log.exists():
        # Never overwritten: an earlier launch's lines must never judge this one.
        return run.error(f"the debug log {log} already exists; give a new --log")
    try:
        log.parent.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        return run.error(f"cannot make the debug log's folder ({type(error).__name__})")

    proving = _Proving(root / FACTORY, run.cli_version)
    if not proving.proven() and not proving.acquire():
        return run.error(
            f"CLI {run.cli_version} is not yet proven and another launch holds"
            f" {proving.lock}; wait for it"
        )
    verdict = Verdict(False, "the launch did not run", None, "no-session")
    try:
        argv = ["claude", "--debug-file", str(log), "--model", req.model, "--effort", req.effort]
        code = claude([*argv, "--on-branch", req.branch, "--cloud", prompt])
        if code == NOT_FOUND:
            return run.error("the claude CLI is not on PATH")
        if code == TIMED_OUT:
            sleep(LOG_GRACE)  # the CLI may name its session a moment after the time ran out
        try:
            judged = log.read_text(errors="replace")
        except OSError:
            judged = ""
        verdict = judge(judged, repository=req.repository, branch=req.branch)
        if code == TIMED_OUT:
            why = f"the launch did not finish in {LAUNCH_TIMEOUT} s ({verdict.reason})"
            verdict = Verdict(
                False, why, verdict.session, "launch-timeout" if verdict.session else "no-session"
            )
    finally:
        proving.release(verdict.ok)

    session = verdict.session
    stop_sent = False
    if verdict.ok:
        line = f"OK {verdict.reason} {session}"
        print(line)
        outcome = Outcome(0, line, session)
    else:
        outcome = _refused(verdict.code, verdict.reason, session)
        if session:
            stop_sent = (
                claude(["claude", "-p", STOP, "--cloud", session, "--output-format", "json"]) == 0
            )
            with (record_dir / "to-delete.txt").open("a") as listed:
                listed.write(f"{session}\n")
            print(f"DELETE {session}")
    run.write(verdict, stop_sent=stop_sent)
    return outcome


# --- say -------------------------------------------------------------------------------------------


def say(
    session_id: str,
    text: str,
    *,
    elapsed: str,
    scan: Scan | None,
    send: Send = default_send,
) -> Outcome:
    """Leak-scan one message, prefix `[elapsed n/m min]`, send it to a cloud session, read `{ok}`."""
    if not SESSION.match(session_id) or not ELAPSED.match(elapsed):
        print("error: a malformed session id or elapsed time", file=sys.stderr)
        return Outcome(USAGE, "usage: a malformed session id or elapsed time")
    if scan is None:
        return _refused(
            "leakscan-unavailable", "no leak scan on this tree: a message is never sent unscanned"
        )
    scanned = scan(text)
    if not scanned.clean:
        return _refused("prompt-leak", f"the leak scan found a hit in the message ({scanned.counts})")
    code, out = send(
        [
            "claude",
            "-p",
            f"[elapsed {elapsed} min] {text}",
            "--cloud",
            session_id,
            "--output-format",
            "json",
        ]
    )
    try:
        reply = json.loads(out)
    except ValueError:
        reply = None
    if not isinstance(reply, dict):
        return _refused("send-failed", f"the CLI's reply is not JSON (exit {code})")
    if code != 0 or reply.get("ok") is not True:
        why = (
            reply.get("error")
            if isinstance(reply.get("error"), str)
            else f"ok is not true (exit {code})"
        )
        return _refused("send-failed", " ".join(str(why).split()))
    line = f"OK sent {session_id}"
    print(line)
    return Outcome(0, line, session_id)


def _record_elapsed(ticket: str, session_id: str) -> str | None:
    """`n/m` from the ticket's launch record (`started_at`, `budget_minutes`): the one naming the
    session being messaged, else the newest. Only a launch judged OK counts: a refused or failed run
    writes a record too, and must never restart the clock (review round 2 of PR #371). No budget file
    is written for a cloud launch: linked worktrees share `.git/vextrus/`, and the local builders'
    clock would read a cloud ticket's budget as theirs (review round 1)."""
    launched: list[tuple[bool, datetime, int]] = []
    for path in launches_dir().glob(f"{ticket}-*.json"):
        try:
            record = json.loads(path.read_text())
            started, minutes = status.parse_utc(record["started_at"]), record["budget_minutes"]
            ok = record["judge"]["ok"] is True and record.get("stop_sent") is not True
        except OSError, ValueError, KeyError, TypeError:
            continue
        if record.get("ticket") == ticket and type(minutes) is int and ok:
            launched.append((record.get("session_id") == session_id, started, minutes))
    if not launched:
        return None
    _, started, minutes = max(launched)
    return f"{status.minutes_between(started, status.now())}/{minutes}"


def _stamp_elapsed(ticket: str | None, session_id: str) -> str | None:
    """`n/m` from the ticket's newest launch record, else from the session's own `stamp elapsed`
    line (`session h:mm/h:mm`); None when neither exists."""
    if ticket and (found := _record_elapsed(ticket, session_id)):
        return found
    try:
        line = stamp.elapsed(None)
    except stamp.Refused:
        return None
    clock = re.search(r"session (\d+):(\d\d)/(\d+):(\d\d)", line)
    if clock is None:
        return None
    h, m, budget_h, budget_m = (int(g) for g in clock.groups())
    return f"{h * 60 + m}/{budget_h * 60 + budget_m}"


def main_say(argv: list[str]) -> int:
    p = Parser(prog="scripts.factory.launch say")
    p.add_argument("session_id", type=_shaped(SESSION, "session id"))
    p.add_argument("--file", required=True, type=Path)
    p.add_argument("--ticket", type=_shaped(TICKET, "ticket id"))
    p.add_argument("--elapsed")
    a = p.parse_args(argv)
    if (refused := _wrong_account()) is not None:
        return refused
    root = Path.cwd()
    elapsed = a.elapsed if a.elapsed is not None else _stamp_elapsed(a.ticket, a.session_id)
    if elapsed is None or not ELAPSED.match(elapsed):
        p.error("no elapsed time: give --elapsed N/M, or --ticket of a launch with a budget")
    try:
        text = a.file.read_text()
    except (OSError, UnicodeDecodeError) as error:
        return _error(f"cannot read the message file ({type(error).__name__})").exit_code
    return say(a.session_id, text, elapsed=elapsed, scan=default_scan(root)).exit_code


# --- local -----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class LocalRequest:
    ticket: str
    branch: str
    effort: str
    name: str
    prompt_file: Path
    model: str | None = None
    role: str | None = None
    budget_minutes: int | None = None

    def to_argv(self) -> list[str]:
        argv = ["--ticket", self.ticket, "--branch", self.branch, "--effort", self.effort]
        argv += ["--name", self.name, "--prompt-file", str(self.prompt_file)]
        argv += ["--model", self.model] if self.model else []
        argv += ["--role", self.role] if self.role else []
        argv += ["--budget-minutes", str(self.budget_minutes)] if self.budget_minutes is not None else []
        return argv


def parse_local(argv: list[str]) -> LocalRequest:
    p = Parser(prog="scripts.factory.launch local")
    p.add_argument("--ticket", required=True, type=_shaped(TICKET, "ticket id"))
    p.add_argument("--branch", required=True, type=_shaped(BRANCH, "branch name"))
    p.add_argument("--effort", required=True, choices=EFFORTS)
    p.add_argument("--name", required=True, type=_shaped(TICKET, "session name"))
    p.add_argument("--prompt-file", required=True, type=Path)
    p.add_argument("--model", type=_shaped(TICKET, "model id"))
    p.add_argument("--role", choices=("builder", "acceptance-writer"))
    p.add_argument("--budget-minutes", type=_minutes)
    a = p.parse_args(argv)
    return LocalRequest(
        a.ticket, a.branch, a.effort, a.name, a.prompt_file, a.model, a.role, a.budget_minutes
    )


def _default_local_run(request: LocalRequest) -> int:
    try:
        local = importlib.import_module("scripts.factory.local")
    except ImportError:
        print("ERROR local launcher not merged (f3)")
        return 1
    code: int = local.main(request.to_argv())
    return code


def launch_local(argv: list[str], *, local_run: Callable[[LocalRequest], int] | None = None) -> int:
    """Parse `local`'s arguments here; f3's `scripts/factory/local.py` runs them."""
    request = parse_local(argv)
    if (refused := _wrong_account()) is not None:
        return refused
    return (local_run or _default_local_run)(request)


# --- the command line ------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    command, rest = (args[0], args[1:]) if args else ("", [])
    if command == "cloud":
        request = parse_cloud(rest)
        return launch_cloud(request, root=Path.cwd()).exit_code
    if command == "say":
        return main_say(rest)
    if command == "local":
        return launch_local(rest)
    print("usage: python -m scripts.factory.launch {cloud,say,local} ...", file=sys.stderr)
    return USAGE


if __name__ == "__main__":
    sys.exit(main())
