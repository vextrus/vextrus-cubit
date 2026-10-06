"""The watcher: one process that reads the factory's world every minute and writes it down.

    python -m scripts.factory.watch [run] [--once] [--interval 60]
    python -m scripts.factory.watch ensure
    python3 scripts/factory/watch.py              (the detached form: `run`, no PYTHONPATH needed)

Run it from the main checkout: git runs in the current directory's repository.

Each pass (every `--interval` seconds; `--once` makes one pass and exits):
- the ticket branches named by the launch records (`$VEXTRUS_FACTORY_DIR/launches/<ticket>-<utc>.json`,
  launch-cli.md 5; the newest record per ticket, and only those started since `session.json`'s start when
  a session is running) are read with one `git ls-remote --heads origin`; a local builder's head is its
  `refs/heads/<branch>` in this checkout (its worktree shares the refs; it never pushes), origin's tip
  until that ref exists. A new head is a push (a heartbeat; on a local branch a commit): it is fetched,
  its tip's trailers are read exactly as trailers.md 1 defines them (never a reading of free text; a
  clean merge of main on the head last seen READY stays READY), and on a cloud branch `python -m
  tools.leakscan range origin/main..<head> --no-stamp` (or `VEXTRUS_LEAKSCAN_CMD`) scans its diff and
  messages; the scan's output is reduced to `file:line` and a count, its text is never kept. No scanner
  (before PR f2) is recorded as `absent` in `watch-state.json` and is not an alarm;
- `claude agents --json --all` (only when a local builder is recorded), the usage reading every 15
  minutes (a line in `usage.log`), `gh pr list` every 5 minutes, `jev models-check` once a day (when
  `scripts/factory/jev.py` or `VEXTRUS_JEV_CMD` exists), and every pass `rdlock.json`, `df`,
  `/proc/meminfo`, the review ledger (`ledger/`), the G1 walks (`../walks/<sha40>/verdict.json`,
  `g1.pid`) and `session.json`.

It writes one `status.json` (status.schema.json, atomically, through `status.py`) and appends one line
`<UTC> <KIND> <ticket|-> <detail>` per change to `events.log`. The kinds: PUSH, COMMIT (a local head
that is not origin's tip), READY, BLOCKED, CI-RED (an open PR's required `ci` check failed; events)
and the alarms, status.schema.json's codes: READY-WAITING, READY-NO-VERIFY, BUILDER-QUIET,
BUILDER-BLOCKED, LOCAL-IDLE, NEW-CLAUDE-BRANCH, LEAK-HIT, BUDGET-PASSED, FLOOR-CROSSED, REVIEW-READY,
JEV-MODEL-MOVED. Alarms are edge-triggered: a line when one is raised, none while it holds, and it
leaves `status.json` when its cause clears. Its memory is `watch-state.json`, so a READY head already
on origin at the first run fires, and a restart does not fire it again. Before PR f4's `verify` exists
every READY head raises READY-NO-VERIFY: that is the rule (trailers.md 1), not a fault.

One watcher at a time: a running loop holds an exclusive `flock` of `watch.lock` for its whole life; a
second loop prints `running <pid>` and exits 0. `ensure` starts a detached `python scripts/factory/
watch.py run` (its command line names watch.py, as f6's watch-start.mjs expects) unless the lock is held,
and prints `started <pid>` or `running <pid>`. The loop writes `watch.pid`; SIGTERM, SIGINT or SIGHUP
ends it and removes the file. This file and the modules it imports compile on Python 3.11 and later, so
the machine's own `python3` can run the script form.

Exit 0, or 1 when a `--once` pass failed.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from types import FrameType
from typing import Any

if not __package__:  # the script form, `python3 scripts/factory/watch.py`
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.factory import governor, stamp, status
from scripts.factory.trailers import Trailers
from scripts.factory.trailers import read as read_trailers

QUIET_MINUTES = 30
READY_WAIT_MINUTES = 10
IDLE_MINUTES = 10
USAGE_EVERY = timedelta(minutes=15)
PRS_EVERY = timedelta(minutes=5)
JEV_EVERY = timedelta(hours=24)
ENSURE_WAIT_STEPS = 600
ENSURE_WAIT_SECONDS = 0.05
GIT_TIMEOUT = 120
SCAN_TIMEOUT = 600
SHA40 = re.compile(r"^[0-9a-f]{40}$")
REVIEW_BRANCH = re.compile(r"^review/(\d+)-[0-9a-f]{8}$")
LOCK_KINDS = {"posting": "post", "post": "post", "scored": "scored", "no-post": "no-post"}
BUILDER_ROW_STATES = {"working", "blocked", "done", "failed", "stopped"}
CLOSED_PR = {"MERGED", "CLOSED"}


# --- trailers (trailers.md 1: scripts/factory/trailers.py, the reading the guard and stop gate share)
MERGE_DEPTH = 20
# The trailer reading's version: a state written by another version has every seen head re-read once.
PARSER = 3


def parse_trailers(message: str, tree: str) -> Trailers:
    """The tip commit's factory trailers (trailers.md 1), its reason made one public line."""
    read = read_trailers(message, tree)
    if read.reason is None:
        return read
    return Trailers(read.outcome, public(read.reason, 200), read.why, read.gated)


def public(text: str, limit: int) -> str:
    """One printable line, at most `limit` characters."""
    line = " ".join("".join(ch if ch.isprintable() else " " for ch in text).split())
    return line[:limit]


