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
the agent layer did not run), writes `<D>/<sha40>/public/summary.json` (sanitize's allowlist only) and
then `verdict.json`, atomically and last; a verdict already there is kept as
`verdict.<its finished_at>.json`. Exit 0 PASS, 1 FAIL, 2 error (nothing written). `--smoke` writes
`smoke-verdict.json` (a name `ready.py` never reads) with `"smoke": true`, and never `verdict.json`.
"""

import argparse
import json
import os
import re
import sys
import tempfile
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any

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
UTC = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")
REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,99}")
DISCIPLINE = re.compile(r"[a-z][a-z0-9_]{1,24}")
KIND = re.compile(r"[a-z][a-z0-9_]{0,39}")
ITEM_STATUSES = ("PASS", "FAIL", "NOT_WALKED")
DONE = "done"
"""A file's state in walk.json once its read completed (the product's `read`)."""

EXPECT_KEYS = (
    "files",
    "p95_ms_max",
    "questions_max_per_discipline",
    "bulk_confirmable_share_min",
    "false_continuation_max",
)
QUESTION_LIMITS = (
    "questions_max_per_discipline",
    "bulk_confirmable_share_min",
    "false_continuation_max",
)
BURDEN_KEYS = (
    "sheets",
    "one_source",
    "bulk_confirmable",
    "continuation_questions",
    "false_continuation_questions",
)


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


def _expectation(raw: object) -> dict[str, float]:
    """One set's expectation file, or an error: numbers only, under known keys."""
    if not isinstance(raw, Mapping):
        raise Malformed("an expectation is not an object")
    unknown = set(raw) - set(EXPECT_KEYS)
    if unknown:
        raise Malformed("an expectation has a key the schema does not name")
    for value in raw.values():
        if not is_number(value) or value < 0:
            raise Malformed("an expectation is not a non-negative number")
    share = raw.get("bulk_confirmable_share_min")
    if share is not None and share > 1:
        raise Malformed("bulk_confirmable_share_min is above 1")
    return dict(raw)


def _check(
    check: str, set_: str, measured: dict[str, Any], expected: dict[str, Any] | None, ok: bool
) -> dict[str, Any]:
    status = "UNSET" if expected is None else "PASS" if ok else "FAIL"
    return {"check": check, "set": set_, "status": status, "measured": measured, "expected": expected}


