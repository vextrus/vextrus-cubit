"""Conflicts (ticket 19b): candidates of one group that cannot all be right, and the continuations
and series that look like conflicts and are not. Found by code; 21c raises each Conflict as a
`conflict` Question. They are not Checks: nothing independent is compared (the M0 plan, "The Checks
M0 brings").

    find(sheets, views, conventions)          # the harness's stage (engine/harness.py)
    compare(sheets, views, recognisers=...)   # the pure function, for 21c and the tests

`views[i]` are the views of `sheets[i]` (`()` where views were not read). Both return `Continuation`s,
then `Series`, then `Conflict`s by kind (`same_number`, `same_title`, `same_storey`), each in the order
of its first candidate in `sheets`, naming **the very objects given**: the export names candidates by
identity, and two equal-by-value copies of a sheet in two files are two sheets, so nothing here keys a
dict or a set, `in` or `.index()` by a candidate; everything goes by position.

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
  on. A number is read only by 13's `sheets.sequence` (`Recognisers.sequence`), never here, and is given
  to it in its clean form (`clean`: the normal form before case folding). Two numbers run on when their
  prefixes and suffixes match (by their letters and digits, case folded) and their running numbers are
  one apart: "09"/"10", "S-09"/"S-10" and "9"/"10" (padding is no part of a running number); or when
  their running numbers match and their suffixes are single Latin letters one apart: "S-101A"/"S-101B".
  "S-101"/"S-101A" do not run on; a number with no running number (no digit, or one of `RUNNING_LIMIT` or
  more) runs on with none. Copies of one number are one place in a run. A run is in number order, a part
  by its number ("S-01/9" before "S-01/10"); a revision mark written after a number ("S-01 R1",
  `split_revision`) is split off before it is read, so "S-01 R1"/"S-01 R2" are one number, never a run
  (#100). A sheet whose views contradict its title block (`contradicted`: its views name only subjects
  its title does not, or its views of its title's kind all disagree with it by layer or by every other
  word; a copied title block, #102) runs on with none, so its title's sheets are raised as `same_title`.
- **Member-mark ranges** (T-W334; the owner's "In M0"): titles equal but for a range of member marks
  ("BEAM B1-B6 DETAILS", "BEAM B7-B12 DETAILS") are one title: a title is grouped by `range_key`, the
  normal form of the words around its ranges (the conventions' `member_range_pattern`; none, or a
  title with no range: its normal form), so a title with a range never joins the same words without
  one. A range's marks share their letters and ascend, below `RUNNING_LIMIT`; else it is no range. Two
  sheets of such a title run on only when their numbers do and each range of the first lies below the
  next's, of one letters ("B1-B6" then "B7-B12"; "B1-B6" then "B4-B9" do not); the run's title is the
  first sheet's as drawn, each range running on to the last sheet's second mark ("BEAM B1-B12
  DETAILS"), its joiner kept.
- **A series** (T-W334; the owner's ruling of 5 Oct 2026; no Question, never exported): one title on
  two places or more that do not all run on, none of its sheets contradicted, whose runs draw
  different things (`_apart`). What a run draws, in this order: (a) the storeys its views state, not
  symbolic; (b) the member marks its views' titles name (a range, or a word of one to three letters
  then one to four digits, "BEAM B7") and its own titles' ranges, each an interval; and only when it
  has neither, (c) the storeys, not symbolic, of the plan views of the nearest sheet numbered before it
  (its group, Discipline and prefix) whose title reads as a plan (17's `describe`): the layout each
  floor's details follow. The runs are a series when every run draws something and no two share a
  storey or overlap in marks; else the title is `same_title` (one overlap keeps every sheet: no part
  is a series). What was not read is not different: a run that draws nothing keeps the Question.
- **`same_title`:** one title on places that do not all run on, or on two numbers that share one place
  (one running number printed two ways, "S-09" and "S-9": not copies, since their normal forms differ,
  and not two places), and not a series: two of its runs may draw the same thing. One Conflict naming
  every sheet of the title, in number order (a run among them is also a Continuation); evidence: the
  title as the first sheet draws it, and how many sheets (`sheets`). Copies of one number under one
  title are only `same_number`.
- **`same_storey`** (one storey drawn twice; the M0 plan's review Q3): plan views of one Discipline
  (their sheets'), one subject (known: none matches nothing) and one layer (none matches none: a beam
  plan has no layer) whose storey lists share a storey that is not symbolic ("typical", "top" and "not
  stated" are Step 3's to resolve: never a conflict on them alone; `Recognisers.symbolic`), on sheets of
  one class (`sheet_class`: a details sheet's title reads as a detail, a section or a schedule; every
  other is a layout sheet's): a layout sheet's plan is never compared with a details sheet's enlarged
  plan views (the owner's ruling of 5 Oct 2026). Never two views of one sheet, or of one continuation,
  alone: the views must lie on two places or more. One Conflict per set of views: those sharing a storey,
  grouped by the set, so two plans overlapping on two floors are one Conflict. Evidence, for the words
  (m0-screens §5's "S-14 and S-15 both draw the 5th floor slab, bottom layer"): the first two sheets'
  numbers (else titles); the titles, as drawn, of their plans in the set (they state the storey and what
  is drawn), one when they are alike, both when they differ ("3RD, 5TH & 7TH FLOOR SLAB" beside "5TH
  FLOOR SLAB"), none when either plan has no title (the words then name no plan: a title read on one
  sheet is never said of the other); the layer (`none` for none), how many views and how many sheets they
  lie on (`sheets`); and, for 21c, the Discipline's, the subject's and the first shared storey's keys (in
  the first view's order). A plan whose storeys run floor to floor (17's `floor_to_floor`: a column
  layout "foundation to 3rd floor") shares none at its top end, where the next range starts ("3rd to 6th
  floor"): consecutive ranges meet at a floor by the drafting convention. A plan on a sheet with neither
  number nor title sits out (its Question is 21c's `missing`). 21c's Question title must word m0-screens
  §5's verbatim from `storey` and `subject` once display words exist; this Conflict's words are its
  evidence line until then.

**The work is linear** in sheets, views and storeys, plus sorting: candidates are grouped by keys and
never compared pairwise (10,000 sheets of one title are one group, not 50 million pairs; a title's
runs are told apart by one sweep of their marks, `_overlap`), each number is read once, a title's
ranges are read only up to `MAX_PATTERN_TEXT` characters, and a title's kind is read only where a rule
needs it (a sheet with a plan view, a run that draws nothing of its own).

**The trust boundary** (each refused with a `ValueError` or `TypeError`, so the stage fails, never
passes): `views` not one list per sheet; one sheet or view object given twice; a sheet with no group;
a candidate of the wrong type (a sheet in a list of views among them); a reader returning what 13's
contract does not allow.
"""

