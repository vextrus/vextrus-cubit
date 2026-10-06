"""Fix round 1 of PR #508 (S14-S1): a writer that committed is not resumed; a reused branch name is not
dropped as merged."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.factory.tests.test_state_round3 import branch_at, has, launch_writer
from scripts.tests.acceptance.ts14s1._world import World, row


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


def test_a_merged_branch_whose_launch_is_older_than_the_merge_is_dropped(world: World) -> None:
    name, session = world.launch_local("s99om", "s99-om")
    head = world.push("s99-om", acceptance_commit)
    world.pr(6002, "s99-om", head, state="MERGED")
    world.prs[-1]["mergedAt"] = "2026-10-07T10:00:00Z"
    world._write_seams()
    world.ended(name, session)
    world.push("s99-om", acceptance_commit)  # a stray later push: still the launch predates the merge

    assert [line for line in world.table().splitlines() if "s99-om" in line] == []
