"""S25-F5: `scripts/factory/measures.py` gains the measures session 24's diagnosis had to dig for.

The brief (docs/handoff/session-25-prompt.md, step 3's F5 and "The self-improving loop"): "`measures.py`
gains round-1 PASS by area, rounds per ticket (closed PRs included; `rounds_per_pr` counts merged PRs
only), minutes from READY to review start, the factory's share of builder hours, and the e2e pass streak
on main. These lead every brief from session 26 on."

The seam (named here; the builder makes it). `measures.compute` keeps its seven measures and gains
keyword arguments, each optional (S17-F4's callers pass none of them; a source not given is None and
leaves its measure "not measured"):

    measures.compute(*, started_utc, ended_utc, prs, ledger, lock_spans, verify_spans, ci_runs,
                     events, review_starts, builder_spans)

- `prs`: rows of `gh pr list --state all --json number,headRefName,state,createdAt,mergedAt,closedAt,
  files` (gh's own fields): MERGED, CLOSED (`mergedAt` null, `closedAt` set) and OPEN rows.
- `ci_runs`: S17-F4's rows plus gh's `headBranch` field.
- `events`: the lines of the watcher's `events.log`, `<UTC> <KIND> <ticket|-> <detail>`; a READY line's
  detail is the head's first eight characters (scripts/factory/watch.py).
- `review_starts`: one row per review run, `{"pr", "head" (sha40), "round", "started_at"}`. No file
  records a review's start today (the ledger's `recorded_at` and review-cost.jsonl's `at` are end
  times): the builder makes the record and its reader.
- `builder_spans`: `(branch, start_utc, end_utc)` of each builder's working time. No file records a
  builder's end today: the builder chooses the source.

The new measures, flat numbers so `compare` and `render` show them:

- `round1_pass_product`, `round1_pass_factory`, `round1_pass_docs`: the fraction (0 to 1) of the PRs of
  that area whose round-1 verdict was recorded in the window that PASSed in round 1 (merged, closed or
  open). A PR with no round-1 record is not counted. A PR's area comes from its paths; these tests pin
  only PRs whose every path is plainly one area: `vextrus/`, `web/src/`, `engine/` product,
  `scripts/factory/` factory, `docs/` docs.
- `rounds_per_ticket`: mean review rounds per ticket (a ticket is its branch, `headRefName`, so a closed
  PR and the fresh PR that replaced it on the same branch are one ticket), over the tickets with a PR
  merged or closed in the window that were reviewed.
- `ready_to_review_p50_min`: the median minutes from a READY event in the window to the first review
  start of that head (the review's sha40 starts with the event's eight characters).
- `factory_hours_share`: factory-area builder minutes over all builder minutes (0 to 1), a span counted
  when it starts in the window (rdlock_min's rule), its area that of its branch's PR.
- `e2e_main_streak`: consecutive successful `e2e` runs on main, newest first by `createdAt`, from every
  run gh gives (not only the window's); a run not yet completed neither counts nor breaks it; a run on
  another branch is not main's.

Higher is better for the three round-1 rates and the streak; lower for the share (Q17's cap: the factory
takes at most about 30 % of builder hours) and the rest.
"""

from __future__ import annotations

import importlib
import random
from typing import Any

import pytest

measures: Any = importlib.import_module("scripts.factory.measures")

STARTED = "2026-10-08T06:00:00Z"
ENDED = "2026-10-08T18:00:00Z"
BEFORE = "2026-10-07T"
DAY = "2026-10-08T"
NEW_KEYS = (
    "round1_pass_product",
    "round1_pass_factory",
    "round1_pass_docs",
    "rounds_per_ticket",
    "ready_to_review_p50_min",
    "factory_hours_share",
    "e2e_main_streak",
)


def pr(
    number: int, branch: str, state: str, created: str, ended: str, paths: list[str]
) -> dict[str, Any]:
    return {
        "number": number,
        "headRefName": branch,
        "state": state,
        "createdAt": created,
        "mergedAt": ended if state == "MERGED" else None,
        "closedAt": ended,
        "files": [{"path": path, "additions": 3, "deletions": 1} for path in paths],
    }


def head(number: int, letter: str) -> str:
    return f"{number}{letter * 6}".ljust(40, "0")


def ledger_record(number: int, round_: int, verdict: str, recorded: str, sha: str) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "pr": number,
        "head": sha,
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
        "exception": None,
        "source": "review-pr",
        "recorded_at": recorded,
    }


