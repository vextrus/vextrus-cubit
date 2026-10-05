"""The only door from a G1 walk to anything public (docs/specs/factory.md 5, item 9; 3.8).

"The public summary comes only from `scripts/walk/sanitize.py`'s allowlist: a verdict per finish-line
item, numeric deltas, defect classes." Everything here keeps a value only when it is in a closed set
or a number; a string is never echoed unless it is one of this file's own words or matches a short
code pattern (a set slug, a Market Discipline key, a Question kind code). Unknown keys are dropped,
and a finding with an out-of-set closed value is dropped whole.

    python -m scripts.walk.sanitize <verdict.json>   # prints the public summary; exit 2 on bad input

The closed sets are the contract's (docs/specs/factory/contracts/walk-verdict.schema.json): item codes
M0-FL1..M0-FL11 and M0-FL13 (M0-FL12 is dropped from G1), defect classes `^[a-z][a-z0-9_]{0,39}$`,
screens `^[a-z][a-z0-9_.-]{0,59}$` (the route's name, never a title).
"""

import json
import math
import re
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any

ITEMS: tuple[str, ...] = tuple(f"M0-FL{n}" for n in (*range(1, 12), 13))
"""The twelve walked finish-line items (docs/specs/factory.md 5's table)."""

DEFECT_CLASSES: frozenset[str] = frozenset(
    {
        # The owner's walk's classes (docs/specs/factory.md 1, D1-D10), in public words.
        "act_waits_on_read",  # an act (confirm, answer, exclude, undo) waits on a read (D1)
        "too_many_questions",  # Questions per Discipline over the limit (D2)
        "not_bulk_confirmable",  # Sheets that should join the bulk act do not
        "false_continuation",  # a continuation Question that is not one
        "stale_after_read",  # a screen not refreshed when a file finishes reading
        "proposed_exclusion_wrong",  # a proposed leave-out the QS must undo
        "storeys_wrong",
        "data_shape_mismatch",  # the screen and the server disagree on a shape
        "sheet_fact_wrong",  # number, title, Discipline or revision read wrong
        "number_wrong",  # a count or a measure on the screen is wrong
        # The finish line's items, by what fails them.
        "read_failed",
        "read_stalled",
        "read_quarantined",
        "dupe_on_drop",  # a second drop of the same file made a second copy
        "cancel_restart_broken",
        "progress_wordless",
        "report_missing",
        "list_order_wrong",
        "sheet_illegible",
        "views_left_over",  # a view given no Part and not put out of scope
        "answer_broken",
        "exclusion_broken",
        "undo_broken",
        "access_wrong",
        "refusal_missing",
        "tenant_leak",
        "words_wrong",
        "time_not_local",
        "choice_shown",
        # Any screen.
        "key_missing",
        "focus_lost",
        "layout_broken",
        "slow_screen",
        "crash",
        "misleading_display",
        "other",
    }
)

SCREENS: frozenset[str] = frozenset(
    {
        "sign-in",
        "choose-developer",
        "join",
        "no-access",
        "access-ended",
        "projects",
        "members",
        "project",
        "drawing-set",
        "drawing-set.report",
        "takeoff.step1",
        "takeoff.step1.sheet",
        "takeoff.step1.questions",
        "takeoff.step1.views",  # the panel of views
        "takeoff.step1.drawing-list",
        "takeoff.step",
        "status-bar",
        "toolbar",
        "rail",
    }
)

SEVERITIES: tuple[str, ...] = ("BLOCKS", "OTHER")
CHECK_IDS: tuple[str, ...] = (
    "reads_complete",
    "act_p95_during_read",
    "questions_per_discipline",
    "sheets_match",
    "true_questions_raised",
    "false_continuations",
    "bulk_confirmable_share",
    "storeys_match",
)
STATUSES: tuple[str, ...] = ("PASS", "FAIL", "UNSET")
RESULTS: tuple[str, ...] = ("PASS", "FAIL")

ALLOWED_KEYS: frozenset[str] = frozenset(
    {"id", "item", "defect_class", "screen", "delta", "severity", "misleading"}
)
"""The contract's finding keys that carry no free text. `issue` and `dedup_comment_on` are set by
`issues.py`'s caller, never taken from input."""

MEASURED_KEYS: frozenset[str] = frozenset(
    {
        # reads_complete
        "files",
        "completed",
        # act_p95_during_read
        "p95_ms",
        "max_ms",
        "samples",
        "confirm",
        "undo",
        "exclude",
        "answer",
        "failed_acts",
        # questions_per_discipline
        "questions_max_per_discipline",
        "disciplines",
        # sheets_match
        "sheets_found",
        "missing",
        "phantoms",
        # true_questions_raised
        "true_listed",
        "true_raised",
        # false_continuations
        "false_questions",
        "stale_grouped",
        # bulk_confirmable_share
        "bulk_confirmable_sheets",
        "sheets_expected",
        # storeys_match
        "storeys_listed",
        "storeys_wrong",
        # any check its set's snapshot could not measure
        "unmeasured",
    }
)
"""The contract's `measured` keys of the eight checks (walk-verdict.schema.json), numbers only."""

DISCIPLINES: frozenset[str] = frozenset(
    {
        "structural",
        "architectural",
        "electrical",
        "plumbing",
        "fire",
        "mechanical",
        "lift",
        "gas",
        "general",
        "none",
    }
)
"""The Market's Discipline keys (vextrus/drawings/library.py) and `none` (no Discipline): the only
Discipline names a public summary keeps, and only when they also match the slug pattern."""