import bisect
import re
import unicodedata
from collections.abc import Callable, Collection, Hashable, Iterable, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, NoReturn, Protocol

from engine.messages import conflicts as codes
from engine.recognise.types import (
    Conflict,
    Continuation,
    Series,
    SheetCandidate,
    SheetConventions,
    Sourced,
    StoreysMeaning,
    ViewCandidate,
    ViewKind,
    pattern_finditer,
    pattern_search,
)

if TYPE_CHECKING:
    from engine.recognise.views import Described

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

    Tests pass hand-made stand-ins (engine/recognise/tests/stand_ins.py) where they test 19b's rules;
    the harness path, `recognisers(conventions)`, binds 13's own readers.
    """

    sequence: Callable[[str], NumberParts | None]
    """A number's prefix, running number and suffix, or none (13's `sheets.sequence(number,
    conventions)`)."""
    storeys: Callable[[str], Collection[str]]
    """The canonical storey keys a sheet's title states, a symbolic end among them (13's
    `storeys.read(text, conventions, plan_title=True)`: its explicit list and its end)."""
    symbolic: Callable[[str], bool]
    """Whether a storey key is one Step 3 resolves (13's "typical", "top" and "not stated")."""


SYMBOLIC = frozenset({"typical", "top", "not_stated"})
"""The storey keys Step 3 resolves, as 13's `storeys.py` spells them (the orchestrator's fixed
spellings of 29 Sep 2026; 13's module exports no set of them): "typical (range from Step 3)", the
symbolic end "top", and "not stated"."""


def recognisers(conventions: SheetConventions | None) -> Recognisers:
    """13's readers bound to `conventions`: how the harness's two 19b stages read.

    - `sequence`: 13's `sheets.sequence(number, conventions)`;
    - `storeys`: 13's `storeys.read(text, conventions, plan_title=True)`, its explicit keys and the
      symbolic end a range runs to (`runs_to`); a sheet's title is read as a plan's, since the
      storey Check compares only sheets with plan views;
    - `symbolic`: whether a key is one of `SYMBOLIC`.

    With no conventions (a run with no sheet conventions reads no sheets) a reader that is called
    refuses: numbers are read under the conventions the sheets were read with.
    """
    from engine.recognise import sheets, storeys  # 13's, imported where they are used

    if conventions is None:

        def unbound(_: str) -> NoReturn:
            raise ValueError("a number or a storey is read under the sheets' conventions; none given")

        return Recognisers(sequence=unbound, storeys=unbound, symbolic=SYMBOLIC.__contains__)
    bound = conventions

    def title_storeys(text: str) -> tuple[str, ...]:
        read = storeys.read(text, bound, plan_title=True)
        return (*read.keys, *([read.runs_to] if read.runs_to else []))

    return Recognisers(
        sequence=lambda number: sheets.sequence(number, bound),
        storeys=title_storeys,
        symbolic=SYMBOLIC.__contains__,
    )


type Found = Conflict | Continuation | Series
"""What the stage finds: Continuations, then Series, then Conflicts."""


def find(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    conventions: SheetConventions | None,
) -> list[Found]:
    """The harness's stage: `compare` with 13's readers bound to the conventions the sheets were read
    with (none only when the run has no sheet conventions, and then it has no sheets)."""
    if sheets and conventions is None:
        raise ValueError("sheets are compared under the conventions they were read with; none given")
    return compare(sheets, views, conventions=conventions, recognisers=recognisers(conventions))


def compare(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    *,
    conventions: SheetConventions | None,
    recognisers: Recognisers,
) -> list[Found]:
    """The set's Continuations, Series and Conflicts, by the rules above; `conventions` give each
    Discipline's prefixes (none: no prefix is a Discipline's own) and the member range pattern."""
    given(sheets, views)
    reader = _Reader(recognisers, Numbers(conventions, recognisers))
    numbers = [reader.key(sheet) for sheet in sheets]
    pattern = None if conventions is None else conventions.member_range_pattern
    keyed = [(None, ()) if s.title is None else _keyed(s.title.value, pattern) for s in sheets]
    titles = [key for key, _ in keyed]
    ranges = [found for _, found in keyed]
    places = _Places(len(sheets))  # where a sheet lies for `same_storey`: copies and runs are one
    plans = _Plans(sheets, numbers, reader)

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
    series: list[tuple[int, Series]] = []
    by_title: list[tuple[int, Conflict]] = []
    for group in _grouped(
        (i, (s.group, s.discipline.value, titles[i]))
        for i, s in enumerate(sheets)
        if s.discipline is not None and numbers[i] is not None and titles[i] is not None
    ):
        units = _grouped((i, numbers[i]) for i in group)
        if len(units) < 2:
            continue
        alone = [any(contradicted(sheets[i], views[i], conventions) for i in unit) for unit in units]

        def fits(before: int, after: int, units: list[list[int]] = units) -> bool:
            return _ascending(ranges[units[before][0]], ranges[units[after][0]])

        runs = _runs(units, [reader.parts(sheets[unit[0]]) for unit in units], alone, fits)
        members_of = [[i for unit in run for i in unit] for run in runs]
        for run, members in zip(runs, members_of, strict=True):
            places.join(members)
            if len(run) > 1:
                first, last = members[0], members[-1]
                title = _joined(_drawn(sheets[first]), ranges[first], _drawn(sheets[last]), ranges[last])
                continuation = Continuation(title, tuple(sheets[i] for i in members))
                continuations.append((min(members), continuation))
        if len(runs) > 1:
            ordered = [i for members in members_of for i in members]
            title = _drawn(sheets[ordered[0]])
            candidates = tuple(sheets[i] for i in ordered)
            if not any(alone) and _apart(members_of, views, ranges, reader, plans, pattern):
                series.append((min(ordered), Series(title, candidates)))
                continue
            evidence = codes.SAME_TITLE(title=title, sheets=len(ordered))["params"]
            by_title.append((min(ordered), Conflict(SAME_TITLE, candidates, evidence)))

    by_storey = _same_storey(sheets, views, places, reader)
    found: list[Found] = [c for _, c in sorted(continuations, key=_first)]
    found.extend(s for _, s in sorted(series, key=_first))
    for batch in (by_number, by_title, by_storey):
        found.extend(conflict for _, conflict in sorted(batch, key=_first))
    return found


def _drawn(sheet: SheetCandidate) -> str:
    assert sheet.title is not None  # only titled sheets are grouped by title
    return sheet.title.value


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


def _title_on(flat: Sequence[tuple[ViewCandidate, int, int]], members: Sequence[int], place: int) -> str:
    """The title, as drawn, of the set's first titled plan at one place; empty when it has none."""
    return next((t for v in members if flat[v][1] == place and normal(t := flat[v][0].title or "")), "")


def _name(sheet: SheetCandidate) -> tuple[str, str]:
    name = sheet_name(sheet)
    assert name is not None  # a sheet with neither number nor title sits out of `same_storey`
    return name


def mark(text: str) -> str:
    """A prefix's or suffix's letters and digits, in normal form: what two of them are compared by."""
    return "".join(char for char in normal(text) or "" if char.isalnum())


MARK_LIMIT = 16
"""The longest last word tried as a revision mark (the pattern is the conventions')."""


def split_revision(number: str, pattern: str | None) -> tuple[str, str | None]:
    """A number with a revision mark written after it, a space between ("S-01 R1", "S-01 REV A"), split
    into the number and the mark as written (#100; the orchestrator's ruling: "S-01 R1" is number "S-01",
    revision "R1"); else the number as given and none. The mark is the last word, or the last two ("REV
    A"), matched whole by the conventions' revision-mark pattern (none: nothing is split), and what is
    left must still hold a digit, so a bare "R1" stays a number. Only a space separates: "E-R2" may be a
    riser sheet's own number."""
    if pattern is None:
        return number, None
    starts = [m.start() for m in _WORD.finditer(number)]
    for first in starts[-1:-3:-1] if len(starts) > 1 else ():
        mark_text = number[first:].strip()
        rest = number[:first].strip()
        if len(mark_text) > MARK_LIMIT or not rest:
            continue
        found = pattern_search(pattern, mark_text)
        whole = found is not None and found.start() == 0 and found.end() == len(mark_text)
        if whole and any(unicodedata.category(c) == "Nd" for c in rest):
            return rest, mark_text
    return number, None


_WORD = re.compile(r"\S+")


class Numbers:
    """Sheet numbers as the conflicts and the register Check compare them, each read once through 13's
    `sequence`: by prefix, running number and suffix, a Discipline's own prefix counting as none (a
    title block's bare "07" is the list's "S-07"), else in normal form."""

    def __init__(self, conventions: SheetConventions | None, recognisers: Recognisers) -> None:
        self.recognisers = recognisers
        disciplines = () if conventions is None else conventions.disciplines
        self.own = {d.key: {mark(p) for p in d.prefixes} - {""} for d in disciplines}
        owners: dict[str, set[str]] = {}
        for key, marks in self.own.items():
            for prefix in marks:
                owners.setdefault(prefix, set()).add(key)
        self.owners = {prefix: keys.pop() for prefix, keys in owners.items() if len(keys) == 1}
        self.revision = None if conventions is None else conventions.revision_mark_pattern
        self._read: dict[str, tuple[str, int, str] | None] = {}

    def parts(self, number: str) -> tuple[str, int, str] | None:
        """The number's (prefix mark, running number, suffix mark), or none; a revision mark written
        after it ("S-01 R1") split off first (#100), so its digits never make a running number."""
        if number not in self._read:
            unrevised = split_revision(number, self.revision)[0]
            self._read[number] = read_number(self.recognisers, unrevised)
        return self._read[number]

    def parts_in(self, number: str, discipline: str) -> tuple[str, int, str] | None:
        """The parts within a Discipline: its own prefix as none."""
        parts = self.parts(number)
        if parts is None:
            return None
        prefix, running, suffix = parts
        return ("" if prefix in self.own.get(discipline, set()) else prefix), running, suffix

    def key(self, number: str, discipline: str) -> Hashable:
        """What a number is compared by within a Discipline."""
        parts = self.parts_in(number, discipline)
        return ("text", normal(number)) if parts is None else ("parts", *parts)

    def owner(self, number: str) -> str | None:
        """The one Discipline whose prefix the number carries, if any."""
        parts = self.parts(number)
        return None if parts is None else self.owners.get(parts[0])


class _Reader:
    """13's readers, each number read once and each storey key judged once, their answers checked."""

    def __init__(self, recognisers: Recognisers, numbers: Numbers) -> None:
        self.recognisers = recognisers
        self.numbers = numbers
        self._symbolic: dict[str, bool] = {}

    def parts(self, sheet: SheetCandidate) -> tuple[str, int, str] | None:
        """The sheet number's parts within its Discipline (its own prefix as none), or none."""
        assert sheet.number is not None
        assert sheet.discipline is not None
        return self.numbers.parts_in(sheet.number.value, sheet.discipline.value)

    def key(self, sheet: SheetCandidate) -> Hashable | None:
        """What the sheet's number is compared by, or none when it has no number (or no Discipline,
        whose prefixes decide it)."""
        if sheet.discipline is None or sheet.number is None or normal(sheet.number.value) is None:
            return None
        return self.numbers.key(sheet.number.value, sheet.discipline.value)

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
    units: list[list[int]],
    parts: list[tuple[str, int, str] | None],
    alone: Sequence[bool],
    fits: Callable[[int, int], bool] = lambda _before, _after: True,
) -> list[list[list[int]]]:
    """The units (copies of one number) joined into runs of numbers that run on, in number order (a
    part by its number: "S-01/9" before "S-01/10", #100); a unit `alone` joins none (#102), and a
    unit joins the next only when it `fits` before it (member ranges that ascend)."""
    parent = list(range(len(units)))

    def root(u: int) -> int:
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u

    def join(a: int, b: int) -> None:
        parent[root(a)] = root(b)

    by_running: dict[tuple[str, str, int], list[int]] = {}
    by_part: dict[tuple[str, int, int], list[int]] = {}  # a letter or a part number after the running
    for u, p in enumerate(parts):
        if p is None or alone[u]:
            continue
        prefix, running, suffix = p
        by_running.setdefault((prefix, suffix, running), []).append(u)
        part = _part(suffix)
        if part is not None:
            by_part.setdefault((prefix, running, part), []).append(u)
    for (prefix, suffix, running), members in by_running.items():
        after = by_running.get((prefix, suffix, running + 1))
        if after is not None:
            for u in members:
                if fits(u, after[0]):
                    join(u, after[0])
    for (prefix, running, part), members in by_part.items():
        after = by_part.get((prefix, running, part + 1))
        if after is not None:
            for u in members:
                if fits(u, after[0]):
                    join(u, after[0])

    def order(u: int) -> tuple[bool, str, int, bool, int, str, int]:
        p = parts[u]
        if p is None:
            return (True, "", 0, False, 0, "", units[u][0])
        part = _part(p[2])
        return (False, p[0], p[1], part is not None, part or 0, p[2], units[u][0])

    runs: dict[int, list[int]] = {}
    for u in sorted(range(len(units)), key=order):
        runs.setdefault(root(u), []).append(u)
    return [[units[u] for u in run] for run in runs.values()]


