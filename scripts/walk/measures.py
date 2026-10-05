"""G1's burden, measured from the snapshot the walk took before any act (docs/specs/factory.md 5 "G1").

`web/e2e/real/walk.spec.ts` reads each set into a Project no act touches and, when its last read ends,
writes `<walks>/<sha>/snapshot.json` (private, never in git):

    {"schema": 1, "sha", "started_at", "sets": {<slug>: {"acts_before_snapshot": 0,
      "sheets": [{"id", "file", "number", "title", "discipline", "layout", "proposed_exclusion",
                  "held", "agrees", "storeys", "storeys_titled"}],
      "questions": [{"id", "kind", "status", "code", "check_code", "discipline", "proposals"}],
      "bulk_after_gaps": {<discipline>: <Sheets that agree and are not held, after the walk
                          answered each open numbering-gap Question once>}}}}

`attach(walk, folder, expect)` returns a copy of `walk` in which every set the snapshot measures has
its Questions by kind and its burden rows counted from the snapshot, each row with `sheets_expected`
(the expectation's N, or null), `machine_doubt_questions`, `continuation_questions` and
`false_continuation_questions`, and `measures` (`unmeasured` 0, `true_listed`, `true_raised`,
`stale_grouped`, `storeys_listed`, `storeys_wrong`). A set it cannot measure (no snapshot, another
walk's, a set not in it, an act before it, a Question holding an unknown Sheet, any malformed entry)
gets `measures = {"unmeasured": 1}` and keeps its rows as the walk wrote them; verdict.py fails its
snapshot checks closed. `expect` is the set expectations by slug (verdict.py refuses a malformed one;
here a shape that cannot be read leaves the set unmeasured). Nothing leaves this module but counts:
never a file name, a Sheet number, a title or a storey.

The rules (the owner's Q5 refined limits, 5 Oct 2026):
- a Question matches a listed true Question when its `code` or `check_code` is the listed code, its
  Discipline is the listed one and it holds a Sheet for every listed `{file, number}`;
- false: open Questions coded `same_title`, `same_storey` or `same_number` matching no listed one;
- machine doubt per Discipline: open Questions matching no listed one, numbering-gap Questions once
  per file (the file of the first Sheet held; one holding none counts as its own);
- bulk-confirmable per Discipline: Sheets that agree and are not held, or, where a gap Question is
  open, `bulk_after_gaps` (absent: that row's count is null, the share unmeasured);
- stale: listed pairs of equal titles (case and spacing folded) that no Question holds together (a
  listed Sheet absent from the snapshot cannot be shown grouped: it counts);
- storeys: the Views' union, else the as-titled storeys (`not_stated` is none); a listed Sheet absent
  is wrong.
"""

import copy
import json
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCHEMA = 1
SNAPSHOT_NAME = "snapshot.json"
SAME_TITLE = "engine.conflicts.same_title"
SAME_STOREY = "engine.conflicts.same_storey"
SAME_NUMBER = "engine.conflicts.same_number"
CONTINUATION_CODES = frozenset({SAME_TITLE, SAME_STOREY})
CONFLICT_CODES = frozenset({SAME_TITLE, SAME_STOREY, SAME_NUMBER})
GAP_CODES = frozenset({"engine.register_check.gap", "engine.register_check.gaps"})
"""A numbering gap, asked per missing number or (t229) all of a Discipline's at once."""
OPEN = "open"
NOT_STATED = frozenset({"not_stated"})
"""The storey code of a title that states none (engine/recognise/storeys.py): no storey."""
STATUSES = frozenset({OPEN, "answered", "withdrawn"})
"""The product's Question statuses; any other leaves the set unmeasured (it would vanish from every
count, and a Question must never pass unseen)."""
NONE = "none"
"""The burden row of Sheets and Questions with no Discipline."""
DISCIPLINE = re.compile(r"[a-z][a-z0-9_]{1,24}")
KIND = re.compile(r"[a-z][a-z0-9_]{0,39}")
TEXT_LIMIT = 500
"""Longer text in a snapshot is not a product value: the set is unmeasured."""
MEASURES = (
    "unmeasured",
    "true_listed",
    "true_raised",
    "stale_grouped",
    "storeys_listed",
    "storeys_wrong",
)
UNMEASURED = {"unmeasured": 1}
REPLACED = ("false_continuation_questions_qs_view", "continuation_questions_unsure")
"""T-WALK-3's informational counts, retired with its rule."""


