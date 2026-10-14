"""S27-W835 fix round 1: after `stamp end` (no session.json) the start of the last ended session, kept in
`measures-<started>.json`, stands in for the session's start. A PR-less launch of the session before it,
started less than 24 h ago, stays silent: no BUDGET-PASSED, BUILDER-QUIET or builders row."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.factory.tests.acceptance.ts26fx1._world import LATER, NOW, World, plain

ENDED_START = "2026-10-04T10:00:00Z"  # the session that ended
BEFORE_IT = "2026-10-04T08:00:00Z"  # a launch of the session before, 13 h before NOW


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def make(world: World, ticket: str, started: str) -> None:
    world.launch_cloud(ticket, f"{ticket}-branch", started_at=started)
    [path] = (world.factory / "launches").glob(f"{ticket}-*.json")
    record = json.loads(path.read_text())
    record["budget_minutes"] = 5
    path.write_text(json.dumps(record))
    world.push(f"{ticket}-branch", plain)


def test_a_recent_launch_before_the_ended_session_stays_silent(world: World) -> None:
    make(world, "fprev", BEFORE_IT)
    (world.factory / "measures-20261004T100000Z.json").write_text(
        json.dumps({"started_utc": ENDED_START, "measures": {}})
    )
    assert not (world.factory / "session.json").exists()
    world.once(NOW)
    world.once(LATER)
    assert [line for line in world.lines() if " fprev " in line] == []
    assert world.items("fprev") == []


def test_with_no_ended_session_known_a_launch_older_than_24h_stays_silent(world: World) -> None:
    make(world, "fprev", "2026-10-03T08:00:00Z")
    world.once(NOW)
    world.once(LATER)
    assert [line for line in world.lines() if " fprev " in line] == []
    assert world.items("fprev") == []
