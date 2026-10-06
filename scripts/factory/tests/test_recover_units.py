"""Fix round 1 of S14-F9 (PR #493): recover's liveness rule, unreadable records and hostile values."""

from __future__ import annotations

import json
import os
import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14f9.test_recover import World


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[World]:
    made = World(tmp_path, monkeypatch)
    yield made
    made.close()


def claude_in(world: World, folder: Path, argv0: str = "claude") -> int:
    child = subprocess.Popen([argv0, "3600"], executable="/bin/sleep", cwd=folder)
    world.children.append(child)
    return child.pid


def worktree(world: World, ticket: str) -> Path:
    return world.main / ".claude" / "worktrees" / ticket


def test_a_live_spare_hosted_builder_is_not_listed(world: World) -> None:
    sid = world.builder("u1", 1)
    world.row(sid, "u1", state="working", pid=claude_in(world, worktree(world, "u1"), "claude bg-spare"))
    assert world.resumed() == []


def test_a_missing_launches_folder_is_refused_not_clean(world: World) -> None:
    os.rmdir(world.factory / "launches")
    done = world.recover()
    assert done.returncode != 0
    assert "no dead local builders" not in done.stdout


@pytest.mark.parametrize("damage", ["truncated", "unreadable"])
def test_an_unreadable_record_is_named_and_exits_nonzero(world: World, damage: str) -> None:
    world.builder("u3", 3)
    bad = world.factory / "launches" / "u4-20261006T100000Z.json"
    bad.write_text('{"where": "local", "session_')
    if damage == "unreadable":
        bad.write_text("{}")
        bad.chmod(0)
        if os.access(bad, os.R_OK):
            pytest.skip("running as a user who can read mode 000")
    done = world.recover()
    assert done.returncode != 0
    assert bad.name in done.stderr
    assert "no dead local builders" not in done.stdout


def test_a_hostile_session_id_prints_no_runnable_second_command(world: World) -> None:
    world.builder("u5", 5)
    record = next(world.factory.glob("launches/u5-*Z.json"))
    data = json.loads(record.read_text())
    data["session_id"] = "x; touch PWNED #"
    record.write_text(json.dumps(data))
    done = world.recover()
    assert "PWNED" not in done.stdout
    assert done.returncode != 0
    assert "u5" in done.stderr
    assert not (world.main / "PWNED").exists()


def test_a_ticket_with_a_newline_is_refused(world: World) -> None:
    world.builder("u6", 6)
    record = next(world.factory.glob("launches/u6-*Z.json"))
    data = json.loads(record.read_text())
    data["ticket"] = "u6\ntouch PWNED"
    record.write_text(json.dumps(data))
    done = world.recover()
    assert "PWNED" not in done.stdout
    assert done.returncode != 0


def test_a_clean_run_with_agents_snapshots_beside_records_exits_zero(world: World) -> None:
    sid = world.builder("u7", 7)
    (world.factory / "launches" / "u7-20261006T100000Z.agents.json").write_text("[]")
    world.row(sid, "u7", state="working", pid=claude_in(world, world.tmp))
    done = world.recover()
    assert done.returncode == 0
    assert "no dead local builders" in done.stdout
