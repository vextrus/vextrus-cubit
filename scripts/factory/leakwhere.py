"""Which commit of a range holds each leak hit, by the scanner's own reading of that commit
(S14-P7 review rounds 1 and 2).

The range scan (`tools.leakscan range <base>..<head>`) reads each commit's own changes: its added lines,
numbered `<path>:<line>` in the file as that commit holds it, its message (`commit:<sha12>:<n>`) and its
new file names. `commit_hits` runs the scanner over each commit of the range alone (`<c>^..<c>`,
never stamped), so each hit is named `(<sha>, <where>, <n>)` by the commit whose added text matched,
with that commit's own line number: never a commit that merely touched the same line number. A merge
is read by its own lines only, those new to every parent in its combined diff, and its message
(`merge_hits`): never the commits it merges in (main's are outside the range).
Locations, shas and counts only: no scanned text is ever returned.

This module compiles on Python 3.11 (the watcher imports it).
"""

from __future__ import annotations

import json
import re
import subprocess
from collections.abc import Mapping, Sequence
from pathlib import Path

GIT_TIMEOUT = 120
SCAN_TIMEOUT = 600
RUN_ERRORS = (OSError, subprocess.SubprocessError)  # a name, not `except A, B:` (3.14 only)
READ_ERRORS = (IndexError, ValueError, KeyError, TypeError)
HUNK = re.compile(r"^(@{3,}) (?:-\d+(?:,\d+)? )+\+(\d+)(?:,\d+)? @{3,}")

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


def _scanner(
    repo: Path,
    scanner: Sequence[str],
    args: Sequence[str],
    env: Mapping[str, str] | None,
    stdin: str | None = None,
) -> list[tuple[str, int]] | None:
    """The scanner's hits (`<args> --no-stamp --json`); None when it could not scan."""
    try:
        done = subprocess.run(
            [*scanner, *args, "--no-stamp", "--json"],
            cwd=repo,
            env=None if env is None else dict(env),
            input="" if stdin is None else stdin,
            capture_output=True,
            text=True,
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


def scan_span(
    repo: Path, scanner: Sequence[str], span: str, env: Mapping[str, str] | None = None
) -> list[tuple[str, int]] | None:
    """The scanner's hits over `span`; None when it could not scan."""
    return _scanner(repo, scanner, ["range", span], env)


def merge_lines(repo: Path, sha: str) -> list[tuple[str, int, str]] | None:
    """A merge's own lines: in its combined diff (`git show --cc`), the lines new to every parent,
    each `(path, line in the merge's file, text)`. A clean merge has none (the combined diff leaves out
    every file that matches one parent)."""
    shown = _git(
        repo, "show", "--cc", "--format=", "--no-color", "--no-ext-diff", "--no-textconv", "--text", sha
    )
    if shown is None:
        return None
    rows: list[tuple[str, int, str]] = []
    path, line, parents = "", 0, 0
    for text in shown.split("\n"):
        if text.startswith("+++ "):
            path = text[4:].removeprefix("b/") if text[4:] != "/dev/null" else ""
            continue
        header = HUNK.match(text)
        if header is not None:
            parents = len(header.group(1)) - 1
            line = int(header.group(2))
            continue
        if not path or parents < 2 or len(text) < parents or text.startswith("diff --"):
            continue
        marks, body = text[:parents], text[parents:]
        if set(marks) - {" ", "+", "-"}:
            continue
        if "-" in marks:
            continue  # a parent's line the merge does not keep
        if set(marks) == {"+"}:
            rows.append((path, line, body))
        line += 1
    return rows


def merge_hits(
    repo: Path, scanner: Sequence[str], sha: str, env: Mapping[str, str] | None
) -> list[tuple[str, int]] | None:
    """A merge's own hits: its own lines (`merge_lines`) as `<path>:<line>` and its message as
    `commit:<sha12>:<n>`, by the scanner's `text --stdin`. Never the merged-in commits' lines: those
    are theirs (in the range, scanned on their own; main's, outside it)."""
    rows = merge_lines(repo, sha)
    message = _git(repo, "log", "-1", "--format=%B", sha)
    if rows is None or message is None:
        return None
    hits: list[tuple[str, int]] = []
    if rows:
        # One row per odd line, blank lines between, so no two rows read as one wrapped line.
        found = _scanner(repo, scanner, ["text", "--stdin"], env, "\n\n".join(r[2] for r in rows))
        if found is None:
            return None
        for where, n in found:
            k = int(where.rsplit(":", 1)[1]) if where.startswith("stdin:") else 0
            if k % 2 == 1 and (k - 1) // 2 < len(rows):
                path, line, _ = rows[(k - 1) // 2]
                hits.append((f"{path}:{line}", n))
    said = _scanner(repo, scanner, ["text", "--stdin"], env, message.strip("\n"))
    if said is None:
        return None
    for where, n in said:
        if where.startswith("stdin:"):
            hits.append((f"commit:{sha[:12]}:{where.rsplit(':', 1)[1]}", n))
    return hits


def commit_hits(
    repo: Path, scanner: Sequence[str], base: str, head: str, env: Mapping[str, str] | None = None
) -> list[Hit] | None:
    """Every hit of `base..head` with the commit whose own change holds it; None when a commit could
    not be scanned (the caller then names the range's locations without commits)."""
    listed = _git(repo, "rev-list", "--reverse", "--topo-order", "--parents", f"{base}..{head}", "--")
    if listed is None:
        return None
    found: list[Hit] = []
    for row in listed.splitlines():
        sha, *parents = row.split()
        if not parents:
            return None
        if len(parents) > 1:
            # `<merge>^..<merge>` would also read every commit merged in (main's among them).
            hits = merge_hits(repo, scanner, sha, env)
        else:
            hits = scan_span(repo, scanner, f"{sha}^..{sha}", env)
        if hits is None:
            return None
        found += [(sha, where, n) for where, n in hits]
    return found


def is_pushed(repo: Path, sha: str) -> bool:
    """True when a remote-tracking ref holds the commit (it is on origin, so history keeps it)."""
    held = _git(repo, "branch", "-r", "--contains", sha)
    return bool(held and held.strip())
