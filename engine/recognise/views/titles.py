"""What a view's title says (17; S15-E6's part): its kind, subject and layer, read by the view
conventions' words (`engine/recognise/conventions/view-default.json` by default: the title words of
each kind, the subject and layer words and the scale patterns, all data). Reads words only: never paper
nor a drawing.

    views.subjects(text, conventions=None) -> frozenset[str]             (19b's continuations)
    views.describe(text, conventions=None) -> Described                   (19b's continuations)
    views.default_conventions() -> ViewConventions

Its subject is the conventions' subject whose words stand first in the title (the longest words first:
"pile cap" before "pile"); its layer the top or bottom words ("top" before a floor or level word is a
storey, not a layer). A view drawn with no title has none of these. Its stated scale is the first scale
pattern found in its title or a text on its title's line or just under it (`scales.read`), verbatim;
N.T.S. marks it not to scale.
"""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from engine.recognise import sheets as sheet_finder
from engine.recognise.types import Layer, ViewConventions, ViewKind

DEFAULT_CONVENTIONS = Path(__file__).parent.parent / "conventions" / "view-default.json"


@cache
def default_conventions() -> ViewConventions:
    return ViewConventions.from_json(json.loads(DEFAULT_CONVENTIONS.read_text(encoding="utf-8")))


@dataclass(frozen=True)
class _Words:
    """A conventions' word lists, matched whole, ignoring case, the longest first."""

    phrases: tuple[tuple[tuple[str, ...], str], ...]  # (words, key), longest first

    @classmethod
    def of(cls, lists: Mapping[str, tuple[str, ...]]) -> _Words:
        found = [(tuple(_tokens(w)), str(key)) for key, words in lists.items() for w in words]
        found = [f for f in found if f[0]]
        found.sort(key=lambda f: -len(f[0]))
        return cls(tuple(found))

    def matches(self, tokens: Sequence[str]) -> list[tuple[int, int, str]]:
        """Each (start, end, key) found, left to right, none overlapping (the longest wins)."""
        taken = [False] * len(tokens)
        found = []
        for words, key in self.phrases:
            n = len(words)
            for i in range(len(tokens) - n + 1):
                if tuple(tokens[i : i + n]) == words and not any(taken[i : i + n]):
                    found.append((i, i + n, key))
                    for j in range(i, i + n):
                        taken[j] = True
        found.sort()
        return found


def _tokens(text: str) -> list[str]:
    return "".join(c if c.isalnum() else " " for c in text.casefold()).split()


@dataclass(frozen=True)
class _Reading:
    kinds: _Words
    order: Mapping[str, int]
    subjects: _Words
    layers: _Words
    patterns: tuple[str, ...]
    after_top: frozenset[str]  # words after "top" that make it a storey
    common: frozenset[str]  # the plan, floor and level words: no evidence of what a title names
    notes: frozenset[str] = frozenset()  # the Disciplines whose sheets are general notes
    headings: _Words = _Words(())  # words that make a text a heading of their kind when they lead it
    heading_tokens: frozenset[str] = frozenset()  # their words, one by one


_readings: list[tuple[ViewConventions, _Reading]] = []
"""The conventions last read with, and their words prepared (conventions hold dicts: no hash)."""


def _reading(conventions: ViewConventions) -> _Reading:
    if not _readings or _readings[0][0] is not conventions:
        _readings[:] = [(conventions, _prepare(conventions))]
    return _readings[0][1]


def _prepare(conventions: ViewConventions) -> _Reading:
    sheet = sheet_finder.default_conventions()
    after = {t for w in (*sheet.floor_words, *sheet.level_words) for t in _tokens(w)}
    return _Reading(
        kinds=_Words.of({str(k): v for k, v in conventions.kind_words.items()}),
        order={str(k): i for i, k in enumerate(conventions.kind_words)},
        subjects=_Words.of(conventions.subject_words),
        layers=_Words.of({str(k): v for k, v in conventions.layer_words.items()}),
        patterns=conventions.scale_patterns,
        after_top=frozenset(after),
        common=frozenset(
            t for w in (*sheet.plan_words, *sheet.floor_words, *sheet.level_words) for t in _tokens(w)
        ),
        notes=frozenset(conventions.notes_disciplines),
        headings=_Words.of({str(k): v for k, v in conventions.heading_words.items()}),
        heading_tokens=frozenset(
            t for words in conventions.heading_words.values() for w in words for t in _tokens(w)
        ),
    )