class Unmeasurable(ValueError):
    """A snapshot, or one set of it, that cannot be measured with certainty."""


@dataclass(frozen=True)
class Sheet:
    id: str
    file: str
    number: str | None
    title: str | None
    discipline: str
    held: bool
    agrees: bool
    storeys: frozenset[str]
    storeys_titled: frozenset[str] | None


@dataclass(frozen=True)
class Question:
    id: str
    kind: str
    status: str
    code: str
    check_code: str | None
    discipline: str
    proposals: tuple[str, ...]

    @property
    def open(self) -> bool:
        return self.status == OPEN

    @property
    def gap(self) -> bool:
        return self.code in GAP_CODES or self.check_code in GAP_CODES


@dataclass(frozen=True)
class SetSnapshot:
    sheets: Mapping[str, Sheet]
    questions: tuple[Question, ...]
    bulk_after_gaps: Mapping[str, int]


Key = tuple[str, str]
"""A listed Sheet: (file, number)."""


# Reading ------------------------------------------------------------------------------------------


def _text(value: object, *, optional: bool = False) -> str | None:
    """Text; where it is optional, null or "" (the API's untitled Sheet, an older snapshot) is None."""
    if optional and (value is None or value == ""):
        return None
    if not isinstance(value, str) or not value or len(value) > TEXT_LIMIT:
        raise Unmeasurable("a value is not text")
    return value


def _flag(value: object) -> bool:
    if not isinstance(value, bool):
        raise Unmeasurable("a value is not true or false")
    return value


def _discipline(value: object) -> str:
    """A Discipline key as its burden row's name; no Discipline is `none`."""
    if value is None:
        return NONE
    if not isinstance(value, str) or not DISCIPLINE.fullmatch(value) or value == NONE:
        raise Unmeasurable("a Discipline is not a Discipline key")
    return value


def _row_key(value: object) -> str:
    """A burden row's name as the walk writes it: a Discipline key, or `none`."""
    return NONE if value == NONE else _discipline(value)


def _storeys(value: object, *, optional: bool = False) -> frozenset[str] | None:
    if value is None and optional:
        return None
    if not isinstance(value, list):
        raise Unmeasurable("storeys are not a list")
    return frozenset(str(_text(s)) for s in value)


def _count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise Unmeasurable("a count is not a count")
    return value


SHEET_KEYS = frozenset(
    {
        "id",
        "file",
        "number",
        "title",
        "discipline",
        "layout",
        "proposed_exclusion",
        "held",
        "agrees",
        "storeys",
        "storeys_titled",
    }
)
QUESTION_KEYS = frozenset({"id", "kind", "status", "code", "check_code", "discipline", "proposals"})


def _sheet(raw: object) -> Sheet:
    if not isinstance(raw, Mapping) or set(raw) != SHEET_KEYS:
        raise Unmeasurable("a Sheet is not its keys")
    _flag(raw["layout"])
    _text(raw["proposed_exclusion"], optional=True)
    return Sheet(
        id=str(_text(raw["id"])),
        file=str(_text(raw["file"])),
        number=_text(raw["number"], optional=True),
        title=_text(raw["title"], optional=True),
        discipline=_discipline(raw["discipline"]),
        held=_flag(raw["held"]),
        agrees=_flag(raw["agrees"]),
        storeys=_storeys(raw["storeys"]) or frozenset(),
        storeys_titled=_storeys(raw["storeys_titled"], optional=True),
    )


def _status(value: object) -> str:
    if not isinstance(value, str) or value not in STATUSES:
        raise Unmeasurable("a Question's status is not the product's")
    return value


def _question(raw: object, ids: Mapping[str, Sheet]) -> Question:
    if not isinstance(raw, Mapping) or set(raw) != QUESTION_KEYS:
        raise Unmeasurable("a Question is not its keys")
    kind = raw["kind"]
    if not isinstance(kind, str) or not KIND.fullmatch(kind):
        raise Unmeasurable("a Question kind is not a kind code")
    proposals = raw["proposals"]
    if not isinstance(proposals, list):
        raise Unmeasurable("a Question's Sheets are not a list")
    held = tuple(str(_text(p)) for p in proposals)
    if any(p not in ids for p in held):
        raise Unmeasurable("a Question holds a Sheet the snapshot does not have")
    return Question(
        id=str(_text(raw["id"])),
        kind=kind,
        status=_status(raw["status"]),
        code=str(_text(raw["code"])),
        check_code=_text(raw["check_code"], optional=True),
        discipline=_discipline(raw["discipline"]),
        proposals=held,
    )


