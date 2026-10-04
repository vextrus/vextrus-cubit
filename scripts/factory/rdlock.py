"""The real-drawing lock: one lock and one visible queue (spec 2.2 "Real-drawing lock").

    python -m scripts.factory.rdlock acquire --kind K --head SHA [--pid N] [--ticket T] [--no-block]
    python -m scripts.factory.rdlock release --kind K --head SHA [--pid N]
    python -m scripts.factory.rdlock status
    python -m scripts.factory.rdlock run --kind K --head SHA [--ticket T] -- <command...>

Kinds, in priority order: `posting` > `scored` > `no-post`; first in, first out within a kind. The state
is `$VEXTRUS_FACTORY_DIR/rdlock.json`: `{"holder": <entry> | null, "waiters": [<entry>, ...]}`, an entry
being `{"kind", "head", "ticket", "pid", "since"}`, the waiters kept in queue order. Every change is made
under an exclusive `flock` of `rdlock.json.lock`.

`acquire` takes the lock when it is free and no waiter ranks before the caller (exit 0); otherwise the
caller joins the queue, or keeps its place (exit 4 with `--no-block`; without it, it waits and asks
again every 5 s). A second waiter for the same head and kind under another pid is refused (exit 5).
A holder or waiter whose pid is dead is dropped. `release` frees the lock, or leaves the queue.

`run` acquires (waiting), writes `$VEXTRUS_FACTORY_DIR/rd.pid` (the governor's and orchestrator.sh's
sign of a running real-drawing run), runs the command with its output unbuffered into
`$VEXTRUS_FACTORY_DIR/../rd/<head8>-<kind>-<UTC>.log`, and releases the lock and removes `rd.pid` when
the command ends, failed or not. It exits with the command's code.

Exit 0, 4 queued, 5 a duplicate waiter, 2 usage error.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from scripts.factory import status

KINDS = ("posting", "scored", "no-post")
RANK = {kind: rank for rank, kind in enumerate(KINDS)}
WAIT_SECONDS = 5.0
HELD, QUEUED, DUPLICATE = 0, 4, 5


def lock_file() -> Path:
    return status.factory_dir() / "rdlock.json"


@contextmanager
def locked() -> Iterator[dict[str, Any]]:
    """The queue, read and written back under an exclusive flock; dead pids dropped."""
    path = lock_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.with_name(path.name + ".lock").open("a") as guard:
        fcntl.flock(guard, fcntl.LOCK_EX)
        try:
            queue = json.loads(path.read_text())
        except FileNotFoundError:
            queue = {"holder": None, "waiters": []}
        except ValueError as error:
            raise SystemExit(f"rdlock: {path} is unreadable: {error}") from error
        holder = queue.get("holder")
        if holder is not None and not status.pid_alive(int(holder.get("pid", 0))):
            queue["holder"] = None
        queue["waiters"] = [
            w for w in queue.get("waiters", []) if status.pid_alive(int(w.get("pid", 0)))
        ]
        yield queue
        status.write_atomic(path, queue)


def same(entry: dict[str, Any] | None, kind: str, head: str) -> bool:
    return entry is not None and entry.get("kind") == kind and entry.get("head") == head


def enqueue(waiters: list[dict[str, Any]], entry: dict[str, Any]) -> None:
    """After every waiter of the same or a higher priority (first in, first out within a kind)."""
    at = len(waiters)
    for index, waiter in enumerate(waiters):
        if RANK[waiter["kind"]] > RANK[entry["kind"]]:
            at = index
            break
    waiters.insert(at, entry)


def try_acquire(kind: str, head: str, pid: int, ticket: str | None) -> int:
    with locked() as queue:
        holder = queue["holder"]
        if same(holder, kind, head) and holder["pid"] == pid:
            return HELD
        waiters: list[dict[str, Any]] = queue["waiters"]
        mine = next((w for w in waiters if same(w, kind, head)), None)
        if mine is not None and mine["pid"] != pid:
            return DUPLICATE
        if mine is None:
            if same(holder, kind, head):
                return DUPLICATE
            mine = {
                "kind": kind,
                "head": head,
                "ticket": ticket,
                "pid": pid,
                "since": status.utc(status.now()),
            }
            enqueue(waiters, mine)
        if holder is None and waiters[0] is mine:
            waiters.pop(0)
            mine["since"] = status.utc(status.now())
            queue["holder"] = mine
            return HELD
        return QUEUED


def acquire(kind: str, head: str, pid: int, ticket: str | None, block: bool) -> int:
    while True:
        code = try_acquire(kind, head, pid, ticket)
        if code != QUEUED or not block:
            return code
        time.sleep(WAIT_SECONDS)


def release(kind: str, head: str, pid: int) -> bool:
    with locked() as queue:
        if same(queue["holder"], kind, head) and queue["holder"]["pid"] == pid:
            queue["holder"] = None
            return True
        before = len(queue["waiters"])
        queue["waiters"] = [w for w in queue["waiters"] if not (same(w, kind, head) and w["pid"] == pid)]
        return len(queue["waiters"]) != before


def describe(entry: dict[str, Any]) -> str:
    ticket = entry.get("ticket") or "-"
    return f"{entry['kind']} {entry['head'][:8]} {ticket} pid {entry['pid']} since {entry['since']}"


def show() -> list[str]:
    with locked() as queue:
        lines = ["holder: " + (describe(queue["holder"]) if queue["holder"] else "none")]
        lines += [f"waiter {n}: {describe(w)}" for n, w in enumerate(queue["waiters"], start=1)]
    return lines


def run(kind: str, head: str, ticket: str | None, command: list[str]) -> int:
    pid = os.getpid()
    acquire(kind, head, pid, ticket, block=True)
    folder = status.factory_dir()
    pidfile = folder / "rd.pid"
    logs = folder.parent / "rd"
    logs.mkdir(parents=True, exist_ok=True)
    log = logs / f"{head[:8]}-{kind}-{status.now().strftime('%Y%m%dT%H%M%SZ')}.log"
    try:
        pidfile.write_text(f"{pid}\n")
        env = dict(os.environ, PYTHONUNBUFFERED="1")
        with log.open("ab", buffering=0) as out:
            done = subprocess.run(
                command, stdout=out, stderr=out, stdin=subprocess.DEVNULL, env=env, check=False
            )
        print(f"rdlock: exit {done.returncode}; log {log}")
        return done.returncode
    finally:
        if status.read_pidfile(pidfile) == pid:
            pidfile.unlink(missing_ok=True)
        release(kind, head, pid)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m scripts.factory.rdlock", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("acquire", "release", "run"):
        one = sub.add_parser(name)
        one.add_argument("--kind", required=True, choices=KINDS)
        one.add_argument("--head", required=True)
        if name != "run":
            one.add_argument("--pid", type=int, default=os.getppid())
        if name != "release":
            one.add_argument("--ticket")
        if name == "acquire":
            one.add_argument("--no-block", action="store_true")
        if name == "run":
            one.add_argument("argv", nargs=argparse.REMAINDER)
    sub.add_parser("status")
    args = parser.parse_args(argv)
    if args.command == "status":
        print("\n".join(show()))
        return 0
    if not re.fullmatch(r"[0-9a-f]{7,40}", args.head):
        parser.error(f"--head {args.head!r} is not a sha")
    if args.command == "acquire":
        code = acquire(args.kind, args.head, args.pid, args.ticket, block=not args.no_block)
        print(
            {HELD: "held", QUEUED: "queued", DUPLICATE: "refused: a waiter has this head and kind"}[code]
        )
        return code
    if args.command == "release":
        print("released" if release(args.kind, args.head, args.pid) else "nothing to release")
        return 0
    command = args.argv[1:] if args.argv[:1] == ["--"] else args.argv
    if not command:
        parser.error("run needs a command after --")
    return run(args.kind, args.head, args.ticket, command)


if __name__ == "__main__":
    sys.exit(main())
