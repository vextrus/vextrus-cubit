"""Ticket S27-W835 (#835): with no active session the watcher follows no stale launch record.

Seen at session 26's close: once `stamp end` removed `session.json`, the watcher read every launch record
back to session 13 as a carried-over live launch and wrote ~80 READY-WAITING / BUDGET-PASSED /
BUILDER-QUIET lines (and an 80-row builders table) for the factory mod to wake the orchestrator with.

The promise (#835's owed check): "with no active session, or for a launch whose ticket has no open PR and
no live session, the watcher emits nothing (a watch test with a closed session and old records)".
Here: with no `session.json` (the state `stamp end` leaves), launch records of earlier sessions whose
branch has no PR, or only a PR that closed or merged, give no events.log line naming their ticket and no
`builders.items` row in status.json. S26-FX1's rule stays: during a session, a launch of an earlier
session whose branch has an OPEN PR is followed.

Not pinned: what the watcher does with no session for a launch whose branch has an OPEN PR (the
fixture has one; neither following it nor dropping it is asserted).
Black-box: the watcher runs as a subprocess (`ts26fx1._world.World`).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.factory.tests.acceptance.ts26fx1._world import LATER, NOW, World, detail, plain, ready

OLD_LAUNCH = "2026-09-20T10:00:00Z"  # a launch of an earlier session (session 13's time)
CLOSED_BEFORE = "2026-09-19T09:00:00Z"  # a PR that closed before the relaunch on its branch
MERGED_AFTER = "2026-09-21T09:00:00Z"
SESSION_START = "2026-10-04T20:08:00Z"  # an hour before NOW, after every old launch

# The stale launches: none has an open PR and none is of the running session.
READY_NO_PR = "fr1"  # a READY head pushed, no PR ever opened
QUIET_NO_PUSH = "fq1"  # never pushed, no PR
OVER_BUDGET = "fb1"  # a ticket budget long passed, no PR
CLOSED_PR = "fc1"  # relaunched after its branch's PR closed, a READY head, no new PR
MERGED_PR = "fm1"  # its branch's PR merged after it started
STALE = (READY_NO_PR, QUIET_NO_PUSH, OVER_BUDGET, CLOSED_PR, MERGED_PR)
OPEN_PR = "fo1"  # an earlier session's launch whose branch's PR is still open


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def pr_row(number: int, branch: str, state: str, head: str | None, **times: str) -> dict[str, Any]:
    return {
        "number": number,
        "headRefName": branch,
        "headRefOid": head,
        "state": state,
        "statusCheckRollup": [],
        **times,
    }


def set_budget(world: World, ticket: str, minutes: int) -> None:
    """The launch record's ticket budget (`launch_cloud` writes none)."""
    [path] = (world.factory / "launches").glob(f"{ticket}-*.json")
    record = json.loads(path.read_text())
    record["budget_minutes"] = minutes
    path.write_text(json.dumps(record))


def old_records(world: World) -> str:
    """Launch records of an earlier session: the five stale ones and one with an open PR. Returns the
    open-PR launch's head."""
    for ticket in (*STALE, OPEN_PR):
        world.launch_cloud(ticket, f"{ticket}-branch", started_at=OLD_LAUNCH)
    set_budget(world, OVER_BUDGET, 5)
    world.push(f"{READY_NO_PR}-branch", ready)
    world.push(f"{OVER_BUDGET}-branch", plain)
    closed = world.push(f"{CLOSED_PR}-branch", ready)
    merged = world.push(f"{MERGED_PR}-branch", ready)
    open_head = world.push(f"{OPEN_PR}-branch", plain)
    rows = [
        pr_row(11, f"{CLOSED_PR}-branch", "CLOSED", closed, closedAt=CLOSED_BEFORE),
        pr_row(12, f"{MERGED_PR}-branch", "MERGED", merged, mergedAt=MERGED_AFTER),
        pr_row(13, f"{OPEN_PR}-branch", "OPEN", open_head),
    ]
    world.seams["prs"].write_text(json.dumps(rows))
    return open_head


def stale_lines(world: World) -> list[str]:
    return [line for line in world.lines() if line.split(" ")[2:3] and line.split(" ")[2] in STALE]


def stale_items(world: World) -> list[str]:
    return [item["ticket"] for ticket in STALE for item in world.items(ticket)]


def test_with_no_session_the_watcher_writes_no_event_for_a_stale_launch(world: World) -> None:
    old_records(world)
    assert not (world.factory / "session.json").exists()  # the state `stamp end` leaves
    world.once(NOW)
    world.once(LATER)

    found = stale_lines(world)
    assert found == [], f"W835 no session: events for stale launches: {found}"


@pytest.mark.parametrize("kind", ["READY-WAITING", "BUDGET-PASSED", "BUILDER-QUIET", "READY", "PUSH"])
def test_with_no_session_no_stale_launch_raises_the_alarm(world: World, kind: str) -> None:
    old_records(world)
    world.once(NOW)
    world.once(LATER)

    found = [line for line in world.events(kind) if line.split(" ")[2] in STALE]
    assert found == [], f"W835 no session: a {kind} for a stale launch: {found}"


def test_with_no_session_the_builders_table_lists_no_stale_launch(world: World) -> None:
    old_records(world)
    world.once(NOW)
    world.once(LATER)

    listed = stale_items(world)
    assert listed == [], f"W835 no session: builders.items lists stale launches: {listed}"


def test_during_a_session_stale_launches_stay_silent_and_an_open_pr_launch_is_followed(
    world: World,
) -> None:
    open_head = old_records(world)
    world.session(SESSION_START)
    world.once(NOW)
    head = world.push(f"{OPEN_PR}-branch", ready, open_head)
    rows = json.loads(world.seams["prs"].read_text())
    for row in rows:
        if row["headRefName"] == f"{OPEN_PR}-branch":
            row["headRefOid"] = head
    world.seams["prs"].write_text(json.dumps(rows))
    world.once(LATER)

    assert stale_lines(world) == [], f"W835 session: events for stale launches: {world.lines()}"
    assert stale_items(world) == [], f"W835 session: stale builders.items: {stale_items(world)}"
    readies = [detail(line) for line in world.events("READY", OPEN_PR)]
    assert readies == [head[:8]], f"W835 session: the open-PR launch is not followed: {world.lines()}"
