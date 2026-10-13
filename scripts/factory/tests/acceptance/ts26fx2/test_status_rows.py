"""Ticket S26-FX2 (the factory mod's wake), the watcher's side: each `builders.items` entry of
`status.json` carries `state_at` and `relay`, and `launch say` sending leaves a `SAID <ticket>` line.

Authority: the factory-mod design of 13 Oct 2026, section 1: "a status table of every live ticket, one
row each: `ticket state head8 Δmin relay`, where ... Δmin is minutes since its head or state last
changed, and `relay` is set when the newest event is BLOCKED with no reason, or a SAID has had no PUSH,
COMMIT or STATUS for 10 min ... The watcher computes the rows into `status.json` (`builders.items`
gains `state_at`, `relay`; status.schema.json bumps)"; its new events: "`SAID <t>` when `launch say`
sends". The bump is additive: `schema_version` stays 1 (its own description: "Raised only by a
breaking change"; every reader refuses another value).

Not pinned here: `relay` for "the newest event is BLOCKED with no reason" (that event is S26-FX1's,
not on main yet). Black-box, on ticket f3's watcher world (`test_watch.World`: a real git origin, the
watcher's seams, `VEXTRUS_NOW`); `launch say` runs in-process with a `claude` stub answering
`{"ok": true}`.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import launch
from scripts.factory.tests.acceptance.test_watch import CONTRACTS, NOW, World, plain, ready, violations

SESSION = "session_01Examplet1"  # World.launch's cloud session for ticket t1


def at(minutes: int) -> str:
    start = datetime.strptime(NOW, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    return (start + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture
def world(tmp_path: Path) -> World:
    return World(tmp_path)


def item_of(world: World, ticket: str) -> dict[str, Any]:
    found = [i for i in world.status()["builders"]["items"] if i["ticket"] == ticket]
    assert len(found) == 1, world.status()["builders"]["items"]
    item: dict[str, Any] = found[0]
    return item


def say(world: World, monkeypatch: pytest.MonkeyPatch, now: str, ticket: str = "t1") -> int:
    """`launch say <t1's session> --file <f> --ticket <ticket> --elapsed 5/60` from the main checkout."""
    bin_dir = world.tmp / "say-bin"
    bin_dir.mkdir(exist_ok=True)
    stub = bin_dir / "claude"
    stub.write_text(f"#!{sys.executable}\nimport json\nprint(json.dumps({{'ok': True}}))\n")
    stub.chmod(0o755)
    message = world.tmp / "say.md"
    message.write_text("Round 1: one finding stands.\n")
    with monkeypatch.context() as m:
        m.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
        m.setenv("VEXTRUS_FACTORY_DIR", str(world.factory))
        m.setenv("VEXTRUS_MAIN_CHECKOUT", str(world.main))
        m.setenv("VEXTRUS_NOW", now)
        m.setattr(launch, "default_scan", lambda root: lambda text: launch.ScanResult(True, "hits=0"))
        m.chdir(world.main)
        argv = ["say", SESSION, "--file", str(message), "--ticket", ticket, "--elapsed", "5/60"]
        return launch.main(argv)


def test_each_builder_item_carries_state_at_and_relay_by_the_schema(world: World) -> None:
    world.launch("t1", "t1-branch")
    world.push("t1-branch", plain)
    world.once()
    item = item_of(world, "t1")
    assert "state_at" in item, f"FX2: builders.items carries state_at: {item}"
    assert item["state_at"] == NOW, f"FX2: state_at is when the head was first seen: {item}"
    assert item.get("relay") is False, f"FX2: builders.items carries relay, false: {item}"
    written = world.status()
    assert written["schema_version"] == 1
    schema = json.loads((CONTRACTS / "status.schema.json").read_text())
    assert violations(written, schema, schema) == [], "FX2: status.json meets status.schema.json"


def test_the_schema_declares_state_at_and_relay_on_each_builder(world: World) -> None:
    """Declared, not pinned as required: band.test.ts carries status.sample.json byte for byte
    (test_mod_layout L4) and the builder cannot change that copy, so the sample may stay without them."""
    schema = json.loads((CONTRACTS / "status.schema.json").read_text())
    builder = schema["$defs"]["builder"]
    assert {"state_at", "relay"} <= set(builder["properties"]), (
        f"FX2: the schema declares state_at and relay: {sorted(builder['properties'])}"
    )
    assert schema["properties"]["schema_version"]["const"] == 1, (
        "an additive field is no breaking change"
    )
    item = {
        "ticket": "t1",
        "where": "cloud",
        "state": "working",
        "branch": "t1-branch",
        "head": None,
        "last_push_at": None,
        "quiet_minutes": 0,
        "pr": None,
        "state_at": NOW,
        "relay": "yes",
    }
    wrapped = {"$defs": schema["$defs"], **builder}
    assert violations(item, wrapped, schema) != [], (
        "FX2: relay is a boolean: a string violates the schema"
    )


def test_state_at_moves_when_the_head_or_state_changes_and_only_then(world: World) -> None:
    world.launch("t1", "t1-branch")
    world.push("t1-branch", plain)
    world.once(NOW)
    world.once(at(6))
    assert item_of(world, "t1").get("state_at") == NOW, (
        f"FX2: state_at stays while nothing changed: {item_of(world, 't1')}"
    )
    world.push("t1-branch", ready)
    world.once(at(9))
    item = item_of(world, "t1")
    assert item["state"] == "ready", item
    assert item.get("state_at") == at(9), (
        f"FX2: state_at moves to the pass that saw the READY head: {item}"
    )


def test_launch_say_sending_leaves_one_said_line_for_its_ticket(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.launch("t1", "t1-branch")
    world.push("t1-branch", plain)
    world.once(NOW)
    assert say(world, monkeypatch, at(1)) == 0
    world.once(at(1))
    world.once(at(2))
    said = world.events("SAID", "t1")
    assert len(said) == 1, f"FX2: one SAID t1 line after launch say sent: {world.lines()}"


def test_launch_say_refused_leaves_no_said_line(world: World, monkeypatch: pytest.MonkeyPatch) -> None:
    world.launch("t1", "t1-branch")
    world.push("t1-branch", plain)
    world.once(NOW)
    assert say(world, monkeypatch, at(1)) == 0
    with monkeypatch.context() as m:
        m.setattr(launch, "default_scan", lambda root: lambda text: launch.ScanResult(False, "hits=1"))
        m.setenv("VEXTRUS_FACTORY_DIR", str(world.factory))
        m.setenv("VEXTRUS_NOW", at(3))
        m.chdir(world.main)
        message = world.tmp / "leaky.md"
        message.write_text("a message the scan refuses\n")
        assert (
            launch.main(["say", SESSION, "--file", str(message), "--ticket", "t1", "--elapsed", "5/60"])
            == 2
        )
    world.once(at(3))
    assert len(world.events("SAID", "t1")) == 1, f"FX2: a refused say adds no SAID line: {world.lines()}"


def test_a_said_with_no_push_for_10_minutes_sets_relay(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.launch("t1", "t1-branch")
    world.push("t1-branch", plain)
    world.once(NOW)
    assert say(world, monkeypatch, at(1)) == 0
    world.once(at(1))
    world.once(at(5))
    assert item_of(world, "t1").get("relay") is False, (
        f"FX2: relay is false 4 minutes after SAID: {item_of(world, 't1')}"
    )
    world.once(at(12))
    assert item_of(world, "t1").get("relay") is True, (
        f"FX2: relay is true 11 minutes after SAID with no push: {item_of(world, 't1')}"
    )


def test_a_push_after_said_keeps_relay_false(world: World, monkeypatch: pytest.MonkeyPatch) -> None:
    world.launch("t1", "t1-branch")
    world.push("t1-branch", plain)
    world.once(NOW)
    assert say(world, monkeypatch, at(1)) == 0
    world.once(at(1))
    world.push("t1-branch", plain)
    world.once(at(5))
    world.once(at(12))
    item = item_of(world, "t1")
    assert item.get("relay") is False, f"FX2: a PUSH answered the SAID, relay is false: {item}"
    assert len(world.events("SAID", "t1")) == 1, f"FX2: one SAID t1 line: {world.lines()}"
