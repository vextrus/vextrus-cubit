"""S17-F6, the review bar: review.py refutes a sample, and records the bar end to end.

The owner's ruling (7 Oct 2026, session 17): "... and refuting a sample rather than every finding." The
session-16 retro (RC2): 616 findings of 50 or more, 11 refuted (1.8 %); the refuter mostly adds time.

The sampling rule this ticket pins (deterministic):

- a finding "could block" when it scores 75 or more, or 50 or more on a strict path
  (`review_tiers.toml` `[strict] paths`);
- the one batched refuter starts only when some finding that could block was not confirmed by its
  replay, and it is told every such finding;
- it is also told at most 3 of the other unreplayed findings of 50-74 (off the strict paths), the
  highest-scored first; the rest are told nothing and stand unjudged, filed rather than fixed;
- with no unreplayed finding that could block, no refuter starts.

And review.py hands the ledger each finding's file, so a lens's PASS with a replayed 74 off the strict
paths is recorded PASS, and with a replayed 50 on one, FIX.

Runs review.py in S14-R2's world (`scripts/tests/acceptance/ts14r2/_world.py`: a fake `claude`, `gh`
and `uv`, no network); the refuter's reply is as there: one item per judged finding, by file and line."""

from collections.abc import Iterator
from typing import Any

import pytest

from scripts.tests.acceptance.ts14r2._world import (
    ATTACK,
    SMALL,
    World,
    fresh,
    item,
    judged,
    prompt_text,
    review_reply,
    why,
)

BADGE = "web/src/components/badge.tsx"  # off the strict paths
RATES = "vextrus/rates/table.py"
MIGRATION = "vextrus/platform/migrations/0003_row_level_security.py"
REPLAYS = "tests/test_count_fails.py"

BLOCKER = item(90, 40, "the badge counts the Elements of another tenant", None, file=BADGE)
O74 = item(74, 41, "the badge rounds the count of Columns down", None, file=BADGE)
O70 = item(70, 42, "the badge hides a count of zero", None, file=BADGE)
O65 = item(65, 43, "the badge repeats the Storey name twice", None, file=BADGE)
O60 = item(60, 44, "the badge colour is not the token colour", None, file=BADGE)
O55 = item(55, 45, "the badge tooltip is cut at twenty letters", None, file=BADGE)
OTHERS = [O74, O70, O65, O60, O55]


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


def refuters(world: World) -> list[dict[str, Any]]:
    return [call for call in world.claude_calls() if call["agent"] == "refuter"]


def told(world: World, done: Any) -> str:
    calls = refuters(world)
    assert len(calls) == 1, f"{len(calls)} refuter processes; {why(done)}"
    return prompt_text(calls[0])


def test_no_refuter_starts_when_no_unreplayed_finding_could_block(world: World) -> None:
    head = world.pr(12, SMALL)
    world.lenses(review_reply("PASS", [O74, O60]))
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.lens_calls(), "no lens was started"
    assert refuters(world) == [], "a refuter was started for findings that cannot block"
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["verdict"] == "PASS"


def test_the_refuter_is_told_every_unreplayed_finding_that_could_block(world: World) -> None:
    world.pr(12, SMALL)
    strict_60 = item(60, 50, "a rate of zero is priced as missing", None, file=RATES)
    strict_50 = item(50, 51, "the policy lets a second tenant read a row", None, file=MIGRATION)
    world.lenses(review_reply("FIX", [BLOCKER, strict_60, strict_50]))
    done = world.run("12", "--round", "1")
    text = told(world, done)
    for found in (BLOCKER, strict_60, strict_50):
        assert found["summary"] in text, f"the refuter is not told: {found['summary']}"


def test_at_most_three_others_ride_along_the_highest_scored_first(world: World) -> None:
    world.pr(12, SMALL)
    world.lenses(review_reply("FIX", [O55, O60, BLOCKER, O65, O70, O74]))
    done = world.run("12", "--round", "1")
    text = told(world, done)
    for found in (BLOCKER, O74, O70, O65):
        assert found["summary"] in text, f"the refuter is not told: {found['summary']}"
    for found in (O60, O55):
        assert found["summary"] not in text, f"the refuter is told: {found['summary']}"


def test_the_others_left_unjudged_do_not_block_once_the_blocker_is_refuted(world: World) -> None:
    head = world.pr(12, SMALL)
    world.lenses(
        review_reply("PASS", [BLOCKER, *OTHERS]),
        refuter={"findings": [judged(BLOCKER, "REFUTED")]},
    )
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["verdict"] == "PASS", f"the record says {record['verdict']}"
    assert record["counts"]["refuted"] == 1, record["counts"]


def test_a_pass_with_a_replayed_74_off_a_strict_path_is_recorded_pass(world: World) -> None:
    head = world.pr(12, SMALL)
    found = item(74, 2, "the badge count leaves out a deleted Element", REPLAYS, file=BADGE)
    world.lenses(review_reply("PASS", [found]), write={REPLAYS: ATTACK})
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["counts"]["confirmed"] == 1, record["counts"]
    assert record["verdict"] == "PASS", f"the record says {record['verdict']}"


def test_a_pass_with_a_replayed_50_on_a_strict_path_is_recorded_fix(world: World) -> None:
    head = world.pr(12, SMALL)
    found = item(50, 2, "a negative rate is accepted", REPLAYS, file=RATES)
    world.lenses(review_reply("PASS", [found]), write={REPLAYS: ATTACK})
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["counts"]["confirmed"] == 1, record["counts"]
    assert record["verdict"] == "FIX", f"the record says {record['verdict']}"
