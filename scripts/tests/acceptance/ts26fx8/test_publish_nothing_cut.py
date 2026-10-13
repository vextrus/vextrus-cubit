"""Ticket S26-FX8, the empty-Cut words: `python -m scripts.factory.publish <branch>` publishes a READY
head whose PR body's Cut says "Nothing cut." (S26-FX6 runs merge_ready's `cut_problems` on that body).

The authority (the orchestrator's ruling, session 26, 13 Oct 2026): "scripts.factory.publish (S26-FX6,
merged) and merge_ready both refuse a PR that cut nothing"; the fix: cut_problems accepts "Nothing
cut." as an empty Cut.

Pinned at the boundary: the exit code, the branch on origin at the head, and one `gh pr create`. The
world (a temporary origin, the main checkout, a builder's clone, a fake leak corpus, a fake `gh`) is
S14-P7's (`scripts/tests/acceptance/ts14p7/_world.py`).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14p7._world import ATTRIBUTION, World, show, write_verify_record

BRANCH = "s99-x8"
REFUSED = "scripts.factory.publish refused a body whose Cut says it cut nothing"


@pytest.fixture
def world(tmp_path: Path) -> World:
    made = World(tmp_path)
    made.leak.build()
    return made


def commit_ready_with(world: World, sections: str) -> str:
    """A READY tip on BRANCH whose message holds `sections`, with its tree's green verify record."""
    world.commit(BRANCH, {"docs/plan.md": "a clean line\n"}, "wip: the widget\n")
    tree = world.git(world.work, "rev-parse", "HEAD^{tree}")
    text = world.tmp / "ready.txt"
    text.write_text(
        "S99-X8: the widget's export step\n"
        "\n"
        "Closes #999. The widget exports in one step.\n"
        "\n"
        f"{sections.strip()}\n"
        "\n"
        f"Factory-State: READY\nFactory-Verify: {tree} ok\n"
        "\n"
        f"{ATTRIBUTION}"
    )
    world.git(world.work, "commit", "-q", "--amend", "-F", str(text))
    write_verify_record(world, tree)
    return world.git(world.work, "rev-parse", "HEAD")


def test_a_cut_that_says_nothing_cut_is_published(world: World) -> None:
    head = commit_ready_with(world, "## Cut\nNothing cut.\n\n## Notes\nA synthetic note.\n")
    world.to_main(BRANCH)

    done = world.publish(BRANCH)

    assert done.returncode == 0, f"{REFUSED}: {show(done)}"
    assert world.origin_refs().get(f"refs/heads/{BRANCH}") == head, show(done)
    assert len(world.prs_created()) == 1, world.gh_calls()