PRODUCT = ["vextrus/takeoff/api.py", "web/src/routes/takeoff/Step1Screen.tsx"]
# PR 9 is the day before. s25-a1 is one ticket in two PRs: 21 closed after two FIX rounds, 22 its fresh
# PR, merged after one. PR 27 merged unreviewed.
PRS = [
    pr(9, "s24-old", "MERGED", BEFORE + "08:00:00Z", BEFORE + "09:00:00Z", PRODUCT),
    pr(21, "s25-a1", "CLOSED", DAY + "06:40:00Z", DAY + "09:00:00Z", PRODUCT),
    pr(22, "s25-a1", "MERGED", DAY + "09:05:00Z", DAY + "11:00:00Z", ["vextrus/takeoff/api.py"]),
    pr(23, "s25-b1", "MERGED", DAY + "07:30:00Z", DAY + "10:00:00Z", ["engine/storeys/read.py"]),
    pr(
        24,
        "s25-f1",
        "MERGED",
        DAY + "09:30:00Z",
        DAY + "12:00:00Z",
        ["scripts/factory/review.py", "scripts/factory/tests/test_review.py"],
    ),
    pr(25, "s25-f2", "MERGED", DAY + "09:40:00Z", DAY + "12:30:00Z", ["scripts/factory/measures.py"]),
    pr(26, "s25-d1", "MERGED", DAY + "10:30:00Z", DAY + "13:00:00Z", ["docs/plans/M1.md"]),
    pr(27, "s25-d2", "MERGED", DAY + "11:30:00Z", DAY + "13:30:00Z", ["docs/research/e2e-streak.md"]),
]
LEDGER = [
    ledger_record(9, 1, "FIX", BEFORE + "08:30:00Z", head(9, "f")),
    ledger_record(21, 1, "FIX", DAY + "07:15:00Z", head(21, "a")),
    ledger_record(21, 2, "FIX", DAY + "08:15:00Z", head(21, "b")),
    ledger_record(22, 1, "PASS", DAY + "09:40:00Z", head(22, "a")),
    ledger_record(23, 1, "PASS", DAY + "08:40:00Z", head(23, "b")),
    ledger_record(24, 1, "FIX", DAY + "10:40:00Z", head(24, "c")),
    ledger_record(24, 2, "PASS", DAY + "11:30:00Z", head(24, "d")),
    ledger_record(25, 1, "PASS", DAY + "11:00:00Z", head(25, "a")),
    ledger_record(26, 1, "PASS", DAY + "11:45:00Z", head(26, "a")),
]
# READY to the first review of that head: 21aaaaaa 10 min, 23bbbbbb 30 min, 24cccccc 20 min. A rerun of
# 21aaaaaa's review, a review of a head never seen READY, a READY not yet reviewed, a READY-WAITING
# alarm whose detail says READY and a READY the day before are not pairs.
EVENTS = [
    f"{BEFORE}10:00:00Z READY S24-OLD 9ffffff0",
    f"{DAY}06:50:00Z PUSH S25-A1 21aaaaaa",
    f"{DAY}07:00:00Z READY S25-A1 21aaaaaa",
    f"{DAY}08:00:00Z READY S25-B1 23bbbbbb",
    f"{DAY}08:10:00Z READY-WAITING S25-B1 23bbbbbb READY 10 min, not merged",
    f"{DAY}10:00:00Z READY S25-F1 24cccccc",
    f"{DAY}12:00:00Z READY S25-D2 27eeeeee",
]
REVIEW_STARTS = [
    {"pr": 9, "head": head(9, "f"), "round": 1, "started_at": BEFORE + "10:05:00Z"},
    {"pr": 21, "head": head(21, "a"), "round": 1, "started_at": DAY + "07:10:00Z"},
    {"pr": 21, "head": head(21, "a"), "round": 1, "started_at": DAY + "07:50:00Z"},
    {"pr": 23, "head": head(23, "b"), "round": 1, "started_at": DAY + "08:30:00Z"},
    {"pr": 24, "head": head(24, "c"), "round": 1, "started_at": DAY + "10:20:00Z"},
    {"pr": 24, "head": head(24, "d"), "round": 2, "started_at": DAY + "11:00:00Z"},
]
# Builder minutes in the session: product 180 + 120, factory 120 + 60, docs 60; the day before, 720.
BUILDER_SPANS = [
    ("s24-old", BEFORE + "06:00:00Z", BEFORE + "18:00:00Z"),
    ("s25-a1", DAY + "06:30:00Z", DAY + "09:30:00Z"),
    ("s25-b1", DAY + "07:00:00Z", DAY + "09:00:00Z"),
    ("s25-f1", DAY + "08:00:00Z", DAY + "10:00:00Z"),
    ("s25-f2", DAY + "09:00:00Z", DAY + "10:00:00Z"),
    ("s25-d1", DAY + "10:00:00Z", DAY + "11:00:00Z"),
]


