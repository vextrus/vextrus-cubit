"""The factory's open-work table, rebuilt from tools every time it is asked for.

    python -m scripts.factory.state [--resume-md <path>]

Run it from the main checkout: git runs in the current directory's repository. One row per open ticket
branch (every branch of origin and every local branch of this checkout, except `main` and `review/*`;
a branch whose pull request is merged, or whose head is already in main, is not open work):

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
from scripts.land import pending, red

READY_NO_PR = "READY, no PR"
LIVE_NOTE = "building"
SHA40 = re.compile(r"[0-9a-f]{40}")
RECORD_NAME = re.compile(r"(\d+)-([0-9a-f]{40})\.json")
SKIPPED_BRANCHES = ("review/",)
GH_TIMEOUT = 120


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
        *("--state", "all", "--limit", "200"),
        *("--json", "number,title,headRefName,headRefOid,state"),
    )
    if not isinstance(listed, list):
        return None
    return [r for r in listed if isinstance(r, dict) and isinstance(r.get("number"), int)]


def pr_for(branch: str, prs: list[dict[str, Any]]) -> dict[str, Any] | None:
    mine = [r for r in prs if r.get("headRefName") == branch]
    return max(mine, key=lambda r: (r.get("state") == "OPEN", r["number"]), default=None)


def ci_green(number: int, head: str) -> bool:
    """Whether the PR's rollup is settled and fine on `head` (a rollup for another head, an empty or
    pending one, or an unreadable one is not green)."""
    view = run_gh("pr", "view", str(number), "--json", "headRefOid,statusCheckRollup")
    if not isinstance(view, dict) or view.get("headRefOid") != head:
        return False
    entries = [e for e in view.get("statusCheckRollup") or [] if isinstance(e, dict)]
    return bool(entries) and not any(pending(e) or red(e) for e in entries)


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


def launches() -> dict[str, dict[str, Any]]:
    """The newest builder launch record per branch."""
    records, _ = watch.load_launches(status.factory_dir(), None)
    newest: dict[str, dict[str, Any]] = {}
    for record in records.values():
        if not watch.is_builder(record):
            continue
        branch = str(record["branch"])
        if branch not in newest or record["_started"] >= newest[branch]["_started"]:
            newest[branch] = record
    return newest


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
) -> tuple[str, str | None, bool]:
    """(the table's words, the session id, whether it is live) for a branch's launch record."""
    if record is None:
        return "-", None, False
    where = str(record["where"])
    session = record.get("session_id") if isinstance(record.get("session_id"), str) else None
    if where != "local":
        return f"{where} {session or ''}".strip(), session, False
    row = watch.agents_row(agents, record.get("name"))
    if row is None and agents is not None and session:
        row = next((r for r in agents if r.get("sessionId") == session), None)
    if agents is None:
        return f"local {session or '?'} (agents unreadable)", session, False
    live = row is not None and row.get("pid") is not None
    return f"local {session or '?'} ({'live' if live else 'ended'})", session, live


def row_for(
    branch: str,
    head: str,
    prs: list[dict[str, Any]] | None,
    book: Ledger,
    launch: dict[str, Any] | None,
    agents: list[dict[str, Any]] | None,
) -> Row:
    info = watch.read_head(branch, head)
    trailers = watch.parse_trailers(*info) if info is not None else None
    outcome = trailers.outcome if trailers is not None else None
    state = "unreadable" if info is None else (outcome or "-")
    words, session, live = session_view(launch, agents)

    pr = pr_for(branch, prs) if prs is not None else None
    number = pr["number"] if pr is not None else None
    is_open = pr is not None and pr.get("state") == "OPEN"
    pr_text = "unknown (gh unreadable)" if prs is None else "-"
    if pr is not None:
        pr_text = f"#{number} {str(pr.get('state')).lower()}"
    ledger_text = "-"
    mine = book.records.get(number, []) if number is not None else []
    last = max(mine, key=lambda r: r.round, default=None)
    if last is not None:
        ledger_text = f"{last.verdict} r{last.round}" + (
            "" if last.head == head else f" (on {last.head[:8]})"
        )
    unreadable = number is not None and (number in book.unreadable or 0 in book.unreadable)
    if unreadable:
        ledger_text = "unreadable record"

    here = next((r for r in sorted(mine, key=lambda r: r.round) if r.head == head), None)
    if is_open and unreadable:
        action = "ledger record unreadable: re-record the review"
    elif is_open and here is not None and here.verdict == "PASS":
        green = ci_green(number, head) if number is not None else False
        action = "ready to land" if green else "PASS, CI not green: wait or fix CI"
    elif is_open and here is not None and here.verdict == "FIX":
        action = f"fix round {here.round}"
    elif is_open and here is not None:
        action = f"{here.verdict} on this head: the owner decides"
    elif is_open and outcome == "READY" and info is not None:
        action = "unreviewed"
    elif outcome == "READY" and prs is None:
        action = "READY, PR unknown: gh unreadable"
    elif outcome == "READY":
        action = READY_NO_PR
    elif outcome == "READY-NO-VERIFY":
        action = "fix the Factory trailers"
    elif outcome == "BLOCKED":
        action = "blocked: read its Factory-Reason"
    elif is_open and mine:
        action = "unreviewed"
    elif launch is not None and str(launch["where"]) == "local" and agents is not None and not live:
        action = f"resume {session}" if session else "resume (no session id recorded)"
    elif live:
        action = LIVE_NOTE
    else:
        action = "building (no live session known)"
    return Row(branch, head[:8], state, pr_text, ledger_text, words, action)


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


def collect() -> tuple[list[Row], list[str]] | None:
    """The rows and the notes under them; None when origin cannot be read."""
    origin = watch.remote_heads()
    if origin is None:
        return None
    notes: list[str] = []
    prs = read_prs()
    if prs is None:
        notes.append("gh could not be read: the PR column is unknown and nothing reads merged")
    book = read_ledger(status.factory_dir() / "ledger")
    if book.unreadable:
        notes.append("a ledger record could not be read: its PR cannot land until it is re-recorded")
    started = launches()
    local = any(str(r["where"]) == "local" for r in started.values())
    agents = governor.read_agents() if local else None
    main_sha = origin.get("main")
    rows: list[Row] = []
    for branch, (head, _mine) in branch_heads(origin).items():
        pr = pr_for(branch, prs) if prs is not None else None
        if pr is not None and pr.get("state") == "MERGED":
            continue
        in_main = main_sha is not None and branch not in started and watch.fetch("main", main_sha)
        if in_main and main_sha is not None and ahead(head, main_sha):  # nothing left to land
            continue
        rows.append(row_for(branch, head, prs, book, started.get(branch), agents))
    return rows, notes


COLUMNS = ("branch", "head", "factory-state", "PR", "ledger", "session", "next action")


def render(rows: list[Row], notes: list[str]) -> str:
    at = status.utc(status.now())
    lines = [f"Factory open work, read from the tools at {at}", ""]
    if rows:
        lines.append("| " + " | ".join(COLUMNS) + " |")
        lines.append("|" + "---|" * len(COLUMNS))
        for r in rows:
            cells = (r.branch, r.head, r.state, r.pr, r.ledger, r.session, r.next)
            lines.append("| " + " | ".join(cells) + " |")
    else:
        lines.append("No open ticket branch.")
    lines += ["", real_drawing_lock()]
    lines += [f"note: {note}" for note in notes]
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
