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
import importlib
import json
import os
import re
import shlex
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import NoReturn

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

BUNDLED = re.compile(r"\[teleportToRemote\] Bundling \(reason: ([^)]*)\)")
SOURCE = re.compile(r"\[teleportToRemote\] Git source: (\S+), revision: (\S+)")
CREATED = re.compile(r"Successfully created remote session: (session_\w+)")


# --- the judge -------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Verdict:
    ok: bool
    reason: str
    session: str | None = None
    code: str = "ok"


def judge(log: str, *, repository: str, branch: str) -> Verdict:
    """Read a `claude --debug-file` log of one `--cloud` launch."""
    session = m.group(1) if (m := CREATED.search(log)) else None
    if bundled := BUNDLED.search(log):
        why = f"bundled, not cloned ({bundled.group(1)}): the session has no origin"
        return Verdict(False, why, session, "bundled")
    source = SOURCE.search(log)
    if source is None:
        why = "the log names no git source: how it was seeded is unknown"
        return Verdict(False, why, session, "no-git-source")
    if source.group(1) != repository:
        return Verdict(False, f"cloned {source.group(1)}, not {repository}", session, "wrong-repository")
    if source.group(2) != branch:
        why = f"cloned at revision {source.group(2)}, not the ticket's branch {branch}"
        return Verdict(False, why, session, "wrong-revision")
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
    if "-p" in argv:
        done = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, check=False)
        return done.returncode
    done = subprocess.run(
        ["script", "-q", "-c", shlex.join(argv), "/dev/null"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        env={**os.environ, "SHELL": "/bin/sh"},
        check=False,
    )
    return done.returncode


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
            )
        except OSError as error:
            return ScanResult(False, f"leakscan did not run ({error})")
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
            done = subprocess.run(command, cwd=root, capture_output=True, text=True, check=False)
        except OSError as error:
            return Reading(False, f"the governor did not run ({error})")
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
        )
    except OSError as error:
        return json.dumps({"error": f"claude agents did not run ({error})"})
    if done.returncode != 0:
        return json.dumps({"error": f"claude agents exited {done.returncode}"})
    return done.stdout


def default_send(argv: list[str]) -> tuple[int, str]:
    try:
        done = subprocess.run(
            argv, stdin=subprocess.DEVNULL, capture_output=True, text=True, check=False
        )
    except OSError as error:
        return 1, f"the CLI did not run ({error})"
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


def _git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        check=False,
        stdin=subprocess.DEVNULL,
    )


def is_main_checkout(root: Path) -> bool:
    """True in the main checkout: its git dir is the common one (a linked worktree's is not)."""
    own = _git(root, "rev-parse", "--path-format=absolute", "--absolute-git-dir")
    common = _git(root, "rev-parse", "--path-format=absolute", "--git-common-dir")
    if own.returncode or common.returncode:
        return False
    return Path(own.stdout.strip()).resolve() == Path(common.stdout.strip()).resolve()


def origin_sha(root: Path, branch: str) -> str | None:
    """The sha of exactly `refs/heads/<branch>` on origin, by `git ls-remote` (never a local ref)."""
    listed = _git(root, "ls-remote", "--heads", "origin", branch)
    if listed.returncode:
        return None
    for line in listed.stdout.splitlines():
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
        )
    except OSError:
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
    """The proven-CLI rule: a version not yet in `proven-cli.txt` is allowed one launch at a time
    (a lock beside the list); an OK verdict adds it."""

    folder: Path
    version: str
    held: bool = field(default=False)

    @property
    def listed(self) -> Path:
        return self.folder / "proven-cli.txt"

    def proven(self) -> bool:
        try:
            return self.version in self.listed.read_text().split()
        except OSError:
            return False

    def acquire(self) -> bool:
        self.folder.mkdir(parents=True, exist_ok=True)
        try:
            os.close(os.open(self.folder / "proven-cli.lock", os.O_CREAT | os.O_EXCL | os.O_WRONLY))
        except FileExistsError:
            return False
        self.held = True
        return True

    def release(self, ok: bool) -> None:
        if not self.held:
            return
        if ok and self.version != "unknown":
            with self.listed.open("a") as out:
                out.write(f"{self.version}\n")
        (self.folder / "proven-cli.lock").unlink(missing_ok=True)
        self.held = False


