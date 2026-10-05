"""T-WALK-3 acceptance: G1 counts false continuation Questions from a local ground-truth list.

The ticket (session 12 phase 6, closes #294): "G1's check 3 (Questions per Discipline) can never PASS
while a limit is set": the walk writes `false_continuation_questions: null` and nothing fills it. The
seams it names, pinned here:

- the walk's side file `<walks>/<sha>/conflicts.json`: `{"schema": 1, "sha", "started_at", "sets":
  {<slug>: {"questions": [{"code", "proposals": [{"file", "number", "plot_page"} | null, ...]}]}}}`;
- the truth file `<expect-dir>/continuations.json` (schema 1): `sets.<slug>.{groups, near_misses,
  counts}`; a sheet is `{file, page, sheet_number, plot_file?, plot_page?}`; a group has `discipline`,
  `title_form` (`same` or `mark_range`), `title` and `sheets`; a near miss has `discipline`, `why` and
  `sheets`;
- the rule: a Proposal matches a truth sheet when `file` and `number` are equal and the `plot_page`s
  are equal or either is absent. A Question counts when its code is `engine.conflicts.same_title` or
  `engine.conflicts.same_storey`, it holds 2 or more Proposals, and every one matches a sheet of one
  and the same group (or, for the unsure count, of one near miss with `why: unsure`). The judged
  `false_continuation_questions` counts Questions inside one `same` group (M0's one-title rule), per
  the group's Discipline row; beside it `false_continuation_questions_qs_view` (any group) and
  `continuation_questions_unsure`. What cannot be measured stays as the walk wrote it (null: FAIL);
- amendment 1: truth schema 2 adds, per set, `file_sheets`: each file holding a group sheet mapped to
  the sorted list of every true sheet number in it. A counted-code Question with a Proposal in such a
  file whose number is not listed (or is null) leaves its set unmeasured; a listed number in no group
  is a real outside sheet. A schema 2 truth missing a group file is malformed. Schema 1 reads as before.

Everything goes through `verdict.main` and `run.judge_checks`; only the copy test calls
`continuations.attach` itself. Synthetic data only (invented file names, sheet numbers `S-1`, f5's
planted markers); every time is a fixed string; no git, no network, no clock.
"""

import copy
import importlib
import json
import os
import subprocess
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
    WALKED_ITEMS,
    assert_valid_verdict,
    has_planted,
)

SHA = "0123456789abcdef0123456789abcdef01234567"
OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98"
STARTED = "2026-10-05T01:00:00Z"
EARLIER = "2026-10-04T23:00:00Z"
FINISHED = "2026-10-05T02:00:00Z"
FIXED_MTIME = 1_791_000_000  # 2026-10-03, one fixed second for both moves in T10
SET = "set-a"

SAME_TITLE = "engine.conflicts.same_title"
SAME_STOREY = "engine.conflicts.same_storey"
SAME_NUMBER = "engine.conflicts.same_number"
JUDGED = "false_continuation_questions"
QS_VIEW = "false_continuation_questions_qs_view"
UNSURE = "continuation_questions_unsure"


# Fixtures -----------------------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    """The verdict's finished_at and the events log's stamps are one fixed string."""
    from scripts.walk import run, verdict

    monkeypatch.setattr(verdict, "utc_now", lambda: FINISHED)
    monkeypatch.setattr(run, "utc", lambda: FINISHED)


def _sheet(
    number: str, file: str = "A.dwg", plot_page: int | None = None, page: int = 1
) -> dict[str, Any]:
    """A truth sheet: `{file, page, sheet_number, plot_file?, plot_page?}`."""
    sheet: dict[str, Any] = {"file": file, "page": page, "sheet_number": number}
    if plot_page is not None:
        sheet["plot_file"] = file.rsplit(".", 1)[0] + ".pdf"
        sheet["plot_page"] = plot_page
    return sheet


def _key(number: str, file: str = "A.dwg", plot_page: int | None = None) -> dict[str, Any]:
    """A Proposal resolved to its keys, as the walk writes it into conflicts.json."""
    return {"file": file, "number": number, "plot_page": plot_page}


def _group(
    discipline: str,
    title_form: str,
    sheets: list[dict[str, Any]],
    title: str = "synthetic group title",
) -> dict[str, Any]:
    return {"discipline": discipline, "title_form": title_form, "title": title, "sheets": sheets}


def _near_miss(discipline: str, why: str, sheets: list[dict[str, Any]]) -> dict[str, Any]:
    return {"discipline": discipline, "why": why, "sheets": sheets}


# The standard truth: one `same` group of three structural sheets in A.dwg (plot pages 1 to 3), and a
# second `same` group of two in C.dwg. Sheets in B.dwg lie in no group.
GROUP_ONE = [_sheet(f"S-{n}", "A.dwg", plot_page=n, page=n) for n in (1, 2, 3)]
GROUP_TWO = [_sheet(f"S-{n}", "C.dwg", plot_page=n - 10, page=n - 10) for n in (11, 12)]


