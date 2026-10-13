"""S26-FX4: at the round cap, a fix-only delta review, not a cut (the owner's ruling Q-R1, 13 Oct 2026:
"At the round cap: a fix-only delta review, not a cut"; docs/rulings.md `review.round_cap =
delta-review`: "only the fix's own diff and the earlier rounds' attack tests").

Round 3, past the two-round cap, reviews only the fix's own diff (from the head round 2 reviewed to the
new head) and re-runs the earlier rounds' attack tests; when that passes it records PASS in the ledger,
and `merge_ready`'s review gate lets the PR merge. It is a trust boundary (the ledger decides merges):
a delta review never passes a head that is not descended from the reviewed head, nor one whose delta
brings in another branch's work (only a merge of main is not "the fix": `merge_ready.merges_since`
and `ci_gate.is_ready` treat a merge of main as the only commit that needs no review), and it is only
for round 3 after two recorded rounds.

Seams (named here; the ledger's exceptions are its round-3 vocabulary and `merge_ready` reads them):
`python -m scripts.factory.review run <PR> --round 3 --exception delta-review --reason <text>`; the
ledger record's `exception.kind` is then `delta-review`. Fakes only: S14-R1's world (no network, no
model; `gh`, `claude` and `uv` are scripts) with the real pytest for replays.
"""

import pytest

from scripts.tests.acceptance.ts14r1._world import review_reply, why
from scripts.tests.acceptance.ts26fx4._world import (
    BADGE,
    H1,
    H3,
    MAIN_ONLY_TEXT,
    NOTE,
    PR,
    ROUND_ONE_CHANGE,
    ROUND_TWO_CHANGE,
    SIDE_ONLY_TEXT,
    THE_FIX_ITSELF,
    TOTAL,
    DeltaWorld,
    delta,
    finding,
    two_rounds_of_fix,
)


def nothing_new(world: DeltaWorld, calls: int, records: list[str], comments: int) -> list[str]:
    """What a refused round 3 must not have done since the snapshot: no lens, no record, no comment."""
    problems = []
    if len(world.claude_calls()) != calls:
        problems.append(f"claude was started {len(world.claude_calls()) - calls} more time(s)")
    if world.records() != records:
        problems.append(f"the ledger changed: {world.records()}")
    if len(world.comments()) != comments:
        problems.append("a comment was posted")
    return problems


def snapshot(world: DeltaWorld) -> tuple[int, list[str], int]:
    return len(world.claude_calls()), world.records(), len(world.comments())


