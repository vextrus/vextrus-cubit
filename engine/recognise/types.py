"""The recognisers' vocabulary: what they propose, and the conventions they read with.

Fixed by ticket 06b under the M0 plan's contracts ("Conventions", "Candidate types"), so the
recognisers (13, 17), the Plot (18), the Checks and conflicts (19b) and the harness and its export (06b)
build against one set of types at once. Every type is a frozen value; the harness carries them between
processes by pickle and writes them to the export by `engine.export`.

- **No list of Disciplines** (the M0 plan's review Q8; docs/data-model.md §3.2). A Discipline is a key
  the conventions carry (`SheetConventions.disciplines`: the Market's Library rows in the product, the
  conventions file in the harness); a candidate holds the key as a string.
- **The group** is an opaque key the caller stamps on every sheet from its file (the file's Building;
  one group in M0). The engine knows no Building; conflicts and Checks compare only within a group.
- **Where a value was read** (`ValueSource`): a title-block attribute, text by its place in the title
  block, the file's name ("R0, from the file name"; "Final" is not a mark), or the file itself.
- **The lists M0 fixes** are here once: the ten view kinds and the seven exclusion reasons.
- **Coverage** is what a view's proposal says: its Takeoff Steps or its Discipline Part (assigned), its
  exclusion (excluded), or neither (unaccounted). A view may be proposed to steps and a Part at once
  (a toilet detail to steps 11 and 12 and to the Plumbing and sanitary Part); an excluded view has
  neither.

Takeoff Steps, canonical storeys, subjects and conflict kinds are keys held by value: the steps are
Library rows (19a), the storeys `engine/recognise/storeys.py`'s (13), the subjects the conventions'.
"""

import functools
import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from re import _constants, _parser  # type: ignore[attr-defined]  # a pattern parsed to bound it
from typing import Any

from engine.messages import Message, Param
from engine.read.anchor import Anchor, DwgAnchor, PdfAnchor

_KEY = re.compile(r"[a-z][a-z0-9_]*")
_CODE = re.compile(r"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+")

type Group = str
"""A candidate's group: an opaque key its caller stamps from the file (M0: one group per set)."""


def _key(value: str, what: str) -> str:
    if not isinstance(value, str) or not _KEY.fullmatch(value):
        raise ValueError(f"{what} {value!r} is not a lower-case key")
    return value


def _unique(values: Sequence[str], what: str) -> None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            raise ValueError(f"{what} {value!r} is given twice")
        seen.add(value)


def _text(value: str | None, what: str) -> None:
    if value is not None and not isinstance(value, str):
        raise TypeError(f"{what} is text, not {type(value).__name__}")
    if value is not None and not value.strip():
        raise ValueError(f"{what} is empty; leave it out instead")


def _is(value: object, kind: Any, what: str) -> None:
    """Refuse a value of the wrong type, so a stage returning one fails there, not in the export."""
    if not isinstance(value, kind):
        raise TypeError(f"{what} is not {getattr(kind, '__name__', kind)}: {type(value).__name__}")


def _tuple_of(values: object, kind: Any, what: str) -> None:
    _is(values, tuple, what)
    for value in values:  # type: ignore[attr-defined]
        _is(value, kind, f"an item of {what}")


