"""Unit tests of the watcher's trailer parser, its views of the run folder and its command lines."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

from scripts.factory import watch

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


def test_only_the_last_paragraph_counts() -> None:
    message = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {TREE} ok\n\nA closing line.\n"
    assert watch.parse_trailers(message, TREE).outcome is None
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


def test_trailers_before_an_attribution_only_paragraph_are_read() -> None:
    ready = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {TREE} ok\n\n{ATTRIBUTION}\n"
    assert watch.parse_trailers(ready, TREE).outcome == "READY"
    prose = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {TREE} ok\n\nA note.\n\n{ATTRIBUTION}\n"
    assert watch.parse_trailers(prose, TREE).outcome is None
    assert watch.parse_trailers(f"{ATTRIBUTION}\n", TREE).outcome is None
    mixed = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {TREE} ok\n\n{ATTRIBUTION}\nNote: y\n"
    assert watch.parse_trailers(mixed, TREE).outcome is None


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


def test_a_merge_of_main_takes_its_first_parents_outcome(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    git_in(tmp_path, "init", "-q", "-b", "main")
    git_in(tmp_path, "commit", "-q", "--allow-empty", "-m", "seed")
    seed = git_in(tmp_path, "rev-parse", "HEAD")
    tree = git_in(tmp_path, "rev-parse", "HEAD^{tree}")
    message = f"feat: x\n\nFactory-State: READY\nFactory-Verify: {tree} ok\n"
    ready = git_in(tmp_path, "commit-tree", tree, "-p", seed, "-m", message)
    main = git_in(tmp_path, "commit-tree", tree, "-p", seed, "-m", "main moves")
    side = git_in(tmp_path, "commit-tree", tree, "-p", seed, "-m", "a side branch")
    git_in(tmp_path, "update-ref", "refs/heads/main", main)
    merged = git_in(tmp_path, "commit-tree", tree, "-p", ready, "-p", main, "-m", "Merge main")
    not_main = git_in(tmp_path, "commit-tree", tree, "-p", ready, "-p", side, "-m", "Merge side")
    monkeypatch.chdir(tmp_path)
    outcome = watch.head_trailers(merged, "Merge main\n", tree, main).outcome
    assert outcome == "READY"
    assert watch.head_trailers(not_main, "Merge side\n", tree, main).outcome is None
