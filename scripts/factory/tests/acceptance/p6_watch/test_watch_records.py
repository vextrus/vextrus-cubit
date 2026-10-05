"""Ticket T-WATCH (session 12, phase 6): the watcher tracks every launched session that is running, and
nothing else (the ticket's section 2, cases 1 and 2a-2f; #344's review rounds 1-3).

Every record here is written by the launcher's own writer: `launch._Run.write` (or `_Run.refuse`) for a
cloud launch, `local.write_record` for a local one. `watch.track` is driven through `watch.Pass` over
two passes, exactly as `watch.run_pass` drives it, with `read_head` and `leak_scan` replaced. There is
no wall clock: every record and pass time is pinned below.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import governor, launch, local, watch

# The cloud launcher writes `started_at` with microseconds (`isoformat()`); these must not be zero.
STARTED = datetime(2026, 10, 5, 3, 42, 44, 196170, tzinfo=UTC)
SINCE = datetime(2026, 10, 5, tzinfo=UTC)
TREE = "f" * 40
MAIN = "b" * 40
PLAIN = "factory: work in progress\n"
ACCEPTANCE = "acceptance: T-X pins the watcher\n\nred-on-main: 1 failed\ngreen-on-throwaway: 1 passed\n"
READY = f"factory: done\n\nFactory-State: READY\nFactory-Verify: {TREE} ok\n"


def cloud(
    folder: Path,
    ticket: str,
    branch: str,
    *,
    minutes: int = 0,
    role: str = "builder",
    budget: int | None = None,
    verdict: launch.Verdict | None = None,
    stop_sent: bool = False,
) -> dict[str, Any]:
    """One cloud record, written by the cloud launcher's own `_Run.write`; returns what it wrote."""
    request = launch.CloudRequest(
        branch=branch,
        prompt_file=folder / "prompt.md",
        ticket=ticket,
        effort="medium",
        role=role,
        budget_minutes=budget,
    )
    run = launch._Run(
        req=request,
        record_dir=folder / "launches",
        started=STARTED + timedelta(minutes=minutes),
        snapshot=lambda: "[]",
    )
    run.write(
        verdict or launch.Verdict(True, f"cloned at {branch}", f"session_{ticket}"),
        stop_sent=stop_sent,
    )
    return newest_record(folder, ticket)


def old_local(
    folder: Path, monkeypatch: pytest.MonkeyPatch, ticket: str, branch: str, *, minutes: int = 0
) -> dict[str, Any]:
    """One record in the older local form (no role, `judge: null`, whole seconds), written by
    `local.py`'s own record writer; returns what it wrote."""
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(folder))
    args = argparse.Namespace(
        ticket=ticket, branch=branch, role=None, effort="medium", model=None, budget_minutes=None
    )
    args.name = ticket
    allowed = governor.Verdict("local")
    local.write_record(
        args,
        (STARTED + timedelta(minutes=minutes)).replace(microsecond=0),
        allowed,
        "2.1.0",
        f"session_{ticket}",
        folder / "worktrees" / ticket,
        None,
        [],
    )
    return newest_record(folder, ticket)


def newest_record(folder: Path, ticket: str) -> dict[str, Any]:
    paths = sorted(
        path
        for path in (folder / "launches").glob(f"{ticket}-*.json")
        if not path.name.endswith(".agents.json")
    )
    loaded: dict[str, Any] = json.loads(paths[-1].read_text())
    return loaded


@dataclass
class Watched:
    """What two watcher passes saw: each pass's items (by ticket) and events, and the alarms of the
    second pass, with every head the leak scan was asked about."""

    items: list[dict[str, dict[str, Any]]] = field(default_factory=list)
    events: list[list[tuple[str, str | None, str]]] = field(default_factory=list)
    alarms: list[str] = field(default_factory=list)
    scanned: list[str] = field(default_factory=list)

    def pushes(self, head: str) -> list[str | None]:
        return [
            subject
            for events in self.events
            for kind, subject, detail in events
            if kind == "PUSH" and detail == head[:8]
        ]


