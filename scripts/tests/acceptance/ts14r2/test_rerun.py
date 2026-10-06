"""S14-R2: every `review run` starts every required lens fresh for its own (pr, head, round); no lens
answer from an earlier run is reused
(factory-next.md 8 row 6: "rerun skips finished lenses"; 4 step 4: "output kept per head so a rerun
skips finished lenses"; research/review.md 3 step 4: "a rerun skips lenses whose file exists for that
head"; superseded by the owner's ruling, 6 Oct 2026 06:30Z, on PR #501: "Narrow: drop answer reuse".
The PR's code runs as the orchestrator's user without a sandbox (#488), so any saved answer can be
forged: a lens answer left on disk from an earlier run, or one for another PR, is never read).

A normal PR runs lens A (an `opus` model) and lens B (a `sonnet` model). In the first run lens A
finishes and lens B fails (past its cap, or a reply outside the schema): nothing is recorded. The rerun
of round 1 starts both lenses again, and the recorded verdict comes from the rerun's answers only. A
PASS answer planted where an earlier run of this PR, head and round would keep it is never read: the
lenses start and their FIX is recorded. A new head is a new review: every lens runs again.

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
RERUN_DEPTH = item(25, 11, "the rate table sorts codes as text", None, file=TABLE)
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


def plant_pass(world: World, pr: int, head: str, round_: int) -> None:
    """A PASS answer for each lens, in the shape and at the place the head before the owner's ruling
    kept a finished lens's answer for this PR, head and round (as a PR's unsandboxed code could)."""
    out = world.main / ".private" / "work" / "factory" / "review" / "out"
    out.mkdir(parents=True, exist_ok=True)
    base = git(world.main, "rev-parse", "main")
    for label, model in (("lens-a", "claude-opus-5-5"), ("lens-b", "claude-sonnet-5-5")):
        planted = {
            "head": head,
            "base": base,
            "agent": "pr-reviewer",
            "model": model,
            "review": review_reply("PASS", [], head=head),
            "attacks": {},
        }
        (out / f"{pr}-{head}-r{round_}-{label}.done.json").write_text(json.dumps(planted))


@pytest.mark.parametrize("how", ["timeout", "outside-the-schema"])
def test_a_rerun_of_the_round_starts_every_lens_again(world: World, how: str) -> None:
    head = world.pr(12, NORMAL)
    fail_lens_b(world, how)
    first = world.run("12", "--round", "1", hang=HANG_GUARD)
    assert world.record(12, head) is None, f"the failed run recorded a verdict; {why(first)}"
    assert (kinds(world, "opus"), kinds(world, "sonnet")) == (1, 1), world.lens_calls()
    world.kill_hung()
    world.lenses(opus=review_reply("FIX", [RERUN_DEPTH]), sonnet=review_reply("PASS", [ADVERSARY]))
    second = world.run("12", "--round", "1", hang=HANG_GUARD)
    assert kinds(world, "opus") == 2, (
        f"lens A, finished in the first run, was not started again; {why(second)}"
    )
    assert kinds(world, "sonnet") == 2, "lens B, which did not finish, was not started again"
    record = world.record(12, head)
    assert record is not None, why(second)
    assert record["verdict"] == "FIX", f"the verdict is not from the rerun's answers: {record}"


def test_a_rerun_records_only_the_rerun_s_answers(world: World) -> None:
    world.pr(12, NORMAL)
    fail_lens_b(world, "outside-the-schema")
    world.run("12", "--round", "1")
    world.lenses(opus=review_reply("PASS", [RERUN_DEPTH]), sonnet=review_reply("PASS", [ADVERSARY]))
    second = world.run("12", "--round", "1")
    assert second.returncode == 0, why(second)
    summary = values(json.loads(second.stdout))
    assert DEPTH["summary"] not in summary, (
        f"the first run's finding of lens A is in the rerun's summary; {why(second)}"
    )
    assert RERUN_DEPTH["summary"] in summary, (
        f"the rerun's finding of lens A is not in its summary; {why(second)}"
    )


def test_a_planted_pass_answer_for_this_head_and_round_is_never_read(world: World) -> None:
    head = world.pr(12, NORMAL)
    plant_pass(world, 12, head, 1)
    world.lenses(opus=review_reply("FIX", [DEPTH]), sonnet=review_reply("FIX", [ADVERSARY]))
    done = world.run("12", "--round", "1")
    assert (kinds(world, "opus"), kinds(world, "sonnet")) == (1, 1), (
        f"a planted answer stood in for a lens: {world.lens_calls()}; {why(done)}"
    )
    record = world.record(12, head)
    assert record is not None, why(done)
    assert record["verdict"] == "FIX", f"the planted PASS was recorded: {record}"


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