# --- git, run in the main checkout (the cwd)
def git(*args: str) -> subprocess.CompletedProcess[str] | None:
    try:
        return subprocess.run(
            ["git", *args],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=GIT_TIMEOUT,
            check=False,
        )
    except status.RUN_ERRORS:
        return None


def git_out(*args: str) -> str | None:
    done = git(*args)
    return done.stdout if done is not None and done.returncode == 0 else None


def remote_heads() -> dict[str, str] | None:
    """origin's branches and tips, or None when origin cannot be read this pass."""
    out = git_out("ls-remote", "--heads", "origin")
    if out is None:
        return None
    heads: dict[str, str] = {}
    for line in out.splitlines():
        sha, _, ref = line.partition("\t")
        if ref.startswith("refs/heads/") and SHA40.match(sha):
            heads[ref.removeprefix("refs/heads/")] = sha
    return heads


def fetch(branch: str, sha: str) -> bool:
    if git_out("cat-file", "-e", f"{sha}^{{commit}}") is not None:
        return True
    ref = f"+refs/heads/{branch}:refs/remotes/origin/{branch}"
    return git_out("fetch", "-q", "--no-tags", "origin", ref) is not None


def read_head(branch: str, sha: str) -> tuple[str, str] | None:
    """(message, tree) of a fetched head, or None when it cannot be fetched this pass."""
    if not fetch(branch, sha):
        return None
    message = git_out("log", "-1", "--format=%B", sha)
    tree = git_out("rev-parse", f"{sha}^{{tree}}")
    if message is None or tree is None:
        return None
    return message, tree.strip()


def local_head(branch: str) -> str | None:
    """`refs/heads/<branch>` in the main checkout: a local builder's worktree shares these refs, so this
    is its own head, pushed or not. None when there is no such ref or git refuses the name."""
    out = git_out("rev-parse", "--verify", "-q", f"refs/heads/{branch}")
    sha = out.strip() if out is not None else ""
    return sha if SHA40.match(sha) else None


def clean_merges_of_main(sha: str, ready_head: str, main_sha: str | None) -> bool:
    """Whether `sha` is `ready_head` followed only by clean merges of main: each a two-parent merge whose
    first parent is the one before, whose second is on origin/main, and whose tree is the one
    `git merge-tree` makes from the two with no conflict (merge_ready's rule: a resolved conflict, a
    `-s ours` or an edit inside the merge is new work)."""
    main = main_sha or "refs/remotes/origin/main"
    if main_sha is not None:
        fetch("main", main_sha)
    for _ in range(MERGE_DEPTH):
        parents = (git_out("rev-list", "--parents", "-n", "1", sha) or "").split()[1:]
        if len(parents) != 2:
            return False
        on_main = git("merge-base", "--is-ancestor", parents[1], main)
        clean = git_out("merge-tree", "--write-tree", "--no-messages", *parents)
        tree = git_out("rev-parse", f"{sha}^{{tree}}")
        if on_main is None or on_main.returncode != 0 or clean is None or tree is None:
            return False
        if clean.split()[:1] != tree.split():
            return False
        if parents[0] == ready_head:
            return True
        sha = parents[0]
    return False


# --- the leak scan (leakscan-cli.md 6: the watcher only alarms, never stamps)
def leakscan_command() -> list[str] | None:
    chosen = os.environ.get("VEXTRUS_LEAKSCAN_CMD")
    if chosen:
        argv = shlex.split(chosen)
        return argv if argv and (shutil.which(argv[0]) or Path(argv[0]).is_file()) else None
    if (Path.cwd() / "tools" / "leakscan").is_dir():
        return [sys.executable, "-m", "tools.leakscan"]
    return None


def leak_scan(head: str, main_sha: str | None) -> dict[str, Any]:
    """{"result": absent|clean|hit|cannot-scan, "where": ..., "n": ...}: places and counts only."""
    argv = leakscan_command()
    if argv is None:
        return {"result": "absent"}
    if main_sha is not None:
        fetch("main", main_sha)
    try:
        done = subprocess.run(
            [*argv, "range", f"origin/main..{head}", "--no-stamp"],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=SCAN_TIMEOUT,
            check=False,
        )
    except status.RUN_ERRORS:
        return {"result": "cannot-scan", "where": "cannot-scan", "n": 0}
    if done.returncode == 0:
        return {"result": "clean"}
    hits: list[tuple[str, int]] = []
    word = "error"
    for line in done.stdout.splitlines():
        match = re.fullmatch(r"HIT ([\w.:/@+-]{1,160}) (\d{1,6})", line.strip())
        if match:
            hits.append((match.group(1), int(match.group(2))))
        cannot = re.match(r"leakscan: cannot-scan ([a-z-]{1,40})\b", line.strip())
        if cannot:
            word = cannot.group(1)
    if done.returncode == 1 and hits:
        return {"result": "hit", "where": hits[0][0], "n": sum(n for _, n in hits), "places": len(hits)}
    return {"result": "cannot-scan", "where": f"cannot-scan:{word}", "n": 0}


