"""Coverage: no view unaccounted (ticket 19b; ADR 0027: a conservation Check; CONTEXT.md's Coverage).

    check(reading, recognisers=...)   # run by engine.check.catalogue
    status(view, sheet)                # a view's Coverage at read

A view's Coverage at read is what its proposal says (`engine.export.coverage(view)`: its Takeoff
Steps or Discipline Part, assigned; its exclusion, excluded; neither, unaccounted), except that **a
view on an excluded sheet counts as excluded** (m0-screens 6.11: "excluded once its sheet or itself is
excluded"; the orchestrator's ruling of 29 Sep 2026 where the two differ). Every view is examined: one
assigned or excluded passes; an unaccounted one fires `unaccounted` (named by its sheet and its title,
m0-screens 6.11's "S-20 8th floor beam layout"), or `unaccounted_untitled` (by its kind) when it has
no title. The Check says nothing when the views were not read in every file (`reading.read`).
"""

from engine import export
from engine.messages import Message
from engine.messages import catalogue as names
from engine.messages import coverage as codes
from engine.recognise.conflicts import Recognisers, given, normal, sheet_name
from engine.recognise.types import (
    CheckOutcome,
    CheckResult,
    SetReading,
    SheetCandidate,
    ViewCandidate,
)

CODE = "coverage"
VERSION = 1
MILESTONE = "M0"
KIND = "conservation"
MESSAGE = names.COVERAGE

UNACCOUNTED = "unaccounted"


def status(view: ViewCandidate, sheet: SheetCandidate) -> str:
    """The view's Coverage at read: `assigned`, `excluded` or `unaccounted`."""
    return "excluded" if sheet.exclusion is not None else export.coverage(view)


def check(reading: SetReading, *, recognisers: Recognisers) -> list[CheckResult]:
    """The Check: every view of every sheet (`recognisers` unused: nothing is read)."""
    given(reading.sheets, reading.views)
    if "views" not in reading.read:
        return []
    results = []
    for sheet, views in zip(reading.sheets, reading.views, strict=True):
        for view in views:
            finding = _finding(sheet, view) if status(view, sheet) == UNACCOUNTED else None
            outcome = CheckOutcome.PASSED if finding is None else CheckOutcome.FIRED
            results.append(CheckResult(CODE, outcome, subject=view, finding=finding))
    return results


SET = check
"""The Check's set function, which `engine.check.catalogue.run_all` runs."""


def _finding(sheet: SheetCandidate, view: ViewCandidate) -> Message:
    name, named = sheet_name(sheet) or ("", "none")
    if view.title is not None and normal(view.title) is not None:
        return codes.UNACCOUNTED(sheet=name, named=named, view=view.title)
    return codes.UNACCOUNTED_UNTITLED(sheet=name, named=named, kind=str(view.kind))