def parse_set(entry: object) -> SetSnapshot:
    """One set's snapshot entry; raises Unmeasurable when it is malformed or an act came before it."""
    if not isinstance(entry, Mapping):
        raise Unmeasurable("a set's snapshot is not an object")
    if _count(entry.get("acts_before_snapshot")) != 0:
        raise Unmeasurable("an act came before the snapshot")
    raw_sheets, raw_questions = entry.get("sheets"), entry.get("questions")
    if not isinstance(raw_sheets, list) or not isinstance(raw_questions, list):
        raise Unmeasurable("a set's Sheets or Questions are not a list")
    sheets: dict[str, Sheet] = {}
    for raw in raw_sheets:
        found = _sheet(raw)
        if found.id in sheets:
            raise Unmeasurable("two Sheets share an id")
        sheets[found.id] = found
    questions = tuple(_question(raw, sheets) for raw in raw_questions)
    after = entry.get("bulk_after_gaps", {})
    if not isinstance(after, Mapping):
        raise Unmeasurable("bulk_after_gaps is not counts by Discipline")
    bulk_after = {_row_key(key): _count(value) for key, value in after.items()}
    return SetSnapshot(sheets, questions, bulk_after)


def load_snapshot(folder: Path, walk: Mapping[str, Any]) -> Mapping[str, Any]:
    """The snapshot's set entries by slug, unparsed (each is parsed alone: a malformed one leaves only
    its set unmeasured); raises when the file cannot be read, is not schema 1 or is another walk's."""
    raw = json.loads((folder / SNAPSHOT_NAME).read_text(encoding="utf-8"))
    if (
        not isinstance(raw, Mapping)
        or raw.get("schema") != SCHEMA
        or isinstance(raw.get("schema"), bool)
    ):
        raise Unmeasurable("snapshot.json is not schema 1")
    for key in ("sha", "started_at"):
        if not isinstance(raw.get(key), str) or raw.get(key) != walk.get(key):
            raise Unmeasurable("snapshot.json is another walk's")
    sets = raw.get("sets")
    if not isinstance(sets, Mapping):
        raise Unmeasurable("snapshot.json has no sets")
    return sets


# The rules ----------------------------------------------------------------------------------------


def _keys(raw: object) -> list[Key]:
    if not isinstance(raw, list):
        raise Unmeasurable("listed Sheets are not a list")
    keys = []
    for sheet in raw:
        if not isinstance(sheet, Mapping):
            raise Unmeasurable("a listed Sheet is not an object")
        keys.append((str(_text(sheet.get("file"))), str(_text(sheet.get("number")))))
    return keys


def _holding(snap: SetSnapshot, key: Key) -> set[str]:
    """The ids of the snapshot's Sheets with this file and number."""
    return {s.id for s in snap.sheets.values() if (s.file, s.number) == key}


@dataclass(frozen=True)
class TrueQuestion:
    discipline: str
    code: str
    sheets: tuple[frozenset[str], ...]
    """Per listed Sheet, the ids of the snapshot's Sheets it may be."""


def true_questions(snap: SetSnapshot, listed: object) -> list[TrueQuestion]:
    if not isinstance(listed, list):
        raise Unmeasurable("true_questions is not a list")
    found = []
    for entry in listed:
        if not isinstance(entry, Mapping):
            raise Unmeasurable("a true Question is not an object")
        sheets = tuple(frozenset(_holding(snap, key)) for key in _keys(entry.get("sheets")))
        found.append(
            TrueQuestion(_discipline(entry.get("discipline")), str(_text(entry.get("code"))), sheets)
        )
    return found


def matches(question: Question, listed: TrueQuestion) -> bool:
    """Its code (or check code) and Discipline the listed ones, holding a Sheet for every listed one."""
    if listed.code not in (question.code, question.check_code):
        return False
    held = set(question.proposals)
    return question.discipline == listed.discipline and all(ids & held for ids in listed.sheets)


def true_raised(snap: SetSnapshot, listed: list[TrueQuestion]) -> int:
    open_ = [q for q in snap.questions if q.open]
    return sum(1 for t in listed if any(matches(q, t) for q in open_))


