"""Ticket f4, tier 2: `scripts/land.py` lands a reviewed PR in order and reruns CI at most once, and only
when every failed test is a listed flake (docs/specs/factory.md 2.2 "Land").

Seams (fixed by the ticket): `scripts.land.land(pr, gh, *, ledger_dir, flaky, ready) -> int` with a `gh`
object (`head_sha`, `mark_ready`, `update_branch`, `wait_ci` -> failed test ids, `rerun_failed`, `merge`,
`pull_main`) and `ready(pr) -> int` standing for `merge_ready`; `scripts.land.order(prs) -> list[int]`.
"""

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

HEAD = "0123456789abcdef0123456789abcdef01234567"
PR = 12


class FakeGh:
    def __init__(self, ci: list[list[str]] | None = None) -> None:
        self.calls: list[str] = []
        self.ci = ci or [[]]

    def head_sha(self, pr: int) -> str:
        return HEAD

    def mark_ready(self, pr: int) -> None:
        self.calls.append("mark_ready")

    def update_branch(self, pr: int) -> None:
        self.calls.append("update_branch")

    def wait_ci(self, pr: int) -> list[str]:
        self.calls.append("wait_ci")
        return self.ci.pop(0) if len(self.ci) > 1 else self.ci[0]

    def rerun_failed(self, pr: int) -> None:
        self.calls.append("rerun_failed")

    def merge(self, pr: int) -> None:
        self.calls.append("merge")

    def pull_main(self) -> None:
        self.calls.append("pull_main")


@pytest.fixture
def commands(monkeypatch: pytest.MonkeyPatch) -> list[list[str]]:
    """Every subprocess `land` starts, recorded (and still run)."""
    started: list[list[str]] = []
    real = subprocess.Popen

    def recording(args: Any, *rest: Any, **options: Any) -> Any:
        started.append([str(part) for part in args] if isinstance(args, list | tuple) else [str(args)])
        return real(args, *rest, **options)

    def system(command: str) -> int:
        started.append([command])
        raise AssertionError("land runs no shell command")

    monkeypatch.setattr(subprocess, "Popen", recording)
    monkeypatch.setattr(os, "system", system)
    return started


def passed(store: Path, head: str = HEAD, verdict: str = "PASS") -> None:
    record = {
        "schema_version": 1,
        "pr": PR,
        "head": head,
        "round": 1,
        "verdict": verdict,
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
        "comment_id": 100,
        "exception": None,
        "source": "review-pr",
        "recorded_at": "2026-10-05T10:00:00Z",
    }
    (store / f"{PR}-{head}.json").write_text(json.dumps(record))


def run_land(gh: FakeGh, store: Path, *, flaky: set[str] | None = None, ready_code: int = 0) -> int:
    from scripts.land import land

    def ready(pr: int) -> int:
        gh.calls.append("ready")
        return ready_code

    return land(PR, gh, ledger_dir=store, flaky=flaky or set(), ready=ready)


@pytest.fixture
def store(tmp_path: Path) -> Path:
    path = tmp_path / "ledger"
    path.mkdir()
    return path


@pytest.mark.parametrize("verdict", [None, "FIX"])
def test_no_ledger_pass_for_the_head_lands_nothing(store: Path, verdict: str | None) -> None:
    if verdict:
        passed(store, verdict=verdict)
    passed(store, head="f" * 40)
    gh = FakeGh()
    assert run_land(gh, store) == 3
    assert "mark_ready" not in gh.calls
    assert "merge" not in gh.calls


def test_a_reviewed_green_pr_lands_in_order_with_no_privilege(
    store: Path, commands: list[list[str]]
) -> None:
    passed(store)
    gh = FakeGh()
    assert run_land(gh, store) == 0
    # S17-F7 (the owner's ruling, 7 Oct 2026): the head lands as it stands; only `land update` updates.
    assert "update_branch" not in gh.calls, "the lander brought main in before landing"
    assert gh.calls == ["mark_ready", "wait_ci", "ready", "merge", "pull_main"]
    assert not any(argv and argv[0].split()[0].endswith("sudo") for argv in commands)


def test_listed_flakes_get_one_rerun_then_it_lands(store: Path) -> None:
    passed(store)
    gh = FakeGh(ci=[["web/src/a.test.tsx :: shows it"], []])
    assert run_land(gh, store, flaky={"web/src/a.test.tsx :: shows it"}) == 0
    assert gh.calls.count("rerun_failed") == 1
    assert gh.calls[-2:] == ["merge", "pull_main"]


def test_a_failure_not_listed_is_never_rerun(store: Path) -> None:
    passed(store)
    gh = FakeGh(ci=[["web/src/a.test.tsx :: shows it", "scripts/tests/test_b.py :: test_b"], []])
    assert run_land(gh, store, flaky={"web/src/a.test.tsx :: shows it"}) == 3
    assert "rerun_failed" not in gh.calls
    assert "merge" not in gh.calls


def test_red_again_after_the_one_rerun_lands_nothing(store: Path) -> None:
    passed(store)
    gh = FakeGh(ci=[["web/src/a.test.tsx :: shows it"]])
    assert run_land(gh, store, flaky={"web/src/a.test.tsx :: shows it"}) == 3
    assert gh.calls.count("rerun_failed") == 1
    assert "merge" not in gh.calls


def test_merge_ready_refusing_lands_nothing(store: Path) -> None:
    passed(store)
    gh = FakeGh()
    assert run_land(gh, store, ready_code=1) != 0
    assert "merge" not in gh.calls


def test_engine_prs_with_a_pass_land_first_then_the_rest_by_number() -> None:
    from scripts.land import order

    prs = [
        {"number": 3, "engine": False, "pass": True},
        {"number": 5, "engine": True, "pass": True},
        {"number": 4, "engine": True, "pass": False},
    ]
    assert order(prs) == [5, 3]
