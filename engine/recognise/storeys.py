"""Storeys as a title states them, and as an explicit list, by code (13; ADR 0011: code owns storeys).

    storeys.read(text, conventions, *, plan_title) -> Storeys

`text` is a decoded title (11's `engine.text.decode`); `conventions` carries the words (the
`SheetConventions` storey fields: data a Drafting Profile extends in M1); `plan_title` says the text
is a plan's title, the only place "typical" names a storey. 13 reads a sheet's title with it, 17 a
view's, 19b compares them. The result:

- `as_stated`: the storey words as the text states them, verbatim (several phrases joined by ", "),
  or none;
- `keys`: the storeys, an explicit list low to high, never a first-to-last expansion of a list;
- `runs_to`: where a stated range runs on past what can be listed, the symbolic end Step 3 resolves
  (`top`: "1st to top floor" is `floor_1` running to `top`; "6th floor to roof" is `floor_6` and
  `roof`, the floors between running to `top`);
- `below_ground`: "below ground floor" was read (foundation to ground); where a basement is
  confirmed, 21c raises it as a Question;
- `ranged`: the text states one two-ended "X to Y" range and nothing else ("footing to 3rd"): never a
  list ("grd and mezz"), a below-ground phrase or a text with several phrases (S19-B2's R1: only
  two ranges that both state one meet at a storey).

**The keys** (the canonical levels, docs/data-model.md §3.2 as the QS review's Q1 widened them;
letter-first, `engine/recognise/types.py`'s key form): `pile`, `pile_cap`, `foundation`,
`basement_<n>` (`basement_1` the highest), `lower_ground`, `plinth` (tie, grade and plinth beams name
it), `ground`, `mezzanine`, `podium`, `floor_<n>` (the n-th floor above ground, 1 to `MAX_FLOOR`),
`roof`, `stair_room_roof`, `lift_machine_room`, `lift_machine_room_roof`; the symbolic `typical`
(typical, range from Step 3) and `top` (the topmost floor); and `not_stated`, for a plan's title that
states none. That is also their order, low to high. A "Level n" or "EL +x" title is kept as stated,
with no key.

**How a title is read.** Its words are matched whole, ignoring case, the longest first ("pile cap"
before "pile"; "canopy roof", a structure, before "roof"); dotted abbreviations are one word ("G.F" is
`gf`), and a figure glued to a word is split from it ("FOR1ST"). Storeys joined by a list word (",",
"&", "+", "/", `list_words`) form a list, and two joined by a range word (`range_words`, or a dash
between two storeys) a range; a floor word after them belongs to the whole phrase ("GROUND &
MEZZANINE FLOOR"), and one only: a second begins the subject ("GROUND FLOOR FLOOR FINISH"). A
phrase of weak words (an ordinal, and `weak_storey_words`: "ground", "top", "typical") names
storeys only with a floor word ("1st flight" and "top layer" name none); "typical" names one only
when `plan_title` is set and a floor or plan word stands beside it. A structure word (a tank, the
underground reservoir) ends a phrase and is never a storey.

**A range** lists its ends and, between them, the ground floor and the numbered floors and
basements; a level a building may not have (plinth, mezzanine, podium, lower ground) is never put in
by a range. A reversed range reads the same.

**Bounds** (a title is hostile input): a text longer than `MAX_TEXT` is not read; an ordinal of more
than `MAX_DIGITS` digits is never turned into a number, and a phrase naming a floor past `MAX_FLOOR`
(or the 0th) is kept as stated, with no list: a safety bound, not a storey total. A digit is a
Unicode decimal digit of any script (a fullwidth 1 and "st" is the 1st); a superscript or other
numeral is not one.
"""

import re
import unicodedata
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from enum import Enum

from engine.recognise.types import SheetConventions

MAX_TEXT = 512
"""The longest text read, in characters: a longer one is no title."""
MAX_FLOOR = 200
"""The highest floor a range is listed to (a safety bound, not a storey total)."""
MAX_DIGITS = 9
"""The most digits an ordinal is read with; a longer run is past `MAX_FLOOR` without being counted."""

NAMED = frozenset(
    {"pile", "pile_cap", "foundation", "basement", "lower_ground", "plinth", "ground", "mezzanine",
     "podium", "roof", "stair_room_roof", "lift_machine_room", "lift_machine_room_roof", "typical",
     "top"}
)  # fmt: skip
"""The storeys `SheetConventions.storey_words` may name (`basement` names the numbered family)."""

