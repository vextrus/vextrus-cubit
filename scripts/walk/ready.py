"""Is `<ref>` walk-ready? (docs/specs/factory.md 5 "G1"; walk-verdict.schema.json's READ.)

"`scripts/walk/ready.py <ref>` passes only when the two most recent G1 verdicts on main are both PASS
with no FAIL between them, and the newer one is on `<ref>`'s current head or on an earlier head whose
diff to it touches no product path (`vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`).
A second walk on the same product code counts (a repeat)."

    python -m scripts.walk.ready <ref> [--walks-dir D] [--repo R]

Exit 0 ready, 1 not ready (one reason line), 2 unreadable or malformed input. It fails closed: it says
ready only on positive proof, and any exception exits 2, never 0.

Verdicts are `<walks_dir>/<sha40>/verdict*.json`, on any head (a FAIL on a head `<ref>` lacks is
still main's newest). One counts only when it validates against the contract, has `ref` "main", has
`sha` equal to its folder, is consistent (a PASS with every check of each set and every walked item
PASS, no BLOCKS or misleading finding, counts matching its findings) and its times are possible
(started before it finished, finished after its head was committed); a byte-for-byte copy of a walk is
one walk. Any other verdict of main there (forged, contradictory, smoke, misfiled) is never counted and
stands as a not-PASS at its time, so it can never be skipped over; a sound verdict of another ref is
not main's and is left out. The newer PASS must be on `<ref>`'s first-parent history. A file that is
not a JSON object, or a walk folder named by an upper-case sha, is malformed (exit 2).
"""

import calendar
import json
import re
import subprocess
import sys
import time
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scripts.walk.cli import QuietParser
from scripts.walk.sanitize import CHECK_IDS
from scripts.walk.schema import verdict_errors
from scripts.walk.verdict import result_of, status_of

SHA = re.compile(r"[0-9a-f]{40}")
UTC = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")
PRODUCT_DIRS = ("vextrus/", "engine/", "web/src/")
PRODUCT_FILES = ("pyproject.toml", "uv.lock")
NEWEST = "9999-12-31T23:59:59Z"
"""Where a refused verdict with no readable time stands: newest of all (fail closed)."""


class Unreadable(Exception):
    """An input ready.py cannot read: it decides nothing (exit 2)."""


@dataclass(frozen=True)
class Ready:
    ok: bool
    reason: str


@dataclass(frozen=True)
class _Entry:
    finished_at: str
    sha: str
    passed: bool
    """Counted, and PASS."""
    counted: bool
    """Sound: valid, consistent, of main, filed under its own sha, its times possible."""
    walk: tuple[str, str, str, str] | None
    """(sha, started_at, finished_at, result) of a sound verdict: a copy of it is the same walk."""


def _git(repo: Path, *args: str) -> str:
    try:
        done = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Unreadable("git could not run") from error
    if done.returncode != 0:
        raise Unreadable("git refused")
    return done.stdout


def is_product_path(path: str) -> bool:
    """Under a product directory, the directory itself (a submodule's pointer), or a product file."""
    return path.startswith(PRODUCT_DIRS) or f"{path}/" in PRODUCT_DIRS or path in PRODUCT_FILES


def consistent(verdict: Mapping[str, Any]) -> bool:
    """A verdict whose own numbers agree with its result (beyond what the schema enforces)."""
    layer = verdict["agent_layer"]
    findings = layer["findings"]
    if layer["blocks"] != sum(1 for f in findings if f["severity"] == "BLOCKS"):
        return False
    if layer["misleading"] != sum(1 for f in findings if f["misleading"] is True):
        return False
    drafted = sum(1 for f in findings if f["issue"] is not None)
    comments = sum(1 for f in findings if f["dedup_comment_on"] is not None)
    if len(findings) != layer["issues_drafted"] + layer["dedup_comments"]:
        return False
    if (drafted, comments) != (layer["issues_drafted"], layer["dedup_comments"]):
        return False
    if verdict["leak_scan"].get("hits") != 0:
        return False
    rows: dict[str, list[Mapping[str, Any]]] = {}
    for row in verdict["burden"]:
        rows.setdefault(row["set"], []).append(row)
    by_set: dict[str, list[str]] = {}
    for check in verdict["checks"]:
        by_set.setdefault(check["set"], []).append(check["check"])
        # Each status must be what its own measured, expected and burden rows give (verdict.py's rule).
        if status_of(check, rows.get(check["set"], [])) != check["status"]:
            return False
    if any(sorted(names) != sorted(CHECK_IDS) for names in by_set.values()):
        return False
    if not set(rows) <= set(by_set):
        return False  # a burden row for a set no check measured
    return bool(result_of(verdict) == verdict["result"])


