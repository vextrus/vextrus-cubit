"""Ticket W316 (#336): an architect's plan that draws the structure is proposed out by its Sheet's
title. "The structural set governs" (M0 review Q2): an Architectural plan whose own title names no
subject (untitled, or titled by its floor alone) on a Sheet whose title draws the structure (its
subjects, in order, start with a structure subject, or with a slab and name a structure subject after
it, by a word not a lintel's) is proposed out as a duplicate. A View whose own title names a subject
keeps its own answer; a lintel layout, a slab outline alone and a stair plan stay in Walls and Rooms;
a Structural Sheet of the same title is not excluded. The Sheet-title path is exempt from D9's "a
Sheet's only plan is never a duplicate" (the Sheet's own title is the evidence).

The seam: `views.find(artefact, sheet, conventions)` on a sheet `sheets.find` reads, each View's
`steps`, `part` and `exclusion`. Every title is invented.
"""

import pytest

from engine.recognise.types import ExclusionReason, ViewKind

from .drawing import drawn, every, model_sheet, proposed

DUPLICATE = ((), None, str(ExclusionReason.DUPLICATE))
"""Proposed to leave out: a duplicate ("the structural set governs")."""
WALLS_AND_ROOMS = (("walls", "rooms"), None, None)
FOR_INFORMATION = ((), None, str(ExclusionReason.FOR_INFORMATION))


@pytest.mark.parametrize(
    ("sheet_title", "titles"),
    [
        pytest.param("SLAB OUTLINE SHOWING BEAMS", [None], id="untitled-slab-then-beam"),
        pytest.param("DROPPED BEAM AND SLAB OUTLINE", ["SECOND FLOOR PLAN"], id="floor-titled"),
        pytest.param("DROPPED BEAM AND SLAB OUTLINE", [None, None], id="two-plans"),
        pytest.param("COLUMN AND SLAB OUTLINE PLAN", ["TYPICAL FLOOR PLAN"], id="column-first"),
    ],
)
def test_an_architects_plans_on_a_sheet_titled_for_the_structure_are_proposed_out(
    sheet_title: str, titles: list[str | None]
) -> None:
    d, sheet = model_sheet(titles, title=sheet_title, discipline="architectural")

    found = every(d, sheet)

    assert [(v.kind, v.title) for v in found] == [
        *((ViewKind.PLAN, title) for title in titles),
        (ViewKind.TITLE_BLOCK, None),
    ]
    assert [proposed(v) for v in found] == [DUPLICATE] * len(titles) + [FOR_INFORMATION]


def test_only_a_sheet_title_that_draws_the_structure_proposes_its_plans_out() -> None:
    """Each Sheet holds one untitled plan; only the first two titles draw the structure."""
    rows = {
        ("architectural", "SLAB OUTLINE SHOWING BEAMS"): DUPLICATE,
        ("architectural", "DROPPED BEAM AND SLAB OUTLINE"): DUPLICATE,
        ("architectural", "THIRD FLOOR LINTEL LAYOUT PLAN"): WALLS_AND_ROOMS,
        ("architectural", "SLAB OUTLINE SHOWING LINTELS"): WALLS_AND_ROOMS,
        ("architectural", "ROOF SLAB OUTLINE"): WALLS_AND_ROOMS,
        ("architectural", "STAIRCASE AND BEAM PLAN"): WALLS_AND_ROOMS,
        ("architectural", "TYPICAL FLOOR PLAN"): WALLS_AND_ROOMS,
        ("structural", "SLAB OUTLINE SHOWING BEAMS"): (("slabs", "beams"), None, None),
    }
    found = {}
    for discipline, title in rows:
        d, sheet = model_sheet([None], title=title, discipline=discipline)
        (view,) = drawn(d, sheet)
        assert view.kind is ViewKind.PLAN, title
        found[discipline, title] = proposed(view)

    assert found == rows


def test_a_plan_whose_own_title_names_a_subject_keeps_its_own_answer() -> None:
    """On a Sheet titled for the structure, a bathroom layout keeps Walls and Rooms and the Plumbing
    Part (its own subject governs), while the Sheet's untitled plan is proposed out."""
    d, sheet = model_sheet(
        ["BATHROOM LAYOUT PLAN", None], title="SLAB OUTLINE SHOWING BEAMS", discipline="architectural"
    )

    found = {v.title: proposed(v) for v in drawn(d, sheet)}

    assert found == {
        "BATHROOM LAYOUT PLAN": (("walls", "rooms"), "plumbing", None),
        None: DUPLICATE,
    }


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("SECOND FLOOR BEAM LAYOUT PLAN", DUPLICATE),
        ("SECOND FLOOR LINTEL LAYOUT PLAN", WALLS_AND_ROOMS),
        ("STAIR AND COLUMN PLAN", WALLS_AND_ROOMS),
    ],
)
def test_a_views_own_title_still_decides_on_a_sheet_titled_for_the_structure(
    title: str, expected: tuple[tuple[str, ...], str | None, str | None]
) -> None:
    """The View-title rule is unchanged (`test_an_architectural_lintel_plan_stays_in_walls_and_rooms`):
    a View whose own title names a subject keeps that answer, whatever its Sheet's title says; the
    Sheet's untitled plan beside it is proposed out."""
    d, sheet = model_sheet(
        [title, None], title="DROPPED BEAM AND SLAB OUTLINE", discipline="architectural"
    )

    found = [(v.title, proposed(v)) for v in drawn(d, sheet)]

    assert found == [(title, expected), (None, DUPLICATE)]
