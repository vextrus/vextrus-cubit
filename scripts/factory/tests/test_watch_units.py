"""Unit tests of the watcher's trailer parser, its views of the run folder and its command lines."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import trailers, watch

TREE = "a" * 40
OTHER = "b" * 40
AT = datetime(2026, 10, 4, 21, 8, tzinfo=UTC)


@pytest.mark.parametrize(
    ("last_paragraph", "outcome"),
    [
        (f"Factory-State: READY\nFactory-Verify: {TREE} ok", "READY"),
        (f"factory-state: READY\nFACTORY-VERIFY: {TREE} ok", "READY"),
        (
            f"Factory-State: READY\nFactory-Verify: {TREE} ok\nCo-Authored-By: x <x@example.invalid>",
            "READY",
        ),
        ("Factory-State: READY", "READY-NO-VERIFY"),
        (f"Factory-State: READY\nFactory-Verify: {OTHER} ok", "READY-NO-VERIFY"),
        (f"Factory-State: READY\nFactory-Verify: {TREE} OK", "READY-NO-VERIFY"),
        (f"Factory-State: READY\nFactory-Verify: {TREE} ok\nFactory-Reason: x", "READY-NO-VERIFY"),
        (f"Factory-State: Ready\nFactory-Verify: {TREE} ok", "READY-NO-VERIFY"),
        (f"Factory-State: READY\nFactory-State: BLOCKED\nFactory-Verify: {TREE} ok", "READY-NO-VERIFY"),
        (f"Factory-State: READY\nFactory-Verify: {TREE} ok\nFactory-Mood: fine", "READY-NO-VERIFY"),
        ("Factory-State: BLOCKED\nFactory-Reason: waiting on a ruling", "BLOCKED"),
        (f"Factory-State: BLOCKED\nFactory-Reason: r\nFactory-Verify: {TREE} ok", "BLOCKED"),
        ("Factory-State: BLOCKED", None),
        ("Factory-State: BLOCKED\nFactory-Reason: " + "x" * 201, None),
        ("Factory-State: DONE", None),
        (f"Factory-Verify: {TREE} ok", None),
        ("Signed-off-by: someone", None),
    ],
)
def test_trailers_follow_trailers_md(last_paragraph: str, outcome: str | None) -> None:
    message = f"feat: a thing\n\nThe body.\n\n{last_paragraph}\n"
    assert watch.parse_trailers(message, TREE).outcome == outcome


def test_the_factory_block_is_read_from_the_last_two_paragraphs_only() -> None:
    """trailers.md 1: the read paragraph is the last of the last two holding a `Factory-*` line; one
    further back raises READY-NO-VERIFY, never silence."""
    block = f"Factory-State: READY\nFactory-Verify: {TREE} ok"
    second_last = f"feat: x\n\n{block}\n\nA closing line.\n"
    assert watch.parse_trailers(second_last, TREE).outcome == "READY"
    third_last = f"feat: x\n\n{block}\n\nA closing line.\n\n{ATTRIBUTION}\n"
    parsed = watch.parse_trailers(third_last, TREE)
    assert parsed.outcome == "READY-NO-VERIFY"
    assert parsed.why == "factory trailer not in the last paragraph"
    assert watch.parse_trailers("", TREE).outcome is None


def test_a_blocked_reason_is_kept_as_one_public_line() -> None:
    parsed = watch.parse_trailers(
        "fix: x\n\nFactory-State: BLOCKED\nFactory-Reason: the\tspec\x07 is silent\n", TREE
    )
    assert parsed.reason == "the spec is silent"


def test_the_lock_view_maps_rdlocks_kinds_to_the_schemas(tmp_path: Path) -> None:
    entry = {
        "kind": "posting",
        "head": "c" * 40,
        "ticket": "t228",
        "pid": 1,
        "since": "2026-10-04T20:54:00Z",
    }
    waiter = {**entry, "kind": "scored", "head": "short"}
    (tmp_path / "rdlock.json").write_text(
        json.dumps({"holder": entry, "waiters": [waiter, {"kind": "x"}]})
    )
    view = watch.lock_view(tmp_path, AT)
    assert view["holder"] == {
        "kind": "post",
        "ticket": "t228",
        "head": "c" * 40,
        "since": "2026-10-04T20:54:00Z",
        "elapsed_minutes": 14,
    }
    assert view["waiters"] == [
        {"kind": "scored", "ticket": "t228", "head": None, "since": entry["since"]}
    ]
    assert watch.lock_view(tmp_path / "none", AT) == {"holder": None, "waiters": []}


def test_reviews_skip_closed_prs_and_a_pass_on_the_current_head(tmp_path: Path) -> None:
    ledger = tmp_path / "ledger"
    ledger.mkdir()
    for pr, head, round_, verdict in (
        (1, "d" * 40, 1, "FIX"),
        (1, "e" * 40, 2, "FIX"),
        (2, "f" * 40, 1, "FIX"),
    ):
        record = {
            "pr": pr,
            "head": head,
            "round": round_,
            "verdict": verdict,
            "recorded_at": f"r{round_}",
        }
        (ledger / f"{pr}-{head}.json").write_text(json.dumps(record))
    (ledger / "broken.json").write_text("{")
    prs = [{"number": 2, "state": "MERGED", "headRefOid": "f" * 40}]
    assert watch.reviews_view(tmp_path, prs) == [{"pr": 1, "round": 2, "head": "e" * 40}]


def test_gh_pr_list_is_the_command_line(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("VEXTRUS_PRS_FILE", raising=False)
    record = tmp_path / "gh.argv"
    gh = tmp_path / "gh"
    gh.write_text(
        f"#!{sys.executable}\nimport json, sys\n"
        f"open({str(record)!r}, 'w').write(json.dumps(sys.argv[1:]))\n"
        "rows = [{'number': 7, 'headRefName': 'b', 'headRefOid': 'x', 'state': 'OPEN'}, {}]\n"
        "print(json.dumps(rows))\n"
    )
    gh.chmod(0o755)
    monkeypatch.setenv("PATH", f"{tmp_path}{os.pathsep}{os.environ['PATH']}")
    assert watch.gh_prs() == [{"number": 7, "headRefName": "b", "headRefOid": "x", "state": "OPEN"}]
    argv = json.loads(record.read_text())
    assert argv[:2] == ["pr", "list"]
    assert argv[argv.index("--json") + 1] == "number,headRefName,headRefOid,state"


def test_the_default_scanner_is_the_main_checkouts_tools_leakscan(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("VEXTRUS_LEAKSCAN_CMD", raising=False)
    monkeypatch.chdir(tmp_path)
    assert watch.leakscan_command() is None
    (tmp_path / "tools" / "leakscan").mkdir(parents=True)
    assert watch.leakscan_command() == [sys.executable, "-m", "tools.leakscan"]


def test_a_scanner_that_cannot_scan_is_an_alarm_without_text(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    scanner = tmp_path / "scan"
    scanner.write_text(
        f"#!{sys.executable}\nprint('HIT a secret line here 3')\n"
        "print('leakscan: cannot-scan no-corpus')\n"
        "raise SystemExit(2)\n"
    )
    scanner.chmod(0o755)
    monkeypatch.setenv("VEXTRUS_LEAKSCAN_CMD", str(scanner))
    assert watch.leak_scan("1" * 40, None) == {
        "result": "cannot-scan",
        "where": "cannot-scan:no-corpus",
        "n": 0,
    }


def test_a_process_is_a_watcher_only_by_its_command_line() -> None:
    assert not watch.is_watcher(os.getpid())
    assert not watch.is_watcher(2**22 + 1)


def test_review_launches_are_not_builders_and_name_their_launched_head(tmp_path: Path) -> None:
    launches = tmp_path / "launches"
    launches.mkdir()
    head = "c" * 40
    builder = {
        "ticket": "f3",
        "branch": "f3-branch",
        "where": "cloud",
        "started_at": "2026-10-04T20:00:00Z",
    }
    review = {
        **builder,
        "ticket": "review-250-abcdef12",
        "branch": "review/250-abcdef12",
        "review": {"pr": 250, "head_sha": head, "nonce": "0" * 32, "branch": "review/250-abcdef12"},
    }
    (launches / "f3-20261004T200000Z.json").write_text(json.dumps(builder))
    (launches / "review-250-abcdef12-20261004T200000Z.json").write_text(json.dumps(review))
    builders, reviews = watch.load_launches(tmp_path, None)
    assert set(builders) == {"f3"}
    assert reviews == {"review/250-abcdef12": head}


def test_review_ready_fires_only_for_a_verdict_commit_on_a_recorded_review_branch(
    tmp_path: Path,
) -> None:
    head, verdict = "c" * 40, "d" * 40
    reviews = {"review/250-abcdef12": head}

    def alarms(refs: dict[str, str]) -> list[str]:
        step = watch.Pass(tmp_path, AT, {"claude_baseline": []})
        watch.watch_branches(step, refs, reviews)
        return sorted(step.alarms)

    assert alarms({"review/250-abcdef12": head}) == [], (
        "the branch the orchestrator pushed is no verdict"
    )
    assert alarms({"review/250-abcdef12": verdict}) == [f"REVIEW-READY|review/250-abcdef12|{verdict}"]
    assert alarms({"review/251-0011aabb": head}) == ["REVIEW-READY|review/251-0011aabb"]


@pytest.mark.parametrize(("code", "moved"), [(0, None), (2, "kept"), (1, "jev-1.13.0 -> jev-1.14.0")])
def test_every_models_check_that_ran_is_stamped(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, code: int, moved: str | None
) -> None:
    jev = tmp_path / "jev"
    line = "JEV-MODEL-MOVED jev-1.13.0 -> jev-1.14.0" if code == 1 else "unavailable busy"
    jev.write_text(f"#!{sys.executable}\nprint({line!r})\nraise SystemExit({code})\n")
    jev.chmod(0o755)
    monkeypatch.setenv("VEXTRUS_JEV_CMD", str(jev))
    step = watch.Pass(tmp_path, AT, {"jev_moved": "kept"})
    watch.watch_jev(step)
    assert step.state["jev_checked_at"] == "2026-10-04T21:08:00Z"
    assert step.state["jev_moved"] == moved


ATTRIBUTION = "Co-Authored-By: x <x@example.invalid>\nClaude-Session: https://example.invalid/s"


def test_a_factory_block_before_the_attribution_paragraph_is_read() -> None:
    """One rule for every consumer (the guard's push gate and the stop gate share it): the T-W317 shape,
    a Factory block, a blank line, then the attribution block, reads as written."""
    before = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {TREE} ok\n\n{ATTRIBUTION}\n"
    assert watch.parse_trailers(before, TREE).outcome == "READY"
    blocked = f"feat: x\n\nFactory-State: BLOCKED\nFactory-Reason: r\n\n{ATTRIBUTION}\n"
    assert watch.parse_trailers(blocked, TREE) == trailers.Trailers("BLOCKED", "r")
    within = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {TREE} ok\n{ATTRIBUTION}\n"
    assert watch.parse_trailers(within, TREE).outcome == "READY"
    block = "Factory-State: BLOCKED\nFactory-Reason: r"
    both = f"feat: x\n\n{block}\n\n{block}\n"
    assert watch.parse_trailers(both, TREE).why == "factory trailer not in the last paragraph"


def git_in(repo: Path, *args: str) -> str:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_AUTHOR_NAME="t",
        GIT_AUTHOR_EMAIL="t@example.invalid",
        GIT_COMMITTER_NAME="t",
        GIT_COMMITTER_EMAIL="t@example.invalid",
        GIT_AUTHOR_DATE="2026-01-01T00:00:00+0000",
        GIT_COMMITTER_DATE="2026-01-01T00:00:00+0000",
    )
    done = subprocess.run(["git", *args], cwd=repo, env=env, capture_output=True, text=True, check=True)
    return done.stdout.strip()


def test_the_local_head_is_the_checkouts_own_ref(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    git_in(tmp_path, "init", "-q", "-b", "main")
    git_in(tmp_path, "commit", "-q", "--allow-empty", "-m", "seed")
    seed = git_in(tmp_path, "rev-parse", "HEAD")
    git_in(tmp_path, "update-ref", "refs/heads/t-branch", seed)
    monkeypatch.chdir(tmp_path)
    assert watch.local_head("t-branch") == seed
    assert watch.local_head("no-such-branch") is None
    assert watch.local_head("a..b") is None


class Repo:
    """A git repository at `path` with main, a ticket branch and helpers for the track() seam."""

    def __init__(self, path: Path) -> None:
        self.path = path
        git_in(path, "init", "-q", "-b", "main")
        self.commit("seed", "seed.txt")
        self.seed = self.sha("HEAD")

    def sha(self, ref: str) -> str:
        return git_in(self.path, "rev-parse", ref)

    def commit(self, message: str, name: str) -> str:
        (self.path / name).write_text(f"{name}\n")
        git_in(self.path, "add", name)
        git_in(self.path, "commit", "-q", "-m", message)
        return self.sha("HEAD")

    def ready(self, name: str) -> str:
        (self.path / name).write_text(f"{name}\n")
        git_in(self.path, "add", name)
        tree = git_in(self.path, "write-tree")
        message = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {tree} ok"
        git_in(self.path, "commit", "-q", "-m", message)
        return self.sha("HEAD")


def cloud_record(branch: str) -> dict[str, Any]:
    return {
        "ticket": "tu",
        "branch": branch,
        "where": "cloud",
        "budget_minutes": 30,
        "_started": datetime(2026, 10, 4, 19, 0, tzinfo=UTC),
    }


def seen_ready(head: str, *, stale: bool = False) -> dict[str, Any]:
    ticket = {
        "branch": "tu-branch",
        "head": head,
        "last_push_at": "2026-10-04T19:10:00Z",
        "outcome": "READY",
        "outcome_at": "2026-10-04T19:10:00Z",
        "ready_head": head,
    }
    state: dict[str, Any] = {"schema": 1, "alarms": {}, "tickets": {"tu": ticket}}
    if not stale:  # a state an older watcher wrote has no parser version
        state["parser"] = watch.PARSER
    return state


def track_once(state: dict[str, Any], head: str, main: str) -> tuple[watch.Pass, dict[str, Any]]:
    step = watch.Pass(Path("unused"), AT, state)
    refs = {"tu-branch": head, "main": main}
    return step, watch.track(step, "tu", cloud_record("tu-branch"), refs, main, [], None)


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Repo:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(watch, "leak_scan", lambda head, main: {"result": "clean"})
    return Repo(tmp_path)


def test_an_outcome_cached_by_an_older_parser_is_read_again_once(repo: Repo) -> None:
    git_in(repo.path, "checkout", "-q", "-b", "tu-branch")
    head = repo.ready("r.txt")
    state = seen_ready(head, stale=True)
    state["tickets"]["tu"].update(outcome=None, ready_head=None)
    step, item = track_once(state, head, repo.seed)
    assert item["state"] == "ready"
    assert [e for e in step.events if e[0] == "READY"] == [("READY", "tu", head[:8])]
    assert not [a for a in step.alarms.values() if a[0] in ("BUDGET-PASSED", "BUILDER-QUIET")]

    state["parser"] = watch.PARSER  # run_pass marks the state read
    step, item = track_once(state, head, repo.seed)
    assert item["state"] == "ready"
    assert step.events == []


def test_a_clean_merge_of_main_on_the_ready_head_stays_ready_without_a_new_event(
    repo: Repo,
) -> None:
    git_in(repo.path, "checkout", "-q", "-b", "tu-branch")
    ready = repo.ready("r.txt")
    git_in(repo.path, "checkout", "-q", "main")
    main = repo.commit("main moves", "m.txt")
    git_in(repo.path, "checkout", "-q", "tu-branch")
    git_in(repo.path, "merge", "-q", "--no-edit", "main")
    merged = repo.sha("HEAD")
    state = seen_ready(ready)

    step, item = track_once(state, merged, main)
    assert (item["head"], item["state"]) == (merged, "ready")
    assert [e[0] for e in step.events] == ["PUSH"]  # one READY in all: the first, not the merge's
    assert state["tickets"]["tu"]["outcome_at"] == "2026-10-04T19:10:00Z"


def test_a_merge_with_its_own_edit_or_on_an_unseen_head_is_not_ready(repo: Repo) -> None:
    git_in(repo.path, "checkout", "-q", "-b", "tu-branch")
    ready = repo.ready("r.txt")
    git_in(repo.path, "checkout", "-q", "main")
    main = repo.commit("main moves", "m.txt")
    git_in(repo.path, "checkout", "-q", "tu-branch")
    git_in(repo.path, "merge", "-q", "--no-commit", "main")
    (repo.path / "fix.txt").write_text("a fix inside the merge\n")
    git_in(repo.path, "add", "fix.txt")
    git_in(repo.path, "commit", "-q", "--no-edit")
    edited = repo.sha("HEAD")

    _, item = track_once(seen_ready(ready), edited, main)
    assert item["state"] == "working"

    git_in(repo.path, "reset", "-q", "--hard", ready)
    git_in(repo.path, "merge", "-q", "--no-edit", "main")
    clean = repo.sha("HEAD")
    _, item = track_once(seen_ready(repo.seed), clean, main)  # READY last seen on another head
    assert item["state"] == "working"


def test_an_unchanged_ready_re_read_after_an_upgrade_records_its_head_for_the_landers_merge(
    repo: Repo,
) -> None:
    git_in(repo.path, "checkout", "-q", "-b", "tu-branch")
    ready = repo.ready("r.txt")
    state = seen_ready(ready)
    state["parser"] = 1  # written by the watcher before the parser version, READY already cached
    del state["tickets"]["tu"]["ready_head"]
    step, item = track_once(state, ready, repo.seed)
    assert item["state"] == "ready"
    assert step.events == []  # unchanged: no second READY
    state["parser"] = watch.PARSER  # run_pass marks the state read

    git_in(repo.path, "checkout", "-q", "main")
    main = repo.commit("main moves", "m.txt")
    git_in(repo.path, "checkout", "-q", "tu-branch")
    git_in(repo.path, "merge", "-q", "--no-edit", "main")
    merged = repo.sha("HEAD")
    step, item = track_once(state, merged, main)
    assert (item["head"], item["state"]) == (merged, "ready")
    assert [e[0] for e in step.events] == ["PUSH"]
    assert not [a for a in step.alarms.values() if a[0] == "BUDGET-PASSED"]


def test_local_idle_measures_from_the_first_idle_reading_and_resets_when_busy(tmp_path: Path) -> None:
    seen: dict[str, Any] = {"head": TREE, "committed": True, "outcome": None, "idle_since": None}
    idle = {"name": "t-local", "status": "idle", "pid": 1}
    busy = {**idle, "status": "busy"}

    def at(minutes: int, row: dict[str, Any] | None) -> list[str]:
        step = watch.Pass(tmp_path, AT + timedelta(minutes=minutes), {})
        watch.local_idle(step, "t", seen, row)
        return [code for code, _subject, _detail in step.alarms.values()]

    assert at(0, idle) == []
    assert at(9, idle) == []
    assert at(10, idle) == ["LOCAL-IDLE"]
    assert at(11, busy) == []  # a running turn clears the clock
    assert at(12, idle) == []
    assert at(21, idle) == []
    assert at(22, idle) == ["LOCAL-IDLE"]
    assert at(40, None) == []  # no row: not this alarm's reading
    for outcome in ("READY", "BLOCKED"):
        seen.update(outcome=outcome, idle_since=None)
        assert at(50, idle) == []
        assert at(70, idle) == []
    seen.update(outcome="READY-NO-VERIFY", idle_since=None, committed=False)
    assert at(80, idle) == []  # no commit of its own yet
    assert at(95, idle) == []