def _standard_groups() -> list[dict[str, Any]]:
    return [_group("structural", "same", GROUP_ONE), _group("structural", "same", GROUP_TWO)]


def _truth(
    groups: list[dict[str, Any]] | None = None,
    near_misses: list[dict[str, Any]] | None = None,
    *,
    slug: str = SET,
    schema: int = 1,
    method: str = "synthetic method",
    file_sheets: dict[str, list[str]] | None = None,
    extra_numbers: dict[str, list[str]] | None = None,
    without_file_sheets: bool = False,
) -> dict[str, Any]:
    """The truth file. At schema 2 each set carries `file_sheets`: every file holding a group sheet,
    mapped to the sorted list of every true sheet number in it (the truth's own sheets there, plus
    `extra_numbers`), unless `file_sheets` is given or `without_file_sheets` drops the key."""
    groups = _standard_groups() if groups is None else groups
    near_misses = [] if near_misses is None else near_misses
    entry: dict[str, Any] = {
        "groups": groups,
        "near_misses": near_misses,
        "counts": {"groups": len(groups), "near_misses": len(near_misses)},
    }
    if schema >= 2 and not without_file_sheets:
        if file_sheets is None:
            files = {sheet["file"] for group in groups for sheet in group["sheets"]}
            numbers: dict[str, set[str]] = {file: set() for file in files}
            for sheet in (s for entry_ in [*groups, *near_misses] for s in entry_["sheets"]):
                if sheet["file"] in numbers:
                    numbers[sheet["file"]].add(sheet["sheet_number"])
            for file, extra in (extra_numbers or {}).items():
                numbers.setdefault(file, set()).update(extra)
            file_sheets = {file: sorted(found) for file, found in sorted(numbers.items())}
        entry["file_sheets"] = file_sheets
    return {"schema": schema, "method": method, "sets": {slug: entry}}


def _question(code: str, *proposals: dict[str, Any] | None) -> dict[str, Any]:
    return {"code": code, "proposals": list(proposals)}


def _conflicts(
    questions: list[dict[str, Any]],
    *,
    sha: str = SHA,
    started_at: str = STARTED,
    schema: int = 1,
) -> dict[str, Any]:
    return {
        "schema": schema,
        "sha": sha,
        "started_at": started_at,
        "sets": {SET: {"questions": questions}},
    }


def _walk(false: int | None = None) -> dict[str, Any]:
    """A walk.json within every other limit of `_expect()` (f5's passing walk), its false
    continuation count as the walk writes it (null, as the spec does, unless a test says)."""
    return {
        "schema": 1,
        "sha": SHA,
        "started_at": STARTED,
        "urls": {"web": "http://127.0.0.1:5511", "api": "http://127.0.0.1:8811"},
        "sets": {
            SET: {
                "files": [
                    {"id": 1, "state": "done", "read_seconds": 30},
                    {"id": 2, "state": "done", "read_seconds": 45},
                ],
                "acts": [
                    {"kind": kind, "ms": 100 + 10 * n, "read_running": True}
                    for n, kind in enumerate(["confirm", "answer", "exclude", "undo"] * 5)
                ],
                "questions": {
                    "structural": {"conflict": 1, "low_confidence": 1},
                    "architectural": {"low_confidence": 1},
                },
                "burden": {
                    "structural": {
                        "sheets": 10,
                        "one_source": 8,
                        "bulk_confirmable": 9,
                        "continuation_questions": 1,
                        JUDGED: false,
                    },
                    "architectural": {
                        "sheets": 5,
                        "one_source": 5,
                        "bulk_confirmable": 5,
                        "continuation_questions": 0,
                        JUDGED: false,
                    },
                },
            }
        },
    }


def _expect() -> dict[str, Any]:
    return {
        "files": 2,
        "p95_ms_max": 1000,
        "questions_max_per_discipline": 3,
        "bulk_confirmable_share_min": 0.8,
        "false_continuation_max": 0,
    }


def _layer() -> dict[str, Any]:
    """Every walked item PASS and no finding: a passing agent layer."""
    return {"items": [{"item": item, "status": "PASS"} for item in WALKED_ITEMS], "findings": []}


def _folders(root: Path) -> tuple[Path, Path]:
    work = root / ".private" / "work"
    return work / "walks", work / "walk-expect"