# Member-mark ranges and series ----------------------------------------------------------------------


@dataclass(frozen=True)
class MemberRange:
    """A range of member marks as a title draws it ("B1-B6", "C2 TO C5"): the marks' letters (in
    normal form, one for both), the lowest and highest number, and where it lies in the drawn text
    (`at` to `end`; `high_at` where its second mark starts)."""

    letters: str
    low: int
    high: int
    at: int
    high_at: int
    end: int


RANGE_DIGITS = len(str(RUNNING_LIMIT)) - 1
"""The most digits a mark's number may have: one of `RUNNING_LIMIT` or more is no range."""


def member_ranges(text: str, pattern: str | None) -> tuple[MemberRange, ...]:
    """The member ranges a text draws, by the conventions' pattern (none: none); a match whose marks'
    letters differ, whose numbers descend or reach `RUNNING_LIMIT` is no range. A text longer than
    a pattern runs on has none (`pattern_finditer`)."""
    if pattern is None:
        return ()
    found = []
    for match in pattern_finditer(pattern, text):
        low, high = match.group("low"), match.group("high")
        if len(low) > RANGE_DIGITS or len(high) > RANGE_DIGITS:
            continue
        letters = normal(match.group("a"))
        if letters is None or letters != normal(match.group("b")) or int(low) > int(high):
            continue
        found.append(
            MemberRange(letters, int(low), int(high), match.start(), match.start("b"), match.end())
        )
    return tuple(found)


