"""Ticket 21c, the check's switch to the job (docs/plans/M0.md, 21c: "21c's posting run is the first in
`--job` mode ...; from its merge the job is the default"; `scripts/real_drawings/command.py`: "`--job`
(21a; off by default until 21c) ... Until 21c makes it the default, `--job` is refused with `--score`
and on a posting run").

The command's fake sandbox (`world.py`) on invented sets, as 21a's `test_job_mode.py` runs it.
"""

from pathlib import Path

import pytest

from scripts.real_drawings import command, sandbox
from scripts.real_drawings.command import run
from scripts.real_drawings.tests.world import World, make_world


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    binaries = tmp_path / "postgresql-18" / "bin"
    binaries.mkdir(parents=True)
    (binaries / "initdb").write_text("#!/bin/sh\n")
    monkeypatch.setattr(sandbox, "PG_BIN", binaries)
    return make_world(tmp_path / "world")


def test_the_head_is_read_with_the_products_job_by_default(world: World) -> None:
    world.commit("tuning", {"engine/read.py": "X = 1\n"})

    run("tuning", no_post=True, m=world.machine())

    assert world.sandbox_runs[0].job is True
    assert "-m vextrus.takeoff.services.export" in sandbox.script(world.sandbox_runs[0])


def test_the_command_line_reads_with_the_job_without_being_asked(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(command, "owners_machine", world.machine)

    assert command.main(["main", "--no-post"]) == 0

    assert world.sandbox_runs[0].job is True


def test_a_posting_run_reads_the_head_with_the_job(world: World) -> None:
    world.pr(57, {"engine/read.py": "X = 2\n"})

    run("57", no_post=False, m=world.machine(), accept_if_clean=True)

    assert world.sandbox_runs, "the posting run read nothing"
    assert world.sandbox_runs[0].job is True
