"""G1's judgement: a walk's raw record, its expectations and the agent layer's findings, into the
contract's `verdict.json` (docs/specs/factory.md 5 "G1"; docs/specs/factory/contracts/
walk-verdict.schema.json, whose PASS rule this applies and nothing else).

The scripted walk (`web/e2e/real/walk.spec.ts`) only records raw numbers into `walk.json`; every limit
lives in `.private/work/walk-expect/<set>.json` (never in git, never from a walk's own recording). A
check with no expectation is UNSET, and UNSET fails PASS. An absent agent layer fails PASS. A walk
whose leak scan hit is not judged at all.

    python -m scripts.walk.verdict <sha40> --leak-hits N [--ref main] [--walks-dir D] [--expect-dir D]
        [--smoke]

reads `<D>/<sha40>/walk.json` and `findings.json` (the agent layer's `{"items", "findings"}`; absent:
the agent layer did not run) and judges each walk once (a verdict already holding the walk's
`started_at` refuses, exit 2: a re-judgement needs a new walk), writes
`<D>/<sha40>/public/summary.json` (sanitize's allowlist only) and then `verdict.json`, atomically and
last; an earlier walk's verdict already there is kept as `verdict.<its finished_at>.json`.
Exit 0 PASS, 1 FAIL, 2 error (nothing written). `--smoke` writes `smoke-verdict.json` (a name
`ready.py` never reads) with `"smoke": true`, and never `verdict.json`.

A run holds an exclusive `flock` on `<D>/<sha40>/.walk.lock` (a name without "verdict", which
`ready.py` would refuse) from before it reads walk.json until its verdict is written, so the
one-judgement check and the write are one step: a second run waits, then meets the first's verdict
and refuses. The lock is made only in an existing walk folder; the kernel frees it when a run dies.
"""

import argparse
import contextlib
import fcntl
import json
import os
import re
import sys
import tempfile
import time
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from typing import Any

from scripts.walk.cli import QuietParser
from scripts.walk.measures import MEASURES, attach
from scripts.walk.sanitize import (
    ALLOWED_KEYS,
    CHECK_IDS,
    ITEMS,
    SLUG,
    is_number,
    sanitize_finding,
    sanitize_walk,
)
from scripts.walk.schema import verdict_errors, walk_errors

SHA = re.compile(r"[0-9a-f]{40}")
ISSUE_LIMIT = 10**7
"""Above any issue number GitHub gives; a larger one could carry text in its digits."""
UTC = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")
REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,99}")
DISCIPLINE = re.compile(r"[a-z][a-z0-9_]{1,24}")
KIND = re.compile(r"[a-z][a-z0-9_]{0,39}")
ITEM_STATUSES = ("PASS", "FAIL", "NOT_WALKED")
DONE = "done"
"""A file's state in walk.json once its read completed (the product's `read`)."""

COUNT_KEYS = (
    "files",
    "questions_max_per_discipline",
    "false_continuation_max",
    "act_samples_min",
    "phantom_sheets_max",
    "stale_title_grouped_max",
    "storeys_wrong_max",
)
"""Expectation limits that are counts: non-negative integers."""
MS_KEYS = ("p95_ms_max", "act_max_ms")
SHARE_KEY = "bulk_confirmable_share_min"
STRUCTURE_KEYS = ("sheets_per_discipline", "true_questions", "stale_title_pairs", "storeys")
"""Expectation structures naming Sheets by file and number (private; only their counts are judged)."""
EXPECT_KEYS = (*COUNT_KEYS, *MS_KEYS, SHARE_KEY, *STRUCTURE_KEYS)
LIST_LIMIT = 500
"""Entries in one expectation structure, and Sheets or storeys in one entry: a bound, so a hostile
expectation cannot grow the judgement."""
TEXT_LIMIT = 200
CODE = re.compile(r"[a-z][a-z0-9_.]{0,99}")
"""A Question's message code (`engine.conflicts.same_title`)."""
ACT_KINDS = ("confirm", "undo", "exclude", "answer")
UNMEASURED = {"unmeasured": 1}
"""The `measured` of a check its set's snapshot could not measure: it fails closed."""
SNAPSHOT_ROW_KEYS = ("machine_doubt_questions", "false_continuation_questions")
"""A burden row's counts only the snapshot gives: null in a row means its set was not measured."""
SHARE_SLACK = 1e-9
"""A share times N in floating point (0.7 * 10 is 7.000000000000001) is compared with this slack."""


class Malformed(ValueError):
    """An input that is not the shape it must be: nothing is judged."""


class LeakHits(ValueError):
    """The leak scan hit (or did not run): a walk with hits is not written as a verdict."""


