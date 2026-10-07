"""Shared pieces of T-WALK-4's acceptance tests (not a test file): a synthetic walk inside every limit,
the private `snapshot.json` it is measured from, and the set expectation it is judged by.

The ticket (session 13, T-WALK-4): G1 judges what the owner's Q5 limits say, from a burden snapshot
taken in a project no act touched. The seam it fixes, which every test here goes through:

- `scripts.walk.measures.attach(walk, folder, expect) -> dict`: a copy of `walk` with each measurable
  set's burden rows (`sheets_expected`, `machine_doubt_questions`, `continuation_questions`,
  `false_continuation_questions`) and `sets.<slug>.measures` (`unmeasured`, `true_listed`,
  `true_raised`, `stale_grouped`, `storeys_listed`, `storeys_wrong`), read from
  `<folder>/snapshot.json`; `expect` is the set expectations by slug;
- `scripts.walk.verdict.evaluate(...)` and `verdict.main(argv)` as before, with eight checks per set.

The walk record here is derived from the snapshot the way `walk.spec.ts` counts it (open Questions per
Discipline by kind; per Discipline the Sheets, the one-source and the bulk-confirmable ones), so a
test changes the snapshot and the walk follows. Every literal is invented: sets `set-a`/`set-b`, files
`kilo.dwg`/`lima.dwg`, numbers `K-01`, `L-01`, titles `Made-up ...`, storeys `T1`; no drawing text,
no count from a real set. Every time is a fixed string.
"""

import copy
import importlib
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

SHA = "0123456789abcdef0123456789abcdef01234567"
STARTED = "2026-10-05T01:00:00Z"
FINISHED = "2026-10-05T02:00:00Z"
SET_A, SET_B = "set-a", "set-b"

# The checks, in the ticket's order (sanitize.CHECK_IDS).
CHECKS = (
    "reads_complete",
    "act_p95_during_read",
    "questions_per_discipline",
    "sheets_match",
    "true_questions_raised",
    "false_continuations",
    "bulk_confirmable_share",
    "storeys_match",
)
SNAPSHOT_CHECKS = (
    "questions_per_discipline",
    "sheets_match",
    "true_questions_raised",
    "false_continuations",
    "bulk_confirmable_share",
    "storeys_match",
)
MEASURED = {
    "reads_complete": {"files", "completed"},
    "act_p95_during_read": {
        "p95_ms",
        "max_ms",
        "samples",
        "confirm",
        "undo",
        "exclude",
        "answer",
        "failed_acts",
    },
    "questions_per_discipline": {"questions_max_per_discipline", "disciplines"},
    "sheets_match": {"sheets_found", "missing", "phantoms"},
    "true_questions_raised": {"true_listed", "true_raised"},
    "false_continuations": {"false_questions", "stale_grouped"},
    "bulk_confirmable_share": {"bulk_confirmable_sheets", "sheets_expected"},
    "storeys_match": {"storeys_listed", "storeys_wrong"},
}

WALKED_ITEMS = tuple(f"M0-FL{n}" for n in (*range(1, 12), 13))

SAME_TITLE = "engine.conflicts.same_title"
SAME_STOREY = "engine.conflicts.same_storey"
SAME_NUMBER = "engine.conflicts.same_number"
GAP = "engine.register_check.gap"
GAPS = "engine.register_check.gaps"
WHICH_KIND = "takeoff.step1.which_kind"

STRUCTURAL, ARCHITECTURAL = "structural", "architectural"
FILE_A, FILE_B = "kilo.dwg", "lima.dwg"
ACT_KINDS = ("confirm", "undo", "exclude", "answer")

# Planted strings: invented, never drawing text; no verdict or summary may echo one.
PLANTED_FILE = "zz-planted-walk4-file.dwg"
PLANTED_TITLE = "ZZ PLANTED WALK4 TITLE"
PLANTED_NUMBER = "ZZ-PLANTED-91"
PLANTED_STOREY = "ZZ planted storey"
PLANTED = (PLANTED_FILE, PLANTED_TITLE, PLANTED_NUMBER, PLANTED_STOREY)


