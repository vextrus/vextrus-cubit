"""Ticket f3, 3.9 (tier 2, cut 1): the real-drawing lock's visible queue (`python -m
scripts.factory.rdlock`), spec 2.2 "Real-drawing lock".

    rdlock acquire --kind posting|scored|no-post --head <sha> --pid N --no-block
                   exit 0 holds the lock, 4 queued (or still queued), 5 a second waiter for the same head
                   and kind
    rdlock release --kind K --head H --pid N
    rdlock status  lists the holder and the waiters in queue order
    rdlock run --kind K --head H -- <command...>

The queue lives in `$VEXTRUS_FACTORY_DIR/rdlock.json` (`holder`, `waiters`; each entry has at least
`head` and `kind`, and `since`). Priority posting > scored > no-post, first in first out within a
kind: a waiter that calls `acquire` again (same head, kind and pid) gets the lock only when nothing
ranks before it. A holder whose pid is dead is reclaimed. `run` holds the lock while its command
runs, writes `$VEXTRUS_FACTORY_DIR/rd.pid`, keeps the output unbuffered in
`$VEXTRUS_FACTORY_DIR/../rd/<head8>-<kind>-*.log` and releases on failure too.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-04T21:08:00Z"
LIVE = str(os.getpid())


def head(n: int) -> str:
    return f"{n:02d}" * 20


class Lock:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.factory = tmp / "work" / "factory"
        self.factory.mkdir(parents=True)

    def run(self, *args: str) -> subprocess.CompletedProcess[str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(PYTHONPATH=str(REPO), VEXTRUS_FACTORY_DIR=str(self.factory), VEXTRUS_NOW=NOW)
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.rdlock", *args],
            cwd=self.tmp,
            env=env,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def acquire(self, kind: str, sha: str, pid: str = LIVE) -> int:
        done = self.run("acquire", "--kind", kind, "--head", sha, "--pid", pid, "--no-block")
        assert "No module named" not in done.stderr, show(done)
        return done.returncode

    def release(self, kind: str, sha: str, pid: str = LIVE) -> None:
        done = self.run("release", "--kind", kind, "--head", sha, "--pid", pid)
        assert done.returncode == 0, show(done)

    def state(self) -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads((self.factory / "rdlock.json").read_text())
        return loaded

    def holder(self) -> str | None:
        holder = self.state().get("holder")
        return None if holder is None else str(holder["head"])

    def waiters(self) -> list[str]:
        return [str(entry["head"]) for entry in self.state()["waiters"]]


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def dead_pid() -> str:
    finished = subprocess.Popen(["true"])
    finished.wait()
    return str(finished.pid)


@pytest.fixture
def lock(tmp_path: Path) -> Lock:
    return Lock(tmp_path)


# R1
def test_r1_a_second_acquire_while_held_is_queued_and_status_shows_the_queue(lock: Lock) -> None:
    assert lock.acquire("posting", head(1)) == 0
    assert lock.acquire("scored", head(2)) == 4
    assert lock.acquire("posting", head(3)) == 4
    assert lock.holder() == head(1)
    assert lock.waiters() == [head(3), head(2)]
    status = lock.run("status")
    assert status.returncode == 0, show(status)
    assert status.stdout.index(head(3)[:8]) < status.stdout.index(head(2)[:8]), show(status)


# R2
def test_r2_posting_before_scored_before_no_post_first_in_first_out_within_a_kind(lock: Lock) -> None:
    assert lock.acquire("posting", head(1)) == 0
    queued = [("no-post", head(2)), ("scored", head(3)), ("posting", head(4)), ("scored", head(5))]
    queued.append(("posting", head(6)))
    for kind, sha in queued:
        assert lock.acquire(kind, sha) == 4
    assert lock.waiters() == [head(4), head(6), head(3), head(5), head(2)]

    lock.release("posting", head(1))
    assert lock.acquire("scored", head(3)) == 4, "a scored run jumped two posting runs"
    assert lock.acquire("posting", head(4)) == 0
    lock.release("posting", head(4))
    assert lock.acquire("no-post", head(2)) == 4
    assert lock.acquire("posting", head(6)) == 0
    lock.release("posting", head(6))
    assert lock.acquire("scored", head(5)) == 4, "first in, first out within scored"
    assert lock.acquire("scored", head(3)) == 0
    assert lock.waiters() == [head(5), head(2)]


# R3
def test_r3_a_second_waiter_for_the_same_head_and_kind_is_refused(lock: Lock) -> None:
    assert lock.acquire("posting", head(1)) == 0
    assert lock.acquire("scored", head(2)) == 4
    assert lock.acquire("scored", head(2), pid=str(os.getppid())) == 5
    assert lock.waiters() == [head(2)]


# R4
def test_r4_a_holder_whose_pid_is_dead_is_reclaimed(lock: Lock) -> None:
    assert lock.acquire("posting", head(1), pid=dead_pid()) == 0
    assert lock.acquire("scored", head(2)) == 0
    assert lock.holder() == head(2)


# R5
RUN = """
import os, sys
from pathlib import Path
pidfile = Path(os.environ["VEXTRUS_FACTORY_DIR"]) / "rd.pid"
print("hello from the run", flush=True)
print("rdpid=" + (pidfile.read_text().strip() if pidfile.exists() else "missing"), flush=True)
sys.exit(int(sys.argv[1]))
"""


@pytest.mark.parametrize("code", [0, 1])
def test_r5_run_holds_the_lock_logs_unbuffered_and_releases_even_on_failure(
    lock: Lock, code: int
) -> None:
    sha = head(7)
    done = lock.run(
        "run", "--kind", "posting", "--head", sha, "--", sys.executable, "-c", RUN, str(code)
    )
    assert "No module named" not in done.stderr, show(done)
    assert (done.returncode == 0) == (code == 0), show(done)
    logs = sorted((lock.factory.parent / "rd").glob(f"{sha[:8]}-posting-*.log"))
    assert len(logs) == 1, show(done)
    text = logs[0].read_text()
    assert "hello from the run" in text
    assert "rdpid=" in text
    assert text.split("rdpid=")[1].split()[0].isdigit(), text
    assert lock.holder() is None
    assert lock.acquire("scored", head(8)) == 0
