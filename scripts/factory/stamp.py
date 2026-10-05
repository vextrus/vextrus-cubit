"""The clock's data: the session's budget and phases, the state file's stamped lines, a ticket's budget.

    python -m scripts.factory.stamp start --budget 11h --state <STATE.md>
        [--phases "p1=150,p3=330"] [--force]
    python -m scripts.factory.stamp "<text>"          (also: stamp "<text>")
    python -m scripts.factory.stamp phase <name>
    python -m scripts.factory.stamp elapsed [--ticket <t>]
    python -m scripts.factory.stamp budget --ticket <t> --minutes <n>

`start` writes `$VEXTRUS_FACTORY_DIR/session.json`:

    {"schema": 1, "started_utc": "<UTC>", "budget_minutes": 660, "state_file": "<absolute STATE.md>",
     "phases": [{"name": "p3", "minutes": 330, "start_utc": null}]}

and refuses a second start unless `--force`. A line of text is appended to the state file as `<UTC>
<text>`. `phase <name>` fills a planned phase's `start_utc` (the newest started phase is the current one,
so starting one ends the one before; time between phases is in no phase). `budget` writes a builder's
record `<git common dir>/vextrus/budget-<t>.json` = `{"schema": 1, "ticket": "<t>", "minutes": <n>,
"started_utc": "<UTC>"}` for the repository at the cwd (a linked worktree writes into the main
repository's `.git`). `elapsed` prints `now <YYYY-MM-DD HH:MMZ> · session h:mm/h:mm[ · phase <name>
h:mm/h:mm]`, or `ticket <t> n/m min`, or `no budget set`; the clock hook (f6) prints the same form.

Budgets and phase lengths are minutes: `90`, `330m`, `11h` or `5h30m`. The clock is `VEXTRUS_NOW` when
set. Exit 0 done, 2 refused or usage error.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from scripts.factory import status

DURATION = re.compile(r"^(?:(\d+)h)?(?:(\d+)m)?$|^(\d+)$")
SUBCOMMANDS = ("start", "phase", "elapsed", "budget", "stamp")


class Refused(Exception):
    """A refusal: the message is printed and the exit code is 2."""


def parse_minutes(text: str) -> int:
    match = DURATION.match(text.strip())
    if not match or not text.strip():
        raise Refused(f"not a duration: {text!r} (use 90, 330m, 11h or 5h30m)")
    hours, minutes, plain = match.groups()
    total = int(plain) if plain else int(hours or 0) * 60 + int(minutes or 0)
    if total <= 0:
        raise Refused(f"a duration must be above zero: {text!r}")
    return total


def hmm(minutes: int) -> str:
    return f"{minutes // 60}:{minutes % 60:02d}"


def session_path() -> Path:
    return status.factory_dir() / "session.json"


def load_session() -> dict[str, Any] | None:
    """session.json, or None when absent; a file that does not parse is refused, never ignored."""
    path = session_path()
    if not path.exists():
        return None
    try:
        loaded = json.loads(path.read_text())
        if not isinstance(loaded, dict):
            raise TypeError("not an object")
        status.parse_utc(loaded["started_utc"])
        int(loaded["budget_minutes"])
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise Refused(f"{path} is unreadable: {error}") from error
    return loaded


def current_phase(session: dict[str, Any]) -> dict[str, Any] | None:
    started = [p for p in session.get("phases", []) if p.get("start_utc")]
    return max(started, key=lambda p: status.parse_utc(p["start_utc"]), default=None)


def start(budget: str, state: str, phases: str | None, force: bool) -> None:
    minutes = parse_minutes(budget)
    planned: list[dict[str, Any]] = []
    for part in (phases or "").split(","):
        if not part.strip():
            continue
        name, sep, length = part.partition("=")
        if not sep or not name.strip():
            raise Refused(f"a phase is name=minutes, not {part!r}")
        if any(p["name"] == name.strip() for p in planned):
            raise Refused(f"phase {name.strip()!r} is planned twice")
        planned.append({"name": name.strip(), "minutes": parse_minutes(length), "start_utc": None})
    if session_path().exists() and not force:
        raise Refused(f"{session_path()} exists: a session has started (pass --force to replace it)")
    session = {
        "schema": 1,
        "started_utc": status.utc(status.now()),
        "budget_minutes": minutes,
        "state_file": str(Path(state).resolve()),
        "phases": planned,
    }
    status.write_atomic(session_path(), session)
    print(f"session started: budget {hmm(minutes)}, {len(planned)} phases")


def stamp_line(text: str) -> None:
    session = load_session()
    if session is None:
        raise Refused("no session.json: run `stamp start` first")
    state = Path(session["state_file"])
    line = " ".join(text.split())
    if not line:
        raise Refused("nothing to stamp")
    try:
        previous = state.read_text() if state.exists() else ""
    except OSError as error:
        raise Refused(f"{state} is unreadable: {error}") from error
    with state.open("a") as handle:
        if previous and not previous.endswith("\n"):
            handle.write("\n")
        handle.write(f"{status.utc(status.now())} {line}\n")


def phase(name: str) -> None:
    session = load_session()
    if session is None:
        raise Refused("no session.json: run `stamp start` first")
    planned = [p for p in session.get("phases", []) if p.get("name") == name]
    if not planned:
        names = ", ".join(p["name"] for p in session.get("phases", [])) or "none"
        raise Refused(f"{name!r} is not a planned phase (planned: {names})")
    planned[0]["start_utc"] = status.utc(status.now())
    status.write_atomic(session_path(), session)
    print(f"phase {name} started")


def budget_path(ticket: str, start_dir: Path | None = None) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", ticket):
        raise Refused(f"not a ticket id: {ticket!r}")
    common = status.git_common_dir(start_dir)
    if common is None:
        raise Refused("not inside a git repository")
    return common / "vextrus" / f"budget-{ticket}.json"


def write_budget(ticket: str, minutes: int, start_dir: Path | None = None) -> Path:
    path = budget_path(ticket, start_dir)
    record = {"schema": 1, "ticket": ticket, "minutes": minutes, "started_utc": status.utc(status.now())}
    status.write_atomic(path, record)
    return path


def ticket_elapsed(ticket: str, at: datetime, start_dir: Path | None = None) -> tuple[int, int] | None:
    """(elapsed, budget) minutes of a ticket's budget record, None when it has none."""
    path = budget_path(ticket, start_dir)
    if not path.exists():
        return None
    try:
        record = json.loads(path.read_text())
        started = status.parse_utc(record["started_utc"])
        minutes = int(record["minutes"])
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise Refused(f"{path} is unreadable: {error}") from error
    return status.minutes_between(started, at), minutes