def range_key(title: str, pattern: str | None) -> Hashable | None:
    """What a title is grouped by: its normal form, or, when it draws member ranges, the normal forms
    of the words around them ("BEAM B1-B6 DETAILS" and "BEAM B7-B12 DETAILS" are one title, never
    "BEAM DETAILS"); none when nothing is left."""
    return _keyed(title, pattern)[0]


def _keyed(title: str, pattern: str | None) -> tuple[Hashable | None, tuple[MemberRange, ...]]:
    whole = normal(title)
    found = member_ranges(title, pattern) if whole is not None else ()
    if not found:
        return whole, ()
    edges = [0, *(i for r in found for i in (r.at, r.end)), len(title)]
    words = tuple(normal(title[a:b]) or "" for a, b in zip(edges[::2], edges[1::2], strict=True))
    return ("ranged", *words), found


def _ascending(before: Sequence[MemberRange], after: Sequence[MemberRange]) -> bool:
    """Whether a sheet's ranges run on to the next's: each of one letters and below the next."""
    return all(a.letters == b.letters and a.high < b.low for a, b in zip(before, after, strict=True))


def _joined(first: str, firsts: Sequence[MemberRange], last: str, lasts: Sequence[MemberRange]) -> str:
    """A run's title: the first sheet's as drawn, each range running on to the last sheet's second
    mark ("BEAM B1-B6 DETAILS" to "BEAM B13-B18 DETAILS": "BEAM B1-B18 DETAILS")."""
    text = first
    for a, b in reversed(list(zip(firsts, lasts, strict=True))):
        text = text[: a.high_at] + last[b.high_at : b.end] + text[a.end :]
    return text