_RANK = {
    "pile": 0, "pile_cap": 1, "foundation": 2, "lower_ground": 150, "plinth": 160, "ground": 200,
    "mezzanine": 210, "podium": 220, "roof": 1000, "stair_room_roof": 1010,
    "lift_machine_room": 1020, "lift_machine_room_roof": 1030,
}  # fmt: skip
_FLOOR_RANK = 300
_BASEMENT_RANK = 100
_MAX_BASEMENT = 20

_WORD = re.compile("[^\\W_]+|[,&+/()\\-\u2013\u2014~.:;'\"\u2032\u2033±]")
_SPLIT = re.compile(r"(?<=[^\W\d_])(?=\d)")
_ORDINAL = re.compile(r"(\d+)([^\W\d_]+)")
_FIGURE = re.compile("[\\s.:]*[+\\-±]?\\s*\\(?[+\\-±]?\\)?\\s*\\d[\\d'\"\u2032\u2033.,\\-/ ]{0,23}")
_DASHES = frozenset("-\u2013\u2014~")
_LIST_MARKS = frozenset(",&+/")


@dataclass(frozen=True)
class Storeys:
    """What a text states about storeys (the module's docstring)."""

    as_stated: str | None
    keys: tuple[str, ...] = ()
    runs_to: str | None = None
    below_ground: bool = False
    ranged: bool = False


def read(text: str, conventions: SheetConventions, *, plan_title: bool) -> Storeys:
    """The storeys `text` states (the module's docstring)."""
    if not isinstance(text, str) or len(text) > MAX_TEXT:
        return Storeys(as_stated=None)
    units = list(_units(_tokens(text), _vocabulary(conventions)))
    phrases = [p for p in _phrases(units) if p.accept(plan_title, units)]
    levels = [u for u in units if u.kind is _Kind.LEVEL]
    keys: dict[str, int] = {}
    runs_to = None
    below = False
    stated: list[tuple[int, int]] = []
    for phrase in phrases:
        found = phrase.keys()
        stated.append((phrase.start, phrase.end))
        below = below or phrase.below_ground
        if found is None:
            continue  # past the safety bound: kept as stated, with no list
        listed, end = found
        keys.update(listed)
        runs_to = runs_to or end
    for level in levels:
        figure = _FIGURE.match(text, level.end)
        if figure is not None and figure.end() > level.end:
            stated.append((level.start, figure.end()))
    stated.sort()
    as_stated = ", ".join(text[a:b].strip() for a, b in stated) or None
    ordered = tuple(sorted(keys, key=lambda k: keys[k]))
    if not ordered and as_stated is None and plan_title:
        ordered = ("not_stated",)
    ranged = len(phrases) == 1 and not below and phrases[0].is_one_range()
    return Storeys(as_stated=as_stated, keys=ordered, runs_to=runs_to, below_ground=below, ranged=ranged)


def names_a_plan(text: str, conventions: SheetConventions) -> bool:
    """Whether a title names a plan: it holds one of the conventions' plan words ("plan", "layout")."""
    if not isinstance(text, str) or len(text) > MAX_TEXT:
        return False
    plan = {tuple(_norm(w)) for w in conventions.plan_words}
    words = [t.word for t in _tokens(text) if not t.mark]
    return any((w,) in plan for w in words) or any(
        tuple(words[i : i + len(p)]) == p for p in plan if len(p) > 1 for i in range(len(words))
    )


# Tokens -----------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Token:
    word: str  # case-folded; a mark is its own character
    start: int
    end: int
    mark: bool = False


def _tokens(text: str) -> list[_Token]:
    raw: list[_Token] = []
    for match in _WORD.finditer(text):
        piece = match.group()
        if piece[0].isalnum():
            offset = match.start()
            for part in _SPLIT.split(piece):
                raw.append(_Token(part.casefold(), offset, offset + len(part)))
                offset += len(part)
        else:
            raw.append(_Token(piece, match.start(), match.end(), mark=True))
    return _abbreviations(raw)


