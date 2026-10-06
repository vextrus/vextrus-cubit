"""Ticket S14-W1 (#455): the WIP cap. "WIP cap 5 ... in `governor.py`"; acceptance check: "the governor
refuses a sixth launch" (session-13 close, factory-next.md 8 row 5). WIP, from the critic the plan cites
(C 2.1): "WIP = number of PRs that are building, in review, or have a PASS waiting. Cap at 5 total";
"At most 5 builders in flight" (factory-next.md 8).

So the work in flight is the union of the builder registry's launched builders (cloud or local) whose
branch has not landed, and the open PRs (a PR whose branch has a launch record counts once). A builder
launch is `governor check <unit> --owns <path>`. See `_world.py` for the seams.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14w1._world import (
    World,
    assert_ok,
    launch_record,
    pr,
    refusal,
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


@pytest.mark.parametrize("unit", ["cloud-session", "local-agent"])
def test_a_sixth_launch_is_refused_naming_the_wip_cap(world: World, unit: str) -> None:
    four_in_flight(world)
    world.open_prs(
        [
            pr(461, "s14-d", "vextrus/takeoff/services/d.py"),
            pr(463, "s13-older", "vextrus/takeoff/services/e.py"),  # an open PR with no launch here
        ]
    )
    line = refusal(world.check(unit, OWNS), unit)
    assert re.search(r"\bwip\b", line, re.IGNORECASE), f"the reason should name the WIP cap\n{line}"
    assert re.search(r"(?<!\d)5(?!\d)", line), f"the reason should name the cap, 5\n{line}"


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
