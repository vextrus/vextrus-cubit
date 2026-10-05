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

_TOKEN = re.compile(r"[^\s/\\]+")
"""Tokens are cut at whitespace and at `/` and `\\`, as the literal wall's split does."""
_SIZE = re.compile(r"(?<![\w.])[0-9]{2,5} {0,3}[xX\u00d7] {0,3}[0-9]{2,5}(?![\w.])")
_LEVEL = re.compile(r"[+\u00b1\u2212-][0-9]{1,3}\.[0-9]{2,3}")
_CODE_CHARS = re.compile(r"[A-Za-z0-9][A-Za-z0-9./_-]*")
_SHA = re.compile(r"[0-9a-f]{7,64}")
_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}(?:T[0-9:]{2,8}Z?)?")
_VERSION = re.compile(
    r"(?:[vV]|[a-z][a-z0-9]*[-_][vV]?)[0-9]{1,4}(?:\.[0-9]{1,4}){1,3}(?:[-+.][A-Za-z0-9]{1,16})?"
)
"""A version: a `v` prefix (`v1.2`) or a lower-case word's (`jev-1.13.0`); bare dotted numbers hold no
letter, so are never codes. `A-1.01`, `ST-3.1` are sheet numbers, not versions."""
_ORDINAL = re.compile(r"[0-9]{1,4}(?:st|nd|rd|th|s)")
_OPEN = "\"'`*_([{<\u201c\u2018\u00ab"
_CLOSE = "\"'`*_)]}>\u201d\u2019\u00bb,;"
_ENDS = ".!?:"
_ENDINGS = tuple(_ENDS)
_MARKERS = re.compile(r"(?:#{1,6}|[-*+>|\u2022]|[0-9]{1,3}[.)]|\[[ xX]\])")
FUNCTION_WORDS = frozenset(
    """
    a an the this that these those it its i we you he she they me us him her them my our your his
    their in on at for to of by from with into onto about over under after before up down out off
    and but or nor so yet if when while as than then because though although is are was were be been
    being am has have had do does did can could will would shall should must might not no all any
    each every some both either neither nothing
    """.upper().split()
)
"""English's closed classes: never a name alone, and never a name run's first word (contract 2)."""
TITLES = frozenset("MR MRS MS MISS DR MD MST ENGR AR PROF SIR SK SRI SHRI".split())
"""Honorifics: a name's title, never a name alone."""
START_WORDS = frozenset(
    """
    add added adds allow allowed answer answered approve approved ask asked build built call called
    change changed check checked close closed cut design designed done drop dropped end ended fail
    failed find found fine fix fixed follow following give ignore ignored keep kept landed make made
    measure measured merge merged move moved need note noted open opened pass passed print printed
    push pushed read refuse refused remove removed return review reviewed run ran send sent set show
    sign signed start started stop stopped take test tested try tried update updated use used verify
    verified want write wrote also here there today yes please however otherwise
    architect client consultant contractor date designer drawing engineer issue item owner page plan
    project revision scale schedule section sheet site summary system title total type version water
    commit round session ticket
    """.upper().split()
)
"""Everyday words that open a draft's sentences (`Water runs down the drain.`, `Landed on ...`): dropped
only when one stands alone at a true sentence start (a line's first word, or after `.`, `!`, `?`), never
after a label's colon or a table bar and never in a run. Words that start site or building names
(points of the compass, `Court`, `Annex`, months) are left out on purpose."""
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


@dataclass
class _Token:
    text: str
    start: int
    initial: bool
    """A true sentence start: the line's first token (after list markers), or after `.`, `!`, `?`."""
    ends: bool
    split: bool = False
    """Cut from the token before at `/` or `\\`: a new name, never the same run."""


def _tokens(line: str) -> list[_Token]:
    """The line's tokens, quotes and brackets trimmed, each marked as a sentence's first or not."""
    found: list[_Token] = []
    initial = True
    for match in _TOKEN.finditer(line):
        raw = match.group()
        split = match.start() > 0 and line[match.start() - 1] in "/\\"
        if len(raw) > LONGEST + 8:
            found.append(_Token("", match.start(), initial, False))
            initial = False
            continue
        if initial and _MARKERS.fullmatch(raw):
            continue
        lead = len(raw) - len(raw.lstrip(_OPEN))
        text = raw.strip(_OPEN).rstrip(_CLOSE)
        bare = raw.rstrip(_CLOSE + _OPEN)
        ends = text.endswith(_ENDINGS) or bare.endswith(_ENDINGS)
        text = text.rstrip(_ENDS + _CLOSE)
        found.append(_Token(text, match.start() + lead, initial, ends, split))
        initial = ends and not bare.endswith(":")
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
        if words and key(words[0].text) in FUNCTION_WORDS:
            words = words[1:]  # `The Thistlewood Granary`: the article is not the name
        if len(words) == 1 and words[0].initial and key(words[0].text) in START_WORDS:
            words = []  # `Water runs down the drain.`: an everyday word opening a sentence
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
            alone = key(part[0].text)
            if len(part) == 1 and (len(alone) < 2 or alone in FUNCTION_WORDS or alone in TITLES):
                continue  # an initial, a function word or a title alone is not a name
            text = line[part[0].start : part[-1].start + len(part[-1].text)]
            found.append(Candidate(number, text, NAMES if len(part) > 1 else WORD, part[0].start))

    for token in tokens:
        text = token.text
        if not text or len(text) > LONGEST:
            close()
            continue
        if _word(text):
            if token.initial or token.split:
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
                and key(run[-1].text) not in FUNCTION_WORDS
                and not token.initial
                and not token.split
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
