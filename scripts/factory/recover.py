"""Recover after a reboot: list the dead local builders and print one resume line for each.

    python -m scripts.factory.recover

The local builders are the launch records `$VEXTRUS_FACTORY_DIR/launches/<ticket>-<utc>.json` with
`"where": "local"`; their sessions are the rows of `claude agents --json --all` (`governor.read_agents`,
seam `VEXTRUS_AGENTS_FILE`), matched by the record's full `session_id`, never by name. A session is dead
when no row of it has a `pid` (whatever its state), or its pid is gone, or its pid runs another command
(`/proc/<pid>/cmdline` starts with `claude` or `.../claude/versions/<v>`; never `comm`). A background row
with no pid and an interactive row with a live pid make a live session. A record with no row is dead.

No line for a live session, for a READY or BLOCKED head (`trailers.read` on `refs/heads/<branch>` of the
main checkout), for a cloud record or for a session with no local record. A resume line is a whole `say`
command, its message file and elapsed time left to the reader. Prints only: no `claude` but `agents`
runs, nothing is written, no ref or worktree moves. Exit 0, 2 outside a repository or with unreadable
agents.
"""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any

from scripts.factory import governor, liveness, say, status, trailers

TICKET = re.compile(r"[A-Za-z0-9._-]{1,80}")
BRANCH = re.compile(r"[A-Za-z0-9._/-]{1,200}")
RESUME = "uv run python -m scripts.factory.say {session} --file {file} --elapsed {elapsed}"


def local_records(folder: Path) -> tuple[list[dict[str, Any]], list[str]]:
    """The local launch records, and the names of those unreadable or malformed."""
    found, bad = [], []
    for path in sorted((folder / "launches").glob("*.json")):
        if path.name.endswith(".agents.json"):  # the agents snapshot beside a record
            continue
        try:
            record = json.loads(path.read_text())
        except OSError, ValueError:
            bad.append(f"{path.name}: unreadable")
            continue
        if not isinstance(record, dict):
            bad.append(f"{path.name}: not a launch record")
        elif record.get("where") == "local":
            problem = record_problem(record)
            if problem:
                bad.append(f"{path.name}: {problem}")
            else:
                found.append(record)
    return found, bad


def record_problem(record: dict[str, Any]) -> str | None:
    session, ticket, branch = (str(record.get(k) or "") for k in ("session_id", "ticket", "branch"))
    if not say.UUID.fullmatch(session):
        return "session_id is not a full session id (a UUID)"
    if not TICKET.fullmatch(ticket) or not BRANCH.fullmatch(branch) or branch.startswith("-"):
        return "ticket or branch is not a valid name"
    return None


def head_outcome(root: Path, branch: str) -> str | None:
    """READY, BLOCKED or other, read by trailers.md 1 from the branch's head in the main checkout."""
    ref = f"refs/heads/{branch}"
    message = subprocess.run(
        ["git", "log", "-1", "--format=%B", ref], cwd=root, capture_output=True, text=True, check=False
    )
    tree = subprocess.run(
        ["git", "rev-parse", f"{ref}^{{tree}}"], cwd=root, capture_output=True, text=True, check=False
    )
    if message.returncode != 0 or tree.returncode != 0:
        return None
    return trailers.read(message.stdout, tree.stdout.strip()).outcome


def dead_sessions(
    root: Path, records: list[dict[str, Any]], rows: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    dead, seen = [], set()
    for record in records:
        session = str(record["session_id"])
        if session in seen:
            continue
        seen.add(session)
        mine = [row for row in rows if row.get("sessionId") == session]
        if liveness.session_alive(mine):
            continue
        if head_outcome(root, str(record.get("branch") or "")) in ("READY", "BLOCKED"):
            continue
        dead.append(record)
    return dead


def main(argv: list[str] | None = None) -> int:
    root = status.main_checkout()
    if root is None:
        print("REFUSED: not inside a git repository", file=sys.stderr)
        return 2
    rows = governor.read_agents()
    if rows is None:
        print("REFUSED: `claude agents --json --all` gave no readable rows", file=sys.stderr)
        return 2
    folder = status.factory_dir()
    if not (folder / "launches").is_dir():
        print(f"REFUSED: no launches folder at {folder / 'launches'}", file=sys.stderr)
        return 2
    records, bad = local_records(folder)
    for line in bad:
        print(f"UNREADABLE launch record {line}", file=sys.stderr)
    dead = dead_sessions(root, records, rows)
    if not dead and not bad:
        print("no dead local builders")
    for record in dead:
        print(f"# {shlex.quote(str(record['ticket']))}: session is dead")
        print(
            RESUME.format(
                session=shlex.quote(str(record["session_id"])),
                file=shlex.quote("<message-file>"),
                elapsed=shlex.quote("<n/m>"),
            )
        )
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
