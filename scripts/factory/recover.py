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
import subprocess
import sys
from pathlib import Path
from typing import Any

from scripts.factory import governor, status, trailers

RESUME = "uv run python -m scripts.factory.say {session} --file {file} --elapsed {elapsed}"


def command_is_claude(pid: int) -> bool:
    """The process's first argument is `claude` or the installed binary `.../claude/versions/<v>`."""
    try:
        raw = Path(f"/proc/{pid}/cmdline").read_bytes()
    except OSError:
        return False
    argv0 = raw.split(b"\0", 1)[0].decode(errors="replace")
    parts = argv0.split("/")
    return (
        argv0 == "claude"
        or parts[-1] == "claude"
        or (len(parts) >= 3 and parts[-2] == "versions" and parts[-3] == "claude")
    )


def session_alive(rows: list[dict[str, Any]]) -> bool:
    for row in rows:
        pid = row.get("pid")
        if (
            isinstance(pid, int)
            and not isinstance(pid, bool)
            and status.pid_alive(pid)
            and command_is_claude(pid)
        ):
            return True
    return False


def local_records(folder: Path) -> list[dict[str, Any]]:
    found = []
    for path in sorted((folder / "launches").glob("*.json")):
        try:
            record = json.loads(path.read_text())
        except OSError, ValueError:
            continue
        if isinstance(record, dict) and record.get("where") == "local" and record.get("session_id"):
            found.append(record)
    return found


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


def dead_sessions(root: Path, folder: Path, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    dead, seen = [], set()
    for record in local_records(folder):
        session = str(record["session_id"])
        if session in seen:
            continue
        seen.add(session)
        mine = [row for row in rows if row.get("sessionId") == session]
        if session_alive(mine):
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
    dead = dead_sessions(root, status.factory_dir(), rows)
    if not dead:
        print("no dead local builders")
        return 0
    for record in dead:
        print(f"# {record.get('ticket')} ({record.get('branch')}): session is dead")
        print(RESUME.format(session=record["session_id"], file="<message-file>", elapsed="<n/m>"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
