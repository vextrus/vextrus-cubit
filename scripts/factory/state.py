"""The factory's open-work table, rebuilt from tools every time it is asked for.

    python -m scripts.factory.state [--resume-md <path>]

Run it from the main checkout: git runs in the current directory's repository. One row per open ticket
branch (every branch of origin and every local branch of this checkout, except `main` and `review/*`).
A branch with any launch record (any role) stays until its pull request is MERGED; a MERGED branch is
dropped only when its head is the merged head or an ancestor of it (new commits on top keep the row). A
head reads READY by the shared reader, or as clean merges of main on a READY head (the watcher's rule).
A writer that has committed its `acceptance:` commit and ended reads "acceptance committed: launch the
builder", never "resume"; a branch with neither a launch record nor a pull request is left out, counted
in a note, unless its head reads READY or it was committed in the last few days:

- its head (a local builder's own head when it is ahead of origin's tip, else origin's tip);
- its Factory-State, read from the head's commit message by `scripts/factory/trailers.py` (the reading
  every consumer shares);
- its pull request (`gh pr list --state all`; the CI rollup of `gh pr view --json statusCheckRollup` for
  an open one whose head the ledger passed);
- its last ledger record (`scripts.ledger`'s records under `<factory folder>/ledger`);
- its local builder's session (the launch records, `claude agents --json --all`);
- the next action: "READY, no PR", "ready to land" (a PASS on this head and green CI), "fix round n"
  (the FIX of round n is on this head), "unreviewed" (no verdict for this head), "resume <session id>"
  (a local builder whose session has ended on a head that is not READY), or what is being waited on.

A ledger record that cannot be read never reads ready to land (the rule of `scripts.ledger`: fail
closed). The real-drawing lock's holder is listed under the table. Nothing is read from a hand-kept file.

`--resume-md <path>` writes the same table as RESUME.md (replacing any file there) and prints it too.
Exit 0, or 1 when origin cannot be read.
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from scripts import ledger
from scripts.factory import governor, status, watch
from scripts.land import has_ci, pending, red
from scripts.merge_ready import merges_since

READY_NO_PR = "READY, no PR"
LIVE_NOTE = "building"
SHA40 = re.compile(r"[0-9a-f]{40}")
RECORD_NAME = re.compile(r"(\d+)-([0-9a-f]{40})\.json")
SKIPPED_BRANCHES = ("review/",)
GH_TIMEOUT = 120
PR_LIMIT = 5000
STALE_DAYS = 3


@dataclass
class Record:
    round: int
    head: str
    verdict: str


@dataclass
class Ledger:
    records: dict[int, list[Record]] = field(default_factory=dict)
    unreadable: set[int] = field(default_factory=set)  # PRs with a record that cannot be read


def read_ledger(folder: Path) -> Ledger:
    """The ledger's records by PR. A file named like a record that is not one, or whose content
    disagrees with its name, marks its PR unreadable (never "no verdict")."""
    found = Ledger()
    try:
        names = sorted(os.listdir(folder))
    except FileNotFoundError:
        return found
    except OSError:
        found.unreadable.add(0)  # the folder itself: every PR reads unreadable
        return found
    for name in names:
        match = RECORD_NAME.fullmatch(name)
        if match is None:
            continue
        pr, head = int(match.group(1)), match.group(2)
        try:
            raw = json.loads((folder / name).read_text())
            round_ = int(raw["round"])
            verdict = str(raw["verdict"])
            if (
                int(raw["pr"]) != pr
                or raw["head"] != head
                or verdict not in ledger.RANK
                or not 1 <= round_ <= ledger.MAX_ROUND
            ):
                raise ValueError(name)
        except OSError, ValueError, KeyError, TypeError:
            found.unreadable.add(pr)
            continue
        found.records.setdefault(pr, []).append(Record(round_, head, verdict))
    return found


def run_gh(*args: str) -> Any | None:
    try:
        done = subprocess.run(
            ["gh", *args],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=GH_TIMEOUT,
            check=False,
        )
    except status.RUN_ERRORS:
        return None
    if done.returncode != 0:
        return None
    try:
        return json.loads(done.stdout)
    except ValueError:
        return None


def read_prs() -> list[dict[str, Any]] | None:
    """Every pull request, any state (`gh pr list --state all`), or None when gh cannot be read."""
    listed = run_gh(
        "pr",
        "list",
        *("--state", "all", "--limit", str(PR_LIMIT)),
        *("--json", "number,title,headRefName,headRefOid,state"),
    )
    if not isinstance(listed, list):
        return None
    return [r for r in listed if isinstance(r, dict) and isinstance(r.get("number"), int)]


def pr_for(branch: str, prs: list[dict[str, Any]]) -> dict[str, Any] | None:
    mine = [r for r in prs if r.get("headRefName") == branch]
    return max(mine, key=lambda r: (r.get("state") == "OPEN", r["number"]), default=None)


def ci_green(number: int, head: str) -> bool:
    """Whether the PR's rollup is settled and fine on `head` (a rollup for another head, one without the
    `ci` check run, a pending one, or an unreadable one is not green)."""
    view = run_gh("pr", "view", str(number), "--json", "headRefOid,statusCheckRollup")
    if not isinstance(view, dict) or view.get("headRefOid") != head:
        return False
    entries = [e for e in view.get("statusCheckRollup") or [] if isinstance(e, dict)]
    return has_ci(entries) and not any(pending(e) or red(e) for e in entries)


def branch_heads(origin: dict[str, str]) -> dict[str, tuple[str, str | None]]:
    """branch -> (head, local head or None): a local builder's ref in this checkout when it is ahead of
    origin's tip (its worktree shares these refs and it never pushes), else origin's tip."""
    names = set(origin)
    out = watch.git_out("for-each-ref", "--format=%(refname:strip=2)", "refs/heads/") or ""
    names.update(line for line in out.splitlines() if line)
    heads: dict[str, tuple[str, str | None]] = {}
    for name in sorted(names):
        if name == "main" or name.startswith(SKIPPED_BRANCHES):
            continue
        tip, mine = origin.get(name), watch.local_head(name)
        head = tip or mine
        if tip and mine and mine != tip and ahead(tip, mine):
            head = mine
        if head:
            heads[name] = (head, mine)
    return heads


def ahead(old: str, new: str) -> bool:
    done = watch.git("merge-base", "--is-ancestor", old, new)
    return done is not None and done.returncode == 0


def launches() -> tuple[dict[str, dict[str, Any]], list[str]]:
    """The newest launch record per branch (any role), and a note for each record that cannot be read."""
    captured = io.StringIO()
    with contextlib.redirect_stderr(captured):
        records, _ = watch.load_launches(status.factory_dir(), None)
    notes = [
        line.removeprefix("watch: ")
        for line in captured.getvalue().splitlines()
        if line.startswith("watch: unreadable launch record")
    ]
    newest: dict[str, dict[str, Any]] = {}
    for record in records.values():
        branch = str(record["branch"])
        if branch not in newest or record["_started"] >= newest[branch]["_started"]:
            newest[branch] = record
    return newest, notes


@dataclass
class Row:
    branch: str
    head: str
    state: str
    pr: str
    ledger: str
    session: str
    next: str


def session_view(
    record: dict[str, Any] | None, agents: list[dict[str, Any]] | None
) -> tuple[str, str | None, dict[str, Any] | None]:
    """(the table's words, the session id, its `claude agents` row) for a branch's launch record."""
    if record is None:
        return "-", None, None
    where = str(record["where"])
    session = record.get("session_id") if isinstance(record.get("session_id"), str) else None
    if where != "local":
        return f"{where} {session or ''}".strip(), session, None
    row = watch.agents_row(agents, record.get("name"))
    if row is None and agents is not None and session:
        row = next((r for r in agents if r.get("sessionId") == session), None)
    if agents is None:
        return f"local {session or '?'} (agents unreadable)", session, None
    live = row is not None and row.get("pid") is not None
    return f"local {session or '?'} ({'live' if live else 'ended'})", session, row


def reviewed_record(mine: list[Record], head: str, main_sha: str | None) -> Record | None:
    """The newest record whose head reaches `head` through clean merges of main only (merge_ready's
    rule, the one watch uses), or is `head`."""
    for record in sorted(mine, key=lambda r: r.round, reverse=True):
        if record.head == head:
            return record
        if main_sha is not None and merges_since(Path.cwd(), record.head, head, main_sha) is None:
            return record
    return None


def outcome_of(branch: str, head: str, main_sha: str | None) -> tuple[str | None, bool]:
    """(the head's Factory-State, whether the head could be read): the shared reader's reading of its
    message, and READY for clean merges of main on a READY head (`watch.inherits_ready`, the rule the
    watcher uses)."""
    info = watch.read_head(branch, head)
    if info is None:
        return None, False
    outcome = watch.parse_trailers(*info).outcome
    if outcome is None and watch.inherits_ready(head, main_sha):
        outcome = "READY"
    return outcome, True


def builder_facts(
    launch: dict[str, Any],
    branch: str,
    head: str,
    outcome: str | None,
    pr: dict[str, Any] | None,
    row: dict[str, Any] | None,
    agents: list[dict[str, Any]] | None,
) -> tuple[Any, ...]:
    """The arguments of `watch.builder_state` for this branch: the watcher's own rule, not a copy."""
    closed = pr is not None and pr.get("state") in watch.CLOSED_PR
    minutes = commit_age_days(head)
    quiet = int(minutes * 1440) if minutes is not None else 0
    return launch, outcome, acceptance_committed(branch, head), closed, row, agents, quiet


def builder_action(
    launch: dict[str, Any],
    state: str,
    acceptance: bool,
    session: str | None,
    row: dict[str, Any] | None,
    agents: list[dict[str, Any]] | None,
) -> str:
    """The next action for a head that is not READY, BLOCKED or reviewed. A local session the readable
    agents list shows without a pid has ended, whatever its `state` says (a session killed mid-turn keeps
    `working` or `blocked`); a row with a pid follows the watcher's state."""
    local = str(launch["where"]) == "local"
    ended = local and agents is not None and (row is None or row.get("pid") is None)
    if (ended or state == "done") and is_writer(launch) and acceptance:
        return "acceptance committed: launch the builder"
    if local and (ended or state in ("stopped", "failed", "done")):
        return f"resume {session}" if session else "resume (no session id recorded)"
    if state == "blocked":
        return "blocked: its session is blocked (claude agents)"
    if state == "quiet":
        return "building (no push for 30 minutes or more)"
    if row is not None and row.get("pid") is not None and watch.is_idle(row):
        return f"{LIVE_NOTE} (session idle)"
    return LIVE_NOTE


def is_writer(launch: dict[str, Any] | None) -> bool:
    return launch is not None and str(launch.get("role") or "builder") == "acceptance-writer"


def acceptance_committed(branch: str, head: str) -> bool:
    """Whether the head is the writer's `acceptance:` commit (the writer's work ends there)."""
    info = watch.read_head(branch, head)
    return info is not None and info[0].startswith("acceptance:")


def merged_for_good(pr: dict[str, Any], head: str) -> bool:
    """Whether a MERGED pull request ends this branch's open work: its head is the merged head or an
    ancestor of it. New commits on top keep the row."""
    merged_head = pr.get("headRefOid")
    return isinstance(merged_head, str) and (head == merged_head or ahead(head, merged_head))


def row_for(
    branch: str,
    head: str,
    prs: list[dict[str, Any]] | None,
    book: Ledger,
    launch: dict[str, Any] | None,
    agents: list[dict[str, Any]] | None,
    main_sha: str | None,
) -> tuple[Row, str | None]:
    """The branch's row, and its head's Factory-State. The PR's state is decided first; an open PR's
    verdict is the newest record that reaches this head through clean merges of main, and the
    Factory-State shown is that reviewed head's; only then the builder is looked at."""
    outcome, readable = outcome_of(branch, head, main_sha)
    words, session, agents_row = session_view(launch, agents)

    pr = pr_for(branch, prs) if prs is not None else None
    if pr is not None and pr.get("state") == "MERGED":
        pr = None  # collect() kept the branch: its name is reused, the merged PR is not its PR
    number = pr["number"] if pr is not None else None
    is_open = pr is not None and pr.get("state") == "OPEN"
    pr_text = "unknown (gh unreadable)" if prs is None else "-"
    if pr is not None:
        pr_text = f"#{number} {str(pr.get('state')).lower()}"
    mine = book.records.get(number, []) if number is not None else []
    last = max(mine, key=lambda r: r.round, default=None)
    ledger_text = "-"
    unreadable = number is not None and (number in book.unreadable or 0 in book.unreadable)
    if unreadable:
        ledger_text = "unreadable record"
    elif last is not None:
        ledger_text = f"{last.verdict} r{last.round}" + (
            "" if last.head == head else f" (on {last.head[:8]})"
        )
    reviewed = reviewed_record(mine, head, main_sha) if is_open and not unreadable else None
    shown = outcome
    if reviewed is not None and reviewed.head != head:
        shown = outcome_of(branch, reviewed.head, main_sha)[0]
    state = "unreadable" if not readable else (shown or "-")

    if pr is not None and not is_open:
        action = "PR closed"
    elif is_open and unreadable:
        action = "ledger record unreadable: re-record the review"
    elif reviewed is not None and reviewed.verdict == "PASS":
        green = ci_green(number, head) if number is not None else False
        action = "ready to land" if green else "PASS, CI not green: wait or fix CI"
    elif reviewed is not None and reviewed.verdict == "FIX":
        action = f"fix round {reviewed.round}"
    elif reviewed is not None:
        action = f"{reviewed.verdict} on this head: the owner decides"
    elif is_open and outcome == "READY" and readable:
        action = "unreviewed"
    elif outcome == "READY" and prs is None:
        action = "READY, PR unknown: gh unreadable"
    elif outcome == "READY":
        action = READY_NO_PR
    elif outcome == "READY-NO-VERIFY":
        action = "fix the Factory trailers"
    elif outcome == "BLOCKED":
        action = "blocked: read its Factory-Reason"
    elif launch is None:
        action = "building (no live session known)"
    else:
        facts = builder_facts(launch, branch, head, outcome, pr, agents_row, agents)
        action = builder_action(
            launch, watch.builder_state(*facts), facts[2], session, agents_row, agents
        )
    return Row(branch, head[:8], state, pr_text, ledger_text, words, action), outcome


def real_drawing_lock() -> str:
    try:
        loaded = json.loads((status.factory_dir() / "rdlock.json").read_text())
    except FileNotFoundError:
        return "real-drawing lock: free"
    except OSError, ValueError:
        return "real-drawing lock: unreadable"
    holder = loaded.get("holder") if isinstance(loaded, dict) else None
    if not isinstance(holder, dict):
        return "real-drawing lock: free"
    try:
        alive = status.pid_alive(int(holder.get("pid", 0)))
    except TypeError, ValueError:
        alive = False
    if not alive:
        return "real-drawing lock: free (its holder's process is gone)"
    waiters = loaded.get("waiters")
    queued = len(waiters) if isinstance(waiters, list) else 0
    head = str(holder.get("head", ""))[:8]
    line = (
        f"real-drawing lock: held by {holder.get('kind')} {head} ticket {holder.get('ticket') or '-'} "
        f"pid {holder.get('pid')} since {holder.get('since')}"
    )
    return line + (f"; {queued} waiting" if queued else "")


def commit_age_days(head: str) -> float | None:
    out = watch.git_out("log", "-1", "--format=%ct", head)
    if out is None or not out.strip().isdigit():
        return None
    return (status.now().timestamp() - int(out.strip())) / 86400


def collect() -> tuple[list[Row], list[str]] | None:
    """The rows and the notes under them; None when origin cannot be read."""
    origin = watch.remote_heads()
    if origin is None:
        return None
    notes: list[str] = []
    prs = read_prs()
    if prs is None:
        notes.append("gh could not be read: the PR column is unknown and nothing reads merged")
    elif len(prs) >= PR_LIMIT:
        notes.append(f"gh listed {PR_LIMIT} pull requests, the most it is asked for: older ones unseen")
    book = read_ledger(status.factory_dir() / "ledger")
    if book.unreadable:
        notes.append("a ledger record could not be read: its PR cannot land until it is re-recorded")
    started, bad = launches()
    notes += [f"{line}: its branch has no session shown" for line in bad]
    local = any(str(r["where"]) == "local" for r in started.values())
    agents = governor.read_agents() if local else None
    main_sha = origin.get("main")
    main_ok = main_sha is not None and watch.fetch("main", main_sha)
    base = main_sha if main_ok else None
    rows: list[Row] = []
    idle = 0
    for branch, (head, _mine) in branch_heads(origin).items():
        pr = pr_for(branch, prs) if prs is not None else None
        if pr is not None and pr.get("state") == "MERGED" and merged_for_good(pr, head):
            continue
        row, outcome = row_for(branch, head, prs, book, started.get(branch), agents, base)
        age = commit_age_days(head)
        if (
            prs is not None
            and pr is None
            and branch not in started
            and outcome != "READY"
            and age is not None
            and age > STALE_DAYS
        ):
            idle += 1  # not ticket work: no PR, no launch record, not READY, idle for days
            continue
        rows.append(row)
    if idle:
        notes.append(
            f"{idle} branches with no PR or launch, not READY, idle over {STALE_DAYS} days: not shown"
        )
    return rows, notes


COLUMNS = ("branch", "head", "factory-state", "PR", "ledger", "session", "next action")


def cell(text: str) -> str:
    """One table cell: one printable line, `|` escaped, so a branch name cannot forge a cell."""
    return watch.public(text, 200).replace("\\", "/").replace("|", "\\|")


def render(rows: list[Row], notes: list[str]) -> str:
    at = status.utc(status.now())
    lines = [f"Factory open work, read from the tools at {at}", ""]
    if rows:
        lines.append("| " + " | ".join(COLUMNS) + " |")
        lines.append("|" + "---|" * len(COLUMNS))
        for r in rows:
            cells = (r.branch, r.head, r.state, r.pr, r.ledger, r.session, r.next)
            lines.append("| " + " | ".join(cell(c) for c in cells) + " |")
    else:
        lines.append("No open ticket branch.")
    lines += ["", cell(real_drawing_lock())]
    lines += [f"note: {cell(note)}" for note in notes]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.state", description=__doc__)
    parser.add_argument("--resume-md", metavar="PATH", help="also write the table as RESUME.md here")
    args = parser.parse_args(argv)
    found = collect()
    if found is None:
        print("state: origin cannot be read (git ls-remote failed)", file=sys.stderr)
        return 1
    text = render(*found)
    if args.resume_md:
        target = Path(args.resume_md)
        target.parent.mkdir(parents=True, exist_ok=True)
        header = "# RESUME\n\nGenerated by `scripts.factory.state --resume-md`; never edited.\n\n"
        temp = target.with_name(target.name + ".tmp")
        temp.write_text(header + text)
        os.replace(temp, target)
    print(text, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
