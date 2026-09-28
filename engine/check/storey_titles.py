"""The storeys a sheet's title names against the storeys its plans' titles name (ticket 19b; ADR 0027:
a Check against the source).

    check(reading, recognisers=...)   # run by engine.check.catalogue

A sheet carries its title's storey words verbatim (`storeys_as_stated`, 13's); its plan views carry
their storeys as canonical keys (17's, from their titles). The title's words are read into keys by
13's `storeys.read` (`Recognisers.storeys`), never here. Per sheet:
- **Examined** when its title states storey words that read as at least one storey and it has a plan
  view with a storey list; a sheet with no plan view, or no storey words, or with neither a number nor
  a title to be named by, sits out (m0-screens 6.8: a sheet with no plan view raises nothing).
- **Compared** by the storeys that are not symbolic ("typical", "top" and "not stated" are Step 3's to
  resolve; `Recognisers.symbolic`): a storey the title names that no plan names counts in `not_drawn`,
  unless a plan's list holds a symbolic storey; a storey a plan names that the title does not counts in
  `not_named`, unless the title holds a symbolic storey. So a symbolic storey alone never fires: "1st to
  top floor" against plans of the 1st to 9th passes. Either count above 0 fires `differ`; else passes.

The Check says nothing when the views were not read in every file (`reading.read`).
"""

from collections.abc import Collection

from engine.messages import storey_titles as codes
from engine.recognise.conflicts import Recognisers, given, normal, sheet_name
from engine.recognise.types import CheckOutcome, CheckResult, SetReading, ViewKind

CODE = "storey_titles"
VERSION = 1
MILESTONE = "M0"
KIND = "source"
MESSAGE = codes.DIFFER


def check(reading: SetReading, *, recognisers: Recognisers) -> list[CheckResult]:
    """The Check: each sheet's title storeys against its plans' storeys."""
    given(reading.sheets, reading.views)
    if "views" not in reading.read:
        return []
    symbolic: dict[str, bool] = {}

    def is_symbolic(storey: str) -> bool:
        if storey not in symbolic:
            answer = recognisers.symbolic(storey)
            if not isinstance(answer, bool):
                raise TypeError(f"13's symbolic returned {type(answer).__name__}, not a boolean")
            symbolic[storey] = answer
        return symbolic[storey]

    results = []
    for sheet, views in zip(reading.sheets, reading.views, strict=True):
        stated, name = sheet.storeys_as_stated, sheet_name(sheet)
        plans = [v for v in views if v.kind == ViewKind.PLAN and v.storeys]
        if stated is None or normal(stated.value) is None or name is None or not plans:
            continue
        title = _keys(recognisers.storeys(stated.value))
        if not title:
            continue
        drawn = [storey for view in plans for storey in view.storeys]
        title_open, drawn_open = any(map(is_symbolic, title)), any(map(is_symbolic, drawn))
        title_real = {s for s in title if not is_symbolic(s)}
        drawn_real = {s for s in drawn if not is_symbolic(s)}
        not_drawn = 0 if drawn_open else len(title_real - drawn_real)
        not_named = 0 if title_open else len(drawn_real - title_real)
        if not_drawn or not_named:
            finding = codes.DIFFER(
                sheet=name[0],
                named=name[1],
                stated=stated.value,
                not_drawn=not_drawn,
                not_named=not_named,
            )
            results.append(CheckResult(CODE, CheckOutcome.FIRED, subject=sheet, finding=finding))
        else:
            results.append(CheckResult(CODE, CheckOutcome.PASSED, subject=sheet))
    return results


SET = check
"""The Check's set function, which `engine.check.catalogue.run_all` runs."""


def _keys(storeys: Collection[str]) -> list[str]:
    """13's answer, checked: storey keys as text."""
    if isinstance(storeys, str) or not isinstance(storeys, Collection):
        raise TypeError(f"13's storeys returned {type(storeys).__name__}, not a collection of keys")
    keys = list(storeys)
    for key in keys:
        if not isinstance(key, str):
            raise TypeError(f"13's storeys returned a key that is not text: {key!r}")
    return keys