_MARK = re.compile(r"(?<![^\W_])([^\W\d_]{1,3})(\d{1,4})(?![^\W_])")
"""A single member mark in a view's title: a word of one to three letters then one to four digits
("BEAM B7", "C12"), the marks the member range pattern joins."""


def _marks(text: str, pattern: str | None) -> list[tuple[str, int, int]]:
    """The member marks a view's title names, each an interval: its ranges and its single marks."""
    found = [(r.letters, r.low, r.high) for r in member_ranges(text, pattern)]
    for match in _MARK.finditer(text):
        letters = normal(match.group(1))
        if letters is not None:
            number = int(match.group(2))
            found.append((letters, number, number))
    return found


class _Plans:
    """The sheets whose titles read as a plan (17's `describe`), by group, Discipline and prefix in
    number order, read only when a series needs one (`before`)."""

    def __init__(
        self, sheets: Sequence[SheetCandidate], numbers: Sequence[Hashable | None], reader: _Reader
    ) -> None:
        self.sheets, self.numbers, self.reader = sheets, numbers, reader
        self._by: dict[tuple[str, str, str], list[tuple[tuple[int, bool, int, str], int]]] | None
        self._by = None

    def _place(self, i: int) -> tuple[tuple[str, str, str], tuple[int, bool, int, str]] | None:
        sheet = self.sheets[i]
        if sheet.discipline is None or self.numbers[i] is None:
            return None
        parts = self.reader.parts(sheet)
        if parts is None:
            return None
        prefix, running, suffix = parts
        part = _part(suffix)
        where = (str(sheet.group), sheet.discipline.value, prefix)
        return where, (running, part is not None, part or 0, suffix)

    def before(self, i: int) -> int | None:
        """The nearest sheet numbered before sheet `i`, of its group, Discipline and prefix, whose
        title reads as a plan; none."""
        from engine.recognise.views import describe  # 17's, imported where it is used

        if self._by is None:
            self._by = {}
            for j, sheet in enumerate(self.sheets):
                place = self._place(j)
                if place is None or sheet.title is None:
                    continue
                if describe(sheet.title.value).kind == ViewKind.PLAN:
                    self._by.setdefault(place[0], []).append((place[1], j))
            for listed in self._by.values():
                listed.sort()
        place = self._place(i)
        if place is None:
            return None
        listed = self._by.get(place[0], [])
        at = bisect.bisect_left(listed, (place[1],))
        return listed[at - 1][1] if at else None


