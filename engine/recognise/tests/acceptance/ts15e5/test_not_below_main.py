"""S15-E5 (#549): every View gets a home or is proposed out, and nothing main already gives is lost.
The ticket's check, "scored views not below main", on invented sheets: the new homes (site works,
general notes, structure and presentation plans, `w316`) never take a View from the Step it had on
main, and the words that give them raise no new Question (a Conflict is one: 21c raises each as a
`conflict` Question).

Each case is a class the review of #431 found at its round 1 (ca440e2c; the classes, not the
drawings): a member's own word losing to a site-works word; an architect's floor plan proposed out by
its Sheet's title; a Sheet made a general-notes Sheet by a trailing "notes"; a site-works Sheet title
read as contradicting its later Sheet's member Views, so a continuation broke into a `same_title`
Conflict; and two presentation plans of one floor bucketed into a `same_storey` Conflict. The first
test is red on main (the site-works home beside the member is new); the others are green on main and
pin what main gives, as the guard of "not below main", for the builder.

The seams: `views.find(artefact, sheet, conventions)` on a sheet `sheets.find` reads, each View's
`steps`, `part` and `exclusion`; and `conflicts.find(sheets, views, conventions)`, the harness's
stage, every sheet of one group (`w316/drawing.py`). Every title is invented.
"""

from dataclasses import replace

import pytest

from engine.recognise import conflicts
from engine.recognise.tests.acceptance.w316.drawing import (
    Sheet,
    drawn,
    every,
    model_file,
    model_sheet,
    placed,
    proposed,
)
from engine.recognise.tests.drawing import DEFAULT
from engine.recognise.types import Conflict, Continuation, ViewKind

SITE_WORKS = (("site_mep",), None, None)
"""Step 14, "Site works and MEP": no Part, no exclusion."""

WALLS_AND_ROOMS = (("walls", "rooms"), None, None)
"""Steps 11 and 12, "Walls and openings" and "Rooms and finishes": no Part, no exclusion."""

MEMBER_FIRST = [
    pytest.param("SITE PLAN SHOWING PILE LAYOUT", ViewKind.PLAN, ("foundations",), id="pile-layout"),
    pytest.param("BOUNDARY WALL FOOTING DETAIL", ViewKind.DETAIL, ("foundations",), id="footing"),
    pytest.param("GATE COLUMN DETAIL", ViewKind.DETAIL, ("columns",), id="column"),
    pytest.param("DRIVEWAY SLAB DETAIL", ViewKind.DETAIL, ("slabs",), id="slab"),
    pytest.param("DRAIN AND RETAINING WALL SECTION", ViewKind.SECTION, ("foundations",), id="wall"),
]
"""A title naming site works and a member: the member's Steps, as on main (Foundations keeps its pile
layout, Columns its column)."""


@pytest.mark.parametrize(("title", "kind", "steps"), MEMBER_FIRST)
def test_on_a_site_works_sheet_a_view_naming_a_member_keeps_the_members_steps(
    title: str, kind: ViewKind, steps: tuple[str, ...]
) -> None:
    """The member's word outranks the site-works words of its own title and of its Sheet's; the
    Sheet's untitled View beside it, naming nothing, goes to Site works and MEP."""
    d, sheet = model_sheet(
        [title, None], title="BOUNDARY WALL AND SITE DRAIN DETAILS", discipline="structural"
    )

    named, untitled = drawn(d, sheet)

    assert (named.kind, named.title, proposed(named)) == (kind, title, (steps, None, None))
    assert (untitled.title, proposed(untitled)) == (None, SITE_WORKS)


@pytest.mark.parametrize(("title", "kind", "steps"), MEMBER_FIRST)
def test_a_member_named_in_a_sheets_title_outranks_its_site_works_words(
    title: str, kind: ViewKind, steps: tuple[str, ...]
) -> None:
    """The same words as the Sheet's title, over one untitled View: the member's Steps still."""
    d, sheet = model_sheet([None], title=title, discipline="structural")

    (found,) = drawn(d, sheet)

    assert proposed(found) == (steps, None, None)