def _abbreviations(tokens: list[_Token]) -> list[_Token]:
    """Single letters joined by dots are one word: "G.F" is `gf`, "U.G.W.R" is `ugwr`."""
    out: list[_Token] = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if not t.mark and len(t.word) == 1 and t.word.isalpha():
            j = i
            letters = [t]
            while (
                j + 2 < len(tokens)
                and tokens[j + 1].word == "."
                and not tokens[j + 2].mark
                and len(tokens[j + 2].word) == 1
                and tokens[j + 2].word.isalpha()
            ):
                j += 2
                letters.append(tokens[j])
            if len(letters) > 1:
                out.append(_Token("".join(x.word for x in letters), t.start, letters[-1].end))
                i = j + 1
                continue
        out.append(t)
        i += 1
    return out


def _norm(word: str) -> list[str]:
    return [t.word for t in _tokens(word) if not t.mark]


# The vocabulary ---------------------------------------------------------------------------------------


class _Kind(Enum):
    STOREY = "storey"
    STRUCTURE = "structure"
    BELOW = "below"
    LEVEL = "level"
    FLOOR = "floor"
    PLAN = "plan"
    RANGE = "range"
    LIST = "list"
    ORDINAL = "ordinal"
    DASH = "dash"
    OTHER = "other"


_PRIORITY = {_Kind.STRUCTURE: 0, _Kind.BELOW: 1, _Kind.STOREY: 2, _Kind.LEVEL: 3, _Kind.FLOOR: 4,
             _Kind.PLAN: 5, _Kind.RANGE: 6, _Kind.LIST: 7}  # fmt: skip


@dataclass(frozen=True)
class _Vocabulary:
    phrases: dict[tuple[str, ...], tuple[_Kind, str]]
    longest: int
    weak: frozenset[str]
    ordinals: dict[str, int]
    suffixes: frozenset[str]


def _vocabulary(conventions: SheetConventions) -> _Vocabulary:
    entries: dict[tuple[str, ...], tuple[_Kind, str]] = {}

    def add(words: Sequence[str], kind: _Kind, value: str = "") -> None:
        for word in words:
            key = tuple(_norm(word))
            held = entries.get(key)
            if key and (held is None or _PRIORITY[kind] < _PRIORITY[held[0]]):
                entries[key] = (kind, value)

    for storey in conventions.storey_words:
        if storey.storey in NAMED:
            add(storey.words, _Kind.STOREY, storey.storey)
    add(conventions.structure_words, _Kind.STRUCTURE)
    add(conventions.below_ground_words, _Kind.BELOW)
    add(conventions.level_words, _Kind.LEVEL)
    add(conventions.floor_words, _Kind.FLOOR)
    add(conventions.plan_words, _Kind.PLAN)
    add(conventions.range_words, _Kind.RANGE)
    add(conventions.list_words, _Kind.LIST)
    ordinals = {w: n for n, word in enumerate(conventions.ordinal_words, 1) for w in _norm(word)[:1]}
    weak = frozenset(" ".join(_norm(w)) for w in conventions.weak_storey_words)
    return _Vocabulary(
        entries,
        max((len(k) for k in entries), default=1),
        weak,
        ordinals,
        frozenset(s.casefold() for s in conventions.ordinal_suffixes),
    )


@dataclass(frozen=True)
class _Unit:
    kind: _Kind
    start: int
    end: int
    value: str = ""
    number: int | None = None  # an ordinal's n (or -1 past MAX_DIGITS); a basement's n
    weak: bool = False
    words: tuple[str, ...] = ()


def _units(tokens: list[_Token], vocabulary: _Vocabulary) -> Iterator[_Unit]:
    """The tokens matched to the vocabulary, the longest phrase first; hyphens inside a phrase are
    skipped ("SEMI-BASEMENT")."""
    i = 0
    while i < len(tokens):
        t = tokens[i]
        best: tuple[int, int, tuple[_Kind, str], tuple[str, ...]] | None = None
        if not t.mark:
            words: list[str] = []
            j = i
            while j < len(tokens) and len(words) < vocabulary.longest:
                if tokens[j].mark:
                    if tokens[j].word in _DASHES and words:
                        j += 1
                        continue
                    break
                words.append(tokens[j].word)
                found = vocabulary.phrases.get(tuple(words))
                if found is not None:
                    best = (len(words), j, found, tuple(words))
                j += 1
        if best is not None:
            _, last, (kind, value), words_matched = best
            weak = kind is _Kind.STOREY and " ".join(words_matched) in vocabulary.weak
            yield _Unit(kind, t.start, tokens[last].end, value, weak=weak, words=words_matched)
            i = last + 1
            continue
        if t.mark:
            if t.word in _DASHES:
                yield _Unit(_Kind.DASH, t.start, t.end)
            elif t.word in _LIST_MARKS:
                yield _Unit(_Kind.LIST, t.start, t.end)
            elif t.word not in ".":
                yield _Unit(_Kind.OTHER, t.start, t.end)
            i += 1
            continue
        number = _ordinal(t.word, vocabulary)
        if number is not None:
            yield _Unit(_Kind.ORDINAL, t.start, t.end, number=number, weak=True)
        else:
            yield _Unit(_Kind.OTHER, t.start, t.end, value=t.word)
        i += 1