def _apart(
    runs: Sequence[Sequence[int]],
    views: Sequence[Sequence[ViewCandidate]],
    ranges: Sequence[Sequence[MemberRange]],
    reader: _Reader,
    plans: _Plans,
    pattern: str | None,
) -> bool:
    """Whether a title's runs draw different things (a series), by what each run draws: (a) the
    storeys its views state, (b) the member marks its views' titles and its own titles' ranges name,
    and (c) only when it has neither, the storeys of the plan views of the nearest plan sheet before
    it. Apart when every run draws something and no two share a storey or overlap in marks."""
    storeys_of: dict[str, int] = {}
    marks: list[tuple[str, int, int, int]] = []
    for run, members in enumerate(runs):
        storeys = {s for i in members for v in views[i] for s in v.storeys if not reader.symbolic(s)}
        named = [(r.letters, r.low, r.high) for i in members for r in ranges[i]]
        named += [m for i in members for v in views[i] if v.title for m in _marks(v.title, pattern)]
        if not storeys and not named and (plan := plans.before(members[0])) is not None:
            storeys = {
                s
                for v in views[plan]
                if v.kind == ViewKind.PLAN
                for s in v.storeys
                if not reader.symbolic(s)
            }
        if not storeys and not named:
            return False  # what was not read is not different
        if any(storeys_of.setdefault(storey, run) != run for storey in storeys):
            return False
        marks += [(letters, low, high, run) for letters, low, high in named]
    return not _overlap(marks)