@pytest.mark.parametrize(
    ("sheet_title", "titles"),
    [
        pytest.param("GROUND FLOOR PLAN AND COLUMN LAYOUT", ["GROUND FLOOR PLAN"], id="and-column"),
        pytest.param("FIRST FLOOR PLAN WITH COLUMN POSITIONS", ["FIRST FLOOR PLAN"], id="with-column"),
        pytest.param("TYPICAL FLOOR PLAN AND BEAM LAYOUT", ["TYPICAL FLOOR PLAN", None], id="and-beam"),
    ],
)
def test_a_floor_plan_on_a_sheet_that_names_the_plan_before_the_structure_stays_in(
    sheet_title: str, titles: list[str | None]
) -> None:
    """An architect's Sheet whose title is first a floor plan, then a column or beam layout: its plans
    are the architect's own, in Walls and Rooms as on main, not proposed out as the structure's
    duplicate."""
    d, sheet = model_sheet(titles, title=sheet_title, discipline="architectural")

    found = [(v.kind, v.title, proposed(v)) for v in drawn(d, sheet)]

    assert found == [(ViewKind.PLAN, title, WALLS_AND_ROOMS) for title in titles]


@pytest.mark.parametrize(
    ("sheet_title", "titles"),
    [
        pytest.param("STAIR DETAILS AND NOTES", ["RAILING DETAIL", "SECTION A-A"], id="stair"),
        pytest.param("KITCHEN DETAILS WITH NOTES", ["KITCHEN DETAIL", "CABINET DETAIL"], id="kitchen"),
        pytest.param("SCHEDULE OF FINISHES AND SPECIFICATIONS", ["FINISH SCHEDULE"], id="finishes"),
        pytest.param("FACADE DETAILS AND NOTES", ["GRILL DETAIL", "CLADDING DETAIL"], id="facade"),
    ],
)
def test_a_trailing_notes_word_makes_no_general_notes_sheet(
    sheet_title: str, titles: list[str | None]
) -> None:
    """A "notes" or "specifications" after an architect's Sheet's subject qualifies it; the Sheet is no
    general-notes Sheet, so its details and schedules stay in Walls and Rooms, as on main."""
    d, sheet = model_sheet(titles, title=sheet_title, discipline="architectural")

    found = [(v.title, proposed(v)) for v in drawn(d, sheet)]

    assert found == [(title, WALLS_AND_ROOMS) for title in titles]


def read(drawn_sheets: list[Sheet], discipline: str) -> list[Conflict | Continuation]:
    """The run's Conflicts and Continuations, its sheets in one group (one file's)."""
    d, found = model_file(drawn_sheets, discipline=discipline)
    views = [every(d, sheet) for sheet in found]
    return conflicts.find([replace(sheet, group="g") for sheet in found], views, DEFAULT)


def questions(found: list[Conflict | Continuation]) -> list[Conflict]:
    return [c for c in found if isinstance(c, Conflict)]


def test_a_site_works_run_whose_later_sheet_draws_members_raises_no_conflict() -> None:
    run = [
        Sheet("S-31", "COMPOUND WALL DETAILS", placed(["SECTION 1-1", "SECTION 2-2"])),
        Sheet("S-32", "COMPOUND WALL DETAILS", placed(["COLUMN SECTION", "TIE BEAM SECTION"])),
    ]

    assert questions(read(run, "structural")) == []


def test_a_site_plan_run_whose_later_sheet_draws_a_tank_and_a_footing_raises_no_conflict() -> None:
    run = [
        Sheet("S-40", "SITE PLAN", placed(["SITE PLAN"])),
        Sheet("S-41", "SITE PLAN", placed(["SEPTIC TANK DETAIL", "FOOTING DETAIL"])),
    ]

    assert questions(read(run, "structural")) == []


def test_presentation_plans_of_one_floor_on_two_sheets_raise_no_same_storey_conflict() -> None:
    """Two plans of the first floor, one furnished and one coloured, on two sheets: both are for
    information (w316 proposes them out), so no storey is drawn twice for the QS to answer."""
    run = [
        Sheet("A-50", "FURNISHED PLANS", placed(["FURNISHED FIRST FLOOR PLAN"])),
        Sheet("A-51", "FURNISHED PLANS", placed(["FURNISHED SECOND FLOOR PLAN"])),
        Sheet("A-52", "COLOUR SCHEME", placed(["COLOURED FIRST FLOOR PLAN"])),
    ]

    assert questions(read(run, "architectural")) == []
