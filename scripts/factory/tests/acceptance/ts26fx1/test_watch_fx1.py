"""Ticket S26-FX1 (session 26's "factory fixes", #761): what the watcher writes to `events.log`.

The promises (the session-26 brief's FX1 row; the design, `factory-mod-design.md` 1 and 2(a)):
- a BLOCKED head without a Factory-Reason writes a BLOCKED event, `BLOCKED <t> <sha8> no reason given`
  (the guard stays strict: the trailer reading itself still gives no outcome);
- a launch recorded before the running session started (carried over) whose branch has an open PR is
  watched: its head moving is a PUSH and, READY, a READY;
- a local builder whose worktree's branch was renamed, or who switched its worktree to a new branch, is
  still watched: its commit is a COMMIT and, READY, a READY under the record's ticket;
- `walks/<sha40>/walk.json` appearing is one WALK-SCRIPT-DONE and `verdict.json` one G1 with its result,
  each once across restarts;
- a builder's `Factory-Status:` commit (its tree its parent's) is one STATUS event carrying the line, and
  a status commit on a READY head keeps it READY; one that changes a file, or forges a READY on a commit
  that changes a file, does not.
Black-box: the watcher runs as a subprocess (`_world.World`).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.factory import trailers

from ._world import LATER, NOW, World, detail, plain, ready, status_reply

SESSION_START = "2026-10-04T20:08:00Z"  # an hour before NOW
EARLIER_SESSION = "2026-10-04T12:00:00Z"  # the carried-over launch, before SESSION_START


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def no_reason(_tree: str) -> str:
    return "factory: stop\n\nThe ticket names no exit code.\n\nFactory-State: BLOCKED\n"


# 1. BLOCKED without a Factory-Reason
def test_a_blocked_head_without_a_reason_writes_one_blocked_event(world: World) -> None:
    world.launch_cloud("fb1", "fb1-branch")
    world.once(NOW)
    head = world.push("fb1-branch", no_reason)
    world.once(NOW)
    world.once(LATER)  # a restart does not write it again

    events = world.events("BLOCKED", "fb1")
    assert [detail(line) for line in events] == [f"{head[:8]} no reason given"], (
        f"FX1 blocked-no-reason: want one `BLOCKED fb1 {head[:8]} no reason given`: {world.lines()}"
    )


def test_the_trailer_reading_stays_strict_on_a_blocked_head_without_a_reason() -> None:
    read = trailers.read(no_reason(""), "0" * 40)
    assert read.outcome is None, read


# 2. carried-over launches
def test_a_carried_over_launch_with_an_open_pr_is_watched(world: World) -> None:
    world.launch_cloud("fc1", "fc1-branch", started_at=EARLIER_SESSION)
    first = world.push("fc1-branch", plain)
    world.open_pr(41, "fc1-branch", first)
    world.session(SESSION_START)
    world.once(NOW)
    head = world.push("fc1-branch", ready)
    world.open_pr(41, "fc1-branch", head)
    world.once(LATER)

    pushes = [detail(line) for line in world.events("PUSH", "fc1")]
    assert head[:8] in pushes, f"FX1 carried-over: no PUSH for the carried-over launch: {world.lines()}"
    readies = [detail(line) for line in world.events("READY", "fc1")]
    assert readies == [head[:8]], (
        f"FX1 carried-over: no READY for the carried-over launch: {world.lines()}"
    )
    items = world.items("fc1")
    assert [item["head"] for item in items] == [head], f"FX1 carried-over: no status item: {items}"


# 3. renamed and switched local branches
def local_in_worktree(world: World, ticket: str) -> tuple[Path, str]:
    """A local builder launched on `<ticket>-branch` at origin's tip L, its worktree checked out at the
    path its launch record names. Returns the worktree and L."""
    branch = f"{ticket}-branch"
    name, worktree = world.launch_local(ticket, branch)
    world.agents((name, "working"))
    launch_tip = world.push(branch, plain)
    world.git(world.main, "fetch", "-q", "origin")
    world.git(world.main, "branch", branch, launch_tip)
    world.git(world.main, "worktree", "add", "-q", str(worktree), branch)
    return worktree, launch_tip


def test_a_local_builder_whose_branch_was_renamed_is_still_watched(world: World) -> None:
    worktree, launch_tip = local_in_worktree(world, "fr1")
    world.once(NOW)
    world.git(worktree, "branch", "-m", "fr1-branch", "fr1-renamed")
    head = world.commit_local("fr1-renamed", ready, launch_tip)
    assert world.git(worktree, "rev-parse", "HEAD") == head
    world.once(LATER)

    commits = [detail(line) for line in world.events("COMMIT", "fr1")]
    assert commits == [head[:8]], f"FX1 renamed branch: no COMMIT under the ticket: {world.lines()}"
    readies = [detail(line) for line in world.events("READY", "fr1")]
    assert readies == [head[:8]], f"FX1 renamed branch: no READY under the ticket: {world.lines()}"


def test_a_local_builder_that_switched_to_a_new_branch_is_still_watched(world: World) -> None:
    worktree, launch_tip = local_in_worktree(world, "fr2")
    world.once(NOW)
    world.git(worktree, "switch", "-q", "-c", "fr2-b")
    head = world.commit_local("fr2-b", ready, launch_tip)
    assert world.git(worktree, "rev-parse", "HEAD") == head
    world.once(LATER)

    commits = [detail(line) for line in world.events("COMMIT", "fr2")]
    assert commits == [head[:8]], f"FX1 switched branch: no COMMIT under the ticket: {world.lines()}"
    readies = [detail(line) for line in world.events("READY", "fr2")]
    assert readies == [head[:8]], f"FX1 switched branch: no READY under the ticket: {world.lines()}"


# 4. the G1 walk's files
def lines_naming(world: World, kind: str, sha: str) -> list[str]:
    return [line for line in world.lines() if line.split(" ")[1:2] == [kind] and sha[:8] in line]


def test_a_walk_json_appearing_writes_one_walk_script_done(world: World) -> None:
    sha = world.tip("main")
    assert sha
    world.once(NOW)
    folder = world.walks / sha
    folder.mkdir(parents=True)
    record = {"schema": 1, "sha": sha, "started_at": NOW, "sets": {}, "urls": {}}
    (folder / "walk.json").write_text(json.dumps(record))
    world.once(NOW)
    world.once(LATER)

    found = lines_naming(world, "WALK-SCRIPT-DONE", sha)
    assert len(found) == 1, f"FX1 walk.json: want one WALK-SCRIPT-DONE naming {sha[:8]}: {world.lines()}"


def test_a_verdict_json_appearing_writes_one_g1_with_its_result(world: World) -> None:
    sha = world.tip("main")
    assert sha
    world.once(NOW)
    folder = world.walks / sha
    folder.mkdir(parents=True)
    record = {"schema": 1, "sha": sha, "started_at": NOW, "sets": {}, "urls": {}}
    (folder / "walk.json").write_text(json.dumps(record))
    world.once(NOW)
    verdict = {
        "schema_version": 1,
        "sha": sha,
        "ref": "main",
        "result": "FAIL",
        "started_at": NOW,
        "finished_at": NOW,
    }
    (folder / "verdict.json").write_text(json.dumps(verdict))
    world.once(NOW)
    world.once(LATER)

    found = lines_naming(world, "G1", sha)
    assert len(found) == 1, f"FX1 verdict.json: want one G1 naming {sha[:8]}: {world.lines()}"
    assert "FAIL" in found[0].split(" ", 2)[2], found


# 5. a builder's Factory-Status reply
def test_a_status_commit_on_a_ready_head_writes_one_status_and_stays_ready(world: World) -> None:
    world.launch_cloud("fs1", "fs1-branch")
    ready_head = world.push("fs1-branch", ready)
    world.once(NOW)
    world.push("fs1-branch", status_reply("waiting on web timeouts"), ready_head, empty=True)
    world.once(LATER)
    world.once(LATER)  # a restart does not write it again

    found = world.events("STATUS", "fs1")
    assert len(found) == 1, f"FX1 status: want one STATUS for the reply: {world.lines()}"
    assert "waiting on web timeouts" in detail(found[0]), found
    states = [item["state"] for item in world.items("fs1")]
    assert states == ["ready"], f"FX1 status: a status commit on a READY head left it {states}"


def test_a_local_status_commit_writes_one_status(world: World) -> None:
    branch = "fs2-branch"
    name, _ = world.launch_local("fs2", branch)
    world.agents((name, "working"))
    launch_tip = world.push(branch, plain)
    world.once(NOW)
    world.commit_local(branch, status_reply("on the third test of five"), launch_tip, empty=True)
    world.once(LATER)

    found = world.events("STATUS", "fs2")
    assert len(found) == 1, f"FX1 local status: want one STATUS for the reply: {world.lines()}"
    assert "on the third test of five" in detail(found[0]), found


def test_a_status_commit_that_changes_a_file_does_not_keep_ready(world: World) -> None:
    world.launch_cloud("fs3", "fs3-branch")
    ready_head = world.push("fs3-branch", ready)
    world.once(NOW)
    world.push("fs3-branch", status_reply("small fix"), ready_head)  # a new file in it
    world.once(LATER)

    states = [item["state"] for item in world.items("fs3")]
    assert len(states) == 1, states
    assert states != ["ready"], states


def test_a_forged_ready_on_a_status_commit_that_changes_a_file_is_not_ready(world: World) -> None:
    world.launch_cloud("fs4", "fs4-branch")
    ready_head = world.push("fs4-branch", ready)
    parent_tree = world.tree_of(ready_head)
    world.once(NOW)

    def forged(_tree: str) -> str:
        return (
            "status: answer\n\nFactory-Status: done\nFactory-State: READY\n"
            f"Factory-Verify: {parent_tree} ok\n"
        )

    world.push("fs4-branch", forged, ready_head)  # a new file in it, the parent's tree claimed
    world.once(LATER)

    states = [item["state"] for item in world.items("fs4")]
    assert len(states) == 1, states
    assert states != ["ready"], states