def watch_twice(
    folder: Path,
    monkeypatch: pytest.MonkeyPatch,
    heads: dict[str, tuple[str, str]],
    at: tuple[int, int] = (1, 60),
) -> Watched:
    """Two passes over origin's `heads` (branch: (sha, tip message)), `at` minutes after STARTED: each
    loads the launch records and tracks every one followed, as `run_pass` does."""
    seen = Watched()
    messages = dict(heads.values())

    def read_head(branch: str, sha: str) -> tuple[str, str]:
        return messages[sha], TREE

    def leak_scan(head: str, main_sha: str | None) -> dict[str, Any]:
        seen.scanned.append(head)
        return {"result": "clean"}

    monkeypatch.setattr(watch, "read_head", read_head)
    monkeypatch.setattr(watch, "leak_scan", leak_scan)
    refs = {"main": MAIN} | {branch: sha for branch, (sha, _) in heads.items()}
    state: dict[str, Any] = {"schema": 1, "alarms": {}, "tickets": {}}
    for minutes in at:
        step = watch.Pass(folder, STARTED + timedelta(minutes=minutes), state)
        records, _ = watch.load_launches(folder, SINCE)
        items = {
            ticket: watch.track(step, ticket, record, refs, MAIN, [], None)
            for ticket, record in sorted(records.items())
        }
        seen.items.append(items)
        seen.events.append(list(step.events))
        seen.alarms = [code for code, _, _ in step.alarms.values()]
    return seen


# --- case 1
def test_a_cloud_builders_record_is_followed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 1: the cloud launcher's `started_at` carries microseconds, and its builder is followed."""
    record = cloud(tmp_path, "T-A", "s12-a")
    head = "a" * 40

    seen = watch_twice(tmp_path, monkeypatch, {"s12-a": (head, PLAIN)})

    assert "." in record["started_at"]
    assert [sorted(items) for items in seen.items] == [["T-A"], ["T-A"]]
    assert seen.items[1]["T-A"]["branch"] == "s12-a"
    assert seen.items[1]["T-A"]["head"] == head
    assert seen.pushes(head) == ["T-A"]
    assert seen.scanned == [head]


# --- case 2a
def test_an_acceptance_writer_is_done_at_its_acceptance_commit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Case 2a: a writer has no Factory-State trailer; its work ends at its `acceptance:` commit, so it
    is `done` there and raises no BUILDER-QUIET or BUDGET-PASSED, while its push still raises PUSH and
    its cloud head is leak-scanned."""
    cloud(tmp_path, "T-X-writer", "s12-x", role="acceptance-writer", budget=20)
    head = "c" * 40

    seen = watch_twice(tmp_path, monkeypatch, {"s12-x": (head, ACCEPTANCE)}, at=(1, 60))

    assert "T-X-writer" in seen.items[1]
    assert seen.items[1]["T-X-writer"]["state"] == "done"
    assert seen.pushes(head) == ["T-X-writer"]
    assert seen.scanned == [head]
    assert "BUILDER-QUIET" not in seen.alarms
    assert "BUDGET-PASSED" not in seen.alarms


# --- case 2b
def test_a_writer_is_not_followed_once_a_builder_starts_on_its_branch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Case 2b: once a builder starts on the writer's branch, the builder alone follows it: one item
    and one PUSH per head."""
    cloud(tmp_path, "T-X-writer", "s12-x", role="acceptance-writer")
    cloud(tmp_path, "T-X", "s12-x", minutes=20)
    head = "d" * 40

    seen = watch_twice(tmp_path, monkeypatch, {"s12-x": (head, ACCEPTANCE)}, at=(21, 40))

    assert [sorted(items) for items in seen.items] == [["T-X"], ["T-X"]]
    assert seen.pushes(head) == ["T-X"]
    assert seen.scanned == [head]


