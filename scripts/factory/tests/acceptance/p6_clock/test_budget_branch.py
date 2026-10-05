"""Ticket T-CLOCK (session 12, phase 6), section 3 A: a builder's budget record names its branch, and
`stamp start` refuses a phase name the clock hook cannot show.

Black-box through `python -m scripts.factory.stamp` with `VEXTRUS_NOW` (the clock) and
`VEXTRUS_FACTORY_DIR` (where `session.json` lives), as `scripts/factory/tests/acceptance/test_stamp.py`
is. The seams fixed by the ticket's section 3:

    budget --ticket <t> --minutes <n> [--branch <name>]
        record <git-common-dir>/vextrus/budget-<t>.json =
        {"schema": 1, "ticket": "<t>", "minutes": <n>, "started_utc": "<UTC>", "branch": "<branch>"}
        the branch is `--branch`, else the checkout's current branch; a detached HEAD writes no key.
        A bad `--branch` (space, `..`, leading `-`, empty, over 200 characters): exit 2, `REFUSED:`.
    start --phases "<name>=<minutes>,..."
        a phase name outside `[A-Za-z0-9_.-]{1,40}` (what clock.mjs shows): exit 2, `REFUSED:` naming
        it, no session.json.

Exit codes: 0 done, 2 refused or usage.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[5]
NOW = "2026-10-04T21:00:00Z"
COMMIT_DATE = "2026-10-04T12:00:00Z"


class Stamp:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.factory = tmp / "factory"
        self.state = tmp / "STATE.md"
        self.session = self.factory / "session.json"

    def env(self, now: str) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("VEXTRUS_")}
        env.update(
            PYTHONPATH=str(REPO),
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_NOW=now,
            PYTHONUTF8="1",
        )
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
            encoding="utf-8",
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )

    def start(self, *more: str) -> subprocess.CompletedProcess[str]:
        return self.run("start", "--budget", "1h", "--state", str(self.state), *more)


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def refused(done: subprocess.CompletedProcess[str]) -> None:
    assert done.returncode == 2, show(done)
    assert done.stderr.startswith("REFUSED:"), show(done)
    assert "Traceback" not in done.stderr, show(done)


def git(cwd: Path, *args: str) -> str:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(
        GIT_AUTHOR_NAME="t",
        GIT_AUTHOR_EMAIL="t@example.invalid",
        GIT_COMMITTER_NAME="t",
        GIT_COMMITTER_EMAIL="t@example.invalid",
        GIT_AUTHOR_DATE=COMMIT_DATE,
        GIT_COMMITTER_DATE=COMMIT_DATE,
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
    )
    done = subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True, text=True, check=True)
    return done.stdout.strip()


class Repo:
    """A scratch repository on `main` with one commit and a linked worktree on `s12-p6-hooks`."""

    def __init__(self, tmp: Path) -> None:
        self.main = tmp / "main"
        self.main.mkdir()
        git(self.main, "init", "-q", "-b", "main")
        (self.main / "README").write_text("x\n")
        git(self.main, "add", "README")
        git(self.main, "commit", "-q", "-m", "seed")
        self.linked = tmp / "linked"
        git(self.main, "worktree", "add", "-q", "-b", "s12-p6-hooks", str(self.linked))
        self.records = self.main / ".git" / "vextrus"

    def record(self, ticket: str) -> Path:
        return self.records / f"budget-{ticket}.json"

    def budget_files(self) -> list[str]:
        if not self.records.exists():
            return []
        return sorted(p.name for p in self.records.iterdir() if p.name.startswith("budget-"))


@pytest.fixture
def stamp(tmp_path: Path) -> Stamp:
    return Stamp(tmp_path)


@pytest.fixture
def repo(tmp_path: Path) -> Repo:
    return Repo(tmp_path)


# A1
def test_a1_a_budget_record_names_the_branch_of_the_checkout_it_was_written_from(
    stamp: Stamp, repo: Repo
) -> None:
    done = stamp.run("budget", "--ticket", "T-HOOKS", "--minutes", "90", cwd=repo.linked)
    assert done.returncode == 0, show(done)
    assert json.loads(repo.record("T-HOOKS").read_text()) == {
        "schema": 1,
        "ticket": "T-HOOKS",
        "minutes": 90,
        "started_utc": NOW,
        "branch": "s12-p6-hooks",
    }

    done = stamp.run("budget", "--ticket", "T-MAIN", "--minutes", "30", cwd=repo.main)
    assert done.returncode == 0, show(done)
    assert json.loads(repo.record("T-MAIN").read_text()) == {
        "schema": 1,
        "ticket": "T-MAIN",
        "minutes": 30,
        "started_utc": NOW,
        "branch": "main",
    }


# A2
def test_a2_branch_names_a_cloud_tickets_branch_from_the_main_checkout(stamp: Stamp, repo: Repo) -> None:
    done = stamp.run(
        "budget", "--ticket", "T-CLOUD", "--minutes", "45", "--branch", "s12-p6-cloud", cwd=repo.main
    )
    assert done.returncode == 0, show(done)
    assert json.loads(repo.record("T-CLOUD").read_text()) == {
        "schema": 1,
        "ticket": "T-CLOUD",
        "minutes": 45,
        "started_utc": NOW,
        "branch": "s12-p6-cloud",
    }

    longest = "b" * 200
    done = stamp.run(
        "budget", "--ticket", "T-LONG", "--minutes", "45", f"--branch={longest}", cwd=repo.main
    )
    assert done.returncode == 0, show(done)
    assert json.loads(repo.record("T-LONG").read_text())["branch"] == longest


@pytest.mark.parametrize(
    "branch",
    ["has space", "s12..p6", "-leading", "", "b" * 201],
    ids=["space", "dot-dot", "leading-dash", "empty", "201-chars"],
)
def test_a2_a_bad_branch_name_is_refused_and_writes_no_record(
    stamp: Stamp, repo: Repo, branch: str
) -> None:
    done = stamp.run(
        "budget", "--ticket", "T-BAD", "--minutes", "45", f"--branch={branch}", cwd=repo.main
    )
    refused(done)
    assert repo.budget_files() == []


def test_a2_a_detached_head_writes_a_record_without_a_branch_key(stamp: Stamp, repo: Repo) -> None:
    git(repo.linked, "checkout", "-q", "--detach")
    done = stamp.run("budget", "--ticket", "T-DETACHED", "--minutes", "60", cwd=repo.linked)
    assert done.returncode == 0, show(done)
    assert json.loads(repo.record("T-DETACHED").read_text()) == {
        "schema": 1,
        "ticket": "T-DETACHED",
        "minutes": 60,
        "started_utc": NOW,
    }


# A3
def test_a3_elapsed_reads_a_record_with_or_without_a_branch(stamp: Stamp, repo: Repo) -> None:
    repo.records.mkdir(parents=True, exist_ok=True)
    with_branch = {
        "schema": 1,
        "ticket": "T-HOOKS",
        "minutes": 90,
        "started_utc": NOW,
        "branch": "s12-p6-hooks",
    }
    legacy = {"schema": 1, "ticket": "T-OLD", "minutes": 30, "started_utc": NOW}
    repo.record("T-HOOKS").write_text(json.dumps(with_branch))
    repo.record("T-OLD").write_text(json.dumps(legacy))

    for cwd in (repo.linked, repo.main):
        done = stamp.run("elapsed", "--ticket", "T-HOOKS", now="2026-10-04T21:42:00Z", cwd=cwd)
        assert done.returncode == 0, show(done)
        assert done.stdout.strip() == "ticket T-HOOKS 42/90 min"
        done = stamp.run("elapsed", "--ticket", "T-OLD", now="2026-10-04T21:42:00Z", cwd=cwd)
        assert done.returncode == 0, show(done)
        assert done.stdout.strip() == "ticket T-OLD 42/30 min"


# A4
@pytest.mark.parametrize("name", ["hour 1", "p" * 41, "é"], ids=["space", "41-chars", "non-ascii"])
def test_a4_start_refuses_a_phase_name_the_clock_cannot_show(stamp: Stamp, name: str) -> None:
    stamp.state.write_text("# STATE\n")
    done = stamp.start("--phases", f"p1=10,{name}=30")
    refused(done)
    assert name in done.stderr, show(done)
    assert not stamp.session.exists()


@pytest.mark.parametrize("name", ["p1.a_b-c", "p" * 40], ids=["punctuated", "40-chars"])
def test_a4_a_phase_name_the_clock_shows_is_planned_and_started_as_before(
    stamp: Stamp, name: str
) -> None:
    stamp.state.write_text("# STATE\n")
    done = stamp.start("--phases", f"{name}=30")
    assert done.returncode == 0, show(done)
    assert json.loads(stamp.session.read_text())["phases"] == [
        {"name": name, "minutes": 30, "start_utc": None}
    ]

    done = stamp.run("phase", name, now="2026-10-04T21:10:00Z")
    assert done.returncode == 0, show(done)
    assert done.stdout.strip() == f"phase {name} started"
    assert json.loads(stamp.session.read_text())["phases"][0]["start_utc"] == "2026-10-04T21:10:00Z"
