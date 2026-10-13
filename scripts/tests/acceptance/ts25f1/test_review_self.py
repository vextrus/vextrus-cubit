"""Ticket S25-F1 `review self` (the owner's Q14, 13 Oct 2026).

Authority: docs/handoff/session-25-prompt.md, Q14's row: "A pilot of `review self` on one wave: before
READY, the builder runs review.py's two lenses on its own diff, with no ledger and no post." and
"Session 25's order" step 3, F1: "`scripts/factory/review_self.py` reuses `lens_command` and `run_lens`
(`review.py:748, :912`) on `git diff main...HEAD` in the builder's worktree, its own database or no
pytest, no ledger".

Pinned: the module and its bare run from the builder's worktree; the two lenses (review.py's lens A and
lens B, `pr-reviewer` on the owner's model map); the lens runs in the builder's own worktree on its HEAD;
the diff reviewed is `main...HEAD` (the branch's side only); no ledger file written, changed or removed;
nothing posted (no `gh`, no `sudo`); a lens's findings reach the builder; a usage error and a lens that
answers no JSON fail without a traceback. Not pinned (no authority names them): any flag (a fix round's
base among them), the database name, the cost line, the output's format.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts25f1._world import (
    BRANCH_MARK,
    MAIN_MARK,
    OPUS,
    SONNET,
    Ran,
    World,
    finding,
)


@pytest.fixture
def world(tmp_path: Path) -> World:
    return World(tmp_path)


def said(ran: Ran) -> str:
    """The run's output, for an assert's message (on main: the missing module)."""
    return f"exit {ran.code}\n{ran.stderr[-1500:]}\n{ran.stdout[-500:]}"


def test_a_bare_run_in_the_worktree_with_two_passing_lenses_exits_0(world: World) -> None:
    ran = world.run()
    assert ran.code == 0, said(ran)


def test_it_runs_review_py_s_two_lenses_and_no_other(world: World) -> None:
    """Lens A (`pr-reviewer`, Opus 5.5) and lens B (`pr-reviewer`, Sonnet 5.5): no words lens, no
    refuter."""
    ran = world.run()
    calls = world.calls()
    assert sorted((call["agent"], call["model"]) for call in calls) == [
        ("pr-reviewer", OPUS),
        ("pr-reviewer", SONNET),
    ], said(ran)


def test_each_lens_runs_in_the_builder_s_own_worktree_on_its_head(world: World) -> None:
    ran = world.run()
    calls = world.calls()
    assert len(calls) == 2, said(ran)
    for call in calls:
        assert Path(call["cwd"]).resolve() == world.worktree.resolve(), said(ran)
        assert call["head"] == world.head, said(ran)
    assert not list((world.main / ".claude" / "worktrees").glob("rv*")), "a review slot was made"


def test_the_lenses_see_the_branch_s_change_and_not_what_main_gained_after_the_cut(
    world: World,
) -> None:
    """`git diff main...HEAD`: the builder's commit is in what each lens is given (its prompt or a file
    its prompt names); the commit main gained after the branch was cut is not."""
    ran = world.run()
    calls = world.calls()
    assert len(calls) == 2, said(ran)
    for call in calls:
        given = call["stdin"] + "\n".join(call["files"].values())
        assert BRANCH_MARK in given, f"{call['model']} was not given the branch's change"
        assert MAIN_MARK not in given, f"{call['model']} was given main's later commit"


def test_it_writes_no_ledger_record(world: World) -> None:
    before = world.ledger_files()
    world.reply(
        {
            OPUS: {"verdict": "FIX", "findings": [finding(80, "the rate of an empty name is zero")]},
            SONNET: {"verdict": "PASS", "findings": []},
        }
    )
    ran = world.run()
    assert world.calls(), said(ran)
    assert world.ledger_files() == before


def test_it_posts_nothing(world: World) -> None:
    """No comment, no status, no poster: neither `gh` nor `sudo` is called."""
    world.reply(
        {
            OPUS: {"verdict": "FIX", "findings": [finding(80, "the rate of an empty name is zero")]},
            SONNET: {"verdict": "BLOCK", "findings": [finding(90, "a negative rate is accepted")]},
        }
    )
    ran = world.run()
    assert world.calls(), said(ran)
    assert world.posted() == []


def test_each_lens_s_findings_reach_the_builder(world: World) -> None:
    world.reply(
        {
            OPUS: {"verdict": "FIX", "findings": [finding(80, "OPUS_FINDING_Z81 rounds down")]},
            SONNET: {"verdict": "FIX", "findings": [finding(60, "SONNET_FINDING_Y52 accepts -1")]},
        }
    )
    ran = world.run()
    assert len(world.calls()) == 2, said(ran)
    assert "OPUS_FINDING_Z81" in ran.text, said(ran)
    assert "SONNET_FINDING_Y52" in ran.text, said(ran)
    assert "Traceback" not in ran.text, said(ran)


def test_an_unknown_option_is_a_usage_error_and_starts_no_lens(world: World) -> None:
    ran = world.run("--no-such-option")
    assert ran.code == 2, said(ran)
    assert "No module named" not in ran.stderr, said(ran)
    assert world.calls() == []


def test_a_lens_that_answers_no_json_fails_the_run_without_a_record_or_a_post(
    world: World,
) -> None:
    before = world.ledger_files()
    world.reply({OPUS: "garbage", SONNET: {"verdict": "PASS", "findings": []}})
    ran = world.run()
    assert world.calls(), said(ran)
    assert ran.code != 0, said(ran)
    assert "Traceback" not in ran.text, said(ran)
    assert world.ledger_files() == before
    assert world.posted() == []
