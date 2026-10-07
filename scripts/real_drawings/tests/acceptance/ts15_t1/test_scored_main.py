"""Ticket S15-T1, "a scored run accepts a PR-cached export" (it supersedes #199: "A scored run of main
refuses an export cached by a PR's run (run id names the PR head, commit names main)"; the fix it asks
for: "record which commit the export was read at under a run id that names it ... and a test").

A PR's posting run reads main too when the PR changes the reading, and caches main's export. A later
scored run that finds that export in the cache (a scored run of main, or a posting run of a PR whose
reading is main's) is scored by the blind scorer, not refused; the export is taken from the cache, not
read again (`--fresh` was the workaround). The scorer's own checks stay (ticket 24f's tests:
an edited or hand-made export is still refused).

`world.py`'s fake sandbox, whose harness names the run it was started for in each export it writes
(as the real one does, from `VEXTRUS_RUN_ID` and `VEXTRUS_COMMIT`); the real scorer
(`tools/scorer/score.py`) on an invented key, as the key user runs it. No drawing, no network.
"""

import dataclasses
import json
import os
from pathlib import Path

import pytest

from scripts.real_drawings.command import Machine, run
from scripts.real_drawings.tests.world import World, make_world
from tools.scorer import score as scorer

SET = "invented-a"
READING_CHANGE: dict[str, str | None] = {"engine/qx_reader.py": "QX_READER = 1\n"}
"""A PR's change to the engine's reading: its run reads main as well as its head."""


@pytest.fixture
def world(tmp_path: Path) -> World:
    world = make_world(tmp_path / "world")

    def the_run_the_harness_names(scratch: Path) -> None:
        env = world.sandbox_runs[-1].env
        for export in scratch.glob("export-*.json"):
            document = json.loads(export.read_text())
            document["run"] = {"id": env["VEXTRUS_RUN_ID"], "commit": env["VEXTRUS_COMMIT"]}
            export.write_text(json.dumps(document))

    world.plant = the_run_the_harness_names
    return world


@dataclasses.dataclass
class Scorer:
    """The real scorer on an invented key; each call's run and exit code."""

    world: World
    keys: Path
    log: Path
    calls: list[tuple[str, int]] = dataclasses.field(default_factory=list)

    def __call__(self, run_id: str) -> int:
        code = scorer.main(
            [run_id], drop=self.world.drop, keys=self.keys, log=self.log, writer=os.getuid()
        )
        self.calls.append((run_id, code))
        return code


@pytest.fixture
def score(world: World, tmp_path: Path) -> Scorer:
    keys = tmp_path / "keys"
    keys.mkdir()
    sheet = {
        "layout": "Invented layout",
        "number": "X-101",
        "title": "Invented floor plan",
        "discipline": "structural",
        "storeys": "ground floor",
        "revision": "R0",
        "date": "2026-01-01",
        "views": [],
    }
    (keys / f"{SET}.json").write_text(json.dumps({"set": SET, "held_out": False, "sheets": [sheet]}))
    return Scorer(world, keys, tmp_path / "score.log")


def machine(world: World, score: Scorer) -> Machine:
    return dataclasses.replace(world.machine(), score=score)


def a_prs_run_read_main(world: World, score: Scorer) -> int:
    """PR 91 changes the reading: its posting run reads its head and main, and caches both. The reads."""
    world.pr(91, READING_CHANGE)
    run("91", no_post=False, m=machine(world, score), accept_if_clean=True)
    assert len(world.sandbox_runs) == 2
    assert [code for _, code in score.calls] == [0]
    return len(world.sandbox_runs)


def test_a_scored_run_of_main_is_scored_on_mains_export_a_prs_run_read(
    world: World, score: Scorer, capfd: pytest.CaptureFixture[str]
) -> None:
    read = a_prs_run_read_main(world, score)
    capfd.readouterr()

    code = run("main", no_post=True, score=True, m=machine(world, score))

    shown = capfd.readouterr()
    assert "vx-score: refused" not in shown.err, shown.err
    assert code == 0
    assert score.calls[-1][1] == 0
    assert len(world.sandbox_runs) == read  # main's export came from the cache, without --fresh
    assert "sheet 1 (layout Invented layout): pass" in shown.out, shown.out


def test_a_prs_scored_run_on_mains_export_another_prs_run_read_is_scored(
    world: World, score: Scorer, capfd: pytest.CaptureFixture[str]
) -> None:
    """PR 92 changes no file the engine reads: its reading is main's, taken from PR 91's run."""
    read = a_prs_run_read_main(world, score)
    world.pr(92, {"web/src/qx-panel.ts": "export const qxPanel = 1;\n"})
    capfd.readouterr()

    run("92", no_post=False, m=machine(world, score), accept_if_clean=True)

    shown = capfd.readouterr()
    assert "vx-score: refused" not in shown.err, shown.err
    assert score.calls[-1][1] == 0
    assert len(world.sandbox_runs) == read  # main's export came from the cache
    assert "sheet 1 (layout Invented layout): pass" in shown.out, shown.out
