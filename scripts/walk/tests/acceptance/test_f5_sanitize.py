"""f5 acceptance: `scripts/walk/sanitize.py`, the only door from a walk to anything public.

Spec (docs/specs/factory.md 5, item 9): "The public summary comes only from `scripts/walk/sanitize.py`'s
allowlist: a verdict per finish-line item, numeric deltas, defect classes." 3.8: issues are drafted
"only from `sanitize.py`'s allowlisted fields (finish-line item, defect class, screen, numeric delta;
no free-text field)". Item codes follow the contract (walk-verdict.schema.json): M0-FL1..M0-FL11 and
M0-FL13.

Every planted string is invented (`_f5_contract.PLANTED`); none comes from a drawing.
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from _f5_contract import (  # type: ignore[import-not-found, unused-ignore]
    PLANTED_DISCIPLINE,
    PLANTED_FILE,
    PLANTED_NOTE,
    PLANTED_PATH,
    PLANTED_QUESTION,
    PLANTED_TITLE,
    ROOT,
    WALKED_ITEMS,
    has_planted,
)

SHA = "0123456789abcdef0123456789abcdef01234567"
DISCIPLINE_NAME = re.compile(r"^[a-z][a-z0-9_]{1,24}$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")


def _closed() -> tuple[str, str]:
    from scripts.walk.sanitize import DEFECT_CLASSES, SCREENS

    return sorted(DEFECT_CLASSES)[0], sorted(SCREENS)[0]


def _finding(**extra: Any) -> dict[str, Any]:
    defect_class, screen = _closed()
    return {
        "id": "f-1",
        "item": "M0-FL3",
        "defect_class": defect_class,
        "screen": screen,
        "delta": 2.0,
        "severity": "OTHER",
        "misleading": False,
        **extra,
    }


def test_the_closed_sets_are_the_contracts() -> None:
    from scripts.walk.sanitize import (
        ALLOWED_KEYS,
        CHECK_IDS,
        DEFECT_CLASSES,
        ITEMS,
        SCREENS,
        SEVERITIES,
    )

    assert set(ITEMS) == set(WALKED_ITEMS)
    assert "M0-FL12" not in ITEMS
    assert tuple(SEVERITIES) == ("BLOCKS", "OTHER")
    assert tuple(CHECK_IDS) == ("reads_complete", "act_p95_during_read", "questions_per_discipline")
    assert (
        frozenset({"id", "item", "defect_class", "screen", "delta", "severity", "misleading"})
        == ALLOWED_KEYS
    )
    assert DEFECT_CLASSES
    assert len(SCREENS) >= 2
    assert all(re.fullmatch(r"[a-z][a-z0-9_]{0,39}", c) for c in DEFECT_CLASSES)
    assert all(re.fullmatch(r"[a-z][a-z0-9_.-]{0,59}", s) for s in SCREENS)


def test_a_planted_title_never_survives_sanitize_finding() -> None:
    from scripts.walk.sanitize import ALLOWED_KEYS, sanitize_finding

    out = sanitize_finding(_finding(title=PLANTED_TITLE))

    assert out is not None
    assert set(out) <= ALLOWED_KEYS
    assert has_planted(out) == []


def test_free_text_in_any_other_position_is_dropped() -> None:
    from scripts.walk.sanitize import ALLOWED_KEYS, sanitize_finding

    raw = _finding(
        detail=PLANTED_NOTE,
        note=PLANTED_QUESTION,
        nested={"sheet": PLANTED_TITLE, "deeper": {"file": PLANTED_FILE}},
        lines=[PLANTED_TITLE, PLANTED_NOTE],
        evidence=PLANTED_PATH,
        issue=PLANTED_TITLE,
        dedup_comment_on=PLANTED_NOTE,
    )

    out = sanitize_finding(raw)

    assert out is not None
    assert set(out) <= ALLOWED_KEYS
    assert has_planted(out) == []


@pytest.mark.parametrize("field", ["item", "defect_class", "screen", "severity"])
def test_an_out_of_set_closed_value_rejects_the_finding(field: str) -> None:
    from scripts.walk.sanitize import sanitize_finding

    # The planted title as it is, and slug-shaped so it passes the contract's pattern but is in no set.
    for planted in (PLANTED_TITLE, "synthetic_title_zz"):
        assert sanitize_finding(_finding(**{field: planted})) is None


@pytest.mark.parametrize("bad_id", [PLANTED_TITLE, "", "-starts-with-dash", "x" * 41])
def test_an_id_outside_the_contracts_pattern_rejects_the_finding(bad_id: str) -> None:
    from scripts.walk.sanitize import sanitize_finding

    assert sanitize_finding(_finding(id=bad_id)) is None


@pytest.mark.parametrize("delta", ["12 pages of X", True, None])
def test_a_delta_that_is_not_a_real_number_is_dropped(delta: object) -> None:
    from scripts.walk.sanitize import sanitize_finding

    out = sanitize_finding(_finding(delta=delta))

    assert out is not None
    assert out.get("delta") is None
    assert "pages" not in json.dumps(out)


@pytest.mark.parametrize("delta", [3.5, -2])
def test_a_numeric_delta_is_kept(delta: float) -> None:
    from scripts.walk.sanitize import sanitize_finding

    out = sanitize_finding(_finding(delta=delta))

    assert out is not None
    assert out["delta"] == delta
    assert not isinstance(out["delta"], bool | str)


def _planted_walk() -> dict[str, Any]:
    """A verdict-shaped walk record with drawing-like text planted in every free position."""
    return {
        "sha": SHA,
        "result": "FAIL",
        "note": PLANTED_NOTE,
        "checks": [
            {
                "check": "reads_complete",
                "set": "set-a",
                "status": "PASS",
                "measured": {"files": 2, "completed": 2, "file": PLANTED_FILE},
                "expected": {"files": 2},
                "title": PLANTED_TITLE,
            },
            {
                "check": "act_p95_during_read",
                "set": PLANTED_DISCIPLINE,
                "status": "FAIL",
                "measured": {"p95_ms": 2400, "samples": 20},
                "expected": {"p95_ms_max": 1000},
            },
        ],
        "burden": [
            {
                "set": "set-a",
                "discipline": "structural",
                "questions_by_kind": {"low_confidence": 2, PLANTED_QUESTION: 1},
                "questions_total": 3,
                "sheets": 10,
                "bulk_confirmable_sheets": 9,
                "one_source_sheets": 8,
                "continuation_questions": 1,
                "false_continuation_questions": 0,
                "sheet_title": PLANTED_TITLE,
            },
            {
                "set": "set-a",
                "discipline": PLANTED_DISCIPLINE,
                "questions_by_kind": {"low_confidence": 1},
                "questions_total": 1,
                "sheets": 4,
                "bulk_confirmable_sheets": 4,
                "one_source_sheets": 4,
                "continuation_questions": 0,
                "false_continuation_questions": None,
            },
        ],
        "sets": {
            "set-a": {
                "files": [{"id": 1, "state": "done", "read_seconds": 30, "name": PLANTED_FILE}],
                "questions": {PLANTED_DISCIPLINE: {"low_confidence": 1}},
                "question_text": PLANTED_QUESTION,
                "evidence": PLANTED_PATH,
            }
        },
    }


def _only_closed_values(summary: dict[str, Any]) -> None:
    assert set(summary) <= {"sha", "result", "checks", "burden"}
    assert summary.get("sha") == SHA
    assert summary.get("result") in ("PASS", "FAIL")
    for check in summary.get("checks", []):
        assert set(check) <= {"check", "set", "status", "measured"}
        assert SLUG.fullmatch(check["set"])
        assert all(
            isinstance(v, int | float) and not isinstance(v, bool) for v in check["measured"].values()
        )
    for row in summary.get("burden", []):
        assert DISCIPLINE_NAME.fullmatch(row["discipline"])
        for key, value in row.items():
            if key == "discipline":
                continue
            if key == "set":
                assert SLUG.fullmatch(value)
            elif key == "questions_by_kind":
                assert all(re.fullmatch(r"[a-z][a-z0-9_]{0,39}", kind) for kind in value)
            else:
                assert value is None or (isinstance(value, int | float) and not isinstance(value, bool))


def test_sanitize_walk_keeps_only_closed_ids_numbers_and_slug_disciplines() -> None:
    from scripts.walk.sanitize import sanitize_walk

    summary = sanitize_walk(_planted_walk())

    assert has_planted(summary) == []
    _only_closed_values(summary)
    assert [row["discipline"] for row in summary["burden"]] == ["structural"]
    assert any(c["check"] == "reads_complete" and c["set"] == "set-a" for c in summary["checks"])


def test_the_cli_prints_the_summary_and_refuses_bad_json(tmp_path: Path) -> None:
    walk = tmp_path / "walk.json"
    walk.write_text(json.dumps(_planted_walk()))

    done = subprocess.run(
        [sys.executable, "-m", "scripts.walk.sanitize", str(walk)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert done.returncode == 0, done.stderr
    assert has_planted(done.stdout + done.stderr) == []
    _only_closed_values(json.loads(done.stdout))

    bad = tmp_path / "bad.json"
    bad.write_text("{not json " + PLANTED_TITLE)
    refused = subprocess.run(
        [sys.executable, "-m", "scripts.walk.sanitize", str(bad)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert refused.returncode == 2
    assert has_planted(refused.stdout + refused.stderr) == []
