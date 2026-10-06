"""Fix round 3 of S14-S1 (PR #492): a branch with any launch record stays until its PR is MERGED; whether
its head is inside main, and when it was committed, are never consulted."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.factory import governor, local, status
from scripts.tests.acceptance.ts14s1 import _world
from scripts.tests.acceptance.ts14s1._world import World, plain, row

WRITER_SESSION = "7a1c3a52-1b2d-4e3f-8a9b-000000000077"


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def has(line: str, words: str) -> bool:
    return words.lower() in line.lower()


def launch_writer(world: World, ticket: str, branch: str) -> tuple[str, str]:
    """An acceptance-writer's launch record, by local.py's own parser and writer."""
    name = f"{ticket}-writer"
    args = local.parse(
        [
            *("--ticket", ticket, "--branch", branch, "--effort", "high"),
            *("--role", "acceptance-writer", "--name", name),
            *("--prompt-file", str(world.tmp / "prompt.md")),
        ]
    )
    world.monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(world.factory))
    local.write_record(
        args,
        status.parse_utc(_world.NOW),
        governor.Verdict("local"),
        "2.1.999",
        WRITER_SESSION,
        world.main / ".claude" / "worktrees" / ticket,
        None,
        [],
    )
    return name, WRITER_SESSION


def branch_at(world: World, branch: str, sha: str | None) -> None:
    world.git(world.work, "push", "-q", "-f", "origin", f"{sha}:refs/heads/{branch}")


def test_a_branch_at_mains_tip_with_a_live_writer_shows_the_writers_session(world: World) -> None:
    name, session = launch_writer(world, "s99w", "s99-writer")
    branch_at(world, "s99-writer", world.tip("main"))
    world.live(name, session)

    line = row(world.table(), "s99-writer")

    assert session in line, line
    assert not has(line, "resume"), line


def test_the_same_writer_dead_reads_resume_with_its_session(world: World) -> None:
    name, session = launch_writer(world, "s99w", "s99-writer")
    branch_at(world, "s99-writer", world.tip("main"))
    world.ended(name, session)

    assert has(row(world.table(), "s99-writer"), f"resume {session}")


def test_a_launched_builder_fast_forwarded_to_a_newer_main_stays_listed(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    name, session = world.launch_local("s99r", "s99-ff")
    branch_at(world, "s99-ff", world.tip("main"))
    before = world.git.env
    monkeypatch.setattr(
        world.git, "env", lambda: {**before(), "GIT_COMMITTER_DATE": "2026-10-06T11:00:00Z"}
    )
    world.push("main", plain)
    branch_at(world, "s99-ff", world.tip("main"))
    world.live(name, session)

    assert has(row(world.table(), "s99-ff"), "building")
