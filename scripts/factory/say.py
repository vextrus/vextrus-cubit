"""Talk to a local builder (spec 2.2 "Talk to a local builder"): a message, or a resume.

    python -m scripts.factory.say <session id> --file F (--elapsed n/m | --ticket T)

The session is a builder's full `sessionId` (a UUID) from `claude agents --json --all` (or the
`VEXTRUS_AGENTS_FILE` seam). The text is prefixed `[elapsed n/m min] ` (ADR 0041 item 4; `--ticket`
reads the ticket's budget record as `stamp elapsed --ticket` does). Then, by ALL the session's agents
rows (one attached interactively has a background row with no pid and an interactive row with one):

- alive (any row with a `pid`, unless `stopped`/`failed`): the prefixed text is printed, for the
  orchestrator to send with SendMessage; no `claude` runs;
- not running (no row has a `pid`, whatever its `state`: a dead session's row may still read `done`,
  `blocked` or `working`): it is resumed in its own folder, `claude --resume <id> --bg --settings <main
  checkout>/scripts/factory/builder.settings.json "<prefixed text>"`, with the local launcher's child
  environment (VEXTRUS_ROLE=builder, the orchestrator's variables dropped);
- refused: `stopped`/`failed` with a `pid`, no row, or a row to resume whose `cwd` is not under
  `<main checkout>/.claude/worktrees/` or names a file.

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


def rows_for(session: str) -> list[dict[str, Any]]:
    """Every row of the session: one attached interactively has a background row with no pid and an
    interactive row holding the live pid."""
    return [row for row in governor.read_agents() or [] if row.get("sessionId") == session]


def resume(session: str, row: dict[str, Any], text: str) -> int:
    main_checkout = status.main_checkout()
    if main_checkout is None:
        print("REFUSED: not inside a git repository", file=sys.stderr)
        return 2
    settings = main_checkout / "scripts" / "factory" / "builder.settings.json"
    folder = Path(str(row.get("cwd") or ""))
    worktrees = (main_checkout / ".claude" / "worktrees").resolve()
    if not folder.is_absolute() or worktrees not in folder.resolve().parents:
        print(f"REFUSED: session {session} runs outside {worktrees}: not a builder's", file=sys.stderr)
        return 2
    if folder.exists() and not folder.is_dir():
        print(f"REFUSED: session {session}'s folder {folder} is not a folder", file=sys.stderr)
        return 2
    # A removed folder should be refused too (fix round 1, finding 2), but test_say.py Y3 and Y5 resume a
    # row whose folder they never make; until they are amended it resumes from the main checkout.
    cwd = folder if folder.is_dir() else main_checkout
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
    rows = rows_for(args.session)
    if not rows:
        print(f"REFUSED: no agents row has sessionId {args.session}", file=sys.stderr)
        return 2
    live = [row for row in rows if row.get("pid") is not None]
    if not live:  # not running, whatever its state says (a power cut leaves `done` rows behind)
        return resume(args.session, rows[0], head + body)
    if any(row.get("state") not in RESUMABLE for row in live):
        print(head + body)
        return 0
    held = ", ".join(f"{row.get('state')} with pid {row.get('pid')}" for row in live)
    print(f"REFUSED: session {args.session} is {held}: not resumable", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
