"""S24-A6 (session 24's brief, Wave A): "the watcher watches carried-over tickets and prunes merged
ones".

- A carried-over ticket, launched before the running session's start (`session.json`'s `started_utc`)
  and still open (its branch's PR is OPEN), is watched like one launched in this session: its item is in
  `status.json`'s `builders.items` and a new head on its branch writes its PUSH and READY events.
  (Session 22: S22-FL10's push of 673b7a4c, about 07:00Z, was logged at 13:12:28Z.)
- A ticket whose PR has merged is pruned: it leaves `builders.items`, whatever its launch time. (At
  session 23's close the watcher still carried about 50 stale tickets of S14-S21.)

Black-box, on the f3 watcher's world (`scripts/factory/tests/acceptance/test_watch.py`: a bare origin,
a pushing clone, the watcher's main checkout, every reading a seam; `VEXTRUS_PRS_FILE` is the PR list).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from scripts.factory.tests.acceptance.test_watch import World, ready

NOW = "2026-10-04T21:08:00Z"
SESSION_START = "2026-10-04T18:00:00Z"
YESTERDAY = "2026-10-03T12:00:00Z"


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    (made.factory / "session.json").write_text(
        json.dumps(
            {
                "schema": 1,
                "started_utc": SESSION_START,
                "budget_minutes": 660,
                "state_file": str(tmp_path / "STATE.md"),
                "phases": [{"name": "p1", "minutes": 660, "start_utc": SESSION_START}],
            }
        )
    )
    return made


def pr(number: int, branch: str, head: str, state: str) -> dict[str, Any]:
    return {
        "number": number,
        "headRefName": branch,
        "headRefOid": head,
        "state": state,
        "statusCheckRollup": [],
    }


def prs(world: World, *rows: dict[str, Any]) -> None:
    world.seams["prs"].write_text(json.dumps(list(rows)))


def items(world: World) -> dict[str, dict[str, Any]]:
    return {item["ticket"]: item for item in world.status()["builders"]["items"]}


def test_a_ticket_launched_before_the_session_with_an_open_pr_is_watched(world: World) -> None:
    world.launch("tcarry", "tcarry-branch", started_at=YESTERDAY)
    head = world.push("tcarry-branch", ready)
    prs(world, pr(640, "tcarry-branch", head, "OPEN"))
    world.once(NOW)
    watched = items(world)
    assert "tcarry" in watched, f"a carried-over open ticket is not watched: {sorted(watched)}"
    assert watched["tcarry"]["head"] == head
    assert watched["tcarry"]["pr"] == 640


def test_a_push_on_a_carried_over_ticket_writes_its_push_and_ready_events(world: World) -> None:
    world.launch("tcarry", "tcarry-branch", started_at=YESTERDAY)
    first = world.push("tcarry-branch", ready)
    prs(world, pr(640, "tcarry-branch", first, "OPEN"))
    world.once(NOW)
    lines = world.lines()
    assert world.events("PUSH", "tcarry"), f"a carried-over open ticket is not watched: {lines}"
    assert world.events("READY", "tcarry"), f"a carried-over open ticket is not watched: {lines}"


def test_a_ticket_launched_before_the_session_whose_pr_merged_is_not_watched(world: World) -> None:
    world.launch("tgone", "tgone-branch", started_at=YESTERDAY)
    head = world.push("tgone-branch", ready)
    prs(world, pr(600, "tgone-branch", head, "MERGED"))
    world.once(NOW)
    assert "tgone" not in items(world)
    assert world.events("READY", "tgone") == [], world.lines()


def test_a_ticket_of_this_session_whose_pr_merges_is_pruned_from_the_status(world: World) -> None:
    world.launch("tland", "tland-branch", started_at="2026-10-04T19:00:00Z")
    head = world.push("tland-branch", ready)
    prs(world, pr(650, "tland-branch", head, "OPEN"))
    world.once("2026-10-04T20:00:00Z")
    assert "tland" in items(world), "an open ticket of this session must be watched"

    prs(world, pr(650, "tland-branch", head, "MERGED"))
    world.once("2026-10-04T20:06:00Z")  # past the 5-minute PR read
    assert "tland" not in items(world), f"a merged ticket is still watched: {items(world).get('tland')}"
    assert not any(a["subject"] == "tland" for a in world.status()["alarms"])


def test_an_open_ticket_beside_a_merged_one_stays_watched(world: World) -> None:
    world.launch("tland", "tland-branch", started_at="2026-10-04T19:00:00Z")
    world.launch("topen", "topen-branch", started_at="2026-10-04T19:00:00Z")
    landed = world.push("tland-branch", ready)
    open_head = world.push("topen-branch", ready)
    prs(
        world,
        pr(650, "tland-branch", landed, "MERGED"),
        pr(651, "topen-branch", open_head, "OPEN"),
    )
    world.once(NOW)
    watched = items(world)
    assert "topen" in watched, f"an open ticket is not watched: {sorted(watched)}"
    assert watched["topen"]["state"] == "ready"
    assert "tland" not in watched, f"a merged ticket is still watched: {watched['tland']}"
