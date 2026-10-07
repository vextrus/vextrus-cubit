"""S14-K1 (b): six local agents. The owner (6 Oct 2026 08:22Z): "we should take full leverage with 4-6
local sessions". So the governor allows a local agent while 5 run and refuses one while 6 run (rows of
`claude agents --json --all` with a `pid` and a `kind` other than `interactive`, f3's G8 rule, kept),
in its existing words, "<n> local agents running, the most is <cap>". The memory floor (MemAvailable -
0.9 GB >= 5.4 GB), swap (over 2 GB used) and disk (under 30 GB free) still refuse first: a machine
short of any refuses whatever the count. This withdraws f3's "at most three local agents"."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14k1._world import (
    LOCAL_AGENTS,
    OWNS,
    Scale,
    agent_row,
    live_agents,
)
from scripts.tests.acceptance.ts14w1._world import assert_ok, refusal


@pytest.fixture
def world(tmp_path: Path) -> Scale:
    return Scale(tmp_path)


def test_a_sixth_local_agent_is_allowed_while_five_run(world: Scale) -> None:
    world.agents(live_agents(LOCAL_AGENTS - 1))
    assert_ok(world.run("local-agent", "--owns", OWNS), "local-agent")


def test_a_seventh_local_agent_is_refused_while_six_run(world: Scale) -> None:
    world.agents(live_agents(LOCAL_AGENTS))
    line = refusal(world.run("local-agent", "--owns", OWNS), "local-agent")
    assert "6 local agents running, the most is 6" in line, line


def test_only_rows_with_a_pid_that_are_not_interactive_count(world: Scale) -> None:
    world.agents(
        [
            *live_agents(LOCAL_AGENTS - 1),
            *(agent_row(f"done-{n}", "done", pid=None) for n in range(4)),
            agent_row("the-orchestrator", "working", pid=4300, kind="interactive"),
        ]
    )
    assert_ok(world.run("local-agent", "--owns", OWNS), "local-agent")


def test_a_low_memory_machine_still_refuses_the_second_local_agent(world: Scale) -> None:
    world.agents(live_agents(1))
    world.machine(mem_gb=5.5)
    line = refusal(world.run("local-agent", "--owns", OWNS), "local-agent")
    assert "memory" in line.lower(), line


@pytest.mark.parametrize(
    ("reading", "word"),
    [({"mem_gb": 5.5}, "memory"), ({"swap_used_gb": 2.5}, "swap"), ({"disk_gb": 25.0}, "disk")],
)
def test_the_machine_floors_refuse_under_the_local_agent_cap(
    world: Scale, reading: dict[str, float], word: str
) -> None:
    world.agents(live_agents(LOCAL_AGENTS - 1))
    world.machine(**reading)
    line = refusal(world.run("local-agent", "--owns", OWNS), "local-agent")
    assert word in line.lower(), line
    assert "local agents running" not in line, f"5 local agents are under the cap of 6\n{line}"
