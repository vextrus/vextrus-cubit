"""Ticket 17's acceptance on 19b's `engine.recognise.conflicts.find(sheets, views, conventions)` (named
shared edits; the session-06 rulings, "17"):

- #102: a continuation whose view title contradicts its title block is not a continuation (a copied,
  never-edited title block): the pair is raised as `same_title`, never passed over silently;
- #100: a continuation's sheets are in number order past part 9; a revision in the number ("S-01 R1",
  "S-01 R2") is split off, so its digits never make a run.

Hand-made candidates, read with 13's own readers under the default sheet conventions.
"""

import itertools
import json
from collections.abc import Sequence
from pathlib import Path

from engine.recognise import conflicts
from engine.recognise.types import (
    Box,
    Conflict,
    Continuation,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)

CONVENTIONS = SheetConventions.from_json(
    json.loads(
        (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(
            encoding="utf-8"
        )
    )
)
_layouts = itertools.count()


def sheet(number: str, title: str) -> SheetCandidate:
    return SheetCandidate(
        location=SheetLocation(layout=f"Layout{next(_layouts)}"),
        number=Sourced(number, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        title=Sourced(title, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        discipline=Sourced("structural", ValueSource.FILE),
        group="set",
    )


def view(title: str, kind: ViewKind) -> ViewCandidate:
    return ViewCandidate(box=Box(40.0, 60.0, 660.0, 560.0), kind=kind, title=title)


def continuations(found: Sequence[object]) -> list[list[str]]:
    return [
        [s.number.value for s in c.sheets if s.number is not None]
        for c in found
        if isinstance(c, Continuation)
    ]


def same_titles(found: Sequence[object]) -> list[list[str]]:
    return [
        [s.number.value for s in c.candidates if isinstance(s, SheetCandidate) and s.number is not None]
        for c in found
        if isinstance(c, Conflict) and c.kind == conflicts.SAME_TITLE
    ]


def test_a_copied_title_block_whose_view_title_contradicts_it_is_not_a_continuation() -> None:
    """#102: S-06's title block was copied from S-05 ("COLUMN SCHEDULE"); its drawing is pile cap
    details. The pair is no continuation, and is raised as `same_title`."""
    sheets = [sheet("S-05", "COLUMN SCHEDULE"), sheet("S-06", "COLUMN SCHEDULE")]
    views = [
        (view("COLUMN SCHEDULE", ViewKind.SCHEDULE),),
        (view("PILE CAP DETAILS", ViewKind.DETAIL),),
    ]

    found = conflicts.find(sheets, views, CONVENTIONS)

    assert continuations(found) == []
    assert same_titles(found) == [["S-05", "S-06"]]


def test_a_continuation_whose_view_titles_agree_with_its_title_block_stays_one() -> None:
    sheets = [sheet("S-05", "COLUMN SCHEDULE"), sheet("S-06", "COLUMN SCHEDULE")]
    views = [
        (view("COLUMN SCHEDULE", ViewKind.SCHEDULE),),
        (view("COLUMN SCHEDULE", ViewKind.SCHEDULE),),
    ]

    found = conflicts.find(sheets, views, CONVENTIONS)

    assert continuations(found) == [["S-05", "S-06"]]
    assert same_titles(found) == []


def test_a_continuation_with_no_views_read_stays_one() -> None:
    """Nothing contradicts a title block where no view was read."""
    sheets = [sheet("S-05", "COLUMN SCHEDULE"), sheet("S-06", "COLUMN SCHEDULE")]

    found = conflicts.find(sheets, [(), ()], CONVENTIONS)

    assert continuations(found) == [["S-05", "S-06"]]


def test_a_continuations_sheets_are_in_number_order_past_part_nine() -> None:
    """#100: "S-01/9, S-01/10, S-01/11" are in that order, not by the suffix's text."""
    sheets = [sheet(n, "COLUMN SCHEDULE") for n in ("S-01/10", "S-01/11", "S-01/9")]

    found = conflicts.find(sheets, [(), (), ()], CONVENTIONS)

    assert continuations(found) == [["S-01/9", "S-01/10", "S-01/11"]]


def test_a_revision_in_the_number_makes_no_continuation() -> None:
    """#100: "S-01 R1" and "S-01 R2" are one sheet's two revisions, not a run of numbers 1 and 2."""
    sheets = [sheet("S-01 R1", "PILE LAYOUT PLAN"), sheet("S-01 R2", "PILE LAYOUT PLAN")]

    found = conflicts.find(sheets, [(), ()], CONVENTIONS)

    assert continuations(found) == []
