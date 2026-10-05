"""The strings the literal wall cannot see: candidates for Jev's leak advice (contract jevleak-cli.md 2).

A pure reading of a draft: codes, member sizes, levels and capitalised names, each with its 1-based line
and place. Every pattern here is linear in its input (no nested quantifiers); tokens are cut at
whitespace first and a token longer than `LONGEST` characters is never read. Nothing here prints.
"""

import re
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from tools.leakscan import core

READ_MOST = 256 * 1024
"""Characters of the draft read for candidates; the rest is not read (the literal pass reads it all)."""
LONGEST = 64
"""The longest token taken for a candidate."""

CODE, NAMES, WORD = 0, 1, 2
"""The ranks: codes, sizes and levels first; then runs of capitalised words; then single words."""

_TOKEN = re.compile(r"\S+")
_SIZE = re.compile(r"(?<![\w.])[0-9]{2,5} {0,3}[xX\u00d7] {0,3}[0-9]{2,5}(?![\w.])")
_LEVEL = re.compile(r"[+\u00b1\u2212-][0-9]{1,3}\.[0-9]{2,3}")
_CODE_CHARS = re.compile(r"[A-Za-z0-9][A-Za-z0-9./_-]*")
_SHA = re.compile(r"[0-9a-f]{7,64}")
_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}(?:T[0-9:]{2,8}Z?)?")
_VERSION = re.compile(
    r"(?:[A-Za-z][A-Za-z0-9]*[-_])?[vV]?[0-9]{1,4}(?:\.[0-9]{1,4}){1,3}(?:[-+.][A-Za-z0-9]{1,16})?"
)
_ORDINAL = re.compile(r"[0-9]{1,4}(?:st|nd|rd|th|s)")
_OPEN = "\"'`*_([{<\u201c\u2018\u00ab"
_CLOSE = "\"'`*_)]}>\u201d\u2019\u00bb,;"
_ENDS = ".!?:"
_ENDINGS = tuple(_ENDS)
_MARKERS = re.compile(r"(?:#{1,6}|[-*+>|\u2022]|[0-9]{1,3}[.)]|\[[ xX]\])")
_LEADS = frozenset(
    "THE A AN THIS THAT THESE THOSE IT ITS IN ON AT FOR FROM TO AND BUT OR IF WHEN SEE OUR WE ALL "
    "EACH EVERY NO NOT WITH BY AS AFTER BEFORE THEN SO ALSO ONLY ONE TWO HERE THERE WHERE WHAT WHY "
    "HOW".split()
)
_SEPARATORS = "-'\u2019"


@dataclass(frozen=True, order=True)
class Candidate:
    """A string Jev may judge: its 1-based line and its text (never printed)."""

    line: int
    text: str
    rank: int = field(default=WORD, compare=False, repr=False)
    start: int = field(default=0, compare=False, repr=False)

    def __repr__(self) -> str:  # never the text
        return f"<Candidate line={self.line}>"


def key(text: str) -> str:
    """The form candidates are deduplicated by: normalised, spaces dropped."""
    return core.normalise(text).replace(" ", "")


@cache
def known() -> frozenset[str]:
    """`known.txt`'s words (the factory's own), normalised."""
    lines = Path(__file__).with_name("known.txt").read_text(encoding="utf-8").splitlines()
    return frozenset(key(line) for line in lines if line.strip() and not line.startswith("#"))


def _word(token: str) -> bool:
    """A capitalised word: letters with single inner hyphens or apostrophes, its first letter upper."""
    if not token or not token[0].isupper() or token[-1] in _SEPARATORS:
        return False
    previous = ""
    for char in token:
        if char in _SEPARATORS:
            if previous in _SEPARATORS:
                return False
        elif not char.isalpha():
            return False
        previous = char
    return True


def _code(token: str) -> bool:
    """Letters and digits together (`RC-14B`, `7B`, `DWG-2231-04`), but not a sha, a date, a version or
    an ordinal."""
    if not _CODE_CHARS.fullmatch(token) or token[-1] in "./_-":
        return False
    if not any(c.isdigit() for c in token) or not any(c.isascii() and c.isalpha() for c in token):
        return False
    return not (
        _SHA.fullmatch(token)
        or _DATE.fullmatch(token)
        or _VERSION.fullmatch(token)
        or _ORDINAL.fullmatch(token)
    )