def _lay_out(
    root: Path,
    *,
    walk: dict[str, Any] | None = None,
    conflicts: dict[str, Any] | None,
    truth: dict[str, Any] | None,
) -> Path:
    """`<root>/.private/work/walks/<sha>/` with walk.json, findings.json and (unless None)
    conflicts.json; `<root>/.private/work/walk-expect/` with the set's expectation and (unless None)
    continuations.json. The walk's folder."""
    walks, expect_dir = _folders(root)
    folder = walks / SHA
    folder.mkdir(parents=True)
    expect_dir.mkdir(parents=True)
    (folder / "walk.json").write_text(json.dumps(_walk() if walk is None else walk))
    (folder / "findings.json").write_text(json.dumps(_layer()))
    if conflicts is not None:
        (folder / "conflicts.json").write_text(json.dumps(conflicts))
    (expect_dir / f"{SET}.json").write_text(json.dumps(_expect()))
    if truth is not None:
        (expect_dir / "continuations.json").write_text(json.dumps(truth))
    return folder


def _judge(root: Path) -> tuple[int, dict[str, Any]]:
    """`verdict.main` on the laid-out walk: its exit code and the verdict it wrote."""
    from scripts.walk import verdict

    walks, expect_dir = _folders(root)
    code = verdict.main(
        [
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
    )
    written = walks / SHA / "verdict.json"
    assert written.exists(), f"verdict.main exited {code} and wrote no verdict"
    judged: dict[str, Any] = json.loads(written.read_text())
    assert_valid_verdict(judged)
    return code, judged


def _row(verdict: dict[str, Any], discipline: str) -> dict[str, Any]:
    rows = [r for r in verdict["burden"] if r["set"] == SET and r["discipline"] == discipline]
    assert len(rows) == 1, f"{discipline}: {len(rows)} burden rows"
    row: dict[str, Any] = rows[0]
    return row


def _status(verdict: dict[str, Any]) -> str:
    found = [
        c["status"]
        for c in verdict["checks"]
        if c["check"] == "questions_per_discipline" and c["set"] == SET
    ]
    assert len(found) == 1, verdict["checks"]
    status: str = found[0]
    return status


def _count(row: dict[str, Any], key: str) -> object:
    value = row.get(key)
    assert value is None or (isinstance(value, int) and not isinstance(value, bool)), (key, value)
    return value


# T1 -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "pages",
    [(1, 2, True, True), (None, None, True, True), (1, 2, False, False)],
    ids=["equal-plot-pages", "the-proposal-has-no-plot-page", "the-truth-has-no-plot-page"],
)
def test_a_question_inside_one_same_group_is_one_false_continuation(
    tmp_path: Path, pages: tuple[int | None, int | None, bool, bool]
) -> None:
    first, second, first_paged, second_paged = pages
    group = [
        _sheet("S-1", plot_page=1 if first_paged else None),
        _sheet("S-2", plot_page=2 if second_paged else None),
        _sheet("S-3", plot_page=3),
    ]
    _lay_out(
        tmp_path,
        conflicts=_conflicts(
            [_question(SAME_TITLE, _key("S-1", plot_page=first), _key("S-2", plot_page=second))]
        ),
        truth=_truth([_group("structural", "same", group)]),
    )

    code, verdict = _judge(tmp_path)

    row = _row(verdict, "structural")
    assert _count(row, JUDGED) == 1, "the false continuation was not counted"
    assert _status(verdict) == "FAIL"
    assert verdict["result"] == "FAIL"
    assert code == 1


# T2 -----------------------------------------------------------------------------------------------


def test_a_question_over_sheets_in_no_group_counts_none_and_the_check_passes(tmp_path: Path) -> None:
    _lay_out(
        tmp_path,
        conflicts=_conflicts([_question(SAME_TITLE, _key("S-7", "B.dwg"), _key("S-8", "B.dwg"))]),
        truth=_truth(),
    )

    code, verdict = _judge(tmp_path)

    for discipline in ("structural", "architectural"):
        assert _count(_row(verdict, discipline), JUDGED) == 0, discipline
    assert _status(verdict) == "PASS"
    assert verdict["result"] == "PASS"
    assert code == 0


