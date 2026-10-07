"""f5 acceptance: `scripts/walk/verdict.py`, the G1 judgement (docs/specs/factory.md 5 "G1").

"Verdict: `.private/work/walks/<sha40>/verdict.json` is PASS only if every scripted check passes and the
agent layer has no BLOCKS or misleading finding." "A check with no expectation is UNSET, and UNSET fails
PASS." The verdict is exactly the contract's object (walk-verdict.schema.json); every verdict built here
is checked against it, with its invariant len(findings) = issues_drafted + dedup_comments.

The seam for the agent layer (the ticket leaves its shape open; decided here): `findings` is either
None (the agent layer did not run) or the agent layer's record `{"items": [{"item", "status"}],
"findings": [<contract findings>]}`, the same object `findings.json` holds.

All numbers are synthetic; no limit or count from a real set.
"""

import copy
import importlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import pytest
from _f5_contract import (  # type: ignore[import-not-found, unused-ignore]
    ROOT,
    SAME_TITLE,
    WALKED_ITEMS,
    assert_valid_verdict,
    g1_entry,
    g1_expect,
    g1_question,
    g1_snapshot,
    g1_walk,
)

SHA = "0123456789abcdef0123456789abcdef01234567"
SHA_FAIL = "fedcba9876543210fedcba9876543210fedcba98"
TIMES = {"started_at": "2026-10-05T01:00:00Z", "finished_at": "2026-10-05T02:00:00Z"}


def _walk(entry: dict[str, Any] | None = None) -> dict[str, Any]:
    """A walk.json within every limit of `_expect()`: two files read, fast acts during a read, its
    burden counted from the snapshot `entry` (T-WALK-4: G1 measures the snapshot before any act)."""
    record: dict[str, Any] = g1_walk(SHA, TIMES["started_at"], entry)
    return record


def _expect() -> dict[str, Any]:
    return {"set-a": g1_expect()}


def _finding(n: int, **extra: Any) -> dict[str, Any]:
    from scripts.walk.sanitize import DEFECT_CLASSES, SCREENS

    return {
        "id": f"f-{n}",
        "item": "M0-FL3",
        "defect_class": sorted(DEFECT_CLASSES)[0],
        "screen": sorted(SCREENS)[0],
        "delta": 1.5,
        "severity": "OTHER",
        "misleading": False,
        "issue": 100 + n,
        "dedup_comment_on": None,
        **extra,
    }


def _layer(findings: list[dict[str, Any]], status: dict[str, str] | None = None) -> dict[str, Any]:
    status = status or {}
    return {
        "items": [{"item": item, "status": status.get(item, "PASS")} for item in WALKED_ITEMS],
        "findings": findings,
    }


