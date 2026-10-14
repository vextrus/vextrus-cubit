"""S26-FX4: the delta review works at any round past the cap, not only round 3 (session 26: PRs at
round 3 FIX need round 4 as a delta review). Round 4's base is round 3's head; its lens is handed only
the fix since then; round 3's kept attack re-runs; a round-4 PASS of kind delta-review lets the PR
merge, and the ledger's and merge_ready's round rules hold past round 3."""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger, merge_ready
from scripts.factory import review
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


def kept_round(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[review.Run, Path, Path]:
    """Round 1 kept: one standing finding with an attack file, one standing with none."""
    main, rv = tmp_path / "main", tmp_path / "rv"
    (rv / "review_attacks" / "lens-b").mkdir(parents=True)
    (rv / "review_attacks" / "lens-b" / "test_a.py").write_text("def test_a() -> None:\n    pass\n")
    head = "c" * 40
    one = review.Run(PR, 1, head=head)
    one.findings = [
        review.Finding("l1-f1", 80, TOTAL, 1, "the total is wrong", "review_attacks/lens-b/test_a.py",
                       word="CONFIRMED", method="replay"),
        review.Finding("l1-f2", 90, TOTAL, 2, "UNTESTED_FINDING", None, word="CONFIRMED",
                       method="refuter"),
        # S28-R1: a lens's UNPROVEN finding does not stand, so it is never kept for a later round.
        review.Finding("l1-f3", 90, TOTAL, 3, "UNPROVEN_FINDING", None, word="UNPROVEN"),
    ]  # fmt: skip
    review.keep_attacks(one, rv, main)
    monkeypatch.setattr(ledger, "round_head", lambda _dir, _pr, _round: head)
    return review.Run(PR, 2, head="d" * 40, merged="d" * 40, slot=1), main, rv


def test_a_standing_finding_with_no_attack_test_is_handed_to_the_next_delta_lens(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    run, main, _rv = kept_round(tmp_path, monkeypatch)
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    assert [number for number, _where, _manifest in earlier] == [1]
    assert any("UNTESTED_FINDING" in line for line in run.earlier_text), run.earlier_text
    assert not any("UNPROVEN_FINDING" in line for line in run.earlier_text), run.earlier_text


@pytest.mark.parametrize(
    "outcome",
    [
        {"outcome": "did not fail by name", "exit": 2},  # a collection error: no FAILED line
        {"outcome": "timed out after 1200 seconds", "exit": None},
        {"outcome": "did not fail by name", "exit": 5},  # nothing ran
    ],
    ids=["error", "timeout", "nothing-ran"],
)
def test_an_earlier_attack_that_does_not_exit_zero_blocks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, outcome: dict[str, Any]
) -> None:
    run, main, rv = kept_round(tmp_path, monkeypatch)
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    monkeypatch.setattr(review, "git", lambda *_args, **_kw: "")

    def replay(where: Path, _slot: int, name: str) -> bool:
        review.REPLAYS[(str(where), name)] = outcome
        return False

    monkeypatch.setattr(review, "replay", replay)
    monkeypatch.setattr(review, "mark_on_tree", lambda *_args: None)
    claims = review.replay_earlier(run, rv, main, earlier)
    # A failed replay is a claim for the refuter, never CONFIRMED by replay alone (S26-FX9).
    assert [(item.id, item.word, item.method) for item in claims] == [("r1-l1-f1", "UNPROVEN", None)]
    assert claims[0].score >= ledger.BLOCK_AT
    assert run.findings == []


def test_an_earlier_attack_that_passes_adds_nothing_that_blocks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    run, main, rv = kept_round(tmp_path, monkeypatch)
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    monkeypatch.setattr(review, "git", lambda *_args, **_kw: "")

    def replay(where: Path, _slot: int, name: str) -> bool:
        review.REPLAYS[(str(where), name)] = {
            "outcome": "did not fail by name",
            "exit": 0,
            "summary": {"passed": 1},
        }
        return False

    monkeypatch.setattr(review, "replay", replay)
    assert review.replay_earlier(run, rv, main, earlier) == []
    assert run.findings == []


def test_an_earlier_attack_that_skips_every_test_blocks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PR #789 review 1 (80): exit 0 with no test passed (all skipped) is not a fix."""
    run, main, rv = kept_round(tmp_path, monkeypatch)
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    monkeypatch.setattr(review, "git", lambda *_args, **_kw: "")

    def replay(where: Path, _slot: int, name: str) -> bool:
        review.REPLAYS[(str(where), name)] = {
            "outcome": "did not fail by name",
            "exit": 0,
            "summary": {"skipped": 1},
        }
        return False

    monkeypatch.setattr(review, "replay", replay)
    monkeypatch.setattr(review, "mark_on_tree", lambda *_args: None)
    claims = review.replay_earlier(run, rv, main, earlier)
    assert [(item.id, item.word) for item in claims] == [("r1-l1-f1", "UNPROVEN")]


@pytest.mark.parametrize(
    ("output", "counts"),
    [
        ("===== 3 passed in 0.01s =====", {"passed": 3}),
        ("1 passed, 1 warning in 0.01s", {"passed": 1, "warning": 1}),
        # The refuter of PR #789's fix round: a warning's or a skip reason's own words never count.
        ("UserWarning: report said 7 passed in 2s\n== 1 skipped, 1 warning in 0.01s ==",
         {"skipped": 1, "warning": 1}),
        ("SKIPPED [1] t.py:3: only 3 passed checks apply\n1 skipped in 0.01s", {"skipped": 1}),
        ("no summary at all", {}),
    ],
)  # fmt: skip
def test_the_replay_reads_only_pytest_s_summary_line(output: str, counts: dict[str, int]) -> None:
    assert review.summary_counts(output) == counts


@pytest.mark.parametrize(
    ("summary", "fixed"),
    [
        ({"passed": 2}, True),
        ({"passed": 1, "warning": 3}, True),
        ({"passed": 1, "skipped": 1}, False),  # the attack itself may be the skipped one
        ({"passed": 1, "xfailed": 1}, False),
        ({"passed": 1, "xpassed": 1}, False),
        ({"skipped": 2}, False),
        ({}, False),
    ],
)
def test_an_earlier_attack_reads_fixed_only_when_every_test_passed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, summary: dict[str, int], fixed: bool
) -> None:
    run, main, rv = kept_round(tmp_path, monkeypatch)
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    monkeypatch.setattr(review, "git", lambda *_args, **_kw: "")

    def replay(where: Path, _slot: int, name: str) -> bool:
        review.REPLAYS[(str(where), name)] = {"outcome": "x", "exit": 0, "summary": summary}
        return False

    monkeypatch.setattr(review, "replay", replay)
    monkeypatch.setattr(review, "mark_on_tree", lambda *_args: None)
    assert (review.replay_earlier(run, rv, main, earlier) == []) is fixed


