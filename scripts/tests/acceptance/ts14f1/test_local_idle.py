"""Ticket S14-F1, issue #448: the LOCAL-IDLE alarm.

The authority (issue #448, "Fix" and "Acceptance check"):
- "New alarm `LOCAL-IDLE`: a local builder with a new commit whose `claude agents` row has been
  idle for 10 minutes, with no READY or BLOCKED, raises it."
- "a local builder idle 10 minutes after a commit raises LOCAL-IDLE."

Pinned at the watcher's boundary: the events.log line `<UTC> LOCAL-IDLE <ticket> <detail>` (watch.py's
one line per change; an alarm is edge-triggered, one line when raised and none while it holds). Not
pinned: the detail's words (the issue gives none), and how the watcher measures the 10 minutes (from
the commit, from the first idle reading, or from the first sight of the commit: the commit is made at
the first pass's time, so each gives the same answer). The `claude agents --json --all` row is a live
one (`pid` set) whose `status` is `idle`, as `claude agents` prints it (`busy` while a turn runs), its
`state` `done` (a turn finished).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14f1._world import NOW, TABLE, World, at, plain


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def local_builder(world: World, ticket: str) -> tuple[str, str]:
    """A local builder launched at origin's tip of its branch; returns (its name, that tip)."""
    branch = f"{ticket}-branch"
    name = world.launch_local(ticket, branch)
    return name, world.push(branch, plain)


def test_a_local_builder_idle_ten_minutes_after_a_commit_raises_one_local_idle(world: World) -> None:
    name, launch_tip = local_builder(world, "ti1")
    world.agents((name, "done", "idle"))
    world.commit_local("ti1-branch", plain, launch_tip)  # made at NOW

    world.once(NOW)
    assert world.events("COMMIT", "ti1"), world.lines()
    assert world.events("LOCAL-IDLE", "ti1") == [], world.lines()
    world.once(at(5))
    assert world.events("LOCAL-IDLE", "ti1") == [], world.lines()  # 5 minutes: not yet
    world.once(at(11))
    world.once(at(12))  # still idle: the alarm holds, no second line

    assert len(world.events("LOCAL-IDLE", "ti1")) == 1, world.lines()


def test_local_idle_is_not_raised_for_a_builder_whose_turn_is_running(world: World) -> None:
    idle_name, idle_tip = local_builder(world, "ti2")
    busy_name, busy_tip = local_builder(world, "ti3")
    world.agents((idle_name, "done", "idle"), (busy_name, "working", "busy"))
    world.commit_local("ti2-branch", plain, idle_tip)
    world.commit_local("ti3-branch", plain, busy_tip)

    world.once(NOW)
    world.once(at(11))

    assert len(world.events("LOCAL-IDLE", "ti2")) == 1, world.lines()
    assert world.events("LOCAL-IDLE", "ti3") == [], world.lines()


def test_local_idle_is_not_raised_for_a_builder_that_finished_ready_or_blocked(world: World) -> None:
    names = {}
    tips = {}
    for ticket in ("ti4", "ti5", "ti6"):
        names[ticket], tips[ticket] = local_builder(world, ticket)
    world.agents(*((names[t], "done", "idle") for t in ("ti4", "ti5", "ti6")))
    world.commit_local("ti4-branch", plain, tips["ti4"])
    world.commit_local("ti5-branch", TABLE["t-w317-ready"][0], tips["ti5"])
    world.commit_local("ti6-branch", TABLE["t-w317-blocked"][0], tips["ti6"])

    world.once(NOW)
    world.once(at(11))

    assert len(world.events("LOCAL-IDLE", "ti4")) == 1, world.lines()
    assert len(world.events("READY", "ti5")) == 1, world.lines()
    assert len(world.events("BLOCKED", "ti6")) == 1, world.lines()
    assert world.events("LOCAL-IDLE", "ti5") == [], world.lines()
    assert world.events("LOCAL-IDLE", "ti6") == [], world.lines()
