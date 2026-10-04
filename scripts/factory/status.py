"""The factory's shared clock and paths, and the one writer of `status.json`.

`status.json` follows `docs/specs/factory/contracts/status.schema.json`: `scripts/factory/watch.py`
builds it every pass and writes it here, atomically (a temp file in the same folder, renamed over the
old one), so the status line and the band never read half a file. Every factory module takes its time
from `now()` (`VEXTRUS_NOW`, the tests' clock, else the real UTC clock) and its run folder from
`factory_dir()` (`VEXTRUS_FACTORY_DIR`, else `<main checkout>/.private/work/factory`).

    python -m scripts.factory.status age

`age` reads `$VEXTRUS_FACTORY_DIR/status.json`'s `written_at` and exits 0 when it is at most 180 s old,
3 when it is older, missing or unparseable (the band's WATCHER DOWN rule), 2 on a usage error.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
MAX_AGE_SECONDS = 180
STATES = ("working", "ready", "blocked", "quiet", "done", "failed", "stopped")
REPO = Path(__file__).resolve().parents[2]

# Named exception tuples: the formatter writes a bare `except A, B:` (Python 3.14 only), and the
# watcher's script form must also compile on the machine's older `python3` (f6's watch-start.mjs).
RUN_ERRORS = (OSError, subprocess.SubprocessError)
RECORD_ERRORS = (OSError, ValueError, KeyError, TypeError)
READ_ERRORS = (OSError, ValueError)
FIELD_ERRORS = (KeyError, TypeError, ValueError)


def now() -> datetime:
    """The factory's clock: `VEXTRUS_NOW` (`2026-10-04T21:08:00Z`) when set, else the real UTC time."""
    fixed = os.environ.get("VEXTRUS_NOW")
    if fixed:
        return parse_utc(fixed)
    return datetime.now(UTC).replace(microsecond=0)


def utc(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime(UTC_FORMAT)


def parse_utc(text: str) -> datetime:
    """`2026-10-04T21:08:00Z` to an aware datetime; ValueError for any other form."""
    return datetime.strptime(text, UTC_FORMAT).replace(tzinfo=UTC)


def minutes_between(start: datetime, end: datetime) -> int:
    return max(0, int((end - start).total_seconds() // 60))


def git_common_dir(start: Path | None = None) -> Path | None:
    """The git common dir of the repository at `start` (default: the cwd); None outside one."""
    done = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=start or Path.cwd(),
        capture_output=True,
        text=True,
        check=False,
    )
    if done.returncode != 0 or not done.stdout.strip():
        return None
    return Path(done.stdout.strip()).resolve()


def main_checkout(start: Path | None = None) -> Path | None:
    """The main checkout of the repository at `start`: its git common dir's parent, so a linked
    worktree answers with the main checkout. None outside a repository."""
    common = git_common_dir(start)
    return None if common is None else common.parent


def factory_dir() -> Path:
    """`VEXTRUS_FACTORY_DIR`, else `<main checkout of this script's repo>/.private/work/factory`."""
    chosen = os.environ.get("VEXTRUS_FACTORY_DIR")
    if chosen:
        return Path(chosen)
    return (main_checkout(REPO) or REPO) / ".private" / "work" / "factory"


def pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        pass
    return Path(f"/proc/{pid}").exists()


def read_pidfile(path: Path) -> int | None:
    try:
        text = path.read_text().strip()
    except OSError:
        return None
    return int(text) if text.isdigit() else None


def live_pid(path: Path) -> int | None:
    """The pid a pidfile names when that process is alive, else None."""
    pid = read_pidfile(path)
    return pid if pid is not None and pid_alive(pid) else None


def write_atomic(path: Path, payload: Mapping[str, Any]) -> None:
    """Write `payload` as JSON to `path` through `<path>.tmp` and a rename. The payload is serialised
    before any file is touched, so a payload that is not JSON raises and leaves `path` as it was."""
    text = json.dumps(payload, indent=1, sort_keys=False, allow_nan=False) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    try:
        temp.write_text(text)
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def builder_group(items: Iterable[Mapping[str, Any]], where: str) -> dict[str, Any]:
    """The schema's `builderGroup`: the tally of `items` of one `where`, and the longest quiet time."""
    group: dict[str, Any] = dict.fromkeys(STATES, 0)
    quiet: list[int] = []
    for item in items:
        if item["where"] != where:
            continue
        group[item["state"]] += 1
        if item["state"] == "quiet" and item["quiet_minutes"] is not None:
            quiet.append(int(item["quiet_minutes"]))
    group["quiet_max_minutes"] = max(quiet) if quiet else None
    return group


def build(
    *,
    written_at: datetime,
    watcher: Mapping[str, Any],
    clock: Mapping[str, Any],
    resources: Mapping[str, Any],
    lock: Mapping[str, Any],
    items: list[dict[str, Any]],
    reviews: list[dict[str, Any]],
    g1_main: Mapping[str, Any] | None,
    usage: Mapping[str, Any] | None,
    alarms: list[dict[str, Any]],
) -> dict[str, Any]:
    """The whole `status.json` object, keys in the schema's order."""
    return {
        "schema_version": 1,
        "written_at": utc(written_at),
        "watcher": dict(watcher),
        "clock": dict(clock),
        "resources": dict(resources),
        "lock": dict(lock),
        "builders": {
            "cloud": builder_group(items, "cloud"),
            "local": builder_group(items, "local"),
            "items": items,
        },
        "reviews": reviews,
        "g1": {"main": None if g1_main is None else dict(g1_main)},
        "usage": None if usage is None else dict(usage),
        "alarms": alarms,
    }


def age_seconds(path: Path, at: datetime) -> float | None:
    """Seconds since `status.json`'s `written_at`; None when missing or unparseable."""
    try:
        loaded = json.loads(path.read_text())
        written = parse_utc(loaded["written_at"])
    except RECORD_ERRORS:
        return None
    return (at - written).total_seconds()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.status", description=__doc__)
    parser.add_argument("command", choices=["age"])
    parser.parse_args(argv)
    age = age_seconds(factory_dir() / "status.json", now())
    if age is None:
        print("status.json: missing or unreadable (WATCHER DOWN)")
        return 3
    if age > MAX_AGE_SECONDS:
        print(f"status.json: {int(age)} s old (WATCHER DOWN)")
        return 3
    print(f"status.json: {int(age)} s old")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
