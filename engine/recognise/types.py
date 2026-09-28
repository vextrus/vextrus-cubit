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

import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from engine.messages import Message, Param
from engine.read.anchor import Anchor

_KEY = re.compile(r"[a-z][a-z0-9_]*")

type Group = str
"""A candidate's group: an opaque key its caller stamps from the file (M0: one group per set)."""


def _key(value: str, what: str) -> str:
    if not _KEY.fullmatch(value):
        raise ValueError(f"{what} {value!r} is not a lower-case key")
    return value


def _unique(values: Sequence[str], what: str) -> None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            raise ValueError(f"{what} {value!r} is given twice")
        seen.add(value)


def _text(value: str | None, what: str) -> None:
    if value is not None and not value.strip():
        raise ValueError(f"{what} is empty; leave it out instead")


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
        if not all(math.isfinite(v) for v in (self.x0, self.y0, self.x1, self.y1)):
            raise ValueError(f"{self} has a coordinate that is not a finite number")
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
        ViewKind(self.kind)
        _text(self.title, "a view's title")
        _text(self.stated_scale, "a stated scale")
        _text(self.storeys_as_stated, "a view's storeys as stated")
        if bool(self.storeys) != (self.storeys_meaning is not None):
            raise ValueError("a view's storey list and its meaning come together")
        _unique(self.storeys, "the storey")
        _unique(self.steps, "the Takeoff Step")
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


@dataclass(frozen=True)
class Conflict:
    """Two or more candidates that cannot both be right, found by code (19b) and raised as a Question."""

    kind: str
    """What conflicts, as a key (two sheets with one number, one storey drawn twice)."""
    candidates: tuple[SheetCandidate | ViewCandidate, ...]
    evidence: Mapping[str, Param] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _key(self.kind, "a conflict's kind")
        if len(self.candidates) < 2:
            raise ValueError("a conflict names two candidates or more")


@dataclass(frozen=True)
class Continuation:
    """One title over sheets of consecutive numbers ("Column schedule, 3 sheets"): no Question."""

    title: str
    sheets: tuple[SheetCandidate, ...]
    """In number order."""

    def __post_init__(self) -> None:
        _text(self.title, "a continuation's title")
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
        if not (math.isfinite(self.scale) and self.scale > 0):
            raise ValueError("a Plot's scale is a positive number")
        if self.rotation not in (0, 90, 180, 270):
            raise ValueError("a Plot turns in 90° steps: 0, 90, 180 or 270")
        if not all(math.isfinite(v) for v in self.offset):
            raise ValueError("a Plot's offset is two finite numbers")


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
        _text(self.code, "a Check's code")
        if (CheckOutcome(self.outcome) == CheckOutcome.FIRED) != (self.finding is not None):
            raise ValueError("a Check that fired has a finding, and one that passed has none")


@dataclass(frozen=True)
class SetReading:
    """What was read from a set, for the Checks (`engine.check.catalogue.run_all(reading)`, 19b).

    `views[i]` are the views of `sheets[i]`; `conflicts.find(sheets, views)` takes the same pair.
    """

    sheets: tuple[SheetCandidate, ...] = ()
    views: tuple[tuple[ViewCandidate, ...], ...] = ()
    register: tuple[RegisterEntry, ...] = ()
    plot: tuple[PlotMatch, ...] = ()
    conflicts: tuple[Conflict, ...] = ()
    continuations: tuple[Continuation, ...] = ()

    def __post_init__(self) -> None:
        if len(self.views) != len(self.sheets):
            raise ValueError("a reading holds one list of views per sheet")


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
    Profile passes the same object. Patterns are regular expressions (Python's `re`).
    """

    disciplines: tuple[DisciplineConvention, ...] = ()
    number_patterns: tuple[str, ...] = ()
    title_block_fields: tuple[TitleBlockField, ...] = ()
    revision_mark_pattern: str | None = None
    storey_words: tuple[StoreyWords, ...] = ()
    frame_hints: tuple[str, ...] = ()
    """Words that name a sheet's frame in block or layer names."""

    def __post_init__(self) -> None:
        _unique([d.key for d in self.disciplines], "the Discipline")
        _unique([f.field for f in self.title_block_fields], "the title-block field")
        _unique([s.storey for s in self.storey_words], "the storey")
        for pattern in (*self.number_patterns, *filter(None, [self.revision_mark_pattern])):
            _pattern(pattern)

    def discipline_keys(self) -> tuple[str, ...]:
        return tuple(d.key for d in self.disciplines)

    def to_json(self) -> dict[str, Any]:
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


_SHEET_KEYS = {
    "disciplines",
    "number_patterns",
    "title_block_fields",
    "revision_mark_pattern",
    "storey_words",
    "frame_hints",
}
_VIEW_KEYS = {"kind_words", "subject_words", "layer_words", "scale_patterns"}


def _pattern(pattern: str) -> None:
    try:
        re.compile(pattern)
    except re.error as error:
        raise ValueError(f"the pattern {pattern!r} is not a regular expression: {error}") from None


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