def _limits(expect: Mapping[str, Any] | None, keys: tuple[str, ...]) -> dict[str, Any] | None:
    """The expectation's keys for one check, or None (UNSET) if any is missing."""
    if expect is None or any(key not in expect for key in keys):
        return None
    return {key: expect[key] for key in keys}


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
    expected = _limits(expect, ("files",))
    reads = _check(
        "reads_complete",
        name,
        {"files": len(states), "completed": completed},
        expected,
        expected is not None and len(states) > 0 and completed == len(states) == expected["files"],
    )

    # (2) Act p95 while a later file is still reading: only acts with read_running true count.
    during = []
    for act in acts:
        if not isinstance(act, Mapping) or not is_number(act.get("ms")) or act["ms"] < 0:
            raise Malformed("an act has no time")
        if act.get("read_running") is True:
            during.append(act["ms"])
    measured: dict[str, Any] = {"samples": len(during)}
    if during:
        measured = {"p95_ms": p95(during), "samples": len(during)}
    expected = _limits(expect, ("p95_ms_max",))
    act_check = _check(
        "act_p95_during_read",
        name,
        measured,
        expected,
        expected is not None and bool(during) and measured["p95_ms"] <= expected["p95_ms_max"],
    )

    # (3) Questions per Discipline by kind, with the burden counts beside them.
    disciplines = sorted(set(questions) | set(burden))
    rows = []
    totals = []
    burden_ok = True
    expected = _limits(expect, QUESTION_LIMITS)
    for discipline in disciplines:
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
        total = sum(by_kind.values())
        totals.append(total)
        counts = burden.get(discipline, {})
        if not isinstance(counts, Mapping):
            raise Malformed("a burden row is not an object")
        sheets = _count(counts.get("sheets", 0), "sheets")
        bulk = _count(counts.get("bulk_confirmable", 0), "bulk_confirmable")
        one_source = _count(counts.get("one_source", 0), "one_source")
        continuations = _count(counts.get("continuation_questions", 0), "continuation_questions")
        false_raw = counts.get("false_continuation_questions")
        false = None if false_raw is None else _count(false_raw, "false_continuation_questions")
        if expected is not None:
            if sheets > 0 and bulk / sheets < expected["bulk_confirmable_share_min"]:
                burden_ok = False
            # Not measured is not within the limit (fail closed).
            if false is None or false > expected["false_continuation_max"]:
                burden_ok = False
        rows.append(
            {
                "set": name,
                "discipline": discipline,
                "questions_by_kind": by_kind,
                "questions_total": total,
                "sheets": sheets,
                "bulk_confirmable_sheets": bulk,
                "one_source_sheets": one_source,
                "continuation_questions": continuations,
                "false_continuation_questions": false,
            }
        )
    most = max(totals, default=0)
    question_check = _check(
        "questions_per_discipline",
        name,
        {"questions_max_per_discipline": most, "disciplines": len(disciplines)},
        expected,
        expected is not None
        and len(disciplines) > 0
        and most <= expected["questions_max_per_discipline"]
        and burden_ok,
    )
    return [reads, act_check, question_check], rows


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
            isinstance(number, bool) or not isinstance(number, int) or number < 1
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
    passed = (
        all(c["status"] == "PASS" for c in checks)
        and [i["item"] for i in layer["items"]] == list(ITEMS)
        and all(i["status"] == "PASS" for i in layer["items"])
        and layer["blocks"] == 0
        and layer["misleading"] == 0
    )
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


def _arguments(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m scripts.walk.verdict")
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
    try:
        if not SHA.fullmatch(args.sha):
            raise Malformed("the sha is not 40 hex")
        if args.leak_hits != 0:
            raise LeakHits("the leak scan hit or did not run")
        folder = args.walks_dir / args.sha
        walk = _read_json(folder / "walk.json")
        if not isinstance(walk, Mapping) or walk.get("sha") != args.sha:
            raise Malformed("walk.json is not this sha's")
        if (walk.get("smoke") is True) != args.smoke:
            raise Malformed("a smoke walk is judged only with --smoke, and only a smoke walk is")
        findings_path = folder / "findings.json"
        findings = _read_json(findings_path) if findings_path.exists() else None
        if findings is not None and not isinstance(findings, Mapping):
            raise Malformed("findings.json is not an object")
        expect: dict[str, Any] = {}
        sets = walk.get("sets")
        for name in sets if isinstance(sets, Mapping) else ():
            if isinstance(name, str) and SLUG.fullmatch(name):
                path = args.expect_dir / f"{name}.json"
                if path.exists():
                    expect[name] = _read_json(path)
        started = walk.get("started_at")
        if not isinstance(started, str) or not UTC.fullmatch(started):
            started = time.strftime(
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
    except (OSError, ValueError, KeyError, TypeError) as error:
        # The error's kind only: a message could carry a path or a value.
        print(f"verdict: not judged ({type(error).__name__})", file=sys.stderr)
        return 2
    if verdict_errors(verdict):
        print("verdict: not judged (the verdict breaks its contract)", file=sys.stderr)
        return 2
    summary = sanitize_walk(verdict)
    if args.smoke:
        write_atomic(folder / "public" / "smoke-summary.json", {**summary, "smoke": True})
        write_atomic(folder / "smoke-verdict.json", {**verdict, "smoke": True})
    else:
        write_atomic(folder / "public" / "summary.json", summary)
        _keep_older(folder)
        write_atomic(folder / "verdict.json", verdict)  # last: its existence means the walk is over
    print(f"verdict: {verdict['result']} {args.sha[:8]}")
    return 0 if verdict["result"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