def test_round_three_delta_review_of_a_clean_fix_records_pass_and_the_gate_lets_it_merge(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    h3 = world.push(PR, H3)
    done = delta(world)
    assert done.returncode == 0, why(done)
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["round"] == 3
    assert record["verdict"] == "PASS", record
    assert record["exception"] is not None
    assert record["exception"]["kind"] == "delta-review", record
    assert world.gate(PR, h3) == []


def test_the_delta_lens_is_handed_the_fix_s_own_diff_and_not_the_lines_earlier_rounds_reviewed(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    before = len(world.lens_calls())
    world.push(PR, H3)
    done = delta(world)
    assert done.returncode == 0, why(done)
    calls = world.lens_calls()[before:]
    assert calls, "round 3 started no lens"
    for call in calls:
        handed = world.handed(call)
        assert THE_FIX_ITSELF in handed, "the lens was not handed the fix's diff"
        assert ROUND_ONE_CHANGE not in handed, "the lens was handed round 1's lines again"
        assert ROUND_TWO_CHANGE not in handed, "the lens was handed round 2's lines again"


def test_round_two_still_reviews_the_whole_change(tmp_path_factory: pytest.TempPathFactory) -> None:
    """Only past the two-round cap: round 2 is a full review (round 1's lines are in what it reads)."""
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    round_two = [call for call in world.lens_calls() if "review round 2" in call["stdin"]]
    assert round_two, "no round-2 lens call was logged"
    assert all(ROUND_ONE_CHANGE in world.handed(call) for call in round_two)


@pytest.mark.parametrize(
    "regressed",
    [
        # Round 3 fixes the total but drops round 1's fix: round 1's attack fails again.
        {TOTAL: H3[TOTAL], BADGE: H1[BADGE]},
        # Round 3 touches the badge only: round 2's attack still fails.
        {BADGE: H1[BADGE].replace("Badge", "Badge2") + "export const COUNT_OK = 1\n"},
    ],
    ids=["round-1-attack-fails-again", "round-2-attack-still-fails"],
)
def test_an_earlier_round_s_attack_test_failing_on_the_fix_keeps_round_three_from_pass(
    tmp_path_factory: pytest.TempPathFactory, regressed: dict[str, str]
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    h3 = world.push(PR, regressed)
    done = delta(world)
    record = world.record(PR, h3)
    assert record is None or record["verdict"] != "PASS", why(done)
    assert world.gate(PR, h3) != [], "merge_ready would merge a head an earlier attack still breaks"


def test_a_finding_of_the_delta_lens_that_could_block_records_fix(
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
    done = delta(world)
    record = world.record(PR, h3)
    assert record is None or record["verdict"] != "PASS", why(done)
    assert world.gate(PR, h3) != []


def test_a_clean_merge_of_main_in_the_delta_is_not_reviewed_as_the_fix(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    world.move_main({NOTE: f"# How to\n{MAIN_ONLY_TEXT}\n"})
    world.merge_into(PR, "main")
    before = len(world.lens_calls())
    h3 = world.push(PR, H3)
    done = delta(world)
    assert done.returncode == 0, why(done)
    record = world.record(PR, h3)
    assert record is not None, why(done)
    assert record["verdict"] == "PASS", why(done)
    for call in world.lens_calls()[before:]:
        handed = world.handed(call)
        assert THE_FIX_ITSELF in handed, "the lens was not handed the fix's diff"
        assert MAIN_ONLY_TEXT not in handed, "main's own lines were handed as the fix"
    assert world.gate(PR, h3) == []


def test_a_head_not_descended_from_the_round_two_head_is_refused_and_nothing_starts(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    h1, _h2 = two_rounds_of_fix(world)
    calls, records, comments = snapshot(world)
    # The branch rewritten on round 1's head: the same end state, but round 2's head is not in it.
    rewritten = world.push(PR, {**H3, BADGE: f"{H1[BADGE]}export const COUNT_OK = 2\n"}, parent=h1)
    done = delta(world)
    assert done.returncode == 3, why(done)
    assert nothing_new(world, calls, records, comments) == []
    assert world.record(PR, rewritten) is None


def test_a_merge_of_another_branch_in_the_delta_is_refused_and_nothing_starts(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    """Another branch's work merged in is neither the fix nor main: it would ride in unreviewed."""
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    two_rounds_of_fix(world)
    side = world.side_branch(
        {"web/src/components/side.tsx": f"export const Side = '{SIDE_ONLY_TEXT}'\n"}
    )
    world.merge_into(PR, side)
    h3 = world.push(PR, H3)
    calls, records, comments = snapshot(world)
    done = delta(world)
    assert done.returncode == 3, why(done)
    assert nothing_new(world, calls, records, comments) == []
    assert world.record(PR, h3) is None


def test_a_delta_review_with_round_two_unrecorded_is_refused_and_nothing_starts(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    world.pr(PR, H1)
    world.lenses(review_reply("FIX", [finding(80, BADGE, None)]))
    done = world.run(str(PR), "--round", "1")
    assert done.returncode == 0, why(done)
    world.lenses(review_reply("PASS"))
    h2 = world.push(PR, H3)
    calls, records, comments = snapshot(world)
    done = delta(world)
    assert done.returncode in (2, 3), why(done)
    assert nothing_new(world, calls, records, comments) == []
    assert world.record(PR, h2) is None


def test_a_delta_review_is_refused_before_the_cap(tmp_path_factory: pytest.TempPathFactory) -> None:
    world = DeltaWorld(tmp_path_factory.mktemp("world"))
    world.pr(PR, H1)
    world.lenses(review_reply("FIX", [finding(80, BADGE, None)]))
    done = world.run(str(PR), "--round", "1")
    assert done.returncode == 0, why(done)
    world.lenses(review_reply("PASS"))
    h2 = world.push(PR, H3)
    calls, records, comments = snapshot(world)
    done = world.run(
        str(PR), "--round", "2", "--exception", "delta-review", "--reason", "too early for the cap"
    )
    assert done.returncode in (2, 3), why(done)
    assert nothing_new(world, calls, records, comments) == []
    assert world.record(PR, h2) is None