@pytest.mark.parametrize(
    ("word", "method"),
    [("CONFIRMED", "refuter")],  # S28-R1: a lens's UNPROVEN one is not kept at all
    ids=["refuter-confirmed"],
)
def test_a_standing_finding_its_own_round_did_not_replay_is_handed_as_text_never_replayed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, word: str, method: str | None
) -> None:
    """PR #789 review 1 (80): an attack that never failed on its own round proves nothing by passing
    later; its finding goes to the next delta lens as text."""
    main, rv = tmp_path / "main", tmp_path / "rv"
    (rv / "review_attacks" / "lens-b").mkdir(parents=True)
    (rv / "review_attacks" / "lens-b" / "test_a.py").write_text("def test_a() -> None:\n    pass\n")
    head = "c" * 40
    one = review.Run(PR, 1, head=head)
    one.findings = [
        review.Finding("l1-f1", 80, TOTAL, 1, "MISSED_BY_ITS_TEST", "review_attacks/lens-b/test_a.py",
                       word=word, method=method),
    ]  # fmt: skip
    review.keep_attacks(one, rv, main)
    manifest = review.attacks_dir(main, PR, head) / review.MANIFEST
    assert [entry["test_file"] for entry in __import__("json").loads(manifest.read_text())] == [None]
    assert not (review.attacks_dir(main, PR, head) / "review_attacks").exists()
    monkeypatch.setattr(ledger, "round_head", lambda _dir, _pr, _round: head)
    run = review.Run(PR, 2, head="d" * 40, merged="d" * 40, slot=1)
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    assert any("MISSED_BY_ITS_TEST" in line for line in run.earlier_text), run.earlier_text
    monkeypatch.setattr(review, "git", lambda *_args, **_kw: "")
    monkeypatch.setattr(review, "replay", lambda *_args: pytest.fail("replayed"))
    review.replay_earlier(run, rv, main, earlier)
    assert run.findings == []


