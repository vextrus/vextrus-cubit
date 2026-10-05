"""S14-R2: a rerun of the same round skips the lenses that already finished for that head
(factory-next.md 8 row 6: "rerun skips finished lenses"; 4 step 4: "output kept per head so a rerun
skips finished lenses"; research/review.md 3 step 4: "a rerun skips lenses whose file exists for that
head").

A normal PR runs lens A (an `opus` model) and lens B (a `sonnet` model). In the first run lens A
finishes and lens B fails (past its cap, or a reply outside the schema): nothing is recorded. The rerun
of round 1 starts lens B again but not lens A, and lens A's saved answer is the one used (its finding
is in the run's summary). A lens that did not finish is not finished: it runs again. A new head is a
new review: every lens runs again.

Seam assumed, as in test_lens_failures.py: `VEXTRUS_REVIEW_LENS_TIMEOUT` (seconds)."""

import json
from collections.abc import Iterator

import pytest

from scripts.tests.acceptance.ts14r2._world import (
    NORMAL,
    World,
    fresh,
    git,
    item,
    review_reply,
    values,
    why,
)


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


TABLE = "vextrus/rates/table.py"
DEPTH = item(30, 7, "the rate table repeats a heading row", None, file=TABLE)
ADVERSARY = item(20, 9, "a rate of zero is printed without its unit", None, file=TABLE)
HANG_GUARD = 120


def push_new_head(world: World, number: int) -> str:
    """The builder pushes one more commit to the PR: its head moves."""
    branch = f"pr{number}"
    git(world.main, "switch", "-q", branch)
    (world.main / "README.md").write_text("a new head\n")
    git(world.main, "add", "README.md")
    git(world.main, "commit", "-q", "-m", "a fix round")
    moved = git(world.main, "rev-parse", "HEAD")
    git(
        world.main, "push", "-q", "origin", f"HEAD:refs/heads/{branch}", f"+HEAD:refs/pull/{number}/head"
    )
    git(world.main, "switch", "-q", "main")
    world.edit_pr(number, headRefOid=moved)
    world.heads[str(number)] = moved
    return moved


def kinds(world: World, kind: str) -> int:
    return len([call for call in world.lens_calls() if call["kind"] == kind])


def fail_lens_b(world: World, how: str) -> None:
    if how == "timeout":
        world.extra_env["VEXTRUS_REVIEW_LENS_TIMEOUT"] = "2"
        world.lenses(opus=review_reply("PASS", [DEPTH]), hang=("sonnet",))
    else:
        world.lenses(opus=review_reply("PASS", [DEPTH]), sonnet=review_reply("LGTM", []))


@pytest.mark.parametrize("how", ["timeout", "outside-the-schema"])
def test_a_rerun_of_the_round_starts_only_the_lens_that_did_not_finish(world: World, how: str) -> None:
    head = world.pr(12, NORMAL)
    fail_lens_b(world, how)
    first = world.run("12", "--round", "1", hang=HANG_GUARD)
    assert world.record(12, head) is None, f"the failed run recorded a verdict; {why(first)}"
    assert (kinds(world, "opus"), kinds(world, "sonnet")) == (1, 1), world.lens_calls()
    world.kill_hung()
    world.lenses(opus=review_reply("PASS", [DEPTH]), sonnet=review_reply("PASS", [ADVERSARY]))
    second = world.run("12", "--round", "1", hang=HANG_GUARD)
    assert second.returncode == 0, why(second)
    assert kinds(world, "opus") == 1, "lens A, finished for this head, was started again"
    assert kinds(world, "sonnet") == 2, "lens B, which did not finish, was not started again"
    record = world.record(12, head)
    assert record is not None, why(second)
    assert record["verdict"] == "PASS", record


def test_a_rerun_uses_the_finished_lens_s_saved_answer(world: World) -> None:
    world.pr(12, NORMAL)
    fail_lens_b(world, "outside-the-schema")
    world.run("12", "--round", "1")
    world.lenses(opus=review_reply("PASS", []), sonnet=review_reply("PASS", [ADVERSARY]))
    second = world.run("12", "--round", "1")
    assert second.returncode == 0, why(second)
    assert DEPTH["summary"] in values(json.loads(second.stdout)), (
        f"lens A's saved finding is not in the rerun's summary; {why(second)}"
    )


def test_a_new_head_runs_every_lens_again(world: World) -> None:
    world.pr(12, NORMAL)
    fail_lens_b(world, "outside-the-schema")
    world.run("12", "--round", "1")
    assert kinds(world, "opus") == 1, world.lens_calls()
    push_new_head(world, 12)
    world.lenses(opus=review_reply("PASS", [DEPTH]), sonnet=review_reply("PASS", [ADVERSARY]))
    second = world.run("12", "--round", "1")
    assert kinds(world, "opus") == 2, f"lens A's answer for the old head was reused; {why(second)}"
    assert kinds(world, "sonnet") == 2, world.lens_calls()