# T3 -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "counted"),
    [
        (_question(SAME_NUMBER, _key("S-1", plot_page=1), _key("S-2", plot_page=2)), 0),
        (_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-11", "C.dwg", 1)), 0),
        (_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-7", "B.dwg")), 0),
        (_question(SAME_TITLE, _key("S-1", plot_page=1)), 0),
        (
            _question(
                "engine.conflicts.synthetic_unknown", _key("S-1", plot_page=1), _key("S-2", plot_page=2)
            ),
            0,
        ),
        (_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-2", plot_page=5)), 0),
        (_question(SAME_STOREY, _key("S-1", plot_page=1), _key("S-2", plot_page=2)), 1),
        (
            _question(
                SAME_TITLE,
                _key("S-1", plot_page=1),
                _key("S-2", plot_page=2),
                _key("S-3", plot_page=3),
            ),
            1,
        ),
    ],
    ids=[
        "same-number-never-counts",
        "sheets-of-two-groups",
        "a-group-sheet-and-an-outside-sheet",
        "one-proposal",
        "an-unknown-conflict-code",
        "a-copy-at-another-plot-page",
        "same-storey-over-a-group-counts",
        "three-sheets-of-a-group-count-once",
    ],
)
def test_only_a_same_title_or_same_storey_question_wholly_inside_one_group_counts(
    tmp_path: Path, question: dict[str, Any], counted: int
) -> None:
    _lay_out(tmp_path, conflicts=_conflicts([question]), truth=_truth())

    code, verdict = _judge(tmp_path)

    assert _count(_row(verdict, "structural"), JUDGED) == counted
    assert _count(_row(verdict, "architectural"), JUDGED) == 0
    assert _status(verdict) == ("FAIL" if counted else "PASS")
    assert code == (1 if counted else 0)


# T4 -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("title_form", "judged"),
    [("mark_range", 0), ("same", 1)],
    ids=["mark-range-group", "same-group"],
)
def test_m0_judges_by_one_title_and_the_qs_view_counts_every_group(
    tmp_path: Path, title_form: str, judged: int
) -> None:
    _lay_out(
        tmp_path,
        conflicts=_conflicts(
            [_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-2", plot_page=2))]
        ),
        truth=_truth([_group("structural", title_form, GROUP_ONE)]),
    )

    code, verdict = _judge(tmp_path)

    row = _row(verdict, "structural")
    assert _count(row, JUDGED) == judged
    assert _count(row, QS_VIEW) == 1
    assert _count(row, UNSURE) == 0
    assert _status(verdict) == ("FAIL" if judged else "PASS")
    assert code == (1 if judged else 0)


# T5 -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("why", "unsure"),
    [("unsure", 1), ("different_storey", 0)],
    ids=["an-unsure-near-miss", "a-different-storey-near-miss"],
)
def test_a_question_on_an_unsure_near_miss_is_counted_apart_and_never_judged(
    tmp_path: Path, why: str, unsure: int
) -> None:
    near = [_sheet("S-21", "D.dwg"), _sheet("S-22", "D.dwg")]
    _lay_out(
        tmp_path,
        conflicts=_conflicts([_question(SAME_TITLE, _key("S-21", "D.dwg"), _key("S-22", "D.dwg"))]),
        truth=_truth(near_misses=[_near_miss("structural", why, near)]),
    )

    code, verdict = _judge(tmp_path)

    row = _row(verdict, "structural")
    assert _count(row, JUDGED) == 0
    assert _count(row, QS_VIEW) == 0
    assert _count(row, UNSURE) == unsure
    assert _count(_row(verdict, "architectural"), UNSURE) == 0
    assert _status(verdict) == "PASS"
    assert code == 0


# T6 -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "discipline", ["architectural", "electrical"], ids=["a-walked-discipline", "no-burden-row"]
)
def test_a_count_lands_on_its_groups_discipline_row_and_is_never_dropped(
    tmp_path: Path, discipline: str
) -> None:
    sheets = [_sheet("X-1", "E.dwg"), _sheet("X-2", "E.dwg")]
    _lay_out(
        tmp_path,
        conflicts=_conflicts([_question(SAME_TITLE, _key("X-1", "E.dwg"), _key("X-2", "E.dwg"))]),
        truth=_truth([*_standard_groups(), _group(discipline, "same", sheets)]),
    )

    code, verdict = _judge(tmp_path)

    counted = _row(verdict, discipline)
    assert _count(counted, JUDGED) == 1
    assert _count(counted, QS_VIEW) == 1
    for other in {"structural", "architectural"} - {discipline}:
        assert _count(_row(verdict, other), JUDGED) == 0, other
    if discipline == "electrical":  # added as a zero row, the count on it
        assert counted["sheets"] == 0
        assert counted["questions_total"] == 0
        assert counted["continuation_questions"] == 0
        assert _count(counted, UNSURE) == 0
    assert _status(verdict) == "FAIL"
    assert code == 1


# T7 -----------------------------------------------------------------------------------------------

MEASURABLE = [_question(SAME_TITLE, _key("S-7", "B.dwg"), _key("S-8", "B.dwg"))]


