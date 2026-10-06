"""Which commit of a range put a leak hit where the scanner says (S14-P7 review round 1).

The range scan (`tools.leakscan range <base>..<head>`) numbers a file hit `<path>:<line>` within the
commit that added the line, in the file as that commit holds it; a message hit is `commit:<sha12>:<n>`
already. `commits_of` finds, for a file hit, the commits of the range that added that line (`git blame`
at each commit touching the path names the commit itself), so a reader can take the line from
`<sha>:<path>` and a message can name the commit. Locations and shas only: no line is ever returned.

This module compiles on Python 3.11 (the watcher imports it).
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

GIT_TIMEOUT = 120
RUN_ERRORS = (OSError, subprocess.SubprocessError)  # a name, not `except A, B:` (3.14 only)
FILE_HIT = re.compile(r"(.+):([0-9]{1,9})")
MESSAGE_HIT = re.compile(r"commit:([0-9a-f]{7,40}):[0-9]+")


def _git(repo: Path, *args: str) -> str | None:
    try:
        done = subprocess.run(
            ["git", "-c", "core.quotePath=false", *args],
            cwd=repo,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdin=subprocess.DEVNULL,
            timeout=GIT_TIMEOUT,
            check=False,
        )
    except RUN_ERRORS:
        return None
    return done.stdout if done.returncode == 0 else None


def file_hit(where: str) -> tuple[str, int] | None:
    """`(path, line)` of a file hit; None for a message, name, ref or blob location."""
    if where.startswith(("commit:", "name:", "ref")) or where.endswith(":bin"):
        return None
    match = FILE_HIT.fullmatch(where)
    if match is None or int(match.group(2)) < 1:
        return None
    return match.group(1), int(match.group(2))


def commits_of(repo: Path, base: str, head: str, where: str) -> list[str]:
    """The full shas of the commits in `base..head` whose own changes put the hit at `where`."""
    message = MESSAGE_HIT.fullmatch(where)
    if message is not None:
        found = _git(repo, "rev-parse", "--verify", "-q", f"{message.group(1)}^{{commit}}")
        return [found.strip()] if found else []
    place = file_hit(where)
    if place is None:
        return []
    path, line = place
    listed = _git(repo, "rev-list", "--full-history", f"{base}..{head}", "--", path)
    shas: list[str] = []
    for sha in (listed or "").split():
        blamed = _git(repo, "blame", "--porcelain", "-L", f"{line},{line}", sha, "--", path)
        if blamed and blamed.split(" ", 1)[0] == sha:
            shas.append(sha)
    return shas


def is_pushed(repo: Path, sha: str) -> bool:
    """True when a remote-tracking ref holds the commit (it is on origin, so history keeps it)."""
    held = _git(repo, "branch", "-r", "--contains", sha)
    return bool(held and held.strip())
