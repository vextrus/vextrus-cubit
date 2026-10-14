"""Unit tests of the watcher's trailer parser, its views of the run folder and its command lines."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger as ledger_module
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
        # S26-FX1: the watcher says BLOCKED for a head with no one-line reason (the reading stays strict)
        ("Factory-State: BLOCKED", "BLOCKED"),
        ("Factory-State: BLOCKED\nFactory-Reason: " + "x" * 201, "BLOCKED"),
        ("Factory-State: DONE", None),
        (f"Factory-Verify: {TREE} ok", None),
        ("Signed-off-by: someone", None),
    ],
)
def test_trailers_follow_trailers_md(last_paragraph: str, outcome: str | None) -> None:
    message = f"feat: a thing\n\nThe body.\n\n{last_paragraph}\n"
    assert watch.parse_trailers(message, TREE).outcome == outcome


def test_a_blocked_head_without_a_one_line_reason_says_so() -> None:
    bare = watch.parse_trailers("fix: x\n\nFactory-State: BLOCKED\n", TREE)
    assert (bare.outcome, bare.reason) == ("BLOCKED", "no reason given")
    long = watch.parse_trailers(
        "fix: x\n\nFactory-State: BLOCKED\nFactory-Reason: " + "y" * 300 + "\n", TREE
    )
    assert (long.outcome, long.reason) == ("BLOCKED", "y" * 200)
    assert trailers.read("fix: x\n\nFactory-State: BLOCKED\n", TREE).outcome is None


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


def write_records(tmp_path: Path, rows: tuple[tuple[str, int, str], ...]) -> None:
    ledger = tmp_path / "ledger"
    ledger.mkdir()
    for head, round_, verdict in rows:
        record = {"pr": 1, "head": head, "round": round_, "verdict": verdict, "recorded_at": "t"}
        (ledger / f"1-{head}.json").write_text(json.dumps(record))


def test_a_round_four_pass_on_the_head_closes_the_open_review(tmp_path: Path) -> None:
    """PR #789 review 1: rounds 4 to 9 (delta reviews) are records, read up to ledger.LAST_ROUND."""
    write_records(tmp_path, (("d" * 40, 3, "FIX"), ("e" * 40, 4, "PASS")))
    prs = [{"number": 1, "state": "OPEN", "headRefOid": "e" * 40}]
    assert watch.reviews_view(tmp_path, prs) == []


def test_a_round_four_fix_shows_round_four_on_its_head(tmp_path: Path) -> None:
    write_records(tmp_path, (("d" * 40, 3, "FIX"), ("e" * 40, 4, "FIX")))
    assert watch.reviews_view(tmp_path, None) == [{"pr": 1, "round": 4, "head": "e" * 40}]


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
    assert argv[argv.index("--json") + 1] == (
        "number,headRefName,headRefOid,state,statusCheckRollup,createdAt,closedAt,mergedAt,isCrossRepository"
    )


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


def test_a_merge_with_its_own_edit_is_not_ready_and_a_clean_one_is_whoever_saw_the_ready(
    repo: Repo,
) -> None:
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
    # READY last seen on another head: the walk back to the READY commit finds it all the same
    _, item = track_once(seen_ready(repo.seed), clean, main)
    assert item["state"] == "ready"


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


def _pass(tmp_path: Path) -> watch.Pass:
    return watch.Pass(tmp_path, AT, {})


def _pr(entries: list[dict[str, Any]], *, state: str = "OPEN", head: str = TREE) -> dict[str, Any]:
    return {
        "number": 7,
        "headRefName": "b",
        "headRefOid": head,
        "state": state,
        "statusCheckRollup": entries,
    }


def _ci(conclusion: str, **more: Any) -> dict[str, Any]:
    return {
        "__typename": "CheckRun",
        "name": "ci",
        "workflowName": "ci",
        "conclusion": conclusion,
        **more,
    }