def _stale(case: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """T2's measurable layout (conflicts, truth), broken in one way that makes it unmeasurable."""
    conflicts: dict[str, Any] | None = _conflicts(copy.deepcopy(MEASURABLE))
    truth: dict[str, Any] | None = _truth()
    match case:
        case "no-conflicts-file":
            conflicts = None
        case "another-walks-sha":
            conflicts = _conflicts(copy.deepcopy(MEASURABLE), sha=OTHER_SHA)
        case "another-walks-started-at":
            conflicts = _conflicts(copy.deepcopy(MEASURABLE), started_at=EARLIER)
        case "conflicts-schema-2":
            conflicts = _conflicts(copy.deepcopy(MEASURABLE), schema=2)
        case "no-truth-file":
            truth = None
        case "the-set-not-in-the-truth":
            truth = _truth(slug="set-b")
        case "truth-schema-3":
            truth = _truth(schema=3)
        case "a-null-proposal":
            conflicts = _conflicts([_question(SAME_TITLE, _key("S-7", "B.dwg"), None)])
        case "a-number-that-is-not-text":
            bad: dict[str, Any] = {"file": "B.dwg", "number": 8, "plot_page": None}
            conflicts = _conflicts([_question(SAME_TITLE, _key("S-7", "B.dwg"), bad)])
        case "a-proposal-without-its-file":
            bad = {"number": "S-8", "plot_page": None}
            conflicts = _conflicts([_question(SAME_TITLE, _key("S-7", "B.dwg"), bad)])
        case _:
            raise AssertionError(case)
    return conflicts, truth


STALE = [
    "no-conflicts-file",
    "another-walks-sha",
    "another-walks-started-at",
    "conflicts-schema-2",
    "no-truth-file",
    "the-set-not-in-the-truth",
    "truth-schema-3",
    "a-null-proposal",
    "a-number-that-is-not-text",
    "a-proposal-without-its-file",
]


@pytest.mark.parametrize("case", STALE)
def test_what_cannot_be_measured_stays_null_and_fails_where_the_same_walk_measured_passes(
    tmp_path: Path, case: str
) -> None:
    measured_root, stale_root = tmp_path / "measured", tmp_path / "stale"
    _lay_out(measured_root, conflicts=_conflicts(copy.deepcopy(MEASURABLE)), truth=_truth())
    conflicts, truth = _stale(case)
    _lay_out(stale_root, conflicts=conflicts, truth=truth)

    measured_code, measured = _judge(measured_root)
    stale_code, stale = _judge(stale_root)

    assert _count(_row(measured, "structural"), JUDGED) == 0, "the measurable walk was not counted"
    assert _status(measured) == "PASS"
    assert measured_code == 0
    for discipline in ("structural", "architectural"):
        row = _row(stale, discipline)
        assert row[JUDGED] is None, f"{case}: {discipline} was counted from what cannot be measured"
        assert row.get(QS_VIEW) is None, case
        assert row.get(UNSURE) is None, case
    assert _status(stale) == "FAIL"
    assert stale["result"] == "FAIL"
    assert stale_code == 1


def test_a_walk_that_claims_zero_does_not_win_over_the_count(tmp_path: Path) -> None:
    _lay_out(
        tmp_path,
        walk=_walk(false=0),
        conflicts=_conflicts(
            [_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-2", plot_page=2))]
        ),
        truth=_truth(),
    )

    code, verdict = _judge(tmp_path)

    assert _count(_row(verdict, "structural"), JUDGED) == 1
    assert _status(verdict) == "FAIL"
    assert code == 1


# T8 -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize("schema", [1, 2], ids=["schema-1", "schema-2-file-sheets"])
def test_only_counts_leave_the_truth_and_the_keys(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], schema: int
) -> None:
    from scripts.walk import run

    marked_number = f"S-2 {PLANTED_NOTE}"
    group = [_sheet("S-1", PLANTED_FILE), _sheet(marked_number, PLANTED_FILE)]
    near = [_sheet(PLANTED_DISCIPLINE, PLANTED_FILE), _sheet("S-9", PLANTED_FILE)]
    folder = _lay_out(
        tmp_path,
        conflicts=_conflicts(
            [
                _question(SAME_TITLE, _key("S-1", PLANTED_FILE), _key(marked_number, PLANTED_FILE)),
                _question(
                    SAME_STOREY, _key(PLANTED_DISCIPLINE, PLANTED_FILE), _key("S-9", PLANTED_FILE)
                ),
            ]
        ),
        truth=_truth(
            [_group("structural", "same", group, title=PLANTED_TITLE)],
            [_near_miss("structural", "unsure", near)],
            method=PLANTED_QUESTION,
            schema=schema,
            # At schema 2, file_sheets maps the planted file name to every true number in it, a
            # planted number held only there among them.
            extra_numbers={PLANTED_FILE: [PLANTED_PATH]},
        ),
    )

    passed = run.judge_checks(tmp_path, _plan(tmp_path), run.Events(tmp_path, SHA[:8]))
    code, verdict = _judge(tmp_path)
    printed = capsys.readouterr()

    row = _row(verdict, "structural")
    assert _count(row, JUDGED) == 1, "nothing was measured, so nothing could leak"
    assert _count(row, UNSURE) == 1
    assert passed is False
    assert code == 1
    events = _events(tmp_path)
    assert "check questions_per_discipline FAIL" in events
    outputs = {
        "verdict.json": (folder / "verdict.json").read_text(),
        "public/summary.json": (folder / "public" / "summary.json").read_text(),
        "events.log": events,
        "stdout": printed.out,
        "stderr": printed.err,
    }
    for name, text in outputs.items():
        assert has_planted(text) == [], f"{name} carries a planted marker"


# Amendment 1: schema 2's file_sheets --------------------------------------------------------------
#
# A group with no Plot (no plot pages) cannot tell a misread number (S-O3 for S-3) from a real sheet
# outside the group by plot page. Schema 2's `file_sheets` lists every true sheet number in each file
# that holds a group sheet: a Proposal in such a file whose number is not listed (or is null) may be a
# misread group sheet, so its set cannot be measured; a listed number outside every group is a real
# outside sheet, and the Question spanning it counts none.

PAGE_LESS = [_sheet(f"S-{n}", "G.dwg") for n in (1, 2, 3)]
OUTSIDE_NUMBER = "S-4"  # a true sheet of G.dwg in no group
MISREAD_NUMBER = "S-O3"  # in no list: S-3 misread


def _page_less_truth(**given: Any) -> dict[str, Any]:
    """Schema 2: the page-less `same` group in G.dwg and the standard group in C.dwg."""
    return _truth(
        [_group("structural", "same", PAGE_LESS), _group("structural", "same", GROUP_TWO)],
        schema=2,
        **{"extra_numbers": {"G.dwg": [OUTSIDE_NUMBER]}, **given},
    )


def _spanning(code: str, number: str | None) -> dict[str, Any]:
    """Two sheets of the page-less group and a third Proposal in G.dwg with `number`."""
    third: dict[str, Any] = {"file": "G.dwg", "number": number, "plot_page": None}
    return _question(code, _key("S-1", "G.dwg"), _key("S-2", "G.dwg"), third)


def _assert_measured_zero(verdict: dict[str, Any], code: int) -> None:
    for discipline in ("structural", "architectural"):
        assert _count(_row(verdict, discipline), JUDGED) == 0, f"{discipline} was not measured as 0"
    assert _status(verdict) == "PASS"
    assert code == 0


def _assert_unmeasured(verdict: dict[str, Any], code: int, why: str) -> None:
    for discipline in ("structural", "architectural"):
        row = _row(verdict, discipline)
        assert row[JUDGED] is None, f"{why}: {discipline} was counted"
        assert row.get(QS_VIEW) is None, why
        assert row.get(UNSURE) is None, why
    assert _status(verdict) == "FAIL"
    assert code == 1


@pytest.mark.parametrize("code", [SAME_TITLE, SAME_STOREY], ids=["same-title", "same-storey"])
@pytest.mark.parametrize(
    "number", [MISREAD_NUMBER, None], ids=["a-number-not-in-file-sheets", "a-null-number"]
)
def test_schema_2_a_page_less_group_with_a_number_its_file_does_not_hold_is_unmeasured(
    tmp_path: Path, code: str, number: str | None
) -> None:
    outside_root, doubt_root = tmp_path / "outside", tmp_path / "doubt"
    _lay_out(
        outside_root,
        conflicts=_conflicts([_spanning(code, OUTSIDE_NUMBER)]),
        truth=_page_less_truth(),
    )
    _lay_out(doubt_root, conflicts=_conflicts([_spanning(code, number)]), truth=_page_less_truth())

    outside_code, outside = _judge(outside_root)
    doubt_code, doubt = _judge(doubt_root)

    _assert_measured_zero(outside, outside_code)
    _assert_unmeasured(doubt, doubt_code, f"a third Proposal numbered {number!r}")


@pytest.mark.parametrize("code", [SAME_TITLE, SAME_STOREY], ids=["same-title", "same-storey"])
def test_schema_2_a_real_sheet_outside_the_group_counts_none_and_the_set_stays_measured(
    tmp_path: Path, code: str
) -> None:
    _lay_out(
        tmp_path,
        conflicts=_conflicts([_spanning(code, OUTSIDE_NUMBER)]),
        truth=_page_less_truth(),
    )

    exit_code, verdict = _judge(tmp_path)

    _assert_measured_zero(verdict, exit_code)
    assert _count(_row(verdict, "structural"), QS_VIEW) == 0


@pytest.mark.parametrize(
    "broken",
    [
        {"file_sheets": {"C.dwg": ["S-11", "S-12"]}},
        {"without_file_sheets": True},
    ],
    ids=["a-group-file-missing-from-file-sheets", "no-file-sheets"],
)
def test_schema_2_file_sheets_without_every_group_file_is_malformed_and_unmeasured(
    tmp_path: Path, broken: dict[str, Any]
) -> None:
    whole_root, broken_root = tmp_path / "whole", tmp_path / "broken"
    question = _spanning(SAME_TITLE, OUTSIDE_NUMBER)
    _lay_out(whole_root, conflicts=_conflicts([question]), truth=_page_less_truth())
    _lay_out(broken_root, conflicts=_conflicts([question]), truth=_page_less_truth(**broken))

    whole_code, whole = _judge(whole_root)
    broken_code, broken_verdict = _judge(broken_root)

    _assert_measured_zero(whole, whole_code)
    _assert_unmeasured(broken_verdict, broken_code, "a malformed file_sheets")


SCHEMA_2_LAYOUTS: dict[str, tuple[list[dict[str, Any]], dict[str, Any], dict[str, int]]] = {
    "one-false-continuation": (
        [_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-2", plot_page=2))],
        {},
        {JUDGED: 1, QS_VIEW: 1, UNSURE: 0},
    ),
    "sheets-in-no-group": (
        [_question(SAME_TITLE, _key("S-7", "B.dwg"), _key("S-8", "B.dwg"))],
        {},
        {JUDGED: 0, QS_VIEW: 0, UNSURE: 0},
    ),
    "a-mark-range-group": (
        [_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-2", plot_page=2))],
        {"groups": [_group("structural", "mark_range", GROUP_ONE)]},
        {JUDGED: 0, QS_VIEW: 1, UNSURE: 0},
    ),
    "an-unsure-near-miss": (
        [_question(SAME_TITLE, _key("S-21", "D.dwg"), _key("S-22", "D.dwg"))],
        {
            "near_misses": [
                _near_miss("structural", "unsure", [_sheet("S-21", "D.dwg"), _sheet("S-22", "D.dwg")])
            ]
        },
        {JUDGED: 0, QS_VIEW: 0, UNSURE: 1},
    ),
}


@pytest.mark.parametrize("layout", sorted(SCHEMA_2_LAYOUTS))
def test_schema_2_counts_as_schema_1_where_no_number_is_in_doubt(tmp_path: Path, layout: str) -> None:
    questions, truth_given, want = SCHEMA_2_LAYOUTS[layout]
    _lay_out(
        tmp_path,
        conflicts=_conflicts(copy.deepcopy(questions)),
        truth=_truth(schema=2, **copy.deepcopy(truth_given)),
    )

    code, verdict = _judge(tmp_path)

    row = _row(verdict, "structural")
    for key, value in want.items():
        assert _count(row, key) == value, f"{layout}: {key}"
    assert _status(verdict) == ("FAIL" if want[JUDGED] else "PASS")
    assert code == (1 if want[JUDGED] else 0)


# T9 -----------------------------------------------------------------------------------------------


def _plan(root: Path) -> Any:
    """A Plan by hand (as T-WALK-1's tests build it): no git, its out_dir the laid-out walk folder."""
    from scripts.walk import run

    walks, _ = _folders(root)
    db = f"vextrus_walk_{SHA[:8]}"
    return run.Plan(
        sha=SHA,
        sha8=SHA[:8],
        db_name=db,
        out_dir=walks / SHA,
        worktree=walks / "_src",
        web_port=5511,
        api_port=8811,
        env={
            "VEXTRUS_DB_NAME": db,
            "VEXTRUS_WEB_PORT": "5511",
            "VEXTRUS_API_URL": "http://127.0.0.1:8811",
        },
    )


def _events(root: Path) -> str:
    return (root / ".private" / "work" / "factory" / "events.log").read_text()


@pytest.mark.parametrize(
    ("walked", "question", "status"),
    [
        (None, _question(SAME_TITLE, _key("S-7", "B.dwg"), _key("S-8", "B.dwg")), "PASS"),
        (0, _question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-2", plot_page=2)), "FAIL"),
    ],
    ids=["none-false-pass", "one-false-fail"],
)
def test_the_script_layer_logs_the_check_from_the_same_count(
    tmp_path: Path, walked: int | None, question: dict[str, Any], status: str
) -> None:
    from scripts.walk import run

    _lay_out(tmp_path, walk=_walk(false=walked), conflicts=_conflicts([question]), truth=_truth())

    passed = run.judge_checks(tmp_path, _plan(tmp_path), run.Events(tmp_path, SHA[:8]))

    lines = _events(tmp_path).splitlines()
    assert f"{FINISHED} WALK - {SHA[:8]} check questions_per_discipline {status}" in lines, lines
    assert passed is (status == "PASS")


# T10 ----------------------------------------------------------------------------------------------


def test_set_aside_moves_conflicts_json_and_never_overwrites_an_earlier_move(tmp_path: Path) -> None:
    from scripts.walk import run

    folder = tmp_path / "walks" / SHA
    folder.mkdir(parents=True)
    for walk_n in (1, 2):
        path = folder / "conflicts.json"
        path.write_text(json.dumps({"synthetic": f"conflicts of walk {walk_n}"}))
        os.utime(path, (FIXED_MTIME, FIXED_MTIME))
        run.set_aside(folder)

    assert not (folder / "conflicts.json").exists(), "conflicts.json was not set aside"
    dated = sorted(p for p in folder.glob("conflicts.*.json") if p.name != "conflicts.json")
    kept = sorted(json.loads(p.read_text())["synthetic"] for p in dated)
    assert kept == ["conflicts of walk 1", "conflicts of walk 2"], kept


# T11 ----------------------------------------------------------------------------------------------


def _verdict_with(qs_view: object, unsure: object) -> dict[str, Any]:
    """A contract verdict (f5's evaluate on a walk that claims 0) whose rows carry the two fields."""
    from scripts.walk.verdict import evaluate

    judged: dict[str, Any] = evaluate(
        _walk(false=0),
        {SET: _expect()},
        _layer(),
        ref="main",
        started_at=STARTED,
        finished_at=FINISHED,
        leak_hits=0,
    )
    for row in judged["burden"]:
        row[QS_VIEW] = qs_view
        row[UNSURE] = unsure
    return judged


def test_the_contract_takes_the_two_informational_counts() -> None:
    from scripts.walk.schema import verdict_errors

    assert verdict_errors(_verdict_with(None, None)) == []
    for qs_view, unsure in ((2, 1), (0, 0)):
        given = _verdict_with(qs_view, unsure)
        assert verdict_errors(given) == [], (qs_view, unsure)
        assert_valid_verdict(given)
    assert verdict_errors(_verdict_with(PLANTED_NOTE, 0)) != [], "a word passed as a count"
    assert verdict_errors(_verdict_with(0, -1)) != [], "a negative count passed"
    old = _verdict_with(None, None)
    for row in old["burden"]:
        del row[QS_VIEW], row[UNSURE]
    assert verdict_errors(old) == [], "an older verdict without the fields broke the contract"


def test_the_public_summary_keeps_the_two_counts_as_numbers_only() -> None:
    from scripts.walk.sanitize import sanitize_walk

    summary = sanitize_walk(_verdict_with(2, 1))
    assert summary["burden"], summary
    for row in summary["burden"]:
        assert row[QS_VIEW] == 2, row
        assert row[UNSURE] == 1, row

    marked = sanitize_walk(_verdict_with(PLANTED_NOTE, PLANTED_TITLE))
    assert has_planted(marked) == []
    for row in marked["burden"]:
        assert row.get(QS_VIEW) is None, row
        assert row.get(UNSURE) is None, row


def test_attach_returns_a_counted_copy_and_leaves_the_walk_as_it_was(tmp_path: Path) -> None:
    continuations = importlib.import_module("scripts.walk.continuations")
    folder = _lay_out(
        tmp_path,
        conflicts=_conflicts(
            [_question(SAME_TITLE, _key("S-1", plot_page=1), _key("S-2", plot_page=2))]
        ),
        truth=_truth(),
    )
    _, expect_dir = _folders(tmp_path)
    walk = json.loads((folder / "walk.json").read_text())
    before = copy.deepcopy(walk)

    counted = continuations.attach(walk, folder, expect_dir)

    assert walk == before, "attach changed the walk it was given"
    rows = counted["sets"][SET]["burden"]
    assert rows["structural"][JUDGED] == 1
    assert rows["structural"][QS_VIEW] == 1
    assert rows["structural"][UNSURE] == 0
    assert rows["architectural"][JUDGED] == 0
    assert counted["sets"][SET]["files"] == before["sets"][SET]["files"]


# T12 ----------------------------------------------------------------------------------------------

SPEC = Path(__file__).resolve().parents[4] / "web" / "e2e" / "real" / "walk.spec.ts"


def test_the_walk_spec_writes_conflicts_json_where_walk_conflicts_says() -> None:
    text = SPEC.read_text()

    assert "WALK_CONFLICTS" in text, "walk.spec.ts does not read WALK_CONFLICTS"
    assert text.count("started_at") >= 2, "conflicts.json carries no started_at"
    for key in ("file_name", "plot_page", "proposals"):
        assert key in text, f"walk.spec.ts does not resolve a Proposal's {key}"


def test_run_walk_spec_sets_walk_conflicts_to_the_walks_conflicts_json(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import run

    seen: dict[str, str] = {}

    class Playwright:
        """Popen's stand-in: records the environment, runs nothing."""

        pid = -1

        def __init__(self, args: list[str], **kwargs: Any) -> None:
            seen.update(kwargs["env"])

        def wait(self, timeout: float | None = None) -> int:
            return 0

    monkeypatch.setattr(subprocess, "Popen", Playwright)
    monkeypatch.setattr(run, "end_groups", lambda *args, **kwargs: None)
    walk = _plan(tmp_path)
    (walk.out_dir / "logs").mkdir(parents=True)

    code = run.walk_spec(tmp_path, walk, "synthetic", {SET: []}, smoke=False, started_at=STARTED)

    assert code == 0
    walk_conflicts = seen.get("WALK_CONFLICTS")  # never the whole environment in a message
    assert walk_conflicts == str(walk.out_dir / "conflicts.json"), "WALK_CONFLICTS is not the walk's"
