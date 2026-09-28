"""Conflicts (ticket 19b): candidates of one group that cannot all be right, and the continuations
that look like conflicts and are not. Found by code; 21c raises each Conflict as a `conflict` Question.
They are not Checks: nothing independent is compared (the M0 plan, "The Checks M0 brings").

    find(sheets, views, conventions)          # the harness's stage (engine/harness.py)
    compare(sheets, views, recognisers=...)   # the pure function, for 21c and the tests

`views[i]` are the views of `sheets[i]` (`()` where views were not read). Both return `Continuation`s,
then `Conflict`s by kind (`same_number`, `same_title`, `same_storey`), each in the order of its first
candidate in `sheets`, naming **the very objects given**: the export names candidates by identity, and
two equal-by-value copies of a sheet in two files are two sheets, so nothing here keys a dict or a set,
`in` or `.index()` by a candidate; everything goes by position.

**The rules** (a test each side of every edge, engine/recognise/tests/test_conflicts.py):
- **Within a group and a Discipline.** A sheet is compared only with sheets of its own group (the
  caller's stamp from its file: a second Building's S-101 is its own sheet) and its own Discipline. A
  sheet with no group is the caller's bug, and refused. A sheet with no Discipline, or without the
  number or title a comparison needs, sits out that comparison (its Question is 21c's `missing`).
- **One normal form** for numbers and titles (`normal`): NFKC, then Unicode's format characters
  dropped (category Cf: U+200B, U+00AD, U+FEFF and the rest), case folded, each run of whitespace one
  space, the ends trimmed: the real-drawing check's form for titles (scripts/real_drawings/diff.py),
  with the format characters it does not drop. What normalises to nothing is no title. Letters that
  only look alike stay different: a Cyrillic Es (U+0421) is not a Latin "C" (folding look-alikes
  would need a table of literals, and would join titles a drafter wrote differently). Titles arrive
  decoded (13, through 11's `engine.text.decode`) and are never decoded again.
- **`same_number`:** two or more sheets whose numbers have one normal form ("S-07" twice; "S-O1" is not
  "S-01"). One Conflict per number; evidence: the number as the first copy prints it, and the copies.
- **A continuation** ("Column schedule, 3 sheets"; no Question): sheets of one title whose numbers run
  on. A number is read only by 13's `sheets.sequence` (`Recognisers.sequence`), never here, and is
  given to it in its clean form (`clean`: the normal form before case folding). Two numbers
  run on when their prefixes and suffixes match (by their letters and digits, case folded) and their
  running numbers are one apart: "09"/"10", "S-09"/"S-10" and "9"/"10" (padding is no part of a
  running number); or when their running numbers match and their suffixes are single Latin letters one
  apart: "S-101A"/"S-101B". "S-101"/"S-101A" do not run on; a number with no running number (no digit,
  or one of `RUNNING_LIMIT` or more) runs on with none. Copies of one number are one place in a run.
- **`same_title`:** one title on places that do not all run on, or on two numbers that share one place
  (one running number printed two ways, "S-09" and "S-9": not copies, since their normal forms differ,
  and not two places): one Conflict naming every sheet of the title, in number order (a run among them
  is also a Continuation); evidence: the title as the first sheet draws it, and how many sheets.
  Copies of one number under one title are only `same_number`.
- **`same_storey`** (one storey drawn twice; the M0 plan's review Q3): plan views of one Discipline
  (their sheets'), one subject (known: none matches nothing) and one layer (none matches none: a beam
  plan has no layer) whose storey lists share a storey that is not symbolic ("typical", "top" and "not
  stated" are Step 3's to resolve: never a conflict on them alone; `Recognisers.symbolic`). Never two
  views of one sheet, or of one continuation, alone: the views must lie on two places or more. One
  Conflict per set of views: those sharing a storey, grouped by the set, so two plans overlapping on
  two floors are one Conflict. Evidence: the Discipline, subject and layer (`none` for none), the first
  storey they share (in the first view's order) and how many views.

**The work is linear** in sheets, views and storeys, plus sorting: candidates are grouped by keys and
never compared pairwise (10,000 sheets of one title are one group, not 50 million pairs), and each
number is read once.

**The trust boundary** (each refused with a `ValueError` or `TypeError`, so the stage fails, never
passes): `views` not one list per sheet; one sheet or view object given twice; a sheet with no group;
a candidate of the wrong type (a sheet in a list of views among them); a reader returning what 13's
contract does not allow.
"""

import unicodedata
from collections.abc import Callable, Collection, Hashable, Iterable, Sequence
from dataclasses import dataclass
from typing import NoReturn, Protocol

from engine.messages import conflicts as codes
from engine.recognise.types import (
    Conflict,
    Continuation,
    SheetCandidate,
    SheetConventions,
    Sourced,
    ViewCandidate,
    ViewKind,
)