QUESTION_KINDS: frozenset[str] = frozenset(
    {
        "missing",
        "conflict",
        "low_confidence",
        "check",
        "file_misread",
        "labour_source",
        "relation",
        "missing_discipline",
        "convention",
        "continuation",
    }
)
"""The product's Question kind codes (vextrus/takeoff/models.py `QuestionKind`), and `continuation`."""

BURDEN_NUMBERS: tuple[str, ...] = (
    "questions_total",
    "sheets",
    "sheets_expected",
    "bulk_confirmable_sheets",
    "one_source_sheets",
    "blank_sheets",
    "machine_doubt_questions",
    "continuation_questions",
    "false_continuation_questions",
)

ID = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")
SLUG = re.compile(r"[a-z0-9][a-z0-9_-]{0,39}")
DISCIPLINE = re.compile(r"[a-z][a-z0-9_]{1,24}")
SHA = re.compile(r"[0-9a-f]{40}")


NUMBER_LIMIT = 10**12
"""No walk number comes near it; a larger one could carry text in its digits, so it is not a number."""


def is_number(value: object) -> bool:
    """A real, finite number below NUMBER_LIMIT in size: never a bool, a string or None."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return -NUMBER_LIMIT < value < NUMBER_LIMIT
    return isinstance(value, float) and math.isfinite(value) and abs(value) < NUMBER_LIMIT


def _closed(value: object, allowed: frozenset[str] | tuple[str, ...]) -> str | None:
    """The allowlist's own copy of `value` when it is in the set (never the input object)."""
    if not isinstance(value, str):
        return None
    for word in allowed:
        if word == value:
            return word
    return None


def _code(value: object, pattern: re.Pattern[str]) -> str | None:
    if isinstance(value, str) and pattern.fullmatch(value):
        return value
    return None


def sanitize_finding(raw: Mapping[str, Any]) -> dict[str, Any] | None:
    """`raw`'s allowlisted fields, or None when any closed field is missing or out of its set.

    Keeps only ALLOWED_KEYS; `delta` is kept only as a real number (else None); `misleading` must be
    a real bool; `id` must match the contract's pattern.
    """
    if not isinstance(raw, Mapping):
        return None
    item = _closed(raw.get("item"), ITEMS)
    defect_class = _closed(raw.get("defect_class"), DEFECT_CLASSES)
    screen = _closed(raw.get("screen"), SCREENS)
    severity = _closed(raw.get("severity"), SEVERITIES)
    finding_id = _code(raw.get("id"), ID)
    misleading = raw.get("misleading")
    if None in (item, defect_class, screen, severity, finding_id) or not isinstance(misleading, bool):
        return None
    delta = raw.get("delta")
    return {
        "id": finding_id,
        "item": item,
        "defect_class": defect_class,
        "screen": screen,
        "delta": delta if is_number(delta) else None,
        "severity": severity,
        "misleading": misleading is True,
    }


def _measured(value: object) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        return {}
    return {key: value[key] for key in sorted(MEASURED_KEYS) if key in value and is_number(value[key])}


def _check(raw: object) -> dict[str, Any] | None:
    if not isinstance(raw, Mapping):
        return None
    check = _closed(raw.get("check"), CHECK_IDS)
    set_ = _code(raw.get("set"), SLUG)
    status = _closed(raw.get("status"), STATUSES)
    if check is None or set_ is None or status is None:
        return None
    return {"check": check, "set": set_, "status": status, "measured": _measured(raw.get("measured"))}


def _burden_row(raw: object) -> dict[str, Any] | None:
    if not isinstance(raw, Mapping):
        return None
    set_ = _code(raw.get("set"), SLUG)
    discipline = _closed(_code(raw.get("discipline"), DISCIPLINE), DISCIPLINES)
    if set_ is None or discipline is None:
        return None
    kinds = raw.get("questions_by_kind")
    row: dict[str, Any] = {
        "set": set_,
        "discipline": discipline,
        "questions_by_kind": {
            kind: count
            for kind, count in (kinds.items() if isinstance(kinds, Mapping) else ())
            if _closed(kind, QUESTION_KINDS) is not None and is_number(count)
        },
    }
    for key in BURDEN_NUMBERS:
        value = raw.get(key)
        row[key] = value if is_number(value) else None
    return row


def sanitize_walk(walk: Mapping[str, Any]) -> dict[str, Any]:
    """The public summary of a verdict (or a verdict-shaped walk record): closed ids and numbers only.

    `{"sha", "result", "checks": [{"check", "set", "status", "measured"}], "burden": [rows]}`; set
    slugs and Discipline keys are kept only when slug-shaped; everything else is dropped. A summary
    sanitizes to itself.
    """
    summary: dict[str, Any] = {}
    if not isinstance(walk, Mapping):
        return {"checks": [], "burden": []}
    if (sha := _code(walk.get("sha"), SHA)) is not None:
        summary["sha"] = sha
    if (result := _closed(walk.get("result"), RESULTS)) is not None:
        summary["result"] = result
    checks = walk.get("checks")
    burden = walk.get("burden")
    summary["checks"] = [
        c for c in (_check(raw) for raw in (checks if isinstance(checks, list) else [])) if c
    ]
    summary["burden"] = [
        r for r in (_burden_row(raw) for raw in (burden if isinstance(burden, list) else [])) if r
    ]
    return summary


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print("usage: python -m scripts.walk.sanitize <walk.json>", file=sys.stderr)
        return 2
    try:
        data = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    except OSError, UnicodeDecodeError, ValueError, RecursionError:
        print("sanitize: unreadable or not JSON", file=sys.stderr)
        return 2
    if not isinstance(data, dict):
        print("sanitize: not a JSON object", file=sys.stderr)
        return 2
    print(json.dumps(sanitize_walk(data), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