# The snapshot ---------------------------------------------------------------------------------------


def sheet(
    sid: str,
    file: str,
    number: str,
    title: str,
    discipline: str | None,
    *,
    layout: bool = True,
    proposed_exclusion: str | None = None,
    held: bool = False,
    agrees: bool = True,
    storeys: list[str] | None = None,
    storeys_titled: list[str] | None = None,
) -> dict[str, Any]:
    """One snapshot Sheet, in the seam's keys."""
    return {
        "id": sid,
        "file": file,
        "number": number,
        "title": title,
        "discipline": discipline,
        "layout": layout,
        "proposed_exclusion": proposed_exclusion,
        "held": held,
        "agrees": agrees,
        "storeys": [] if storeys is None else storeys,
        "storeys_titled": storeys_titled,
    }


def question(
    qid: str,
    kind: str,
    code: str,
    discipline: str | None,
    proposals: Iterable[str],
    *,
    status: str = "open",
    check_code: str | None = None,
) -> dict[str, Any]:
    """One snapshot Question, holding Sheets by id."""
    return {
        "id": qid,
        "kind": kind,
        "code": code,
        "status": status,
        "check_code": check_code,
        "discipline": discipline,
        "proposals": list(proposals),
    }


def conflict(qid: str, code: str, discipline: str | None, *proposals: str) -> dict[str, Any]:
    return question(qid, "conflict", code, discipline, proposals)


def which_kind(qid: str, discipline: str | None, *proposals: str) -> dict[str, Any]:
    return question(qid, "low_confidence", WHICH_KIND, discipline, proposals)


def gap(qid: str, discipline: str | None, *proposals: str, code: str = GAP) -> dict[str, Any]:
    return question(qid, "missing", code, discipline, proposals)


def standard_set() -> dict[str, Any]:
    """One set's snapshot entry inside every limit of `standard_expect()`.

    structural: 10 Sheets `K-01`..`K-10` in kilo.dwg (ids s1..s10), all but s10 agreeing; K-01's
    Views give storeys T1 and T2. architectural: 5 Sheets `L-01`..`L-05` in lima.dwg (a1..a5), all
    agreeing; L-01 has no View storeys and is titled T3. Open Questions: the listed true `same_title`
    over K-03 and K-04, two `which_kind` in structural and one in architectural; one answered
    `same_storey` (not open: counted nowhere).
    """
    sheets = [
        sheet(
            f"s{n}",
            FILE_A,
            f"K-{n:02d}",
            f"Made-up Plan K{n}",
            STRUCTURAL,
            agrees=n != 10,
            storeys=["T1", "T2"] if n == 1 else [],
        )
        for n in range(1, 11)
    ]
    sheets += [
        sheet(
            f"a{n}",
            FILE_B,
            f"L-{n:02d}",
            f"Made-up Elevation L{n}",
            ARCHITECTURAL,
            storeys_titled=["T3"] if n == 1 else None,
        )
        for n in range(1, 6)
    ]
    questions = [
        conflict("q1", SAME_TITLE, STRUCTURAL, "s3", "s4"),
        which_kind("q2", STRUCTURAL, "s5"),
        which_kind("q3", STRUCTURAL, "s6"),
        which_kind("q4", ARCHITECTURAL, "a2"),
        {**conflict("q5", SAME_STOREY, ARCHITECTURAL, "a3", "a4"), "status": "answered"},
    ]
    return {"acts_before_snapshot": 0, "sheets": sheets, "questions": questions, "bulk_after_gaps": {}}


