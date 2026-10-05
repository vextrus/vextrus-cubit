"""Ticket W316 (#316, #335): a site-works View has a home. The owner's ruling of 5 Oct 2026: "#316:
Site works to Site & MEP" (a site-works subject maps to the existing `site_mep` Step, Step 14 "Site
works and MEP", `vextrus/takeoff/library.py`). A Structural view whose own title or whose Sheet's title
names site works goes there; a view's own subject still comes first; an Architectural view stays in
Walls and Rooms; and a Structural Sheet confirmed as a site plan names that Step (`kind_steps`, what
Step 1 gives a view the read left unaccounted, #158).

The seam: `views.find(artefact, sheet, conventions)` on a sheet `sheets.find` reads, each View's
`steps`, `part` and `exclusion`; and `views.kind_steps(kind, discipline)`. Every title is invented.
"""

from engine.recognise import sheets, views
from engine.recognise.types import ViewKind

from .drawing import drawn, model_sheet, proposed

SITE_WORKS = (("site_mep",), None, None)
"""Proposed for Step 14, "Site works and MEP": no Part, no exclusion."""
SITE_SHEET = "BOUNDARY WALL AND SITE DRAIN DETAILS"


def test_every_view_on_a_structural_site_works_sheet_goes_to_site_works_and_mep() -> None:
    d, sheet = model_sheet(
        ["SECTION 3-3", "SECTION 7-7", None, "TYPICAL COPING DETAIL"],
        title=SITE_SHEET,
        discipline="structural",
    )

    found = drawn(d, sheet)

    assert [(v.kind, v.title) for v in found] == [
        (ViewKind.SECTION, "SECTION 3-3"),
        (ViewKind.SECTION, "SECTION 7-7"),
        (ViewKind.DETAIL, None),
        (ViewKind.DETAIL, "TYPICAL COPING DETAIL"),
    ]
    assert [proposed(v) for v in found] == [SITE_WORKS] * 4


def test_a_view_naming_site_works_goes_there_on_a_structural_sheet_that_names_none() -> None:
    d, sheet = model_sheet(["ENTRY PAVING DETAIL"], title="TYPICAL DETAILS", discipline="structural")

    (found,) = drawn(d, sheet)

    assert found.kind is ViewKind.DETAIL
    assert proposed(found) == SITE_WORKS


def test_a_views_own_subject_comes_before_its_site_works_sheets() -> None:
    d, sheet = model_sheet(
        ["COLUMN DETAIL AT GATE", "SECTION 6-6"], title=SITE_SHEET, discipline="structural"
    )
    beams, beam_sheet = model_sheet(["SECTION 5-5"], title="GRADE BEAM DETAILS", discipline="structural")

    found = {v.title: proposed(v) for v in drawn(d, sheet)}
    (on_beams,) = drawn(beams, beam_sheet)

    assert found == {"COLUMN DETAIL AT GATE": (("columns",), None, None), "SECTION 6-6": SITE_WORKS}
    assert proposed(on_beams) == (("beams",), None, None)


def test_site_works_on_an_architectural_sheet_stay_in_walls_and_rooms() -> None:
    """Architectural stays Walls and Rooms (the ticket's "Not in this ticket"); the same views on a
    Structural sheet go to Site works and MEP."""
    shown = {}
    for discipline in ("structural", "architectural"):
        d, sheet = model_sheet(
            ["SECTION 3-3", "ENTRY PAVING DETAIL"], title=SITE_SHEET, discipline=discipline
        )
        shown[discipline] = [proposed(v) for v in drawn(d, sheet)]

    assert shown == {
        "structural": [SITE_WORKS, SITE_WORKS],
        "architectural": [(("walls", "rooms"), None, None)] * 2,
    }


def test_a_structural_site_plan_names_site_works_and_mep() -> None:
    assert views.kind_steps("site_plan", "structural") == ("site_mep",)
    assert views.kind_steps("site_plan", "architectural") == ()
    assert views.kind_steps("site_plan", None) == ()


def test_only_the_general_structural_kinds_name_no_step_and_the_others_are_unchanged() -> None:
    """Every Structural kind of the conventions names a Step now but `details` and
    `roof_structure_details`; the Steps the others named before are kept."""
    kinds = sheets.default_conventions().sheet_kinds["structural"]
    unchanged = {
        "beam_details": ("beams",),
        "beam_layout": ("beams",),
        "column_schedule": ("columns",),
        "shear_wall_details": ("columns",),
        "pile_details": ("foundations",),
        "pile_cap_details": ("foundations",),
        "foundation_details": ("foundations",),
        "retaining_wall_details": ("foundations",),
        "slab_layout": ("slabs",),
        "stair_details": ("stairs",),
        "tank_details": ("tanks",),
        "grid_layout": ("grid",),
        "general_notes": ("general_notes",),
    }

    told = {kind for kind in kinds if views.kind_steps(kind, "structural")}

    assert set(kinds) - told == {"details", "roof_structure_details"}
    assert {kind: views.kind_steps(kind, "structural") for kind in unchanged} == unchanged
