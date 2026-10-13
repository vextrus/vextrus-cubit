"""S24-A6 (session 24's brief, Wave A): "`rdlock` refuses a posting run without a review PASS and
cancels runs on superseded heads".

    python -m scripts.factory.rdlock run --kind posting --head <sha40> --ticket <T> -- <command...>

- A posting run starts only on a head the review ledger passed: a record
  `$VEXTRUS_FACTORY_DIR/ledger/<PR>-<head>.json` whose `verdict` is `PASS` (scripts/ledger.py's
  record of truth). With none, or with a FIX, or with a PASS for another head, the run is refused and
  its command never runs. `scored` and `no-post` runs are not gated.
- A posting run on a head that a newer push to the same branch has replaced is refused, at its start
  and at its turn in the queue (a run that waited while its branch moved never runs), naming the head
  that replaced it.

Black-box. Git is real: a bare `origin` and a clone that is the run's working folder, so `git ls-remote
origin` reads the branch's tip. The ticket's branch is named by its launch record
(`$VEXTRUS_FACTORY_DIR/launches/<T>-<utc>.json`) and by the PR list seam (`VEXTRUS_PRS_FILE`, the
stdout of `gh pr list --json number,headRefName,headRefOid,state`); a `gh` stub on PATH answers
`pr list` from the same file and fails anything else, so nothing reaches the network. The command is
a Python one-liner that writes a marker file: the marker says whether it ran.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[5]
NOW = "2026-10-12T16:00:00Z"
TICKET = "s24-x1"
BRANCH = "s24-x1-work"
PR = 701
OLD_DATE = "2026-01-01T00:00:00+0000"

GH_STUB = """
import os, sys
args = sys.argv[1:]
if args[:2] == ["pr", "list"]:
    print(open(os.environ["VEXTRUS_PRS_FILE"]).read())
    sys.exit(0)
