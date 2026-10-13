"""S26-FX4: the delta review works at any round past the cap, not only round 3 (session 26: PRs at
round 3 FIX need round 4 as a delta review). Round 4's base is round 3's head; its lens is handed only
the fix since then; round 3's kept attack re-runs; a round-4 PASS of kind delta-review lets the PR
merge, and the ledger's and merge_ready's round rules hold past round 3."""

from pathlib import Path
from typing import Any

import pytest

from scripts import ledger, merge_ready
from scripts.tests.acceptance.ts14r1._world import review_reply, why
from scripts.tests.acceptance.ts26fx4._world import (
    H3,
    PR,
    THE_FIX_ITSELF,
    TOTAL,
    DeltaWorld,
    delta,
    finding,
    two_rounds_of_fix,
)

ROUND_THREE_ATTACK = "review_attacks/delta/test_r3_fixed.py"
FIXED = "TOTAL_FIXED_IN_ROUND_FOUR"
FIXED_FILE = "web/src/components/total_fixed.tsx"  # its own file: no diff context from round 3's lines


def round_four(world: DeltaWorld) -> Any:
    return world.run(
        str(PR), "--round", "4", "--exception", "delta-review", "--reason", "round 3 asked for a fix"
    )


def round_three_fix(world: DeltaWorld) -> str:
    """Rounds 1 and 2 FIX, then round 3 (a delta review) FIX on a confirmed finding whose attack
    passes only once the total carries FIXED."""
    two_rounds_of_fix(world)
    attack = (
        "from pathlib import Path\n\n\n"
        "def test_attack() -> None:\n"
        f"    path = Path('{FIXED_FILE}')\n"
        f"    assert path.is_file() and '{FIXED}' in path.read_text()\n"
    )
    world.lenses(
        review_reply("FIX", [finding(80, TOTAL, ROUND_THREE_ATTACK)]), write={ROUND_THREE_ATTACK: attack}
    )
    h3 = world.push(PR, H3)
    done = delta(world)
    assert done.returncode == 0, why(done)
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["verdict"] == "FIX", why(done)
    world.lenses(review_reply("PASS"))
    return h3


def test_round_four_delta_review_of_the_fix_records_pass_and_the_gate_lets_it_merge(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    round_three_fix(world)
    before = len(world.lens_calls())
    h4 = world.push(PR, {FIXED_FILE: f"export const FIXED = '{FIXED}'\n"})
    done = round_four(world)
    assert done.returncode == 0, why(done)
    record = world.record(PR, h4)
    assert record is not None, why(done)
    assert (record["round"], record["verdict"]) == (4, "PASS"), record
    assert record["exception"]["kind"] == "delta-review"
    assert world.gate(PR, h4) == []
    calls = world.lens_calls()[before:]
    assert len(calls) == 1, "a delta review runs one lens"
    handed = world.handed(calls[0])
    assert FIXED in handed, "round 4's lens was not handed the fix since round 3"
    assert THE_FIX_ITSELF not in handed, "round 4's lens was handed round 3's lines again"


def test_round_four_with_round_three_s_attack_failing_again_keeps_it_from_pass(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    round_three_fix(world)
    h4 = world.push(PR, {"docs/notes/other.md": "# a fix that fixes nothing\n"})
    done = round_four(world)
    record = world.record(PR, h4)
    assert record is not None, why(done)
    assert record["verdict"] == "FIX", why(done)
    assert world.gate(PR, h4) != []


def test_round_four_is_refused_with_round_three_unrecorded(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    h3 = world.push(PR, H3)
    calls = len(world.claude_calls())
    done = round_four(world)
    assert done.returncode == 3, why(done)
    assert len(world.claude_calls()) == calls
    assert world.record(PR, h3) is None


def write_record(folder: Path, round_: int) -> None:
    head = f"{round_:040x}"
    (folder / f"{PR}-{head}.json").write_text(f'{{"round": {round_}}}')


@pytest.mark.parametrize(
    ("round_", "exception", "recorded", "allowed"),
    [
        (4, "delta-review", [1, 2, 3], True),
        (5, "delta-review", [1, 2, 3, 4], True),
        (4, "delta-review", [1, 2], False),  # round 3 not recorded
        (4, "security75", [1, 2, 3], False),  # past the cap only a delta review
        (4, None, [1, 2, 3], False),
        (3, "delta-review", [1, 2], True),
        (3, "delta-review", [1], False),
        (2, "delta-review", [1], False),
        (ledger.LAST_ROUND + 1, "delta-review", list(range(1, ledger.LAST_ROUND + 1)), False),
    ],
)
def test_the_ledger_s_round_check_past_the_cap(
    tmp_path: Path, round_: int, exception: str | None, recorded: list[int], allowed: bool
) -> None:
    for number in recorded:
        write_record(tmp_path, number)
    if allowed:
        ledger.check_round(tmp_path, PR, round_, exception)
    else:
        with pytest.raises((ledger.Refused, ledger.BadInput)):
            ledger.check_round(tmp_path, PR, round_, exception)


def shaped(round_: int, kind: str | None) -> dict[str, Any]:
    head = "a" * 40
    return {
        "schema_version": 1,
        "pr": PR,
        "head": head,
        "round": round_,
        "verdict": "PASS",
        "counts": dict.fromkeys((*merge_ready.COUNT_KEYS, "unrefuted_ge_50"), 0) | {"reviewers": 1},
        "decision_input_sha256": "b" * 64,
        "comment_id": 7,
        "exception": None if kind is None else {"kind": kind, "reason": "the round cap"},
        "source": "review-pr",
        "recorded_at": "2026-10-13T13:00:00Z",
    }


@pytest.mark.parametrize(
    ("round_", "kind", "ok"),
    [
        (4, "delta-review", True),
        (9, "delta-review", True),
        (3, "delta-review", True),
        (3, "crash", True),
        (4, "security75", False),
        (4, None, False),
        (2, "delta-review", False),
        (10, "delta-review", False),
    ],
)
def test_merge_ready_reads_a_record_past_round_three_only_as_a_delta_review(
    round_: int, kind: str | None, ok: bool
) -> None:
    problems = merge_ready.record_problems(shaped(round_, kind), PR, "a" * 40)
    assert (problems == []) is ok, problems
