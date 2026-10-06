"""PR #483 review round 3: a merge is credited only with its own lines, never with the commits it merges
in (main's are outside the branch's range), and a clean merge of main with nothing.

Built on ticket S14-P7's acceptance world (`scripts/tests/acceptance/ts14p7/_world.py`, imported, never
changed): a temporary origin and an invented corpus.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from scripts.factory import leakwhere
from scripts.tests.acceptance.ts14p7._world import BRAMBLE, TAMARIND, World, hit_file

SCANNER = [sys.executable, "-m", "tools.leakscan"]
BRANCH = "s99-m1"


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    return made


def branch_and_main_hits(world: World) -> str:
    """The branch adds a hit in docs/mine.md; main then gains a hit in docs/main.md. Returns the
    branch's commit."""
    mine = world.commit(BRANCH, {"docs/mine.md": hit_file(2, BRAMBLE)}, "feat: mine\n")
    world.commit("main", {"docs/main.md": hit_file(3, TAMARIND)}, "feat: main's own\n")
    world.git(world.work, "push", "-q", "origin", "main")
    world.git(world.work, "checkout", "-q", BRANCH)
    world.git(world.work, "fetch", "-q", "origin")
    return mine


def attributed(world: World, head: str) -> list[leakwhere.Hit] | None:
    base = world.git(world.work, "merge-base", "origin/main", head)
    return leakwhere.commit_hits(world.work, SCANNER, base, head, world.env())


def test_a_clean_merge_of_main_is_named_for_nothing_and_mains_hit_is_not_the_branchs(
    world: World,
) -> None:
    mine = branch_and_main_hits(world)
    world.git(world.work, "merge", "-q", "--no-ff", "origin/main", "-m", "merge main")
    merge = world.git(world.work, "rev-parse", "HEAD")

    found = attributed(world, merge)

    assert found == [(mine, "docs/mine.md:2", 1)]


def test_a_merge_whose_own_resolution_adds_a_hit_is_named_for_that_line(world: World) -> None:
    mine = branch_and_main_hits(world)
    world.git(world.work, "merge", "-q", "--no-ff", "--no-commit", "origin/main")
    (world.work / "docs" / "evil.md").write_text(hit_file(2, BRAMBLE))
    world.git(world.work, "add", "docs/evil.md")
    world.git(world.work, "commit", "-q", "-m", "merge main")
    merge = world.git(world.work, "rev-parse", "HEAD")

    found = attributed(world, merge)

    assert found == [(mine, "docs/mine.md:2", 1), (merge, "docs/evil.md:2", 1)]