sys.exit(1)
"""


class Yard:
    """origin, the run's clone, the factory folder (ledger, launches, lock) and the seams."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.origin = tmp / "origin.git"
        self.clone = tmp / "clone"
        self.factory = tmp / "factory"
        self.factory.mkdir()
        (self.factory / "launches").mkdir()
        (self.factory / "ledger").mkdir()
        self.marker = tmp / "ran.txt"
        self.prs = tmp / "prs.json"
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        gh = self.stubs / "gh"
        gh.write_text(f"#!{sys.executable}\n{GH_STUB}")
        gh.chmod(0o755)
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )
        self.counter = 0
        self.git(tmp, "init", "-q", "--bare", "-b", "main", str(self.origin))
        self.git(tmp, "init", "-q", "-b", "main", str(self.clone))
        self.git(self.clone, "remote", "add", "origin", str(self.origin))
        self.main_sha = self.commit("seed")
        self.git(self.clone, "push", "-q", "origin", "main")
        self.git(self.clone, "checkout", "-q", "-b", BRANCH)
        self.first = self.push("acceptance: s24-x1 pins the work")
        self.launch_record()
        self.pr_head(self.first)

    def git_env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        env.update(
            GIT_CONFIG_GLOBAL=str(self.gitconfig),
            GIT_CONFIG_NOSYSTEM="1",
            GIT_ALLOW_PROTOCOL="file",
            GIT_AUTHOR_DATE=OLD_DATE,
            GIT_COMMITTER_DATE=OLD_DATE,
        )
        return env

    def git(self, cwd: Path, *args: str) -> str:
        done = subprocess.run(
            ["git", *args], cwd=cwd, env=self.git_env(), capture_output=True, text=True, check=False
        )
        assert done.returncode == 0, f"git {args}: {done.stderr}"
        return done.stdout.strip()

    def commit(self, message: str) -> str:
        self.counter += 1
        name = f"change-{self.counter}.txt"
        (self.clone / name).write_text(f"change {self.counter}\n")
        self.git(self.clone, "add", name)
        self.git(self.clone, "commit", "-q", "-m", message)
        return self.git(self.clone, "rev-parse", "HEAD")

    def push(self, message: str) -> str:
        """A new commit on the ticket's branch, pushed: origin's tip moves to it."""
        sha = self.commit(message)
        self.git(self.clone, "push", "-q", "origin", f"{BRANCH}:{BRANCH}")
        return sha

    def launch_record(self) -> None:
        record = {
            "ticket": TICKET,
            "branch": BRANCH,
            "where": "cloud",
            "role": "builder",
            "effort": "medium",
            "model": "claude-sonnet-5-5",
            "budget_minutes": 120,
            "session_id": "session_01Yard",
            "cli_version": "2.1.999",
            "started_at": "2026-10-12T15:00:00Z",
            "governor": {"unit": "cloud-session", "ok": True},
            "leak_scan": {"status": "clean", "line": "leakscan: hits=0"},
            "judge": {"ok": True, "code": "ok", "reason": "cloned"},
            "stop_sent": False,
            "untestable": None,
            "review": None,
        }
        path = self.factory / "launches" / f"{TICKET}-20261012T150000Z.json"
        path.write_text(json.dumps(record))

    def pr_head(self, head: str) -> None:
        """The PR list seam: the ticket's PR is open, its head `head`."""
        rows = [
            {
                "number": PR,
                "headRefName": BRANCH,
                "headRefOid": head,
                "state": "OPEN",
                "isCrossRepository": False,
                "createdAt": "2026-10-12T15:30:00Z",
                "closedAt": None,
                "mergedAt": None,
                "statusCheckRollup": [],
            }
        ]
        self.prs.write_text(json.dumps(rows))

    def review(self, head: str, verdict: str, round_: int = 1) -> None:
        """A ledger record as `scripts/ledger.py record` writes it."""
        record = {
            "schema_version": 1,
            "pr": PR,
            "head": head,
            "round": round_,
            "verdict": verdict,
            "counts": {"reviewers": 2, "findings": 0, "blocking": 0},
            "decision_input_sha256": "ab" * 32,
            "comment_id": 9000 + round_,
            "exception": None,
            "source": "test",
            "recorded_at": "2026-10-12T15:50:00Z",
        }
        (self.factory / "ledger" / f"{PR}-{head}.json").write_text(json.dumps(record))

    def env(self) -> dict[str, str]:
        env = {k: v for k, v in self.git_env().items() if not k.startswith("VEXTRUS_")}
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_NOW=NOW,
            VEXTRUS_PRS_FILE=str(self.prs),
        )
        return env

    def argv(self, kind: str, head: str) -> list[str]:
        command = f"open({str(self.marker)!r}, 'w').write('ran')"
        return [
            sys.executable,
            "-m",
            "scripts.factory.rdlock",
            "run",
            "--kind",
            kind,
            "--head",
            head,
            "--ticket",
            TICKET,
            "--",
            sys.executable,
            "-c",
            command,
        ]

    def run(self, kind: str, head: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            self.argv(kind, head),
            cwd=self.clone,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=300,
            check=False,
        )

    def rdlock(self, *args: str) -> subprocess.CompletedProcess[str]:
        done = subprocess.run(
            [sys.executable, "-m", "scripts.factory.rdlock", *args],
            cwd=self.clone,
            env=self.env(),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
        assert "No module named" not in done.stderr, show(done)
        return done

    def lock(self) -> dict[str, Any]:
        path = self.factory / "rdlock.json"
        loaded: dict[str, Any] = (
            json.loads(path.read_text()) if path.exists() else {"holder": None, "waiters": []}
        )
        return loaded

    def ran(self) -> bool:
        return self.marker.exists()


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def said(done: subprocess.CompletedProcess[str]) -> str:
    return done.stdout + done.stderr


@pytest.fixture
def yard(tmp_path: Path) -> Yard:
    return Yard(tmp_path)


def assert_refused_and_left_free(yard: Yard, done: subprocess.CompletedProcess[str]) -> None:
    assert done.returncode != 0, f"the run was not refused: {show(done)}"
    assert not yard.ran(), f"the command ran on a refused head\n{show(done)}"
    assert not (yard.factory / "rd.pid").exists(), "a refused run left rd.pid"
    lock = yard.lock()
    assert lock["holder"] is None, f"a refused run kept the lock: {lock}"
    assert lock["waiters"] == [], f"a refused run kept its place in the queue: {lock}"


# --- a review PASS, recorded for this head, before any posting run


def test_a_posting_run_on_a_head_with_no_review_recorded_is_refused_naming_the_missing_pass(
    yard: Yard,
) -> None:
    done = yard.run("posting", yard.first)
    assert_refused_and_left_free(yard, done)
    assert "PASS" in said(done), show(done)


def test_a_posting_run_on_a_head_the_review_sent_back_to_fix_is_refused(yard: Yard) -> None:
    yard.review(yard.first, "FIX")
    done = yard.run("posting", yard.first)
    assert_refused_and_left_free(yard, done)
    assert "PASS" in said(done), show(done)


def test_a_pass_recorded_for_an_earlier_head_does_not_admit_a_later_one(yard: Yard) -> None:
    yard.review(yard.first, "PASS")
    later = yard.push("fix: round 1")
    yard.pr_head(later)
    done = yard.run("posting", later)
    assert_refused_and_left_free(yard, done)
    assert "PASS" in said(done), show(done)


def test_a_posting_run_on_the_branch_tip_the_review_passed_runs_its_command(yard: Yard) -> None:
    yard.review(yard.first, "PASS")
    done = yard.run("posting", yard.first)
    assert done.returncode == 0, show(done)
    assert yard.ran(), show(done)


@pytest.mark.parametrize("kind", ["scored", "no-post"])
def test_a_scored_or_no_post_run_needs_no_review_pass(yard: Yard, kind: str) -> None:
    done = yard.run(kind, yard.first)
    assert done.returncode == 0, show(done)
    assert yard.ran(), show(done)


# --- a head a newer push replaced


def test_a_posting_run_on_a_head_its_branch_has_moved_past_is_refused_naming_the_newer_head(
    yard: Yard,
) -> None:
    yard.review(yard.first, "PASS")  # the review passed this head, then the builder pushed again
    newer = yard.push("fix: one more change")
    yard.pr_head(newer)
    done = yard.run("posting", yard.first)
    assert_refused_and_left_free(yard, done)
    assert newer[:8] in said(done), show(done)


def test_a_queued_posting_run_whose_head_is_replaced_while_it_waits_never_runs(yard: Yard) -> None:
    """The lock is held by another run; this one queues on a passed tip; a push replaces the tip
    while it waits; when the lock frees, it does not run and says which head replaced it."""
    yard.review(yard.first, "PASS")
    other = "ab" * 20
    held = yard.rdlock("acquire", "--kind", "posting", "--head", other, "--pid", str(os.getpid()))
    held_ok = held.returncode == 0
    assert held_ok, show(held)
    waiting = subprocess.Popen(
        yard.argv("posting", yard.first),
        cwd=yard.clone,
        env=yard.env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.DEVNULL,
        text=True,
    )
    try:
        queued = False
        for _ in range(600):  # each look is one `rdlock status` process: no sleep, no clock
            if waiting.poll() is not None:
                break
            yard.rdlock("status")
            if any(w.get("head") == yard.first for w in yard.lock()["waiters"]):
                queued = True
                break
        assert queued, f"the run never joined the queue (exit {waiting.poll()})"
        newer = yard.push("fix: pushed while the run waited")
        yard.pr_head(newer)
        released = yard.rdlock(
            "release", "--kind", "posting", "--head", other, "--pid", str(os.getpid())
        )
        assert released.returncode == 0, show(released)
        out, err = waiting.communicate(timeout=300)
    finally:
        if waiting.poll() is None:
            waiting.kill()
            waiting.communicate()
    done = subprocess.CompletedProcess(waiting.args, waiting.returncode, out, err)
    assert_refused_and_left_free(yard, done)
    assert newer[:8] in said(done), show(done)
