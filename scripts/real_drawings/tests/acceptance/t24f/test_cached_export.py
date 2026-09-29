"""Ticket 24f, F4 (session 06's ruling): "a scored or posting run whose export came from the cache
records the export's own run id and commit in the new run's metadata (`export_run`), and the scorer
accepts an export whose run id/commit equal that recorded pair, with the folder, owner and sha256 checks
unchanged (never a hand-made file). A posting run that could not be scored says so in its table and
posts no success on a reading ticket."

The fake sandbox (`world.py`) on invented sets; the real scorer (`tools/scorer/score.py`) on an invented
key. The harness names the run it was started for in each export it writes, as the real one does.
"""

import dataclasses
import hashlib
import json
import os
from collections.abc import Callable
from pathlib import Path

import pytest

from scripts.real_drawings.command import Machine, run
from scripts.real_drawings.tests.world import World, make_world
from tools.scorer import score as scorer

SET = "invented-a"


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
    """The real scorer on an invented key, as the key user would run it; records each call's run and
    exit code."""

    world: World
    keys: Path
    log: Path
    calls: list[tuple[str, int]] = dataclasses.field(default_factory=list)

    def __call__(self, run_id: str) -> int:
        code = self.score(run_id)
        self.calls.append((run_id, code))
        return code

    def score(self, run_id: str) -> int:
        return scorer.main(
            [run_id], drop=self.world.drop, keys=self.keys, log=self.log, writer=os.getuid()
        )


def the_scorer(world: World, tmp_path: Path) -> Scorer:
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


def machine(world: World, score: Callable[[str], int]) -> Machine:
    return dataclasses.replace(world.machine(), score=score)


def test_a_second_scored_run_of_the_same_code_hash_is_scored(
    world: World, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    score = the_scorer(world, tmp_path)
    assert run("main", no_post=True, score=True, m=machine(world, score)) == 0
    sandbox_runs = len(world.sandbox_runs)
    capfd.readouterr()

    assert run("main", no_post=True, score=True, m=machine(world, score)) == 0

    assert len(world.sandbox_runs) == sandbox_runs  # the export came from the cache
    shown = capfd.readouterr().out
    assert "sheet 1 (layout Invented layout): pass" in shown, shown
    assert [code for _, code in score.calls] == [0, 0]


def second_cached_run(world: World, tmp_path: Path) -> tuple[Scorer, str]:
    score = the_scorer(world, tmp_path)
    run("main", no_post=True, score=True, m=machine(world, score))
    run("main", no_post=True, score=True, m=machine(world, score))
    return score, score.calls[-1][0]


def test_an_edited_cached_export_is_still_refused(world: World, tmp_path: Path) -> None:
    score, run_id = second_cached_run(world, tmp_path)
    export = world.drop / run_id / f"export-{SET}.json"
    document = json.loads(export.read_bytes())
    document["files"][0]["sheets"][0]["title"] = {"value": "Edited", "source": "title_block_text"}
    export.write_text(json.dumps(document))

    assert score.score(run_id) == scorer.REFUSED


def test_a_hand_made_export_naming_neither_run_is_refused(world: World, tmp_path: Path) -> None:
    """Its digest is recorded (as a hand who could write the folder would record it); only the run it
    names gives it away."""
    score, run_id = second_cached_run(world, tmp_path)
    folder = world.drop / run_id
    export = folder / f"export-{SET}.json"
    document = json.loads(export.read_bytes())
    document["run"]["id"] = "20260101T000000Z-" + document["run"]["commit"][:12] + "-0000"
    data = json.dumps(document).encode()
    export.write_bytes(data)
    metadata = json.loads((folder / "metadata.json").read_bytes())
    metadata["sets"][SET]["export_sha256"] = hashlib.sha256(data).hexdigest()
    (folder / "metadata.json").write_text(json.dumps(metadata))

    assert score.score(run_id) == scorer.REFUSED


def test_a_prs_posting_run_on_mains_cached_export_is_scored(
    world: World, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """A PR whose code hash equals main's reuses main's export (the ruling's "worse" case)."""
    score = the_scorer(world, tmp_path)
    assert run("main", no_post=True, score=True, m=machine(world, score)) == 0
    world.pr(57, {"README.md": "a change the engine never reads\n"})
    sandbox_runs = len(world.sandbox_runs)
    capfd.readouterr()

    run("57", no_post=False, m=machine(world, score), accept_if_clean=True)

    assert len(world.sandbox_runs) == sandbox_runs  # the export came from the cache
    assert [code for _, code in score.calls] == [0, 0]
    shown = capfd.readouterr().out
    assert "sheet 1 (layout Invented layout): pass" in shown, shown


def test_a_posting_run_that_cannot_be_scored_says_so_and_posts_no_success(
    world: World, tmp_path: Path
) -> None:
    world.pr(58, {"engine/read.py": "X = 1\n"})  # a reading change

    def refused(run_id: str) -> int:
        return scorer.REFUSED

    run("58", no_post=False, m=machine(world, refused), accept_if_clean=True)

    assert any("Not scored" in line for line in world.said), world.said
    for run_id in world.posted:
        summary = json.loads((world.drop / run_id / "summary.json").read_text())
        assert summary["verdict"] != "accepted", summary
