"""S29-F7 item 3 (docs/plans/factory-s29.md 7: "the refuter samples one in five off the risk tier").

The sample is decided by code, deterministically, from the PR and its head: an ordinary PR's head is
sampled when `int(sha256("<pr>:<head>").hexdigest(), 16) % 5 == 0`
(`scripts.factory.tiers.refuter_sampled(pr, head) -> bool`), so a test names a PR and head that are
sampled and one that is not. On a sampled ordinary head the refuter runs as today (S17-F6, S28-R1:
one batched refuter when a finding that could block is open); on an unsampled ordinary head no
refuter starts. On the risk tier the refuter runs as today, sample or not.

At `scripts.factory.review run`'s boundary (S14-R1's world): the lens answers one finding of 75 with
no reproduction (one that could block, so today's code always starts the refuter); the fake `claude`
logs each refuter it starts. A finding its own failing test reproduces (the replay, by code) still
blocks on an unsampled head, and one nothing reproduced does not (it is filed): the sample spares the
refuter, never the reproduction (Q21: "A finding blocks only with a reproduction on that head"). The
commits' dates are fixed, so each PR's head, and with it the sample,
is the same on every run."""

import hashlib

import pytest

import scripts.factory.tiers as tiers  # type: ignore[import-not-found, unused-ignore]
from scripts.tests.acceptance.ts14r1._world import ATTACK, World, finding, review_reply, why

HEAD = "0123456789abcdef0123456789abcdef01234567"
ORDINARY = {"web/src/components/table.tsx": "".join(f"export const ROW_{i} = {i}\n" for i in range(600))}
RISK = {"engine/recognise/walls.py": "".join(f"WALL_{i}: int = {i}\n" for i in range(600))}
TRIES = 60
FAILS = "tests/test_attack_fails.py"


def test_a_pr_and_head_whose_hash_is_a_multiple_of_five_is_sampled() -> None:
    assert tiers.refuter_sampled(5, HEAD) is True, "PR 5 at the head: sha256 % 5 == 0, not sampled"


def test_a_pr_and_head_whose_hash_is_not_a_multiple_of_five_is_not_sampled() -> None:
    assert tiers.refuter_sampled(12, HEAD) is False, "PR 12 at the head: sha256 % 5 == 3, sampled"


def test_about_one_head_in_five_is_sampled() -> None:
    heads = [hashlib.sha1(str(i).encode()).hexdigest() for i in range(1000)]
    sampled = sum(tiers.refuter_sampled(900 + i % 50, head) for i, head in enumerate(heads))
    assert sampled == 193, f"scripts.factory.tiers.refuter_sampled sampled {sampled} of 1000"


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> World:
    monkeypatch.setenv("GIT_AUTHOR_DATE", "2026-10-14T12:00:00Z")
    monkeypatch.setenv("GIT_COMMITTER_DATE", "2026-10-14T12:00:00Z")
    made = World(tmp_path_factory.mktemp("world"))
    made.lenses(review_reply("FIX", [finding(75, None)]))
    return made


def opened(world: World, changes: dict[str, str], sampled: bool) -> int:
    """The first PR number (from 101) whose head the sample takes (`sampled`) or leaves."""
    for number in range(101, 101 + TRIES):
        head = world.pr(number, changes)
        if tiers.refuter_sampled(number, head) is sampled:
            return number
    pytest.fail(f"no PR of {TRIES} was {'sampled' if sampled else 'left'}")


def refuters(world: World) -> int:
    return len([call for call in world.claude_calls() if call["agent"] == "refuter"])


def test_an_unsampled_ordinary_pr_gets_no_refuter(world: World) -> None:
    pr = opened(world, ORDINARY, sampled=False)
    done = world.run(str(pr), "--round", "1")
    assert done.returncode == 0, why(done)
    record = world.record(pr, world.heads[str(pr)])
    assert (refuters(world), record and record["verdict"]) == (0, "PASS"), (
        f"scripts.factory.review started {refuters(world)} refuter(s) on an unsampled ordinary PR "
        f"and recorded {record and record['verdict']} for its unreproduced 75"
    )


def test_a_sampled_ordinary_pr_gets_the_refuter(world: World) -> None:
    pr = opened(world, ORDINARY, sampled=True)
    done = world.run(str(pr), "--round", "1")
    assert done.returncode == 0, why(done)
    assert refuters(world) == 1, (
        f"scripts.factory.review started {refuters(world)} refuter(s) on a sampled ordinary PR"
    )


def test_an_unsampled_risk_pr_still_gets_the_refuter(world: World) -> None:
    pr = opened(world, RISK, sampled=False)
    done = world.run(str(pr), "--round", "1")
    assert done.returncode == 0, why(done)
    assert refuters(world) == 1, (
        f"scripts.factory.review started {refuters(world)} refuter(s) on an unsampled risk PR"
    )


def test_an_unsampled_ordinary_pr_still_blocks_on_a_reproduced_finding(world: World) -> None:
    world.lenses(review_reply("FIX", [finding(75, FAILS)]), write={FAILS: ATTACK})
    pr = opened(world, ORDINARY, sampled=False)
    done = world.run(str(pr), "--round", "1")
    assert done.returncode == 0, why(done)
    record = world.record(pr, world.heads[str(pr)])
    assert (refuters(world), record and record["verdict"]) == (0, "FIX"), (
        f"scripts.factory.review started {refuters(world)} refuter(s) on an unsampled ordinary PR "
        f"and recorded {record and record['verdict']} for its reproduced 75"
    )