def elapsed(ticket: str | None) -> str:
    at = status.now()
    if ticket is not None:
        found = ticket_elapsed(ticket, at)
        return "no budget set" if found is None else f"ticket {ticket} {found[0]}/{found[1]} min"
    session = load_session()
    if session is None:
        return "no budget set"
    started = status.parse_utc(session["started_utc"])
    line = (
        f"now {at.strftime('%Y-%m-%d %H:%MZ')} · session "
        f"{hmm(status.minutes_between(started, at))}/{hmm(int(session['budget_minutes']))}"
    )
    current = current_phase(session)
    if current is not None:
        since = status.minutes_between(status.parse_utc(current["start_utc"]), at)
        line += f" · phase {current['name']} {hmm(since)}/{hmm(int(current['minutes']))}"
    return line


def main(argv: list[str] | None = None) -> int:
    args_in = list(sys.argv[1:] if argv is None else argv)
    if args_in and args_in[0] not in SUBCOMMANDS and not args_in[0].startswith("-"):
        args_in = ["stamp", " ".join(args_in)]
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.stamp", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    one = sub.add_parser("start")
    one.add_argument("--budget", required=True)
    one.add_argument("--state", required=True)
    one.add_argument("--phases")
    one.add_argument("--force", action="store_true")
    sub.add_parser("stamp").add_argument("text", nargs="+")
    sub.add_parser("phase").add_argument("name")
    sub.add_parser("elapsed").add_argument("--ticket")
    one = sub.add_parser("budget")
    one.add_argument("--ticket", required=True)
    one.add_argument("--minutes", required=True)
    args = parser.parse_args(args_in)
    try:
        if args.command == "start":
            start(args.budget, args.state, args.phases, args.force)
        elif args.command == "stamp":
            stamp_line(" ".join(args.text))
        elif args.command == "phase":
            phase(args.name)
        elif args.command == "elapsed":
            print(elapsed(args.ticket))
        else:
            path = write_budget(args.ticket, parse_minutes(args.minutes))
            print(f"budget: {path}")
    except Refused as refusal:
        print(f"REFUSED: {refusal}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
