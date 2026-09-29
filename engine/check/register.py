"""The drawing list against the sheets found, both ways; with no list, the numbering's continuity
(ticket 19b; ADR 0027: a Check against the source; CONTEXT.md's Drawing List, which the code calls
the register).

    check(reading, recognisers=...)                 # the Check, run by engine.check.catalogue
    numbering(sheets, conventions=..., recognisers=...)   # the run, for 19a and 22's heading
    parse(text, conventions, recognisers=...)       # a pasted list or a typed range, for 19a

**The lists.** A list read on a sheet is its `RegisterEntry` rows (13's), in the reading's `register`;
a list the QS pasted or typed is a `DrawingList` in the reading's `lists`. The Check takes one list per
(group, Discipline): the entries read on the sheets of a group make one list per Discipline (a list
continued over two sheets is one list), and a reading that gives a pasted or typed list as well for
that (group, Discipline), or two of them, is refused (the caller, 21c, holds both back while they
disagree). A read entry belongs to the Discipline whose prefix its number carries, when exactly one
Discipline of the conventions has that prefix, else to the Discipline of the sheet it is on (a cover
sheet may list every Discipline's sheets); an entry with neither sits out.

**Both ways**, within a (group, Discipline): each entry is found when a sheet's number is the same
number, else it fires `not_found` ("S-13 is on the drawing list but in no file"); each numbered sheet
is listed when an entry's number is the same number, else it fires `not_listed`. Numbers are compared
through 13's `sheets.sequence`: the same prefix, running number and suffix, by their letters and
digits (case folded), a Discipline's own prefix counting as none, so a title block's bare "07" is the
list's "S-07" (the Edison set writes both), and "7" is "07"; a number with no running number is
compared in its normal form (`engine.recognise.conflicts.normal`). Titles are not compared: a typed
range has none, and a sheet agrees with a list by its number (m0-screens 6.10).

**With no list** for a (group, Discipline) holding numbered sheets: its numbering (`numbering`) runs
per series (the prefix, a Discipline's own counting as none; suffixes set aside, so "S-101A" is 101),
and every gap fires `gap`, named by the numbers either side as their sheets print them and the count
missing (a gap of millions is one finding); a series with no gap passes.

**Every subject examined has a result**, passed or fired: a read entry (its `RegisterEntry`), a sheet,
and, with no candidate to name, a pasted or typed entry and a series (the set: no subject). The Check
says nothing when the register was not read in every file (`reading.read`) or the reading carries no
conventions.

**`parse`** reads a pasted list or a typed range, bounded (`TEXT_LIMIT` characters, `ENTRY_LIMIT`
entries, lines of `LINE_LIMIT` characters, numbers of `NUMBER_LIMIT`), and refuses by code
(engine/messages/register_check.py). A line of two numbers joined by an en or em dash, or by "to", is a
range, read as every number in it (without titles): "A-01 to A-29", or the same with an en dash
(U+2013) or an em dash between. A range that runs backwards ("57 to 01"), joins two kinds of number
("A-01 to B-09") or holds more than `ENTRY_LIMIT`
numbers is refused; so is one joined by a hyphen ("01-57", "A-01-A-29"), which cannot be told from one
sheet's number: the refusal asks for "01 to 57". Any other line is a sheet line when its first cell
(cells split by tabs, as a spreadsheet pastes; else its first word) reads as a sheet number through
13's `sequence`: its next cell or the rest of the line is the title, and a later cell that is a revision
mark by the conventions' pattern (on at most `MARK_LIMIT` characters) is its revision mark; so is a
mark written after the number, a space between ("S-01 R1" is sheet "S-01", revision "R1"; #100). Other
lines are ignored and counted. Lines break at a line feed or a bare carriage return; every other control
character is a space, never deleted, so it never joins the digits either side (#100): on such a line a
tabbed number cell whose first word is a number is read whole ("S-01 9"), and the Check names it.
A sheet number is one word, or two in a cell whose first is a Discipline's
prefix ("S 01"). A leading count (digits only) is set aside as a serial column only before a number
carrying a Discipline's prefix ("1  S-01  General notes"). Text alone cannot tell a count before a bare
number ("1  01  General notes") from a bare number before a title that starts with a count ("01  1250
SFT TYPICAL FLOOR PLAN", an ordinary title), so the first is read as sheet "1": the QS pastes such a
list without its serial column (three rounds of a wider rule each misread a real list, the review of
29 Sep 2026). A pasted list is
its Discipline's, as the QS chose it: an entry carrying another Discipline's prefix is compared with
this Discipline's sheets (a list read on a sheet is split by prefix instead). The source is `typed`
when every sheet line is a range, else `pasted`.
"""