def launch_cloud(
    req: CloudRequest,
    *,
    root: Path,
    claude: ClaudeRunner = default_claude,
    scan: Scan | Default | None = DEFAULT,
    govern: Govern | Default | None = DEFAULT,
    snapshot: Callable[[], str] = default_snapshot,
    now: Callable[[], datetime] = utcnow,
) -> Outcome:
    """Refuse, or launch and judge one cloud session; print the run's lines and write its record.
    `scan` and `govern` None mean the tree has no leak scan or governor yet (then `--prompt-scanned`
    and `--preflight` stand in for them); left out, they are this tree's own."""
    scan = default_scan(root) if isinstance(scan, Default) else scan
    govern = default_govern(root, req.usage_checked) if isinstance(govern, Default) else govern
    if not BRANCH.match(req.branch) or ".." in req.branch or not TICKET.match(req.ticket):
        print("error: a malformed --branch or --ticket", file=sys.stderr)
        return Outcome(USAGE, "usage: a malformed --branch or --ticket")
    try:
        text = req.prompt_file.read_text()
    except (OSError, UnicodeDecodeError) as error:
        return _error(f"cannot read the prompt file ({type(error).__name__})")

    if not is_main_checkout(root):
        return _refused(
            "not-main-checkout", f"{root} is not the main checkout (a linked worktree or no checkout)"
        )
    sha = origin_sha(root, req.branch)
    if sha is None:
        return _refused(
            "branch-not-on-origin", f"git ls-remote finds no refs/heads/{req.branch} on origin"
        )
    if req.role not in NO_ACCEPTANCE_NEEDED and req.untestable is None:
        found = has_acceptance_commit(root, req.branch, sha)
        if isinstance(found, str):
            return _error(found)
        if not found:
            return _refused(
                "no-acceptance-commit",
                f"origin/{req.branch} has no `acceptance:` commit ahead of origin/main"
                " (or give --untestable)",
            )

    governor: dict[str, object]
    if govern is not None:
        reading = govern()
        if not reading.ok:
            line = f"REFUSED governor: {reading.text}"
            print(line)
            return Outcome(3, line)
        governor = {"source": "governor", "reading": reading.text}
    elif req.preflight:
        governor = {"source": "preflight", "reading": req.preflight}
    else:
        return _refused(
            "no-preflight",
            "no governor on this tree: give --preflight with the df, free and /usage lines",
        )
    if req.usage_checked:
        governor["usage_checked"] = req.usage_checked

    prompt = preamble(req.branch, req.repository) + "\n" + text
    if scan is not None:
        scanned = scan(prompt)
        if not scanned.clean:
            return _refused("prompt-leak", f"the leak scan found a hit in the prompt ({scanned.counts})")
        leak_scan = {"status": "clean", "line": scanned.counts}
    elif req.prompt_scanned:
        leak_scan = {"status": "interim", "line": req.prompt_scanned}
    else:
        return _refused(
            "leakscan-unavailable",
            "no leak scan on this tree: give --prompt-scanned with the count line",
        )

    record_dir = req.record_dir or root / FACTORY / "launches"
    started = now().astimezone(UTC)
    stamp = started.strftime("%Y%m%dT%H%M%SZ")
    record_path = record_dir / f"{req.ticket}-{stamp}.json"
    log = req.log or record_dir / f"{req.ticket}-{stamp}.debug.log"
    if record_path.exists() or (req.log is None and log.exists()):
        return _error(f"{record_path.name} already exists: a record is never overwritten")
    record_dir.mkdir(parents=True, exist_ok=True)
    log.parent.mkdir(parents=True, exist_ok=True)
    log.unlink(missing_ok=True)  # an earlier launch's lines must never judge this one

    version = cli_version()
    proving = _Proving(root / FACTORY, version)
    if not proving.proven() and not proving.acquire():
        return _error(f"CLI {version} is not yet proven and another launch is proving it; wait for it")
    verdict = Verdict(False, "the launch did not run", None, "no-session")
    try:
        argv = ["claude", "--debug-file", str(log), "--model", req.model, "--effort", req.effort]
        claude([*argv, "--on-branch", req.branch, "--cloud", prompt])
        try:
            judged = log.read_text(errors="replace")
        except OSError:
            judged = ""
        verdict = judge(judged, repository=req.repository, branch=req.branch)
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

    record = {
        "ticket": req.ticket,
        "branch": req.branch,
        "where": "cloud",
        "role": req.role,
        "effort": req.effort,
        "model": req.model,
        "budget_minutes": req.budget_minutes,
        "session_id": session,
        "cli_version": version,
        "started_at": started.isoformat().replace("+00:00", "Z"),
        "governor": governor,
        "leak_scan": leak_scan,
        "judge": {"ok": verdict.ok, "code": verdict.code, "reason": verdict.reason},
        "stop_sent": stop_sent,
        "untestable": req.untestable,
        "review": req.review.as_record() if req.review else None,
    }
    record_path.write_text(json.dumps(record, indent=2) + "\n")
    (record_dir / f"{req.ticket}-{stamp}.agents.json").write_text(snapshot())
    print(f"record: {record_path}")
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


def _stamp_elapsed(root: Path, ticket: str | None) -> str | None:
    """f3's `stamp elapsed --ticket T`, when this tree has it and a ticket is given."""
    if ticket is None or not (root / "scripts" / "factory" / "stamp.py").is_file():
        return None
    done = subprocess.run(
        [sys.executable, "-m", "scripts.factory.stamp", "elapsed", "--ticket", ticket],
        cwd=root,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        check=False,
    )
    found = re.search(r"\b(\d+/\d+)\b", done.stdout) if done.returncode == 0 else None
    return found.group(1) if found else None


def main_say(argv: list[str]) -> int:
    p = Parser(prog="scripts.factory.launch say")
    p.add_argument("session_id", type=_shaped(SESSION, "session id"))
    p.add_argument("--file", required=True, type=Path)
    p.add_argument("--ticket", type=_shaped(TICKET, "ticket id"))
    p.add_argument("--elapsed")
    a = p.parse_args(argv)
    root = Path.cwd()
    elapsed = a.elapsed if a.elapsed is not None else _stamp_elapsed(root, a.ticket)
    if elapsed is None or not ELAPSED.match(elapsed):
        p.error("no elapsed time: give --elapsed N/M (f3's stamp gives it once merged)")
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