def _ordinal(word: str, vocabulary: _Vocabulary) -> int | None:
    if word in vocabulary.ordinals:
        return vocabulary.ordinals[word]
    match = _ORDINAL.fullmatch(word)
    if match is None or match.group(2) not in vocabulary.suffixes:
        return None
    digits = match.group(1)
    if len(digits) > MAX_DIGITS:
        return -1
    return int("".join(str(unicodedata.decimal(c)) for c in digits))


def _figure(word: str) -> int | None:
    """A bare figure of at most two digits (a basement's number)."""
    if 0 < len(word) <= 2 and all(unicodedata.category(c) == "Nd" for c in word):
        return int("".join(str(unicodedata.decimal(c)) for c in word))
    return None


# Phrases ----------------------------------------------------------------------------------------------


@dataclass
class _Item:
    key: str | None  # a named storey (`floor` for an ordinal, `basement`, `below` for below ground)
    number: int | None
    weak: bool
    start: int
    end: int
    joined_by: _Kind | None  # how it joins the item before it: LIST or RANGE


@dataclass
class _Phrase:
    items: list[_Item] = field(default_factory=list)
    floor_word: bool = False
    start: int = 0
    end: int = 0
    below_ground: bool = False

    def accept(self, plan_title: bool, units: list[_Unit]) -> bool:
        """Drop what the phrase cannot name; whether anything is left."""
        kept = []
        for item in self.items:
            if item.key == "typical":
                if not (plan_title and self._beside_floor_or_plan(item, units)):
                    continue
            elif item.weak and not self.floor_word:
                continue
            kept.append(item)
        if kept and kept[0].joined_by is not None:
            kept[0].joined_by = None
        self.items = kept
        if not kept:
            return False
        self.start = kept[0].start
        self.below_ground = any(i.key == "below" for i in kept)
        return True

    @staticmethod
    def _beside_floor_or_plan(item: _Item, units: list[_Unit]) -> bool:
        index = next(i for i, u in enumerate(units) if u.start == item.start)
        near = [units[i] for i in (index - 1, index + 1) if 0 <= i < len(units)]
        return any(u.kind in (_Kind.FLOOR, _Kind.PLAN) for u in near)

    def is_one_range(self) -> bool:
        """Whether the phrase is exactly two items joined by a range word."""
        return len(self.items) == 2 and self.items[1].joined_by is _Kind.RANGE

    def keys(self) -> tuple[dict[str, int], str | None] | None:
        """The storeys the phrase names, ranked, and the symbolic end a range runs to; none when a
        floor past the safety bound is named."""
        groups: list[list[_Item]] = []
        for item in self.items:
            if item.joined_by is _Kind.RANGE and groups:
                groups[-1].append(item)
            else:
                groups.append([item])
        listed: dict[str, int] = {}
        runs_to = None
        for group in groups:
            ends = [_resolve(i) for i in group]
            if any(e is None for e in ends):
                return None
            resolved = [e for e in ends if e is not None]
            if len(group) == 1:
                listed.update(resolved[0])
                continue
            found, end = _range(resolved)
            listed.update(found)
            runs_to = runs_to or end
        return listed, runs_to


def _resolve(item: _Item) -> dict[str, int] | None:
    """An item's storeys by rank; none for a floor outside 1 to `MAX_FLOOR`."""
    if item.key == "floor":
        n = item.number
        if n is None or not 1 <= n <= MAX_FLOOR:
            return None
        return {f"floor_{n}": _FLOOR_RANK + n}
    if item.key == "basement":
        n = item.number or 1
        if not 1 <= n <= _MAX_BASEMENT:
            return None
        return {f"basement_{n}": _BASEMENT_RANK - n}
    if item.key == "below":
        return {"foundation": _RANK["foundation"], "ground": _RANK["ground"]}
    if item.key in ("typical", "top"):
        return {item.key: -1}
    assert item.key is not None
    return {item.key: _RANK[item.key]}


