"""Ticket W316 (D10, #234): a presentation plan is proposed out "for information". `docs/specs/M0.md`
"Step proposals by Discipline" asks for "Proposed to leave out: for information"; m0-screens' exclusion
reason 4 is "Presentation, 3D or for information". An Architectural plan whose own title, or its
second line, is first a presentation word (presentation, rendered, furnished, coloured, colored), or
whose title names no subject on a Sheet whose title is, is proposed out `for_information`. Plans only,
and Architectural only: a working plan, an elevation, a schedule and a Structural view are unchanged.

The seam: `views.find(artefact, sheet, conventions)` on a sheet `sheets.find` reads, each View's
`steps`, `part` and `exclusion`. Every title is invented.
"""

import pytest

from engine.recognise.types import ExclusionReason, ViewKind

from .drawing import drawn, model_sheet, proposed

FOR_INFORMATION = ((), None, str(ExclusionReason.FOR_INFORMATION))
"""Proposed to leave out: presentation, 3D or for information."""
WALLS_AND_ROOMS = (("walls", "rooms"), None, None)


@pytest.mark.parametrize(
    "title",
    [
        "FURNISHED THIRD FLOOR PLAN",
        "RENDERED TYPICAL FLOOR PLAN",
        "COLORED ROOF PLAN",
        "COLOURED FOURTH FLOOR PLAN",
        "PRESENTATION PLAN",
    ],
)
def test_an_architectural_plan_titled_for_presentation_is_proposed_out_for_information(
    title: str,
) -> None:
    d, sheet = model_sheet([title], title="GENERAL ARRANGEMENT", discipline="architectural")

    (found,) = drawn(d, sheet)

    assert (found.kind, found.title) == (ViewKind.PLAN, title)
    assert proposed(found) == FOR_INFORMATION


def test_a_plan_whose_second_title_line_is_a_presentation_plan_is_proposed_out() -> None:
    """ "PRESENTATION PLAN" under "GROUND FLOOR PLAN" is its second line (17's docstring), no title of
    its own: the plan's title is the first line, and the second says it is for presentation."""
    d, sheet = model_sheet(
        ["SIXTH FLOOR PLAN"],
        title="GENERAL ARRANGEMENT",
        discipline="architectural",
        texts=(("PRESENTATION PLAN", (30.0, 308.0), 6.0),),
    )

    (found,) = drawn(d, sheet)

    assert (found.kind, found.title) == (ViewKind.PLAN, "SIXTH FLOOR PLAN")
    assert proposed(found) == FOR_INFORMATION


def test_an_untitled_plan_on_a_sheet_titled_for_presentation_is_proposed_out() -> None:
    d, sheet = model_sheet([None, None], title="RENDERED FLOOR PLANS", discipline="architectural")

    found = drawn(d, sheet)

    assert [v.kind for v in found] == [ViewKind.PLAN, ViewKind.PLAN]
    assert [proposed(v) for v in found] == [FOR_INFORMATION, FOR_INFORMATION]


def test_only_an_architectural_presentation_plan_is_proposed_out() -> None:
    """Beside a presentation plan, a working plan, a coloured elevation and a schedule naming a
    presentation word stay in Walls and Rooms; a presentation-worded plan on a Structural Sheet is not
    excluded (its Steps are as before: none here)."""
    arch, arch_sheet = model_sheet(
        ["FURNISHED THIRD FLOOR PLAN", "SECOND FLOOR PLAN", "COLOURED SOUTH ELEVATION"],
        title="GENERAL ARRANGEMENT",
        discipline="architectural",
    )
    schedule, schedule_sheet = model_sheet(
        ["SCHEDULE OF FURNISHED ITEMS"], title="GENERAL ARRANGEMENT", discipline="architectural"
    )
    struct, struct_sheet = model_sheet(
        ["FURNISHED THIRD FLOOR PLAN"], title="GENERAL ARRANGEMENT", discipline="structural"
    )

    found = [(v.kind, v.title, proposed(v)) for v in drawn(arch, arch_sheet)]
    (listed,) = drawn(schedule, schedule_sheet)
    (on_structural,) = drawn(struct, struct_sheet)

    assert found == [
        (ViewKind.PLAN, "FURNISHED THIRD FLOOR PLAN", FOR_INFORMATION),
        (ViewKind.PLAN, "SECOND FLOOR PLAN", WALLS_AND_ROOMS),
        (ViewKind.ELEVATION, "COLOURED SOUTH ELEVATION", WALLS_AND_ROOMS),
    ]
    assert (listed.kind, proposed(listed)) == (ViewKind.SCHEDULE, WALLS_AND_ROOMS)
    assert (on_structural.kind, proposed(on_structural)) == (ViewKind.PLAN, ((), None, None))
