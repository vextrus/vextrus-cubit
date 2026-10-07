"""S17-F4: `stamp end` runs the measures into STATE.md and refuses while a lesson has no check.

Driven as the orchestrator drives it, `python -m scripts.factory.stamp ...` in the main checkout, here a
temporary git repository holding its own `docs/knowledge/lessons.md` (the gate reads the lessons file of
the repository at the cwd, as `stamp budget` writes into the repository at the cwd). The seams are the
existing ones: `VEXTRUS_FACTORY_DIR`, `VEXTRUS_NOW`, and `VEXTRUS_PRS_FILE` standing in for `gh pr list
--json ...`'s stdout (as in `scripts/factory/governor.py` and `watch.py`). A `gh` that always fails is
first on PATH, so nothing reaches the network: a source gh cannot give is left unmeasured, and the
session still ends.

A lesson is mirrored when a bullet of lessons.md carries the LESSON line's text (the words after
`LESSON:`) and a `Check:`, both in that one bullet (a bullet runs on over its indented lines).
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[4]
TARGETS_FILE = REPO / "docs" / "knowledge" / "factory-targets.toml"
MEASURE_KEYS = (
    "prs_merged",
    "merge_p50_min",
    "rounds_per_pr",
    "rdlock_min",
    "verify_p50_min",
    "verify_p90_min",
    "ci_wall_p50_min",
)
MIRRORED = "verify ran serial pytest for 25 minutes on one tree"
UNMIRRORED = "a builder copied a sheet's text into a test literal"
CHECK_PATH = "checks/serial_pytest_check.py"
LESSONS_HEAD = (
    "# Lessons, by area\n\n"
    "## Session 16 (7 Oct 2026)\n"
    f"- A contract names its fields, not only its types.\n  Check: {CHECK_PATH}\n\n"
    "## Session 17 (8 Oct 2026)\n"
)
GH_OFFLINE = "#!/bin/sh\necho 'gh: offline (an acceptance fake)' >&2\nexit 1\n"


@dataclass
class World:
    root: Path
    repo: Path
    factory: Path
    prs_file: Path

    def env(self, now: str) -> dict[str, str]:
        env = {key: value for key, value in os.environ.items() if not key.startswith("VEXTRUS_")}
        env["PATH"] = f"{self.root / 'bin'}{os.pathsep}{env.get('PATH', '')}"
        env["PYTHONPATH"] = str(REPO)
        env["VEXTRUS_FACTORY_DIR"] = str(self.factory)
        env["VEXTRUS_PRS_FILE"] = str(self.prs_file)
        env["VEXTRUS_NOW"] = now
        return env

    def stamp(self, now: str, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.stamp", *args],
            cwd=self.repo,
            env=self.env(now),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def lessons(self, bullets: str) -> None:
        (self.repo / "docs" / "knowledge" / "lessons.md").write_text(LESSONS_HEAD + bullets)

    def start(self, name: str, now: str) -> Path:
        state = self.root / "work" / name / "STATE.md"
        done = self.stamp(now, "start", "--budget", "12h", "--state", str(state))
        assert done.returncode == 0, done.stderr
        return state


def pr(number: int, created: str, merged: str) -> dict[str, Any]:
    return {
        "number": number,
        "headRefName": f"s17-t{number}",
        "state": "MERGED",
        "files": [{"path": f"docs/t{number}.md", "additions": 1, "deletions": 0}],
        "createdAt": created,
        "closedAt": merged,
        "mergedAt": merged,
        "isCrossRepository": False,
    }


# Session A (7 Oct 06:00-18:00) merged three PRs; session B (8 Oct 06:00-18:00) merged one.
PRS = [
    pr(21, "2026-10-07T07:00:00Z", "2026-10-07T07:30:00Z"),
    pr(22, "2026-10-07T08:00:00Z", "2026-10-07T09:00:00Z"),
    pr(23, "2026-10-07T10:00:00Z", "2026-10-07T11:30:00Z"),
    pr(31, "2026-10-08T07:00:00Z", "2026-10-08T08:00:00Z"),
]


@pytest.fixture
def world(tmp_path: Path) -> World:
    repo = tmp_path / "repo"
    (repo / "docs" / "knowledge").mkdir(parents=True)
    (repo / "checks").mkdir()
    (repo / CHECK_PATH).write_text('"""The check of the serial-pytest lesson (a fixture)."""\n')
    if TARGETS_FILE.exists():
        shutil.copy(TARGETS_FILE, repo / "docs" / "knowledge" / "factory-targets.toml")
    subprocess.run(["git", "init", "-q", str(repo)], check=True, capture_output=True)
    (tmp_path / "bin").mkdir()
    gh = tmp_path / "bin" / "gh"
    gh.write_text(GH_OFFLINE)
    gh.chmod(0o755)
    factory = tmp_path / "factory"
    factory.mkdir()
    prs_file = tmp_path / "prs.json"
    prs_file.write_text(json.dumps(PRS))
    made = World(root=tmp_path, repo=repo, factory=factory, prs_file=prs_file)
    made.lessons(f"- Another lesson of the session.\n  Check: {CHECK_PATH}\n")
    return made


def table_rows(state: Path, key: str) -> list[str]:
    return [line for line in state.read_text().splitlines() if "|" in line and key in line]


def test_end_refuses_while_a_lesson_has_no_lessons_bullet(world: World) -> None:
    world.start("session-a", "2026-10-07T06:00:00Z")
    world.stamp("2026-10-07T07:00:00Z", f"LESSON: {UNMIRRORED}")
    done = world.stamp("2026-10-07T18:00:00Z", "end")
    assert done.returncode != 0, (
        "stamp end closed the session while a LESSON line has no lessons.md bullet"
    )
    assert UNMIRRORED in done.stdout + done.stderr, (
        f"stamp end's refusal does not name the LESSON line: {done.stdout + done.stderr!r}"
    )


def test_a_refused_end_keeps_the_session_open(world: World) -> None:
    state = world.start("session-a", "2026-10-07T06:00:00Z")
    world.stamp("2026-10-07T07:00:00Z", f"LESSON: {UNMIRRORED}")
    world.stamp("2026-10-07T18:00:00Z", "end")
    assert (world.factory / "session.json").exists(), (
        "stamp end removed session.json while a LESSON line has no lessons.md bullet"
    )
    assert "session ended" not in state.read_text(), "a refused end stamped 'session ended'"


def test_end_refuses_when_the_lessons_bullet_carries_no_check(world: World) -> None:
    world.lessons(f"- {MIRRORED}. No check yet.\n- Another lesson.\n  Check: {CHECK_PATH}\n")
    world.start("session-a", "2026-10-07T06:00:00Z")
    world.stamp("2026-10-07T07:00:00Z", f"LESSON: {MIRRORED}")
    done = world.stamp("2026-10-07T18:00:00Z", "end")
    assert done.returncode != 0, "stamp end closed the session while the LESSON's bullet has no Check:"
    assert MIRRORED in done.stdout + done.stderr, (
        f"stamp end's refusal does not name the LESSON line: {done.stdout + done.stderr!r}"
    )


def test_end_writes_the_measures_table_into_state_when_every_lesson_has_its_check(
    world: World,
) -> None:
    world.lessons(f"- {MIRRORED}, measured by the verify records.\n  Check: {CHECK_PATH}\n")
    state = world.start("session-a", "2026-10-07T06:00:00Z")
    world.stamp("2026-10-07T07:00:00Z", f"LESSON: {MIRRORED}")
    done = world.stamp("2026-10-07T18:00:00Z", "end")
    assert done.returncode == 0, f"stamp end refused a mirrored lesson: {done.stdout + done.stderr!r}"
    assert not (world.factory / "session.json").exists()
    missing = [key for key in MEASURE_KEYS if not table_rows(state, key)]
    assert not missing, f"STATE.md has no measures table row for {missing}"
    merged = table_rows(state, "prs_merged")
    assert any(re.search(r"(?<![\d.])3(?![\d.])", row) for row in merged), (
        f"the prs_merged row does not show the session's 3 merges: {merged}"
    )


def test_end_flags_a_measure_that_regressed_since_the_previous_session(world: World) -> None:
    world.start("session-a", "2026-10-07T06:00:00Z")
    first = world.stamp("2026-10-07T18:00:00Z", "end")
    assert first.returncode == 0, f"session A's end failed: {first.stdout + first.stderr!r}"
    state = world.start("session-b", "2026-10-08T06:00:00Z")
    second = world.stamp("2026-10-08T18:00:00Z", "end")
    assert second.returncode == 0, f"session B's end failed: {second.stdout + second.stderr!r}"
    lines = [line for line in state.read_text().splitlines() if "prs_merged" in line]
    assert any("regress" in line.lower() for line in lines), (
        f"prs_merged went 3 -> 1 and session B's STATE.md does not flag it as regressed: {lines}"
    )
