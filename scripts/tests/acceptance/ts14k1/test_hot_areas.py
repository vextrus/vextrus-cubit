"""S14-K1 (d): the hot-file areas at full scale. The owner (6 Oct 2026 08:22Z) asks for "maximum
performance"; the orchestrator's brief for the ticket: "the area cap does not refuse two tickets in
different areas; keep its hot-file protection, but raise it to at least 3 per area unless a hot file is
shared". So: a launch whose owned file an open PR changes is still refused naming that PR (S14-W1); an
area allows a third open PR or builder on other files; the area cap (the governor's `AREA_CAP`, at least
3) still refuses when that many hold the area, naming them. This withdraws S14-W1's "a launch in a hot
area with two open PRs is refused". See `_world.py`."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.factory import governor
from scripts.tests.acceptance.ts14k1._world import Scale
from scripts.tests.acceptance.ts14w1._world import assert_ok, names_pr, pr, refusal

AREAS = {
    "step1-chain": [
        "vextrus/takeoff/http/step1.py",
        "vextrus/takeoff/services/step1.py",
        "vextrus/takeoff/schemas/step1.py",
        "vextrus/takeoff/services/step1_*.py",
    ],
    "web-model": ["web/src/takeoff/model.ts", "web/src/takeoff/model_*.ts"],
}
OWNS = "vextrus/takeoff/services/step1.py"


@pytest.fixture
def world(tmp_path: Path) -> Scale:
    return Scale(tmp_path, hot_areas=AREAS)


def area_prs(count: int) -> list[dict[str, object]]:
    """`count` open PRs in the step1 area, none on the launch's own file."""
    paths = ["vextrus/takeoff/schemas/step1.py", "vextrus/takeoff/http/step1.py"]
    paths += [f"vextrus/takeoff/services/step1_part{n}.py" for n in range(count)]
    return [pr(800 + n, f"s15-area-{n}", paths[n]) for n in range(count)]


def test_the_area_cap_is_at_least_3() -> None:
    assert governor.AREA_CAP >= 3


def test_a_third_ticket_in_one_area_is_allowed(world: Scale) -> None:
    world.open_prs(area_prs(2))
    assert_ok(world.run("cloud-session", "--owns", OWNS), "cloud-session")


def test_two_tickets_in_different_areas_are_not_refused_by_the_area_cap(world: Scale) -> None:
    world.open_prs([*area_prs(governor.AREA_CAP), pr(850, "s15-web-a", "web/src/takeoff/model_a.ts")])
    assert_ok(world.run("cloud-session", "--owns", "web/src/takeoff/model.ts"), "cloud-session")


def test_the_area_cap_still_refuses_a_full_area_naming_its_prs(world: Scale) -> None:
    full = area_prs(governor.AREA_CAP)
    world.open_prs([*full, pr(899, "s15-docs", "docs/research/unrelated.md")])
    line = refusal(world.run("cloud-session", "--owns", OWNS), "cloud-session")
    for row in full:
        assert names_pr(line, int(str(row["number"]))), line
    assert not names_pr(line, 899), f"a PR outside the area is not a blocker\n{line}"


def test_a_launch_sharing_a_hot_file_with_an_open_pr_is_refused_naming_it(world: Scale) -> None:
    world.open_prs([pr(870, "s15-same", OWNS), pr(871, "s15-other", "web/src/takeoff/model.ts")])
    line = refusal(world.run("cloud-session", "--owns", OWNS), "cloud-session")
    assert names_pr(line, 870), line
    assert not names_pr(line, 871), f"a PR on other files is not a blocker\n{line}"
