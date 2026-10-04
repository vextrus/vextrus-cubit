"""Talk to a local builder (spec 2.2 "Talk to a local builder"): a message, or a resume.

    python -m scripts.factory.say <session id> --file F (--elapsed n/m | --ticket T)

The session is a builder's full `sessionId` (a UUID) from `claude agents --json --all` (or the
`VEXTRUS_AGENTS_FILE` seam). The text is prefixed `[elapsed n/m min] ` (ADR 0041 item 4; `--ticket`
reads the ticket's budget record as `stamp elapsed --ticket` does). Then, by the session's agents row:

- alive (state `done`, or any row with a `pid`): the prefixed text is printed, for the orchestrator to
  send with SendMessage; no `claude` runs;
- `stopped` or `failed` with no `pid`: it is resumed in its own folder, `claude --resume <id> --bg
  --settings <main checkout>/scripts/factory/builder.settings.json "<prefixed text>"`, with the local
  launcher's child environment (VEXTRUS_ROLE=builder, the orchestrator's variables dropped);
- anything else (`stopped`/`failed` with a `pid`, an unknown state, no row): refused.

A resume whose output has a line starting `note:` (the CLI copied the conversation into a new session)
exits 6 and appends `ALARM-RESUME-COPY` to `$VEXTRUS_FACTORY_DIR/events.log`.

Exit 0, 2 refused or usage error, 1 the resume failed, 6 the resume copied the conversation.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from scripts.factory import governor, local, stamp, status

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
RESUMABLE = ("stopped", "failed")


def prefix(elapsed: str | None, ticket: str | None) -> str | None:
    if elapsed is not None:
        return f"[elapsed {elapsed} min] " if re.fullmatch(r"\d+/\d+", elapsed) else None
    found = stamp.ticket_elapsed(str(ticket), status.now())
    return None if found is None else f"[elapsed {found[0]}/{found[1]} min] "


def row_for(session: str) -> dict[str, Any] | None:
    rows = governor.read_agents() or []
    return next((row for row in rows if row.get("sessionId") == session), None)


def resume(session: str, row: dict[str, Any], text: str) -> int:
    main_checkout = status.main_checkout()
    if main_checkout is None:
        print("REFUSED: not inside a git repository", file=sys.stderr)
        return 2
    settings = main_checkout / "scripts" / "factory" / "builder.settings.json"
    folder = Path(str(row.get("cwd", "")))
    cwd = folder if folder.is_dir() else Path.cwd()
    argv = ["claude", "--resume", session, "--bg", "--settings", str(settings), text]
    done = subprocess.run(
        argv,
        cwd=cwd,
        env=local.child_env(),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=300,
        check=False,
    )
    if any(line.startswith("note:") for line in done.stdout.splitlines() + done.stderr.splitlines()):
        folder = status.factory_dir()
        folder.mkdir(parents=True, exist_ok=True)
        name = str(row.get("name") or session[:8]).replace(" ", "_")[:80]
        with (folder / "events.log").open("a") as log:
            log.write(
                f"{status.utc(status.now())} ALARM-RESUME-COPY {name} resume copied the conversation\n"
            )
        print(f"ALARM-RESUME-COPY: resuming {session} copied the conversation into a new session")
        return 6
    if done.returncode != 0:
        print(f"ERROR claude --resume exited {done.returncode}")
        return 1
    print(f"resumed {session}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.say", description=__doc__)
    parser.add_argument("session")
    parser.add_argument("--file", required=True, type=Path)
    when = parser.add_mutually_exclusive_group(required=True)
    when.add_argument("--elapsed")
    when.add_argument("--ticket")
    args = parser.parse_args(argv)
    if not UUID.match(args.session):
        print(f"REFUSED: {args.session!r} is not a full session id (a UUID)", file=sys.stderr)
        return 2
    try:
        head = prefix(args.elapsed, args.ticket)
    except stamp.Refused as refusal:
        print(f"REFUSED: {refusal}", file=sys.stderr)
        return 2
    if head is None:
        print(
            "REFUSED: no elapsed time (--elapsed n/m, or a ticket with a budget record)", file=sys.stderr
        )
        return 2
    try:
        body = args.file.read_text().strip()
    except OSError as error:
        print(f"REFUSED: {args.file} is unreadable: {error.strerror}", file=sys.stderr)
        return 2
    if not body:
        print("REFUSED: the message is empty", file=sys.stderr)
        return 2
    row = row_for(args.session)
    if row is None:
        print(f"REFUSED: no agents row has sessionId {args.session}", file=sys.stderr)
        return 2
    state, pid = row.get("state"), row.get("pid")
    if state == "done" or (pid is not None and state not in RESUMABLE):
        print(head + body)
        return 0
    if state in RESUMABLE and pid is None:
        return resume(args.session, row, head + body)
    print(f"REFUSED: session {args.session} is {state} with pid {pid}: not resumable", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
