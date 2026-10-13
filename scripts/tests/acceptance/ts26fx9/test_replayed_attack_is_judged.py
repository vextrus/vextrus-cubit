"""S26-FX9, the orchestrator's ruling 1 and 4: an earlier round's kept attack that fails again on a
delta review's head is a CLAIM, not a confirmed finding. It goes to the round's batched refuter like any
lens finding (the refuter is told the attack file, its original finding and what the replay showed) and
blocks only when the refuter confirms it; a refuted replay does not block and is recorded REFUTED. A
replay that passes still drops its finding; one that fails on the defect and that the refuter confirms
still blocks (a real regression must still block).

Boundary: `python -m scripts.factory.review run <PR> --round 3 --exception delta-review --reason <text>`,
its stdout summary, the ledger record, and `merge_ready`'s review gate. Fakes only (S26-FX4's world).
"""

import pytest

from scripts.tests.acceptance.ts14r1._world import review_reply, why
from scripts.tests.acceptance.ts26fx4._world import BADGE, H3, PR, DeltaWorld, two_rounds_of_fix
from scripts.tests.acceptance.ts26fx9._judged import (
    REGRESSED,
    ROUND_ONE_FILE,
    ROUND_ONE_SUMMARY,
    delta_round,
    on,
    refuter_calls,
    refuter_says,
    summary_of,
)


def test_a_replayed_attack_the_refuter_refutes_does_not_block_and_is_recorded_refuted(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    world.lenses(review_reply("PASS"), refuter=refuter_says("REFUTED"))
    h3 = world.push(PR, REGRESSED)
    done = delta_round(world)
    assert done.returncode == 0, why(done)
    shown = summary_of(done)
    statuses = [item["status"] for item in on(shown, BADGE)]
    assert statuses == ["REFUTED"], f"a refuted replay was not recorded REFUTED: {shown['findings']}"
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["verdict"] == "PASS", f"a refuted replay still blocked: {record}"
    assert world.gate(PR, h3) == []


def test_the_refuter_is_told_the_attack_file_its_original_finding_and_the_replay_s_output(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    world.lenses(review_reply("PASS"), refuter=refuter_says("REFUTED"))
    world.push(PR, REGRESSED)
    before = len(world.claude_calls())
    done = delta_round(world)
    calls = refuter_calls(world, before)
    assert calls, f"no refuter judged the replayed attack: {why(done)}"
    brief = "\n".join(call["stdin"] for call in calls)
    assert ROUND_ONE_FILE in brief, "the refuter was not told the attack file"
    assert ROUND_ONE_SUMMARY in brief, "the refuter was not told the attack's original finding"
    # Only the replay's own output shows the failing test by its id and the assertion it failed on.
    assert "::test_attack" in brief, "the refuter was not told what the replay showed"
    assert "COUNT_OK" in brief, "the refuter was not told what the replay showed"


def test_a_replayed_attack_the_refuter_confirms_still_blocks(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    world.lenses(review_reply("PASS"), refuter=refuter_says("CONFIRMED"))
    h3 = world.push(PR, REGRESSED)
    done = delta_round(world)
    shown = summary_of(done)
    judged = [(item["status"], item["method"]) for item in on(shown, BADGE)]
    assert judged == [("CONFIRMED", "refuter")], f"the replay was not judged by the refuter: {judged}"
    record = world.record(PR, h3)
    assert record is None or record["verdict"] != "PASS", why(done)
    assert world.gate(PR, h3) != [], "merge_ready would merge a head a confirmed regression breaks"


def test_a_replayed_attack_that_passes_drops_its_finding_and_asks_no_refuter(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    h3 = world.push(PR, H3)
    before = len(world.claude_calls())
    done = delta_round(world)
    assert done.returncode == 0, why(done)
    assert refuter_calls(world, before) == [], "a refuter was asked about attacks that passed"
    assert summary_of(done)["findings"] == []
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["verdict"] == "PASS", record
    assert world.gate(PR, h3) == []
