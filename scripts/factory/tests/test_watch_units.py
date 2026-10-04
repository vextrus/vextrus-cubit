"""Unit tests of the watcher's trailer parser, its views of the run folder and its command lines."""

from __future__ import annotations

import json
import os
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
