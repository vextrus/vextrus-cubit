"""Fix round 1 of PR #516 (S14-S1): one source for a head's Factory-State (the watcher's inheriting of a
READY head through clean merges of main) and one rule for a merged branch (its head is in the merged
head's history)."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.factory.tests.test_state_round1 import merge_main_into
from scripts.tests.acceptance.ts14s1._world import World, ready, row, rows


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def has(line: str, words: str) -> bool:
    return words.lower() in line.lower()


def test_a_ready_head_with_a_merge_of_main_on_top_and_an_open_pr_reads_unreviewed(
    world: World,
) -> None:
    world.push("s99-m", ready)
    head = merge_main_into(world, "s99-m")
    world.pr(7001, "s99-m", head)

    line = row(world.table(), "s99-m")

    assert has(line, "unreviewed"), line
    assert "READY" in line, line


def test_a_ready_head_with_a_merge_of_main_on_top_and_no_pr_reads_ready_no_pr(world: World) -> None:
    world.push("s99-n", ready)
    merge_main_into(world, "s99-n")

    assert "READY, no PR" in row(world.table(), "s99-n")


def test_a_follow_up_commit_on_a_branch_whose_earlier_pr_merged_keeps_its_row(world: World) -> None:
    first = world.push("s99-f", ready)
    world.pr(7002, "s99-f", first, state="MERGED")
    world.push("s99-f", ready)

    assert "READY, no PR" in row(world.table(), "s99-f")


def test_a_branch_at_the_merged_head_is_dropped(world: World) -> None:
    head = world.push("s99-d", ready)
    world.pr(7003, "s99-d", head, state="MERGED")

    assert rows(world.table(), "s99-d") == []
