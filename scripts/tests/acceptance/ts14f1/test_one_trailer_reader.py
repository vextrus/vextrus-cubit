"""Ticket S14-F1, issue #448: one trailer reader for the watcher and the gates.

The authority (issue #448, "Fix" and "Acceptance check"; factory-next.md section 8 row 2, "the T-W317
commit shape gives READY; a trailer outside the read paragraph alarms"):
- "One trailer reader module shared by `watch.py`, the guard push gate and `stop-gate.mjs`: it reads
  the factory trailers from the last paragraph that contains a `Factory-*` line among the last two
  paragraphs."
- "A `Factory-*` line anywhere outside the read paragraph raises `READY-NO-VERIFY` ("factory trailer
  not in the last paragraph"), never silence."
- "The exact message shape from session 13 (Factory block, blank line, attribution block) gives READY
  in all three readers; a Factory block in the third-to-last paragraph gives READY-NO-VERIFY."

One table of commit messages (`_world.TABLE`, the T-W317 shape of PR #443's READY head with synthetic
words) is read by all three readers at their own boundaries: the watcher's events.log and status.json,
the guard's verdict on a push, and the stop gate's verdict on a stop. Each reader's answer is what
trailers.md 1 says it does with that outcome: the watcher raises the READY, BLOCKED or READY-NO-VERIFY
event; the guard gates a READY or malformed READY head (refused as READY_UNVERIFIED without a green
verify record for its tree); the stop gate holds a READY-looking HEAD without a green record and lets a
BLOCKED one stop. The shared reader's module and function names are not pinned (the issue names none,
and the readers are Python and node): the agreement of the three on the one table is.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14f1._world import (
    REASON,
    TABLE,
    Scratch,
    World,
    detail,
    guard_push,
    outside_the_read_paragraph,
    plain,
    stop,
)

READY_LOOKING = [case for case, (_message, outcome) in TABLE.items() if outcome != "BLOCKED"]


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


# --- the watcher
@pytest.mark.parametrize("case", sorted(TABLE))
def test_the_watcher_reads_the_t_w317_shape_from_a_local_builders_commit(
    world: World, case: str
) -> None:
    message, outcome = TABLE[case]
    world.launch_local("tl1", "tl1-branch")
    world.agents(("tl1-local", "working", "busy"))
    launch_tip = world.push("tl1-branch", plain)
    head = world.commit_local("tl1-branch", message, launch_tip)
    world.once()

    events = world.events(outcome, "tl1")
    assert len(events) == 1, world.lines()
    assert detail(events[0]).startswith(head[:8]), events
    if outcome == "BLOCKED":
        assert detail(events[0]) == f"{head[:8]} {REASON}", events
    others = {"READY", "BLOCKED", "READY-NO-VERIFY"} - {outcome}
    for kind in others:
        assert world.events(kind, "tl1") == [], world.lines()
    expected_state = {"READY": "ready", "BLOCKED": "blocked"}.get(outcome)
    if expected_state is not None:
        assert world.item("tl1")["state"] == expected_state


def test_the_watcher_reads_the_t_w317_ready_shape_from_a_cloud_push(world: World) -> None:
    message, _outcome = TABLE["t-w317-ready"]
    world.launch_cloud("tc1", "tc1-branch")
    head = world.push("tc1-branch", message)
    world.once()

    events = world.events("READY", "tc1")
    assert len(events) == 1, world.lines()
    assert detail(events[0]).startswith(head[:8]), events
    assert world.item("tc1")["state"] == "ready"
    assert world.events("READY-NO-VERIFY", "tc1") == [], world.lines()


def test_a_factory_block_outside_the_read_paragraph_raises_ready_no_verify_never_silence(
    world: World,
) -> None:
    world.launch_cloud("tc2", "tc2-branch")
    head = world.push("tc2-branch", outside_the_read_paragraph)
    world.once()
    world.once()  # an alarm is edge-triggered: one line while it holds

    alarms = world.events("READY-NO-VERIFY", "tc2")
    assert len(alarms) == 1, world.lines()
    assert detail(alarms[0]).startswith(head[:8]), alarms
    assert "factory trailer not in the last paragraph" in detail(alarms[0]), alarms
    assert world.events("READY", "tc2") == [], world.lines()
    assert world.item("tc2")["state"] != "ready"


# --- the guard's READY push gate
@pytest.mark.parametrize("case", READY_LOOKING)
def test_the_guard_gates_a_ready_looking_t_w317_head_without_a_verify_record(
    tmp_path: Path, case: str
) -> None:
    message, _outcome = TABLE[case]
    main = Scratch(tmp_path, "main", "main")
    own = Scratch(tmp_path, "own", "claude/s14-f1-own-branch")
    own.commit(message)

    assert guard_push(own, main) == "READY_UNVERIFIED"


def test_the_guard_lets_a_t_w317_ready_head_through_with_a_green_record_for_its_tree(
    tmp_path: Path,
) -> None:
    message, _outcome = TABLE["t-w317-ready"]
    main = Scratch(tmp_path, "main", "main")
    own = Scratch(tmp_path, "own", "claude/s14-f1-own-branch")
    tree = own.commit(message)
    assert guard_push(own, main) == "READY_UNVERIFIED"  # gated: the record is what lets it through

    own.verify_record(tree)
    assert guard_push(own, main) is None


# --- the stop gate
def held(verdict: dict[str, object] | None) -> bool:
    """A block carrying trailers.md 1's words: "commit with explicit paths and run verify, or finish
    `Factory-State: BLOCKED` with a reason"."""
    if verdict is None:
        return False
    reason = verdict.get("reason")
    assert verdict.get("decision") == "block", verdict
    assert isinstance(reason, str), verdict
    assert "explicit paths" in reason, reason
    assert "Factory-State: BLOCKED" in reason, reason
    return True


@pytest.mark.parametrize("case", READY_LOOKING)
def test_the_stop_gate_holds_a_ready_looking_t_w317_head_without_a_verify_record(
    tmp_path: Path, case: str
) -> None:
    message, _outcome = TABLE[case]
    project = Scratch(tmp_path, "worktree", "s14-f1-builder")
    project.commit(message)  # committed, nothing uncommitted: only the trailer can hold the stop

    assert held(stop(project))


def test_the_stop_gate_lets_a_t_w317_ready_head_stop_with_a_green_record_for_its_tree(
    tmp_path: Path,
) -> None:
    message, _outcome = TABLE["t-w317-ready"]
    project = Scratch(tmp_path, "worktree", "s14-f1-builder")
    tree = project.commit(message)
    assert held(stop(project))  # read as READY: the record is what lets it stop

    project.verify_record(tree)
    assert stop(project) is None


def test_the_stop_gate_lets_a_t_w317_blocked_head_stop_with_uncommitted_changes(tmp_path: Path) -> None:
    message, _outcome = TABLE["t-w317-blocked"]
    project = Scratch(tmp_path, "worktree", "s14-f1-builder")
    project.commit(message)
    project.dirty()  # a BLOCKED finish may leave work uncommitted; with no trailer this stop is held

    assert stop(project) is None
