"""Which commit of a range holds each leak hit, by the scanner's own reading of that commit
(S14-P7 review rounds 1 and 2).

The range scan (`tools.leakscan range <base>..<head>`) reads each commit's own changes: its added lines,
numbered `<path>:<line>` in the file as that commit holds it, its message (`commit:<sha12>:<n>`) and its
new file names. `commit_hits` runs the scanner over each commit of the range alone (`<c>^..<c>`,
never stamped), so each hit is named `(<sha>, <where>, <n>)` by the commit whose added text matched,
with that commit's own line number: never a commit that merely touched the same line number. A merge's
own hits are its scan's less those its merged-in commits report (they are scanned on their own).
Locations, shas and counts only: no scanned text is ever returned.

This module compiles on Python 3.11 (the watcher imports it).
"""

from __future__ import annotations

import json
import subprocess
from collections.abc import Mapping, Sequence
from pathlib import Path

GIT_TIMEOUT = 120
SCAN_TIMEOUT = 600
RUN_ERRORS = (OSError, subprocess.SubprocessError)  # a name, not `except A, B:` (3.14 only)
READ_ERRORS = (IndexError, ValueError, KeyError, TypeError)

Hit = tuple[str, str, int]  # (commit sha, where within that commit's own scan, count)


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


def scan_span(
    repo: Path, scanner: Sequence[str], span: str, env: Mapping[str, str] | None = None
) -> list[tuple[str, int]] | None:
    """The scanner's hits over `span` (`--no-stamp --json`); None when it could not scan."""
    try:
        done = subprocess.run(
            [*scanner, "range", span, "--no-stamp", "--json"],
            cwd=repo,
            env=None if env is None else dict(env),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=SCAN_TIMEOUT,
            check=False,
        )
        report = json.loads(done.stdout.strip().splitlines()[-1])
        if report["summary"]["status"] not in ("clean", "hits"):
            return None
        return [(str(hit["where"]), int(hit["n"])) for hit in report["hits"]]
    except RUN_ERRORS:
        return None
    except READ_ERRORS:
        return None


def commit_hits(
    repo: Path, scanner: Sequence[str], base: str, head: str, env: Mapping[str, str] | None = None
) -> list[Hit] | None:
    """Every hit of `base..head` with the commit whose own change holds it; None when a commit could
    not be scanned (the caller then names the range's locations without commits)."""
    listed = _git(repo, "rev-list", "--reverse", "--topo-order", "--parents", f"{base}..{head}", "--")
    if listed is None:
        return None
    found: list[Hit] = []
    own: dict[str, set[str]] = {}
    for row in listed.splitlines():
        sha, *parents = row.split()
        if not parents:
            return None
        hits = scan_span(repo, scanner, f"{sha}^..{sha}", env)
        if hits is None:
            return None
        if len(parents) > 1:
            # `<merge>^..<merge>` also reads the merged-in commits: theirs are theirs.
            side = _git(repo, "rev-list", f"{sha}^..{sha}", "--") or ""
            theirs = set().union(*(own.get(c, set()) for c in side.split() if c != sha))
            hits = [(where, n) for where, n in hits if where not in theirs]
        own[sha] = {where for where, _ in hits}
        found += [(sha, where, n) for where, n in hits]
    return found


def is_pushed(repo: Path, sha: str) -> bool:
    """True when a remote-tracking ref holds the commit (it is on origin, so history keeps it)."""
    held = _git(repo, "branch", "-r", "--contains", sha)
    return bool(held and held.strip())