SKEW = 600
"""Seconds of clock skew allowed between a commit and the verdict of its walk."""
LOOSE_SHA = re.compile(r"[0-9a-fA-F]{40}")
VERDICT_NAME = re.compile(r"verdict([.-][A-Za-z0-9-]+)?\.json|smoke-verdict\.json")
"""verdict.json, verdict.<finished_at>.json (a re-walk keeps the older), or a smoke's (never read)."""


def _epoch(stamp: str) -> int:
    return calendar.timegm(time.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ"))


def _committed(repo: Path, sha: str) -> int | None:
    """The commit's committer time, or None when this repository does not have it."""
    try:
        return int(_git(repo, "show", "-s", "--format=%ct", f"{sha}^{{commit}}").strip())
    except Unreadable, ValueError:
        return None


def _times_hold(body: Mapping[str, Any], committed: int | None) -> bool:
    """Started before it finished, and finished after its head was committed."""
    started, finished = _epoch(body["started_at"]), _epoch(body["finished_at"])
    return started <= finished and (committed is None or finished >= committed - SKEW)


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    keys = [key for key, _ in pairs]
    if len(set(keys)) != len(keys):
        raise ValueError("a key twice")
    return dict(pairs)


def _no_constant(name: str) -> Any:
    raise ValueError("NaN or Infinity")


def _read(path: Path, folder: str, committed: int | None) -> _Entry | None:
    if path.is_symlink():
        raise Unreadable("a verdict is a link")
    try:
        body = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_strict_object,
            parse_constant=_no_constant,
        )
    except (OSError, UnicodeDecodeError, ValueError, RecursionError) as error:
        raise Unreadable("a verdict is not JSON") from error
    if not isinstance(body, dict):
        raise Unreadable("a verdict is not a JSON object")
    stamp = body.get("finished_at")
    when = stamp if isinstance(stamp, str) and UTC.fullmatch(stamp) else NEWEST
    sound = (
        not verdict_errors(body)
        and body["sha"] == folder
        and consistent(body)
        and _times_hold(body, committed)
    )
    if sound and body["ref"] != "main":
        return None  # another ref's walk: not one of main's verdicts
    # A PASS is counted only on a commit this repository has (its time and history can be checked).
    sound = sound and (body["result"] != "PASS" or committed is not None)
    passed = sound and body["result"] == "PASS"
    walk = (folder, str(body.get("started_at")), when, str(body.get("result"))) if sound else None
    return _Entry(finished_at=when, sha=folder, passed=passed, counted=sound, walk=walk)


def _entries(walks_dir: Path, repo: Path) -> list[_Entry]:
    """Every verdict of main under `walks_dir`, whatever its head (a copy of one walk once)."""
    entries: list[_Entry] = []
    seen: set[tuple[str, str, str, str]] = set()
    for folder in sorted(walks_dir.iterdir()):
        if not SHA.fullmatch(folder.name):
            if LOOSE_SHA.match(folder.name):
                raise Unreadable("a walk folder is named like a sha but is not one")
            continue
        if folder.is_symlink() or not folder.is_dir():
            raise Unreadable("a walk folder is not a folder")
        for path in folder.rglob("*"):
            name = path.name.lower()
            if "verdict" in name and not (path.parent == folder and VERDICT_NAME.fullmatch(path.name)):
                raise Unreadable("a verdict file is misnamed or misplaced")
        committed = _committed(repo, folder.name)
        for path in sorted(folder.glob("verdict*.json")):  # smoke-verdict.json is never read
            entry = _read(path, folder.name, committed)
            if entry is None:
                continue
            if entry.walk is not None:
                if entry.walk in seen:
                    continue  # a copy of a walk already counted is not a second walk
                seen.add(entry.walk)
            entries.append(entry)
    return entries


