"""S14-K1 (a): no PR-count WIP cap; the cloud cap is 16. The owner (6 Oct 2026 08:22Z): "from the next
session there should be none like that [the cap is 5 PRs in progress] and at concurrently we can run 16
cloud sessions that we should take full leverage".

So open PRs and launched builders never refuse a launch by their count; a cloud session is refused by
the cloud cap, 16 sessions running (`--running 16`), whatever the usage below a used-up 100%. This
withdraws S14-W1's "a sixth launch is refused naming the WIP cap" and f3's "the cloud cap is 8 whatever
the usage". A builder launch is `governor check <unit> --owns <path>` (S14-W1); see `_world.py`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14k1._world import CLOUD_CAP, OWNS, Scale
from scripts.tests.acceptance.ts14w1._world import assert_ok, launch_record, pr, refusal, show

USAGE = (
    '{{"type": "result", "subtype": "success", "is_error": false, "result": '
    '"Current session: {s}% used\\nCurrent week (all models): {w}% used\\n", '
    '"session_id": "00000000-0000-4000-8000-000000000000"}}'
)


@pytest.fixture
def world(tmp_path: Path) -> Scale:
    return Scale(tmp_path)


def sixteen_in_flight(world: Scale) -> None:
    """Sixteen cloud builders launched, each with its PR open (in review or waiting to merge)."""
    world.launched(*(launch_record(f"s15-{n:02d}", f"s15-{n:02d}") for n in range(1, 17)))
    world.open_prs(
        [pr(600 + n, f"s15-{n:02d}", f"vextrus/m{n:02d}/services/work.py") for n in range(1, 17)]
    )


def names_wip(line: str) -> bool:
    return re.search(r"\bwip\b|in flight", line, re.IGNORECASE) is not None


def test_sixteen_cloud_builders_with_sixteen_open_prs_allow_a_cloud_session(world: Scale) -> None:
    sixteen_in_flight(world)
    assert_ok(world.run("cloud-session", "--running", "15", "--owns", OWNS), "cloud-session")


def test_the_seventeenth_cloud_session_is_refused_by_the_cloud_cap_of_16_not_a_wip_count(
    world: Scale,
) -> None:
    sixteen_in_flight(world)
    line = refusal(world.run("cloud-session", "--running", "16", "--owns", OWNS), "cloud-session")
    assert "16 cloud sessions running, the cap is 16" in line, line
    assert not names_wip(line), f"no WIP count may refuse a launch\n{line}"


def test_open_prs_never_refuse_a_cloud_session_by_their_count(world: Scale) -> None:
    world.open_prs([pr(700 + n, f"s15-wait-{n:02d}", f"docs/notes/n{n:02d}.md") for n in range(30)])
    assert_ok(world.run("cloud-session", "--owns", OWNS), "cloud-session")


def test_open_prs_and_builders_never_refuse_a_local_agent_by_their_count(world: Scale) -> None:
    sixteen_in_flight(world)
    assert_ok(world.run("local-agent", "--owns", OWNS), "local-agent")


@pytest.mark.parametrize(("session", "week"), [(12, 27), (55, 20), (20, 75), (95, 99)])
def test_the_cloud_cap_is_16_whatever_the_usage(world: Scale, session: int, week: int) -> None:
    world.seams["usage"].write_text(USAGE.format(s=session, w=week))
    done = world.run("cloud-session", "--running", str(CLOUD_CAP - 1), "--json")
    assert done.returncode == 0, show(done)
    assert json.loads(done.stdout)["cap"] == CLOUD_CAP, show(done)
    line = refusal(world.run("cloud-session", "--running", str(CLOUD_CAP)), "cloud-session")
    assert f"the cap is {CLOUD_CAP}" in line, line