def _number(value: object, what: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise ValueError(f"{what} is a finite number, not {value!r}")


def _anchors(anchors: object) -> None:
    _tuple_of(anchors, DwgAnchor | PdfAnchor, "the anchors")


def _params(params: object, what: str) -> None:
    _is(params, Mapping, what)
    for name, value in params.items():  # type: ignore[attr-defined]
        _is(name, str, f"a name in {what}")
        if isinstance(value, bool) or not isinstance(value, str | int):
            raise TypeError(f"{what}' {name} is a string or an integer, not {value!r}")


# The lists M0 fixes -------------------------------------------------------------------------------


class ViewKind(StrEnum):
    """The one list of view kinds (docs/data-model.md §3.2)."""

    PLAN = "plan"
    SECTION = "section"
    ELEVATION = "elevation"
    SCHEDULE = "schedule"
    DETAIL = "detail"
    NOTES = "notes"
    LEGEND = "legend"
    TITLE_BLOCK = "title_block"
    KEY_PLAN = "key_plan"
    PERSPECTIVE = "perspective"
    """3D/perspective: excluded by default as `for_information`."""


class ExclusionReason(StrEnum):
    """The seven exclusion reasons, for sheets and views alike (the M0 plan's review Q9)."""

    SUPERSEDED = "superseded"
    DUPLICATE = "duplicate"
    """A duplicate, or another Discipline's copy ("the structural set governs")."""
    COVER_INDEX = "cover_index"
    """A cover or index; its drawing list is kept."""
    FOR_INFORMATION = "for_information"
    """Presentation, 3D or for information."""
    BY_OTHERS = "by_others"
    """By others: not in this Estimate."""
    BLANK = "blank"
    """Nothing to measure: a base plan only."""
    OTHER = "other"
    """Any other reason, given as text."""


class ValueSource(StrEnum):
    """Where a sheet's value was read (docs/data-model.md §3.2, SheetRevision's sources)."""

    TITLE_BLOCK_ATTRIBUTE = "title_block_attribute"
    TITLE_BLOCK_TEXT = "title_block_text"
    """Text found by its place in the title block."""
    FILE_NAME = "file_name"
    FILE = "file"
    """The file itself: its Discipline default, for example."""


class StoreysMeaning(StrEnum):
    """What a plan view's storey list means."""

    AT_FLOOR_LEVEL = "at_floor_level"
    """The members at those floor levels (a beam layout of the 1st floor slab)."""
    FLOOR_TO_FLOOR = "floor_to_floor"
    """The storeys, floor to floor (a column layout from the 1st to the 10th floor)."""


class Layer(StrEnum):
    """Which layer of a two-layer drawing a view draws (a slab's top or bottom bars)."""

    TOP = "top"
    BOTTOM = "bottom"


class CheckOutcome(StrEnum):
    PASSED = "passed"
    FIRED = "fired"
    """The Check found something: its finding says what, and the product raises a Question."""


# Values ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Box:
    """An axis-aligned box: in drawing units, on a page, or (in conventions) as fractions of a frame."""

    x0: float
    y0: float
    x1: float
    y1: float

    def __post_init__(self) -> None:
        for v in (self.x0, self.y0, self.x1, self.y1):
            _number(v, "a box's coordinate")
        if self.x0 > self.x1 or self.y0 > self.y1:
            raise ValueError(f"{self} has a corner past its opposite")

    def to_json(self) -> list[float]:
        return [self.x0, self.y0, self.x1, self.y1]

    @classmethod
    def from_json(cls, value: Any) -> Box:
        if not isinstance(value, list) or len(value) != 4:
            raise ValueError(f"a box is four numbers [x0, y0, x1, y1], not {value!r}")
        if not all(isinstance(v, int | float) and not isinstance(v, bool) for v in value):
            raise ValueError(f"a box is four numbers [x0, y0, x1, y1], not {value!r}")
        return cls(*(float(v) for v in value))


@dataclass(frozen=True)
class Sourced:
    """A value with where it was read.

    For a number, title, revision mark, issue date or storeys, the value is the text as the drawing
    states it, decoded (11's `engine.text.decode`) and never normalised; for a Discipline, it is the
    Discipline's key from the conventions.
    """

    value: str
    source: ValueSource

    def __post_init__(self) -> None:
        _is(self.value, str, "a sourced value")
        _text(self.value, "a sourced value")
        ValueSource(self.source)


@dataclass(frozen=True)
class SheetLocation:
    """Where a sheet is in its file: a layout, by name, or a frame's box in model space; one of them."""

    layout: str | None = None
    box: Box | None = None

    def __post_init__(self) -> None:
        if (self.layout is None) == (self.box is None):
            raise ValueError("a sheet is in a layout or in a model-space box, exactly one")
        _text(self.layout, "a layout's name")
        if self.box is not None:
            _is(self.box, Box, "a sheet's box")


@dataclass(frozen=True)
class Exclusion:
    """A proposal to leave a sheet or view out, with one of the seven reasons (text only for `other`)."""

    reason: ExclusionReason
    text: str | None = None

    def __post_init__(self) -> None:
        ExclusionReason(self.reason)
        if (self.reason == ExclusionReason.OTHER) != (self.text is not None):
            raise ValueError("an exclusion gives text exactly when its reason is `other`")
        _text(self.text, "an exclusion's text")


# Candidates -----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class SheetCandidate:
    """A sheet the recogniser (13) proposes. `group` is left unset by it; the caller stamps it."""

    location: SheetLocation
    number: Sourced | None = None
    title: Sourced | None = None
    discipline: Sourced | None = None
    """The Discipline's key, one the conventions carry."""
    revision_mark: Sourced | None = None
    issue_date: Sourced | None = None
    storeys_as_stated: Sourced | None = None
    """The title's storey words, verbatim; the sheet's storeys are its views' lists together."""
    exclusion: Exclusion | None = None
    anchors: tuple[Anchor, ...] = ()
    group: Group | None = None

    @property
    def blank(self) -> bool:
        """Proposed out as blank (a stale layout): its title block's values are shown, never compared,
        matched or listed as a live sheet's (13's docstring)."""
        return self.exclusion is not None and self.exclusion.reason == ExclusionReason.BLANK

    def __post_init__(self) -> None:
        _is(self.location, SheetLocation, "a sheet's location")
        for name in (
            "number",
            "title",
            "discipline",
            "revision_mark",
            "issue_date",
            "storeys_as_stated",
        ):
            value = getattr(self, name)
            if value is not None:
                _is(value, Sourced, f"a sheet's {name}")
        if self.discipline is not None:
            _key(self.discipline.value, "a sheet's Discipline")
        if self.exclusion is not None:
            _is(self.exclusion, Exclusion, "a sheet's exclusion")
        _anchors(self.anchors)
        _text(self.group, "a sheet's group")


@dataclass(frozen=True)
class ViewCandidate:
    """A view of one sheet that the recogniser (17) proposes, with what it proposes to do with it."""

    box: Box
    kind: ViewKind
    title: str | None = None
    """Decoded, as drawn."""
    not_to_scale: bool = False
    stated_scale: str | None = None
    """Verbatim, as drawn (metric, imperial or N.T.S.)."""
    storeys_as_stated: str | None = None
    storeys: tuple[str, ...] = ()
    """An explicit list of canonical storeys (13's `storeys.py`), never a first-to-last range."""
    storeys_meaning: StoreysMeaning | None = None
    subject: str | None = None
    """What a plan draws (a key of the conventions' subject words)."""
    layer: Layer | None = None
    steps: tuple[str, ...] = ()
    """The Takeoff Steps proposed to read it, by key (several allowed)."""
    part: str | None = None
    """The Discipline Part it is assigned to (an MEP view, or a legend), by its Discipline's key."""
    exclusion: Exclusion | None = None
    anchors: tuple[Anchor, ...] = ()

    def __post_init__(self) -> None:
        _is(self.box, Box, "a view's box")
        ViewKind(self.kind)
        _is(self.not_to_scale, bool, "a view's not-to-scale")
        _text(self.title, "a view's title")
        _text(self.stated_scale, "a stated scale")
        _text(self.storeys_as_stated, "a view's storeys as stated")
        if bool(self.storeys) != (self.storeys_meaning is not None):
            raise ValueError("a view's storey list and its meaning come together")
        _tuple_of(self.storeys, str, "a view's storeys")
        _tuple_of(self.steps, str, "a view's Takeoff Steps")
        for storey in self.storeys:
            _key(storey, "a storey")
        for step in self.steps:
            _key(step, "a Takeoff Step")
        _unique(self.storeys, "the storey")
        _unique(self.steps, "the Takeoff Step")
        if self.storeys_meaning is not None:
            StoreysMeaning(self.storeys_meaning)
        if self.subject is not None:
            _key(self.subject, "a view's subject")
        if self.layer is not None:
            Layer(self.layer)
        if self.part is not None:
            _key(self.part, "a view's Part")
        if self.exclusion is not None:
            _is(self.exclusion, Exclusion, "a view's exclusion")
        _anchors(self.anchors)
        if self.exclusion is not None and (self.steps or self.part is not None):
            raise ValueError("an excluded view is proposed to no Takeoff Step and no Part")


@dataclass(frozen=True)
class RegisterEntry:
    """One row of a drawing list read from a sheet of the set (13), with the row's box on that sheet."""

    sheet: SheetCandidate
    row_box: Box
    number: str | None = None
    title: str | None = None
    revision_mark: str | None = None
    anchors: tuple[Anchor, ...] = ()

    def __post_init__(self) -> None:
        _is(self.sheet, SheetCandidate, "a register entry's sheet")
        _is(self.row_box, Box, "a register entry's row box")
        _text(self.number, "a register entry's number")
        _text(self.title, "a register entry's title")
        _text(self.revision_mark, "a register entry's revision mark")
        _anchors(self.anchors)


@dataclass(frozen=True)
class Conflict:
    """Two or more candidates that cannot both be right, found by code (19b) and raised as a Question."""

    kind: str
    """What conflicts, as a key (two sheets with one number, one storey drawn twice)."""
    candidates: tuple[SheetCandidate | ViewCandidate, ...]
    evidence: Mapping[str, Param] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _key(self.kind, "a conflict's kind")
        _tuple_of(self.candidates, SheetCandidate | ViewCandidate, "a conflict's candidates")
        _params(self.evidence, "a conflict's evidence")
        if len(self.candidates) < 2:
            raise ValueError("a conflict names two candidates or more")


@dataclass(frozen=True)
class Continuation:
    """One title over sheets of consecutive numbers ("Column schedule, 3 sheets"): no Question."""

    title: str
    sheets: tuple[SheetCandidate, ...]
    """In number order."""

    def __post_init__(self) -> None:
        _is(self.title, str, "a continuation's title")
        _text(self.title, "a continuation's title")
        _tuple_of(self.sheets, SheetCandidate, "a continuation's sheets")
        if len(self.sheets) < 2:
            raise ValueError("a continuation runs over two sheets or more")


@dataclass(frozen=True)
class JudgementRequest:
    """A closed question for Jev: the node asking, the facts it gives, the question and the options."""

    node: str
    facts: Mapping[str, str]
    question: str
    options: tuple[str, ...]

    def __post_init__(self) -> None:
        _key(self.node, "a judgement node")
        if len(self.options) < 2:
            raise ValueError("a judgement offers two options or more")


@dataclass(frozen=True)
class PlotTransform:
    """Sheet to page: a scale, a rotation in 90° steps, then an offset in page units."""

    scale: float
    rotation: int
    offset: tuple[float, float]

    def __post_init__(self) -> None:
        _number(self.scale, "a Plot's scale")
        if not self.scale > 0:
            raise ValueError("a Plot's scale is a positive number")
        if isinstance(self.rotation, bool) or self.rotation not in (0, 90, 180, 270):
            raise ValueError("a Plot turns in 90° steps: 0, 90, 180 or 270")
        if not isinstance(self.offset, tuple) or len(self.offset) != 2:
            raise ValueError("a Plot's offset is two finite numbers")
        for v in self.offset:
            _number(v, "a Plot's offset")


@dataclass(frozen=True)
class PlotMatch:
    """One PDF page and the sheet it plots (18), or the reason none matched (a key)."""

    page: object
    """The page as `engine.read.pdf.page_text` returned it."""
    sheet: SheetCandidate | None = None
    transform: PlotTransform | None = None
    residual: float | None = None
    reason: str | None = None

    def __post_init__(self) -> None:
        if (self.sheet is None) == (self.reason is None):
            raise ValueError("a page matches a sheet or says why it matched none, exactly one")
        if self.sheet is None and (self.transform is not None or self.residual is not None):
            raise ValueError("a page that matched no sheet has no transform and no residual")
        if self.sheet is not None:
            _is(self.sheet, SheetCandidate, "a Plot's sheet")
        if self.transform is not None:
            _is(self.transform, PlotTransform, "a Plot's transform")
        if self.residual is not None:
            _number(self.residual, "a Plot's residual")
            if self.residual < 0:
                raise ValueError("a Plot's residual is not negative")
        if self.reason is not None:
            _key(self.reason, "a Plot's reason")


@dataclass(frozen=True)
class CheckResult:
    """A Check's result on one subject (or on the set, with no subject); a fired Check has a finding."""

    code: str
    outcome: CheckOutcome
    subject: SheetCandidate | ViewCandidate | RegisterEntry | PlotMatch | None = None
    finding: Message | None = None

    def __post_init__(self) -> None:
        _is(self.code, str, "a Check's code")
        _text(self.code, "a Check's code")
        if (CheckOutcome(self.outcome) == CheckOutcome.FIRED) != (self.finding is not None):
            raise ValueError("a Check that fired has a finding, and one that passed has none")
        if self.subject is not None:
            _is(self.subject, SheetCandidate | ViewCandidate | RegisterEntry | PlotMatch, "a subject")
        if self.finding is not None:
            _is(self.finding, Mapping, "a finding")
            if set(self.finding) != {"code", "params"} or not isinstance(self.finding["code"], str):
                raise ValueError("a finding is a message: its code and its params")
            if not _CODE.fullmatch(self.finding["code"]):
                raise ValueError(f"{self.finding['code']!r} is not a message code")
            _params(self.finding["params"], "a finding's params")


class ListSource(StrEnum):
    """Where a drawing list the QS gave came from (one read on a sheet is its `RegisterEntry` rows)."""

    PASTED = "pasted"
    TYPED = "typed"
    """Typed as a range ("01 to 57"): its entries are the range's numbers, without titles."""


@dataclass(frozen=True)
class ListEntry:
    """One line of a pasted or typed drawing list: the number as listed, where it was, what it says."""

    number: str
    line: int
    """The line of the text it was on, from 1 (a range's numbers share its line)."""
    title: str | None = None
    revision_mark: str | None = None

    def __post_init__(self) -> None:
        _is(self.number, str, "a list entry's number")
        _text(self.number, "a list entry's number")
        if isinstance(self.line, bool) or not isinstance(self.line, int) or self.line < 1:
            raise ValueError(f"a list entry's line is counted from 1, not {self.line!r}")
        _text(self.title, "a list entry's title")
        _text(self.revision_mark, "a list entry's revision mark")


@dataclass(frozen=True)
class DrawingList:
    """A Discipline's drawing list pasted or typed by the QS (docs/data-model.md §3.4, DrawingRegister),
    in one group; the register Check (19b) takes at most one list per (group, Discipline)."""

    group: Group
    discipline: str
    """The Discipline's key, one the conventions carry."""
    source: ListSource
    entries: tuple[ListEntry, ...]

    def __post_init__(self) -> None:
        _is(self.group, str, "a drawing list's group")
        _text(self.group, "a drawing list's group")
        _key(self.discipline, "a drawing list's Discipline")
        ListSource(self.source)
        _tuple_of(self.entries, ListEntry, "a drawing list's entries")


@dataclass(frozen=True)
class SetReading:
    """What was read from a set, for the Checks (`engine.check.catalogue.run_all(reading)`, 19b).

    `views[i]` are the views of `sheets[i]`; `conflicts.find(sheets, views, conventions)` takes the
    same pair. `read` names the stages whose results it carries from every file of the set (`views`,
    `register`, `plot`, `conflicts`): a Check whose input is not among them was not read, so it
    says nothing, rather than passing on an empty list. `conventions` are the ones the sheets were
    read with (the Disciplines' prefixes among them); `lists` the drawing lists the QS pasted or
    typed, at most one per (group, Discipline), none where a list read on a sheet is used instead.
    """

    sheets: tuple[SheetCandidate, ...] = ()
    views: tuple[tuple[ViewCandidate, ...], ...] = ()
    register: tuple[RegisterEntry, ...] = ()
    plot: tuple[PlotMatch, ...] = ()
    conflicts: tuple[Conflict, ...] = ()
    continuations: tuple[Continuation, ...] = ()
    read: frozenset[str] = frozenset()
    conventions: SheetConventions | None = None
    lists: tuple[DrawingList, ...] = ()

    def __post_init__(self) -> None:
        if len(self.views) != len(self.sheets):
            raise ValueError("a reading holds one list of views per sheet")
        if self.conventions is not None:
            _is(self.conventions, SheetConventions, "a reading's conventions")
        _tuple_of(self.lists, DrawingList, "a reading's drawing lists")


# Conventions ----------------------------------------------------------------------------------------


class SheetField(StrEnum):
    """A title-block field the conventions place."""

    NUMBER = "number"
    TITLE = "title"
    REVISION_MARK = "revision_mark"
    ISSUE_DATE = "issue_date"
    STOREYS = "storeys"


@dataclass(frozen=True)
class DisciplineConvention:
    """A Discipline, by its key, and the sheet-number prefixes it is known by."""

    key: str
    prefixes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _key(self.key, "a Discipline's key")
        for prefix in self.prefixes:
            _text(prefix, "a sheet-number prefix")
        _unique(self.prefixes, "the prefix")


@dataclass(frozen=True)
class TitleBlockField:
    """Where a title-block field is: the words that label it, and its box as fractions of the block."""

    field: SheetField
    words: tuple[str, ...] = ()
    position: Box | None = None

    def __post_init__(self) -> None:
        SheetField(self.field)
        if self.position is not None and not (
            self.position.x0 >= 0
            and self.position.x1 <= 1
            and self.position.y0 >= 0
            and self.position.y1 <= 1
        ):
            raise ValueError("a title-block field's position is fractions of the block, 0 to 1")


@dataclass(frozen=True)
class StoreyWords:
    """The words that name one canonical storey (tie, grade and plinth beams name the plinth level)."""

    storey: str
    words: tuple[str, ...]

    def __post_init__(self) -> None:
        _key(self.storey, "a storey")


@dataclass(frozen=True)
class SheetConventions:
    """The sheet part of a Drafting Profile's conventions (ADR 0039; docs/data-model.md §3.2).

    M0 reads with the default, `engine/recognise/conventions/sheet-default.json` (13's; generic, no
    office's literal), over which the product puts the Market's Disciplines (21b); from M1 a Drafting
    Profile passes the same object. Patterns are regular expressions (Python's `re`), bounded when
    they are loaded (`_pattern`) and run only on text up to `MAX_PATTERN_TEXT` long
    (`pattern_search`).

    Words are matched whole, ignoring case and punctuation ("Sheet No." is `sheet no`). The storey
    words (13's `storeys.py` reads them; the M0 plan's review Q1) are data a Drafting Profile extends:
    `storey_words` names each canonical level by its words (tie, grade and plinth beams name the
    plinth level; `basement` names the numbered family); a `weak_storey_words` word ("ground", "top",
    "typical") names its storey only in a phrase with a floor word, as an ordinal does ("1st flight"
    names no floor), and "typical" only in a plan's title beside a floor or plan word;
    `structure_words` (tanks, the underground reservoir) are structures for Step 10, never storeys;
    `below_ground_words` read foundation to ground; a `level_words` word with a figure ("EL +16'-6\"")
    is kept as stated, with no storey.
    """

    disciplines: tuple[DisciplineConvention, ...] = ()
    number_patterns: tuple[str, ...] = ()
    title_block_fields: tuple[TitleBlockField, ...] = ()
    """Each field's label words, in order of preference ("sheet title" before "drawing title")."""
    revision_mark_pattern: str | None = None
    storey_words: tuple[StoreyWords, ...] = ()
    frame_hints: tuple[str, ...] = ()
    """Words that name a sheet's frame in block or layer names."""
    title_block_words: tuple[str, ...] = ()
    """The other labels a title block prints (scale, drawn by): evidence of a title block, never a
    field's value."""
    floor_words: tuple[str, ...] = ()
    plan_words: tuple[str, ...] = ()
    level_words: tuple[str, ...] = ()
    weak_storey_words: tuple[str, ...] = ()
    structure_words: tuple[str, ...] = ()
    below_ground_words: tuple[str, ...] = ()
    ordinal_words: tuple[str, ...] = ()
    """Ordinals written as words, in order: the n-th names floor n."""
    ordinal_suffixes: tuple[str, ...] = ()
    """What follows a figure to make it an ordinal ("st" in "1st")."""
    range_words: tuple[str, ...] = ()
    """Words that join a range's ends ("to"); a dash does too, between two storeys."""
    list_words: tuple[str, ...] = ()
    """Words that join a list ("and"); a comma, "&", "+" and "/" do too."""
    register_words: tuple[str, ...] = ()
    """A drawing register's heading words ("drawing list")."""
    sheet_kinds: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    """The kinds of sheet a QS names in each Discipline, by the Discipline's key (the owner's ruling
    of 29 Sep 2026, "Per-Discipline kinds")."""
    common_sheet_kinds: tuple[str, ...] = ()
    """The kinds every Discipline has (a cover or index, general notes, other)."""

    def __post_init__(self) -> None:
        _unique([d.key for d in self.disciplines], "the Discipline")
        _unique([f.field for f in self.title_block_fields], "the title-block field")
        _unique([s.storey for s in self.storey_words], "the storey")
        for pattern in (*self.number_patterns, *filter(None, [self.revision_mark_pattern])):
            _pattern(pattern)
        for name in _WORD_FIELDS:
            for word in getattr(self, name):
                _text(word, f"a word of {name}")
        for discipline, kinds in self.sheet_kinds.items():
            _key(discipline, "a Discipline")
            for kind in kinds:
                _key(kind, "a sheet kind")
            _unique(kinds, f"the {discipline} sheet kind")
        for kind in self.common_sheet_kinds:
            _key(kind, "a sheet kind")
        _unique(self.common_sheet_kinds, "the common sheet kind")

    def discipline_keys(self) -> tuple[str, ...]:
        return tuple(d.key for d in self.disciplines)

    def kinds(self, discipline: str) -> tuple[str, ...]:
        """The kinds of sheet a Discipline has: its own, then the common ones."""
        own = self.sheet_kinds.get(discipline, ())
        return (*own, *(k for k in self.common_sheet_kinds if k not in own))

    def to_json(self) -> dict[str, Any]:
        """The conventions as JSON; a field 13 added is written only when it holds something, so a
        file written before them round-trips unchanged."""
        added: dict[str, Any] = {
            **{name: list(getattr(self, name)) for name in _WORD_FIELDS if name != "frame_hints"},
            "sheet_kinds": {k: list(v) for k, v in self.sheet_kinds.items()},
            "common_sheet_kinds": list(self.common_sheet_kinds),
        }
        return self._to_json() | {name: value for name, value in added.items() if value}

    def _to_json(self) -> dict[str, Any]:
        return {
            "disciplines": [{"key": d.key, "prefixes": list(d.prefixes)} for d in self.disciplines],
            "number_patterns": list(self.number_patterns),
            "title_block_fields": [
                {
                    "field": str(f.field),
                    "words": list(f.words),
                    "position": None if f.position is None else f.position.to_json(),
                }
                for f in self.title_block_fields
            ],
            "revision_mark_pattern": self.revision_mark_pattern,
            "storey_words": [{"storey": s.storey, "words": list(s.words)} for s in self.storey_words],
            "frame_hints": list(self.frame_hints),
        }

    @classmethod
    def from_json(cls, value: Any) -> SheetConventions:
        data = _object(value, "sheet conventions", _SHEET_KEYS)
        return cls(
            disciplines=tuple(
                DisciplineConvention(
                    key=_str(d, "key"), prefixes=_words(d, "prefixes", "a Discipline's prefixes")
                )
                for d in (
                    _object(item, "a Discipline", {"key", "prefixes"})
                    for item in _list(data, "disciplines")
                )
            ),
            number_patterns=_words(data, "number_patterns", "the number patterns"),
            title_block_fields=tuple(
                TitleBlockField(
                    field=SheetField(_str(f, "field")),
                    words=_words(f, "words", "a field's words"),
                    position=None if f.get("position") is None else Box.from_json(f["position"]),
                )
                for f in (
                    _object(item, "a title-block field", {"field", "words", "position"})
                    for item in _list(data, "title_block_fields")
                )
            ),
            revision_mark_pattern=_optional_str(data, "revision_mark_pattern"),
            storey_words=tuple(
                StoreyWords(storey=_str(s, "storey"), words=_words(s, "words", "a storey's words"))
                for s in (
                    _object(item, "a storey's words", {"storey", "words"})
                    for item in _list(data, "storey_words")
                )
            ),
            frame_hints=_words(data, "frame_hints", "the frame hints"),
            **{
                name: _words(data, name, f"the {name.replace('_', ' ')}")
                for name in _WORD_FIELDS
                if name != "frame_hints"
            },
            sheet_kinds={
                k: _word_list(v, f"the {k} sheet kinds")
                for k, v in _mapping(data, "sheet_kinds").items()
            },
            common_sheet_kinds=_words(data, "common_sheet_kinds", "the common sheet kinds"),
        )


@dataclass(frozen=True)
class ViewConventions:
    """The view part of a Drafting Profile's conventions: title words per kind, subject words (what a
    plan draws), the top and bottom layer words and the scale patterns (regular expressions).

    M0 reads with the default, `engine/recognise/conventions/view-default.json` (17's).
    """

    kind_words: Mapping[ViewKind, tuple[str, ...]] = field(default_factory=dict)
    subject_words: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    layer_words: Mapping[Layer, tuple[str, ...]] = field(default_factory=dict)
    scale_patterns: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for kind in self.kind_words:
            ViewKind(kind)
        for subject in self.subject_words:
            _key(subject, "a subject")
        for layer in self.layer_words:
            Layer(layer)
        for pattern in self.scale_patterns:
            _pattern(pattern)

    def to_json(self) -> dict[str, Any]:
        return {
            "kind_words": {str(k): list(v) for k, v in self.kind_words.items()},
            "subject_words": {k: list(v) for k, v in self.subject_words.items()},
            "layer_words": {str(k): list(v) for k, v in self.layer_words.items()},
            "scale_patterns": list(self.scale_patterns),
        }

    @classmethod
    def from_json(cls, value: Any) -> ViewConventions:
        data = _object(value, "view conventions", _VIEW_KEYS)
        return cls(
            kind_words={
                ViewKind(k): _word_list(v, f"the words of the {k} kind")
                for k, v in _mapping(data, "kind_words").items()
            },
            subject_words={
                k: _word_list(v, f"the words of the subject {k}")
                for k, v in _mapping(data, "subject_words").items()
            },
            layer_words={
                Layer(k): _word_list(v, f"the words of the {k} layer")
                for k, v in _mapping(data, "layer_words").items()
            },
            scale_patterns=_words(data, "scale_patterns", "the scale patterns"),
        )


_WORD_FIELDS = (
    "frame_hints",
    "title_block_words",
    "floor_words",
    "plan_words",
    "level_words",
    "weak_storey_words",
    "structure_words",
    "below_ground_words",
    "ordinal_words",
    "ordinal_suffixes",
    "range_words",
    "list_words",
    "register_words",
)
"""SheetConventions' fields that are lists of words."""
_SHEET_KEYS = {
    "disciplines",
    "number_patterns",
    "title_block_fields",
    "revision_mark_pattern",
    "storey_words",
    *_WORD_FIELDS,
    "sheet_kinds",
    "common_sheet_kinds",
}
_VIEW_KEYS = {"kind_words", "subject_words", "layer_words", "scale_patterns"}


# Patterns, bounded -----------------------------------------------------------------------------------

MAX_PATTERN = 200
"""The longest pattern a conventions file may hold, in characters."""
MAX_PATTERN_TEXT = 256
"""The longest text a conventions pattern runs on: a longer text is never matched (`pattern_search`),
so it is no field's value."""
MAX_PATHS = 4096
"""The most ways a pattern may try to match at one place in a text (`_ways`). Python's `re`
backtracks: every optional item, repeat and alternative multiplies the ways, and a search tries them
all at each of the text's places before it fails. At this bound the worst pattern that loads fails a
search of `MAX_PATTERN_TEXT` characters in about 13 ms of CPU at most (measured; review round 1
measured six chained `\\d{0,64}` at 55 s before the bound counted bounded repeats)."""

_SINGLE = frozenset({_constants.LITERAL, _constants.NOT_LITERAL, _constants.ANY, _constants.IN,
                     _constants.CATEGORY})  # fmt: skip
_REPEATS = frozenset({_constants.MAX_REPEAT, _constants.MIN_REPEAT, _constants.POSSESSIVE_REPEAT})
_BACKREFERENCES = frozenset({_constants.GROUPREF, _constants.GROUPREF_EXISTS})
_CATEGORIES = {
    _constants.CATEGORY_DIGIT: "digit",
    _constants.CATEGORY_NOT_DIGIT: "not_digit",
    _constants.CATEGORY_SPACE: "space",
    _constants.CATEGORY_NOT_SPACE: "not_space",
    _constants.CATEGORY_WORD: "word",
    _constants.CATEGORY_NOT_WORD: "not_word",
}
_APART = frozenset(
    frozenset(pair)
    for pair in (("digit", "space"), ("word", "space"), ("digit", "not_digit"),
                 ("space", "not_space"), ("word", "not_word"), ("digit", "not_word"))
)  # fmt: skip
"""Pairs of classes no character is in both of (a digit is a word character, never a space)."""
_LARGEST_RANGE = 256
"""The widest range of characters a class is read to (a wider one is not told apart from others)."""

type _Chars = tuple[bool, frozenset[str], frozenset[str]]
"""A one-character item's class: negated, its characters, its categories ("digit", "not_space")."""


def _pattern(pattern: str) -> None:
    """Refuse a pattern that cannot be bounded: longer than `MAX_PATTERN`, a backreference, a repeat
    of anything but one character (`(a+)+`, `(a|aa)*`, `(.*a){12}`: the nested and overlapping
    repeats that backtrack exponentially), or one that can try more than `MAX_PATHS` ways to match at
    one place (`\\d{0,64}` six times, `\\d?` sixteen, `\\d*\\d*`: chained repeats, optional
    items and alternatives, whose ways multiply). With the text capped at `MAX_PATTERN_TEXT`, a search
    then tries at most `MAX_PATHS` ways at each of its places."""
    if not isinstance(pattern, str) or len(pattern) > MAX_PATTERN:
        raise ValueError(f"a pattern is text of at most {MAX_PATTERN} characters")
    try:
        parsed = _parser.parse(pattern)
    except re.error as error:
        raise ValueError(f"the pattern {pattern!r} is not a regular expression: {error}") from None
    if max(_ways(parsed, pattern, parsed.state.flags)) > MAX_PATHS:
        raise ValueError(
            f"the pattern {pattern!r} can try more than {MAX_PATHS} ways to match at one place in a"
            " text; bound its repeats ({0,8} rather than *) and its optional parts (a pattern is"
            " bounded before any drawing is read)"
        )


def _ways(parsed: Any, pattern: str, flags: int) -> tuple[int, int]:
    """Walk a parsed pattern, refusing what cannot be bounded: the ways a match can go on past it
    from one place, and the most times any one of its items is tried, as if every repeat could take
    its whole range on a text of `MAX_PATTERN_TEXT` characters (each capped just past `MAX_PATHS`).
    A repeat of one character whose next item needs a character it never matches (`\\s*` before
    `:` or a digit) must end where its run does: the next item is tried after each of its lengths,
    but only one goes on, so it adds tries rather than multiplying the ways. A lookaround or an
    atomic group is tried by every way that reaches it, and lets one through."""
    items = list(parsed)
    going, most = 1, 1
    for at, (op, value) in enumerate(items):
        if op in _BACKREFERENCES:
            raise ValueError(f"the pattern {pattern!r} refers back to a group, which cannot be bounded")
        if op in _REPEATS:
            low, high, body = value
            if high > 1:
                if not (len(body) == 1 and body[0][0] in _SINGLE):
                    raise ValueError(
                        f"the pattern {pattern!r} repeats a group or a repeat, which can take"
                        " exponential time; repeat single characters only"
                    )
                took = max(min(high, MAX_PATTERN_TEXT) - min(low, MAX_PATTERN_TEXT) + 1, 1)
                after = items[at + 1] if at + 1 < len(items) else None
                if after is not None and _stops_before(body[0], after, flags):
                    most = max(most, going * took)
                else:
                    going *= took
            else:
                goes, tried = _ways(body, pattern, flags) if high == 1 else (0, 0)
                most = max(most, going * tried)
                going *= max(goes + (1 if low == 0 else 0), 1)
        elif op == _constants.SUBPATTERN:
            _group, add, remove, body = value
            goes, tried = _ways(body, pattern, (flags | add) & ~remove)
            most = max(most, going * tried)
            going *= goes
        elif op == _constants.BRANCH:
            found = [_ways(item, pattern, flags) for item in value[1]]
            most = max(most, going * sum(tried for _, tried in found))
            going *= sum(goes for goes, _ in found)
        elif op in (_constants.ASSERT, _constants.ASSERT_NOT):
            most = max(most, going * max(_ways(value[1], pattern, flags)))
        elif op == _constants.ATOMIC_GROUP:
            most = max(most, going * max(_ways(value, pattern, flags)))
        going = min(going, MAX_PATHS + 1)
        most = min(max(most, going), MAX_PATHS + 1)
    return going, most


def _stops_before(item: tuple[Any, Any], after: tuple[Any, Any], flags: int) -> bool:
    """Whether a run of `item`'s characters must end where `after` begins: `after` needs, first, a
    character `item` never matches (a character or class, a repeat of one at least once, or a group
    that begins so). Anything else, or a class that case-folding blurs, is not told apart."""
    first = _first(after)
    if first is None:
        return False
    a, b = _chars(item, flags), _chars(first, flags)
    return a is not None and b is not None and _apart(a, b, bool(flags & re.ASCII))


def _first(item: tuple[Any, Any]) -> tuple[Any, Any] | None:
    op, value = item
    if op in _SINGLE:
        return item
    if op in _REPEATS:
        low, _high, body = value
        return _first(body[0]) if low >= 1 and len(body) else None
    if op == _constants.SUBPATTERN:
        body = value[-1]
        return _first(body[0]) if len(body) else None
    return None


def _chars(item: tuple[Any, Any], flags: int) -> _Chars | None:
    """A one-character item's class, or none when it cannot be told exactly."""
    op, value = item
    negated, chars, categories = False, set[str](), set[str]()
    if op == _constants.LITERAL:
        chars.add(chr(value))
    elif op == _constants.NOT_LITERAL:
        negated = True
        chars.add(chr(value))
    elif op == _constants.ANY:
        negated = True
        if not flags & re.DOTALL:
            chars.add("\n")
    elif op == _constants.CATEGORY and value in _CATEGORIES:
        categories.add(_CATEGORIES[value])
    elif op == _constants.IN:
        for part, held in value:
            if part == _constants.NEGATE:
                negated = True
            elif part == _constants.LITERAL:
                chars.add(chr(held))
            elif part == _constants.RANGE and held[1] - held[0] < _LARGEST_RANGE:
                chars.update(chr(c) for c in range(held[0], held[1] + 1))
            elif part == _constants.CATEGORY and held in _CATEGORIES:
                categories.add(_CATEGORIES[held])
            else:
                return None
    else:
        return None
    if flags & re.IGNORECASE and any(c.lower() != c.upper() for c in chars):
        return None  # case-folding joins characters (k and the Kelvin sign): not told apart
    return negated, frozenset(chars), frozenset(categories)


def _in(category: str, char: str, ascii_only: bool) -> bool:
    kind = category.removeprefix("not_")
    if ascii_only:
        hit = {
            "digit": "0" <= char <= "9",
            "space": char in " \t\n\r\f\v",
            "word": char.isascii() and (char.isalnum() or char == "_"),
        }[kind]
    else:
        hit = {
            "digit": char.isdecimal(),
            "space": char.isspace(),
            "word": char.isalnum() or char == "_",
        }[kind]
    return hit != category.startswith("not_")


def _matches(chars: _Chars, char: str, ascii_only: bool) -> bool:
    negated, held, categories = chars
    return (char in held or any(_in(c, char, ascii_only) for c in categories)) != negated


def _apart(a: _Chars, b: _Chars, ascii_only: bool) -> bool:
    """Whether no character is in both classes."""
    for one, other in ((a, b), (b, a)):
        negated, held, categories = one
        if not negated and not categories:  # a set of characters, each asked of the other class
            return not any(_matches(other, char, ascii_only) for char in held)
    if a[0] and b[0]:
        return False  # two negated classes share every character neither names
    if not a[0] and not b[0]:
        return (
            all(frozenset((p, q)) in _APART for p in a[2] for q in b[2])
            and not any(_matches(b, char, ascii_only) for char in a[1])
            and not any(_matches(a, char, ascii_only) for char in b[1])
        )
    against, plain = (a, b) if a[0] else (b, a)
    left_out: _Chars = (False, against[1], against[2])  # what the negated class does not match
    excluded = against[2]
    return all(q in excluded or (q == "digit" and "word" in excluded) for q in plain[2]) and all(
        _matches(left_out, char, ascii_only) for char in plain[1]
    )


@functools.lru_cache(maxsize=256)
def _compiled(pattern: str) -> re.Pattern[str]:
    _pattern(pattern)
    return re.compile(pattern)


def pattern_search(pattern: str, text: str) -> re.Match[str] | None:
    """`re.search` for a conventions pattern, on text of at most `MAX_PATTERN_TEXT` characters only;
    longer text never matches. The pattern is checked and compiled once."""
    if len(text) > MAX_PATTERN_TEXT:
        return None
    return _compiled(pattern).search(text)


def _object(value: Any, what: str, keys: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{what} is a JSON object")
    unknown = set(value) - keys
    if unknown:
        raise ValueError(f"{what} has no field {sorted(unknown)!r}; its fields are {sorted(keys)}")
    return value


def _list(data: dict[str, Any], name: str) -> list[Any]:
    value = data.get(name, [])
    if not isinstance(value, list):
        raise ValueError(f"{name} is a JSON list")
    return value


def _mapping(data: dict[str, Any], name: str) -> dict[str, Any]:
    value = data.get(name, {})
    if not isinstance(value, dict):
        raise ValueError(f"{name} is a JSON object")
    return value


def _str(data: dict[str, Any], name: str) -> str:
    value = data.get(name)
    if not isinstance(value, str):
        raise ValueError(f"{name} is a string")
    return value


def _optional_str(data: dict[str, Any], name: str) -> str | None:
    return None if data.get(name) is None else _str(data, name)


def _word_list(value: Any, what: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ValueError(f"{what} is a list of strings")
    return tuple(value)


def _words(data: dict[str, Any], name: str, what: str) -> tuple[str, ...]:
    return _word_list(data.get(name, []), what)
