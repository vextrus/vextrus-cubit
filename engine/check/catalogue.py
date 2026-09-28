"""The Check catalogue (ticket 19b; ADR 0027): every Check in engine/check/, found by listing it.

    entries()                        # each Check's Library row: 19a's `takeoff/library.py` reads it
    run_all(reading)                 # the harness's stage: every set Check over one set
    run(reading, recognisers=...)    # the same with 13's readers given, for 21c and the tests

**A Check** is a module of engine/check/ (`engine.collect.submodules`, this module left out)
declaring, at module level:
- `CODE`, its key (lower-case letters, digits and underscores), once in the catalogue;
- `VERSION`, an integer from 1; `MILESTONE`, the milestone that brings it ("M0");
- `KIND`, one of docs/data-model.md §3.4's: `source`, `conservation`, `sanity`, `relation`;
- `MESSAGE`, its finding's `MessageCode`, one of the engine's (engine/messages/, and so worded): the
  Library's words for the Check (one with several findings names the first a QS meets);
- `SET`, optionally: its set function, `(reading, *, recognisers) -> list[CheckResult]`, which
  `run_all` runs. A Check without one is a stage of its own (10's `decoders_agree.run(path,
  artefact)`, 11's `bangla_ansi.run(artefact)`, 18's `render_f1.score`), listed and never run here.

A module that declares these wrongly or not at all (a stray file), a code given twice, or a module that
fails to import is refused loudly (`CatalogueError`, or the import's own error), so CI fails and nothing
joins the Library silently.

**`run`** runs every set Check in code order and returns their results in that order. What a Check
returns is checked: a list of `CheckResult`s carrying its own code, each finding one of the engine's
codes with its params; anything else is refused. A Check that raises fails the stage: nothing here
turns an error into a pass.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from types import ModuleType
from typing import Any

from engine import messages
from engine.collect import submodules
from engine.messages import MessageCode
from engine.recognise.conflicts import Recognisers, given, recognisers
from engine.recognise.types import CheckResult, SetReading

PACKAGE = "engine.check"
KINDS = ("source", "conservation", "sanity", "relation")
"""docs/data-model.md §3.4's Check kinds."""
_KEY = re.compile(r"[a-z][a-z0-9_]*")
_MILESTONE = re.compile(r"M[0-9]+")


class CatalogueError(ValueError):
    """A module of engine/check/ that is not a Check the catalogue can list."""


@dataclass(frozen=True)
class Entry:
    """A Check's Library row (docs/data-model.md §3.4, Check): code, version, milestone, kind and the
    code of its words; `set` says whether `run_all` runs it."""

    code: str
    version: int
    milestone: str
    kind: str
    message: str
    set: bool


@dataclass(frozen=True)
class Check:
    entry: Entry
    run: Callable[..., Any] | None
    module: str


def scan(package: str = PACKAGE) -> tuple[Check, ...]:
    """The package's Checks, in code order; `CatalogueError` for a module that is not one."""
    declared = {code.code for code in messages.codes()}
    found: dict[str, Check] = {}
    for module in submodules(package):
        if module.__name__.rsplit(".", 1)[-1] == "catalogue":
            continue
        check = _check(module, declared)
        if check.entry.code in found:
            raise CatalogueError(
                f"{module.__name__} declares the code {check.entry.code!r}, "
                f"which {found[check.entry.code].module} declares"
            )
        found[check.entry.code] = check
    return tuple(found[code] for code in sorted(found))


def _check(module: ModuleType, declared: set[str]) -> Check:
    name = module.__name__
    missing = [n for n in ("CODE", "VERSION", "MILESTONE", "KIND", "MESSAGE") if not hasattr(module, n)]
    if missing:
        raise CatalogueError(f"{name} is in engine/check/ but declares no {', '.join(missing)}")
    code, version, milestone = module.CODE, module.VERSION, module.MILESTONE
    kind, message = module.KIND, module.MESSAGE
    if not isinstance(code, str) or not _KEY.fullmatch(code):
        raise CatalogueError(f"{name}'s CODE {code!r} is not a lower-case key")
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise CatalogueError(f"{name}'s VERSION {version!r} is not an integer from 1")
    if not isinstance(milestone, str) or not _MILESTONE.fullmatch(milestone):
        raise CatalogueError(f"{name}'s MILESTONE {milestone!r} is not a milestone like M0")
    if kind not in KINDS:
        raise CatalogueError(f"{name}'s KIND {kind!r} is not one of {', '.join(KINDS)}")
    if not isinstance(message, MessageCode) or message.code not in declared:
        raise CatalogueError(f"{name}'s MESSAGE {message!r} is not a code of engine/messages/")
    run = getattr(module, "SET", None)
    if run is not None and not callable(run):
        raise CatalogueError(f"{name}'s SET is not a function")
    entry = Entry(code, version, milestone, kind, message.code, run is not None)
    return Check(entry, run, name)


def entries() -> tuple[Entry, ...]:
    """Every Check's Library row, in code order: what 19a's `takeoff/library.py` syncs."""
    return tuple(check.entry for check in scan())


def run_all(reading: SetReading) -> list[CheckResult]:
    """The harness's stage: `run` with 13's readers bound to the conventions the sheets were read
    with (engine.recognise.conflicts.recognisers)."""
    return run(reading, recognisers=recognisers(reading.conventions))


def run(reading: SetReading, *, recognisers: Recognisers, package: str = PACKAGE) -> list[CheckResult]:
    """Every set Check over the reading, in code order, their results checked."""
    if not isinstance(reading, SetReading):
        raise TypeError(f"the Checks read a SetReading, not {type(reading).__name__}")
    given(reading.sheets, reading.views)
    declared = {code.code: code for code in messages.codes()}
    results: list[CheckResult] = []
    for check in scan(package):
        if check.run is None:
            continue
        found = check.run(reading, recognisers=recognisers)
        if not isinstance(found, list):
            raise TypeError(f"{check.module} returned {type(found).__name__}, not a list")
        for result in found:
            _result(check, result, declared)
        results.extend(found)
    return results


def _result(check: Check, result: object, declared: dict[str, MessageCode]) -> None:
    if not isinstance(result, CheckResult):
        raise TypeError(f"{check.module} returned {type(result).__name__}, not a CheckResult")
    if result.code != check.entry.code:
        raise ValueError(f"{check.module} returned a result coded {result.code!r}, not its own")
    if result.finding is not None:
        code = declared.get(result.finding["code"])
        if code is None:
            raise ValueError(f"{check.module}'s finding {result.finding['code']!r} is no engine code")
        if set(result.finding["params"]) != set(code.params):
            raise ValueError(f"{check.module}'s finding {code.code} is not given {sorted(code.params)}")
