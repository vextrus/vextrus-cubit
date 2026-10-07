"""S17-F4: `scripts/factory/measures.py` computes the session's measures from the existing logs.

The seam (named here; the builder makes it):

    measures.compute(*, started_utc, ended_utc, prs, ledger, lock_spans, verify_spans, ci_runs)
        -> {"prs_merged", "merge_p50_min", "rounds_per_pr", "rdlock_min",
            "verify_p50_min", "verify_p90_min", "ci_wall_p50_min", ...}

- `started_utc`, `ended_utc`: the session's window (`session.json`'s `started_utc`, the end's clock).
- `prs`: rows of `gh pr list --json number,headRefName,state,createdAt,mergedAt` (gh's own fields).
- `ledger`: review ledger records (`docs/specs/factory/contracts/ledger-record.schema.json`).
- `lock_spans`: `(start_utc, end_utc)` of each real-drawing lock hold (a run under `rdlock`).
- `verify_spans`: `(start_utc, end_utc)` of each verify run.
- `ci_runs`: rows of `gh run list --json databaseId,workflowName,headSha,event,status,conclusion,
  createdAt,startedAt,updatedAt` (gh's own fields).

Every source holds one record from before the session; none of them counts. The data is chosen so that
any usual percentile rule (nearest rank, inclusive or exclusive interpolation) gives the same value, and
every merged PR of the session was reviewed, so rounds per merged PR and per reviewed PR agree.
"""

from __future__ import annotations

import importlib
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

measures: Any = importlib.import_module("scripts.factory.measures")

STARTED = "2026-10-08T06:00:00Z"
ENDED = "2026-10-08T18:00:00Z"
BEFORE = "2026-10-07T"


def at(text: str, plus_minutes: float = 0) -> str:
    moment = datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    return (moment + timedelta(minutes=plus_minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def pr(number: int, created: str, minutes_to_merge: int) -> dict[str, Any]:
    return {
        "number": number,
        "headRefName": f"s17-t{number}",
        "state": "MERGED",
        "createdAt": created,
        "mergedAt": at(created, minutes_to_merge),
    }


def ledger_record(number: int, round_: int, verdict: str, recorded: str) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "pr": number,
        "head": f"{number:02d}{round_}".ljust(40, "a"),
        "round": round_,
        "verdict": verdict,
        "counts": {
            "reviewers": 2,
            "findings": 0 if verdict == "PASS" else 1,
            "findings_ge_50": 0 if verdict == "PASS" else 1,
            "confirmed": 0,
            "refuted": 0,
            "unproven": 0,
            "unrefuted_ge_50": 0 if verdict == "PASS" else 1,
        },
        "decision_input_sha256": "0" * 64,
        "comment_id": number * 100 + round_,
        "exception": {"kind": "crash", "reason": "a crash on confirm"} if round_ == 3 else None,
        "source": "review-pr",
        "recorded_at": recorded,
    }


def ci_run(run_id: int, created: str, minutes: int) -> dict[str, Any]:
    return {
        "databaseId": run_id,
        "workflowName": "ci",
        "headSha": f"{run_id:x}".ljust(40, "b"),
        "event": "pull_request",
        "status": "completed",
        "conclusion": "success",
        "createdAt": created,
        "startedAt": created,
        "updatedAt": at(created, minutes),
    }


# Merged in the session: 30, 60 and 90 minutes from open to merge. PR 9 merged the day before.
PRS = [
    pr(9, BEFORE + "10:00:00Z", 5),
    pr(11, "2026-10-08T07:00:00Z", 30),
    pr(12, "2026-10-08T08:00:00Z", 60),
    pr(13, "2026-10-08T10:00:00Z", 90),
]
# Rounds: PR 11 one, PR 12 two, PR 13 three (its round 3 under an exception). PR 9's round, before.
LEDGER = [
    ledger_record(9, 1, "PASS", BEFORE + "10:03:00Z"),
    ledger_record(11, 1, "PASS", "2026-10-08T07:20:00Z"),
    ledger_record(12, 1, "FIX", "2026-10-08T08:20:00Z"),
    ledger_record(12, 2, "PASS", "2026-10-08T08:50:00Z"),
    ledger_record(13, 1, "FIX", "2026-10-08T10:20:00Z"),
    ledger_record(13, 2, "FIX", "2026-10-08T10:50:00Z"),
    ledger_record(13, 3, "PASS", "2026-10-08T11:10:00Z"),
]
# The lock held 25 and 40 minutes in the session; 30 minutes the evening before.
LOCK_SPANS = [
    (BEFORE + "20:00:00Z", BEFORE + "20:30:00Z"),
    ("2026-10-08T06:30:00Z", "2026-10-08T06:55:00Z"),
    ("2026-10-08T12:00:00Z", "2026-10-08T12:40:00Z"),
]
# Ten verify runs in the session (minutes); one of 100 minutes the day before.
VERIFY_MINUTES = [4, 5, 6, 7, 8, 8, 9, 10, 30, 30]
VERIFY_SPANS = [(BEFORE + "09:00:00Z", at(BEFORE + "09:00:00Z", 100))] + [
    (at("2026-10-08T07:00:00Z", 45 * i), at("2026-10-08T07:00:00Z", 45 * i + minutes))
    for i, minutes in enumerate(VERIFY_MINUTES)
]
# CI runs of 12, 16 and 20 minutes in the session; one of 2 minutes the day before.
CI_RUNS = [
    ci_run(100, BEFORE + "09:00:00Z", 2),
    ci_run(101, "2026-10-08T07:05:00Z", 12),
    ci_run(102, "2026-10-08T08:05:00Z", 16),
    ci_run(103, "2026-10-08T10:05:00Z", 20),
]


@pytest.fixture(scope="module")
def values() -> dict[str, Any]:
    computed = measures.compute(
        started_utc=STARTED,
        ended_utc=ENDED,
        prs=PRS,
        ledger=LEDGER,
        lock_spans=LOCK_SPANS,
        verify_spans=VERIFY_SPANS,
        ci_runs=CI_RUNS,
    )
    return dict(computed)


def test_prs_merged_counts_only_the_merges_inside_the_session(values: dict[str, Any]) -> None:
    assert values["prs_merged"] == 3


def test_time_to_merge_p50_is_the_median_open_to_merge_minutes(values: dict[str, Any]) -> None:
    assert values["merge_p50_min"] == pytest.approx(60)


def test_review_rounds_per_pr_counts_each_merged_prs_rounds(values: dict[str, Any]) -> None:
    assert values["rounds_per_pr"] == pytest.approx(2)


def test_real_drawing_lock_minutes_sum_the_sessions_lock_holds(values: dict[str, Any]) -> None:
    assert values["rdlock_min"] == pytest.approx(65)


def test_verify_p50_is_the_median_verify_minutes(values: dict[str, Any]) -> None:
    assert values["verify_p50_min"] == pytest.approx(8)


def test_verify_p90_is_the_ninetieth_percentile_verify_minutes(values: dict[str, Any]) -> None:
    assert values["verify_p90_min"] == pytest.approx(30)


def test_ci_wall_p50_is_the_median_ci_run_minutes(values: dict[str, Any]) -> None:
    assert values["ci_wall_p50_min"] == pytest.approx(16)
