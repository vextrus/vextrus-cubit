"""T-WALK-4 acceptance, case 15: the walk takes its snapshot before any act, and the run wires it.

"walk.spec.ts reads WALK_SNAPSHOT, writes snapshot.json with acts_before_snapshot, has no
/continu/ regex, creates a second Project for the acts (a record field acts_project, which
walk.schema.json allows and walk_errors accepts; a walk.json without it still validates);
run.walk_spec sets WALK_SNAPSHOT to <out>/snapshot.json ...; run.set_aside moves snapshot.json aside
with the others; run.judge_checks reads the set expectations and calls measures.attach." The
Playwright spec cannot run here (it needs the served stack and a real read), so it is read as text.
Synthetic data only.
"""

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

import pytest
from _s13_fixture import (  # type: ignore[import-not-found, unused-ignore]
    CHECKS,
    FINISHED,
    SET_A,
    SHA,
    STARTED,
    snapshot,
    standard_expect,
    standard_set,
    walk,
)

ROOT = Path(__file__).resolve().parents[5]
SPEC = ROOT / "web" / "e2e" / "real" / "walk.spec.ts"
FIXED_MTIME = 1_791_000_000  # 2026-10-03, one fixed second for both moves


def test_the_spec_writes_the_snapshot_before_any_act() -> None:
    text = SPEC.read_text()

    assert "WALK_SNAPSHOT" in text, "walk.spec.ts does not read WALK_SNAPSHOT"
    for key in ("acts_before_snapshot", "bulk_after_gaps", "storeys_titled", "acts_project"):
        assert key in text, f"walk.spec.ts does not write {key}"
    assert "WK-A" in text, "walk.spec.ts makes no second Project for the acts"
    assert "/continu/" not in text, "the /continu/ regex still counts continuation Questions"
    assert "engine.conflicts.same_storey" in text
    assert "engine.conflicts.same_title" in text


def test_walk_json_takes_an_acts_project_and_still_validates_without_it() -> None:
    from scripts.walk.schema import walk_errors

    record = walk({SET_A: standard_set()})
    assert walk_errors(record) == [], walk_errors(record)
    record["sets"][SET_A]["acts_project"] = "WK-A01"
    assert walk_errors(record) == [], walk_errors(record)
    record["sets"][SET_A]["acts_project"] = "Made-up project"
    assert walk_errors(record) != [], "a free-text acts_project passed"


def _plan(root: Path) -> Any:
    """A Plan by hand (as T-WALK-1's tests build it): no git, its out_dir the walk's folder."""
    from scripts.walk import run

    walks = root / ".private" / "work" / "walks"
    db = f"vextrus_walk_{SHA[:8]}"
    return run.Plan(
        sha=SHA,
        sha8=SHA[:8],
        db_name=db,
        out_dir=walks / SHA,
        worktree=walks / "_src",
        web_port=5511,
        api_port=8811,
        env={
            "VEXTRUS_DB_NAME": db,
            "VEXTRUS_WEB_PORT": "5511",
            "VEXTRUS_API_URL": "http://127.0.0.1:8811",
        },
    )


def test_run_walk_spec_sets_walk_snapshot_to_the_walks_snapshot_json(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import run

    seen: dict[str, str] = {}

    class Playwright:
        """Popen's stand-in: records the environment, runs nothing."""

        pid = -1

        def __init__(self, args: list[str], **kwargs: Any) -> None:
            seen.update(kwargs["env"])

        def wait(self, timeout: float | None = None) -> int:
            return 0

    monkeypatch.setattr(subprocess, "Popen", Playwright)
    monkeypatch.setattr(run, "end_groups", lambda *args, **kwargs: None)
    plan = _plan(tmp_path)
    (plan.out_dir / "logs").mkdir(parents=True)

    code = run.walk_spec(tmp_path, plan, "synthetic", {SET_A: []}, smoke=False, started_at=STARTED)

    assert code == 0
    walk_snapshot = seen.get("WALK_SNAPSHOT")  # never the whole environment in a message
    assert walk_snapshot == str(plan.out_dir / "snapshot.json"), "WALK_SNAPSHOT is not the walk's"


def test_set_aside_moves_snapshot_json_and_never_overwrites_an_earlier_move(tmp_path: Path) -> None:
    from scripts.walk import run

    folder = tmp_path / "walks" / SHA
    folder.mkdir(parents=True)
    for walk_n in (1, 2):
        path = folder / "snapshot.json"
        path.write_text(json.dumps({"synthetic": f"snapshot of walk {walk_n}"}))
        os.utime(path, (FIXED_MTIME, FIXED_MTIME))
        run.set_aside(folder)

    assert not (folder / "snapshot.json").exists(), "snapshot.json was not set aside"
    dated = sorted(p for p in folder.glob("snapshot.*.json") if p.name != "snapshot.json")
    kept = sorted(json.loads(p.read_text())["synthetic"] for p in dated)
    assert kept == ["snapshot of walk 1", "snapshot of walk 2"], kept


def _judge_checks(root: Path, *, snap: bool, expect: dict[str, Any]) -> tuple[bool, list[str]]:
    """run.judge_checks on a walk laid out under `root/.private/work/`: its answer and the checks it
    logged, as `<check> <status>`."""
    from scripts.walk import run

    work = root / ".private" / "work"
    folder = work / "walks" / SHA
    folder.mkdir(parents=True)
    expect_dir = work / "walk-expect"
    expect_dir.mkdir(parents=True)
    sets = {SET_A: standard_set()}
    (folder / "walk.json").write_text(json.dumps(walk(sets)))
    if snap:
        (folder / "snapshot.json").write_text(json.dumps(snapshot(sets)))
    (expect_dir / f"{SET_A}.json").write_text(json.dumps(expect))

    passed = run.judge_checks(root, _plan(root), run.Events(root, SHA[:8]))

    lines = (work / "factory" / "events.log").read_text().splitlines()
    logged = [m.group(1) for line in lines if (m := re.search(r" check ([a-z0-9_]+ [A-Z]+)$", line))]
    return passed, logged


@pytest.fixture
def fixed_run_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    from scripts.walk import run, verdict

    monkeypatch.setattr(verdict, "utc_now", lambda: FINISHED)
    monkeypatch.setattr(run, "utc", lambda: FINISHED)


@pytest.mark.usefixtures("fixed_run_clock")
def test_judge_checks_measures_the_snapshot_by_the_set_expectation(tmp_path: Path) -> None:
    passed, logged = _judge_checks(tmp_path, snap=True, expect=standard_expect())

    assert logged == [f"{name} PASS" for name in CHECKS], logged
    assert passed is True


@pytest.mark.usefixtures("fixed_run_clock")
def test_judge_checks_logs_an_absent_snapshot_as_failed_checks(tmp_path: Path) -> None:
    passed, logged = _judge_checks(tmp_path, snap=False, expect=standard_expect())

    assert "sheets_match FAIL" in logged, logged
    assert "storeys_match FAIL" in logged, logged
    assert "reads_complete PASS" in logged, logged
    assert passed is False


@pytest.mark.usefixtures("fixed_run_clock")
def test_judge_checks_reads_the_new_keys_from_the_set_expectation(tmp_path: Path) -> None:
    expect = standard_expect()
    del expect["storeys"]

    passed, logged = _judge_checks(tmp_path, snap=True, expect=expect)

    assert "storeys_match UNSET" in logged, logged
    assert "sheets_match PASS" in logged, logged
    assert passed is False