import re
import unicodedata
from collections.abc import Callable, Hashable, Sequence
from dataclasses import dataclass
from itertools import pairwise

from engine.messages import Message
from engine.messages import catalogue as names
from engine.messages import register_check as codes
from engine.recognise.conflicts import (
    Numbers,
    Recognisers,
    clean,
    given,
    mark,
    normal,
    number_parts,
    split_revision,
)
from engine.recognise.types import (
    CheckOutcome,
    CheckResult,
    ListEntry,
    ListSource,
    RegisterEntry,
    SetReading,
    SheetCandidate,
    SheetConventions,
)

CODE = "register"
VERSION = 1
MILESTONE = "M0"
KIND = "source"
MESSAGE = names.REGISTER

TEXT_LIMIT = 1_000_000
"""The most characters `parse` reads."""
ENTRY_LIMIT = 10_000
"""The most entries a list (a range among them) may hold."""
LINE_LIMIT = 1_000
"""A longer line is not read as a sheet line (it is ignored and counted)."""
NUMBER_LIMIT = 64
"""A longer first cell is no sheet number."""
MARK_LIMIT = 16
"""The longest cell the revision-mark pattern is tried on (the pattern is the conventions')."""

_DASHES = ("\u2013", "\u2014")  # en dash, em dash
_SEPARATORS = "-\u2013\u2014:|.,;"

type Key = tuple[Hashable, ...]


class Refused(ValueError):
    """What `parse` refuses, with the message that says why (a code and its params)."""

    def __init__(self, finding: Message) -> None:
        super().__init__(finding["code"])
        self.finding = finding


@dataclass(frozen=True)
class Parsed:
    """A pasted list or typed range, read: its entries, its source, and the lines not read."""

    source: ListSource
    entries: tuple[ListEntry, ...]
    ignored: int
    """Lines with text that are not sheet lines."""


@dataclass(frozen=True)
class Gap:
    """Numbers missing from a series: none between `after` and `before`, as their sheets print them."""

    after: str
    before: str
    missing: int


@dataclass(frozen=True)
class Run:
    """One series of a Discipline's numbering, with no drawing list: 22's "numbering runs 01 to 57
    without a gap", or with its gaps."""

    group: str
    discipline: str
    first: str
    last: str
    """The lowest and highest numbers, as their sheets print them."""
    sheets: int
    gaps: tuple[Gap, ...]


# The Check ------------------------------------------------------------------------------------------


def check(reading: SetReading, *, recognisers: Recognisers) -> list[CheckResult]:
    """The Check: every list against its sheets both ways, and the numbering where there is no list."""
    given(reading.sheets, reading.views)
    if "register" not in reading.read or reading.conventions is None:
        return []
    numbers = Numbers(reading.conventions, recognisers)
    lists = _lists(reading, numbers)
    results: list[CheckResult] = []
    sheets_of: dict[tuple[str, str], list[SheetCandidate]] = {}
    for sheet in reading.sheets:
        if sheet.discipline is not None and _printed(sheet) is not None:
            sheets_of.setdefault((str(sheet.group), sheet.discipline.value), []).append(sheet)
    for (group, discipline), entries in lists.items():
        sheets = sheets_of.get((group, discipline), [])
        found = {numbers.key(_printed(s) or "", discipline) for s in sheets}
        listed = set()
        for number, subject in entries:
            key = numbers.key(number, discipline)
            listed.add(key)
            finding = None if key in found else codes.NOT_FOUND(number=number)
            results.append(_result(subject, finding))
        for sheet in sheets:
            printed = _printed(sheet) or ""
            known = numbers.key(printed, discipline) in listed
            finding = None if known else codes.NOT_LISTED(number=printed)
            results.append(_result(sheet, finding))
    unlisted = [s for (g, d), group in sheets_of.items() if (g, d) not in lists for s in group]
    for run in numbering(unlisted, conventions=reading.conventions, recognisers=recognisers):
        if not run.gaps:
            results.append(CheckResult(CODE, CheckOutcome.PASSED))
        for gap in run.gaps:
            finding = codes.GAP(
                after=gap.after, before=gap.before, missing=gap.missing, discipline=run.discipline
            )
            results.append(CheckResult(CODE, CheckOutcome.FIRED, finding=finding))
    return results


SET = check
"""The Check's set function, which `engine.check.catalogue.run_all` runs."""


def _result(subject: SheetCandidate | RegisterEntry | None, finding: Message | None) -> CheckResult:
    outcome = CheckOutcome.PASSED if finding is None else CheckOutcome.FIRED
    return CheckResult(CODE, outcome, subject=subject, finding=finding)


