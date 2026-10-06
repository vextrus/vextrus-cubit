"""S14-R1: what `review.py run <PR>` refuses before anything starts (factory-next.md 8 row 4; research/
review.md 3 step 1; issue #453): the head comes from the PR, never typed, and a short or non-hex one
cannot start; the ledger's round check refuses a round past the cap; a red-CI head exits 3 and claims
no slot; a closed PR and an over-long exception reason exit 3; a head that does not merge with main
exits 3 (step 2). "Nothing started": no `claude`, no slot, no runnable worktree, no ledger change and
no comment. A refusal exits with scripts.ledger's codes: 2 (bad input or usage) or 3 (refused)."""

import pytest

from scripts.tests.acceptance.ts14r1._world import RED, SMALL, World, why


def test_a_typed_head_cannot_start(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    done = world.run("12", "--round", "1", "--head", head)
    assert done.returncode in (2, 3), why(done)
    assert world.started([]) == []


def test_a_sha_typed_in_place_of_the_pr_cannot_start(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    done = world.run(head[:7], "--round", "1")
    assert done.returncode in (2, 3), why(done)
    assert world.started([]) == []


@pytest.mark.parametrize(
    "answer",
    [
        "abc1234",
        "0123456789abcdef0123456789abcdef0123456",
        "z" * 40,
        "0123456789abcdef0123456789abcdef0123456g",
    ],
    ids=["short", "39-hex", "non-hex", "one-non-hex"],
)
def test_a_short_or_non_hex_head_from_the_pr_cannot_start(
    tmp_path_factory: pytest.TempPathFactory, answer: str
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, SMALL)
    world.edit_pr(12, headRefOid=answer)
    done = world.run("12", "--round", "1")
    assert done.returncode in (2, 3), why(done)
    assert world.started([]) == []


def test_a_round_already_recorded_is_refused_with_exit_3(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    world.seed_record(12, "1" * 40, 1)
    world.seed_record(12, "2" * 40, 2)
    before = world.records()
    done = world.run("12", "--round", "2")
    assert done.returncode == 3, why(done)
    assert world.started(before) == []
    assert world.record(12, head) is None


def test_round_three_without_an_exception_is_refused_with_exit_3(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, SMALL)
    world.seed_record(12, "1" * 40, 1)
    world.seed_record(12, "2" * 40, 2)
    before = world.records()
    done = world.run("12", "--round", "3")
    assert done.returncode == 3, why(done)
    assert world.started(before) == []


def test_an_exception_reason_over_300_characters_exits_3_before_anything_starts(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, SMALL)
    world.seed_record(12, "1" * 40, 1)
    world.seed_record(12, "2" * 40, 2)
    before = world.records()
    done = world.run("12", "--round", "3", "--exception", "crash", "--reason", "r" * 301)
    assert done.returncode == 3, why(done)
    assert world.started(before) == []


def test_a_closed_pr_exits_3(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, SMALL)
    world.edit_pr(12, state="CLOSED", closed=True)
    done = world.run("12", "--round", "1")
    assert done.returncode == 3, why(done)
    assert world.started([]) == []


def test_a_head_whose_ci_failed_exits_3_and_claims_no_slot(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    world.pr(12, SMALL, rollup=RED)
    done = world.run("12", "--round", "1")
    assert done.returncode == 3, why(done)
    assert world.started([]) == []


def test_a_head_that_does_not_merge_with_main_exits_3_and_starts_no_lens(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    world.move_main({"web/src/components/badge.tsx": "export const Badge = () => 'main moved'\n"})
    done = world.run("12", "--round", "1")
    assert done.returncode == 3, why(done)
    assert world.claude_calls() == []
    assert world.record(12, head) is None
    assert world.comments() == []