RUNNING_LIMIT = 10**15
"""A running number this large or larger is no running number: every count made from running numbers
stays below 2**53, so a browser formats it exactly (a gap's count), and a running number is never too
long to print. A bound on what the code can say, not a threshold on what the drawings hold."""

SAME_NUMBER = "same_number"
SAME_TITLE = "same_title"
SAME_STOREY = "same_storey"
NO_LAYER = "none"


class NumberParts(Protocol):
    """What 13's `sheets.sequence` returns for a number with a running number."""

    @property
    def prefix(self) -> str: ...

    @property
    def running(self) -> int: ...

    @property
    def suffix(self) -> str: ...


@dataclass(frozen=True)
class Recognisers:
    """13's readers, bound to a set's conventions by the caller: how conflicts and Checks read a sheet
    number or a title's storeys (never with a parser of their own).

    Until 13 merges, tests pass hand-made stand-ins (engine/recognise/tests/stand_ins.py) and the
    harness path, `recognisers(conventions)`, raises `NotWired` when a reader is called.
    """

    sequence: Callable[[str], NumberParts | None]
    """A number's prefix, running number and suffix, or none (13's `sheets.sequence(number,
    conventions)`)."""
    storeys: Callable[[str], Collection[str]]
    """The canonical storey keys a sheet's title states, a symbolic end among them (13's
    `storeys.read(text, conventions, plan_title=True)`: its explicit list and its end)."""
    symbolic: Callable[[str], bool]
    """Whether a storey key is one Step 3 resolves (13's "typical", "top" and "not stated")."""


class NotWired(RuntimeError):
    """13's readers are not wired into the harness path yet (19b's part 2 wires them)."""


def recognisers(conventions: SheetConventions | None) -> Recognisers:
    """13's readers bound to `conventions`: how the harness's two 19b stages read.

    13 (sheet segmentation) builds `sheets.sequence(number, conventions)` and `storeys.read(text,
    conventions, *, plan_title)`, and 19b merges after it; its part 2 wires them here. Until then each
    reader raises `NotWired` when it is called, so a stage that needs one fails by name, while a set
    with no sheets, or a Check that reads neither, runs.
    """

    def not_wired(_: str) -> NoReturn:
        raise NotWired("13's sheets.sequence and storeys.read are not wired into 19b's stages yet")

    return Recognisers(sequence=not_wired, storeys=not_wired, symbolic=not_wired)


def find(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    conventions: SheetConventions | None,
) -> list[Conflict | Continuation]:
    """The harness's stage: `compare` with 13's readers bound to the conventions the sheets were read
    with (none only when the run has no sheet conventions, and then it has no sheets)."""
    if sheets and conventions is None:
        raise ValueError("sheets are compared under the conventions they were read with; none given")
    return compare(sheets, views, recognisers=recognisers(conventions))


def compare(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    *,
    recognisers: Recognisers,
) -> list[Conflict | Continuation]:
    """The set's Continuations and Conflicts, by the rules above."""
    given(sheets, views)
    numbers = [_normal(sheet.number) for sheet in sheets]
    titles = [_normal(sheet.title) for sheet in sheets]
    reader = _Reader(recognisers)
    places = _Places(len(sheets))  # where a sheet lies for `same_storey`: copies and runs are one

    by_number: list[tuple[int, Conflict]] = []
    for copies in _grouped(
        (i, (s.group, s.discipline.value, numbers[i]))
        for i, s in enumerate(sheets)
        if s.discipline is not None and numbers[i] is not None
    ):
        places.join(copies)
        if len(copies) > 1:
            number = sheets[copies[0]].number
            assert number is not None
            evidence = codes.SAME_NUMBER(number=number.value, copies=len(copies))["params"]
            candidates = tuple(sheets[i] for i in copies)
            by_number.append((copies[0], Conflict(SAME_NUMBER, candidates, evidence)))

    continuations: list[tuple[int, Continuation]] = []
    by_title: list[tuple[int, Conflict]] = []
    for group in _grouped(
        (i, (s.group, s.discipline.value, titles[i]))
        for i, s in enumerate(sheets)
        if s.discipline is not None and numbers[i] is not None and titles[i] is not None
    ):
        units = _grouped((i, numbers[i]) for i in group)
        if len(units) < 2:
            continue
        runs, shared = _runs(units, [reader.parts(sheets[unit[0]]) for unit in units])
        for run in runs:
            members = [i for unit in run for i in unit]
            places.join(members)
            if len(run) > 1:
                title = sheets[members[0]].title
                assert title is not None
                continuation = Continuation(title.value, tuple(sheets[i] for i in members))
                continuations.append((min(members), continuation))
        if len(runs) > 1 or shared:
            ordered = [i for run in runs for unit in run for i in unit]
            title = sheets[ordered[0]].title
            assert title is not None
            evidence = codes.SAME_TITLE(title=title.value, sheets=len(ordered))["params"]
            candidates = tuple(sheets[i] for i in ordered)
            by_title.append((min(ordered), Conflict(SAME_TITLE, candidates, evidence)))

    by_storey = _same_storey(sheets, views, places, reader)
    found: list[Conflict | Continuation] = [c for _, c in sorted(continuations, key=_first)]
    for batch in (by_number, by_title, by_storey):
        found.extend(conflict for _, conflict in sorted(batch, key=_first))
    return found