def _printed(sheet: SheetCandidate) -> str | None:
    """A sheet's number as printed, when it has one that is not only format characters."""
    if sheet.number is None or normal(sheet.number.value) is None:
        return None
    return sheet.number.value


def _lists(
    reading: SetReading, numbers: Numbers
) -> dict[tuple[str, str], list[tuple[str, RegisterEntry | None]]]:
    """Each (group, Discipline)'s one list: its entries' numbers, each with its subject (a read entry,
    or none for a pasted or typed one). Refuses two lists for one (group, Discipline)."""
    position = {id(sheet): i for i, sheet in enumerate(reading.sheets)}
    read: dict[tuple[str, str], list[tuple[str, RegisterEntry | None]]] = {}
    for entry in reading.register:
        if not isinstance(entry, RegisterEntry):
            raise TypeError(f"a register entry is a RegisterEntry, not {type(entry).__name__}")
        if id(entry.sheet) not in position:
            raise ValueError("a register entry is on a sheet the reading does not hold")
        if entry.number is None or normal(entry.number) is None:
            continue
        on = entry.sheet.discipline
        discipline = numbers.owner(entry.number) or (None if on is None else on.value)
        if discipline is not None:
            read.setdefault((str(entry.sheet.group), discipline), []).append((entry.number, entry))
    lists = dict(read)
    for given_list in reading.lists:
        key = (given_list.group, given_list.discipline)
        if key in lists:
            what = "a list read on a sheet" if key in read else "another pasted or typed list"
            raise ValueError(
                f"a pasted or typed list for {key[1]} in {key[0]} beside {what}: give one list"
            )
        lists[key] = [(entry.number, None) for entry in given_list.entries]
    return lists


# The numbering's continuity ------------------------------------------------------------------------


def numbering(
    sheets: Sequence[SheetCandidate], *, conventions: SheetConventions, recognisers: Recognisers
) -> list[Run]:
    """Each (group, Discipline)'s numbering, per series, in the order of each series' first sheet:
    its lowest and highest numbers and its gaps. Sheets with no Discipline, or no running number, sit
    out. Linear in the sheets, plus sorting each series' running numbers."""
    numbers = Numbers(conventions, recognisers)
    series: dict[tuple[str, str, str], dict[int, str]] = {}
    counts: dict[tuple[str, str, str], int] = {}
    for sheet in sheets:
        if sheet.group is None:
            raise ValueError("a sheet has no group: its caller stamps each sheet with its file's group")
        printed = _printed(sheet)
        if sheet.discipline is None or printed is None:
            continue
        read = numbers.parts_in(printed, sheet.discipline.value)
        if read is None:
            continue
        key = (sheet.group, sheet.discipline.value, read[0])
        series.setdefault(key, {}).setdefault(read[1], printed)
        counts[key] = counts.get(key, 0) + 1
    runs = []
    for (group, discipline, _), printed_by_running in series.items():
        runnings = sorted(printed_by_running)
        gaps = tuple(
            Gap(printed_by_running[low], printed_by_running[high], high - low - 1)
            for low, high in pairwise(runnings)
            if high - low > 1
        )
        first, last = printed_by_running[runnings[0]], printed_by_running[runnings[-1]]
        runs.append(Run(group, discipline, first, last, counts[(group, discipline, _)], gaps))
    return runs


# Reading a pasted list or a typed range ------------------------------------------------------------


def parse(text: str, conventions: SheetConventions, *, recognisers: Recognisers) -> Parsed:
    """A pasted list or a typed range, read (the module's rules), or `Refused` with why."""
    if not isinstance(text, str):
        raise TypeError(f"a drawing list is text, not {type(text).__name__}")
    if len(text) > TEXT_LIMIT:
        raise Refused(codes.TEXT_TOO_LONG(limit=TEXT_LIMIT))
    revision = _revision_mark(conventions.revision_mark_pattern)
    prefixes = frozenset(mark(p) for d in conventions.disciplines for p in d.prefixes) - {""}
    entries: list[ListEntry] = []
    ignored = ranges = sheet_lines = 0
    # Lines as the QS sees them: split on line feeds and bare carriage returns (an API client's paste,
    # #100), never NEL, U+2028 or a form feed.
    for index, raw in enumerate(text.replace("\r\n", "\n").replace("\r", "\n").split("\n"), start=1):
        line = _scrub(raw).strip()
        if not line:
            continue
        if len(line) > LINE_LIMIT:
            ignored += 1
            continue
        found = _range(line, index, recognisers)
        if found is not None:
            first, low, high = found
            if len(entries) + high[1] - low[1] + 1 > ENTRY_LIMIT:  # before a number is built
                raise Refused(codes.TOO_MANY(limit=ENTRY_LIMIT))
            ranges += 1
            sheet_lines += 1
            entries.extend(ListEntry(number, index) for number in _numbers(first, low, high))
        elif (
            entry := _sheet_line(
                _cells(line),
                index,
                recognisers,
                revision,
                prefixes,
                pattern=conventions.revision_mark_pattern,
                spaced=_has_control(raw),
            )
        ) is not None:
            sheet_lines += 1
            entries.append(entry)
            if len(entries) > ENTRY_LIMIT:
                raise Refused(codes.TOO_MANY(limit=ENTRY_LIMIT))
        else:
            ignored += 1
    if not entries:
        raise Refused(codes.NOTHING_FOUND())
    source = ListSource.TYPED if ranges == sheet_lines else ListSource.PASTED
    return Parsed(source, tuple(entries), ignored)


