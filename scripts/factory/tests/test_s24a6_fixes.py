"""S24-A6 fix round: one release rule for builders (a record ends when its branch's PR ended, merged or
closed, after it started), the posting gate's clean-merge cover, and a running posting run cancelled when
its branch moves."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import governor, rdlock, watch
from scripts.factory.tests.acceptance.ts24a6.test_rdlock_posting import PR, Yard, said, show

NOW = datetime(2026, 10, 12, 21, 0, tzinfo=UTC)


def cloud_record(
    ticket: str, branch: str, started: str, session: str = "session_01Dead"
) -> dict[str, Any]:
    return {
        "ticket": ticket,
        "branch": branch,
        "where": "cloud",
        "role": "builder",
        "budget_minutes": 120,
        "session_id": session,
        "started_at": started,
        "judge": {"ok": True},
        "stop_sent": False,
        "review": None,
    }


def put(folder: Path, record: dict[str, Any]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    stamp = record["started_at"].replace("-", "").replace(":", "")
    (folder / f"{record['ticket']}-{stamp}.json").write_text(json.dumps(record))


def pr_row(branch: str, state: str, *, end: str | None = None, number: int = 600) -> dict[str, Any]:
    return {
        "number": number,
        "headRefName": branch,
        "state": state,
        "createdAt": "2026-10-12T08:00:00Z",
        "closedAt": end,
        "mergedAt": end if state == "MERGED" else None,
    }


@pytest.fixture
def factory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("VEXTRUS_FACTORY_DIR", str(tmp_path))
    monkeypatch.setenv("VEXTRUS_NOW", "2026-10-12T11:00:00Z")
    return tmp_path


def live(factory: Path, ticket: str, rows: list[dict[str, Any]]) -> str | None:
    return governor.live_builder(ticket, factory / "launches", agent_rows=list, prs=lambda: rows)


# --- one release rule


def test_a_builder_whose_pr_closed_unmerged_after_it_started_is_not_live(factory: Path) -> None:
    put(factory / "launches", cloud_record("t-one", "t-one", "2026-10-12T09:00:00Z"))
    closed = pr_row("t-one", "CLOSED", end="2026-10-12T10:00:00Z")
    assert live(factory, "t-one", [closed]) is None
    assert "session_01Dead" in (live(factory, "t-one", []) or "")


def test_a_relaunch_after_the_pr_merged_is_live(factory: Path) -> None:
    put(factory / "launches", cloud_record("t777", "t777-branch", "2026-10-12T20:30:00Z"))
    merged = pr_row("t777-branch", "MERGED", end="2026-10-12T19:00:00Z")
    assert "session_01Dead" in (live(factory, "t777", [merged]) or "")


def test_a_record_of_another_ticket_with_a_shared_prefix_is_not_this_tickets(factory: Path) -> None:
    put(factory / "launches", cloud_record("t1-x", "t1-x", "2026-10-12T20:30:00Z"))
    assert live(factory, "t1", []) is None


def test_the_watcher_drops_a_ticket_only_when_its_pr_ended_after_it_started(factory: Path) -> None:
    put(factory / "launches", cloud_record("told", "told-b", "2026-10-12T09:00:00Z"))
    put(factory / "launches", cloud_record("trel", "trel-b", "2026-10-12T20:30:00Z"))
    put(factory / "launches", cloud_record("tshut", "tshut-b", "2026-10-12T09:00:00Z"))
    rows = [
        pr_row("told-b", "MERGED", end="2026-10-12T10:00:00Z", number=1),
        pr_row("trel-b", "MERGED", end="2026-10-12T19:00:00Z", number=2),
        pr_row("tshut-b", "CLOSED", end="2026-10-12T10:00:00Z", number=3),
    ]
    since = datetime(2026, 10, 12, 0, 0, tzinfo=UTC)
    records, _ = watch.load_launches(factory, since, rows)
    assert sorted(records) == ["trel"]


# --- the posting gate covers a clean merge of main


def _git(cwd: Path, *args: str) -> str:
    done = subprocess.run(
        [
            "git",
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@example.invalid",
            "-c",
            "commit.gpgsign=false",
            *args,
        ],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
    )
    return done.stdout.strip()


def test_a_head_that_is_a_clean_merge_of_main_past_a_passed_head_is_covered(
    factory: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    (repo / "a.txt").write_text("a\n")
    _git(repo, "add", "a.txt")
    _git(repo, "commit", "-q", "-m", "seed")
    _git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    _git(repo, "checkout", "-q", "-b", "work")
    (repo / "w.txt").write_text("w\n")
    _git(repo, "add", "w.txt")
    _git(repo, "commit", "-q", "-m", "work")
    passed_head = _git(repo, "rev-parse", "HEAD")
    _git(repo, "checkout", "-q", "main")
    (repo / "m.txt").write_text("m\n")
    _git(repo, "add", "m.txt")
    _git(repo, "commit", "-q", "-m", "main moves")
    _git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    _git(repo, "checkout", "-q", "work")
    _git(repo, "merge", "-q", "--no-ff", "-m", "merge main", "main")
    merged_head = _git(repo, "rev-parse", "HEAD")
    record = {
        "schema_version": 1,
        "pr": 9,
        "head": passed_head,
        "round": 2,
        "verdict": "PASS",
        "counts": {
            "reviewers": 2,
            "findings": 0,
            "findings_ge_50": 0,
            "confirmed": 0,
            "refuted": 0,
            "unproven": 0,
            "unrefuted_ge_50": 0,
        },
        "decision_input_sha256": "ab" * 32,
        "comment_id": 5,
        "exception": None,
        "source": "review-pr",
        "recorded_at": "2026-10-12T15:50:00Z",
    }
    ledger = factory / "ledger"
    ledger.mkdir()
    (ledger / f"9-{passed_head}.json").write_text(json.dumps(record))
    monkeypatch.chdir(repo)
    assert rdlock.covered(merged_head)
    (repo / "w.txt").write_text("w2\n")
    _git(repo, "add", "w.txt")
    _git(repo, "commit", "-q", "-m", "new work")
    assert not rdlock.covered(_git(repo, "rev-parse", "HEAD"))


# --- a running posting run is cancelled when its branch moves


def test_a_running_posting_run_is_stopped_with_a_cancelled_line_when_the_branch_moves(
    tmp_path: Path,
) -> None:
    yard = Yard(tmp_path)
    yard.review(yard.first, "PASS")
    env = yard.env()
    env["VEXTRUS_RDLOCK_POLL"] = "1"
    command = f"import time; time.sleep(40); open({str(yard.marker)!r}, 'w').write('ran')"
    argv = [
        sys.executable,
        "-m",
        "scripts.factory.rdlock",
        "run",
        "--kind",
        "posting",
        "--head",
        yard.first,
        "--ticket",
        "s24-x1",
        "--",
        sys.executable,
        "-c",
        command,
    ]
    proc = subprocess.Popen(
        argv, cwd=yard.clone, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    try:
        for _ in range(100):  # wait for the run to hold the lock
            if yard.lock()["holder"] is not None or proc.poll() is not None:
                break
            time.sleep(0.1)
        assert yard.lock()["holder"] is not None, "the run never started"
        newer = yard.push("fix: pushed while the run ran")
        out, err = proc.communicate(timeout=60)
    finally:
        if proc.poll() is None:
            proc.kill()
    done = subprocess.CompletedProcess(argv, proc.returncode, out, err)
    assert done.returncode == rdlock.CANCELLED, show(done)
    assert "CANCELLED" in said(done), show(done)
    assert newer[:8] in said(done), show(done)
    assert not yard.ran(), "the command finished after its branch moved"
    assert yard.lock()["holder"] is None
    assert not (yard.factory / "rd.pid").exists()
    assert PR  # the yard's PR is open throughout


# --- round 3: one reader of a ticket's records, one release rule, pending launches


def test_the_branch_of_a_ticket_is_never_taken_from_a_ticket_that_shares_its_prefix(
    factory: Path,
) -> None:
    folder = factory / "launches"
    put(folder, cloud_record("s22-fl5", "s22-fl5b", "2026-10-12T09:00:00Z"))
    put(folder, cloud_record("s22-fl5-ACC", "s22-fl5", "2026-10-12T08:00:00Z"))
    put(folder, cloud_record("s22-fl5-FIX1", "s22-fl5-fix", "2026-10-12T10:00:00Z"))
    assert rdlock.ticket_branch("s22-fl5") == "s22-fl5b"
    assert [r["ticket"] for _, r in governor.launch_records("s22-fl5", folder)] == ["s22-fl5"]


def test_a_branch_with_an_open_pr_is_not_released_by_an_older_closed_one(factory: Path) -> None:
    put(factory / "launches", cloud_record("tre", "tre-b", "2026-10-12T09:00:00Z"))
    rows = [
        pr_row("tre-b", "CLOSED", end="2026-10-12T10:00:00Z", number=610),
        pr_row("tre-b", "OPEN", number=611),
    ]
    assert "session_01Dead" in (live(factory, "tre", rows) or "")
    since = datetime(2026, 10, 12, 0, 0, tzinfo=UTC)
    records, _ = watch.load_launches(factory, since, rows)
    assert sorted(records) == ["tre"]


def test_a_fork_pr_never_releases_a_factory_branch(factory: Path) -> None:
    put(factory / "launches", cloud_record("tfk", "tfk-b", "2026-10-12T09:00:00Z"))
    fork = {**pr_row("tfk-b", "CLOSED", end="2026-10-12T09:31:00Z"), "isCrossRepository": True}
    assert "session_01Dead" in (live(factory, "tfk", [fork]) or "")
    records, _ = watch.load_launches(factory, None, [fork])
    assert sorted(records) == ["tfk"]


def test_the_watcher_leaves_fork_prs_out_of_its_list(
    factory: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seam = tmp_path / "prs.json"
    rows = [
        {"number": 1, "headRefName": "x", "isCrossRepository": True},
        {"number": 2, "headRefName": "y"},
    ]
    seam.write_text(json.dumps(rows))
    monkeypatch.setenv("VEXTRUS_PRS_FILE", str(seam))
    assert [r["number"] for r in watch.gh_prs() or []] == [2]


def test_a_launch_in_flight_counts_as_a_live_builder_but_the_callers_own_does_not(factory: Path) -> None:
    pending = factory / "pending"
    pending.mkdir()
    other = os.getppid()  # a live process that is not the caller
    record = {"ticket": "tnew", "branch": "tnew-b", "where": "cloud", "role": "builder", "pid": other}
    (pending / f"tnew-{other}.json").write_text(json.dumps(record))
    said_ = governor.live_builder("tnew", factory / "launches", agent_rows=list, prs=list)
    assert said_ is not None
    assert str(other) in said_
    assert (
        governor.live_builder("tnew", factory / "launches", agent_rows=list, prs=list, own_pid=other)
        is None
    )


# --- round 4: a refused launch is no builder; the contract lists builder-live


def test_a_refused_launch_record_never_names_the_tickets_branch(factory: Path) -> None:
    folder = factory / "launches"
    put(folder, cloud_record("tref", "tref-real", "2026-10-12T09:00:00Z"))
    refused = cloud_record("tref", "tref-other", "2026-10-12T10:00:00Z", session="")
    refused["session_id"] = None
    refused["judge"] = {"ok": False, "code": "builder-live"}
    put(folder, refused)
    writer = cloud_record("tref", "tref-writer", "2026-10-12T11:00:00Z", session="session_01W")
    writer["role"] = "acceptance-writer"
    put(folder, writer)
    assert rdlock.ticket_branch("tref") == "tref-real"
    assert len(governor.launch_records("tref", folder)) == 2


def test_every_refusal_code_the_launchers_print_is_in_the_contracts_list() -> None:
    root = Path(__file__).resolve().parents[3]
    contract = (root / "docs/specs/factory/contracts/launch-cli.md").read_text()
    listed = contract.split("`<code>` in `REFUSED <code>: ...` is one of:")[1].split("\n\n")[0]
    for code in ("builder-live", "duplicate-name", "branch-not-on-origin"):
        assert f"`{code}`" in listed, code


# --- round 5: a local record without a session id is a builder; a posting run needs no --ticket


def test_a_local_builder_whose_session_id_was_not_read_still_blocks_a_second_builder(
    factory: Path,
) -> None:
    record = {
        "ticket": "t-loc",
        "branch": "t-loc",
        "where": "local",
        "role": "builder",
        "name": "t-loc-builder",
        "session_id": None,
        "judge": None,
        "started_at": "2026-10-12T10:30:00Z",
        "stop_sent": False,
        "review": None,
    }
    put(factory / "launches", record)
    rows = [{"name": "t-loc-builder", "pid": 4242, "state": "working"}]
    found = governor.live_builder("t-loc", factory / "launches", agent_rows=lambda: rows, prs=list)
    assert found is not None
    assert "t-loc-builder" in found
    assert len(governor.launch_records("t-loc", factory / "launches")) == 1


def test_the_runbook_passes_the_ticket_on_the_real_drawing_line() -> None:
    root = Path(__file__).resolve().parents[3]
    text = (root / ".claude/skills/orchestrate-wave/commands.md").read_text()
    lines = [line for line in text.splitlines() if "scripts.factory.rdlock run" in line]
    assert lines
    assert all("--ticket" in line for line in lines), lines


def test_a_posting_run_with_a_ticket_is_refused_when_the_branch_tip_cannot_be_read(
    tmp_path: Path,
) -> None:
    yard = Yard(tmp_path)
    yard.review(yard.first, "PASS")
    yard.git(yard.clone, "remote", "set-url", "origin", str(tmp_path / "gone.git"))
    done = yard.run("posting", yard.first)
    assert done.returncode == rdlock.REFUSED, show(done)
    assert "unreadable" in said(done), show(done)
    assert not yard.ran()


def test_a_posting_run_without_a_ticket_never_calls_gh(tmp_path: Path) -> None:
    yard = Yard(tmp_path)
    yard.review(yard.first, "PASS")
    calls = tmp_path / "gh-calls.txt"
    (yard.stubs / "gh").write_text(
        f"#!{sys.executable}\nimport sys\nopen({str(calls)!r}, 'a').write('x')\nsys.exit(1)\n"
    )
    argv = yard.argv("posting", yard.first)
    at = argv.index("--ticket")
    done = subprocess.run(
        [*argv[:at], *argv[at + 2 :]],
        cwd=yard.clone,
        env={k: v for k, v in yard.env().items() if k != "VEXTRUS_PRS_FILE"},
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )
    assert done.returncode == 0, show(done)
    assert not calls.exists(), "rdlock called gh without a ticket"