def _resolve(repo: Path, ref: str) -> str:
    """The ref's commit; a branch, a remote branch and a tag of one name must all name one commit."""
    found = set()
    for full in (f"refs/heads/{ref}", f"refs/remotes/{ref}", f"refs/tags/{ref}"):
        try:
            found.add(_git(repo, "rev-parse", "--verify", "--quiet", f"{full}^{{commit}}").strip())
        except Unreadable:
            continue
    if len(found) > 1:
        raise Unreadable("the ref names more than one commit")
    head = (
        found.pop()
        if found
        else _git(repo, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").strip()
    )
    if not SHA.fullmatch(head):
        raise Unreadable("the ref is not a commit")
    return head


def ready(ref: str, *, walks_dir: Path, repo: Path) -> Ready:
    """Whether `ref` is walk-ready, with one reason line (shas and counts only)."""
    if ref.startswith("-"):
        raise Unreadable("a ref cannot start with a dash")
    head = _resolve(repo, ref)
    history = set(_git(repo, "rev-list", "--first-parent", head).split())
    if not walks_dir.exists():
        return Ready(False, "not walk-ready: no G1 verdict on main")
    if not walks_dir.is_dir():
        raise Unreadable("the walks folder is not a folder")
    # Every verdict of main counts in the order, on whatever head: one the ref lacks is never skipped.
    entries = _entries(walks_dir, repo)
    # Newest first; on equal times a verdict that is not a counted PASS stands newer (fail closed).
    entries.sort(key=lambda e: (e.finished_at, not e.passed), reverse=True)
    passes = sum(1 for e in entries if e.passed)
    if len(entries) < 2 or passes < 2:
        return Ready(False, f"not walk-ready: {passes} counted PASS verdict(s) on main, 2 needed")
    newer, older = entries[0], entries[1]
    if not newer.passed:
        what = "FAIL" if newer.counted else "refused"
        return Ready(False, f"not walk-ready: the newest verdict on main ({newer.sha[:8]}) is {what}")
    if not older.passed:
        what = "a FAIL" if older.counted else "a refused verdict"
        return Ready(
            False, f"not walk-ready: {what} ({older.sha[:8]}) stands between the two newest PASSes"
        )
    if newer.sha not in history:
        return Ready(
            False,
            f"not walk-ready: newest PASS ({newer.sha[:8]}) is off the ref's first-parent history",
        )
    if newer.sha != head:
        changed = _git(
            repo,
            "diff",
            "--no-relative",
            "--no-ext-diff",
            "--name-only",
            "--no-renames",
            "-z",
            newer.sha,
            head,
        )
        product = [path for path in changed.split("\0") if path and is_product_path(path)]
        if product:
            return Ready(
                False,
                f"not walk-ready: {len(product)} product path(s) changed since the walked head "
                f"{newer.sha[:8]}",
            )
    return Ready(True, f"walk-ready: two PASS verdicts on main, the newer on {newer.sha[:8]}")


def main(argv: list[str] | None = None) -> int:
    parser = QuietParser(prog="python -m scripts.walk.ready")
    parser.add_argument("ref")
    parser.add_argument("--walks-dir", type=Path, default=Path(".private/work/walks"))
    parser.add_argument("--repo", type=Path, default=Path())
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        return 2
    try:
        answer = ready(args.ref, walks_dir=args.walks_dir, repo=args.repo)
    except Exception as error:  # fail closed: never 0 on any exception
        print(f"walk-ready: cannot decide ({type(error).__name__})")
        return 2
    print(answer.reason)
    return 0 if answer.ok else 1


if __name__ == "__main__":
    sys.exit(main())
