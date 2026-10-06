"""A view's storeys (17; S15-E3's part): what its title states, by 13's storey words. Reads words only:
never paper nor a drawing.

Its storeys are a plan's only: 13's `storeys.read(title, plan_title=True)`, an explicit list (and the
symbolic end a range runs to), so "typical" is a storey only beside a floor or plan word; they mean the
floors' levels (`at_floor_level`) unless its subject is one drawn floor to floor (`FLOOR_TO_FLOOR`). The
storey words are the default sheet conventions' (21b passes the Market's later).
"""

from dataclasses import dataclass

from engine.recognise import sheets as sheet_finder
from engine.recognise import storeys as storey_reader  # 13's; this part has its name
from engine.recognise.types import StoreysMeaning, ViewKind

FLOOR_TO_FLOOR = frozenset({"column", "shear_wall"})
"""Subjects whose storeys run floor to floor (a column from the 1st to the 10th floor)."""


@dataclass(frozen=True)
class ViewStoreys:
    """A view's storeys: their keys in order, as its title states them, and what they mean."""

    keys: tuple[str, ...] = ()
    as_stated: str | None = None
    meaning: StoreysMeaning | None = None


def read(title: str | None, kind: ViewKind, subject: str | None) -> ViewStoreys:
    """The storeys a view's title states (the module's docstring); none for a view with no title or
    another kind than a plan."""
    if title is None or kind is not ViewKind.PLAN:
        return ViewStoreys()
    found = storey_reader.read(title, sheet_finder.default_conventions(), plan_title=True)
    keys = tuple(dict.fromkeys((*found.keys, *([found.runs_to] if found.runs_to else []))))
    meaning = None
    if keys:
        meaning = (
            StoreysMeaning.FLOOR_TO_FLOOR if subject in FLOOR_TO_FLOOR else StoreysMeaning.AT_FLOOR_LEVEL
        )
    return ViewStoreys(keys, found.as_stated, meaning)