def is_true(question: Question, listed: list[TrueQuestion]) -> bool:
    return any(matches(question, t) for t in listed)


def false_by_discipline(snap: SetSnapshot, listed: list[TrueQuestion]) -> dict[str, int]:
    """Open conflict Questions on no true list, however many Sheets or series they span."""
    found: dict[str, int] = {}
    for q in snap.questions:
        if q.open and q.code in CONFLICT_CODES and not is_true(q, listed):
            found[q.discipline] = found.get(q.discipline, 0) + 1
    return found


def continuations_by_discipline(snap: SetSnapshot) -> dict[str, int]:
    """Open same_title and same_storey Questions, true or false (informational)."""
    found: dict[str, int] = {}
    for q in snap.questions:
        if q.open and q.code in CONTINUATION_CODES:
            found[q.discipline] = found.get(q.discipline, 0) + 1
    return found


def machine_doubt_by_discipline(snap: SetSnapshot, listed: list[TrueQuestion]) -> dict[str, int]:
    """Open Questions on no true list; numbering gaps once per file of their first Sheet."""
    found: dict[str, int] = {}
    gap_files: dict[str, set[str]] = {}
    for q in snap.questions:
        if not q.open or is_true(q, listed):
            continue
        if q.gap and q.proposals:
            gap_files.setdefault(q.discipline, set()).add(snap.sheets[q.proposals[0]].file)
            continue
        found[q.discipline] = found.get(q.discipline, 0) + 1
    for discipline, files in gap_files.items():
        found[discipline] = found.get(discipline, 0) + len(files)
    return found


def stale_grouped(snap: SetSnapshot, pairs: object) -> int:
    """Listed pairs of equal titles that no Question of any kind, code or status holds together."""
    if not isinstance(pairs, list):
        raise Unmeasurable("stale_title_pairs is not a list")
    stale = 0
    for entry in pairs:
        if not isinstance(entry, Mapping):
            raise Unmeasurable("a stale-title pair is not an object")
        keys = _keys(entry.get("sheets"))
        if len(keys) != 2:
            raise Unmeasurable("a stale-title pair is not two Sheets")
        first, second = (_holding(snap, key) for key in keys)
        if not first or not second:
            stale += 1  # a listed Sheet absent cannot be shown grouped
            continue
        titles = {_folded(snap.sheets[i].title) for i in first} & {
            _folded(snap.sheets[i].title) for i in second
        }
        if not titles - {None}:
            continue
        held = any(first & set(q.proposals) and second & set(q.proposals) for q in snap.questions)
        stale += 0 if held else 1
    return stale


def _folded(title: str | None) -> str | None:
    return None if title is None else " ".join(title.split()).casefold()


def storeys_wrong(snap: SetSnapshot, listed: object) -> tuple[int, int]:
    """(listed, wrong): a listed Sheet is right when a Sheet of its file and number has its storeys
    (the Views' union, else the as-titled storeys), order ignored."""
    if not isinstance(listed, list):
        raise Unmeasurable("storeys is not a list")
    wrong = 0
    for entry in listed:
        if not isinstance(entry, Mapping):
            raise Unmeasurable("a storeys entry is not an object")
        (key,) = _keys([entry])
        want = _storeys(entry.get("storeys"))
        candidates = [snap.sheets[i] for i in _holding(snap, key)]
        if not any(_product_storeys(s) == want for s in candidates):
            wrong += 1
    return len(listed), wrong


def _product_storeys(sheet: Sheet) -> frozenset[str]:
    """The Views' storeys, else the as-titled ones; `not_stated` is no storey (so a View that states
    none falls back to the title)."""
    views = sheet.storeys - NOT_STATED
    return views or (sheet.storeys_titled or frozenset()) - NOT_STATED


def bulk_by_discipline(snap: SetSnapshot) -> dict[str, int | None]:
    """Sheets that agree and are not held; where a gap Question is open, the count after the walk
    answered it (None: not read, so not measured)."""
    gapped = {q.discipline for q in snap.questions if q.open and q.gap}
    agreeing: dict[str, int] = {}
    for sheet in snap.sheets.values():
        bulk = 1 if sheet.agrees and not sheet.held else 0
        agreeing[sheet.discipline] = agreeing.get(sheet.discipline, 0) + bulk
    found: dict[str, int | None] = {d: n for d, n in agreeing.items() if d not in gapped}
    for discipline in gapped:
        found[discipline] = snap.bulk_after_gaps.get(discipline)
    return found


