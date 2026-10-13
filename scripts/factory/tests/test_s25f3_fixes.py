"""S25-F3 fix round: a posting run's `--ticket` is matched without regard to case and refuses when no
builder launch record names it; a run of the real-drawing runner refuses when the commit the runner
would read is not `--head`."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from scripts.factory import rdlock
from scripts.factory.tests.acceptance.ts24a6.test_rdlock_posting import (
    TICKET,
    Yard,
    assert_refused_and_left_free,
    said,
    show,
)


@pytest.fixture
def yard(tmp_path: Path) -> Yard:
    return Yard(tmp_path)


def run_with(yard: Yard, kind: str, head: str, ticket: str) -> subprocess.CompletedProcess[str]:
    argv = yard.argv(kind, head)
    argv[argv.index("--ticket") + 1] = ticket
    return subprocess.run(
        argv,
        cwd=yard.clone,
        env=yard.env(),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )


def respell(yard: Yard, spelling: str) -> None:
    """The factory's real records spell the ticket in upper case (`S25-F3`) and the branch in lower."""
    old = yard.factory / "launches" / f"{TICKET}-20261012T150000Z.json"
    record = json.loads(old.read_text())
    record["ticket"] = spelling
    old.unlink()
    (yard.factory / "launches" / f"{spelling}-20261012T150000Z.json").write_text(json.dumps(record))


def test_a_ticket_in_the_branchs_casing_is_checked_against_the_newer_head(yard: Yard) -> None:
    respell(yard, "S24-X1")
    yard.review(yard.first, "PASS")
    newer = yard.push("fix: pushed after the PASS")
    for spelled in ("s24-x1", "S24-X1"):
        done = run_with(yard, "posting", yard.first, spelled)
        assert done.returncode == rdlock.REFUSED, show(done)
        assert newer[:8] in said(done), show(done)
        assert_refused_and_left_free(yard, done)


def test_a_ticket_in_the_branchs_casing_runs_on_the_current_head(yard: Yard) -> None:
    respell(yard, "S24-X1")
    yard.review(yard.first, "PASS")
    done = run_with(yard, "posting", yard.first, "s24-x1")
    assert done.returncode == 0, show(done)
    assert yard.ran()


def test_a_posting_run_with_a_ticket_that_has_no_launch_record_is_refused(yard: Yard) -> None:
    yard.review(yard.first, "PASS")
    done = run_with(yard, "posting", yard.first, "s24-x9")
    assert done.returncode == rdlock.REFUSED, show(done)
    assert "s24-x9" in said(done), show(done)
    assert_refused_and_left_free(yard, done)


def test_other_kinds_with_an_unknown_ticket_are_not_gated(yard: Yard) -> None:
    done = run_with(yard, "no-post", yard.first, "s24-x9")
    assert done.returncode == 0, show(done)
    assert yard.ran()


def fake_runner(yard: Yard) -> Path:
    """A `scripts/real-drawings` in the yard's clone that only writes the marker."""
    script = yard.clone / "scripts" / "real-drawings"
    script.parent.mkdir(exist_ok=True)
    script.write_text(f"#!/bin/sh\ntouch {yard.marker}\n")
    script.chmod(0o755)
    return script


def run_runner(yard: Yard, kind: str, head: str, *words: str) -> subprocess.CompletedProcess[str]:
    script = fake_runner(yard)
    return subprocess.run(
        [*yard.argv(kind, head)[:7], head, "--", str(script), *words],
        cwd=yard.clone,
        env=yard.env(),
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )


def test_a_run_of_the_runner_refuses_when_the_local_branch_is_not_the_head(yard: Yard) -> None:
    newer = yard.push("fix: origin's tip")
    yard.git(yard.clone, "reset", "-q", "--hard", yard.first)  # the local branch is stale
    done = run_runner(yard, "no-post", newer, "s24-x1-work", "--no-post")
    assert done.returncode == rdlock.REFUSED, show(done)
    assert yard.first[:8] in said(done), show(done)
    assert newer[:8] in said(done), show(done)
    assert_refused_and_left_free(yard, done)


def test_a_run_of_the_runner_runs_when_the_local_branch_is_the_head(yard: Yard) -> None:
    newer = yard.push("fix: origin's tip")
    done = run_runner(yard, "no-post", newer, "s24-x1-work", "--no-post")
    assert done.returncode == 0, show(done)
    assert yard.ran()


def test_a_run_of_the_runner_on_a_branch_that_is_not_local_is_refused(yard: Yard) -> None:
    done = run_runner(yard, "no-post", yard.first, "s24-x1-gone", "--no-post")
    assert done.returncode == rdlock.REFUSED, show(done)
    assert not yard.ran()


def test_a_pr_target_is_compared_with_origins_pull_head(yard: Yard) -> None:
    yard.git(yard.clone, "push", "-q", "origin", f"{yard.first}:refs/pull/{701}/head")
    newer = yard.push("fix: origin's tip")
    done = run_runner(yard, "no-post", newer, "701", "--no-post")
    assert done.returncode == rdlock.REFUSED, show(done)
    assert not yard.ran()
    done = run_runner(yard, "no-post", yard.first, "701", "--no-post")
    assert done.returncode == 0, show(done)