def standard_expect() -> dict[str, Any]:
    """One set's expectation (`.private/work/walk-expect/<set>.json`'s shape) with every key."""
    return {
        "files": 2,
        "p95_ms_max": 1000,
        "act_max_ms": 3000,
        "act_samples_min": 5,
        "questions_max_per_discipline": 3,
        "bulk_confirmable_share_min": 0.8,
        "false_continuation_max": 0,
        "phantom_sheets_max": 0,
        "stale_title_grouped_max": 0,
        "storeys_wrong_max": 0,
        "sheets_per_discipline": {STRUCTURAL: 10, ARCHITECTURAL: 5},
        "true_questions": [
            {
                "discipline": STRUCTURAL,
                "code": SAME_TITLE,
                "sheets": [{"file": FILE_A, "number": "K-03"}, {"file": FILE_A, "number": "K-04"}],
            }
        ],
        "stale_title_pairs": [
            {
                "discipline": ARCHITECTURAL,
                "sheets": [{"file": FILE_B, "number": "L-04"}, {"file": FILE_B, "number": "L-05"}],
            }
        ],
        "storeys": [
            {"file": FILE_A, "number": "K-01", "storeys": ["T1", "T2"]},
            {"file": FILE_B, "number": "L-01", "storeys": ["T3"]},
        ],
    }


def by_id(entry: dict[str, Any], sid: str) -> dict[str, Any]:
    """The snapshot Sheet `sid` of a set entry (to change it in place)."""
    found = [s for s in entry["sheets"] if s["id"] == sid]
    assert len(found) == 1, sid
    sheet_: dict[str, Any] = found[0]
    return sheet_


def snapshot(sets: dict[str, dict[str, Any]], **change: Any) -> dict[str, Any]:
    """The whole `snapshot.json` for this walk (its sha and started_at), with `change` over it."""
    return {"schema": 1, "sha": SHA, "started_at": STARTED, "sets": copy.deepcopy(sets), **change}


# The walk record, counted from the snapshot as walk.spec.ts counts it ------------------------------


def acts(ms: Iterable[float] | None = None) -> list[dict[str, Any]]:
    """Five acts of each kind during a read, all answered 200; `ms` gives their times in order."""
    times = list(ms) if ms is not None else [100 + 10 * n for n in range(20)]
    return [
        {"kind": ACT_KINDS[n % 4], "ms": t, "read_running": True, "status": 200}
        for n, t in enumerate(times)
    ]


def _code(discipline: str | None) -> str:
    return discipline if discipline else "none"


def walk_set(entry: dict[str, Any], *, files: int = 2) -> dict[str, Any]:
    """A walk.json set record counted from a snapshot set entry."""
    questions: dict[str, dict[str, int]] = {}
    burden: dict[str, dict[str, Any]] = {}

    def row(discipline: str) -> dict[str, Any]:
        return burden.setdefault(
            discipline,
            {
                "sheets": 0,
                "one_source": 0,
                "bulk_confirmable": 0,
                "continuation_questions": 0,
                "false_continuation_questions": None,
            },
        )

    for q in entry["questions"]:
        if q["status"] != "open":
            continue
        discipline = _code(q["discipline"])
        kinds = questions.setdefault(discipline, {})
        kinds[q["kind"]] = kinds.get(q["kind"], 0) + 1
        if q["code"] in (SAME_TITLE, SAME_STOREY):
            row(discipline)["continuation_questions"] += 1
    for s in entry["sheets"]:
        counts = row(_code(s["discipline"]))
        counts["sheets"] += 1
        if s["agrees"] and not s["held"]:
            counts["bulk_confirmable"] += 1
        if not s["agrees"]:
            counts["one_source"] += 1
    return {
        "project": "WK-01",
        "files": [{"id": n, "state": "done", "read_seconds": 30 + n} for n in range(1, files + 1)],
        "acts": acts(),
        "questions": questions,
        "burden": burden,
    }