def run(
    run_id: int,
    workflow: str,
    branch: str,
    event: str,
    created: str,
    conclusion: str | None,
    minutes: int = 25,
) -> dict[str, Any]:
    finished = conclusion is not None
    hours, rest = divmod(int(created[11:13]) * 60 + int(created[14:16]) + minutes, 60)
    return {
        "databaseId": run_id,
        "workflowName": workflow,
        "headBranch": branch,
        "headSha": f"{run_id:x}".ljust(40, "e"),
        "event": event,
        "status": "completed" if finished else "in_progress",
        "conclusion": conclusion or "",
        "createdAt": created,
        "startedAt": created,
        "updatedAt": f"{created[:11]}{hours % 24:02d}:{rest:02d}:00Z" if finished else created,
    }


# e2e on main, oldest first: a failure, then six successes (the nightly the day before among them).
# Newest of all, a push still running. Between them a dispatch failing on a ticket's branch, and a
# required `ci` run on main (12 minutes: the session's one CI wall).
CI_RUNS = [
    run(500, "e2e", "main", "push", BEFORE + "06:00:00Z", "failure"),
    run(501, "e2e", "main", "schedule", BEFORE + "21:17:00Z", "success"),
    run(502, "e2e", "main", "push", DAY + "09:10:00Z", "success"),
    run(503, "e2e", "main", "push", DAY + "11:10:00Z", "success"),
    run(504, "e2e", "s25-f1", "workflow_dispatch", DAY + "11:40:00Z", "failure"),
    run(505, "e2e", "main", "push", DAY + "12:10:00Z", "success"),
    run(506, "e2e", "main", "push", DAY + "12:40:00Z", "success"),
    run(507, "e2e", "main", "push", DAY + "13:10:00Z", "success"),
    run(508, "ci", "main", "push", DAY + "13:10:00Z", "success", minutes=12),
    run(509, "e2e", "main", "push", DAY + "17:00:00Z", None),
]


def compute(**overrides: Any) -> dict[str, Any]:
    ci_runs = list(CI_RUNS)
    random.Random(25).shuffle(ci_runs)  # gh's order is never relied on: newest first is by createdAt
    given: dict[str, Any] = {
        "events": EVENTS,
        "review_starts": REVIEW_STARTS,
        "builder_spans": BUILDER_SPANS,
        "started_utc": STARTED,
        "ended_utc": ENDED,
        "prs": PRS,
        "ledger": LEDGER,
        "lock_spans": [],
        "verify_spans": [],
        "ci_runs": ci_runs,
    }
    given.update(overrides)
    return dict(measures.compute(**given))


@pytest.fixture(scope="module")
def values() -> dict[str, Any]:
    return compute()


def test_round_1_pass_of_product_prs_counts_closed_prs_and_leaves_the_day_before(
    values: dict[str, Any],
) -> None:
    # 21 FIX (closed), 22 PASS, 23 PASS; PR 9's FIX was the day before.
    assert values["round1_pass_product"] == pytest.approx(2 / 3)


def test_round_1_pass_of_factory_prs_is_their_own_rate(values: dict[str, Any]) -> None:
    # 24 FIX then PASS in round 2 (round 1 is what counts), 25 PASS.
    assert values["round1_pass_factory"] == pytest.approx(0.5)


def test_round_1_pass_of_docs_prs_leaves_out_an_unreviewed_pr(values: dict[str, Any]) -> None:
    # 26 PASS; 27 merged with no round-1 record.
    assert values["round1_pass_docs"] == pytest.approx(1.0)


