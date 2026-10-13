"""Ticket S26-FX1, item 5 (the owner's Q-R6): a builder answers a status message with an empty
`Factory-Status:` commit, and that commit on a READY head keeps it READY for CI's gate
(`scripts.factory.ci_gate.is_ready`) and for `scripts.merge_ready`'s READY reading (its (e), which
`merge_ready.main` wires to `ci_gate.is_ready`). A `Factory-Status:` commit that changes a file, or that
forges a READY on a commit changing a file, does not keep READY; nor does a status commit lift a head
that was not READY. Here because ci_gate is the factory's; merge_ready's reading is the same gate.

A tiny repository per test (as `scripts/factory/tests/test_ci_gate.py`), every commit with
`--cleanup=verbatim` so the message is kept as written.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts import merge_ready
from scripts.factory import ci_gate

ATTRIBUTION = (
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
    "Claude-Session: https://claude.ai/code/session_01Example\n"
)
NOT_READY = "is not Factory-State: READY"


def _git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        [
            "git",
            *("-c", "user.name=T", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false"),
            *("-C", str(repo), *args),
        ],
        capture_output=True,
        text=True,
        check=True,
        env={"PATH": "/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM": "1", "HOME": str(repo)},
    )
    return done.stdout.strip()


def _commit(repo: Path, message: str, *, change: str | None = None) -> str:
    """A commit with `message`, adding the file `change` (none: an empty commit, its parent's tree)."""
    if change is not None:
        (repo / change).write_text(change)
        _git(repo, "add", change)
    _git(repo, "commit", "-q", "--allow-empty", "--cleanup=verbatim", "-m", message)
    return _git(repo, "rev-parse", "HEAD")


def _ready(repo: Path, name: str) -> str:
    (repo / name).write_text(name)
    _git(repo, "add", name)
    tree = _git(repo, "write-tree")
    return _commit(repo, f"{name}\n\nFactory-State: READY\nFactory-Verify: {tree} ok\n")


def status_reply(line: str) -> str:
    return f"status: answer\n\nFactory-Status: {line}\n\n{ATTRIBUTION}"


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    _git(tmp_path, "init", "-q", "-b", "main")
    _commit(tmp_path, "base\n", change="base")
    _git(tmp_path, "switch", "-q", "-c", "feature")
    monkeypatch.chdir(tmp_path)
    return tmp_path


def test_an_empty_status_commit_on_a_ready_head_is_ready(repo: Path) -> None:
    assert ci_gate.is_ready(_ready(repo, "work")) is True
    head = _commit(repo, status_reply("waiting on web timeouts"))
    assert ci_gate.is_ready(head) is True, (
        "FX1 ci_gate: a Factory-Status-only commit on READY is not READY"
    )


def test_two_status_replies_on_a_ready_head_are_ready(repo: Path) -> None:
    _ready(repo, "work")
    _commit(repo, status_reply("waiting on web timeouts"))
    head = _commit(repo, status_reply("verify running"))
    assert ci_gate.is_ready(head) is True, "FX1 ci_gate: two status replies on READY are not READY"


def test_a_status_commit_that_changes_a_file_is_not_ready(repo: Path) -> None:
    _ready(repo, "work")
    head = _commit(repo, status_reply("small fix"), change="fix.py")
    assert ci_gate.is_ready(head) is False


def test_a_forged_ready_on_a_status_commit_that_changes_a_file_is_not_ready(repo: Path) -> None:
    ready_head = _ready(repo, "work")
    parent_tree = _git(repo, "rev-parse", f"{ready_head}^{{tree}}")
    forged = (
        "status: answer\n\nFactory-Status: done\nFactory-State: READY\n"
        f"Factory-Verify: {parent_tree} ok\n"
    )
    head = _commit(repo, forged, change="fix.py")
    assert ci_gate.is_ready(head) is False


def test_a_status_commit_on_a_head_that_is_not_ready_is_not_ready(repo: Path) -> None:
    _commit(repo, "wip\n", change="work")
    head = _commit(repo, status_reply("waiting on web timeouts"))
    assert ci_gate.is_ready(head) is False


# merge_ready's (e): the same reading, through `main` as it runs on a real head
def merge_ready_lines(head: str, tmp: Path, capsys: pytest.CaptureFixture[str]) -> list[str]:
    pull: dict[str, Any] = {
        "state": "OPEN",
        "headRefOid": head,
        "commits": {
            "nodes": [
                {
                    "commit": {
                        "oid": head,
                        "status": {"contexts": []},
                        "checkSuites": {"nodes": [{"checkRuns": {"nodes": []}}]},
                    }
                }
            ]
        },
    }
    facts: dict[str, Any] = {
        "pr": 7,
        "head": head,
        "base": "f" * 40,
        "title": "t",
        "body": "Not verified: nothing.\n",
        "branch": "feature",
        "comments": [],
        "files": ["scripts/fix.py"],
        "diff": "+x\n",
        "messages": ["m"],
    }
    merge_ready.main(
        ["7"],
        get=lambda pr: pull,
        facts=lambda pr: facts,
        ledger_dir=tmp / "ledger",
        repo=tmp,
        scan=lambda kind, text: 0,
        issue_open=lambda number: True,
        head_ready=ci_gate.is_ready,
    )
    return capsys.readouterr().out.splitlines()


def test_merge_ready_reads_a_status_commit_on_a_ready_head_as_ready(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _ready(repo, "work")
    head = _commit(repo, status_reply("waiting on web timeouts"))
    refused = [line for line in merge_ready_lines(head, repo, capsys) if NOT_READY in line]
    assert refused == [], f"FX1 merge_ready: a status commit on READY refused: {refused}"


def test_merge_ready_refuses_a_status_commit_that_changes_a_file(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _ready(repo, "work")
    head = _commit(repo, status_reply("small fix"), change="fix.py")
    refused = [line for line in merge_ready_lines(head, repo, capsys) if NOT_READY in line]
    assert len(refused) == 1, refused