def _evaluate(
    walk: dict[str, Any] | None = None,
    expect: dict[str, Any] | None = None,
    layer: dict[str, Any] | str | None = "default",
    entry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """`measures.attach` on the walk and its snapshot (`entry`), then `evaluate` (T-WALK-4's seam)."""
    from scripts.walk.verdict import evaluate

    attach = importlib.import_module("scripts.walk.measures").attach  # absent before T-WALK-4

    walk = _walk(entry) if walk is None else walk
    expect = _expect() if expect is None else expect
    with tempfile.TemporaryDirectory() as folder:
        snapshot = g1_snapshot(walk["sha"], walk["started_at"], entry)
        (Path(folder) / "snapshot.json").write_text(json.dumps(snapshot))
        walk = attach(walk, Path(folder), expect)
    verdict: dict[str, Any] = evaluate(
        walk,
        expect,
        _layer([]) if layer == "default" else layer,
        ref="main",
        leak_hits=0,
        **TIMES,
    )
    assert_valid_verdict(verdict)
    return verdict


def _check(verdict: dict[str, Any], check: str, set_: str = "set-a") -> dict[str, Any]:
    found = [c for c in verdict["checks"] if c["check"] == check and c["set"] == set_]
    assert len(found) == 1, verdict["checks"]
    check_: dict[str, Any] = found[0]
    return check_


def test_every_check_within_its_limit_and_no_finding_is_pass() -> None:
    verdict = _evaluate()

    assert verdict["result"] == "PASS"
    assert verdict["sha"] == SHA
    assert verdict["ref"] == "main"
    assert verdict["started_at"] == TIMES["started_at"]
    assert verdict["finished_at"] == TIMES["finished_at"]
    assert verdict["leak_scan"] == {"hits": 0}
    reads = _check(verdict, "reads_complete")
    assert reads["measured"] == {"files": 2, "completed": 2}
    assert reads["expected"] == {"files": 2}
    acts = _check(verdict, "act_p95_during_read")
    assert {"p95_ms", "max_ms", "samples"} <= set(acts["measured"])
    assert acts["measured"]["samples"] == 20
    # T-WALK-4: a worst act and a sample minimum per kind beside the p95.
    assert acts["expected"] == {"p95_ms_max": 1000, "max_ms_max": 3000, "samples_each_min": 5}
    questions = _check(verdict, "questions_per_discipline")
    # T-WALK-4: machine doubt only (the listed true Question falls outside the cap).
    assert questions["measured"] == {"questions_max_per_discipline": 2, "disciplines": 2}
    assert questions["expected"]["questions_max_per_discipline"] == 3
    rows = {row["discipline"]: row for row in verdict["burden"]}
    assert rows["structural"] == {
        "set": "set-a",
        "discipline": "structural",
        "questions_by_kind": {"conflict": 1, "low_confidence": 2},
        "questions_total": 3,
        "sheets": 10,
        "sheets_expected": 10,
        "bulk_confirmable_sheets": 9,
        "one_source_sheets": 1,
        "machine_doubt_questions": 2,
        "continuation_questions": 1,
        "false_continuation_questions": 0,
    }


def test_slow_acts_while_a_read_runs_fail_act_p95() -> None:
    walk = _walk()
    walk["sets"]["set-a"]["acts"] = [
        {"kind": kind, "ms": 2400, "read_running": True}
        for kind in ["confirm", "answer", "exclude", "undo"] * 5
    ]

    verdict = _evaluate(walk)

    acts = _check(verdict, "act_p95_during_read")
    assert acts["status"] == "FAIL"
    assert (acts["measured"]["p95_ms"], acts["measured"]["samples"]) == (2400, 20)
    assert verdict["result"] == "FAIL"


def test_only_acts_during_a_read_count_toward_p95() -> None:
    walk = _walk()
    walk["sets"]["set-a"]["acts"] = [
        *({"kind": "undo", "ms": 5000, "read_running": False} for _ in range(10)),
        *(
            {"kind": kind, "ms": 100, "read_running": True}
            for kind in ["confirm", "answer", "exclude", "undo"] * 5
        ),
    ]

    verdict = _evaluate(walk)

    acts = _check(verdict, "act_p95_during_read")
    assert acts["status"] == "PASS"
    assert (acts["measured"]["p95_ms"], acts["measured"]["samples"]) == (100, 20)
    assert verdict["result"] == "PASS"


def test_no_act_during_a_read_fails_act_p95() -> None:
    walk = _walk()
    for act in walk["sets"]["set-a"]["acts"]:
        act["read_running"] = False

    verdict = _evaluate(walk)

    assert _check(verdict, "act_p95_during_read")["status"] == "FAIL"
    assert verdict["result"] == "FAIL"


def test_too_many_questions_in_a_discipline_fail_questions_per_discipline() -> None:
    entry = g1_entry(doubt=9)  # T-WALK-4: Questions are counted from the snapshot

    verdict = _evaluate(entry=entry)

    questions = _check(verdict, "questions_per_discipline")
    assert questions["status"] == "FAIL"
    assert questions["measured"]["questions_max_per_discipline"] == 9
    assert verdict["result"] == "FAIL"


@pytest.mark.parametrize(
    ("change", "check"),
    [("bulk", "bulk_confirmable_share"), ("false", "false_continuations")],
    ids=["bulk-confirmable-share-below-min", "false-continuations-above-max"],
)
def test_the_burden_limits_fail_their_own_checks(change: str, check: str) -> None:
    # T-WALK-4: the bulk share and the false continuations left questions_per_discipline.
    entry = g1_entry(agreeing=5) if change == "bulk" else g1_entry()
    if change == "false":
        entry["questions"].append(g1_question("f1", "conflict", SAME_TITLE, "structural", "s7", "s8"))

    verdict = _evaluate(entry=entry)

    assert _check(verdict, check)["status"] == "FAIL"
    assert _check(verdict, "questions_per_discipline")["status"] == "PASS"
    assert verdict["result"] == "FAIL"


@pytest.mark.parametrize(
    ("missing", "check"),
    [("p95_ms_max", "act_p95_during_read"), ("files", "reads_complete")],
)
def test_a_missing_expectation_key_is_unset_and_fails(missing: str, check: str) -> None:
    expect = _expect()
    del expect["set-a"][missing]

    verdict = _evaluate(expect=expect)

    unset = _check(verdict, check)
    assert unset["status"] == "UNSET"
    assert unset["expected"] is None
    assert verdict["result"] == "FAIL"


def test_a_set_with_no_expectation_is_unset_and_fails() -> None:
    verdict = _evaluate(expect={})

    from scripts.walk.sanitize import CHECK_IDS

    for check in CHECK_IDS:
        unset = _check(verdict, check)
        assert unset["status"] == "UNSET"
        assert unset["expected"] is None
    assert verdict["result"] == "FAIL"


@pytest.mark.parametrize("case", ["a-file-failed", "file-count-mismatch"])
def test_an_unfinished_read_fails_reads_complete(case: str) -> None:
    walk = _walk()
    expect = _expect()
    if case == "a-file-failed":
        walk["sets"]["set-a"]["files"][1]["state"] = "failed"
    else:
        expect["set-a"]["files"] = 3

    verdict = _evaluate(walk, expect)

    assert _check(verdict, "reads_complete")["status"] == "FAIL"
    assert verdict["result"] == "FAIL"


def test_a_blocks_finding_fails_the_walk() -> None:
    verdict = _evaluate(layer=_layer([_finding(1, severity="BLOCKS"), _finding(2)]))

    assert verdict["result"] == "FAIL"
    assert verdict["agent_layer"]["blocks"] == 1
    assert verdict["agent_layer"]["misleading"] == 0


def test_a_misleading_finding_fails_the_walk() -> None:
    verdict = _evaluate(layer=_layer([_finding(1, misleading=True)]))

    assert verdict["result"] == "FAIL"
    assert verdict["agent_layer"]["misleading"] == 1
    assert verdict["agent_layer"]["blocks"] == 0


def test_other_findings_that_do_not_mislead_still_pass() -> None:
    findings = [_finding(1), _finding(2, issue=None, dedup_comment_on=7)]

    verdict = _evaluate(layer=_layer(findings))

    assert verdict["result"] == "PASS"
    assert verdict["agent_layer"]["issues_drafted"] == 1
    assert verdict["agent_layer"]["dedup_comments"] == 1
    assert verdict["agent_layer"]["findings"] == findings


@pytest.mark.parametrize("status", ["NOT_WALKED", "FAIL"])
def test_an_item_not_walked_or_failed_fails_the_walk(status: str) -> None:
    verdict = _evaluate(layer=_layer([], {"M0-FL7": status}))

    assert verdict["result"] == "FAIL"
    assert {"item": "M0-FL7", "status": status} in verdict["agent_layer"]["items"]


def test_an_absent_agent_layer_fails_with_every_item_not_walked() -> None:
    verdict = _evaluate(layer=None)

    assert verdict["result"] == "FAIL"
    items = verdict["agent_layer"]["items"]
    assert sorted(i["item"] for i in items) == sorted(WALKED_ITEMS)
    assert {i["status"] for i in items} == {"NOT_WALKED"}


def test_a_finding_that_is_neither_issue_nor_comment_breaks_the_invariant() -> None:
    from scripts.walk.verdict import evaluate

    with pytest.raises(Exception):  # noqa: B017, PT011 (the ticket pins "a mismatch raises", not a type)
        evaluate(
            _walk(),
            _expect(),
            _layer([_finding(1, issue=None, dedup_comment_on=None)]),
            ref="main",
            leak_hits=0,
            **TIMES,
        )


def test_a_walk_with_leak_hits_is_not_judged() -> None:
    from scripts.walk.verdict import evaluate

    with pytest.raises(Exception):  # noqa: B017, PT011 (the ticket pins "raises", not a type)
        evaluate(_walk(), _expect(), _layer([]), ref="main", leak_hits=1, **TIMES)


def test_p95_is_nearest_rank() -> None:
    from scripts.walk.verdict import p95

    assert p95(list(range(1, 21))) == 19
    assert p95([7]) == 7
    assert p95([5, 1, 3]) == 5


def _run_cli(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "scripts.walk.verdict", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def _lay_out(walks: Path, sha: str, walk: dict[str, Any] | None) -> Path:
    folder = walks / sha
    folder.mkdir(parents=True)
    if walk is not None:
        (folder / "walk.json").write_text(json.dumps(walk))
        snapshot = g1_snapshot(walk["sha"], walk["started_at"])
        (folder / "snapshot.json").write_text(json.dumps(snapshot))
    (folder / "findings.json").write_text(json.dumps(_layer([_finding(1)])))
    return folder


def test_the_cli_writes_a_contract_verdict_and_a_sanitized_summary(tmp_path: Path) -> None:
    from scripts.walk.sanitize import sanitize_walk

    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    expect_dir.mkdir()
    (expect_dir / "set-a.json").write_text(json.dumps(_expect()["set-a"]))
    passing = _lay_out(walks, SHA, _walk())
    slow = copy.deepcopy(_walk())
    slow["sha"] = SHA_FAIL
    for act in slow["sets"]["set-a"]["acts"]:
        act["ms"] = 2400
    failing = _lay_out(walks, SHA_FAIL, slow)
    common = ["--ref", "main", "--walks-dir", str(walks), "--expect-dir", str(expect_dir)]

    ok = _run_cli(SHA, "--leak-hits", "0", *common)
    assert ok.returncode == 0, ok.stderr
    verdict = json.loads((passing / "verdict.json").read_text())
    assert_valid_verdict(verdict)
    assert verdict["result"] == "PASS"
    assert verdict["sha"] == SHA
    summary = json.loads((passing / "public" / "summary.json").read_text())
    assert sanitize_walk(summary) == summary

    bad = _run_cli(SHA_FAIL, "--leak-hits", "0", *common)
    assert bad.returncode == 1, bad.stderr
    failed = json.loads((failing / "verdict.json").read_text())
    assert_valid_verdict(failed)
    assert failed["result"] == "FAIL"


def test_the_cli_writes_nothing_on_leak_hits_or_a_missing_walk(tmp_path: Path) -> None:
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    expect_dir.mkdir()
    (expect_dir / "set-a.json").write_text(json.dumps(_expect()["set-a"]))
    leaked = _lay_out(walks, SHA, _walk())
    missing = _lay_out(walks, SHA_FAIL, None)
    common = ["--ref", "main", "--walks-dir", str(walks), "--expect-dir", str(expect_dir)]

    hits = _run_cli(SHA, "--leak-hits", "3", *common)
    assert hits.returncode == 2
    assert not (leaked / "verdict.json").exists()
    assert not (leaked / "public" / "summary.json").exists()

    absent = _run_cli(SHA_FAIL, "--leak-hits", "0", *common)
    assert absent.returncode == 2
    assert not (missing / "verdict.json").exists()
    assert not (missing / "public" / "summary.json").exists()