def test_a_failed_required_ci_check_writes_one_ci_red_event_per_head(tmp_path: Path) -> None:
    step = _pass(tmp_path)
    watch.watch_ci(step, "s14-u1", _pr([_ci("FAILURE")]))
    watch.watch_ci(step, "s14-u1", _pr([_ci("FAILURE")]))  # the next read of the same head
    assert step.events == [("CI-RED", "s14-u1", f"#7 {TREE[:8]} required check ci failed")]
    watch.watch_ci(step, "s14-u1", _pr([_ci("FAILURE")], head=OTHER))  # a new head, failing again
    assert [e[0] for e in step.events] == ["CI-RED", "CI-RED"]


@pytest.mark.parametrize(
    "pr",
    [
        _pr([_ci("SUCCESS")]),
        _pr([_ci("")]),  # still running
        _pr([_ci("SKIPPED")]),
        _pr([{**_ci("FAILURE"), "name": "web"}]),  # another job is red, not the required check
        _pr([{**_ci("FAILURE"), "workflowName": "engine"}]),
        _pr([_ci("FAILURE")], state="CLOSED"),
        _pr([_ci("FAILURE")], state="MERGED"),
        _pr([]),
        {"number": 7, "state": "OPEN", "headRefOid": TREE},  # a row read before the field existed
    ],
)
def test_ci_red_is_only_the_required_check_failing_on_an_open_pr(
    tmp_path: Path, pr: dict[str, Any]
) -> None:
    step = _pass(tmp_path)
    watch.watch_ci(step, "s14-u1", pr)
    assert step.events == []


def test_a_failed_ci_status_context_is_red_too(tmp_path: Path) -> None:
    step = _pass(tmp_path)
    watch.watch_ci(
        step, "t", _pr([{"__typename": "StatusContext", "context": "ci", "state": "FAILURE"}])
    )
    assert [e[0] for e in step.events] == ["CI-RED"]
    watch.watch_ci(_pass(tmp_path), "t", None)  # no PR: nothing, no error


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


def test_events_tail_keeps_the_last_lines_of_a_log_over_the_hosts_limit(
    tmp_path: Path,
) -> None:
    """Every kind is kept (the mod's wake reads every kind, review round 2 of PR #794); a line not
    in the watcher's form is not."""
    routine = "2026-10-06T00:00:00Z PUSH t abc1234\n" * 150_000  # over 4 MiB: the mod cannot read it
    wanted = [
        "2026-10-06T01:00:00Z READY t abc1234",
        "2026-10-06T01:01:00Z OWNER-COMMAND - ! gh auth refresh",
        "2026-10-06T01:02:00Z STOP-FAILURE - rate_limit abcdef12",
    ]
    (tmp_path / "events.log").write_text(routine + "not a line\n".join(f"{w}\n" for w in wanted))
    assert (tmp_path / "events.log").stat().st_size > 4 * 1024 * 1024
    watch.write_events_tail(tmp_path)
    kept = (tmp_path / "events.tail").read_text().splitlines()
    assert kept[-3:] == wanted
    assert "not a line" not in kept
    assert not (tmp_path / "events.tail.tmp").exists()
    (tmp_path / "events.log").write_text(
        "".join(f"2026-10-06T02:00:{i % 60:02d}Z READY t{i} x\n" for i in range(300))
    )
    watch.write_events_tail(tmp_path)
    kept = (tmp_path / "events.tail").read_text().splitlines()
    assert len(kept) == watch.EVENTS_TAIL_LINES
    assert kept[-1].endswith(" READY t299 x")


def test_events_tail_without_a_log_is_not_an_error(tmp_path: Path) -> None:
    watch.write_events_tail(tmp_path)
    assert not (tmp_path / "events.tail").exists()