def _range(ends: list[dict[str, int]]) -> tuple[dict[str, int], str | None]:
    """A range's storeys: its ends, and between the lowest and highest the ground floor and the
    numbered floors and basements; `top` or `typical` as an end, or an end above the numbered
    floors, leaves the floors between to Step 3 (`runs_to`)."""
    symbolic = [k for e in ends for k, r in e.items() if r < 0]
    concrete = {k: r for e in ends for k, r in e.items() if r >= 0}
    if not concrete:
        return {}, symbolic[0] if symbolic else None
    low, high = min(concrete.values()), max(concrete.values())
    listed = dict(concrete)
    runs_to = symbolic[0] if symbolic else None
    if low < _RANK["ground"] < high:
        listed["ground"] = _RANK["ground"]
    if _BASEMENT_RANK - _MAX_BASEMENT <= low < _BASEMENT_RANK:  # from a numbered basement up
        for rank in range(low + 1, min(high, _BASEMENT_RANK)):
            listed[f"basement_{_BASEMENT_RANK - rank}"] = rank
    top_floor = _FLOOR_RANK + MAX_FLOOR
    if high > top_floor:  # a range up to the roofs: the floors above its last named one are Step 3's
        runs_to = runs_to or "top"
        high = max((r for r in concrete.values() if r <= top_floor), default=low)
    for rank in range(max(low + 1, _FLOOR_RANK + 1), min(high, top_floor + 1)):
        listed[f"floor_{rank - _FLOOR_RANK}"] = rank
    return listed, runs_to


def _phrases(units: list[_Unit]) -> Iterator[_Phrase]:
    """Storeys joined by list and range words, with the floor words after them."""
    phrase: _Phrase | None = None
    joiner: _Kind | None = None
    floored = False  # a floor word already follows the phrase's last storey
    i = 0
    while i < len(units):
        u = units[i]
        item = _item(units, i)
        if item is not None:
            made, i = item
            if phrase is not None and joiner is not None:
                made.joined_by = joiner
                phrase.items.append(made)
            else:
                if phrase is not None:
                    yield phrase
                phrase = _Phrase([made], start=made.start)
            phrase.end = made.end
            joiner, floored = None, False
            continue
        if phrase is not None and u.kind is _Kind.FLOOR and not floored:
            # One floor word per storey: a second ("GROUND FLOOR FLOOR FINISH") begins the subject.
            phrase.floor_word, floored = True, True
            phrase.end = u.end
        elif phrase is not None and u.kind in (_Kind.LIST, _Kind.RANGE, _Kind.DASH):
            kind = _Kind.LIST if u.kind is _Kind.LIST else _Kind.RANGE
            joiner = kind if joiner is None or kind is _Kind.RANGE else joiner
            floored = False  # a floor word after a joiner leads the next storey ("TO FLOOR 5TH")
        else:
            if phrase is not None:
                yield phrase
            phrase, joiner = None, None
        i += 1
    if phrase is not None:
        yield phrase


def _item(units: list[_Unit], i: int) -> tuple[_Item, int] | None:
    """The storey item starting at unit `i`, and the unit after it; a basement takes its number
    ("BASEMENT-2", "2ND BASEMENT")."""
    u = units[i]
    nxt = units[i + 1] if i + 1 < len(units) else None
    if u.kind is _Kind.ORDINAL:
        if nxt is not None and nxt.kind is _Kind.STOREY and nxt.value == "basement":
            return _Item("basement", u.number, False, u.start, nxt.end, None), i + 2
        return _Item("floor", u.number, True, u.start, u.end, None), i + 1
    if u.kind is _Kind.BELOW:
        return _Item("below", None, False, u.start, u.end, None), i + 1
    if u.kind is not _Kind.STOREY:
        return None
    if u.value == "basement":
        j = i + 1
        if j < len(units) and units[j].kind is _Kind.DASH:
            j += 1
        if j < len(units) and units[j].kind is _Kind.OTHER and (n := _figure(units[j].value)):
            return _Item("basement", n, False, u.start, units[j].end, None), j + 1
        return _Item("basement", 1, False, u.start, u.end, None), i + 1
    return _Item(u.value, None, u.weak, u.start, u.end, None), i + 1