def test_a_finding_the_bar_files_is_never_kept(tmp_path: Path) -> None:
    """PR #789 review 1 (75): an edge 60 off a trust boundary is filed; it must not block later."""
    main, rv = tmp_path / "main", tmp_path / "rv"
    (rv / "review_attacks" / "lens-b").mkdir(parents=True)
    (rv / "review_attacks" / "lens-b" / "test_a.py").write_text("def test_a() -> None:\n    pass\n")
    head = "c" * 40
    one = review.Run(PR, 1, head=head)
    filed = review.Finding("l1-f1", 60, TOTAL, 1, "an edge", "review_attacks/lens-b/test_a.py",
                           word="CONFIRMED", method="replay", kind="edge", boundary=False,
                           on_tree=True)  # fmt: skip
    assert not filed.could_block
    one.findings = [filed]
    review.keep_attacks(one, rv, main)
    assert not review.attacks_dir(main, PR, head).exists()


def test_an_earlier_attack_replays_from_its_own_path_so_it_finds_the_repository(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PR #789 review 1 (75): an attack that locates the worktree from its own file
    (`Path(__file__).resolve().parents[2]`) still does when it is replayed."""
    run, main, rv = kept_round(tmp_path, monkeypatch)
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    (rv / "review_attacks" / "lens-b" / "test_a.py").unlink()  # the clean between rounds
    monkeypatch.setattr(review, "git", lambda *_args, **_kw: "")
    seen: list[Path] = []

    def replay(where: Path, _slot: int, name: str) -> bool:
        seen.append((where / name).resolve().parents[2])
        review.REPLAYS[(str(where), name)] = {
            "outcome": "did not fail by name",
            "exit": 0,
            "summary": {"passed": 1},
        }
        return False

    monkeypatch.setattr(review, "replay", replay)
    review.replay_earlier(run, rv, main, earlier)
    assert seen == [rv.resolve()]
    assert run.findings == []


FAILED_HERE = (
    "review_attacks/lens-b/test_a.py:5: AssertionError\n"
    "FAILED review_attacks/lens-b/test_a.py::test_a - AssertionError: no TOTAL_OK\n"
)


@pytest.mark.parametrize(
    ("output", "place"),
    [
        (FAILED_HERE, "review_attacks/lens-b/test_a.py::test_a at review_attacks/lens-b/test_a.py:5"),
        # --tb=line prints the absolute path
        (("/x/rv1/review_attacks/lens-b/test_a.py:9: AssertionError: guard\n"
          "FAILED review_attacks/lens-b/test_a.py::test_a - AssertionError: guard\n"),
         "review_attacks/lens-b/test_a.py::test_a at review_attacks/lens-b/test_a.py:9"),
        # a collection error is no failure by name: always elsewhere
        ("ERROR review_attacks/lens-b/test_a.py - AssertionError: guard\n", None),
        ("______ ERROR collecting review_attacks/lens-b/test_a.py ______\nE   AssertionError\n", None),
        # a captured log's ERROR line changes nothing
        (FAILED_HERE + "ERROR    x:test_a.py:5 boom\n",
         "review_attacks/lens-b/test_a.py::test_a at review_attacks/lens-b/test_a.py:5"),
        ("1 passed in 0.01s\n", None),
        # --tb=no, or pytest.fail(pytrace=False): no line of the test file is printed
        ("FAILED review_attacks/lens-b/test_a.py::test_a - Failed: guard\n",
         "review_attacks/lens-b/test_a.py::test_a"),
    ],
    ids=["long", "line", "collection-error", "collection-header", "a-logged-error", "passed",
         "no-traceback"],
)  # fmt: skip
def test_failed_at_names_the_failing_tests_and_their_lines_in_the_attack(
    output: str, place: str | None
) -> None:
    assert review.failed_at(output, "review_attacks/lens-b/test_a.py") == place
    collected = review.collection_error(output, "review_attacks/lens-b/test_a.py")
    assert collected is output.startswith(("ERROR review_attacks", "______ ERROR collecting"))


def test_keep_attacks_keeps_where_the_attack_failed_on_its_own_round(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    main, rv = tmp_path / "main", tmp_path / "rv"
    (rv / "review_attacks" / "lens-b").mkdir(parents=True)
    (rv / "review_attacks" / "lens-b" / "test_a.py").write_text("def test_a() -> None:\n    pass\n")
    one = review.Run(PR, 1, head="c" * 40)
    item = review.Finding("l1-f1", 80, TOTAL, 1, "the total is wrong", "review_attacks/lens-b/test_a.py",
                          word="CONFIRMED", method="replay")  # fmt: skip
    item.replayed = {"failed_at": "THE_PLACE"}
    one.findings = [item]
    review.keep_attacks(one, rv, main)
    manifest = json.loads((review.attacks_dir(main, PR, "c" * 40) / review.MANIFEST).read_text())
    assert [entry["failed_at"] for entry in manifest] == ["THE_PLACE"]


OWN = "t.py::test_one t.py::test_two[1] at t.py:5 t.py:9"


NO_TB = "FAILED t.py::test_one - Failed: guard\n"
TB = "t.py:5: AssertionError\nFAILED t.py::test_one - AssertionError\n"


@pytest.mark.parametrize(
    ("own", "now", "elsewhere"),
    [
        # a signature without lines (--tb=no, --tb=native, pytrace=False) is compared by test id
        (NO_TB, NO_TB, False),
        (NO_TB, TB, False),
        (TB, NO_TB, False),
        (NO_TB, "FAILED t.py::test_two - Failed: guard\n", True),
        (TB, "FAILED t.py::test_two - Failed: guard\n", True),
        (TB, TB, False),
        (TB, "t.py:3: AssertionError\nFAILED t.py::test_one - AssertionError\n", True),
    ],
    ids=["none-none", "none-lines", "lines-none", "none-other-test", "lines-other-test",
         "lines-lines", "lines-other-line"],
)  # fmt: skip
def test_a_replay_without_a_traceback_is_judged_by_its_test_id(
    own: str, now: str, elsewhere: bool
) -> None:
    """Review round 1 of PR 808 (52, 50): a lines-free signature read STALE whatever failed."""
    place = review.failed_at(own, "t.py")
    assert place is not None
    assert review.fails_elsewhere(place, {"failed_at": review.failed_at(now, "t.py")}) is elsewhere


@pytest.mark.parametrize("own", ["t.py::test_one at", "t.py::test_one at "])
def test_a_kept_signature_with_a_dangling_at_reads_as_no_lines(own: str) -> None:
    assert review.fails_elsewhere(own, {"failed_at": "t.py::test_one"}) is False
    assert review.fails_elsewhere(own, {"failed_at": "t.py::test_two at t.py:5"}) is True


@pytest.mark.parametrize(
    ("shown", "word"),
    [
        ({"exit": 1, "summary": {"failed": 1}, "failed_at": OWN}, "UNPROVEN"),
        # the refuter of this ticket: a partial fix leaves test_two failing at line 9
        ({"exit": 1, "summary": {"failed": 1}, "failed_at": "t.py::test_two[1] at t.py:9"},
         "UNPROVEN"),
        ({"exit": 1, "summary": {"failed": 1}, "failed_at": "t.py::test_one at t.py:3"}, "STALE"),
        ({"exit": 2, "summary": {"error": 1}, "failed_at": None, "collection_error": True},
         "STALE"),
        # a timeout, a skip, nothing run: never stale, the refuter judges them
        ({"outcome": "timed out", "exit": None}, "UNPROVEN"),
        ({"exit": 0, "summary": {"skipped": 1}, "failed_at": None}, "UNPROVEN"),
        ({"exit": 5, "summary": {}, "failed_at": None}, "UNPROVEN"),
    ],
    ids=["same-place", "partial-fix", "elsewhere", "collection-error", "timeout", "skip", "none-ran"],
)  # fmt: skip
def test_a_replay_failing_elsewhere_than_on_its_own_round_is_stale_and_handed_as_text(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, shown: dict[str, Any], word: str
) -> None:
    run, main, rv = kept_round(tmp_path, monkeypatch)
    where = review.attacks_dir(main, PR, "c" * 40)
    manifest = json.loads((where / review.MANIFEST).read_text())
    for entry in manifest:
        entry["failed_at"] = OWN if entry["test_file"] else None
    (where / review.MANIFEST).write_text(json.dumps(manifest))
    earlier = review.earlier_rounds(run, main, tmp_path / "ledger")
    monkeypatch.setattr(review, "git", lambda *_args, **_kw: "")

    def replay(at: Path, _slot: int, name: str) -> bool:
        review.REPLAYS[(str(at), name)] = dict(shown)
        return False

    monkeypatch.setattr(review, "replay", replay)
    monkeypatch.setattr(review, "mark_on_tree", lambda *_args: None)
    claims = review.replay_earlier(run, rv, main, earlier)
    judged = [(item.id, item.word) for item in [*claims, *run.stale]]
    assert judged == [("r1-l1-f1", word)]
    handed = "\n".join(run.earlier_text)
    assert ("the total is wrong" in handed) is (word == "STALE"), handed


@pytest.mark.parametrize(
    ("findings", "rests"),
    [
        ({"r1-l1-f1": ledger.Judged(80, "UNPROVEN", None)}, True),
        ({"r1-l1-f1": ledger.Judged(80, "CONFIRMED", None)}, False),  # the refuter confirmed it
        ({"r1-l1-f1": ledger.Judged(80, "UNPROVEN", None),
          "l1-f1": ledger.Judged(80, "CONFIRMED", None)}, False),  # a lens finding stands too
        # S28-R1: a lens's UNPROVEN finding does not stand, so it does not rule the replay out.
        ({"r1-l1-f1": ledger.Judged(80, "UNPROVEN", None),
          "l1-f1": ledger.Judged(80, "UNPROVEN", None)}, True),
        ({"r1-l1-f1": ledger.Judged(80, "REFUTED", None)}, False),  # nothing stands: PASS
    ],
    ids=["unproven-replay", "confirmed-replay", "lens-finding", "unproven-lens-finding", "refuted"],
)  # fmt: skip
def test_a_fix_rests_on_replays_only_when_no_refuter_confirmed_one_and_no_lens_finding_stands(
    findings: dict[str, ledger.Judged], rests: bool
) -> None:
    decision = ledger.judge(["PASS"], findings, "0" * 64)
    assert decision.replays_only is rests, decision


def seed(store: Path, name: str, round_: int, verdict: str, *, replays_only: bool | None) -> None:
    record: dict[str, Any] = {
        "schema_version": 1, "pr": PR, "head": "a" * 40, "round": round_, "verdict": verdict,
        "counts": {"reviewers": 1, "findings": 1, "findings_ge_50": 1, "confirmed": 0, "refuted": 0,
                   "unproven": 1, "unrefuted_ge_50": 0},
        "decision_input_sha256": "0" * 64, "comment_id": round_,
        "exception": {"kind": ledger.DELTA, "reason": "the cap"}, "source": "review-pr",
        "recorded_at": "2026-10-13T00:00:00Z",
    }  # fmt: skip
    if replays_only is not None:
        record["replays_only"] = replays_only
    store.mkdir(parents=True, exist_ok=True)
    (store / name).write_text(json.dumps(record))


@pytest.mark.parametrize(
    ("verdict", "replays_only", "round_", "exception", "allowed"),
    [
        ("FIX", True, 4, ledger.DELTA, True),
        ("FIX", None, 4, ledger.DELTA, False),  # a FIX on a lens or refuter-confirmed finding
        ("FIX", True, 4, None, False),  # only a delta review
        ("FIX", True, 5, ledger.DELTA, False),  # only the very next round
        ("PASS", None, 4, ledger.DELTA, False),
    ],
)
def test_a_head_is_re_reviewed_only_after_a_fix_resting_only_on_unconfirmed_replays(
    tmp_path: Path,
    verdict: str,
    replays_only: bool | None,
    round_: int,
    exception: str | None,
    allowed: bool,
) -> None:
    store = tmp_path / "ledger"
    seed(store, f"{PR}-{'a' * 40}.json", 3, verdict, replays_only=replays_only)
    if allowed:
        ledger.check_head(store, PR, "a" * 40, round_, exception)
        assert ledger.record_path(store, PR, "a" * 40, round_).name == f"{PR}-{'a' * 40}-r{round_}.json"
    else:
        with pytest.raises(ledger.Refused, match="reviewed once"):
            ledger.check_head(store, PR, "a" * 40, round_, exception)


@pytest.mark.parametrize(("replays_only", "ok"), [(True, True), (None, False)])
def test_merge_ready_reads_a_same_head_record_only_after_a_fix_resting_on_replays(
    tmp_path: Path, replays_only: bool | None, ok: bool
) -> None:
    store = tmp_path / "ledger"
    seed(store, f"{PR}-{'a' * 40}.json", 3, "FIX", replays_only=replays_only)
    seed(store, f"{PR}-{'a' * 40}-r4.json", 4, "PASS", replays_only=None)
    assert ledger.newest_record(store, PR, "a" * 40)["round"] == 4  # type: ignore[index]
    facts = {"pr": PR, "head": "a" * 40, "base": "b" * 40,
             "comments": [{"id": 4, "body": f"<!-- vextrus-review round=4 head={'a' * 40} "
                                            "verdict=PASS findings=1 -->"}]}  # fmt: skip
    problems = merge_ready.ledger_problems(facts, store, tmp_path)
    assert (problems == []) is ok, problems