def test_said_log_emits_one_said_per_complete_line_and_relay_reads_it(tmp_path: Path) -> None:
    """S26-FX2: a partial last line waits for the next pass; a replaced (shorter) file is read from
    its start; relay is set 10 min after a SAID with no push or status after it."""
    start = datetime(2026, 10, 13, 1, 0, tzinfo=UTC)
    state: dict[str, Any] = {"alarms": {}, "tickets": {}}
    said = tmp_path / "said.log"
    said.write_text("2026-10-13T01:00:00Z t1 session_a\n2026-10-13T01:00:30Z t2 sess")
    step = watch.Pass(tmp_path, start, state)
    watch.watch_said(step)
    assert step.events == [("SAID", "t1", "sent")]
    said.write_text(said.read_text() + "ion_b\n")
    step = watch.Pass(tmp_path, start, state)
    watch.watch_said(step)
    assert step.events == [("SAID", "t2", "sent")]
    said.write_text("2026-10-13T01:01:00Z t1 session_c\n")  # replaced by a shorter file
    step = watch.Pass(tmp_path, start, state)
    watch.watch_said(step)
    assert step.events == [("SAID", "t1", "sent")]
    seen: dict[str, Any] = {"last_push_at": "2026-10-13T01:00:30Z"}
    late = watch.Pass(tmp_path, start + timedelta(minutes=12), state)
    assert watch.relay(late, "t1", seen) is True
    early = watch.Pass(tmp_path, start + timedelta(minutes=10), state)
    assert watch.relay(early, "t1", seen) is False
    assert watch.relay(late, "t3", seen) is False
    assert watch.relay(late, "t1", {"last_push_at": "not a time"}) is True
    watch.Pass(tmp_path, start + timedelta(minutes=5), state).event("STATUS", "t1", "on it")
    assert watch.relay(late, "t1", seen) is False, "a STATUS after the SAID answers it"
    said.write_text(said.read_text() + "2026-10-13T00:50:00Z t2 x\x0b2026-10-13T00:51:00Z t9 y\n")
    step = watch.Pass(tmp_path, start, state)
    watch.watch_said(step)
    assert step.events == [("SAID", "t2", "sent")], "one line, one SAID; only a newline ends a line"
    assert state["said"]["t2"] == "2026-10-13T01:00:30Z", "an older SAID does not replace the newest"


def test_the_status_contract_reads_rounds_up_to_the_ledger_s_last_round() -> None:
    schema = Path(__file__).resolve().parents[3] / "docs/specs/factory/contracts/status.schema.json"
    text = schema.read_text()
    found = re.search(r'"round": \{"type": "integer", "minimum": 1, "maximum": (\d+)\}', text)
    assert found is not None
    assert int(found[1]) == ledger_module.LAST_ROUND


def test_the_watcher_s_last_round_is_the_ledger_s() -> None:
    assert watch.LAST_ROUND == ledger_module.LAST_ROUND


def test_no_session_follows_an_old_launch_only_with_an_open_pr(tmp_path: Path) -> None:
    """S27-W835: with no session, `live_since` drops a PR-less launch older than it, keeps a recent one
    and an old one whose branch's PR is open; with a session `live_since` changes nothing."""
    launches = tmp_path / "launches"
    launches.mkdir()
    base = {"where": "cloud", "role": "builder", "session_id": "s", "review": None}
    for ticket, started in (
        ("old", "2026-09-20T10:00:00Z"),
        ("pr", "2026-09-20T10:00:00Z"),
        ("new", "2026-10-04T20:00:00Z"),
    ):
        record = {**base, "ticket": ticket, "branch": f"{ticket}-b", "started_at": started}
        (launches / f"{ticket}-{started[:4]}.json").write_text(json.dumps(record))
    prs = [{"number": 1, "headRefName": "pr-b", "state": "OPEN", "headRefOid": None}]
    live = datetime(2026, 10, 3, 20, 0, tzinfo=UTC)
    got, _ = watch.load_launches(tmp_path, None, prs, live_since=live)
    assert set(got) == {"pr", "new"}
    every, _ = watch.load_launches(tmp_path, None, prs)
    assert set(every) == {"old", "pr", "new"}