def _overlap(marks: list[tuple[str, int, int, int]]) -> bool:
    """Whether two runs' mark intervals overlap (`(letters, low, high, run)`), in one sweep by low:
    the highest end so far, and the highest of another run than its."""
    marks.sort()
    letters: str | None = None
    best = second = (-1, -1)  # (high, run)
    for mark_letters, low, high, run in marks:
        if mark_letters != letters:
            letters, best, second = mark_letters, (-1, -1), (-1, -1)
        other = best[0] if best[1] != run else second[0]
        if other >= low:
            return True
        if run == best[1]:
            best = (max(best[0], high), run)
        elif high > best[0]:
            best, second = (high, run), best
        elif high > second[0]:
            second = (high, run)
    return False


def contradicted(
    sheet: SheetCandidate, views: Sequence[ViewCandidate], conventions: SheetConventions | None
) -> bool:
    """Whether the sheet's views contradict its title block (#102: a title block copied from another
    sheet and never edited), by 17's view conventions (`views.subjects`, `views.describe`); either:

    - its title names a subject, its views' titles name subjects, and not one of them is one its title
      names ("COLUMN SCHEDULE" over "PILE CAP DETAILS");
    - its title names a kind, its views of that kind are titled, and not one agrees with it: a view
      disagrees when both state a layer and the layers differ ("... (BOTTOM LAYER)" over "... (TOP
      LAYER)"), or when both hold other words and share none ("EAST ELEVATION" over "NORTH
      ELEVATION").

    A title or views naming no subject, and views of another kind ("SECTION 7Q-7Q" on a "... DETAILS"
    sheet), are no evidence: a continuation's later sheets often carry only their sections' marks. A
    sheet with no title or no view read is never contradicted. `conventions` are the sheets'; the view
    words are 17's default. On the real sets, of the 7 false continuations session 05 counted, this
    tells 2 (the others' drawings carry no heading read, or one that agrees with the stale title)."""
    from engine.recognise.views import describe, subjects  # 17's, imported where they are used

    if sheet.title is None:
        return False
    named = subjects(sheet.title.value)
    titled = [v.title for v in views if v.title]
    drawn = [found for t in titled if (found := subjects(t))]
    if named and drawn and not any(found & named for found in drawn):
        return True
    title = describe(sheet.title.value)
    if title.kind is None:
        return False
    alike = [d for t in titled if (d := describe(t)).kind == title.kind]
    return bool(alike) and not any(_agrees(title, d) for d in alike)


def _agrees(title: Described, view: Described) -> bool:
    if title.layer is not None and view.layer is not None and title.layer != view.layer:
        return False
    return not (title.words and view.words and not title.words & view.words)


PART_DIGITS = 6
"""The longest part number after a running number ("S-01/2") read as one."""


