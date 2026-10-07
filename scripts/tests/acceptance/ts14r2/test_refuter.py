"""S14-R2: one batched refuter, only for the findings replay did not confirm (factory-next.md 8 row 6:
"refuter only for unreplayed findings"; 2: "Code replays each finding's failing test; one batched
Sonnet refuter handles only the rest"; research/review.md 3 step 5b: "ONE Sonnet 5.5 `refuter` process
(high effort) receives all remaining findings of 50 or more in one prompt and returns a verdict per
finding (CONFIRMED / REFUTED / UNPROVEN) with evidence ... UNPROVEN still stands").

- Exactly one refuter process (`claude -p --agent refuter`) runs when any finding of 50 or more was not
  confirmed by its replay (no repro, or a repro that passes), however many lenses found them; it is
  told each of those findings and none other (not a replayed one, not one under 50).
- No refuter runs when every finding of 50 or more replayed, or when there is none.
- Its verdict per finding is what is recorded; it cannot refute a finding replay confirmed, and a
  reply outside its schema refutes nothing.
- It runs on Sonnet 5.5 at high effort, capped like a lens.

Seam assumed (no authority names the refuter's reply): its `structured_output` is
`{"findings": [{"file", "line", "score", "summary", "verdict", "evidence"}]}`, one item per finding it
judged, matched to the finding by `file` and `line`; `verdict` is CONFIRMED, REFUTED or UNPROVEN."""

from collections.abc import Iterator
from typing import Any

import pytest

from scripts import ledger
from scripts.tests.acceptance.ts14r2._world import (
    ATTACK,
    NORMAL,
    PASSING,
    SMALL,
    World,
    flag,
    fresh,
    item,
    judged,
    model_effort,
    prompt_text,
    review_reply,
    why,
)


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


REPLAYS = "tests/test_count_fails.py"
PASSES = "tests/test_flicker_passes.py"
WRITE = {REPLAYS: ATTACK, PASSES: PASSING}

REPLAYED = item(80, 2, "the badge count leaves out a deleted Element", REPLAYS)
REPRO_PASSES = item(70, 3, "the badge flickers when the Takeoff reloads", PASSES)
NO_REPRO = item(60, 1, "the badge shows the count of another Project", None)
LOW = item(30, 4, "the badge could carry a tooltip", None)
NO_REPRO_TOO = item(55, 5, "the badge has no accessible name", None)

TABLE = "vextrus/rates/table.py"
A_UNREPLAYED = item(65, 10, "the rate table drops its last row", None, file=TABLE)
A_REPLAYED = item(75, 11, "a negative rate is accepted", "tests/test_rate_fails.py", file=TABLE)
B_AT_50 = item(50, 20, "a rate of zero is shown as missing", None, file=TABLE)
B_AT_49 = item(49, 21, "the rate names are not sorted", None, file=TABLE)


def refuters(world: World) -> list[dict[str, Any]]:
    return [call for call in world.claude_calls() if call["agent"] == "refuter"]


def expected(lines: list[str], head: str) -> ledger.Decision:
    return ledger.decide("".join(f"{line}\n" for line in lines).encode(), head)


def test_one_refuter_is_told_every_unreplayed_finding_of_50_or_more_and_no_other(world: World) -> None:
    world.pr(12, SMALL)
    world.lenses(review_reply("FIX", [REPLAYED, REPRO_PASSES, NO_REPRO, LOW]), write=WRITE)
    done = world.run("12", "--round", "1")
    calls = refuters(world)
    assert len(calls) == 1, f"{len(calls)} refuter processes; {why(done)}"
    told = prompt_text(calls[0])
    for found in (REPRO_PASSES, NO_REPRO):
        assert found["summary"] in told, f"the refuter is not told: {found['summary']}"
    for found in (REPLAYED, LOW):
        assert found["summary"] not in told, f"the refuter is told: {found['summary']}"


def test_one_refuter_takes_the_unreplayed_findings_of_both_lenses(world: World) -> None:
    world.pr(12, NORMAL)
    world.lenses(
        opus=review_reply("FIX", [A_UNREPLAYED, A_REPLAYED]),
        sonnet=review_reply("FIX", [B_AT_50, B_AT_49]),
        write={"tests/test_rate_fails.py": ATTACK},
    )
    done = world.run("12", "--round", "1")
    assert len(world.lens_calls()) == 2, world.lens_calls()
    calls = refuters(world)
    assert len(calls) == 1, f"{len(calls)} refuter processes; {why(done)}"
    told = prompt_text(calls[0])
    assert A_UNREPLAYED["summary"] in told
    assert B_AT_50["summary"] in told, "a finding of exactly 50 is not sent to the refuter"
    assert A_REPLAYED["summary"] not in told
    assert B_AT_49["summary"] not in told


