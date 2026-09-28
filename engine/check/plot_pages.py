"""The Plot's pages against the sheets, both ways (ticket 19b; ADR 0027: a Check against the source).

    check(reading, recognisers=...)   # run by engine.check.catalogue

18 matches each page of a Discipline's PDF to a sheet, or says why it matched none (`PlotMatch`, in
the reading's `plot`). Both ways, each within the sheets' group and Discipline:
- **Every page** is examined: one that matched a sheet passes; one that matched none fires `no_sheet`,
  named by its page number and 18's reason key (its subject is the match, which the export writes as its
  page).
- **Every numbered sheet** of a (group, Discipline) whose PDF matched at least one page is examined:
  one a page matched passes; one no page matched fires `no_page`. A Discipline with no matched page
  says nothing: its PDF may not exist (the seed's electrical file has none, m0-screens §7), and a sheet
  with no Discipline or no number sits out.

A page is known by its number, counting from 1 (12's `Page.number`); a match whose page has none, or
that names a sheet the reading does not hold, is refused. The Check says nothing when the Plot was not
read in every file (`reading.read`).
"""

from engine.messages import Message
from engine.messages import catalogue as names
from engine.messages import plot_pages as codes
from engine.recognise.conflicts import Recognisers, given, normal
from engine.recognise.types import CheckOutcome, CheckResult, PlotMatch, SetReading, SheetCandidate

CODE = "plot_pages"
VERSION = 1
MILESTONE = "M0"
KIND = "source"
MESSAGE = names.PLOT_PAGES


def check(reading: SetReading, *, recognisers: Recognisers) -> list[CheckResult]:
    """The Check: every page against the sheets, and every sheet of a plotted Discipline against the
    pages (`recognisers` unused: no number is read)."""
    given(reading.sheets, reading.views)
    if "plot" not in reading.read:
        return []
    held = {id(sheet) for sheet in reading.sheets}
    matched: set[int] = set()
    plotted: set[tuple[str, str]] = set()
    results = []
    for match in reading.plot:
        if not isinstance(match, PlotMatch):
            raise TypeError(f"a Plot match is a PlotMatch, not {type(match).__name__}")
        if match.sheet is None:
            finding = codes.NO_SHEET(page=_page(match.page), reason=str(match.reason))
            results.append(_result(match, finding))
            continue
        if id(match.sheet) not in held:
            raise ValueError("a Plot match names a sheet the reading does not hold")
        matched.add(id(match.sheet))
        if match.sheet.discipline is not None:
            plotted.add((str(match.sheet.group), match.sheet.discipline.value))
        results.append(_result(match, None))
    for sheet in reading.sheets:
        number = sheet.number
        if sheet.discipline is None or number is None or normal(number.value) is None:
            continue
        if (str(sheet.group), sheet.discipline.value) not in plotted:
            continue
        found = id(sheet) in matched
        results.append(_result(sheet, None if found else codes.NO_PAGE(number=number.value)))
    return results


SET = check
"""The Check's set function, which `engine.check.catalogue.run_all` runs."""


def _page(page: object) -> int:
    number = getattr(page, "number", None)
    if isinstance(number, bool) or not isinstance(number, int) or number < 1:
        raise TypeError(f"a Plot page has no page number counting from 1: {type(page).__name__}")
    return number


def _result(subject: PlotMatch | SheetCandidate, finding: Message | None) -> CheckResult:
    outcome = CheckOutcome.PASSED if finding is None else CheckOutcome.FIRED
    return CheckResult(CODE, outcome, subject=subject, finding=finding)