def test_rounds_per_ticket_adds_a_closed_prs_rounds_to_its_branchs_fresh_pr(
    values: dict[str, Any],
) -> None:
    # s25-a1 2 + 1, s25-b1 1, s25-f1 2, s25-f2 1, s25-d1 1; s25-d2 unreviewed.
    assert values["rounds_per_ticket"] == pytest.approx(8 / 5)


def test_rounds_per_pr_still_counts_merged_prs_only(values: dict[str, Any]) -> None:
    # 22 1, 23 1, 24 2, 25 1, 26 1: the closed PR 21's two rounds are not among them.
    assert values["rounds_per_pr"] == pytest.approx(6 / 5)


def test_ready_to_review_is_the_median_minutes_to_the_first_review_of_that_head(
    values: dict[str, Any],
) -> None:
    # 10, 30 and 20 minutes; the rerun, the unpaired review and READY, the alarm and the day before
    # are not pairs.
    assert values["ready_to_review_p50_min"] == pytest.approx(20)


def test_the_factory_share_is_its_builder_minutes_over_all_builder_minutes(
    values: dict[str, Any],
) -> None:
    # factory 120 + 60 of 540 minutes started in the session; the day before's 720 left out.
    assert values["factory_hours_share"] == pytest.approx(180 / 540)


def test_the_e2e_streak_counts_main_successes_newest_first(values: dict[str, Any]) -> None:
    # Six successes on main back to the failure; the running push and the branch's failure do not
    # break it, and the nightly the day before still counts.
    assert values["e2e_main_streak"] == 6


def test_a_failed_newest_e2e_run_on_main_ends_the_streak_at_zero(values: dict[str, Any]) -> None:
    failed = run(510, "e2e", "main", "schedule", DAY + "17:30:00Z", "failure")
    assert values["e2e_main_streak"] == 6
    assert compute(ci_runs=[*CI_RUNS, failed])["e2e_main_streak"] == 0


def test_the_e2e_runs_leave_the_ci_wall_alone(values: dict[str, Any]) -> None:
    assert values["ci_wall_p50_min"] == pytest.approx(12)


def test_a_failed_gh_leaves_the_streak_and_the_pr_measures_unmeasured(values: dict[str, Any]) -> None:
    assert values["e2e_main_streak"] is not None
    unmeasured = compute(prs=None, ci_runs=None)
    for key in (
        "round1_pass_product",
        "round1_pass_factory",
        "round1_pass_docs",
        "rounds_per_ticket",
        "factory_hours_share",
        "e2e_main_streak",
    ):
        assert unmeasured[key] is None, key


def test_a_longer_e2e_streak_or_a_higher_pass_rate_is_never_a_regression(
    values: dict[str, Any],
) -> None:
    current = {key: values[key] for key in ("e2e_main_streak", "round1_pass_product")}
    previous = {"e2e_main_streak": 4, "round1_pass_product": 0.5}
    assert measures.compare(current, previous, {}) == []


def test_a_shorter_e2e_streak_or_a_lower_pass_rate_is_flagged_as_regressed(
    values: dict[str, Any],
) -> None:
    current = {key: values[key] for key in ("e2e_main_streak", "round1_pass_product")}
    previous = {"e2e_main_streak": 8, "round1_pass_product": 0.9}
    flags = measures.compare(current, previous, {})
    assert any(f.startswith("e2e_main_streak: regressed") for f in flags), flags
    assert any(f.startswith("round1_pass_product: regressed") for f in flags), flags


def test_the_e2e_streak_misses_its_target_only_below_it(values: dict[str, Any]) -> None:
    current = {"e2e_main_streak": values["e2e_main_streak"]}
    assert measures.compare(current, None, {"e2e_main_streak": 5}) == []
    flags = measures.compare(current, None, {"e2e_main_streak": 7})
    assert any(f.startswith("e2e_main_streak: missed target") for f in flags), flags


def test_a_factory_share_over_the_30_percent_cap_misses_its_target(values: dict[str, Any]) -> None:
    current = {"factory_hours_share": values["factory_hours_share"]}
    flags = measures.compare(current, None, {"factory_hours_share": 0.3})
    assert any(f.startswith("factory_hours_share: missed target") for f in flags), flags


def test_stamp_ends_table_shows_a_row_for_each_new_measure(values: dict[str, Any]) -> None:
    table = measures.render(values, None, {}, [])
    for key in NEW_KEYS:
        assert f"| {key} | " in table, key
    assert "| e2e_main_streak | 6 |" in table
