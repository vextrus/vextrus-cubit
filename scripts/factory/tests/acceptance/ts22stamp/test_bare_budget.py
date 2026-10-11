"""Ticket S22-STAMP (session 22): `stamp start --budget <bare number>` is refused.

The defect, made twice (session 21's lesson "`stamp start --budget 12` reads 12 minutes, not hours. No
check: refuse a bare number", then session 22's `--budget 8`, a session clock of 8 minutes): `start`
read a bare number as minutes. A session budget must now name its unit (`8h`, `90m`, `5h30m`); a bare
number exits 2 (the module's "refused"), names the unit forms, and writes no session record.

Unchanged: `--phases "p=110,..."` keeps bare minutes (the runbook's `p=min` form), `stamp budget
--ticket T --minutes 60` keeps a bare number (its flag names the unit), and `parse_minutes` keeps
accepting "90".

Black-box through `VEXTRUS_FACTORY_DIR` (a temporary folder; no real session record is touched) and
`VEXTRUS_NOW`, as `scripts/factory/tests/acceptance/test_stamp.py` does.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.factory import stamp as stamp_module

REPO = Path(__file__).resolve().parents[5]
NOW = "2026-10-11T20:48:00Z"
UNIT_FORMS = ("8h", "90m", "5h30m")
BARE = "a bare --budget was not refused"


class Stamp:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.factory = tmp / "factory"
        self.state = tmp / "STATE.md"
        self.session = self.factory / "session.json"

    def env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(PYTHONPATH=str(REPO), VEXTRUS_FACTORY_DIR=str(self.factory), VEXTRUS_NOW=NOW)
        for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"):
            env.pop(key, None)
        return env

    def run(self, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.stamp", *args],
            cwd=cwd or self.tmp,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def start(self, budget: str, *more: str) -> subprocess.CompletedProcess[str]:
        return self.run("start", "--budget", budget, "--state", str(self.state), *more)


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def git(cwd: Path, *args: str) -> None:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(
        GIT_AUTHOR_NAME="t",
        GIT_AUTHOR_EMAIL="t@example.invalid",
        GIT_COMMITTER_NAME="t",
        GIT_COMMITTER_EMAIL="t@example.invalid",
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
    )
    subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True, text=True, check=True)


@pytest.fixture
def stamp(tmp_path: Path) -> Stamp:
    made = Stamp(tmp_path)
    made.state.write_text("# STATE\n")
    return made


@pytest.mark.parametrize("budget", ["8", "12", "90", " 12 "])
def test_a_bare_number_budget_is_refused_and_writes_no_session_record(
    stamp: Stamp, budget: str
) -> None:
    done = stamp.start(budget)
    assert done.returncode == 2, f"{BARE}: {show(done)}"
    assert not stamp.session.exists(), show(done)
    assert not stamp.factory.exists() or not any(stamp.factory.iterdir()), show(done)
    assert stamp.state.read_text() == "# STATE\n"


def test_the_refusal_names_the_unit_forms(stamp: Stamp) -> None:
    done = stamp.start("8")
    assert done.returncode == 2, f"{BARE}: {show(done)}"
    for form in UNIT_FORMS:
        assert form in done.stderr, f"the refusal does not name {form!r}: {show(done)}"


def test_a_bare_number_with_force_keeps_the_running_session(stamp: Stamp) -> None:
    first = stamp.start("8h")
    assert first.returncode == 0, show(first)
    kept = stamp.session.read_bytes()
    done = stamp.start("12", "--force")
    assert done.returncode == 2, f"{BARE}: {show(done)}"
    assert stamp.session.read_bytes() == kept


@pytest.mark.parametrize(("budget", "minutes"), [("8h", 480), ("450m", 450), ("7h50m", 470)])
def test_a_budget_with_its_unit_starts_as_before(stamp: Stamp, budget: str, minutes: int) -> None:
    done = stamp.start(budget)
    assert done.returncode == 0, show(done)
    session = json.loads(stamp.session.read_text())
    assert session["budget_minutes"] == minutes
    assert session["started_utc"] == NOW


def test_phases_keep_bare_minutes(stamp: Stamp) -> None:
    done = stamp.start("8h", "--phases", "p1=110,p2=60")
    assert done.returncode == 0, show(done)
    phases = json.loads(stamp.session.read_text())["phases"]
    assert [(p["name"], p["minutes"]) for p in phases] == [("p1", 110), ("p2", 60)]


def test_a_tickets_budget_keeps_a_bare_number_of_minutes(stamp: Stamp, tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    done = stamp.run("budget", "--ticket", "T", "--minutes", "60", cwd=repo)
    assert done.returncode == 0, show(done)
    record = json.loads((repo / ".git" / "vextrus" / "budget-T.json").read_text())
    assert record["minutes"] == 60


def test_parse_minutes_still_reads_a_bare_number_as_minutes() -> None:
    assert stamp_module.parse_minutes("90") == 90
