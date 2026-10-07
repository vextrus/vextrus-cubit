"""S14-R2: a lens that fails is reported, never turned into a PASS (factory-next.md 8 row 6: "timeouts,
invalid schema"; research/review.md 3 step 4: "The script enforces a wall timeout per lens (SIGINT,
then SIGTERM)"; review.py's own words for a reply outside the schema: "gave no answer in the review
schema: run the round again").

- A lens past its time cap is killed; the run exits 3 (refused, nothing recorded: review.py's exit
  codes), names the lens, and records no verdict.
- A lens reply that does not match the REVIEW schema (review.py's `REVIEW_SCHEMA`, with its
  `FINDING_SCHEMA`) is reported the same way: exit 3, the lens named, nothing recorded. The authority
  says "run the round again", so it is reported, not retried in the run.

Seam assumed (no authority names one): the per-lens wall cap is read, in seconds, from the
environment variable `VEXTRUS_REVIEW_LENS_TIMEOUT` (default: review.py's own cap)."""

from collections.abc import Iterator
from typing import Any

import pytest

from scripts.tests.acceptance.ts14r2._world import SMALL, World, alive, fresh, item, review_reply, why


@pytest.fixture
def world(tmp_path_factory: pytest.TempPathFactory) -> Iterator[World]:
    yield from fresh(tmp_path_factory)


CAP = {"VEXTRUS_REVIEW_LENS_TIMEOUT": "2"}
HANG_GUARD = 120  # seconds: protection against a run that never ends; no test asserts on time


def test_a_lens_past_its_time_cap_is_killed(world: World) -> None:
    world.extra_env.update(CAP)
    world.pr(12, SMALL)
    world.lenses(hang=("sonnet",))
    world.run("12", "--round", "1", hang=HANG_GUARD)
    pids = world.hung_pids()
    assert pids, "the lens was never started"
    assert not [pid for pid in pids if alive(pid)], f"lens processes still running: {pids}"


def test_a_lens_past_its_time_cap_is_reported_and_nothing_is_recorded(world: World) -> None:
    world.extra_env.update(CAP)
    head = world.pr(12, SMALL)
    world.lenses(hang=("sonnet",))
    done = world.run("12", "--round", "1", hang=HANG_GUARD)
    assert done.returncode == 3, why(done)
    assert "lens-b" in done.stdout + done.stderr, f"the run does not name the lens; {why(done)}"
    assert world.record(12, head) is None
    assert world.comments() == []


def _no_report() -> dict[str, Any]:
    reply = review_reply("PASS", [])
    del reply["report"]
    return reply


def _no_findings() -> dict[str, Any]:
    reply = review_reply("PASS", [])
    del reply["findings"]
    return reply


def _with(**fields: Any) -> dict[str, Any]:
    found = item(20, 2, "the badge could say more", None)
    found.update(fields)
    return review_reply("PASS", [found])


OUTSIDE = {
    "verdict-not-in-the-enum": review_reply("LGTM", []),
    "no-findings": _no_findings(),
    "no-report": _no_report(),
    "score-not-an-integer": _with(score="high"),
    "score-over-100": _with(score=150),
    "negative-line": _with(line=-1),
    "repro-without-its-command": _with(repro={"test_file": "tests/test_x.py"}),
}


@pytest.mark.parametrize("case", list(OUTSIDE))
def test_a_reply_outside_the_review_schema_is_reported_and_never_recorded(
    world: World, case: str
) -> None:
    head = world.pr(12, SMALL)
    world.lenses(sonnet=OUTSIDE[case])
    done = world.run("12", "--round", "1")
    assert world.lens_calls(), f"no lens was started; {why(done)}"
    assert done.returncode == 3, why(done)
    assert "lens-b" in done.stdout + done.stderr, f"the run does not name the lens; {why(done)}"
    assert world.record(12, head) is None


def test_a_result_with_no_structured_output_is_reported_and_never_recorded(world: World) -> None:
    head = world.pr(12, SMALL)
    world.lenses(absent=("sonnet",))
    done = world.run("12", "--round", "1")
    assert world.lens_calls(), f"no lens was started; {why(done)}"
    assert done.returncode == 3, why(done)
    assert "lens-b" in done.stdout + done.stderr, f"the run does not name the lens; {why(done)}"
    assert world.record(12, head) is None