_TITLES = frozenset(["MR.", "MRS.", "MS.", "DR.", "NO.", "RD.", "ST."])
"""Abbreviations that end in a full stop without ending a sentence (`Mr. Haverford`)."""


@dataclass
class _Token:
    text: str
    start: int
    initial: bool
    ends: bool
    soft: bool = False
    """After a label's colon or a table bar: not a sentence's start (`Client: Haverford`)."""


def _tokens(line: str) -> list[_Token]:
    """The line's tokens, quotes and brackets trimmed, each marked as a sentence's first, as after a
    label or a table bar (`soft`), or neither."""
    found: list[_Token] = []
    initial, soft = True, False
    for match in _TOKEN.finditer(line):
        raw = match.group()
        if len(raw) > LONGEST + 8:
            found.append(_Token("", match.start(), initial, False, soft))
            initial = soft = False
            continue
        if initial and _MARKERS.fullmatch(raw):
            continue
        lead = len(raw) - len(raw.lstrip(_OPEN))
        text = raw.strip(_OPEN).rstrip(_CLOSE)
        bare = raw.rstrip(_CLOSE + _OPEN)
        title = text.upper() in _TITLES
        ends = not title and (text.endswith(_ENDINGS) or bare.endswith(_ENDINGS))
        text = text.rstrip(_ENDS + _CLOSE)
        found.append(_Token(text, match.start() + lead, initial, ends, soft))
        label = ends and bare.endswith(":")
        initial = ends and not label
        soft = label or raw == "|"
    return found


def _line(number: int, line: str) -> list[Candidate]:
    found: list[Candidate] = []
    for match in _SIZE.finditer(line):
        found.append(Candidate(number, match.group(), CODE, match.start()))
    tokens = _tokens(line)
    run: list[_Token] = []

    def close() -> None:
        words = list(run)
        run.clear()
        if words and words[0].initial and (len(words) == 1 or key(words[0].text) in _LEADS):
            words = words[1:]  # a sentence's first word is a common word, not a name
        elif words and words[0].soft and key(words[0].text) in _LEADS:
            words = words[1:]  # after a label or a bar, only a common word is dropped
        begin = 0
        while begin < len(words):  # a run longer than LONGEST is taken in parts that fit
            end = begin + 1
            while (
                end < len(words)
                and words[end].start + len(words[end].text) - words[begin].start <= LONGEST
            ):
                end += 1
            part, begin = words[begin:end], end
            if all(key(w.text) in known() for w in part):
                continue
            text = line[part[0].start : part[-1].start + len(part[-1].text)]
            found.append(Candidate(number, text, NAMES if len(part) > 1 else WORD, part[0].start))

    for token in tokens:
        text = token.text
        if not text or len(text) > LONGEST:
            close()
            continue
        if _word(text):
            if token.initial or token.soft:
                close()
            run.append(token)
            if token.ends:
                close()
            continue
        if _LEVEL.fullmatch(text) or (_code(text) and not _SIZE.fullmatch(text)):
            start = token.start
            if (
                run
                and key(text) not in known()
                and not token.initial
                and key(run[-1].text) not in known()
                and token.start + len(text) - run[-1].start <= LONGEST
            ):
                start = run.pop().start  # a name and its code together (`Plot 7B`)
            close()
            if key(text) not in known():
                found.append(Candidate(number, line[start : token.start + len(text)], CODE, start))
            continue
        close()
    close()
    return found


def extract(text: str) -> list[Candidate]:
    """The draft's candidates, deduplicated by normalised form and ranked (codes, sizes and levels;
    then names of several words; then single words; each by first place), allowlisted ones left out.
    Every candidate is kept: the caller asks at most `MAX_ASKED` of them."""
    return [first for first, _ in occurrences(text)]


def occurrences(text: str) -> list[tuple[Candidate, list[int]]]:
    """Each distinct candidate (its first place) with every line it is found on, in rank order."""
    allowed = core.allowlist()
    seen: dict[str, tuple[Candidate, list[int]]] = {}
    for number, line in enumerate(text[:READ_MOST].split("\n"), start=1):
        for candidate in _line(number, line):
            name = key(candidate.text)
            if not name or core.digest(core.normalise(candidate.text)) in allowed:
                continue
            if name in seen:
                lines = seen[name][1]
                if lines[-1] != number:
                    lines.append(number)
            else:
                seen[name] = (candidate, [number])
    return sorted(seen.values(), key=lambda pair: (pair[0].rank, pair[0].line, pair[0].start))
