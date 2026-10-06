"""S15-R3b (issue #521, wanted item 2): "A committed head-replay driver (`--replay-head`) that reviews a
merged PR's head against its own base with no ledger write, so the gate can be rerun. Today the replay
ran through a private driver."

The seam (named here; the builder documents it in review.py's docstring):

    python -m scripts.factory.review run <PR> --replay-head

- It takes a merged PR (`gh` answers `state` MERGED): a replay is never refused for being merged.
- It reviews the PR's own head (`headRefOid`) against the PR's own base: the change merging it made, as
  the review saw it then. Main as it is now is not the base (a merged head merged with today's main
  changes nothing), and nothing main gained after the merge is in the tree the lenses read.
- It writes no ledger record (no file under the ledger folder is made or changed) and posts no PR
  comment; a head the ledger already holds is replayed all the same.
- It prints its findings as one JSON object, the last line of its stdout:
  `{"pr", "head", "findings": [{"file", "line", "score", "status", ...}, ...]}`, the review result
  `scripts.factory.replay` scores.

The lenses are the world's fake `claude` (no model is called).
"""

import subprocess
from collections.abc import Iterator

import pytest

from scripts.tests.acceptance.ts15r3b._world import (
    NORMAL,
    World,
    fresh,
    item,
    printed,
    review_reply,
    show,
    tree_has,
    why,
)

TABLE = "vextrus/rates/table.py"
FOUND = item(75, 40, "the rate table drops the last rate", None, file=TABLE)


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


def merged_pr(world: World, number: int = 12) -> str:
    """PR `number` (NORMAL's change) cut from main and merged; its head."""
    head = world.pr(number, NORMAL)
    world.merge(number)
    return head


def replayed(world: World, number: int = 12) -> subprocess.CompletedProcess[str]:
    done = world.replay_head(number)
    assert done.returncode == 0, f"review run --replay-head: {why(done)}"
    return done


def test_a_merged_pr_is_replayed_and_its_findings_printed_as_json(world: World) -> None:
    head = merged_pr(world)
    world.lenses(review_reply("FIX", [FOUND]))
    done = replayed(world)
    out = printed(done)
    assert out.get("pr") == 12, out
    assert out.get("head") == head, f"the printed head is not the PR's head: {out.get('head')}"
    findings = out.get("findings")
    assert isinstance(findings, list), out
    assert any(
        f.get("file") == TABLE and f.get("line") == 40 and f.get("score") == 75 for f in findings
    ), f"the lens's finding is not among the printed findings: {findings}"
    for found in findings:
        assert {"file", "line", "score", "status"} <= set(found), found


def test_a_replay_writes_no_ledger_record(world: World) -> None:
    head = merged_pr(world)
    world.lenses(review_reply("FIX", [FOUND]))
    before = world.ledger_files()
    replayed(world)
    assert world.lens_calls(), "no lens was started"
    assert world.record(12, head) is None, "the replay wrote a ledger record"
    assert world.ledger_files() == before, "the replay changed the ledger folder"


def test_a_replay_posts_no_pr_comment(world: World) -> None:
    merged_pr(world)
    world.lenses(review_reply("FIX", [FOUND]))
    replayed(world)
    assert world.comments() == [], f"the replay posted a comment: {world.comments()}"
    assert not [argv for argv in world.gh_calls() if argv[:2] == ["pr", "comment"]]


def test_a_head_the_ledger_already_holds_is_replayed_and_its_record_left_as_it_was(
    world: World,
) -> None:
    head = merged_pr(world)
    world.seed_record(12, head, 2)  # its last round, already recorded
    before = world.ledger_files()
    world.lenses(review_reply("FIX", [FOUND]))
    done = replayed(world)
    assert world.lens_calls(), f"no lens was started; {why(done)}"
    assert printed(done).get("head") == head
    assert world.ledger_files() == before, "the replay changed the ledger folder"


def test_the_lenses_read_the_pr_s_change_against_its_own_base_not_main_as_it_is_now(
    world: World,
) -> None:
    head = world.pr(12, NORMAL)
    world.move_main({"vextrus/rates/before.py": "BEFORE: int = 1\n"})
    world.merge(12)
    world.move_main({"vextrus/rates/after.py": "AFTER: int = 2\n"})
    world.lenses(review_reply("PASS"))
    done = replayed(world)
    calls = world.lens_calls()
    assert calls, f"no lens was started (the replay found nothing to review?); {why(done)}"
    for call in calls:
        reviewed = call["head"]
        assert reviewed, call["cwd"]
        assert show(world, reviewed, TABLE) == NORMAL[TABLE].rstrip("\n"), (
            "the lens's tree lacks the PR's change"
        )
        assert not tree_has(world, reviewed, "vextrus/rates/after.py"), (
            "the lens's tree holds a file main gained after the PR merged"
        )
        assert call["pr"] == "12", call["pr"]
    assert printed(done).get("head") == head
