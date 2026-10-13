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
  more) runs on with none. A number drawn by several sheets of one title (a duplicate, its own
  `same_number` Question) leaves its next numbers out: it runs on across as many numbers less one as it
  has copies ("S-41", "S-42" twice, "S-44": 43 is the second copy's), when its copies are different
  drawings (their member ranges ascend one after the other, never the same or none) and no sheet of
  the group and Discipline carries a number in the gap, with any suffix ("S-43A", "S-43.1" hold it).
  Copies of one number are one place in a run. A run is in number order, a part
  by its number ("S-01/9" before "S-01/10"); a revision mark written after a number ("S-01 R1",
  `split_revision`) is split off before it is read, so "S-01 R1"/"S-01 R2" are one number, never a run
  (#100). A sheet whose views contradict its title block (`contradicted`: its views name only subjects
  its title does not, or its views of its title's kind all disagree with it by layer or by every other
  word; a copied title block, #102) runs on with none, so its title's sheets are raised as `same_title`
  when it would have run on from or into one of them (S19-B4's E2; else see a series).
  Nor do two consecutive numbers whose views state different storeys, or name different subjects
  (`_Drawn`: each states some, none shared; a stale title block on the next sheet, the owner's ruling of
  5 Oct 2026, 17:06Z): they part, and their title is `same_title`, never a series. A storey is stated
  at its level (`level`): one storey's plan at ceiling level (17's `at_ceiling_level`, a pipe layout
  hung under its slab) and its plan at floor level share no storey (S19-B5). Views that state the same
  storey and subject, or nothing, join as before.
- **Content twins** (S19-B7; a copied title block over the next row's drawing, the owner's "Keep it in
  M0"): two consecutive numbers of one title also part, the same way, when what they draw says they are
  two drawings. What a sheet draws is its layer histogram (`SheetCandidate.layers`, model space's only);
  two histograms' weighted overlap is the sum of the lesser counts over the sum of the greater. A near
  twin of a sheet is another titled sheet of its group and its own file (never another file's; the
  file is `compare`'s `files` when given, else the sheet's first anchor's) at
  `TWIN` (0.9) or more, neither of the pair's places. They part when each has a near twin, no near twin
  of one shares a title stem with a near twin of the other (a stem: the title's words without the
  storeys it states, its member-mark ranges and the conventions' floor, level, range and list words,
  so one drawing type over several floors or mark ranges is one stem), and each is closer to its
  nearest twin than to the other. True continuations share little and twin nothing; details per floor
  twin each other under one stem; a pair nearer each other than its twins is one drawing: all stay.
  A sheet without a histogram (a layout's), or past `MAX_TWIN_READS`, has no twin: the rule sits out.
- **Member-mark ranges** (T-W334; the owner's "In M0"): titles equal but for a range of member marks
  ("GRADE BEAM GB2-GB5 DETAILS", "GRADE BEAM GB6-GB9 DETAILS") are one title: a title is grouped by
  `range_key`, the normal form of the words around its ranges (the conventions' `member_range_pattern`;
  none, or a title with no range: its normal form), so a title with a range never joins the same words
  without one. A range's marks share their letters and ascend, below `RUNNING_LIMIT`; else it is no
  range. Two sheets of such a title run on only when their numbers do and each range of the first lies
  below the next's, or touches it at one mark when each spans more than one (the owner's ruling Q-R9: a
  member continued on the next sheet), of one letters ("GB2-GB5" then "GB6-GB9" or "GB5-GB9"; "GB2-GB5"
  then "GB4-GB8", or "GB2-GB5" again, do not); the run's
  title is the first sheet's as drawn, each range running on to the last sheet's second mark ("GRADE BEAM
  GB2-GB9 DETAILS"), its joiner kept. A range of hyphenated marks that read as sheet numbers of the
  title's own Discipline (its prefix, "SEE S-12 TO S-14" on a Structural sheet) cites sheets and is no
  member range: two titles that differ only by the sheets they cite are two titles, as before E1.
- **A series** (T-W334; the owner's ruling of 5 Oct 2026; no Question, never exported): one title on two
  places or more that do not all run on, no consecutive pair parted on what its views draw, and no
  contradicted sheet among them that, its contradiction set aside, would run on from or into another of
  its title's (by number and ascending ranges; S19-B4's E2: a copied title block far from its title is
  told apart like any run), whose runs draw different things (`_apart`). What a run draws, in this
  order: (a) the storeys its views state, not symbolic; (b) the member marks its views' titles name (a
  range, or a word of one to three letters then one to four digits, "GRADE BEAM GB7"; a section size's
  second number, '11"X17"', is never a mark, E1, and "B-1" is never read; a range of such marks,
  "B-1 TO B-6", is read first, so runs that overlap in no mark are apart ("RB-1 - RB-5" and
  "REB-2 - REB-4"), and then not at all, since such marks restart on every floor) and its
  own titles' ranges, each an interval; and only when it has neither, (c) the storeys,
  not symbolic, of the plan views of the nearest sheet numbered before it (its group, Discipline and
  prefix) whose title reads as a plan (17's `describe`): the layout each floor's details follow; when
  that plan states only symbolic storeys (a tank's), the layer of the run's own titles, else of that
  plan's views (E3), keyed apart from storeys. The runs are a series when every run draws
  something and no two share a storey or overlap in marks; else the title is `same_title` (one overlap
  keeps every sheet: no part is a series). What was not read is not different: a run that draws nothing
  keeps the Question.
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
  alone: the views must lie on two places or more. Two plans whose titles both name member marks
  (`plan_marks`: "P.C-1", "PC1", a range; never level words and numbers, "LEVELS 2 TO 5") with none in
  common are never paired (S19-B4's E6: one pile cap's plan is not another's); a plan naming none pairs
  with every plan. One Conflict per set of views: those sharing a storey,
  grouped by the set, so two plans overlapping on two floors are one Conflict. Evidence, for the words
  (m0-screens §5's "S-14 and S-15 both draw the 5th floor slab, bottom layer"): the first two sheets'
  numbers (else titles); the titles, as drawn, of their plans in the set (they state the storey and what
  is drawn), one when they are alike, both when they differ ("3RD, 5TH & 7TH FLOOR SLAB" beside "5TH
  FLOOR SLAB"), none when either plan has no title (the words then name no plan: a title read on one
  sheet is never said of the other); the layer (`none` for none), how many views and how many sheets they
  lie on (`sheets`); and, for 21c, the Discipline's, the subject's and the first shared storey's keys (in
  the first view's order). A part plan (17's `StoreysSource.TITLE_LINE`: its own title names a room or
  a part, its floors only a line under it, #413, S19-B5) sits out: each bath's plan over "2nd to 6th
  floor" is a different room's. A column or shear-wall plan (`COLUMN_SUBJECTS`) whose storeys run floor
  to floor (17's `floor_to_floor`: a column layout "foundation to 3rd floor") shares none at its top
  end, where the next range starts ("3rd to 6th floor"): consecutive ranges meet at a floor by the
  drafting convention; an architectural plan, read floor to floor too (S22-FL5), claims every storey
  it states. A plan at ceiling level is
  compared only with plans at ceiling level (`level`). A plan on a sheet with neither
  number nor title sits out (its Question is 21c's `missing`). 21c's Question title must word m0-screens
  §5's verbatim from `storey` and `subject` once display words exist; this Conflict's words are its
  evidence line until then.

**The work is linear** in sheets, views and storeys, plus sorting: candidates are grouped by keys and
never compared pairwise (10,000 sheets of one title are one group, not 50 million pairs; a title's
runs are told apart by one sweep of their marks, `_overlap`), each number is read once, a title's
ranges are read only up to `MAX_PATTERN_TEXT` characters, and a title's kind is read only where a rule
needs it (a sheet with a plan view, a run that draws nothing of its own). The one pairwise reading is
content twins': only for a consecutive pair's sheets, against their own file's, at most
`MAX_TWIN_READS` overlaps.

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
from itertools import pairwise
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
    StoreysSource,
    ViewCandidate,
    ViewKind,
    pattern_finditer,
    pattern_search,
)
from engine.recognise.views.storeys import FLOOR_TO_FLOOR

if TYPE_CHECKING:
    from engine.recognise.views import Described

RUNNING_LIMIT = 10**15
"""A running number this large or larger is no running number: every count made from running numbers
stays below 2**53, so a browser formats it exactly (a gap's count), and a running number is never too
long to print. A bound on what the code can say, not a threshold on what the drawings hold."""

COLUMN_SUBJECTS = FLOOR_TO_FLOOR
"""The subjects the column storey rule is for (17's floor-to-floor subjects: column, shear wall): a
range's top storey is where the next range of columns starts. An architectural plan read floor to floor
(any other subject) states every storey it names."""

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
    stated: Callable[[str], Sequence[str]] = lambda _: ()
    """The storey words a title states, each phrase verbatim (13's `storeys.read(text, conventions,
    plan_title=True).as_stated`, split at its ", "): what a title's stem leaves out (`_Twins`). A
    stand-in without it states none."""


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

        return Recognisers(
            sequence=unbound, storeys=unbound, symbolic=SYMBOLIC.__contains__, stated=unbound
        )
    bound = conventions

    def title_storeys(text: str) -> tuple[str, ...]:
        read = storeys.read(text, bound, plan_title=True)
        return (*read.keys, *([read.runs_to] if read.runs_to else []))

    def stated(text: str) -> tuple[str, ...]:
        found = storeys.read(text, bound, plan_title=True).as_stated
        return tuple(part for part in (found or "").split(", ") if part)

    return Recognisers(
        sequence=lambda number: sheets.sequence(number, bound),
        storeys=title_storeys,
        symbolic=SYMBOLIC.__contains__,
        stated=stated,
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
    files: Sequence[str | None] | None = None,
) -> list[Found]:
    """The set's Continuations, Series and Conflicts, by the rules above; `conventions` give each
    Discipline's prefixes (none: no prefix is a Discipline's own) and the member range pattern.
    `files` names each sheet's file (`files[i]` is `sheets[i]`'s) for content twins, which compare
    only sheets of one file: a caller holding sheets without their anchors gives it (the product's
    acts, PR #648); none, each sheet's file is its first anchor's."""
    given(sheets, views)
    if files is not None and len(files) != len(sheets):
        raise ValueError("files name one file per sheet")
    reader = _Reader(recognisers, Numbers(conventions, recognisers))
    numbers = [reader.key(sheet) for sheet in sheets]
    pattern = None if conventions is None else conventions.member_range_pattern
    cites = [reader.cites(s) for s in sheets]
    keyed = [
        (None, (), "") if s.title is None else _keyed(s.title.value, pattern, cites[i])
        for i, s in enumerate(sheets)
    ]
    titles = [key for key, _, _ in keyed]
    ranges = [found for _, found, _ in keyed]
    cleaned = [text for _, _, text in keyed]  # the text each title's ranges lie in
    places = _Places(len(sheets))  # where a sheet lies for `same_storey`: copies and runs are one
    plans = _Plans(sheets, numbers, reader)
    twins = _Twins(sheets, recognisers, conventions, files)

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
    carried: set[tuple[object, str, str, int]] = set()
    for s in sheets:  # every running number a sheet of a group and Discipline carries, in any suffix
        if s.discipline is None or s.number is None:
            continue
        if (parts := reader.parts(s)) is not None:
            carried.add((s.group, s.discipline.value, parts[0], parts[1]))
        for head_text, held in _held(reader, s.number.value):  # "S1-43.1" carries 43 too (#781)
            head = reader.numbers.parts_in(head_text + "0", s.discipline.value)
            if head is not None:
                carried.add((s.group, s.discipline.value, head[0], held))
    for group in _grouped(
        (i, (s.group, s.discipline.value, titles[i]))
        for i, s in enumerate(sheets)
        if s.discipline is not None and numbers[i] is not None and titles[i] is not None
    ):
        units = _grouped((i, numbers[i]) for i in group)
        if len(units) < 2:
            continue
        alone = [any(contradicted(sheets[i], views[i], conventions) for i in unit) for unit in units]

        spans = [_span([ranges[i] for i in unit]) for unit in units]
        gkey = (sheets[group[0]].group, sheets[group[0]].discipline.value)  # type: ignore[union-attr]

        successive = [_successive([ranges[i] for i in unit]) for unit in units]

        def crosses(
            u: int,
            prefix: str,
            running: int,
            step: int,
            gkey: tuple[object, str] = gkey,
            successive: list[bool] = successive,
        ) -> bool:
            """Whether unit `u`, its copies `step` numbers wide, may run on across the numbers a
            duplicate left out: its copies are successive ranges and no sheet carries any number
            between them, with any suffix."""
            return successive[u] and not any(
                (*gkey, prefix, n) in carried for n in range(running + 1, running + step)
            )

        drawn = [_Drawn(unit, views, reader) for unit in units]
        stale: list[bool] = []  # a consecutive pair parted because its views draw different things

        def fits(
            before: int,
            after: int,
            spans: list[list[_Span]] = spans,
            drawn: list[_Drawn] = drawn,
            stale: list[bool] = stale,
            units: list[list[int]] = units,
        ) -> bool:
            if not _ascending(spans[before], spans[after]):
                return False
            if drawn[before].differs(drawn[after]) or twins.apart(units[before], units[after]):
                stale.append(True)
                return False
            return True

        runs = _runs(units, [reader.parts(sheets[unit[0]]) for unit in units], alone, fits, crosses)
        members_of = [[i for unit in run for i in unit] for run in runs]
        for run, members in zip(runs, members_of, strict=True):
            places.join(members)
            if len(run) > 1:
                first, last = members[0], members[-1]
                title = _drawn(sheets[first])
                if ranges[first]:
                    title = _joined(cleaned[first], ranges[first], cleaned[last], ranges[last])
                continuation = Continuation(title, tuple(sheets[i] for i in members))
                continuations.append((min(members), continuation))
        if len(runs) > 1:
            ordered = [i for members in members_of for i in members]
            title = _drawn(sheets[ordered[0]])
            candidates = tuple(sheets[i] for i in ordered)
            if (
                not _blocking(units, alone, reader, sheets, spans, crosses)
                and not stale
                and _apart(members_of, views, ranges, reader, plans, pattern, cites)
            ):
                series.append((min(ordered), Series(title, candidates)))
                continue
            evidence = codes.SAME_TITLE(title=title, sheets=len(ordered))["params"]
            by_title.append((min(ordered), Conflict(SAME_TITLE, candidates, evidence)))

    by_storey = _same_storey(sheets, views, places, reader, pattern)
    found: list[Found] = [c for _, c in sorted(continuations, key=_first)]
    found.extend(s for _, s in sorted(series, key=_first))
    for batch in (by_number, by_title, by_storey):
        found.extend(conflict for _, conflict in sorted(batch, key=_first))
    return found


def _blocking(
    units: list[list[int]],
    alone: Sequence[bool],
    reader: _Reader,
    sheets: Sequence[SheetCandidate],
    spans: list[list[_Span]],
    crosses: Callable[[int, str, int, int], bool] | None = None,
) -> bool:
    """Whether a contradicted unit blocks its title's series: only one that, its contradiction set
    aside, would run on from or into another unit of its title (by number and ascending ranges, #102:
    a copied title block on the next sheet). One that runs on with none is told apart like any run
    (S19-B4's E2)."""
    if not any(alone):
        return False
    free = _runs(
        units,
        [reader.parts(sheets[unit[0]]) for unit in units],
        [False] * len(units),
        lambda before, after: _ascending(spans[before], spans[after]),
        crosses,
    )
    at = {id(unit): u for u, unit in enumerate(units)}  # by position: `_runs` returns the very units
    return any(len(run) > 1 and any(alone[at[id(unit)]] for unit in run) for run in free)


CEILING = "ceiling"
FLOOR = "floor"


def level(view: ViewCandidate) -> str:
    """The level a plan's storeys are drawn at: `ceiling` for 17's `at_ceiling_level` (what hangs
    under a storey's slab), else `floor` (at floor level, or floor to floor: both draw the storey's
    own floor). One storey at the two levels is two drawings."""
    return CEILING if view.storeys_meaning == StoreysMeaning.AT_CEILING_LEVEL else FLOOR


class _Drawn:
    """What one number's sheets (its copies) state they draw in their views, read when first asked:
    the storeys (not symbolic), each at its `level`, and the subjects (each view's, and those its
    title names)."""

    def __init__(
        self, unit: Sequence[int], views: Sequence[Sequence[ViewCandidate]], reader: _Reader
    ) -> None:
        self.unit, self.views, self.reader = unit, views, reader
        self._read: tuple[frozenset[str], frozenset[str]] | None = None

    def read(self) -> tuple[frozenset[str], frozenset[str]]:
        from engine.recognise.views import subjects  # 17's, imported where it is used

        if self._read is None:
            seen = [v for i in self.unit for v in self.views[i]]
            storeys = {f"{s}@{level(v)}" for v in seen for s in v.storeys if not self.reader.symbolic(s)}
            named = {v.subject for v in seen if v.subject is not None}
            named |= {key for v in seen if v.title for key in subjects(v.title)}
            self._read = frozenset(storeys), frozenset(named)
        return self._read

    def differs(self, other: _Drawn) -> bool:
        """Whether the two state different storeys or different subjects: each states some, and
        none is shared (a stale title block on the next sheet; the owner's ruling of 5 Oct 2026)."""
        return any(a and b and not a & b for a, b in zip(self.read(), other.read(), strict=True))


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

    def printed(self, number: str) -> tuple[str, int, str] | None:
        """The number's prefix, running number and suffix as its clean form prints them
        (`number_parts`), or none; a revision mark written after it ("S-01 R1") split off first
        (#100), so its digits never make a running number. Each number is read once."""
        if number not in self._read:
            unrevised = split_revision(number, self.revision)[0]
            self._read[number] = number_parts(self.recognisers, unrevised)
        return self._read[number]

    def parts(self, number: str) -> tuple[str, int, str] | None:
        """The number's (prefix mark, running number, suffix mark), or none (`printed`)."""
        parts = self.printed(number)
        return None if parts is None else (mark(parts[0]), parts[1], mark(parts[2]))

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

    def cites(self, sheet: SheetCandidate) -> Callable[[str], bool] | None:
        """What tells a mark on the sheet as a sheet number its titles cite: one that reads within the
        sheet's Discipline with its own prefix ("S-12" on a Structural sheet; "B-1" or "F-1" not), or
        none for a sheet with no Discipline."""
        if sheet.discipline is None:
            return None
        discipline = sheet.discipline.value

        def cited(text: str) -> bool:
            parts = self.numbers.parts_in(text, discipline)
            return parts is not None and parts[0] == ""

        return cited

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
    crosses: Callable[[int, str, int, int], bool] | None = None,
) -> list[list[list[int]]]:
    """The units (copies of one number) joined into runs of numbers that run on, in number order (a
    part by its number: "S-01/9" before "S-01/10", #100); a unit `alone` joins none (#102), and a
    unit joins the next only when it `fits` before it (member ranges that ascend). A unit of several
    copies (a duplicated number, its own same_number Question) leaves a gap of as many numbers less
    one: it may run on across them when `crosses` allows (its copies are different drawings, and no
    sheet carries a number in the gap)."""
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
        for u in members:
            after = by_running.get((prefix, suffix, running + 1))
            step = len(units[u])
            if after is None and step > 1 and crosses is not None and crosses(u, prefix, running, step):
                after = by_running.get((prefix, suffix, running + step))
            if after is not None and fits(u, after[0]):
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
    """A range of member marks as a title draws it ("GB2-GB5", "W3 TO W6"): the marks' letters (in
    normal form, one for both), the lowest and highest number, where it lies in the drawn text
    (`at` to `end`; `high_at` where its second mark starts), and whether a mark is `hyphenated` (a
    joiner between its letters and its number, "B-1": such marks restart on every floor)."""

    letters: str
    low: int
    high: int
    at: int
    high_at: int
    end: int
    hyphenated: bool = False


RANGE_DIGITS = len(str(RUNNING_LIMIT)) - 1
"""The most digits a mark's number may have: one of `RUNNING_LIMIT` or more is no range."""


def member_ranges(
    text: str, pattern: str | None, cited: Callable[[str], bool] | None = None
) -> tuple[MemberRange, ...]:
    """The member ranges a text draws, by the conventions' pattern (none: none); a match whose marks'
    letters differ or are missing, whose numbers are missing, not decimal digits, descend or reach
    `RUNNING_LIMIT` is no range, nor a range of hyphenated marks `cited` tells as sheet numbers
    ("SEE S-12 TO S-14": its first mark as written, `_Reader.cites`). A text longer than a pattern
    runs on has none (`pattern_finditer`).
    Titles are read in their clean form (`_keyed`), so a format character or a fullwidth digit never
    hides a range their normal form shows."""
    if pattern is None:
        return ()
    found = []
    for match in pattern_finditer(pattern, text):
        low, high = match.group("low"), match.group("high")
        if not (low and high and low.isdecimal() and high.isdecimal()):
            continue  # a pattern of the conventions' may leave a mark's number out, or read letters
        if len(low) > RANGE_DIGITS or len(high) > RANGE_DIGITS:
            continue
        letters = normal(match.group("a"))
        if letters is None or letters != normal(match.group("b")) or int(low) > int(high):
            continue
        hyphenated = match.end("a") < match.start("low") or match.end("b") < match.start("high")
        if hyphenated and cited is not None and cited(text[match.start("a") : match.end("low")]):
            continue  # sheets cited, never members
        found.append(
            MemberRange(
                letters, int(low), int(high), match.start(), match.start("b"), match.end(), hyphenated
            )
        )
    return tuple(found)


def range_key(
    title: str, pattern: str | None, cited: Callable[[str], bool] | None = None
) -> Hashable | None:
    """What a title is grouped by: its normal form, or, when it draws member ranges, the normal forms
    of the words around them ("GRADE BEAM GB2-GB5 DETAILS" and "GRADE BEAM GB6-GB9 DETAILS" are one
    title, never "GRADE BEAM DETAILS"); none when nothing is left."""
    return _keyed(title, pattern, cited)[0]


def _keyed(
    title: str, pattern: str | None, cited: Callable[[str], bool] | None = None
) -> tuple[Hashable | None, tuple[MemberRange, ...], str]:
    """A title's key (`range_key`), its ranges, and the clean text they lie in: the ranges are read
    in the title's clean form, whose case folded is its normal form, so the key never parts titles
    the normal form joins."""
    text = clean(title)
    whole = text.casefold() or None
    found = member_ranges(text, pattern, cited) if whole is not None else ()
    if not found:
        return whole, (), text
    edges = [0, *(i for r in found for i in (r.at, r.end)), len(text)]
    words = tuple(normal(text[a:b]) or "" for a, b in zip(edges[::2], edges[1::2], strict=True))
    return ("ranged", *words), found, text


type _Span = tuple[str | None, int, int]
"""One range of a number's copies: their letters (none when they differ), lowest and highest."""


def _span(copies: Sequence[Sequence[MemberRange]]) -> list[_Span]:
    """The ranges of one number's copies (one key, so as many each), each spanning all of them."""
    spans: list[_Span] = []
    for alike in zip(*copies, strict=True):
        letters = {r.letters for r in alike}
        one = letters.pop() if len(letters) == 1 else None
        spans.append((one, min(r.low for r in alike), max(r.high for r in alike)))
    return spans


def _ascending(before: Sequence[_Span], after: Sequence[_Span]) -> bool:
    """Whether a number's ranges run on to the next's: each of one letters, every copy's below every
    copy of the next's, or touching it at one mark."""
    return all(
        a[0] is not None and a[0] == b[0] and (a[2] < b[1] or _touches(a, b))
        for a, b in zip(before, after, strict=True)
    )


_LEADING = re.compile(r"([^\W\d_]+[\W_]*|)(\d{1,4})")
"""A number's first running number, the letters and separators before it kept ("S-43.1": "S-", 43)."""


def _held(reader: _Reader, number: str) -> list[tuple[str, int]]:
    """The running numbers a number holds besides its own, each with the text before it: its first
    (`_LEADING`), and the one before its part ("S1-43.1" and "S-1.43.1" hold 43, under "S1-" and
    "S-1."; #781), the digits that end 13's prefix before its separators."""
    held = [(lead[1], int(lead[2]))] if (lead := _LEADING.match(clean(number))) is not None else []
    parts = reader.numbers.printed(number)
    if parts is not None:
        prefix = parts[0]
        end = len(prefix)
        while end and not prefix[end - 1].isalnum():
            end -= 1
        start = end
        while start and end - start < 4 and prefix[start - 1].isdecimal():
            start -= 1
        if start < end < len(prefix) and not (start and prefix[start - 1].isdecimal()):
            held.append((prefix[:start], int(prefix[start:end])))
    return held


def _successive(copies: Sequence[Sequence[MemberRange]]) -> bool:
    """Whether a number's copies are different drawings of one member family: each draws ranges, and
    the copies' ranges, taken in order of their lowest mark, ascend one after the other (touching at
    a mark allowed). Copies with no range, or drawing the same or overlapping ranges, are one
    drawing twice, never the next sheet the number left out."""
    if len(copies) < 2 or not all(copies) or len({len(c) for c in copies}) != 1:
        return False
    spans = sorted((_span([c]) for c in copies), key=lambda one: one[0][1])
    return all(_ascending(a, b) for a, b in pairwise(spans))


def _touches(a: _Span, b: _Span) -> bool:
    """Whether two ranges share exactly their one boundary mark, each a range of more than one mark:
    a member continued on the next sheet runs on."""
    return a[1] < a[2] == b[1] < b[2]


def _joined(first: str, firsts: Sequence[MemberRange], last: str, lasts: Sequence[MemberRange]) -> str:
    """A run's title: the first sheet's as drawn, each range running on to the last sheet's second
    mark ("GRADE BEAM GB2-GB5 DETAILS" to "GRADE BEAM GB10-GB14 DETAILS": "GRADE BEAM GB2-GB14
    DETAILS")."""
    text = first
    for a, b in reversed(list(zip(firsts, lasts, strict=True))):
        text = text[: a.high_at] + last[b.high_at : b.end] + text[a.end :]
    return text


_MARK = re.compile(r"(?<![^\W_])([^\W\d_]{1,3})(\d{1,4})(?![^\W_])")
"""A single member mark in a view's title: a word of one to three letters then one to four digits
("GRADE BEAM GB7", "C12"), the marks the member range pattern joins."""


_SIZE_TIMES = re.compile(r"(?<=\d)(\s*(?:(?:''|[\"'\u2032\u2033]|mm|cm)\s*)?)[xX\u00d7](?=\s*\d)")
"""The times sign of a section size ('11"X17"', '9" x 13"', "230x300", "500 mm X 500"): a digit, its
unit or none, spaces, an x, then a digit. Its x and the next number are no member mark (S19-B4's E1).
Spaces are read once, never by two quantifiers in a row: a view's title is read raw, and a long run of
spaces must not cost a square of its length."""


def unsized(text: str) -> str:
    """The text with each section size's times sign made a space, so its second number reads as no
    member mark ('B-1, 11"X23"' names no mark `X23`)."""
    return _SIZE_TIMES.sub(lambda match: match.group(1) + " ", text)


def _named(ranges: Iterable[MemberRange], hyphenated: bool = False) -> list[tuple[str, int, int]]:
    """The ranges a series reads, each an interval: a range of hyphenated marks ("B-1 TO B-6") is
    left unread, as a single "B-1" is (`_MARK`), since such marks restart on every floor, unless
    `hyphenated` reads it (`_apart`'s first reading)."""
    return [(r.letters, r.low, r.high) for r in ranges if hyphenated or not r.hyphenated]


def _marks(
    text: str,
    pattern: str | None,
    hyphenated: bool = False,
    cited: Callable[[str], bool] | None = None,
) -> list[tuple[str, int, int]]:
    """The member marks a view's title names, each an interval: its ranges and its single marks; a
    section size is no mark (`unsized`), nor a range of hyphenated marks (`_named`) or of cited
    sheets (`member_ranges`)."""
    found = _named(member_ranges(clean(text), pattern, cited), hyphenated)
    for match in _MARK.finditer(unsized(text)):
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
    cites: Sequence[Callable[[str], bool] | None],
) -> bool:
    """Whether a title's runs draw different things (a series): by every mark read, a hyphenated
    range ("RB-1 - RB-5" against "REB-2 - REB-4") telling runs apart when no two overlap; else by
    the marks unhyphenated only, since hyphenated marks restart on every floor ("B-1 TO B-6" on each
    floor's details: the floor of the plan before each run parts them, S19-B4's E1)."""
    if _drawn_apart(runs, views, ranges, reader, plans, pattern, cites, True):
        return True
    return _drawn_apart(runs, views, ranges, reader, plans, pattern, cites, False)


def _drawn_apart(
    runs: Sequence[Sequence[int]],
    views: Sequence[Sequence[ViewCandidate]],
    ranges: Sequence[Sequence[MemberRange]],
    reader: _Reader,
    plans: _Plans,
    pattern: str | None,
    cites: Sequence[Callable[[str], bool] | None],
    hyphenated: bool,
) -> bool:
    """Whether a title's runs draw different things, by what each run draws: (a) the
    storeys its views state, (b) the member marks its views' titles and its own titles' ranges name
    (hyphenated ones only when `hyphenated`, `_named`; none citing sheets, `cites[i]` the sheet's),
    and (c) only when it has neither, the storeys of the plan views of the nearest plan sheet before
    it, or, when that plan states only symbolic storeys, a layer: its own titles' (17's `describe`),
    else that plan's views' (S19-B4's E3; keyed `layer:<key>`, so a layer never equals a storey).
    Apart when every run draws something and no two share a storey or overlap in marks."""
    from engine.recognise.views import describe  # 17's, imported where it is used

    storeys_of: dict[str, int] = {}
    marks: list[tuple[str, int, int, int]] = []
    for run, members in enumerate(runs):
        storeys = {s for i in members for v in views[i] for s in v.storeys if not reader.symbolic(s)}
        named = [m for i in members for m in _named(ranges[i], hyphenated)]
        named += [
            m
            for i in members
            for v in views[i]
            if v.title
            for m in _marks(v.title, pattern, hyphenated, cites[i])
        ]
        if not storeys and not named and (plan := plans.before(members[0])) is not None:
            storeys = {
                s
                for v in views[plan]
                if v.kind == ViewKind.PLAN
                for s in v.storeys
                if not reader.symbolic(s)
            }
            if not storeys:  # a plan of a symbolic storey (a tank's): its layer tells the runs apart
                titles = (plans.sheets[i].title for i in members)
                layers = {
                    str(d.layer) for t in titles if t and (d := describe(t.value)).layer is not None
                }
                if not layers:
                    layers = {
                        str(v.layer)
                        for v in views[plan]
                        if v.kind == ViewKind.PLAN and v.layer is not None
                    }
                storeys = {LAYER_KEY + layer for layer in layers}
        if not storeys and not named:
            return False  # what was not read is not different
        if any(storeys_of.setdefault(storey, run) != run for storey in storeys):
            return False
        marks += [(letters, low, high, run) for letters, low, high in named]
    return not _overlap(marks)


LAYER_KEY = "layer:"
"""How `_apart` keys a run's layer beside its storeys, so a layer never equals a storey."""


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
    titled = [v.title for v in views if v.title]
    if not titled:
        return False  # both rules need a titled view: the title is not read for nothing
    named = subjects(sheet.title.value)
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
    pattern: str | None = None,
) -> list[tuple[int, Conflict]]:
    """One storey drawn twice, by the module's rules: each (bucket, storey) gathers its views, and the
    views are grouped by the set they make. A bucket holds one class of sheet (`sheet_class`): a
    layout sheet's plan is never compared with a details sheet's plan views (the owner's ruling of
    5 Oct 2026: a details sheet's enlarged plan shares its layout's subject and storey)."""
    flat: list[tuple[ViewCandidate, int, int]] = []  # each plan view: its sheet's place, its sheet
    sharing: dict[tuple[tuple[str, str, str, str, str, str], str], list[int]] = {}
    for i, sheet in enumerate(sheets):
        if sheet.discipline is None or sheet_name(sheet) is None:
            continue
        kind: str | None = None  # the sheet's class, read once it has a plan view to compare
        for view in views[i]:
            if view.kind != ViewKind.PLAN or view.subject is None:
                continue
            if view.storeys_source == StoreysSource.TITLE_LINE:
                continue  # a part plan (a bath's): its floors from its title's line (17's storeys)
            kind = kind or sheet_class(sheet)
            layer = NO_LAYER if view.layer is None else str(view.layer)
            bucket = (str(sheet.group), sheet.discipline.value, view.subject, layer, kind, level(view))
            flat.append((view, places.of(i), i))
            storeys = [storey for storey in view.storeys if not reader.symbolic(storey)]
            if (
                view.storeys_meaning == StoreysMeaning.FLOOR_TO_FLOOR
                and view.subject in COLUMN_SUBJECTS
                and len(storeys) > 1
            ):  # the column storey rule: a column or shear-wall plan's alone (S22-FL5)
                storeys = storeys[:-1]  # its top end is where the next range of columns starts
            for storey in storeys:
                sharing.setdefault((bucket, storey), []).append(len(flat) - 1)
    sets: dict[tuple[tuple[str, str, str, str, str, str], tuple[int, ...]], list[str]] = {}
    named: dict[int, list[tuple[str, int, int]]] = {}  # each plan's marks, read once it is compared
    for (bucket, storey), sharers in sharing.items():
        if len({flat[v][1] for v in sharers}) > 1:
            for v in sharers:
                if v not in named:
                    named[v] = plan_marks(flat[v][0].title, pattern)
            sharers = _paired(sharers, [flat[v][1] for v in sharers], [named[v] for v in sharers])
        if len({flat[v][1] for v in sharers}) > 1:
            sets.setdefault((bucket, tuple(sharers)), []).append(storey)
    found = []
    for ((_, discipline, subject, layer, _, _), members), storeys in sets.items():
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
            alone="no",  # its two sheets lie at two places; 21c says when those it holds do not
            discipline=discipline,
            subject=subject,
            storey=storeys[0],
        )["params"]
        candidates = tuple(flat[v][0] for v in members)
        places_of = tuple(flat[v][1] for v in members)
        found.append((members[0], Conflict(SAME_STOREY, candidates, evidence, places_of)))
    return found


_PLAN_MARK = re.compile(
    r"(?<![^\W_])([^\W\d_]{1,3}|[^\W\d_](?:\.[^\W\d_]){1,2}\.?)-?(\d{1,4})(?![^\W_])"
)
"""A member mark in a plan's title, for `same_storey`: one to three letters, or letters with dots
between ("P.C"), then a hyphen or none, then one to four digits, a word each side ("CAP P.C-1",
"PC1", "B-2"). Never words and numbers apart ("LEVELS 2 TO 5": a space is no part of a mark)."""


def plan_marks(title: str | None, pattern: str | None) -> list[tuple[str, int, int]]:
    """The member marks a plan's title names, each an interval (letters, dots dropped, in normal form):
    its ranges (the conventions' pattern) and its single marks; a section size is no mark
    (`unsized`). None for no title."""
    if not title:
        return []
    text = unsized(clean(title))
    found = [(r.letters, r.low, r.high) for r in member_ranges(text, pattern)]
    for match in _PLAN_MARK.finditer(text):
        letters = normal(match.group(1).replace(".", ""))
        if letters is not None:
            number = int(match.group(2))
            found.append((letters, number, number))
    return found


def _paired(
    sharers: Sequence[int], places: Sequence[int], marks: Sequence[Sequence[tuple[str, int, int]]]
) -> list[int]:
    """The plans of one (bucket, storey) that pair with a plan at another place: two plans pair unless
    both titles name member marks and none in common (S19-B4's E6: one pile cap's plan is not
    another's). `places[k]` and `marks[k]` are `sharers[k]`'s. In one sort: an interval meets one of
    another place when, among the intervals starting at or below its end (of its letters), the
    highest end of another place reaches its start."""
    bare = [k for k in range(len(sharers)) if not marks[k]]
    bare_places = {places[k] for k in bare}
    every = set(places)
    keep = [False] * len(sharers)
    for k in range(len(sharers)):
        if marks[k]:
            keep[k] = bool(bare_places - {places[k]})  # a plan naming no mark pairs with every plan
        else:
            keep[k] = len(every) > 1
    spans = sorted(
        (letters, low, high, k) for k in range(len(sharers)) for letters, low, high in marks[k]
    )
    by_letters: dict[str, tuple[list[int], list[tuple[int, int, int, int]]]] = {}
    best = second = (-1, -1)  # the prefix's highest end, and the highest of another place than its
    for letters, low, high, k in spans:
        if letters not in by_letters:
            by_letters[letters] = ([], [])
            best = second = (-1, -1)
        place = places[k]
        if place == best[1]:
            best = (max(best[0], high), place)
        elif high > best[0]:
            best, second = (high, place), best
        elif high > second[0]:
            second = (high, place)
        lows, tops = by_letters[letters]
        lows.append(low)
        tops.append((*best, *second))
    for letters, low, high, k in spans:
        if keep[k]:
            continue
        lows, tops = by_letters[letters]
        at = bisect.bisect_right(lows, high) - 1  # the last interval starting at or below its end
        best_high, best_place, second_high, _ = tops[at]
        other = best_high if best_place != places[k] else second_high
        keep[k] = other >= low
    return [sharers[k] for k in range(len(sharers)) if keep[k]]


TWIN = 0.9
"""A near twin's least weighted layer overlap (`_shared`; the session-19 analysis of stale-title
pairs measured E-16/E-17-like twins at 0.96 and above, and true continuations at 0.07 to 0.57)."""

MAX_TWIN_READS = 4_000_000
"""The most layer entries one comparison reads for content twins (an overlap of two histograms costs
both their lengths): past it a sheet has no near twin and a pair is never parted by the rule (it
stays as the other rules leave it)."""


SHORT = 3
"""A stem leaves out words of this many letters or fewer: joining words never part two stems (a
word that short and meaningful, "cap", "fan", only makes two stems one: the rule then sits out)."""


def _shared(a: dict[str, int], b: dict[str, int]) -> float:
    """Two layer histograms' weighted overlap: the sum over layers of the lesser count over the sum of
    the greater (1 the same content, 0 nothing shared)."""
    high = sum(max(count, b.get(layer, 0)) for layer, count in a.items())
    high += sum(count for layer, count in b.items() if layer not in a)
    low = sum(min(count, b.get(layer, 0)) for layer, count in a.items())
    return low / high if high > 0 else 0.0


def _source(sheet: SheetCandidate) -> str | None:
    """The file a sheet was read from (its first anchor's), or none."""
    if not sheet.anchors:
        return None
    source: str | None = getattr(sheet.anchors[0], "source_sha256", None)
    return source


class _Twins:
    """The content-twin rule (the module's rules): each sheet's near twins in its own file, read once
    and only for sheets a pair asks about, and each twin's title stem."""

    def __init__(
        self,
        sheets: Sequence[SheetCandidate],
        recognisers: Recognisers,
        conventions: SheetConventions | None,
        files: Sequence[str | None] | None = None,
    ) -> None:
        self.sheets = sheets
        self.sources = [_source(s) for s in sheets] if files is None else list(files)
        self.recognisers = recognisers
        self.pattern = None if conventions is None else conventions.member_range_pattern
        words = (
            ()
            if conventions is None
            else (
                *conventions.floor_words,
                *conventions.level_words,
                *conventions.range_words,
                *conventions.list_words,
                *conventions.weak_storey_words,
            )
        )
        self.skip = frozenset(w for phrase in words for w in phrase.casefold().split())
        self.layers = [dict(s.layers) for s in sheets]
        self.totals = [sum(layers.values()) for layers in self.layers]
        self.files: dict[tuple[str | None, str], list[int]] = {}
        for i, sheet in enumerate(sheets):
            source = self.sources[i]
            if source is not None and self.layers[i]:
                self.files.setdefault((sheet.group, source), []).append(i)
        self.near: dict[int, list[tuple[float, int]]] = {}
        self.stems: dict[int, tuple[str, ...] | None] = {}
        self.reads = MAX_TWIN_READS  # read when the first `_Twins` is made, so tests may set it

    def apart(self, first: Sequence[int], second: Sequence[int]) -> bool:
        """Whether two consecutive places of one title draw different things: each (its first copy)
        has a near twin outside the two, no twin of one shares a title stem with a twin of the other,
        and each is closer to its nearest twin than to the other."""
        a, b = first[0], second[0]
        if not self.layers[a] or not self.layers[b]:
            return False
        out = {*first, *second}
        near_a = [(w, j) for w, j in self._near(a) if j not in out]
        near_b = [(w, j) for w, j in self._near(b) if j not in out]
        if not near_a or not near_b:
            return False
        stems_a = {self._stem(j) for _, j in near_a}
        stems_b = {self._stem(j) for _, j in near_b}
        if None in stems_a or None in stems_b or stems_a & stems_b:
            return False
        if not self._take(a, b):
            return False
        pair = _shared(self.layers[a], self.layers[b])
        return pair < max(w for w, _ in near_a) and pair < max(w for w, _ in near_b)

    def _near(self, i: int) -> list[tuple[float, int]]:
        """The titled sheets of `i`'s group and file whose overlap with it is `TWIN` or more."""
        held = self.near.get(i)
        if held is not None:
            return held
        sheet = self.sheets[i]
        source = self.sources[i]
        found: list[tuple[float, int]] = []
        mine, total = self.layers[i], self.totals[i]
        for j in [] if source is None else self.files.get((sheet.group, source), []):
            if j == i or self.sheets[j].title is None:
                continue
            if min(total, self.totals[j]) < TWIN * max(total, self.totals[j]):
                continue  # the totals alone keep the overlap below `TWIN`
            if not self._take(i, j):
                found = []  # past the bound: no twins, so the rule sits out
                break
            w = _shared(mine, self.layers[j])
            if w >= TWIN:
                found.append((w, j))
        self.near[i] = found
        return found

    def _take(self, i: int, j: int) -> bool:
        """Spend the reads one overlap of `i` and `j` costs, or refuse past `MAX_TWIN_READS`."""
        cost = len(self.layers[i]) + len(self.layers[j])
        if cost > self.reads:
            self.reads = 0
            return False
        self.reads -= cost
        return True

    def _stem(self, j: int) -> tuple[str, ...] | None:
        """A title's stem: its words (letters only, case folded) without the storeys it states, its
        member-mark ranges, the conventions' floor, level, range, list and weak storey words, or any
        word of `SHORT` letters or fewer (an ordinal's suffix, "for", "of"): so one drawing type over
        several floors or mark ranges, worded with or without a joining word, is one stem. None when
        nothing is left."""
        if j in self.stems:
            return self.stems[j]
        title = self.sheets[j].title
        assert title is not None
        text = clean(title.value)
        stated = self.recognisers.stated(text)
        if isinstance(stated, str) or not all(isinstance(part, str) for part in stated):
            raise TypeError(f"a title's stated storeys are a list of text, not {stated!r}")
        for part in stated:
            if part:
                text = text.replace(part, " ")
        for found in reversed(member_ranges(text, self.pattern)):
            text = text[: found.at] + " " + text[found.end :]
        words = tuple(
            w for w in re.findall(r"[^\W\d_]+", text.casefold()) if len(w) > SHORT and w not in self.skip
        )
        stem = words or None
        self.stems[j] = stem
        return stem
