"""The rule for whether a builder's session is alive (used by `recover`).

A session is alive when one of its agents rows has a `pid` that exists and whose process is claude:
`/proc/<pid>/cmdline`'s argv0, first word, is `claude` or the installed binary `.../claude/versions/<v>`
(this includes the spare-hosted `claude bg-spare ...` form). Not checked: that the process belongs to the
session (its cwd); the committed acceptance tests start their live processes elsewhere.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from scripts.factory import status


def is_claude(pid: int) -> bool:
    try:
        raw = Path(f"/proc/{pid}/cmdline").read_bytes()
    except OSError:
        return False
    words = raw.split(b"\0", 1)[0].decode(errors="replace").split()
    if not words:
        return False
    parts = words[0].split("/")
    return parts[-1] == "claude" or (
        len(parts) >= 3 and parts[-2:-1] == ["versions"] and parts[-3] == "claude"
    )


def live_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The rows of one session whose pid exists and whose process is claude."""
    found = []
    for row in rows:
        pid = row.get("pid")
        if (
            isinstance(pid, int)
            and not isinstance(pid, bool)
            and status.pid_alive(pid)
            and is_claude(pid)
        ):
            found.append(row)
    return found


def session_alive(rows: list[dict[str, Any]]) -> bool:
    return bool(live_rows(rows))