def _heading(text: str, reading: _Reading) -> ViewKind | None:
    """The kind whose heading words lead the text, written as a heading's are: the heading words
    alone ("NOTES") or a colon after them ("NOTE ON LAPS :", "NOTE : ..."); else None ("NOTE 2" is a
    callout naming a note, "NOTE THE ..." a sentence)."""
    tokens = _tokens(text)
    found = reading.headings.matches(tokens)
    if not found or found[0][0] != 0:
        return None
    if ":" not in text and not all(w in reading.heading_tokens for w in tokens):
        return None
    return ViewKind(found[0][2])


def _kind(text: str, reading: _Reading) -> ViewKind | None:
    if (heading := _heading(text, reading)) is not None:
        return heading  # a heading's leading words name its kind, whatever words follow
    return _named_kind(text, reading)


def _named_kind(text: str, reading: _Reading) -> ViewKind | None:
    """The kind the text's kind words name (the first listed wins), heading words aside."""
    found = reading.kinds.matches(_tokens(text))
    if not found:
        return None
    return ViewKind(min((key for _, _, key in found), key=lambda k: reading.order[k]))


def _subject(text: str, reading: _Reading) -> str | None:
    found = reading.subjects.matches(_tokens(text))
    return found[0][2] if found else None


def _subjects_in_order(text: str, reading: _Reading) -> tuple[str, ...]:
    """Every subject the text names, each once, in the order they stand ("COLUMN & BEAM DETAILS")."""
    return tuple(dict.fromkeys(key for _, _, key in reading.subjects.matches(_tokens(text))))


@dataclass(frozen=True)
class Described:
    """What a title says, for 19b's continuations (#102): its kind, its layer, and its other words (not
    the kind's or layer's words, nor the plan, floor and level words, nor marks: a word with a digit,
    two letters or fewer, or a continued-sheet word), in normal form."""

    kind: ViewKind | None
    layer: Layer | None
    words: frozenset[str]


def describe(text: str, conventions: ViewConventions | None = None) -> Described:
    """A title's kind, layer and other words (`Described`)."""
    reading = _reading(conventions if conventions is not None else default_conventions())
    tokens = _tokens(text)
    spent: set[int] = set()
    for words in (reading.kinds, reading.layers):
        for start, end, _ in words.matches(tokens):
            spent.update(range(start, end))
    rest = frozenset(t for i, t in enumerate(tokens) if i not in spent and not _mark(t)) - reading.common
    return Described(_kind(text, reading), _layer(text, reading), rest)


CONTINUED = frozenset({"cont", "contd", "continued"})
"""The words that mark a continued sheet: no evidence of what it names (review 2 of 17)."""


def _mark(word: str) -> bool:
    """A mark, not a word naming something: it holds a digit ("B1", "1"), has two letters or fewer
    ("of", "a"), or says the sheet is continued."""
    return any(c.isdigit() for c in word) or len(word) <= 2 or word in CONTINUED


def subjects(text: str, conventions: ViewConventions | None = None) -> frozenset[str]:
    """Every subject a text names by the conventions' subject words (19b's continuations, #102)."""
    reading = _reading(conventions if conventions is not None else default_conventions())
    return frozenset(key for _, _, key in reading.subjects.matches(_tokens(text)))


def _layer(text: str, reading: _Reading) -> Layer | None:
    tokens = _tokens(text)
    for _, end, key in reading.layers.matches(tokens):
        if end < len(tokens) and tokens[end] in reading.after_top:
            continue  # "top floor": a storey
        return Layer(key)
    return None
