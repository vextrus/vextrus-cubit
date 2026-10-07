"""The watcher's LOCAL-IDLE scope and the parser bump's re-read, driven end to end (PR #468 review r1).

- A finished local acceptance-writer (its `acceptance:` commit, an idle row) raises no LOCAL-IDLE: its
  work ends at that commit.
- A local builder whose session exited after a plain commit (its `claude agents` row done, no pid, no
  status) raises LOCAL-IDLE: the silent stop issue #448 is for.
- A READY inherited onto the lander's clean merge of main stays READY when a new trailer reading
  re-reads every seen head.

The world (origin, a pushing clone, the watcher's main checkout and its seams) is the ts14f1 acceptance
tests' own, imported, never changed.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.factory import governor, local, status
from scripts.tests.acceptance.ts14f1._world import NOW, TABLE, World, at, plain


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def launch_writer(world: World, ticket: str, branch: str) -> str:
    """A local acceptance-writer's launch record, by local.py's own parser and record writer."""
    name = f"{ticket}-writer"
    args = local.parse(
        [
            *("--ticket", ticket, "--branch", branch, "--effort", "high"),
            *("--name", name, "--prompt-file", str(world.tmp / "prompt.md")),
            *("--role", "acceptance-writer"),
        ]
    )
    world.monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(world.factory))
    local.write_record(
        args,
        status.parse_utc(NOW),
        governor.Verdict("local"),
        "2.1.999",
        "5f0c3a52-1b2d-4e3f-8a9b-0000000000aa",
        world.main / ".claude" / "worktrees" / ticket,
        None,
        [],
    )
    return name


def test_a_finished_local_acceptance_writer_raises_no_local_idle(world: World) -> None:
    name = launch_writer(world, "tw1", "tw1-branch")
    tip = world.push("tw1-branch", plain)
    world.agents((name, "done", "idle"))
    world.commit_local("tw1-branch", lambda _tree: "acceptance: tw1 pins the widget\n", tip)

    world.once(NOW)
    world.once(at(11))
    world.once(at(30))

    assert world.events("COMMIT", "tw1"), world.lines()
    assert world.item("tw1")["state"] == "done"
    assert world.events("LOCAL-IDLE", "tw1") == [], world.lines()


def ended(world: World, name: str) -> None:
    """`claude agents --json --all`'s row of a session that has exited: state done, no pid, no status."""
    row = {
        "id": "ae575c19",
        "cwd": str(world.main / ".claude" / "worktrees" / name),
        "kind": "background",
        "startedAt": NOW,
        "sessionId": "5f0c3a52-1b2d-4e3f-8a9b-0000000000bb",
        "name": name,
        "state": "done",
    }
    world.seams["agents"].write_text(json.dumps([row]))


def test_a_local_builder_whose_session_ended_after_a_plain_commit_raises_local_idle(
    world: World,
) -> None:
    name = world.launch_local("te1", "te1-branch")
    tip = world.push("te1-branch", plain)
    world.agents((name, "working", "busy"))
    world.commit_local("te1-branch", plain, tip)
    world.once(NOW)
    ended(world, name)

    world.once(at(5))
    assert world.events("LOCAL-IDLE", "te1") == [], world.lines()
    world.once(at(15))
    world.once(at(16))

    alarms = world.events("LOCAL-IDLE", "te1")
    assert len(alarms) == 1, world.lines()
    assert "session ended" in alarms[0]


def test_a_local_builder_whose_session_ended_after_ready_raises_no_local_idle(world: World) -> None:
    name = world.launch_local("te2", "te2-branch")
    tip = world.push("te2-branch", plain)
    ended(world, name)
    world.commit_local("te2-branch", TABLE["t-w317-ready"][0], tip)

    world.once(NOW)
    world.once(at(11))

    assert len(world.events("READY", "te2")) == 1, world.lines()
    assert world.events("LOCAL-IDLE", "te2") == [], world.lines()


def test_a_ready_inherited_onto_a_clean_merge_of_main_survives_a_parser_bump(world: World) -> None:
    world.launch_cloud("tm1", "tm1-branch")
    world.push("tm1-branch", TABLE["t-w317-ready"][0])
    world.once(NOW)
    assert len(world.events("READY", "tm1")) == 1, world.lines()

    # main moves on; the lander merges main into the READY branch cleanly and pushes the merge.
    world.push("main", plain)
    world.git(world.work, "fetch", "-q", "origin")
    world.git(world.work, "checkout", "-q", "-B", "tm1-branch", "origin/tm1-branch")
    world.git(world.work, "merge", "-q", "--no-edit", "origin/main")
    world.git(world.work, "push", "-q", "origin", "HEAD:refs/heads/tm1-branch")
    world.once(at(1))
    assert world.item("tm1")["state"] == "ready", world.lines()

    # A state written by an older trailer reading: every seen head is read again once.
    state_file = world.factory / "watch-state.json"
    state = json.loads(state_file.read_text())
    state["parser"] = 2
    state_file.write_text(json.dumps(state))
    world.once(at(2))
    world.once(at(12))

    assert world.item("tm1")["state"] == "ready", world.lines()
    assert len(world.events("READY", "tm1")) == 1, world.lines()
    assert len(world.events("READY-WAITING", "tm1")) == 1, world.lines()
