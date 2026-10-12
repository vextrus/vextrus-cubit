"""Site works never become a view's subject (S22-FL7, review 2 of #684): `ViewCandidate.subject` is
what it was before the site-works words existed, so storeys, the conflicts and the duplicate rule read
what they always read; site works are carried by the view's Steps alone. Synthetic Structural sheets
read through `views.find`, their views handed to `conflicts.find` as the reader gives them."""

import itertools
import json
from dataclasses import replace
from pathlib import Path

import pytest

from engine.recognise import conflicts, views
from engine.recognise.tests.acceptance.ts22fl7.sheet import LEFT, LOWER, MIDDLE, RIGHT, structural_views
from engine.recognise.types import (
    Conflict,
    Continuation,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
)
from engine.recognise.views import titles as titles_part

CONVENTIONS = SheetConventions.from_json(
    json.loads(
        (Path(conflicts.__file__).parent / "conventions" / "sheet-default.json").read_text(
            encoding="utf-8"
        )
    )
)
_layouts = itertools.count()
BOXES = [LEFT, MIDDLE, RIGHT, LOWER]


def sheet(number: str, title: str) -> SheetCandidate:
    return SheetCandidate(
        location=SheetLocation(layout=f"L{next(_layouts)}"),
        number=Sourced(number, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        title=Sourced(title, ValueSource.TITLE_BLOCK_ATTRIBUTE),
        discipline=Sourced("structural", ValueSource.FILE),
        group="set",
    )


def read(title: str, drawn: list[str], number: str) -> tuple[ViewCandidate, ...]:
    return tuple(structural_views(title, list(zip(drawn, BOXES, strict=False)), number=number))


def find(first: tuple[str, list[str]], second: tuple[str, list[str]]) -> list[object]:
    (t1, d1), (t2, d2) = first, second
    sheets = [sheet("S-23", t1), sheet("S-24", t2)]
    return list(conflicts.find(sheets, [read(t1, d1, "S-23"), read(t2, d2, "S-24")], CONVENTIONS))


def runs(found: list[object]) -> list[list[str]]:
    return [
        [s.number.value for s in c.sheets if s.number is not None]
        for c in found
        if isinstance(c, Continuation)
    ]


@pytest.mark.parametrize(
    ("title", "one", "two"),
    [
        (
            "SITE ARRANGEMENT ZQ",
            ["SITE PLAN ZQ", "BOUNDARY WALL SECTION ZQ", "COMPOUND WALL DETAIL ZQ"],
            ["COLUMN LAYOUT PLAN ZQ", "RETAINING WALL SECTION ZQ", "SEPTIC TANK DETAIL ZQ"],
        ),
        (
            "TYPICAL DETAILS ZQ",
            ["COMPOUND WALL SECTION ZQ"],
            ["SOAK PIT SECTION ZQ-9"],
        ),
    ],
)
def test_a_site_works_view_does_not_part_a_continuation(
    title: str, one: list[str], two: list[str]
) -> None:
    found = find((title, one), (title, two))
    assert runs(found) == [["S-23", "S-24"]]
    assert not [c for c in found if isinstance(c, Conflict)]


def test_a_ground_floor_site_plan_and_boundary_wall_plan_raise_no_same_storey() -> None:
    found = find(
        ("SITE PLAN ZQ", ["GROUND FLOOR SITE PLAN ZQ"]),
        ("BOUNDARY WALL PLAN ZQ", ["GROUND FLOOR BOUNDARY WALL PLAN ZQ"]),
    )
    assert not [c for c in found if isinstance(c, Conflict) and c.kind == conflicts.SAME_STOREY]


TITLES = [
    "SITE PLAN AND COLUMN LAYOUT",
    "COLUMN LAYOUT AND SITE PLAN",
    "SITE PLAN",
    "SITE FOUNDATION PLAN",
    "BOUNDARY WALL FOOTING DETAIL",
    "FOOTING DETAIL OF COMPOUND WALL",
    "SETBACK PLAN",
    "7TH FLOOR SETBACK COLUMN LAYOUT PLAN",
    "SETBACK AND BEAM LAYOUT",
    "BOUNDARY WALL DOOR DETAIL",
    "BOUNDARY WALL AND COLUMN LAYOUT",
    "LINTEL LAYOUT PLAN",
    "COMPOUND WALL",
]


@pytest.mark.parametrize("title", TITLES)
def test_a_views_subject_is_what_it_was_before_site_works_were_words(title: str) -> None:
    default = views.default_conventions()
    without = replace(
        default,
        subject_words={k: v for k, v in default.subject_words.items() if k != "site_works"},
    )
    now = titles_part._subject(title, titles_part._reading(default))
    before = titles_part._subject(title, titles_part._reading(without))
    assert now == before
    assert now != "site_works"
    assert titles_part.subjects(title, default) == titles_part.subjects(title, without)


@pytest.mark.parametrize(
    ("sheet_title", "view_title", "steps"),
    [
        ("7TH FLOOR SETBACK BEAM DETAILS ZQ", "SECTION AT SETBACK ZQ-1", ("beams",)),
        ("8TH FLOOR SETBACK SLAB LAYOUT ZQ", "SETBACK EDGE DETAIL ZQ", ("slabs",)),
        ("SETBACK ARRANGEMENT ZQ", "SETBACK EDGE DETAIL ZQ", ("site_mep",)),
        ("SETBACK ARRANGEMENT ZQ", "SECTION AT SETBACK ZQ-1", ("site_mep",)),
    ],
)
def test_a_setback_is_judged_by_the_views_sheet_too(
    sheet_title: str, view_title: str, steps: tuple[str, ...]
) -> None:
    """A setback word is site works only when neither the view's title nor its sheet's names a storey
    or a building element; else the view takes its sheet's building Step."""
    [view] = structural_views(sheet_title, [(view_title, LEFT)], number="S-41")
    assert view.steps == steps
    assert view.subject != "site_works"