@pytest.mark.parametrize(
    "findings",
    [[REPLAYED, LOW], [LOW], []],
    ids=["every-serious-finding-replayed", "only-a-finding-under-50", "no-findings"],
)
def test_no_refuter_runs_when_nothing_of_50_or_more_is_left_unreplayed(
    world: World, findings: list[dict[str, object]]
) -> None:
    head = world.pr(12, SMALL)
    world.lenses(review_reply("PASS", findings), write=WRITE)
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    assert world.lens_calls(), "no lens was started"
    assert refuters(world) == [], "a refuter was started"
    assert world.record(12, head) is not None, why(done)


def test_the_refuter_s_verdict_per_finding_is_the_one_recorded(world: World) -> None:
    head = world.pr(12, SMALL)
    world.lenses(
        review_reply("FIX", [REPLAYED, REPRO_PASSES, NO_REPRO, LOW, NO_REPRO_TOO]),
        write=WRITE,
        refuter={
            "findings": [
                judged(REPRO_PASSES, "CONFIRMED"),
                judged(NO_REPRO, "REFUTED"),
                judged(NO_REPRO_TOO, "UNPROVEN"),
            ]
        },
    )
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    want = expected(
        [
            f"VERDICT: FIX at {head}",
            "FINDING f1 80 CONFIRMED",
            "FINDING f2 70 CONFIRMED",
            "FINDING f3 60 REFUTED",
            "FINDING f4 30 -",
            "FINDING f5 55 UNPROVEN",
        ],
        head,
    )
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["verdict"] == want.verdict
    assert record["counts"]["refuted"] == want.counts["refuted"] == 1
    assert record["counts"]["confirmed"] == want.counts["confirmed"] == 2
    assert record["counts"]["unproven"] == want.counts["unproven"] == 1


def test_a_refuted_finding_no_longer_holds_back_a_pass(world: World) -> None:
    head = world.pr(12, SMALL)
    world.lenses(
        review_reply("PASS", [NO_REPRO, LOW]),
        refuter={"findings": [judged(NO_REPRO, "REFUTED")]},
    )
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    want = expected([f"VERDICT: PASS at {head}", "FINDING f1 60 REFUTED", "FINDING f2 30 -"], head)
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["verdict"] == want.verdict == "PASS"


def test_the_refuter_cannot_refute_a_finding_its_replay_confirmed(world: World) -> None:
    head = world.pr(12, SMALL)
    world.lenses(
        review_reply("FIX", [REPLAYED, NO_REPRO]),
        write=WRITE,
        refuter={"findings": [judged(REPLAYED, "REFUTED"), judged(NO_REPRO, "REFUTED")]},
    )
    done = world.run("12", "--round", "1")
    assert done.returncode == 0, why(done)
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["counts"]["confirmed"] == 1, record["counts"]
    assert record["counts"]["refuted"] == 1, record["counts"]
    assert record["verdict"] != "PASS"


@pytest.mark.parametrize(
    "reply",
    [
        {"verdict": "REFUTED"},
        {"findings": "all refuted"},
        {"findings": [{"file": NO_REPRO["file"], "line": NO_REPRO["line"], "verdict": "WRONG"}]},
    ],
    ids=["no-findings-list", "findings-not-a-list", "verdict-not-in-the-enum"],
)
def test_a_refuter_reply_outside_its_schema_refutes_nothing(
    world: World, reply: dict[str, object]
) -> None:
    head = world.pr(12, SMALL)
    world.lenses(review_reply("PASS", [NO_REPRO]), refuter=reply)
    done = world.run("12", "--round", "1")
    assert len(refuters(world)) == 1, f"no refuter was started; {why(done)}"
    record = world.record(12, head)
    assert record is None or (record["verdict"] != "PASS" and record["counts"]["refuted"] == 0), record


def test_the_refuter_runs_on_sonnet_5_5_high_and_is_capped(world: World) -> None:
    world.pr(12, SMALL)
    world.lenses(review_reply("FIX", [NO_REPRO]))
    done = world.run("12", "--round", "1")
    calls = refuters(world)
    assert len(calls) == 1, f"{len(calls)} refuter processes; {why(done)}"
    call = calls[0]
    assert model_effort(call) == ("claude-sonnet-5-5", "high")
    argv: list[str] = call["argv"]
    assert "-p" in argv or "--print" in argv
    assert flag(argv, "--output-format") == "json"
    assert flag(argv, "--json-schema") is not None
    turns, budget = flag(argv, "--max-turns"), flag(argv, "--max-budget-usd")
    assert turns is not None, "the refuter has no --max-turns cap"
    assert int(turns) > 0, "the refuter has no --max-turns cap"
    assert budget is not None, "the refuter has no --max-budget-usd cap"
    assert float(budget) > 0, "the refuter has no --max-budget-usd cap"


def test_the_refuter_s_prompt_never_mentions_the_ledger(world: World) -> None:
    world.pr(12, SMALL)
    world.lenses(review_reply("FIX", [NO_REPRO]))
    done = world.run("12", "--round", "1")
    calls = refuters(world)
    assert len(calls) == 1, f"{len(calls)} refuter processes; {why(done)}"
    assert "ledger" not in prompt_text(calls[0]).lower()
