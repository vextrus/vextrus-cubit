"""S26-FX9, the orchestrator's ruling 2: a replay whose failure is a staleness guard (the replay's output
shows the failing assertion is a guard on the seam the attack replicates, not the check that failed on
the attack's own round, or the file errors while pytest collects it) is recorded STALE (inconclusive),
never CONFIRMED by replay alone, and its original finding is handed to the delta lens as text.

The case of PR #771, round 6: the fix rewrote the line the attack's guard reads, so the attack failed at
its guard, before any check of the defect, and the fixed PR was blocked. Here the delta lens finds
nothing on the handed text, so the fixed head records PASS and may merge.

Boundary: `review run <PR> --round 3 --exception delta-review`, its stdout summary (a finding's
`status`), the lens's prompt and the files it names, the ledger record and `merge_ready`'s review gate.
"""

import pytest

from scripts.tests.acceptance.ts14r1._world import why
from scripts.tests.acceptance.ts26fx4._world import PR, TOTAL, DeltaWorld
from scripts.tests.acceptance.ts26fx9._judged import (
    FIXED_REWRITTEN,
    GUARD_AT_COLLECTION,
    GUARD_IN_TEST,
    STALE_SUMMARY,
    delta_round,
    guarded_rounds,
    on,
    summary_of,
)

GUARDS = pytest.mark.parametrize(
    "attack", [GUARD_IN_TEST, GUARD_AT_COLLECTION], ids=["guard-in-the-test", "guard-at-collection"]
)


@GUARDS
def test_a_replay_that_fails_at_its_staleness_guard_is_recorded_stale(
    tmp_path_factory: pytest.TempPathFactory, attack: str
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    guarded_rounds(world, attack)
    world.push(PR, FIXED_REWRITTEN)
    done = delta_round(world)
    assert done.returncode == 0, why(done)
    statuses = [item["status"] for item in on(summary_of(done), TOTAL)]
    assert statuses == ["STALE"], f"a replay stale at its guard was recorded {statuses}"


@GUARDS
def test_a_stale_replay_does_not_block_a_fixed_head(
    tmp_path_factory: pytest.TempPathFactory, attack: str
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    guarded_rounds(world, attack)
    h3 = world.push(PR, FIXED_REWRITTEN)
    done = delta_round(world)
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["verdict"] == "PASS", f"a stale replay blocked a fixed head: {record}"
    assert world.gate(PR, h3) == []


@GUARDS
def test_a_stale_replay_s_original_finding_is_handed_to_the_delta_lens(
    tmp_path_factory: pytest.TempPathFactory, attack: str
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    guarded_rounds(world, attack)
    world.push(PR, FIXED_REWRITTEN)
    before = len(world.lens_calls())
    done = delta_round(world)
    calls = world.lens_calls()[before:]
    assert calls, f"no delta lens ran: {why(done)}"
    for call in calls:
        assert STALE_SUMMARY in world.handed(call), (
            "the stale replay's finding was not handed to the lens"
        )
