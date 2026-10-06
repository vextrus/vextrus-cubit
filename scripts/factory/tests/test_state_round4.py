"""Fix round 1 of PR #508 (S14-S1): a writer that committed is not resumed; a reused branch name is not
dropped as merged."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.factory.tests.test_state_round3 import branch_at, has, launch_writer
from scripts.tests.acceptance.ts14s1._world import World, plain, row


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def acceptance_commit(_tree: str) -> str:
    return "acceptance: pins the widget\n\nBody.\n"


def test_a_writer_that_committed_and_ended_reads_launch_the_builder_not_resume(world: World) -> None:
    name, session = launch_writer(world, "s99w", "s99-writer")
    branch_at(world, "s99-writer", world.tip("main"))
    world.push("s99-writer", acceptance_commit)
    world.ended(name, session)

    line = row(world.table(), "s99-writer")

    assert has(line, "acceptance committed: launch the builder"), line
    assert not has(line, "resume"), line


def test_a_reused_branch_name_with_a_newer_launch_is_not_dropped_as_merged(world: World) -> None:
    old = world.push("s99-re", acceptance_commit)
    world.pr(6001, "s99-re", old, state="MERGED")
    world.prs[-1]["mergedAt"] = "2026-10-05T10:00:00Z"
    world._write_seams()
    name, session = world.launch_local("s99re", "s99-re")  # launched on 2026-10-06, after the merge
    world.push("s99-re", acceptance_commit)
    world.live(name, session)

    line = row(world.table(), "s99-re")

    assert has(line, "building"), line


def idle_row(world: World, name: str, session: str, **over: object) -> None:
    """`claude agents --json --all`'s row of a writer whose turn finished but whose process lingers."""
    world.live(name, session)
    world.rows[-1].update(status="idle", **over)
    world._write_seams()


def test_a_writer_with_an_acceptance_head_and_a_live_idle_row_reads_launch_the_builder(
    world: World,
) -> None:
    name, session = launch_writer(world, "s99w", "s99-writer")
    branch_at(world, "s99-writer", world.tip("main"))
    world.push("s99-writer", acceptance_commit)
    idle_row(world, name, session)

    line = row(world.table(), "s99-writer")

    assert has(line, "acceptance committed: launch the builder"), line
    assert not has(line, "resume"), line


def test_a_writer_with_an_acceptance_head_and_a_row_with_no_pid_reads_launch_the_builder(
    world: World,
) -> None:
    name, session = launch_writer(world, "s99w", "s99-writer")
    branch_at(world, "s99-writer", world.tip("main"))
    world.push("s99-writer", acceptance_commit)
    world.live(name, session)
    del world.rows[-1]["pid"]
    world._write_seams()

    assert has(row(world.table(), "s99-writer"), "acceptance committed: launch the builder")


def test_a_live_working_writer_with_no_commit_reads_building(world: World) -> None:
    name, session = launch_writer(world, "s99w", "s99-writer")
    branch_at(world, "s99-writer", world.tip("main"))
    world.live(name, session)

    line = row(world.table(), "s99-writer")

    assert has(line, "building"), line
    assert not has(line, "acceptance committed"), line


def killed_row(world: World, name: str, session: str, state: str) -> None:
    """A session killed mid-turn: its row keeps `state` but has no pid."""
    world.live(name, session)
    del world.rows[-1]["pid"]
    world.rows[-1].update(state=state)
    world._write_seams()


@pytest.mark.parametrize("state", ["working", "blocked"])
def test_a_row_with_no_pid_and_a_busy_state_on_a_non_ready_head_reads_resume(
    world: World, state: str
) -> None:
    name, session = world.launch_local("s99k", "s99-killed")
    world.push("s99-killed", plain)
    world.commit_local("s99-killed", plain)
    killed_row(world, name, session, state)

    line = row(world.table(), "s99-killed")

    assert has(line, f"resume {session}"), line


def test_a_writer_with_no_pid_and_an_acceptance_head_reads_launch_the_builder(world: World) -> None:
    name, session = launch_writer(world, "s99w", "s99-writer")
    branch_at(world, "s99-writer", world.tip("main"))
    world.push("s99-writer", acceptance_commit)
    killed_row(world, name, session, "working")

    line = row(world.table(), "s99-writer")

    assert has(line, "acceptance committed: launch the builder"), line
    assert not has(line, "resume"), line