# --- readings with a cadence
def gh_prs() -> list[dict[str, Any]] | None:
    seam = os.environ.get("VEXTRUS_PRS_FILE")
    if seam:
        try:
            text = Path(seam).read_text()
        except OSError:
            return None
    else:
        argv = ["gh", "pr", "list", "--state", "all", "--limit", "200"]
        argv += ["--json", "number,headRefName,headRefOid,state,statusCheckRollup"]
        try:
            done = subprocess.run(
                argv, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=120, check=False
            )
        except status.RUN_ERRORS:
            return None
        if done.returncode != 0:
            return None
        text = done.stdout
    try:
        loaded = json.loads(text)
    except ValueError:
        return None
    if not isinstance(loaded, list):
        return None
    return [row for row in loaded if isinstance(row, dict) and isinstance(row.get("number"), int)]


def jev_command() -> list[str] | None:
    chosen = os.environ.get("VEXTRUS_JEV_CMD")
    if chosen:
        argv = shlex.split(chosen)
        return argv if argv and (shutil.which(argv[0]) or Path(argv[0]).is_file()) else None
    if (status.REPO / "scripts" / "factory" / "jev.py").is_file():
        return [sys.executable, "-m", "scripts.factory.jev"]
    return None


def models_check() -> tuple[str, str | None]:
    """(`absent` | `ok` | `moved` | `unavailable`, the moved line `<pinned> -> <seen>` when moved)."""
    argv = jev_command()
    if argv is None:
        return "absent", None
    try:
        done = subprocess.run(
            [*argv, "models-check"],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
    except status.RUN_ERRORS:
        return "unavailable", None
    first = done.stdout.strip().splitlines()[0] if done.stdout.strip() else ""
    if done.returncode == 1 and first.startswith("JEV-MODEL-MOVED"):
        moved = re.sub(r"[^A-Za-z0-9._:>\- ]", "", first.removeprefix("JEV-MODEL-MOVED"))
        return "moved", public(moved, 200) or "moved"
    return ("ok", None) if done.returncode == 0 else ("unavailable", None)


# --- the world's records
def load_launches(
    folder: Path, since: datetime | None
) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    """The builders' newest launch record per ticket, and the cloud reviews' branches with the head each
    was launched on. A record whose `review` is not null (review_cloud.py's reviewer or refuter) is not a
    builder: it is never tracked as one, only used to tell its verdict commit from the pushed branch."""
    newest: dict[str, dict[str, Any]] = {}
    reviews: dict[str, str] = {}
    for path in sorted((folder / "launches").glob("*.json")):
        if path.name.endswith(".agents.json"):
            continue
        try:
            record = json.loads(path.read_text())
            started = status.parse_utc(record["started_at"])
            ticket, branch = str(record["ticket"]), str(record["branch"])
            where = record["where"]
            review = record.get("review")
        except status.RECORD_ERRORS:
            print(f"watch: unreadable launch record {path.name}", file=sys.stderr)
            continue
        if review is not None:
            head = review.get("head_sha") if isinstance(review, dict) else None
            if isinstance(head, str) and SHA40.match(head):
                for name in {branch, str(review.get("branch") or branch)}:
                    reviews[name] = head
            continue
        if where not in ("cloud", "local") or not ticket or not branch:
            print(f"watch: unreadable launch record {path.name}", file=sys.stderr)
            continue
        # A launch refused before its session started has nothing to follow, and one whose STOP was
        # sent has stopped. A launch the judge refused after its session started keeps running when no
        # STOP was sent (launch-cli.md), so it is followed like any other (#344, #343).
        judge = record.get("judge")
        refused = isinstance(judge, dict) and judge.get("ok") is False
        if (refused and not record.get("session_id")) or record.get("stop_sent") is True:
            continue
        if since is not None and started < since:
            continue
        record["_started"] = started
        if ticket not in newest or started >= newest[ticket]["_started"]:
            newest[ticket] = record
    # An acceptance writer is followed until a builder starts on its branch; from then on the builder's
    # record alone follows the branch (one item and one PUSH per head, not two).
    builders: dict[str, datetime] = {}
    for record in newest.values():
        if is_builder(record):
            builders[record["branch"]] = max(
                record["_started"], builders.get(record["branch"], record["_started"])
            )
    followed = {
        ticket: record
        for ticket, record in newest.items()
        if is_builder(record)
        or record["branch"] not in builders
        or builders[record["branch"]] < record["_started"]
    }
    return followed, reviews


def is_builder(record: dict[str, Any]) -> bool:
    """A builder's record; an older record without a role is one."""
    return str(record.get("role") or "builder") == "builder"


def read_session() -> dict[str, Any] | None:
    try:
        return stamp.load_session()
    except stamp.Refused:
        return None


def clock(session: dict[str, Any] | None, at: datetime) -> dict[str, Any]:
    if session is None:
        return {"session": None, "phase": None}
    started = status.parse_utc(session["started_utc"])
    block: dict[str, Any] = {
        "session": {
            "started_at": status.utc(started),
            "budget_minutes": int(session["budget_minutes"]),
            "elapsed_minutes": status.minutes_between(started, at),
        },
        "phase": None,
    }
    current = stamp.current_phase(session)
    if current is not None:
        since = status.parse_utc(current["start_utc"])
        block["phase"] = {
            "name": public(str(current["name"]), 40),
            "started_at": status.utc(since),
            "budget_minutes": int(current["minutes"]),
            "elapsed_minutes": status.minutes_between(since, at),
        }
    return block


def lock_view(folder: Path, at: datetime) -> dict[str, Any]:
    """rdlock.json as the schema's `lock` (rdlock.py's kinds: posting is `post`)."""
    try:
        loaded = json.loads((folder / "rdlock.json").read_text())
    except status.READ_ERRORS:
        return {"holder": None, "waiters": []}

    def entry(raw: Any) -> dict[str, Any] | None:
        if not isinstance(raw, dict) or raw.get("kind") not in LOCK_KINDS:
            return None
        try:
            since = status.parse_utc(raw["since"])
        except status.FIELD_ERRORS:
            return None
        head = raw.get("head")
        ticket = raw.get("ticket")
        return {
            "kind": LOCK_KINDS[raw["kind"]],
            "ticket": public(ticket, 80) if isinstance(ticket, str) else None,
            "head": head if isinstance(head, str) and SHA40.match(head) else None,
            "since": status.utc(since),
        }

    holder = entry(loaded.get("holder")) if isinstance(loaded, dict) else None
    if holder is not None:
        holder["elapsed_minutes"] = status.minutes_between(status.parse_utc(holder["since"]), at)
    raw_waiters = loaded.get("waiters", []) if isinstance(loaded, dict) else []
    waiters = [w for w in (entry(raw) for raw in raw_waiters) if w is not None]
    return {"holder": holder, "waiters": waiters}


def reviews_view(folder: Path, prs: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    by_pr: dict[int, list[dict[str, Any]]] = {}
    for path in sorted((folder / "ledger").glob("*.json")):
        try:
            record = json.loads(path.read_text())
            pr, round_ = int(record["pr"]), int(record["round"])
            head, verdict = str(record["head"]), str(record["verdict"])
        except status.RECORD_ERRORS:
            continue
        if (
            pr < 1
            or not 1 <= round_ <= 3
            or not SHA40.match(head)
            or verdict not in ("PASS", "FIX", "BLOCK")
        ):
            continue
        record_at = str(record.get("recorded_at", ""))
        by_pr.setdefault(pr, []).append(
            {"round": round_, "head": head, "verdict": verdict, "at": record_at}
        )
    known = {row["number"]: row for row in prs or []}
    found = []
    for pr, records in sorted(by_pr.items()):
        open_pr = known.get(pr)
        if open_pr is not None and open_pr.get("state") in CLOSED_PR:
            continue
        newest = max(records, key=lambda r: (r["round"], r["at"]))
        head = str(open_pr.get("headRefOid")) if open_pr is not None else newest["head"]
        if any(r["verdict"] == "PASS" and r["head"] == head for r in records):
            continue
        found.append({"pr": pr, "round": newest["round"], "head": newest["head"]})
    return found


def g1_view(folder: Path, main_sha: str | None) -> dict[str, Any] | None:
    running = status.live_pid(folder / "g1.pid")
    walks: list[dict[str, Any]] = []
    for path in (folder.parent / "walks").glob("*/verdict.json"):
        try:
            verdict = json.loads(path.read_text())
            result, sha = verdict["result"], verdict["sha"]
            finished = status.parse_utc(verdict["finished_at"])
        except status.RECORD_ERRORS:
            continue
        if result in ("PASS", "FAIL") and SHA40.match(str(sha)) and verdict.get("ref", "main") == "main":
            walks.append({"state": result, "sha": sha, "at": status.utc(finished), "_at": finished})
    newest = max(walks, key=lambda w: w["_at"], default=None)
    if running is not None:
        sha = main_sha or (newest["sha"] if newest else None)
        if sha is not None:
            since = datetime.fromtimestamp((folder / "g1.pid").stat().st_mtime).astimezone()
            return {"state": "RUNNING", "sha": sha, "at": status.utc(since)}
    if newest is None:
        return None
    return {key: newest[key] for key in ("state", "sha", "at")}


# --- one pass
class Pass:
    def __init__(self, folder: Path, at: datetime, state: dict[str, Any]) -> None:
        self.folder = folder
        self.at = at
        self.state = state
        self.events: list[tuple[str, str | None, str]] = []
        self.alarms: dict[str, tuple[str, str | None, str]] = {}

    def event(self, kind: str, subject: str | None, detail: str) -> None:
        self.events.append((kind, subject, detail))

    def alarm(self, key: str, code: str, subject: str | None, detail: str) -> None:
        self.alarms[f"{code}|{key}"] = (code, subject, detail)

    def due(self, key: str, every: timedelta) -> bool:
        last = self.state.get(key)
        return last is None or self.at - status.parse_utc(last) >= every


def run_pass(folder: Path, at: datetime, started_at: datetime) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    state = load_state(folder)
    step = Pass(folder, at, state)
    session = read_session()
    since = status.parse_utc(session["started_utc"]) if session else None
    records, reviews = load_launches(folder, since)
    refs = remote_heads()
    main_sha = refs.get("main") if refs is not None else None

    if step.due("prs_read_at", PRS_EVERY):
        state["prs_read_at"] = status.utc(at)
        read = gh_prs()
        if read is not None:
            state["prs"] = read
    prs: list[dict[str, Any]] | None = state.get("prs")

    if step.due("usage_read_at", USAGE_EVERY):
        state["usage_read_at"] = status.utc(at)
        reading = governor.read_usage().usage
        state["usage"] = (
            None
            if reading is None
            else {
                "session_percent": reading.session,
                "week_percent": reading.week,
                "read_at": status.utc(at),
            }
        )
        with (folder / "usage.log").open("a") as log:
            line = (
                "unreadable" if reading is None else f"session={reading.session:g} week={reading.week:g}"
            )
            log.write(f"{status.utc(at)} {line}\n")

    rows = governor.read_agents() if any(r["where"] == "local" for r in records.values()) else None
    items = [
        track(step, ticket, record, refs, main_sha, prs, rows)
        for ticket, record in sorted(records.items())
    ]
    state["parser"] = PARSER  # every seen head has now been read by this version

    if refs is not None:
        watch_branches(step, refs, reviews)
    if session is not None:
        spent = status.minutes_between(status.parse_utc(session["started_utc"]), at)
        if spent > int(session["budget_minutes"]):
            budget = int(session["budget_minutes"])
            step.alarm("session", "BUDGET-PASSED", None, f"session {spent}/{budget} min")
    resources = watch_floors(step)
    watch_jev(step)

    raise_alarms(step)
    save_state(folder, state)
    payload = status.build(
        written_at=at,
        watcher={"pid": os.getpid(), "started_at": status.utc(started_at)},
        clock=clock(session, at),
        resources=resources,
        lock=lock_view(folder, at),
        items=items,
        reviews=reviews_view(folder, prs),
        g1_main=g1_view(folder, main_sha),
        usage=state.get("usage"),
        alarms=[
            {"code": a["code"], "subject": a["subject"], "detail": a["detail"], "since": a["since"]}
            for a in state["alarms"].values()
        ],
    )
    status.write_atomic(folder / "status.json", payload)


def track(
    step: Pass,
    ticket: str,
    record: dict[str, Any],
    refs: dict[str, str] | None,
    main_sha: str | None,
    prs: list[dict[str, Any]] | None,
    rows: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Follow one ticket's branch; raise its alarms; return its `builders.items` entry."""
    at, branch, where = step.at, str(record["branch"]), str(record["where"])
    tickets = step.state.setdefault("tickets", {})
    seen = tickets.get(ticket)
    if seen is None or seen.get("branch") != branch:
        seen = tickets[ticket] = {"branch": branch, "head": None, "last_push_at": None, "outcome": None}
    tip = refs.get(branch) if refs is not None else None  # origin's
    # A local builder's own head is its ref in this checkout; origin's tip until it has one.
    mine = local_head(branch) if where == "local" else None
    head = mine or (tip if refs is not None else seen["head"])
    if (refs is not None or mine is not None) and head != seen["head"]:
        info = read_head(branch, head) if head is not None else ("", "")
        if info is not None:
            message, tree = info
            trailers = parse_trailers(message, tree) if head is not None else Trailers(None)
            # A clean merge of main on the head last seen READY (the lander's) keeps that READY, its
            # time and its event; anything else in the merge is new work.
            ready_head = seen.get("ready_head")
            inherited = (
                head is not None
                and trailers.outcome is None
                and isinstance(ready_head, str)
                and clean_merges_of_main(head, ready_head, main_sha)
            )
            if inherited:
                trailers = Trailers("READY")
            seen.update(
                head=head,
                last_push_at=status.utc(at) if head is not None else seen["last_push_at"],
                outcome=trailers.outcome,
                reason=trailers.reason,
                why=trailers.why,
                outcome_at=seen.get("outcome_at") if inherited else status.utc(at),
                ready_head=head if trailers.outcome == "READY" else None,
                leak=None,
                acceptance=head is not None and message.startswith("acceptance:"),
                idle_since=None,
            )
            if head is not None:
                if mine is None:
                    step.event("PUSH", ticket, head[:8])
                elif head != tip:  # equal to origin's tip: the launch tip or a head already pushed
                    step.event("COMMIT", ticket, head[:8])
                    seen["committed"] = True
                if trailers.outcome == "READY" and not inherited:
                    step.event("READY", ticket, head[:8])
                elif trailers.outcome == "BLOCKED":
                    step.event("BLOCKED", ticket, f"{head[:8]} {trailers.reason}")
                if where == "cloud":
                    seen["leak"] = leak_scan(head, main_sha)
                    step.state["leakscan"] = seen["leak"]["result"]
    elif seen["head"] is not None and step.state.get("parser") != PARSER:
        reread(step, ticket, seen, main_sha)
    head = seen["head"]
    outcome = seen.get("outcome")
    pr = pr_for(branch, prs)
    closed = pr is not None and pr.get("state") in CLOSED_PR
    watch_ci(step, ticket, pr)
    last_push = seen.get("last_push_at")
    quiet_since = status.parse_utc(last_push) if last_push else record["_started"]
    quiet = status.minutes_between(quiet_since, at)

    row = agents_row(rows, record.get("name"))
    if closed:
        state = "done"
    elif not is_builder(record) and seen.get("acceptance"):
        state = (
            "done"  # a writer's work ends at its `acceptance:` commit; it has no Factory-State trailer
        )
    elif outcome == "READY":
        state = "ready"
    elif outcome == "BLOCKED":
        state = "blocked"
    elif where == "local":
        row_state = (
            row.get("state") if row is not None else ("stopped" if rows is not None else "working")
        )
        state = row_state if row_state in BUILDER_ROW_STATES else "working"
    else:
        state = "quiet" if quiet >= QUIET_MINUTES else "working"

    if head is not None and outcome == "READY-NO-VERIFY":
        step.alarm(f"{ticket}|{head}", "READY-NO-VERIFY", ticket, f"{head[:8]} {seen.get('why')}")
    if state == "ready" and head is not None:
        waited = status.minutes_between(status.parse_utc(seen["outcome_at"]), at)
        if waited >= READY_WAIT_MINUTES:
            step.alarm(
                f"{ticket}|{head}", "READY-WAITING", ticket, f"{head[:8]} READY {waited} min, not merged"
            )
    if where == "cloud" and state == "quiet":
        step.alarm(f"{ticket}|{last_push}", "BUILDER-QUIET", ticket, f"no push for {quiet} min")
    if where == "local" and row is not None and row.get("state") == "blocked" and not closed:
        step.alarm(ticket, "BUILDER-BLOCKED", ticket, "local builder blocked (claude agents)")
    if where == "local" and is_builder(record) and not closed:
        local_idle(step, ticket, seen, row)
    else:
        seen["idle_since"] = None
    budget = record.get("budget_minutes")
    if isinstance(budget, int) and state not in ("ready", "blocked", "done"):
        spent = status.minutes_between(record["_started"], at)
        if spent > budget:
            step.alarm(ticket, "BUDGET-PASSED", ticket, f"{spent}/{budget} min")
    leak = seen.get("leak") or {}
    if head is not None and leak.get("result") in ("hit", "cannot-scan"):
        detail = f"{leak['where']} {leak['n']}"
        if leak.get("places", 1) > 1:
            detail += f" ({leak['places']} places)"
        step.alarm(f"{ticket}|{head}", "LEAK-HIT", ticket, detail)

    return {
        "ticket": public(ticket, 80),
        "where": where,
        "state": state,
        "branch": public(branch, 200),
        "head": head,
        "last_push_at": last_push,
        "quiet_minutes": quiet if where == "cloud" else None,
        "pr": pr["number"] if pr is not None and pr["number"] >= 1 else None,
    }


ENDED_ROW_STATES = {"done", "stopped", "failed"}


def is_idle(row: dict[str, Any] | None) -> bool:
    """A `claude agents` row of a session waiting on nobody: a live one whose `status` is `idle` (its
    turn finished), or one whose session has exited (no pid, its state done, stopped or failed)."""
    if row is None:
        return False
    if row.get("status") == "idle":
        return True
    return row.get("pid") is None and row.get("state") in ENDED_ROW_STATES


def local_idle(step: Pass, ticket: str, seen: dict[str, Any], row: dict[str, Any] | None) -> None:
    """LOCAL-IDLE, for a local builder (never a writer, whose work ends at its `acceptance:` commit, nor
    one whose PR is closed): it has committed, its head is not READY or BLOCKED, and its `claude agents`
    row has read idle (`is_idle`) for IDLE_MINUTES since the head was first seen so (a builder that
    stopped, or whose session ended, without its trailer)."""
    head = seen["head"]
    if not is_idle(row) or head is None or not seen.get("committed"):
        seen["idle_since"] = None
        return
    if seen.get("outcome") in ("READY", "BLOCKED"):
        seen["idle_since"] = None
        return
    since = seen.get("idle_since") or status.utc(step.at)
    seen["idle_since"] = since
    idle_for = status.minutes_between(status.parse_utc(since), step.at)
    if idle_for >= IDLE_MINUTES:
        detail = f"{head[:8]} idle {idle_for} min after a commit, no READY or BLOCKED (claude agents)"
        if row is not None and row.get("pid") is None:
            detail = f"{head[:8]} session ended {idle_for} min ago after a commit, no READY or BLOCKED"
        step.alarm(f"{ticket}|{head}", "LOCAL-IDLE", ticket, detail)


def reread(step: Pass, ticket: str, seen: dict[str, Any], main_sha: str | None) -> None:
    """Read a seen head's outcome again: the state was written by another version of the trailer
    reading. A changed outcome is an event and starts its clock; an unchanged one keeps both. A READY
    inherited onto clean merges of main (track's rule) stays READY."""
    head = seen["head"]
    info = read_head(seen["branch"], head)
    if info is None:
        return
    trailers = parse_trailers(*info)
    if trailers.outcome is None and seen.get("outcome") == "READY" and inherits_ready(head, main_sha):
        return
    if trailers.outcome == "READY":  # every READY records its head, unchanged or not
        seen["ready_head"] = head
    if trailers.outcome == seen.get("outcome"):
        return
    seen.update(
        outcome=trailers.outcome,
        reason=trailers.reason,
        why=trailers.why,
        outcome_at=status.utc(step.at),
        ready_head=head if trailers.outcome == "READY" else None,
    )
    if trailers.outcome == "READY":
        step.event("READY", ticket, head[:8])
    elif trailers.outcome == "BLOCKED":
        step.event("BLOCKED", ticket, f"{head[:8]} {trailers.reason}")


def inherits_ready(head: str, main_sha: str | None) -> bool:
    """Whether `head` is clean merges of main on a commit that reads READY: track() records such a merge
    as its own READY head, so the READY commit under it is found again by walking first parents."""
    sha = head
    for _ in range(MERGE_DEPTH):
        parents = (git_out("rev-list", "--parents", "-n", "1", sha) or "").split()[1:]
        if len(parents) != 2:
            return False
        sha = parents[0]
        message = git_out("log", "-1", "--format=%B", sha)
        tree = git_out("rev-parse", f"{sha}^{{tree}}")
        if message is None or tree is None:
            return False
        if parse_trailers(message, tree.strip()).outcome == "READY":
            return clean_merges_of_main(head, sha, main_sha)
    return False


def pr_for(branch: str, prs: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    mine = [row for row in prs or [] if row.get("headRefName") == branch]
    return max(mine, key=lambda row: (row.get("state") == "OPEN", row["number"]), default=None)


CI_RED_CONCLUSIONS = {"FAILURE", "TIMED_OUT", "STARTUP_FAILURE"}


def required_ci_red(pr: dict[str, Any]) -> bool:
    """True when the PR's required `ci` check (the aggregate job of the `ci` workflow, or a status
    context named `ci`) has failed on its current head. Pending, skipped and missing are not red."""
    for entry in pr.get("statusCheckRollup") or []:
        if not isinstance(entry, dict):
            continue
        if entry.get("__typename") == "StatusContext":
            if entry.get("context") == "ci" and entry.get("state") in ("FAILURE", "ERROR"):
                return True
        elif (
            entry.get("name") == "ci"
            and entry.get("workflowName") in (None, "ci")
            and entry.get("conclusion") in CI_RED_CONCLUSIONS
        ):
            return True
    return False


def watch_ci(step: Pass, ticket: str, pr: dict[str, Any] | None) -> None:
    """One CI-RED event per (ticket, head) when an open tracked PR's required `ci` check fails; a
    restart or a re-read does not repeat it, and a new head that fails is a new event."""
    if pr is None or pr.get("state") != "OPEN" or not required_ci_red(pr):
        return
    head = pr.get("headRefOid")
    if not isinstance(head, str) or not head:
        return
    red: dict[str, str] = step.state.setdefault("ci_red", {})
    if red.get(ticket) != head:
        red[ticket] = head
        step.event("CI-RED", ticket, f"#{pr['number']} {head[:8]} required check ci failed")


def agents_row(rows: list[dict[str, Any]] | None, name: Any) -> dict[str, Any] | None:
    if rows is None or not isinstance(name, str):
        return None
    mine = [row for row in rows if row.get("name") == name]
    return max(
        mine, key=lambda row: (row.get("pid") is not None, str(row.get("startedAt"))), default=None
    )


def watch_branches(step: Pass, refs: dict[str, str], reviews: dict[str, str]) -> None:
    claude = sorted(name for name in refs if name.startswith("claude/"))
    baseline = step.state.get("claude_baseline")
    if baseline is None:
        step.state["claude_baseline"] = claude
    else:
        for name in claude:
            if name not in baseline:
                step.alarm(name, "NEW-CLAUDE-BRANCH", name[:80], "a new claude/* branch on origin")
    for name, tip in refs.items():
        match = REVIEW_BRANCH.match(name)
        if not match:
            continue
        launched_on = reviews.get(name)
        if launched_on is None:  # no launch record: any review branch is a verdict to read
            step.alarm(name, "REVIEW-READY", f"#{match.group(1)}", f"review verdict branch {name}")
        elif tip != launched_on:  # the reviewer's verdict commit sits on the head it was given
            step.alarm(
                f"{name}|{tip}", "REVIEW-READY", f"#{match.group(1)}", f"review verdict {tip[:8]}"
            )


def watch_floors(step: Pass) -> dict[str, Any]:
    memory = governor.read_memory()
    disk = governor.read_disk_gb()
    if memory is not None:
        if memory.available_gb < governor.MEM_FLOOR_GB:
            detail = f"{memory.available_gb:.1f} GB available, under {governor.MEM_FLOOR_GB} GB"
            step.alarm("mem", "FLOOR-CROSSED", "mem", detail)
        if memory.swap_used_gb > governor.SWAP_REFUSE_GB:
            detail = f"{memory.swap_used_gb:.1f} GB used, over {governor.SWAP_REFUSE_GB:.0f} GB"
            step.alarm("swap", "FLOOR-CROSSED", "swap", detail)
    if disk is not None and disk < governor.DISK_REFUSE_GB:
        step.alarm(
            "disk",
            "FLOOR-CROSSED",
            "disk",
            f"{disk:.1f} GB free, under {governor.DISK_REFUSE_GB:.0f} GB",
        )
    usage = step.state.get("usage")
    if usage and (
        usage["session_percent"] >= governor.SESSION_HOLD or usage["week_percent"] >= governor.WEEK_HOLD
    ):
        detail = f"session {usage['session_percent']:g}% week {usage['week_percent']:g}%: launches held"
        step.alarm("usage", "FLOOR-CROSSED", "usage", detail)
    return {
        "disk_free_gb": None if disk is None else round(disk, 1),
        "swap_used_gb": None if memory is None else round(memory.swap_used_gb, 1),
        "mem_available_gb": None if memory is None else round(memory.available_gb, 1),
    }


def watch_jev(step: Pass) -> None:
    if step.due("jev_checked_at", JEV_EVERY):
        outcome, moved = models_check()
        if outcome != "absent":  # every run counts: at most one call a day, whatever it said
            step.state["jev_checked_at"] = status.utc(step.at)
        if outcome in ("ok", "moved"):  # `unavailable` keeps the last answer (jev-cli.md: no alarm)
            step.state["jev_moved"] = moved
    moved_line = step.state.get("jev_moved")
    if isinstance(moved_line, str):
        step.alarm(moved_line, "JEV-MODEL-MOVED", None, moved_line)


def raise_alarms(step: Pass) -> None:
    held: dict[str, dict[str, Any]] = step.state.get("alarms", {})
    now_held: dict[str, dict[str, Any]] = {}
    for key, (code, subject, detail) in step.alarms.items():
        previous = held.get(key)
        if previous is None:
            step.event(code, subject, detail)
        now_held[key] = {
            "code": code,
            "subject": None if subject is None else public(subject, 80),
            "detail": public(detail, 200),
            "since": previous["since"] if previous else status.utc(step.at),
        }
    step.state["alarms"] = now_held
    if step.events:
        with (step.folder / "events.log").open("a") as log:
            for kind, subject, detail in step.events:
                who = "-" if not subject else public(subject, 80).replace(" ", "_")
                log.write(f"{status.utc(step.at)} {kind} {who} {public(detail, 200)}\n")


def load_state(folder: Path) -> dict[str, Any]:
    path = folder / "watch-state.json"
    try:
        loaded = json.loads(path.read_text())
    except FileNotFoundError:
        return {"schema": 1, "alarms": {}, "tickets": {}}
    except status.READ_ERRORS:
        print("watch: watch-state.json is unreadable; starting from an empty state", file=sys.stderr)
        return {"schema": 1, "alarms": {}, "tickets": {}}
    if not isinstance(loaded, dict):
        return {"schema": 1, "alarms": {}, "tickets": {}}
    loaded.setdefault("alarms", {})
    loaded.setdefault("tickets", {})
    return loaded


def save_state(folder: Path, state: dict[str, Any]) -> None:
    status.write_atomic(folder / "watch-state.json", state)


# --- the process
def is_watcher(pid: int) -> bool:
    try:
        args = Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0")
    except OSError:
        return False
    return status.pid_alive(pid) and any(
        arg == b"scripts.factory.watch" or arg.endswith(b"scripts/factory/watch.py") for arg in args
    )


def lock_held(folder: Path) -> bool:
    """Whether a running loop holds `watch.lock` (its flock is the one-watcher rule; the pidfile only
    names it)."""
    with (folder / "watch.lock").open("a") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
        fcntl.flock(handle, fcntl.LOCK_UN)
    return False


def wait_for_pidfile(pidfile: Path, child: subprocess.Popen[bytes] | None) -> int | None:
    """The pid `watch.pid` names once the lock holder has written it (bounded; no busy loop)."""
    for _ in range(ENSURE_WAIT_STEPS):
        pid = status.read_pidfile(pidfile)
        if child is not None and pid == child.pid:
            return pid
        if child is None and pid is not None and is_watcher(pid):
            return pid
        if child is not None and child.poll() is not None:
            return None
        time.sleep(ENSURE_WAIT_SECONDS)
    return None


def ensure() -> int:
    folder = status.factory_dir()
    folder.mkdir(parents=True, exist_ok=True)
    pidfile = folder / "watch.pid"
    if lock_held(folder):
        print(f"running {wait_for_pidfile(pidfile, None) or '?'}")
        return 0
    cwd = status.main_checkout() or Path.cwd()
    with (folder / "watch.out").open("ab") as out:
        # The script form: its command line names watch.py (f6's watch-start.mjs counts watchers by it).
        child = subprocess.Popen(
            [sys.executable, str(status.REPO / "scripts" / "factory" / "watch.py"), "run"],
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            stdout=out,
            stderr=out,
            start_new_session=True,
        )
    pid = wait_for_pidfile(pidfile, child)
    if pid is not None:
        print(f"started {pid}")
        return 0
    if lock_held(folder):  # another ensure's watcher won the lock; this child has exited
        print(f"running {wait_for_pidfile(pidfile, None) or '?'}")
        return 0
    print(f"watch: the watcher did not start (see {folder / 'watch.out'})", file=sys.stderr)
    return 1


def _stop(signum: int, frame: FrameType | None) -> None:
    raise SystemExit(0)


def run(once: bool, interval: float) -> int:
    folder = status.factory_dir()
    folder.mkdir(parents=True, exist_ok=True)
    started = status.now()
    pidfile = folder / "watch.pid"
    if once:
        try:
            run_pass(folder, status.now(), started)
        except Exception as error:
            print(f"watch: the pass failed: {type(error).__name__}: {error}", file=sys.stderr)
            return 1
        return 0
    lock = (folder / "watch.lock").open("a")  # held, unclosed, for the life of the process
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        named = status.read_pidfile(pidfile)
        print(
            f"running {named}"
            if named is not None and is_watcher(named)
            else "running (watch.pid stale)"
        )
        return 0
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGHUP, _stop)
    pidfile.write_text(f"{os.getpid()}\n")
    try:
        while True:
            try:
                run_pass(folder, status.now(), started)
            except Exception as error:
                print(f"watch: the pass failed: {type(error).__name__}: {error}", file=sys.stderr)
            time.sleep(interval)
    finally:
        if status.read_pidfile(pidfile) == os.getpid():
            pidfile.unlink(missing_ok=True)
        lock.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.watch", description=__doc__)
    parser.add_argument("command", nargs="?", choices=["run", "ensure"], default="run")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--interval", type=float, default=60.0)
    args = parser.parse_args(argv)
    if args.command == "ensure":
        return ensure()
    return run(args.once, args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