def _first(pair: tuple[int, object]) -> int:
    return pair[0]


def given(sheets: Sequence[SheetCandidate], views: Sequence[Sequence[ViewCandidate]]) -> None:
    """Refuse what the stage's contract does not allow: views not one list per sheet, a candidate of
    another type or given twice, a sheet with no group."""
    if len(views) != len(sheets):
        raise ValueError(f"{len(views)} lists of views for {len(sheets)} sheets: give one per sheet")
    seen: set[int] = set()
    for sheet, sheet_views in zip(sheets, views, strict=True):
        if not isinstance(sheet, SheetCandidate):
            raise TypeError(f"a sheet is a SheetCandidate, not {type(sheet).__name__}")
        if sheet.group is None:
            raise ValueError("a sheet has no group: its caller stamps each sheet with its file's group")
        for view in sheet_views:
            if not isinstance(view, ViewCandidate):
                raise TypeError(f"a view is a ViewCandidate, not {type(view).__name__}")
        for item in (sheet, *sheet_views):
            if id(item) in seen:
                raise ValueError(f"one {type(item).__name__} object is given twice")
            seen.add(id(item))


def clean(text: str) -> str:
    """The normal form before its case is folded: NFKC, format characters dropped, whitespace made
    single spaces. What 13's reader is given, so it reads the number the comparisons compare."""
    folded = unicodedata.normalize("NFKC", text)
    return " ".join("".join(char for char in folded if unicodedata.category(char) != "Cf").split())


def normal(text: str | None) -> str | None:
    """A number's or title's normal form (the module's rules), or none when nothing is left."""
    return None if text is None else clean(text).casefold() or None


def sheet_name(sheet: SheetCandidate) -> tuple[str, str] | None:
    """How a finding names a sheet: its number as printed (`number`), else its title as drawn
    (`title`), with which it is; none when it has neither."""
    for kind, value in (("number", sheet.number), ("title", sheet.title)):
        if value is not None and normal(value.value) is not None:
            return value.value, kind
    return None


def mark(text: str) -> str:
    """A prefix's or suffix's letters and digits, in normal form: what two of them are compared by."""
    return "".join(char for char in normal(text) or "" if char.isalnum())


class _Reader:
    """13's readers, each number read once and each storey key judged once, their answers checked."""

    def __init__(self, recognisers: Recognisers) -> None:
        self.recognisers = recognisers
        self._parts: dict[int, tuple[str, int, str] | None] = {}
        self._symbolic: dict[str, bool] = {}

    def parts(self, sheet: SheetCandidate) -> tuple[str, int, str] | None:
        """The sheet number's (prefix mark, running number, suffix mark), or none."""
        if id(sheet) not in self._parts:
            assert sheet.number is not None
            self._parts[id(sheet)] = read_number(self.recognisers, sheet.number.value)
        return self._parts[id(sheet)]

    def symbolic(self, storey: str) -> bool:
        if storey not in self._symbolic:
            answer = self.recognisers.symbolic(storey)
            if not isinstance(answer, bool):
                raise TypeError(f"13's symbolic returned {type(answer).__name__}, not a boolean")
            self._symbolic[storey] = answer
        return self._symbolic[storey]


def number_parts(recognisers: Recognisers, number: str) -> tuple[str, int, str] | None:
    """13's reading of a number in its clean form ("S-1\u200b0" is read as "S-10", as its copies'
    normal form has it), checked: its prefix, running number and suffix as the clean form prints
    them, or none when it has no running number below `RUNNING_LIMIT`. What 13's contract does not
    allow is refused."""
    parts = recognisers.sequence(clean(number))
    if parts is None:
        return None
    prefix, running, suffix = (getattr(parts, name, None) for name in ("prefix", "running", "suffix"))
    if not isinstance(prefix, str) or not isinstance(suffix, str):
        raise TypeError(f"13's sequence gave a prefix and suffix that are not text: {parts!r}")
    if isinstance(running, bool) or not isinstance(running, int):
        raise TypeError(f"13's sequence gave a running number that is not an integer: {parts!r}")
    if not 0 <= running < RUNNING_LIMIT:
        return None
    return prefix, running, suffix


