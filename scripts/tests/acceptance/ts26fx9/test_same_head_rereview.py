"""S26-FX9, the orchestrator's ruling 3: a delta-review round may run on the same head as the previous
recorded round when that round's FIX rested only on replayed attacks (a re-review after a stale or
refuted replay); otherwise a same-head round stays refused, and nothing starts.

Boundary: `review run <PR> --round 4 --exception delta-review --reason <text>` on the head round 3
recorded, its exit and stdout summary, the `claude` calls, the ledger records and comments, and
`merge_ready`'s review gate.
"""

import pytest

from scripts.tests.acceptance.ts14r1._world import review_reply, why
from scripts.tests.acceptance.ts26fx4._world import (
    H3,
    PR,
    TOTAL,
    DeltaWorld,
    finding,
    two_rounds_of_fix,
)
from scripts.tests.acceptance.ts26fx9._judged import (
    REGRESSED,
    delta_round,
    refuter_says,
    summary_of,
)


def test_a_delta_round_on_the_same_head_runs_when_the_last_fix_rested_only_on_replayed_attacks(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    h3 = world.push(PR, REGRESSED)
    # Round 3: the delta lens finds nothing; round 1's attack fails again, and the refuter proves
    # nothing either way, so round 3 records FIX on the replayed attack alone.
    done = delta_round(world)
    assert done.returncode == 0, why(done)
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["verdict"] == "FIX", record
    # Round 4 re-reviews the same head; this time the refuter refutes the replayed attack.
    world.lenses(review_reply("PASS"), refuter=refuter_says("REFUTED"))
    done = delta_round(world, 4)
    assert done.returncode == 0, (
        f"a same-head re-review after a replay-only FIX was refused: {why(done)}"
    )
    shown = summary_of(done)
    assert (shown["round"], shown["head"], shown["verdict"]) == (4, h3, "PASS"), shown
    assert world.gate(PR, h3) == []


def test_a_delta_round_on_the_same_head_stays_refused_when_the_last_fix_rested_on_a_lens_finding(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    attack = "review_attacks/lens-b/test_r3_total.py"
    world.lenses(
        review_reply("FIX", [finding(80, TOTAL, attack)]),
        write={attack: "def test_attack() -> None:\n    assert False, 'the total is still wrong'\n"},
    )
    h3 = world.push(PR, H3)
    done = delta_round(world)
    assert done.returncode == 0, why(done)
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["verdict"] == "FIX", record
    world.lenses(review_reply("PASS"), refuter=refuter_says("REFUTED", file=TOTAL))
    calls, records, comments = len(world.claude_calls()), world.records(), len(world.comments())
    done = delta_round(world, 4)
    assert done.returncode == 3, why(done)
    assert len(world.claude_calls()) == calls, "a lens or refuter started on a refused round"
    assert world.records() == records, "the ledger changed on a refused round"
    assert len(world.comments()) == comments, "a comment was posted on a refused round"
    assert world.gate(PR, h3) != []
