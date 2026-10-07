"""A view's storeys (17; S15-E3's part): what its title states, by 13's storey words. Reads words only:
never paper nor a drawing.

Its storeys are a plan's only: 13's `storeys.read(title, plan_title=True)`, an explicit list (and the
symbolic end a range runs to), so "typical" is a storey only beside a floor or plan word; they mean the
floors' levels (`at_floor_level`) unless its subject is one drawn floor to floor (`FLOOR_TO_FLOOR`). The
storey words are the default sheet conventions' (21b passes the Market's later).

**A sheet's only plan whose own title states no storey** (none, or no title) takes the storeys its
sheet's title states (13's `storeys_as_stated`, read the same way), recorded as read from the sheet's
title (`StoreysSource.SHEET_TITLE`; the owner's ruling of 5 Oct 2026 on #318); their meaning is decided
by its own subject, else by the sheet title's when it names exactly one, and its own subject is left as
read. A sheet of two or more plans gives none of them its title's storeys (a plan that states none
stays `not_stated`), and no view of another kind takes any.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace

from engine.recognise import sheets as sheet_finder
from engine.recognise import storeys as storey_reader  # 13's; this part has its name
from engine.recognise.types import (
    SheetCandidate,
    StoreysMeaning,
    StoreysSource,
    ViewCandidate,
    ViewKind,
)

FLOOR_TO_FLOOR = frozenset({"column", "shear_wall"})
"""Subjects whose storeys run floor to floor (a column from the 1st to the 10th floor)."""

STATES_NONE = ((), ("not_stated",))
"""A plan's storeys when its own title states none: no title, or one naming no storey."""


@dataclass(frozen=True)
class ViewStoreys:
    """A view's storeys: their keys in order, as its title states them, and what they mean."""

    keys: tuple[str, ...] = ()
    as_stated: str | None = None
    meaning: StoreysMeaning | None = None


def _meaning(subject: str | None) -> StoreysMeaning:
    return StoreysMeaning.FLOOR_TO_FLOOR if subject in FLOOR_TO_FLOOR else StoreysMeaning.AT_FLOOR_LEVEL


def _keys(found: storey_reader.Storeys) -> tuple[str, ...]:
    return tuple(dict.fromkeys((*found.keys, *([found.runs_to] if found.runs_to else []))))


def read(title: str | None, kind: ViewKind, subject: str | None) -> ViewStoreys:
    """The storeys a view's title states (the module's docstring); none for a view with no title or
    another kind than a plan."""
    if title is None or kind is not ViewKind.PLAN:
        return ViewStoreys()
    found = storey_reader.read(title, sheet_finder.default_conventions(), plan_title=True)
    keys = _keys(found)
    return ViewStoreys(keys, found.as_stated, _meaning(subject) if keys else None)


def inherit(
    made: Sequence[ViewCandidate], sheet: SheetCandidate, on_sheet: Sequence[str]
) -> list[ViewCandidate]:
    """The sheet's only plan, when its own title states no storey, given the storeys its sheet's
    title states (the module's docstring); every other view as made."""
    plans = [i for i, v in enumerate(made) if v.kind is ViewKind.PLAN]
    stated = sheet.storeys_as_stated.value if sheet.storeys_as_stated is not None else ""
    if len(plans) != 1 or not stated or made[plans[0]].storeys not in STATES_NONE:
        return list(made)
    keys = _keys(storey_reader.read(stated, sheet_finder.default_conventions(), plan_title=True))
    if not keys or keys == STATES_NONE[1]:
        return list(made)
    plan = made[plans[0]]
    subject = plan.subject or (on_sheet[0] if len(on_sheet) == 1 else None)
    given = replace(
        plan,
        storeys=keys,
        storeys_as_stated=" ".join(stated.split()),
        storeys_meaning=_meaning(subject),
        storeys_source=StoreysSource.SHEET_TITLE,
    )
    return [given if i == plans[0] else v for i, v in enumerate(made)]
