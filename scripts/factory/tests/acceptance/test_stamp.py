"""Ticket f3, 3.2: the clock's data (`python -m scripts.factory.stamp`), spec 2.2 "Clock" and the
ticket's section 4.

Black-box through `VEXTRUS_FACTORY_DIR` (where `session.json` lives) and `VEXTRUS_NOW` (the clock). The
shapes are the ticket's section 4, which f6's `clock.mjs` reads:

    session.json  {"schema": 1, "started_utc": "...Z", "budget_minutes": 660,
                   "state_file": "<abs STATE.md>",
                   "phases": [{"name": "p3", "minutes": 330, "start_utc": null}]}
    budget record <git-common-dir>/vextrus/budget-<ticket>.json
                  {"schema": 1, "ticket": "f3", "minutes": 150, "started_utc": "...Z"}

`elapsed` prints `now <YYYY-MM-DD HH:MMZ> · session h:mm/h:mm[ · phase <name> h:mm/h:mm]`, or `ticket <t>
n/m min`, or `no budget set`.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-04T21:08:00Z"


class Stamp:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.factory = tmp / "factory"
        self.state = tmp / "STATE.md"
        self.session = self.factory / "session.json"

    def env(self, now: str) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(PYTHONPATH=str(REPO), VEXTRUS_FACTORY_DIR=str(self.factory), VEXTRUS_NOW=now)
        for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"):
            env.pop(key, None)
        return env

    def run(
        self, *args: str, now: str = NOW, cwd: Path | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.stamp", *args],
            cwd=cwd or self.tmp,
            env=self.env(now),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def start(self, budget: str = "11h", *more: str, now: str = NOW) -> subprocess.CompletedProcess[str]:
        return self.run("start", "--budget", budget, "--state", str(self.state), *more, now=now)


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def files_under(root: Path) -> dict[str, bytes]:
    return {str(p.relative_to(root)): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


def git(cwd: Path, *args: str) -> str:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(
        GIT_AUTHOR_NAME="t",
        GIT_AUTHOR_EMAIL="t@example.invalid",
        GIT_COMMITTER_NAME="t",
        GIT_COMMITTER_EMAIL="t@example.invalid",
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
    )
    done = subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True, text=True, check=True)
    return done.stdout.strip()


@pytest.fixture
def stamp(tmp_path: Path) -> Stamp:
    return Stamp(tmp_path)


# S1
def test_s1_start_writes_session_json_and_refuses_a_second_start_without_force(stamp: Stamp) -> None:
    stamp.state.write_text("# STATE\n")
    done = stamp.start("11h", "--phases", "p1=150,p3=330")
    assert done.returncode == 0, show(done)
    assert json.loads(stamp.session.read_text()) == {
        "schema": 1,
        "started_utc": NOW,
        "budget_minutes": 660,
        "state_file": str(stamp.state.resolve()),
        "phases": [
            {"name": "p1", "minutes": 150, "start_utc": None},
            {"name": "p3", "minutes": 330, "start_utc": None},
        ],
    }

    before = stamp.session.read_bytes()
    again = stamp.start("5h", "--phases", "p1=60", now="2026-10-04T22:00:00Z")
    assert again.returncode == 2, show(again)
    assert stamp.session.read_bytes() == before

    forced = stamp.start("5h", "--phases", "p1=60", "--force", now="2026-10-04T22:00:00Z")
    assert forced.returncode == 0, show(forced)
    session = json.loads(stamp.session.read_text())
    assert session["budget_minutes"] == 300
    assert session["started_utc"] == "2026-10-04T22:00:00Z"


# S2
def test_s2_stamp_appends_one_utc_line_to_the_state_file_and_creates_nothing_else(stamp: Stamp) -> None:
    stamp.state.write_text("# STATE\n2026-10-04T20:00:00Z earlier line\n")
    assert stamp.start("11h").returncode == 0
    before = files_under(stamp.tmp)

    done = stamp.run("decided to cut the rdlock queue")
    assert done.returncode == 0, show(done)
    assert stamp.state.read_text() == (
        "# STATE\n2026-10-04T20:00:00Z earlier line\n"
        "2026-10-04T21:08:00Z decided to cut the rdlock queue\n"
    )
    after = files_under(stamp.tmp)
    assert set(after) == set(before)
    assert {name for name in after if after[name] != before[name]} == {"STATE.md"}


# S3
def test_s3_stamp_without_a_session_exits_2_and_writes_nothing(stamp: Stamp) -> None:
    stamp.state.write_text("# STATE\n")
    before = files_under(stamp.tmp)
    done = stamp.run("a line with no session")
    assert done.returncode == 2, show(done)
    assert files_under(stamp.tmp) == before


# S4
def test_s4_elapsed_prints_the_clock_hooks_form_with_the_current_phase(stamp: Stamp) -> None:
    stamp.state.write_text("# STATE\n")
    assert stamp.start("11h", "--phases", "p1=150,p3=330", now="2026-10-04T19:30:00Z").returncode == 0

    done = stamp.run("elapsed", now="2026-10-04T22:42:00Z")
    assert done.returncode == 0, show(done)
    assert done.stdout.strip() == "now 2026-10-04 22:42Z · session 3:12/11:00"

    assert stamp.run("phase", "p3", now="2026-10-04T21:37:00Z").returncode == 0
    done = stamp.run("elapsed", now="2026-10-04T22:42:00Z")
    assert done.stdout.strip() == "now 2026-10-04 22:42Z · session 3:12/11:00 · phase p3 1:05/5:30", (
        show(done)
    )


# S5
def test_s5_phase_starts_only_a_planned_phase_and_times_each_from_its_own_start(stamp: Stamp) -> None:
    stamp.state.write_text("# STATE\n")
    assert stamp.start("11h", "--phases", "p1=150,p3=330", now="2026-10-04T18:00:00Z").returncode == 0

    assert stamp.run("phase", "p1", now="2026-10-04T18:10:00Z").returncode == 0
    before = stamp.session.read_bytes()
    unknown = stamp.run("phase", "p9", now="2026-10-04T18:20:00Z")
    assert unknown.returncode == 2, show(unknown)
    assert stamp.session.read_bytes() == before

    # An approval gap between the phases (18:10 + p1, then nothing until 21:00) is not counted in p3.
    assert stamp.run("phase", "p3", now="2026-10-04T21:00:00Z").returncode == 0
    phases = {p["name"]: p for p in json.loads(stamp.session.read_text())["phases"]}
    assert phases["p1"]["start_utc"] == "2026-10-04T18:10:00Z"
    assert phases["p3"]["start_utc"] == "2026-10-04T21:00:00Z"

    done = stamp.run("elapsed", now="2026-10-04T21:30:00Z")
    assert done.stdout.strip() == "now 2026-10-04 21:30Z · session 3:30/11:00 · phase p3 0:30/5:30", (
        show(done)
    )


# S6
def test_s6_a_builders_budget_record_lives_in_the_main_repos_git_folder(
    stamp: Stamp, tmp_path: Path
) -> None:
    main = tmp_path / "main"
    main.mkdir()
    git(main, "init", "-q", "-b", "main")
    (main / "README").write_text("x\n")
    git(main, "add", "README")
    git(main, "commit", "-q", "-m", "seed")
    linked = tmp_path / "linked"
    git(main, "worktree", "add", "-q", "-b", "f3-branch", str(linked))

    done = stamp.run(
        "budget", "--ticket", "f3", "--minutes", "150", now="2026-10-04T21:00:00Z", cwd=linked
    )
    assert done.returncode == 0, show(done)
    record = main / ".git" / "vextrus" / "budget-f3.json"
    assert json.loads(record.read_text()) == {
        "schema": 1,
        "ticket": "f3",
        "minutes": 150,
        "started_utc": "2026-10-04T21:00:00Z",
    }
    assert not (linked / ".git").is_dir()

    for cwd in (linked, main):
        done = stamp.run("elapsed", "--ticket", "f3", now="2026-10-04T21:42:00Z", cwd=cwd)
        assert done.returncode == 0, show(done)
        assert done.stdout.strip() == "ticket f3 42/150 min"

    none = stamp.run("elapsed", "--ticket", "f99", cwd=linked)
    assert none.returncode == 0, show(none)
    assert none.stdout.strip() == "no budget set"


# S7
@pytest.mark.parametrize(
    ("budget", "minutes"), [("11h", 660), ("330m", 330), ("5h30m", 330), ("90", 90), ("abc", None)]
)
def test_s7_budget_forms_parse_to_minutes_and_a_non_duration_exits_2(
    stamp: Stamp, budget: str, minutes: int | None
) -> None:
    stamp.state.write_text("# STATE\n")
    done = stamp.start(budget)
    if minutes is None:
        assert done.returncode == 2, show(done)
        assert not stamp.session.exists()
    else:
        assert done.returncode == 0, show(done)
        assert json.loads(stamp.session.read_text())["budget_minutes"] == minutes