_BIDI = frozenset("\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069")
"""The direction marks, embeddings, overrides and isolates: never part of a number or a title."""


def _scrub(line: str) -> str:
    """A line with each control character a space (a tab kept, between cells), never deleted, so it
    never joins the characters either side ("S-01", DEL, "9" is not "S-019"; #100); so are the direction
    controls (an override would reach a Question's words) and the line and paragraph separators (a
    line breaks only at a line feed or a carriage return). A NUL cannot be stored."""
    return "".join(
        char
        if char == "\t"
        else " "
        if char in _BIDI or unicodedata.category(char) in ("Cc", "Zl", "Zp")
        else char
        for char in line
    )


def _has_control(line: str) -> bool:
    """Whether a line held a character `_scrub` makes a space (a tab aside)."""
    return any(
        char != "\t" and (char in _BIDI or unicodedata.category(char) in ("Cc", "Zl", "Zp"))
        for char in line
    )


def _is_number(token: str, recognisers: Recognisers) -> bool:
    return 0 < len(token) <= NUMBER_LIMIT and number_parts(recognisers, token) is not None


type _Parts = tuple[str, int, str]


def _range(line: str, index: int, recognisers: Recognisers) -> tuple[str, _Parts, _Parts] | None:
    """A range line's first number and its two ends' parts, or none when the line is no range;
    `Refused` when it is a range that cannot be read. Nothing is built here: the caller checks the
    range's size against the list's limit first."""
    words = line.split()  # never a regular expression over the line: the work stays linear
    if len(words) == 3 and words[1].casefold() == "to":
        halves = [words[0], words[2]]
    else:
        dashed = [dash for dash in _DASHES if dash in line]
        halves = [half.strip() for half in line.split(dashed[0])] if len(dashed) == 1 else []
    if len(halves) != 2 or not all(h and not any(c.isspace() for c in h) for h in halves):
        _hyphenated(line, index, recognisers)
        return None
    first, last = halves
    if not (_is_number(first, recognisers) and _is_number(last, recognisers)):
        return None
    low, high = number_parts(recognisers, first), number_parts(recognisers, last)
    assert low is not None
    assert high is not None
    if (mark(low[0]), mark(low[2])) != (mark(high[0]), mark(high[2])):
        raise Refused(codes.RANGE_MIXED(line=index, first=first, last=last))
    if high[1] < low[1]:
        raise Refused(codes.RANGE_BACKWARDS(line=index, first=first, last=last))
    if high[1] - low[1] + 1 > ENTRY_LIMIT:
        raise Refused(codes.RANGE_TOO_LONG(line=index, first=first, last=last, limit=ENTRY_LIMIT))
    return first, low, high


def _numbers(first: str, low: _Parts, high: _Parts) -> list[str]:
    """A range's numbers, printed as its first number is."""
    prefix, suffix, width = _form(clean(first), low)
    return [f"{prefix}{str(running).zfill(width)}{suffix}" for running in range(low[1], high[1] + 1)]


def _form(printed: str, parts: tuple[str, int, str]) -> tuple[str, str, int]:
    """How a range's numbers are printed: as its first number is, its padding kept ("A-01")."""
    prefix, _, suffix = parts
    if printed.startswith(prefix) and printed.endswith(suffix):
        digits = printed[len(prefix) : len(printed) - len(suffix)]
        if digits.isdigit():
            return prefix, suffix, len(digits)
    return prefix, suffix, 0