def _part(suffix: str) -> int | None:
    """A suffix's place in a sequence of parts: a single Latin letter (A, B, …, as letters count) or a
    part number of digits ("S-01/1", "S-01/2": 13's reader, as ruled, reads a digit run after a "/" as
    a part suffix, so the running number is the run before it); none for any other suffix. Letters
    and numbers are kept apart (a letter's place is below 0)."""
    if len(suffix) == 1 and "a" <= suffix <= "z":
        return ord(suffix) - ord("a") - 1000
    if 0 < len(suffix) <= PART_DIGITS and suffix.isascii() and suffix.isdigit():
        return int(suffix)
    return None


LAYOUT = "layout"
DETAILS = "details"
DETAIL_KINDS = frozenset({ViewKind.DETAIL, ViewKind.SECTION, ViewKind.SCHEDULE})
"""The kinds a details sheet's title reads as (17's `describe`)."""


def sheet_class(sheet: SheetCandidate) -> str:
    """A sheet's class for `same_storey`: `details` when its title reads as a detail, a section or a
    schedule, else `layout` (a plan's title, one naming no kind, or none)."""
    from engine.recognise.views import describe  # 17's, imported where it is used

    if sheet.title is None:
        return LAYOUT
    return DETAILS if describe(sheet.title.value).kind in DETAIL_KINDS else LAYOUT


def _same_storey(
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    places: _Places,
    reader: _Reader,
) -> list[tuple[int, Conflict]]:
    """One storey drawn twice, by the module's rules: each (bucket, storey) gathers its views, and the
    views are grouped by the set they make. A bucket holds one class of sheet (`sheet_class`): a
    layout sheet's plan is never compared with a details sheet's plan views (the owner's ruling of
    5 Oct 2026: a details sheet's enlarged plan shares its layout's subject and storey)."""
    flat: list[tuple[ViewCandidate, int, int]] = []  # each plan view: its sheet's place, its sheet
    sharing: dict[tuple[tuple[str, str, str, str, str], str], list[int]] = {}
    for i, sheet in enumerate(sheets):
        if sheet.discipline is None or sheet_name(sheet) is None:
            continue
        kind: str | None = None  # the sheet's class, read once it has a plan view to compare
        for view in views[i]:
            if view.kind != ViewKind.PLAN or view.subject is None:
                continue
            kind = kind or sheet_class(sheet)
            layer = NO_LAYER if view.layer is None else str(view.layer)
            bucket = (str(sheet.group), sheet.discipline.value, view.subject, layer, kind)
            flat.append((view, places.of(i), i))
            storeys = [storey for storey in view.storeys if not reader.symbolic(storey)]
            if view.storeys_meaning == StoreysMeaning.FLOOR_TO_FLOOR and len(storeys) > 1:
                storeys = storeys[:-1]  # its top end is where the next range of columns starts
            for storey in storeys:
                sharing.setdefault((bucket, storey), []).append(len(flat) - 1)
    sets: dict[tuple[tuple[str, str, str, str, str], tuple[int, ...]], list[str]] = {}
    for (bucket, storey), sharers in sharing.items():
        if len({flat[v][1] for v in sharers}) > 1:
            sets.setdefault((bucket, tuple(sharers)), []).append(storey)
    found = []
    for ((_, discipline, subject, layer, _), members), storeys in sets.items():
        # The set's storeys were met first in its first view, in that view's order: the first of
        # them is the first it lists (no scan of the view's list per storey: that is quadratic).
        first = flat[members[0]]
        second = next(flat[v] for v in members if flat[v][1] != first[1])
        # The words quote the first two sheets' plans: alike, different, or (either untitled) neither.
        plan, other = _title_on(flat, members, first[1]), _title_on(flat, members, second[1])
        titled = "none" if not (plan and other) else "differ"
        if titled == "differ" and normal(plan) == normal(other):
            titled = "same"
        if titled != "differ":
            plan, other = (plan, "") if titled == "same" else ("", "")
        first_name, second_name = _name(sheets[first[2]]), _name(sheets[second[2]])
        evidence = codes.SAME_STOREY(
            first=first_name[0],
            first_named=first_name[1],
            second=second_name[0],
            second_named=second_name[1],
            plan=plan,
            other=other,
            titled=titled,
            layer=layer,
            views=len(members),
            sheets=len({flat[v][2] for v in members}),
            discipline=discipline,
            subject=subject,
            storey=storeys[0],
        )["params"]
        candidates = tuple(flat[v][0] for v in members)
        found.append((members[0], Conflict(SAME_STOREY, candidates, evidence)))
    return found