# --- case 2c
def test_a_launch_refused_before_its_session_started_is_never_followed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Case 2c: a launch refused before any session started (`session_id` null; here the governor's
    refusal, through the launcher's own `refuse`) is never followed; a running builder beside it is."""
    cloud(tmp_path, "T-S", "s12-s")
    request = launch.CloudRequest(
        branch="s12-r", prompt_file=tmp_path / "prompt.md", ticket="T-R", effort="medium"
    )
    refused = launch._Run(
        req=request,
        record_dir=tmp_path / "launches",
        started=STARTED + timedelta(minutes=5),
        snapshot=lambda: "[]",
    )
    refused.refuse("governor", "usage over the hold")
    running, stale = "e" * 40, "1" * 40

    seen = watch_twice(tmp_path, monkeypatch, {"s12-s": (running, PLAIN), "s12-r": (stale, PLAIN)})

    assert newest_record(tmp_path, "T-R")["session_id"] is None
    assert [sorted(items) for items in seen.items] == [["T-S"], ["T-S"]]
    assert seen.pushes(stale) == []
    assert seen.scanned == [running]


# --- case 2d
def test_a_launch_the_judge_refused_after_its_session_started_is_followed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Case 2d: a launch the judge refused after its session started, with no STOP sent, keeps running
    (launch-cli.md; issue #343's false "bundled" judgement), so it is followed: its push raises PUSH
    and READY, and its cloud head is leak-scanned."""
    judged = launch.Verdict(
        False, "bundled, not cloned (x): the session has no origin", "session_01Run", "bundled"
    )
    record = cloud(tmp_path, "T-D", "s12-d", verdict=judged, stop_sent=False)
    head = "2" * 40

    seen = watch_twice(tmp_path, monkeypatch, {"s12-d": (head, READY)})

    assert record["judge"]["ok"] is False
    assert record["session_id"] == "session_01Run"
    assert "T-D" in seen.items[0]
    assert seen.items[0]["T-D"]["branch"] == "s12-d"
    assert seen.pushes(head) == ["T-D"]
    assert ("READY", "T-D", head[:8]) in seen.events[0]
    assert seen.scanned == [head]


# --- case 2e
def test_a_refused_relaunch_whose_stop_was_sent_never_replaces_the_running_builder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Case 2e: a refused relaunch of a running builder's ticket, its STOP sent, is newer but never
    replaces the running builder's record: the running builder's branch is kept."""
    cloud(tmp_path, "T-S", "s12-s")
    wrong = launch.Verdict(
        False,
        "cloned at revision main, not the ticket's branch s12-other",
        "session_02Stopped",
        "wrong-revision",
    )
    cloud(tmp_path, "T-S", "s12-other", minutes=5, verdict=wrong, stop_sent=True)
    running, other = "3" * 40, "4" * 40

    seen = watch_twice(
        tmp_path,
        monkeypatch,
        {"s12-s": (running, PLAIN), "s12-other": (other, PLAIN)},
        at=(6, 7),
    )

    assert [sorted(items) for items in seen.items] == [["T-S"], ["T-S"]]
    assert seen.items[1]["T-S"]["branch"] == "s12-s"
    assert seen.items[1]["T-S"]["head"] == running
    assert seen.pushes(other) == []
    assert seen.scanned == [running]


# --- case 2f
def test_a_record_in_the_older_local_form_is_a_builder_and_is_followed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Case 2f: a writer's or a builder's record in the older local form (no role, `judge: null`, whole
    seconds) is a builder and is followed, beside the cloud launcher's records in the same folder: an
    `acceptance:` head does not make it `done`."""
    writer = old_local(tmp_path, monkeypatch, "T-M-writer", "s12-m")
    builder = old_local(tmp_path, monkeypatch, "T-L", "s12-l", minutes=1)
    cloud(tmp_path, "T-C", "s12-c", minutes=2)
    m, ell, c = "5" * 40, "6" * 40, "7" * 40

    seen = watch_twice(
        tmp_path,
        monkeypatch,
        {"s12-m": (m, ACCEPTANCE), "s12-l": (ell, PLAIN), "s12-c": (c, PLAIN)},
        at=(3, 10),
    )

    for record in (writer, builder):
        assert record["role"] is None
        assert record["judge"] is None
        assert "." not in record["started_at"]
    assert [sorted(items) for items in seen.items] == [["T-C", "T-L", "T-M-writer"]] * 2
    assert seen.items[1]["T-M-writer"]["state"] != "done"
    assert seen.pushes(m) == ["T-M-writer"]
    assert seen.pushes(ell) == ["T-L"]
    assert seen.pushes(c) == ["T-C"]
    assert seen.scanned == [c]