def _hyphenated(line: str, index: int, recognisers: Recognisers) -> None:
    """Refuse a line that is two numbers of one kind joined by a hyphen ("01-57"): one number, or a
    range? The QS is asked to write "01 to 57"."""
    words = line.split()
    if not all(a.endswith("-") or b.startswith("-") for a, b in pairwise(words)):
        return  # a space not beside a hyphen: words, not one token
    token = "".join(words)
    if len(token) > 2 * NUMBER_LIMIT + 1:
        return
    hyphens = [i for i, char in enumerate(token) if char == "-"]
    if len(hyphens) % 2 == 0:
        return  # two numbers of one kind hold as many hyphens each: an odd count, split in the middle
    at = hyphens[len(hyphens) // 2]  # one split tried, never one per hyphen
    first, last = token[:at], token[at + 1 :]
    if not (_is_number(first, recognisers) and _is_number(last, recognisers)):
        return
    low, high = number_parts(recognisers, first), number_parts(recognisers, last)
    assert low is not None
    assert high is not None
    if (mark(low[0]), mark(low[2])) == (mark(high[0]), mark(high[2])):
        raise Refused(codes.RANGE_HYPHEN(line=index, first=first, last=last))


def _cells(line: str) -> tuple[list[str], bool]:
    """A line's cells, and whether they are tabbed: split by tabs, as a spreadsheet pastes; else the
    line's first two words and the rest."""
    if "\t" in line:
        return [cell.strip() for cell in line.split("\t") if cell.strip()], True
    return line.split(maxsplit=2), False


def _number_cell(
    cell: str, recognisers: Recognisers, prefixes: frozenset[str], *, spaced: bool = False
) -> bool:
    """Whether a cell is a sheet number: it reads as one, and it is one word, or two words whose first
    is a Discipline's prefix ("S 01"). A heading ("Drawing no 1") or a title that ends in a digit is
    not. On a line that held a control character (`spaced`), a tabbed cell whose first word is a number
    is read whole, the control's space kept ("S-01 9"), so the Check names it as pasted rather than
    dropping the line or joining its digits (#100)."""
    if not _is_number(cell, recognisers):
        return False
    if not any(char.isspace() for char in cell):
        return True
    if spaced and _is_number(cell.split()[0], recognisers):
        return True
    parts = number_parts(recognisers, cell)
    return parts is not None and mark(parts[0]) in prefixes


def _prefixed(cell: str, recognisers: Recognisers, prefixes: frozenset[str]) -> bool:
    """Whether a cell is a sheet number carrying a Discipline's prefix: after a count, the one sign
    the count is a serial column rather than the sheet's own number."""
    if not _number_cell(cell, recognisers, prefixes):
        return False
    parts = number_parts(recognisers, cell)
    return parts is not None and mark(parts[0]) in prefixes


def _sheet_line(
    line: tuple[list[str], bool],
    index: int,
    recognisers: Recognisers,
    revision: Callable[[str], bool],
    prefixes: frozenset[str],
    *,
    pattern: str | None = None,
    spaced: bool = False,
) -> ListEntry | None:
    cells, tabbed = line
    if (
        len(cells) > 1
        and cells[0].isdecimal()
        and _prefixed(split_revision(cells[1], pattern)[0], recognisers, prefixes)
    ):
        cells = cells[1:]  # a serial column ("1  S-01  General notes", "1  S-01 R1  ...") is set aside
    number, written = split_revision(cells[0], pattern)  # "S-01 R1" (#100)
    if not _number_cell(number, recognisers, prefixes, spaced=tabbed and spaced):
        return None
    if tabbed:
        text = cells[1] if len(cells) > 1 else ""
        # a revision column wins over a mark written in the number's cell
        mark_cell = next((c for c in reversed(cells[2:]) if revision(c)), written)
    else:
        text, mark_cell = " ".join(cells[1:]), written
        words = text.split(maxsplit=2)
        for n in (2, 1):  # "S-01 REV A Pile layout plan", "S-01 R1 Pile layout plan"
            if mark_cell is None and len(words) >= n and revision(" ".join(words[:n])):
                mark_cell, text = " ".join(words[:n]), " ".join(text.split(maxsplit=n)[n:])
    title = text.strip().lstrip(_SEPARATORS).strip() or None
    return ListEntry(number, index, title=title, revision_mark=mark_cell)


def _revision_mark(pattern: str | None) -> Callable[[str], bool]:
    """Whether a cell is a revision mark by the conventions' pattern, tried on short cells only."""
    if pattern is None:
        return lambda cell: False
    compiled = re.compile(pattern)
    return lambda cell: len(cell) <= MARK_LIMIT and compiled.fullmatch(cell) is not None
