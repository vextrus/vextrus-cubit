"""Is `<ref>` walk-ready? (docs/specs/factory.md 5 "G1"; walk-verdict.schema.json's READ.)

"`scripts/walk/ready.py <ref>` passes only when the two most recent G1 verdicts on main are both PASS
with no FAIL between them, and the newer one is on `<ref>`'s current head or on an earlier head whose
diff to it touches no product path (`vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`).
A second walk on the same product code counts (a repeat)."

    python -m scripts.walk.ready <ref> [--walks-dir D] [--repo R]

Exit 0 ready, 1 not ready (one reason line), 2 unreadable or malformed input. It fails closed: it says
ready only on positive proof, and any exception exits 2, never 0.

Verdicts are `<walks_dir>/<sha40>/verdict*.json` for the shas on `<ref>`'s first-parent history. One
counts only when it validates against the contract, has `ref` "main", has `sha` equal to its folder,
and is consistent (a PASS with every check and walked item PASS, no BLOCKS or misleading finding, the
counts matching its findings, the three checks for each set). Any other verdict there (a forged or
contradictory PASS, a smoke or foreign one, a misfiled one) is never counted and stands as a not-PASS
at its time, so it can never be skipped over. A file that is not a JSON object is malformed (exit 2).
"""

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scripts.walk.sanitize import CHECK_IDS, ITEMS
from scripts.walk.schema import verdict_errors

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
    return path.startswith(PRODUCT_DIRS) or path in PRODUCT_FILES


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
    if verdict["result"] != "PASS":
        return True
    by_set: dict[str, list[str]] = {}
    for check in verdict["checks"]:
        if check["status"] != "PASS":
            return False
        by_set.setdefault(check["set"], []).append(check["check"])
    if any(sorted(names) != sorted(CHECK_IDS) for names in by_set.values()):
        return False
    items = [item["item"] for item in layer["items"]]
    return (
        sorted(items) == sorted(ITEMS)
        and all(item["status"] == "PASS" for item in layer["items"])
        and layer["blocks"] == 0
        and layer["misleading"] == 0
    )


def _read(path: Path, folder: str) -> _Entry:
    if path.is_symlink():
        raise Unreadable("a verdict is a link")
    try:
        body = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise Unreadable("a verdict is not JSON") from error
    if not isinstance(body, dict):
        raise Unreadable("a verdict is not a JSON object")
    stamp = body.get("finished_at")
    when = stamp if isinstance(stamp, str) and UTC.fullmatch(stamp) else NEWEST
    counted = (
        not verdict_errors(body) and body["ref"] == "main" and body["sha"] == folder and consistent(body)
    )
    return _Entry(
        finished_at=when,
        sha=folder,
        passed=counted and body["result"] == "PASS",
        counted=counted,
    )


def _entries(walks_dir: Path, history: set[str]) -> list[_Entry]:
    entries = []
    for folder in sorted(walks_dir.iterdir()):
        if folder.name not in history or not SHA.fullmatch(folder.name):
            continue
        if folder.is_symlink() or not folder.is_dir():
            raise Unreadable("a walk folder is not a folder")
        entries += [_read(path, folder.name) for path in sorted(folder.glob("verdict*.json"))]
    return entries


def ready(ref: str, *, walks_dir: Path, repo: Path) -> Ready:
    """Whether `ref` is walk-ready, with one reason line (shas and counts only)."""
    if ref.startswith("-"):
        raise Unreadable("a ref cannot start with a dash")
    head = _git(repo, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").strip()
    if not SHA.fullmatch(head):
        raise Unreadable("the ref is not a commit")
    history = set(_git(repo, "rev-list", "--first-parent", head).split())
    if not walks_dir.exists():
        return Ready(False, "not walk-ready: no G1 verdict on main")
    if not walks_dir.is_dir():
        raise Unreadable("the walks folder is not a folder")
    entries = _entries(walks_dir, history)
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
    if newer.sha != head:
        changed = _git(repo, "diff", "--name-only", "--no-renames", "-z", newer.sha, head)
        product = [path for path in changed.split("\0") if path and is_product_path(path)]
        if product:
            return Ready(
                False,
                f"not walk-ready: {len(product)} product path(s) changed since the walked head "
                f"{newer.sha[:8]}",
            )
    return Ready(True, f"walk-ready: two PASS verdicts on main, the newer on {newer.sha[:8]}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.walk.ready")
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
