"""Ticket S14-W1 (#455): the WIP cap. "WIP cap 5 ... in `governor.py`"; acceptance check: "the governor
refuses a sixth launch" (session-13 close, factory-next.md 8 row 5). WIP, from the critic the plan cites
(C 2.1): "WIP = number of PRs that are building, in review, or have a PASS waiting. Cap at 5 total";
"At most 5 builders in flight" (factory-next.md 8).

So the work in flight is the union of the builder registry's launched builders (cloud or local) whose
branch has not landed, and the open PRs (a PR whose branch has a launch record counts once). A builder
launch is `governor check <unit> --owns <path>`. See `_world.py` for the seams.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14w1._world import (
    World,
    assert_ok,
    launch_record,
    pr,
)

OWNS = "vextrus/projects/services/brand_new.py"


def four_in_flight(world: World) -> None:
    """Four pieces of work in flight: two cloud builders and a local one with no PR yet, and a cloud
    builder whose PR is open (counted once, not twice)."""
    world.launched(
        launch_record("s14-a", "s14-a"),
        launch_record("s14-b", "s14-b"),
        launch_record("s14-c", "s14-c", where="local"),
        launch_record("s14-d", "s14-d"),
    )
    world.open_prs([pr(461, "s14-d", "vextrus/takeoff/services/d.py")])


@pytest.fixture
def world(tmp_path: Path) -> World:
    return World(tmp_path)


# "A sixth launch is refused naming the WIP cap" was withdrawn by S14-K1 (the owner, 6 Oct 2026: "there
# should be none like that"): scripts/tests/acceptance/ts14k1/test_no_wip_cap.py pins no WIP cap.


def test_a_fifth_launch_is_allowed(world: World) -> None:
    four_in_flight(world)
    assert_ok(world.check("cloud-session", OWNS), "cloud-session")


def test_a_landed_builder_leaves_the_wip_count(world: World) -> None:
    four_in_flight(world)
    world.launched(launch_record("s14-e", "s14-e"))
    world.open_prs(
        [
            pr(461, "s14-d", "vextrus/takeoff/services/d.py"),
            pr(450, "s14-e", "vextrus/takeoff/services/e.py", state="MERGED"),
        ]
    )
    assert_ok(world.check("cloud-session", OWNS), "cloud-session")


def test_a_refused_launch_is_not_in_flight(world: World) -> None:
    four_in_flight(world)
    world.launched(launch_record("s14-f", "s14-f", ok=False))
    assert_ok(world.check("cloud-session", OWNS), "cloud-session")


def test_a_reviewer_launch_is_not_a_builder_in_flight(world: World) -> None:
    four_in_flight(world)
    world.launched(launch_record("s14-g", "review/461-0123abcd", role="reviewer"))
    assert_ok(world.check("cloud-session", OWNS), "cloud-session")