def p95(values: list[float] | list[int]) -> float:
    """The 95th percentile by nearest rank: `sorted(v)[ceil(0.95 * n) - 1]`."""
    if not values:
        raise ValueError("p95 of no values")
    ordered = sorted(values)
    rank = (95 * len(ordered) + 99) // 100  # ceil(0.95 * n), in integers
    return ordered[rank - 1]


def _count(value: object, what: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise Malformed(f"{what} is not a count")
    return value


def _optional_count(value: object, what: str) -> int | None:
    return None if value is None else _count(value, what)


def _entries(raw: object, keys: frozenset[str], what: str) -> list[Mapping[str, Any]]:
    """A bounded list of objects with exactly `keys`."""
    if not isinstance(raw, list) or len(raw) > LIST_LIMIT:
        raise Malformed(f"{what} is not a list")
    for entry in raw:
        if not isinstance(entry, Mapping) or set(entry) != keys:
            raise Malformed(f"an entry of {what} is not its keys")
    return raw


def _text(value: object, what: str) -> str:
    if not isinstance(value, str) or not value or len(value) > TEXT_LIMIT:
        raise Malformed(f"{what} is not short text")
    return value


def _expected_discipline(value: object) -> str:
    if not isinstance(value, str) or not DISCIPLINE.fullmatch(value) or value == "none":
        raise Malformed("a Discipline is not a Discipline key")
    return value


def _listed_sheets(raw: object, what: str, *, exactly: int | None = None) -> None:
    sheets = _entries(raw, frozenset({"file", "number"}), what)
    if not sheets or (exactly is not None and len(sheets) != exactly):
        raise Malformed(f"{what} holds the wrong number of Sheets")
    for sheet in sheets:
        _text(sheet["file"], "a file")
        _text(sheet["number"], "a Sheet number")


def _structure(key: str, raw: object) -> None:
    """One expectation structure, checked by shape only (its text is never judged or written)."""
    match key:
        case "sheets_per_discipline":
            if not isinstance(raw, Mapping) or len(raw) > LIST_LIMIT:
                raise Malformed("sheets_per_discipline is not counts by Discipline")
            for discipline, n in raw.items():
                _expected_discipline(discipline)
                _count(n, "a Sheet count")
        case "true_questions":
            for entry in _entries(raw, frozenset({"discipline", "code", "sheets"}), key):
                _expected_discipline(entry["discipline"])
                if not isinstance(entry["code"], str) or not CODE.fullmatch(entry["code"]):
                    raise Malformed("a true Question's code is not a code")
                _listed_sheets(entry["sheets"], "a true Question")
        case "stale_title_pairs":
            for entry in _entries(raw, frozenset({"discipline", "sheets"}), key):
                _expected_discipline(entry["discipline"])
                _listed_sheets(entry["sheets"], "a stale-title pair", exactly=2)
        case "storeys":
            for entry in _entries(raw, frozenset({"file", "number", "storeys"}), key):
                _listed_sheets([{"file": entry["file"], "number": entry["number"]}], key)
                storeys = entry["storeys"]
                if not isinstance(storeys, list) or not storeys or len(storeys) > LIST_LIMIT:
                    raise Malformed("a Sheet's storeys are not a list")
                for storey in storeys:
                    _text(storey, "a storey")


def _expectation(raw: object) -> dict[str, Any]:
    """One set's expectation file, or an error: known keys only; counts, times, a share and the four
    structures, each by its shape."""
    if not isinstance(raw, Mapping):
        raise Malformed("an expectation is not an object")
    unknown = set(raw) - set(EXPECT_KEYS)
    if unknown:
        raise Malformed("an expectation has a key the schema does not name")
    for key, value in raw.items():
        if key in COUNT_KEYS:
            _count(value, key)
        elif key in STRUCTURE_KEYS:
            _structure(key, value)
        elif not is_number(value) or value < 0:
            raise Malformed("an expectation is not a non-negative number")
    share = raw.get(SHARE_KEY)
    if share is not None and share > 1:
        raise Malformed("bulk_confirmable_share_min is above 1")
    return dict(raw)


def _check(
    check: str, set_: str, measured: dict[str, Any], expected: dict[str, Any] | None
) -> dict[str, Any]:
    """A check, its status set after by `status_of`."""
    return {"check": check, "set": set_, "status": "", "measured": measured, "expected": expected}


def _given(expect: Mapping[str, Any] | None, keys: tuple[str, ...]) -> bool:
    """Every key a check needs is in the expectation (else the check is UNSET)."""
    return expect is not None and all(key in expect for key in keys)


def _row_holds(row: Mapping[str, Any]) -> bool:
    """A burden row whose own numbers agree: a total is its kinds' sum, and each part is within its
    whole."""
    kinds = row["questions_by_kind"]
    total, sheets = row["questions_total"], row["sheets"]
    numbers = [total, sheets, row["one_source_sheets"], row["continuation_questions"]]
    if not all(is_number(n) for n in [*numbers, *kinds.values()]):
        return False
    if total != sum(kinds.values()) or row["one_source_sheets"] > sheets:
        return False
    if row["continuation_questions"] > total:
        return False
    parts = {
        "bulk_confirmable_sheets": sheets,
        "machine_doubt_questions": total,
        "false_continuation_questions": total,
    }
    for key, whole in parts.items():
        value = row.get(key)
        if value is not None and (not is_number(value) or value > whole):
            return False
    return True


def _sheets_count(rows: Sequence[Mapping[str, Any]]) -> tuple[int, int, int, int]:
    """(found, missing, phantoms, N) over a set's rows, judged on the set's total (the owner, 5 Oct
    2026: "Judge the total; report the split"): every Sheet of every Discipline and of none against
    the sum of N; a phantom is a blank beyond the total (a numbered Sheet beyond it is no phantom, and
    the count is still wrong). The rows report the split; it is never judged."""
    found = sum(row["sheets"] for row in rows)
    expected = sum(row["sheets_expected"] or 0 for row in rows)
    blanks = sum(row.get("blank_sheets") or 0 for row in rows)
    return found, max(0, expected - found), min(max(0, found - expected), blanks), expected


def status_of(check: Mapping[str, Any], rows: Sequence[Mapping[str, Any]]) -> str:
    """A check's status from its own `measured`, `expected` and its set's burden rows: the one rule
    `evaluate` writes by and `ready.py` re-checks every verdict by."""
    measured, expected = check["measured"], check["expected"]
    if expected is None:
        return "UNSET"
    values = [*measured.values(), *expected.values()]
    if not all(is_number(v) for v in values) or measured.get("unmeasured", 0) != 0:
        return "FAIL"  # not measured is not within the limit (fail closed)
    m, e = measured.get, expected.get
    try:
        ok = _holds(check["check"], m, e, rows)
    except KeyError, TypeError:
        ok = False
    return "PASS" if ok else "FAIL"


def _holds(name: str, m: Any, e: Any, rows: Sequence[Mapping[str, Any]]) -> bool:
    """Whether a measured check is within its limits and agrees with its set's burden rows."""
    match name:
        case "reads_complete":
            files, completed, want = m("files"), m("completed"), e("files")
            return None not in (files, completed, want) and files > 0 and completed == files == want
        case "act_p95_during_read":
            kinds = [m(kind) for kind in ACT_KINDS]
            numbers = [m("p95_ms"), m("max_ms"), m("samples"), m("failed_acts"), *kinds]
            limits = [e("p95_ms_max"), e("max_ms_max"), e("samples_each_min")]
            if None in numbers or None in limits:
                return False
            return (
                m("samples") == sum(kinds) > 0
                and all(kind >= e("samples_each_min") for kind in kinds)
                and m("p95_ms") <= m("max_ms") <= e("max_ms_max")
                and m("p95_ms") <= e("p95_ms_max")
                and m("failed_acts") == 0
            )
        case "questions_per_discipline":
            most, count, limit = (
                m("questions_max_per_discipline"),
                m("disciplines"),
                e("questions_max_per_discipline"),
            )
            doubt = [row["machine_doubt_questions"] for row in rows]
            return (
                None not in (most, count, limit, *doubt)
                and count == len(rows) > 0
                and most == max(doubt)
                and most <= limit
                and all(_row_holds(row) for row in rows)
            )
        case "sheets_match":
            found, missing, phantoms, n = _sheets_count(rows)
            return (
                (m("sheets_found"), m("missing"), m("phantoms"), e("sheets"))
                == (found, missing, phantoms, n)
                and found - phantoms == n  # the total, less its blanks, is N
                and e("phantoms_max") is not None
                and phantoms <= e("phantoms_max")
            )
        case "true_questions_raised":
            listed, raised, want = m("true_listed"), m("true_raised"), e("true_questions")
            return None not in (listed, raised, want) and raised == listed == want
        case "false_continuations":
            false = [row["false_continuation_questions"] for row in rows]
            caps = (e("false_continuation_max"), e("stale_title_grouped_max"))
            return (
                None not in (m("false_questions"), m("stale_grouped"), *caps, *false)
                and m("false_questions") == sum(false)
                and m("false_questions") <= caps[0]
                and m("stale_grouped") <= caps[1]
            )
        case "bulk_confirmable_share":
            # The owner, 5 Oct 2026 ("Total + own split"): (a) the bulk Sheets of the Disciplines the
            # key names, over the key's N for the set; (b) each Discipline's bulk Sheets over the
            # Sheets the product itself files under it. Against the key's N per Discipline: reported.
            share = e("bulk_confirmable_share_min")
            if share is None or any(row["bulk_confirmable_sheets"] is None for row in rows):
                return False
            named = [row for row in rows if row.get("sheets_expected") is not None]
            total = sum(row["bulk_confirmable_sheets"] for row in named)
            n = sum(row["sheets_expected"] for row in named)
            return (
                (m("bulk_confirmable_sheets"), m("sheets_expected")) == (total, n)
                and total >= share * n - SHARE_SLACK
                and all(
                    row["bulk_confirmable_sheets"] >= share * row["sheets"] - SHARE_SLACK for row in rows
                )
            )
        case "storeys_match":
            listed, wrong, limit = m("storeys_listed"), m("storeys_wrong"), e("storeys_wrong_max")
            return None not in (listed, wrong, limit) and wrong <= listed and wrong <= limit
    return False


def result_of(verdict: Mapping[str, Any]) -> str:
    """The one PASS rule (walk-verdict.schema.json): every check and walked item PASS, none BLOCKS
    or misleading."""
    layer = verdict["agent_layer"]
    passed = (
        all(c["status"] == "PASS" for c in verdict["checks"])
        and [i["item"] for i in layer["items"]] == list(ITEMS)
        and all(i["status"] == "PASS" for i in layer["items"])
        and layer["blocks"] == 0
        and layer["misleading"] == 0
    )
    return "PASS" if passed else "FAIL"


def _acts(acts: list[Any], confirm_targets: object = None) -> dict[str, Any]:
    """Act timing: samples are acts of a read that ran before and after them and that answered (a
    status of 1 to 399, or none recorded); an act answered 0 (never) or 400 and up is a failed act.
    A walk that found no Sheet offering a confirm (`confirm_targets` 0) and timed none is not
    measured (`no_confirm_target`): it fails for want of a target, never as slow acts."""
    during: list[float] = []
    kinds = dict.fromkeys(ACT_KINDS, 0)
    failed = 0
    for act in acts:
        if not isinstance(act, Mapping) or not is_number(act.get("ms")) or act["ms"] < 0:
            raise Malformed("an act has no time")
        status = _optional_count(act.get("status"), "an act's status")
        if status is not None and (status == 0 or status >= 400):
            failed += 1
            continue
        if act.get("read_running") is True:
            kind = act.get("kind")
            if kind not in kinds:
                raise Malformed("an act's kind is not an act")
            kinds[kind] += 1
            during.append(act["ms"])
    measured: dict[str, Any] = {"samples": len(during), **kinds, "failed_acts": failed}
    if during:
        measured |= {"p95_ms": p95(during), "max_ms": max(during)}
    targets = _optional_count(confirm_targets, "confirm_targets")
    if targets == 0 and kinds["confirm"] == 0:
        measured |= {"unmeasured": 1, "no_confirm_target": 1}
    return measured


def _measures(record: Mapping[str, Any]) -> dict[str, int] | None:
    """The set's snapshot measures (measures.attach), or None when the set was not measured."""
    found = record.get("measures")
    flag = found.get("unmeasured") if isinstance(found, Mapping) else None
    if isinstance(flag, bool) or flag != 0 or not isinstance(found, Mapping):
        return None  # only an integer 0 says measured
    return {key: _count(found.get(key), key) for key in MEASURES}


def _rows(name: str, questions: Mapping[str, Any], burden: Mapping[str, Any]) -> list[dict[str, Any]]:
    """The set's burden rows, one per Discipline, from the (measured) walk record."""
    rows = []
    for discipline in sorted(set(questions) | set(burden)):
        if not isinstance(discipline, str) or not DISCIPLINE.fullmatch(discipline):
            raise Malformed("a Discipline key is not a Discipline code")
        kinds = questions.get(discipline, {})
        if not isinstance(kinds, Mapping):
            raise Malformed("a Discipline's Questions are not counts by kind")
        by_kind = {}
        for kind, count in kinds.items():
            if not isinstance(kind, str) or not KIND.fullmatch(kind):
                raise Malformed("a Question kind is not a kind code")
            by_kind[kind] = _count(count, "a Question count")
        counts = burden.get(discipline, {})
        if not isinstance(counts, Mapping):
            raise Malformed("a burden row is not an object")
        # Blanks are listed only where a Discipline has one (only blanks beyond the total are phantoms).
        blanks = _optional_count(counts.get("blank_sheets"), "blank_sheets")
        rows.append(
            {
                **({"blank_sheets": blanks} if blanks else {}),
                "set": name,
                "discipline": discipline,
                "questions_by_kind": by_kind,
                "questions_total": sum(by_kind.values()),
                "sheets": _count(counts.get("sheets", 0), "sheets"),
                "sheets_expected": _optional_count(counts.get("sheets_expected"), "sheets_expected"),
                "bulk_confirmable_sheets": _optional_count(
                    counts.get("bulk_confirmable", 0), "bulk_confirmable"
                ),
                "one_source_sheets": _count(counts.get("one_source", 0), "one_source"),
                "machine_doubt_questions": _optional_count(
                    counts.get("machine_doubt_questions"), "machine_doubt_questions"
                ),
                "continuation_questions": _count(
                    counts.get("continuation_questions", 0), "continuation_questions"
                ),
                "false_continuation_questions": _optional_count(
                    counts.get("false_continuation_questions"), "false_continuation_questions"
                ),
            }
        )
    return rows


def _set_checks(
    name: str, record: Mapping[str, Any], expect: Mapping[str, Any] | None
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    files = record.get("files")
    acts = record.get("acts")
    questions = record.get("questions")
    burden = record.get("burden")
    if not (
        isinstance(files, list)
        and isinstance(acts, list)
        and isinstance(questions, Mapping)
        and isinstance(burden, Mapping)
    ):
        raise Malformed("a set lacks files, acts, questions or burden")

    # (1) Every file's read completes.
    states = []
    for file in files:
        if not isinstance(file, Mapping) or not isinstance(file.get("state"), str):
            raise Malformed("a file has no state")
        states.append(file["state"])
    completed = sum(1 for state in states if state == DONE)

    def limits(keys: tuple[str, ...], gives: dict[str, Any]) -> dict[str, Any] | None:
        """`gives` (a limit's name, its expectation key or a function of the expectation) when the
        expectation holds every key in `keys`; else None (UNSET)."""
        if expect is None or not _given(expect, keys):
            return None
        return {to: key(expect) if callable(key) else expect[key] for to, key in gives.items()}

    reads = _check(
        "reads_complete",
        name,
        {"files": len(states), "completed": completed},
        limits(("files",), {"files": "files"}),
    )

    # (2) Acts while a later file is still reading: p95, the worst one, samples of each kind.
    act_check = _check(
        "act_p95_during_read",
        name,
        _acts(acts, record.get("confirm_targets")),
        limits(
            ("p95_ms_max", "act_max_ms", "act_samples_min"),
            {
                "p95_ms_max": "p95_ms_max",
                "max_ms_max": "act_max_ms",
                "samples_each_min": "act_samples_min",
            },
        ),
    )

    # (3)-(8) From the snapshot taken before any act (measures.attach), by Discipline.
    rows = _rows(name, questions, burden)
    measures = _measures(record)
    if any(row[key] is None for row in rows for key in SNAPSHOT_ROW_KEYS):
        measures = None  # a row the snapshot did not count: not measured
    judged = [row for row in rows if row["sheets_expected"] is not None]

    def measured(numbers: dict[str, Any]) -> dict[str, Any]:
        return dict(UNMEASURED) if measures is None else numbers

    found, missing, phantoms, _ = _sheets_count(rows)
    unknown = dict.fromkeys(MEASURES, 0)
    got = unknown if measures is None else measures
    bulk = [row["bulk_confirmable_sheets"] for row in judged]
    checks = [
        reads,
        act_check,
        _check(
            "questions_per_discipline",
            name,
            measured(
                {
                    "questions_max_per_discipline": max(
                        (row["machine_doubt_questions"] or 0 for row in rows), default=0
                    ),
                    "disciplines": len(rows),
                }
            ),
            limits(
                ("questions_max_per_discipline",),
                {"questions_max_per_discipline": "questions_max_per_discipline"},
            ),
        ),
        _check(
            "sheets_match",
            name,
            measured({"sheets_found": found, "missing": missing, "phantoms": phantoms}),
            limits(
                ("sheets_per_discipline", "phantom_sheets_max"),
                {
                    "sheets": lambda x: sum(x["sheets_per_discipline"].values()),
                    "phantoms_max": "phantom_sheets_max",
                },
            ),
        ),
        _check(
            "true_questions_raised",
            name,
            measured({"true_listed": got["true_listed"], "true_raised": got["true_raised"]}),
            limits(("true_questions",), {"true_questions": lambda x: len(x["true_questions"])}),
        ),
        _check(
            "false_continuations",
            name,
            measured(
                {
                    "false_questions": sum(row["false_continuation_questions"] or 0 for row in rows),
                    "stale_grouped": got["stale_grouped"],
                }
            ),
            limits(
                ("false_continuation_max", "stale_title_grouped_max", "stale_title_pairs"),
                {
                    "false_continuation_max": "false_continuation_max",
                    "stale_title_grouped_max": "stale_title_grouped_max",
                },
            ),
        ),
        _check(
            "bulk_confirmable_share",
            name,
            # A Discipline with an open gap Question and no count after its answer: unmeasured.
            dict(UNMEASURED)
            if measures is None or any(row["bulk_confirmable_sheets"] is None for row in rows)
            else {
                "bulk_confirmable_sheets": sum(b or 0 for b in bulk),
                "sheets_expected": sum(row["sheets_expected"] for row in judged),
            },
            limits(
                (SHARE_KEY, "sheets_per_discipline"),
                {SHARE_KEY: SHARE_KEY},
            ),
        ),
        _check(
            "storeys_match",
            name,
            measured({"storeys_listed": got["storeys_listed"], "storeys_wrong": got["storeys_wrong"]}),
            limits(("storeys_wrong_max", "storeys"), {"storeys_wrong_max": "storeys_wrong_max"}),
        ),
    ]
    for check in checks:
        check["status"] = status_of(check, rows)
    return checks, rows


def _finding(raw: object) -> dict[str, Any]:
    """A contract finding, exactly: no key outside the contract, every closed value in its set."""
    if not isinstance(raw, Mapping):
        raise Malformed("a finding is not an object")
    if set(raw) != ALLOWED_KEYS | {"issue", "dedup_comment_on"}:
        raise Malformed("a finding's keys are not the contract's")
    clean = sanitize_finding(raw)
    if clean is None or any(clean[key] != raw[key] for key in ALLOWED_KEYS):
        raise Malformed("a finding holds a value outside its closed set")
    issue, comment = raw["issue"], raw["dedup_comment_on"]
    for number in (issue, comment):
        if number is not None and (
            isinstance(number, bool) or not isinstance(number, int) or not 1 <= number < ISSUE_LIMIT
        ):
            raise Malformed("an issue number is not a positive integer")
    return {**clean, "issue": issue, "dedup_comment_on": comment}


def _agent_layer(layer: object) -> dict[str, Any]:
    if layer is None:
        return {
            "items": [{"item": item, "status": "NOT_WALKED"} for item in ITEMS],
            "findings": [],
            "blocks": 0,
            "misleading": 0,
            "issues_drafted": 0,
            "dedup_comments": 0,
        }
    if not isinstance(layer, Mapping) or set(layer) != {"items", "findings"}:
        raise Malformed("the agent layer is not {items, findings}")
    raw_items, raw_findings = layer["items"], layer["findings"]
    if not isinstance(raw_items, list) or not isinstance(raw_findings, list):
        raise Malformed("the agent layer's items or findings are not lists")
    status: dict[str, str] = {}
    for entry in raw_items:
        if (
            not isinstance(entry, Mapping)
            or set(entry) != {"item", "status"}
            or entry["item"] not in ITEMS
            or entry["status"] not in ITEM_STATUSES
        ):
            raise Malformed("an agent-layer item is not a walked item and its status")
        if entry["item"] in status:
            raise Malformed("an item is listed twice")
        status[entry["item"]] = str(entry["status"])
    findings = [_finding(raw) for raw in raw_findings]
    ids = [f["id"] for f in findings]
    if len(set(ids)) != len(ids):
        raise Malformed("two findings share an id")
    drafted = sum(1 for f in findings if f["issue"] is not None and f["dedup_comment_on"] is None)
    comments = sum(1 for f in findings if f["dedup_comment_on"] is not None and f["issue"] is None)
    if drafted + comments != len(findings):
        raise Malformed("findings counted is not issues drafted plus dedup comments")
    return {
        # Every walked item, in order; one the layer did not list was not walked.
        "items": [{"item": item, "status": status.get(item, "NOT_WALKED")} for item in ITEMS],
        "findings": findings,
        "blocks": sum(1 for f in findings if f["severity"] == "BLOCKS"),
        "misleading": sum(1 for f in findings if f["misleading"] is True),
        "issues_drafted": drafted,
        "dedup_comments": comments,
    }


def evaluate(
    walk: Mapping[str, Any],
    expect: Mapping[str, Any],
    findings: object,
    *,
    ref: str,
    started_at: str,
    finished_at: str,
    leak_hits: int,
) -> dict[str, Any]:
    """The contract's verdict object for one walk (walk-verdict.schema.json), by its one PASS rule.

    `findings` is the agent layer's record `{"items": [{"item", "status"}], "findings": [...]}`, or
    None when it did not run (every item NOT_WALKED). Raises on leak hits and on malformed input.
    """
    if isinstance(leak_hits, bool) or not isinstance(leak_hits, int) or leak_hits != 0:
        raise LeakHits("the leak scan hit or did not run: no verdict is written")
    if not isinstance(walk, Mapping) or walk.get("schema") != 1:
        raise Malformed("walk.json is not schema 1")
    if walk_errors(walk):
        raise Malformed("walk.json does not match web/e2e/real/walk.schema.json")
    sha = walk.get("sha")
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        raise Malformed("walk.json's sha is not 40 hex")
    if not isinstance(ref, str) or not REF.fullmatch(ref):
        raise Malformed("ref is not a ref name")
    for stamp in (started_at, finished_at):
        if not isinstance(stamp, str) or not UTC.fullmatch(stamp):
            raise Malformed("a time is not UTC")
    sets = walk.get("sets")
    if not isinstance(sets, Mapping) or not sets:
        raise Malformed("walk.json has no sets")
    if not isinstance(expect, Mapping):
        raise Malformed("the expectations are not an object")

    checks: list[dict[str, Any]] = []
    burden: list[dict[str, Any]] = []
    for name in sorted(sets):
        if not isinstance(name, str) or not SLUG.fullmatch(name):
            raise Malformed("a set's name is not a slug")
        record = sets[name]
        if not isinstance(record, Mapping):
            raise Malformed("a set is not an object")
        raw_expect = expect.get(name)
        set_expect = None if raw_expect is None else _expectation(raw_expect)
        set_checks, rows = _set_checks(name, record, set_expect)
        checks += set_checks
        burden += rows
    if {c["check"] for c in checks} != set(CHECK_IDS):
        raise Malformed("a check is missing")

    layer = _agent_layer(findings)
    passed = result_of({"checks": checks, "agent_layer": layer}) == "PASS"
    return {
        "schema_version": 1,
        "sha": sha,
        "ref": ref,
        "started_at": started_at,
        "finished_at": finished_at,
        "result": "PASS" if passed else "FAIL",
        "checks": checks,
        "burden": burden,
        "agent_layer": layer,
        "leak_scan": {"hits": 0},
    }


# The command line ---------------------------------------------------------------------------------


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_atomic(path: Path, data: Any) -> None:
    """`data` as JSON at `path`, by a temporary file in the same folder and a rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, sort_keys=True)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


class Judged(ValueError):
    """This walk already has its verdict: a re-judgement needs a new walk."""


def judged_once(folder: Path, started_at: str | None) -> None:
    """One walk, one judgement. A walk is known by its `started_at`: a verdict already in `folder`
    holding it refuses (judging it again, after the expectations or the findings change, would
    count as a second walk). A walk.json with no `started_at` cannot be told from another, so it is
    judged only into a folder holding no verdict at all. An unreadable verdict there refuses too.
    run.py sets an older walk.json aside before a new walk of the same head writes its own."""
    for path in sorted(folder.glob("verdict*.json")):
        if started_at is None:
            raise Judged("a walk with no started_at, and a verdict already here")
        try:
            older = _read_json(path)
        except (OSError, ValueError, RecursionError) as error:
            raise Judged("a verdict here cannot be read") from error
        if not isinstance(older, Mapping) or older.get("started_at") == started_at:
            raise Judged("this walk already has its verdict")


def _keep_older(folder: Path) -> None:
    """A re-walk of one sha keeps the verdict already there as `verdict.<its finished_at>.json`."""
    current = folder / "verdict.json"
    if not current.exists():
        return
    stamp = None
    try:
        older = _read_json(current)
        finished = older.get("finished_at") if isinstance(older, Mapping) else None
        if isinstance(finished, str) and UTC.fullmatch(finished):
            stamp = finished.replace("-", "").replace(":", "")
    except OSError, ValueError:
        stamp = None
    if stamp is None:
        stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime(current.stat().st_mtime))
    target = folder / f"verdict.{stamp}.json"
    n = 1
    while target.exists():
        n += 1
        target = folder / f"verdict.{stamp}-{n}.json"
    os.replace(current, target)


LOCK_NAME = ".walk.lock"
"""One walk folder's lock; never "verdict" in its name (ready.py refuses any such stray file)."""


@contextlib.contextmanager
def walk_lock(folder: Path) -> Iterator[None]:
    """An exclusive, blocking `flock` on `folder`'s lock file, made only in an existing folder (no
    link followed). A lock file left by a dead run holds nothing: the kernel frees a lock with its
    holder."""
    handle = os.open(folder / LOCK_NAME, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
    try:
        fcntl.flock(handle, fcntl.LOCK_EX)
        # A temporary verdict here is a dead run's (no live one writes without the lock); left, its
        # name would make ready.py refuse every walk.
        for stale in folder.glob(".*verdict.json.*.tmp"):
            stale.unlink(missing_ok=True)
        yield
    finally:
        os.close(handle)


def _arguments(argv: list[str] | None) -> argparse.Namespace:
    parser = QuietParser(prog="python -m scripts.walk.verdict")
    parser.add_argument("sha")
    parser.add_argument("--leak-hits", type=int, required=True)
    parser.add_argument("--ref", default="main")
    parser.add_argument("--walks-dir", type=Path, default=Path(".private/work/walks"))
    parser.add_argument("--expect-dir", type=Path, default=Path(".private/work/walk-expect"))
    parser.add_argument("--smoke", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        args = _arguments(argv)
    except SystemExit:
        return 2
    with contextlib.ExitStack() as held:
        try:
            if not SHA.fullmatch(args.sha):
                raise Malformed("the sha is not 40 hex")
            if args.leak_hits != 0:
                raise LeakHits("the leak scan hit or did not run")
            folder = args.walks_dir / args.sha
            held.enter_context(walk_lock(folder))  # until the verdict is written
        except (OSError, ValueError) as error:
            print(f"verdict: not judged ({type(error).__name__})", file=sys.stderr)
            return 2
        return _judge(args, folder)


def read_expectations(walk: Mapping[str, Any], expect_dir: Path) -> dict[str, Any]:
    """Each walked set's expectation file, by slug (a set with none is judged UNSET)."""
    expect: dict[str, Any] = {}
    sets = walk.get("sets")
    for name in sets if isinstance(sets, Mapping) else ():
        if isinstance(name, str) and SLUG.fullmatch(name):
            path = expect_dir / f"{name}.json"
            if path.exists():
                expect[name] = _read_json(path)
    return expect


def _judge(args: argparse.Namespace, folder: Path) -> int:
    """Judges the walk in `folder` and writes its verdict; the caller holds the walk's lock."""
    try:
        walk = _read_json(folder / "walk.json")
        if not isinstance(walk, Mapping) or walk.get("sha") != args.sha:
            raise Malformed("walk.json is not this sha's")
        if (walk.get("smoke") is True) != args.smoke:
            raise Malformed("a smoke walk is judged only with --smoke, and only a smoke walk is")
        findings_path = folder / "findings.json"
        findings = _read_json(findings_path) if findings_path.exists() else None
        if findings is not None and not isinstance(findings, Mapping):
            raise Malformed("findings.json is not an object")
        expect = read_expectations(walk, args.expect_dir)
        # The burden, from snapshot.json by each set's expectation (a set it cannot measure fails
        # its snapshot checks closed), inside the lock like the rest of the judgement.
        walk = attach(walk, folder, expect)
        stamp = walk.get("started_at")
        recorded = stamp if isinstance(stamp, str) and UTC.fullmatch(stamp) else None
        if not args.smoke:
            judged_once(folder, recorded)
        # Only a walk.json the scripted walk did not write lacks it (a hand-made one, a test's);
        # judged_once has let such a walk through only into a folder that holds no verdict yet.
        started = recorded or time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime((folder / "walk.json").stat().st_mtime)
        )
        verdict = evaluate(
            walk,
            expect,
            findings,
            ref=args.ref,
            started_at=started,
            finished_at=utc_now(),
            leak_hits=args.leak_hits,
        )
    except (OSError, ValueError, KeyError, TypeError, RecursionError) as error:
        # The error's kind only: a message could carry a path or a value.
        print(f"verdict: not judged ({type(error).__name__})", file=sys.stderr)
        return 2
    if verdict_errors(verdict):
        print("verdict: not judged (the verdict breaks its contract)", file=sys.stderr)
        return 2
    summary = sanitize_walk(verdict)
    try:
        if args.smoke:
            write_atomic(folder / "public" / "smoke-summary.json", {**summary, "smoke": True})
            write_atomic(folder / "smoke-verdict.json", {**verdict, "smoke": True})
        else:
            write_atomic(folder / "public" / "summary.json", summary)
            _keep_older(folder)
            write_atomic(folder / "verdict.json", verdict)  # last: its existence ends the walk
    except OSError as error:  # an error, never a FAIL's exit 1
        print(f"verdict: not written ({type(error).__name__})", file=sys.stderr)
        return 2
    print(f"verdict: {verdict['result']} {args.sha[:8]}")
    return 0 if verdict["result"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