def read_number(recognisers: Recognisers, number: str) -> tuple[str, int, str] | None:
    """A number's (prefix mark, running number, suffix mark): what two numbers are compared by."""
    parts = number_parts(recognisers, number)
    return None if parts is None else (mark(parts[0]), parts[1], mark(parts[2]))


def _normal(value: Sourced | None) -> str | None:
    return None if value is None else normal(value.value)


class _Places:
    """Where each sheet lies, for `same_storey`: copies of one number and the sheets of one run are
    one place (a union of positions)."""

    def __init__(self, count: int) -> None:
        self._parent = list(range(count))

    def of(self, i: int) -> int:
        while self._parent[i] != i:
            self._parent[i] = self._parent[self._parent[i]]
            i = self._parent[i]
        return i

    def join(self, positions: Sequence[int]) -> None:
        for i in positions[1:]:
            self._parent[self.of(i)] = self.of(positions[0])


def _grouped(keyed: Iterable[tuple[int, Hashable]]) -> list[list[int]]:
    """Positions grouped by key, each group in position order, the groups in order of their first."""
    groups: dict[Hashable, list[int]] = {}
    for position, key in keyed:
        groups.setdefault(key, []).append(position)
    return list(groups.values())


def _runs(
    units: list[list[int]], parts: list[tuple[str, int, str] | None]
) -> tuple[list[list[list[int]]], bool]:
    """The units (copies of one number) joined into runs of numbers that run on, in number order, and
    whether two units share one place (one running number, printed two ways: "S-09" and "S-9")."""
    parent = list(range(len(units)))

    def root(u: int) -> int:
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u

    def join(a: int, b: int) -> None:
        parent[root(a)] = root(b)

    by_running: dict[tuple[str, str, int], list[int]] = {}
    by_letter: dict[tuple[str, int, str], list[int]] = {}
    for u, p in enumerate(parts):
        if p is None:
            continue
        prefix, running, suffix = p
        by_running.setdefault((prefix, suffix, running), []).append(u)
        if len(suffix) == 1 and "a" <= suffix <= "z":
            by_letter.setdefault((prefix, running, suffix), []).append(u)
    for (prefix, suffix, running), members in by_running.items():
        after = by_running.get((prefix, suffix, running + 1))
        if after is not None:
            for u in members:
                join(u, after[0])
    for (prefix, running, letter), members in by_letter.items():
        after = by_letter.get((prefix, running, chr(ord(letter) + 1)))
        if after is not None:
            for u in members:
                join(u, after[0])

    def order(u: int) -> tuple[bool, str, int, str, int]:
        p = parts[u]
        return (True, "", 0, "", units[u][0]) if p is None else (False, p[0], p[1], p[2], units[u][0])

    runs: dict[int, list[int]] = {}
    for u in sorted(range(len(units)), key=order):
        runs.setdefault(root(u), []).append(u)
    shared = any(len(members) > 1 for members in by_running.values())
    return [[units[u] for u in run] for run in runs.values()], shared


def _same_storey(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    places: _Places,
    reader: _Reader,
) -> list[tuple[int, Conflict]]:
    """One storey drawn twice, by the module's rules: each (bucket, storey) gathers its views, and the
    views are grouped by the set they make."""
    flat: list[tuple[ViewCandidate, int]] = []  # each plan view compared, with its sheet's place
    sharing: dict[tuple[tuple[str, str, str, str], str], list[int]] = {}
    for i, sheet in enumerate(sheets):
        if sheet.discipline is None:
            continue
        for view in views[i]:
            if view.kind != ViewKind.PLAN or view.subject is None:
                continue
            layer = NO_LAYER if view.layer is None else str(view.layer)
            bucket = (str(sheet.group), sheet.discipline.value, view.subject, layer)
            flat.append((view, places.of(i)))
            for storey in view.storeys:
                if not reader.symbolic(storey):
                    sharing.setdefault((bucket, storey), []).append(len(flat) - 1)
    sets: dict[tuple[tuple[str, str, str, str], tuple[int, ...]], list[str]] = {}
    for (bucket, storey), sharers in sharing.items():
        if len({flat[v][1] for v in sharers}) > 1:
            sets.setdefault((bucket, tuple(sharers)), []).append(storey)
    found = []
    for ((_, discipline, subject, layer), members), storeys in sets.items():
        # The set's storeys were met first in its first view, in that view's order: the first of
        # them is the first it lists (no scan of the view's list per storey: that is quadratic).
        evidence = codes.SAME_STOREY(
            discipline=discipline,
            subject=subject,
            layer=layer,
            storey=storeys[0],
            views=len(members),
        )["params"]
        candidates = tuple(flat[v][0] for v in members)
        found.append((members[0], Conflict(SAME_STOREY, candidates, evidence)))
    return found
