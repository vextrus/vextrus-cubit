"""review self's base and its uncommitted work (S25-F1, PR 748 round 1), in the acceptance world."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts25f1._world import BRANCH_MARK, MAIN_MARK, World, git

STAGED_MARK = "STAGED_EDIT_MARK_1A"
UNSTAGED_MARK = "UNSTAGED_EDIT_MARK_2B"
UNTRACKED_MARK = "UNTRACKED_FILE_MARK_3C"


@pytest.fixture
def world(tmp_path: Path) -> World:
    return World(tmp_path)


def given(world: World) -> list[str]:
    return [call["stdin"] + "\n".join(call["files"].values()) for call in world.calls()]


def test_the_base_is_origin_main_when_the_local_main_lags(world: World) -> None:
    """The builder merged origin/main; the local `main` was never pulled. Main's commits are not the
    builder's change."""
    git(world.main, "reset", "-q", "--hard", "HEAD~1")  # the local main is back at the cut
    git(world.worktree, "merge", "-q", "--no-edit", "origin/main")
    ran = world.run()
    seen = given(world)
    assert len(seen) == 2, ran.text
    for text in seen:
        assert BRANCH_MARK in text
        assert MAIN_MARK not in text


def test_the_base_is_fetched_first(world: World) -> None:
    """origin/main moved after the worktree's last fetch: the merge of it is not the builder's change."""
    clone = world.tmp / "other"
    git(world.tmp, "clone", "-q", str(world.origin), str(clone))
    for key, value in (("user.name", "T"), ("user.email", "t@example.invalid")):
        git(clone, "config", key, value)
    (clone / "later.py").write_text('LATER = "LATER_MARK_5E"\n')
    git(clone, "add", "later.py")
    git(clone, "commit", "-q", "-m", "later")
    git(clone, "push", "-q", "origin", "main")
    git(world.worktree, "fetch", "-q", "origin")
    git(world.worktree, "merge", "-q", "--no-edit", "origin/main")
    git(clone, "checkout", "-q", "-b", "x")  # the clone is only a pusher
    ran = world.run()
    assert len(given(world)) == 2, ran.text
    assert all("LATER_MARK_5E" not in text for text in given(world))


def test_staged_unstaged_and_untracked_work_reaches_the_lenses(world: World) -> None:
    table = world.worktree / "vextrus" / "rates" / "table.py"
    table.write_text(f'STAGED = "{STAGED_MARK}"\n')
    git(world.worktree, "add", "vextrus/rates/table.py")
    branch = world.worktree / "vextrus" / "rates" / "branch_change.py"
    branch.write_text(branch.read_text() + f'\nUNSTAGED = "{UNSTAGED_MARK}"\n')
    (world.worktree / "vextrus" / "rates" / "new.py").write_text(f'NEW = "{UNTRACKED_MARK}"\n')
    ran = world.run()
    seen = given(world)
    assert len(seen) == 2, ran.text
    for text in seen:
        for mark in (BRANCH_MARK, STAGED_MARK, UNSTAGED_MARK, UNTRACKED_MARK):
            assert mark in text, mark