# Attaching ----------------------------------------------------------------------------------------


def _sheets_per_discipline(raw: object) -> dict[str, int]:
    if raw is None:
        return {}
    if not isinstance(raw, Mapping):
        raise Unmeasurable("sheets_per_discipline is not counts by Discipline")
    return {_discipline(key): _count(value) for key, value in raw.items()}


def _measure(record: Mapping[str, Any], snap: SetSnapshot, expect: Mapping[str, Any]) -> dict[str, Any]:
    """The set record with its Questions, rows and measures counted from the snapshot."""
    listed = true_questions(snap, expect.get("true_questions", []))
    expected_n = _sheets_per_discipline(expect.get("sheets_per_discipline"))
    storeys_listed, wrong = storeys_wrong(snap, expect.get("storeys", []))
    stale = stale_grouped(snap, expect.get("stale_title_pairs", []))

    questions: dict[str, dict[str, int]] = {}
    for q in snap.questions:
        if q.open:
            kinds = questions.setdefault(q.discipline, {})
            kinds[q.kind] = kinds.get(q.kind, 0) + 1
    false = false_by_discipline(snap, listed)
    continuations = continuations_by_discipline(snap)
    doubt = machine_doubt_by_discipline(snap, listed)
    bulk = bulk_by_discipline(snap)

    burden_in = record.get("burden")
    burden: dict[str, dict[str, Any]] = (
        {key: dict(row) for key, row in burden_in.items() if isinstance(row, Mapping)}
        if isinstance(burden_in, Mapping)
        else {}
    )
    walked = record.get("questions")
    disciplines = set(burden) | set(questions) | set(expected_n) | set(bulk)
    disciplines |= set(walked) if isinstance(walked, Mapping) else set()
    disciplines |= {s.discipline for s in snap.sheets.values()}
    for discipline in disciplines:
        if not isinstance(discipline, str):
            raise Unmeasurable("a Discipline is not a key")
        of_discipline = [s for s in snap.sheets.values() if s.discipline == discipline]
        row = burden.setdefault(discipline, {})
        for gone in REPLACED:
            row.pop(gone, None)
        row.update(
            {
                "sheets": len(of_discipline),
                "one_source": sum(1 for s in of_discipline if not s.agrees),
                "bulk_confirmable": bulk.get(discipline, 0),
                "sheets_expected": expected_n.get(discipline),
                "machine_doubt_questions": doubt.get(discipline, 0),
                "continuation_questions": continuations.get(discipline, 0),
                "false_continuation_questions": false.get(discipline, 0),
            }
        )
    measures = {
        "unmeasured": 0,
        "true_listed": len(listed),
        "true_raised": true_raised(snap, listed),
        "stale_grouped": stale,
        "storeys_listed": storeys_listed,
        "storeys_wrong": wrong,
    }
    return {**record, "questions": questions, "burden": burden, "measures": measures}


def attach(walk: Any, folder: Path, expect: Mapping[str, Any]) -> Any:
    """A copy of `walk` with each set measured from `folder`'s snapshot.json by its expectation in
    `expect` (by slug); a set that cannot be measured gets `measures = {"unmeasured": 1}`."""
    measured = copy.deepcopy(walk)
    if not isinstance(measured, dict) or not isinstance(measured.get("sets"), dict):
        return measured
    try:
        entries: Mapping[str, Any] = load_snapshot(folder, measured)
    except OSError, ValueError, RecursionError:
        entries = {}  # nothing can be measured: every set is unmeasured
    expectations = expect if isinstance(expect, Mapping) else {}
    for slug, record in measured["sets"].items():
        if not isinstance(record, dict):
            continue
        set_expect = expectations.get(slug)
        try:
            if slug not in entries:
                raise Unmeasurable("the snapshot does not hold this set")
            snap = parse_set(entries[slug])
            measured["sets"][slug] = _measure(
                record, snap, set_expect if isinstance(set_expect, Mapping) else {}
            )
        except ValueError, KeyError, TypeError, RecursionError:
            record["measures"] = dict(UNMEASURED)
    return measured


def judged_rows(rows: Iterable[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    """The burden rows a Sheet count N judges (their Discipline is in the expectation)."""
    return [row for row in rows if row.get("sheets_expected") is not None]
