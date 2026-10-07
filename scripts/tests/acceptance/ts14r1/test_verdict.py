"""S14-R1: the verdict and the Record, by code (factory-next.md 8 row 4; research/review.md 3 steps 5-7,
6 "Add"; issue #453): given fixture lens replies, the verdict recorded in the ledger is the one
`ledger decide` gives for the same lines (PASS, FIX, BLOCK, and a finding of 50 or more confirmed by
replaying its failing test in rv<N>); the record is made through scripts.ledger (the record file
appears and the ledger's one marker comment is posted); a finding of 50 or more nobody confirmed or
refuted is never recorded as a PASS, nor a lens reply for another head; each run appends one line to
`.private/work/factory/review-cost.jsonl` and prints one JSON object.

The expected verdict is computed here with `scripts.ledger.decide` itself, never typed."""

import json
from typing import Any

import pytest

from scripts import ledger
from scripts.tests.acceptance.ts14r1._world import (
    ATTACK,
    BASE_FILES,
    LENS_COST,
    SMALL,
    World,
    finding,
    review_reply,
    values,
    why,
)

FAILS = "tests/test_attack_fails.py"
PASSES = "tests/test_attack_passes.py"

CASES = {
    # name: (lens verdict, findings, files the lens writes, the lines `ledger decide` is given)
    "pass": ("PASS", [finding(30, None)], {}, ["VERDICT: PASS at {h}", "FINDING f1 30 -"]),
    "fix": (
        "FIX",
        [finding(70, FAILS)],
        {FAILS: ATTACK},
        ["VERDICT: FIX at {h}", "FINDING f1 70 CONFIRMED"],
    ),
    "block": (
        "BLOCK",
        [finding(90, FAILS)],
        {FAILS: ATTACK},
        ["VERDICT: BLOCK at {h}", "FINDING f1 90 CONFIRMED"],
    ),
    "replayed": (
        "PASS",
        [finding(60, FAILS)],
        {FAILS: ATTACK},
        ["VERDICT: PASS at {h}", "FINDING f1 60 CONFIRMED"],
    ),
}


def expected(lines: list[str], head: str) -> ledger.Decision:
    return ledger.decide("".join(f"{line.format(h=head)}\n" for line in lines).encode(), head)


@pytest.mark.parametrize("case", list(CASES))
def test_the_recorded_verdict_is_the_one_ledger_decide_gives(
    tmp_path_factory: pytest.TempPathFactory, case: str
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    verdict, findings, write, lines = CASES[case]
    head = world.pr(12, SMALL)
    world.lenses(review_reply(verdict, findings), write=write)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    want = expected(lines, head)
    record = world.record(12, head)
    assert record is not None, f"no ledger record {12}-{head}.json; {why(done)}"
    assert record["verdict"] == want.verdict
    assert record["round"] == 1
    assert record["head"] == head
    assert (record["counts"]["confirmed"] > 0) == (want.counts["confirmed"] > 0)
    assert record["counts"]["refuted"] == 0
    assert [comment["pr"] for comment in world.comments()] == ["12"], "the ledger's marker comment, once"


@pytest.mark.parametrize("case", ["fix", "replayed"])
def test_a_finding_is_replayed_by_its_failing_test_in_the_runnable_worktree(
    tmp_path_factory: pytest.TempPathFactory, case: str
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    verdict, findings, write, _ = CASES[case]
    world.pr(12, SMALL)
    world.lenses(review_reply(verdict, findings), write=write)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    lens_dirs = {call["cwd"] for call in world.lens_calls()}
    replays = [
        call
        for call in world.uv_calls()
        if call["argv"][:1] == ["run"]
        and any(FAILS in part for part in call["argv"])
        and call["cwd"] in lens_dirs
    ]
    assert replays, f"no replay of {FAILS} in the lens's worktree: {world.uv_calls()}"
    assert all(call["db"] and call["db"].startswith("vextrus_rv_slot") for call in replays)


@pytest.mark.parametrize(
    ("repro", "write"),
    [(PASSES, {PASSES: "def test_attack() -> None:\n    pass\n"}), (None, {})],
    ids=["its-test-passes", "no-repro"],
)
def test_a_finding_of_50_or_more_nobody_confirmed_is_never_recorded_as_a_pass(
    tmp_path_factory: pytest.TempPathFactory, repro: str | None, write: dict[str, str]
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    world.lenses(review_reply("PASS", [finding(60, repro)]), write=write)
    done = world.run("12", "--round", "1")
    assert world.lens_calls(), f"no lens was started; {why(done)}"
    record = world.record(12, head)
    assert record is None or record["verdict"] != "PASS", record


def test_a_lens_reply_for_another_head_is_never_recorded_as_a_pass(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    world.lenses(review_reply("PASS", [], head="f" * 40))
    done = world.run("12", "--round", "1")
    assert world.lens_calls(), f"no lens was started; {why(done)}"
    record = world.record(12, head)
    assert record is None or record["verdict"] != "PASS", record


def test_each_run_appends_one_cost_line(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    lensed = world.pr(12, SMALL)
    allowlist = "tools/leakscan/allowlist.txt"
    plain = world.pr(
        13,
        {
            allowlist: BASE_FILES[allowlist]
            + "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7\n"
        },
    )
    first = world.run("12", "--round", "1")
    assert first.returncode == 0, why(first)
    assert len(world.cost_lines()) == 1
    second = world.run("13", "--round", "1")
    assert second.returncode == 0, why(second)
    lines = world.cost_lines()
    assert len(lines) == 2
    assert all(isinstance(line, dict) for line in lines)
    assert lensed in values(lines[0])
    assert 12 in values(lines[0])
    assert LENS_COST in values(lines[0]), "the lens's total_cost_usd is not in the cost line"
    assert plain in values(lines[1])
    assert 13 in values(lines[1])


def test_the_run_prints_one_json_object_naming_the_head(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = World(tmp_path_factory.mktemp("world"))
    head = world.pr(12, SMALL)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    summary: Any = json.loads(done.stdout)
    assert isinstance(summary, dict)
    assert head in values(summary)