def walk(sets: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """walk.json for snapshot set entries."""
    return {
        "schema": 1,
        "sha": SHA,
        "started_at": STARTED,
        "urls": {"web": "http://127.0.0.1:5511", "api": "http://127.0.0.1:8811"},
        "sets": {slug: walk_set(entry) for slug, entry in sets.items()},
    }


def layer() -> dict[str, Any]:
    """Every walked item PASS and no finding: a passing agent layer."""
    return {"items": [{"item": item, "status": "PASS"} for item in WALKED_ITEMS], "findings": []}


def measures() -> Any:
    """`scripts.walk.measures`, the module T-WALK-4 adds (imported by name: absent on main)."""
    return importlib.import_module("scripts.walk.measures")


# Judging --------------------------------------------------------------------------------------------


def judged(
    tmp_path: Path,
    sets: dict[str, dict[str, Any]],
    expect: dict[str, Any],
    *,
    record: dict[str, Any] | None = None,
    snap: dict[str, Any] | str | None = "default",
    attach_expect: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """`measures.attach` on the walk and the snapshot laid out in `tmp_path` (with `attach_expect`,
    else `expect`), then `evaluate` with a passing agent layer: the verdict, checked against its
    contract."""
    from scripts.walk.schema import verdict_errors
    from scripts.walk.verdict import evaluate

    attach = measures().attach

    folder = tmp_path / "walk-folder"
    folder.mkdir(parents=True, exist_ok=True)
    if snap == "default":
        snap = snapshot(sets)
    if snap is not None:
        (folder / "snapshot.json").write_text(json.dumps(snap))
    given = walk(sets) if record is None else record
    measure_by = expect if attach_expect is None else attach_expect
    attached = attach(copy.deepcopy(given), folder, copy.deepcopy(measure_by))
    verdict: dict[str, Any] = evaluate(
        attached,
        expect,
        layer(),
        ref="main",
        started_at=STARTED,
        finished_at=FINISHED,
        leak_hits=0,
    )
    assert verdict_errors(verdict) == [], verdict_errors(verdict)
    return verdict


def lay_out(
    root: Path,
    sets: dict[str, dict[str, Any]],
    expect: dict[str, Any],
    *,
    record: dict[str, Any] | None = None,
    snap: dict[str, Any] | str | None = "default",
) -> tuple[Path, Path]:
    """`<root>/walks/<sha>/` with walk.json, snapshot.json (unless None; a str is written as text)
    and a passing findings.json; `<root>/expect/<set>.json` per expectation. The two folders."""
    walks, expect_dir = root / "walks", root / "expect"
    folder = walks / SHA
    folder.mkdir(parents=True)
    expect_dir.mkdir()
    (folder / "walk.json").write_text(json.dumps(walk(sets) if record is None else record))
    (folder / "findings.json").write_text(json.dumps(layer()))
    if snap == "default":
        snap = snapshot(sets)
    if isinstance(snap, str):
        (folder / "snapshot.json").write_text(snap)
    elif snap is not None:
        (folder / "snapshot.json").write_text(json.dumps(snap))
    for slug, body in expect.items():
        (expect_dir / f"{slug}.json").write_text(json.dumps(body))
    return walks, expect_dir


def main_argv(walks: Path, expect_dir: Path) -> list[str]:
    return [
        SHA,
        "--leak-hits",
        "0",
        "--ref",
        "main",
        "--walks-dir",
        str(walks),
        "--expect-dir",
        str(expect_dir),
    ]


def check(verdict: dict[str, Any], name: str, set_: str = SET_A) -> dict[str, Any]:
    found = [c for c in verdict["checks"] if c["check"] == name and c["set"] == set_]
    assert len(found) == 1, [c["check"] for c in verdict["checks"]]
    check_: dict[str, Any] = found[0]
    return check_


def status(verdict: dict[str, Any], name: str, set_: str = SET_A) -> str:
    status_: str = check(verdict, name, set_)["status"]
    return status_


def row(verdict: dict[str, Any], discipline: str, set_: str = SET_A) -> dict[str, Any]:
    found = [r for r in verdict["burden"] if r["set"] == set_ and r["discipline"] == discipline]
    assert len(found) == 1, f"{set_} {discipline}: {len(found)} burden rows"
    row_: dict[str, Any] = found[0]
    return row_


def has_planted(value: Any) -> list[str]:
    """The planted strings found anywhere in a JSON-able value or text (case folded)."""
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return [p for p in PLANTED if p.lower() in text.lower()]
