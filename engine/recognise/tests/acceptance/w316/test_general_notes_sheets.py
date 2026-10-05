"""Ticket W316 (#316, #335): a schedule or detail on a general-notes Sheet has a home. The owner's
ruling of 5 Oct 2026: "#316: ... notes to General notes": an untitled schedule or detail on a
general-notes Sheet goes to General notes (Step 2, `general_notes`), after the View's own subject and
the Sheet title's member subjects; "a Structural section or detail with no subject takes its Sheet's
kind, else a Question" (a kind that names no Step leaves it unaccounted: the Sheet's `which_kind`
Question asks).

The seam: `views.find(artefact, sheet, conventions)` on a sheet `sheets.find` reads, each View's
`steps`, `part` and `exclusion`; and `views.kind_steps(kind, discipline)`. Every title is invented.
"""

from engine.recognise import views
from engine.recognise.types import ViewKind

from .drawing import drawn, model_sheet, proposed

GENERAL_NOTES = (("general_notes",), None, None)
"""Proposed for Step 2, "General Notes and Specification": no Part, no exclusion."""
NOTES_SHEET = "GENERAL NOTES AND SCHEDULE OF CONCRETE MIXES"
NOTES = (
    ("NOTES:", (450.0, 270.0), 6.0),
    ("1. ALL LEVELS IN METRES.", (450.0, 258.0), 4.0),
    ("2. LAPS TO BE STAGGERED.", (450.0, 250.0), 4.0),
    ("3. COVER AS SCHEDULED.", (450.0, 242.0), 4.0),
)
"""A block of notes under its heading, at the sixth place (`drawing.PLACES`), drawn with no grid."""


def test_schedules_and_details_on_a_structural_general_notes_sheet_go_to_general_notes() -> None:
    d, sheet = model_sheet(
        ["SCHEDULE OF CLEAR COVER", None, "TYPICAL BAR SPLICE DETAIL", "LEGEND",
         "COLUMN REINFORCEMENT SCHEDULE"],
        title=NOTES_SHEET,
        discipline="structural",
        texts=NOTES,
    )  # fmt: skip

    found = {(v.kind, v.title): proposed(v) for v in drawn(d, sheet)}

    assert found == {
        (ViewKind.SCHEDULE, "SCHEDULE OF CLEAR COVER"): GENERAL_NOTES,
        (ViewKind.SCHEDULE, None): GENERAL_NOTES,  # untitled: the kind the Sheet's title names first
        (ViewKind.DETAIL, "TYPICAL BAR SPLICE DETAIL"): GENERAL_NOTES,
        (ViewKind.LEGEND, "LEGEND"): GENERAL_NOTES,
        (ViewKind.SCHEDULE, "COLUMN REINFORCEMENT SCHEDULE"): (("columns",), None, None),
        (ViewKind.NOTES, "NOTES:"): GENERAL_NOTES,
    }


def test_a_member_subject_on_a_general_notes_sheet_still_comes_first() -> None:
    """A View naming its own subject keeps it, and a Sheet title's member subject beats its notes
    word; the Sheet's schedules and details naming none go to General notes."""
    d, sheet = model_sheet(
        ["PILE LAYOUT PLAN", "TYPICAL CRANKED BAR DETAIL"], title=NOTES_SHEET, discipline="structural"
    )
    beams, beam_sheet = model_sheet(
        [None], title="GENERAL NOTES AND BEAM SCHEDULE", discipline="structural"
    )

    found = {v.title: proposed(v) for v in drawn(d, sheet)}
    (untitled,) = drawn(beams, beam_sheet)

    assert found == {
        "PILE LAYOUT PLAN": (("foundations",), None, None),
        "TYPICAL CRANKED BAR DETAIL": GENERAL_NOTES,
    }
    assert (untitled.kind, proposed(untitled)) == (ViewKind.SCHEDULE, (("beams",), None, None))


def test_a_schedule_on_an_architectural_general_notes_sheet_goes_to_general_notes() -> None:
    notes, notes_sheet = model_sheet(
        ["SCHEDULE OF FINISHES", "TYPICAL SILL DETAIL"],
        title="GENERAL NOTES AND SCHEDULE OF FINISHES",
        discipline="architectural",
    )
    plan, plan_sheet = model_sheet(
        ["SCHEDULE OF FINISHES"], title="TYPICAL FLOOR PLAN", discipline="architectural"
    )

    on_notes = [(v.kind, proposed(v)) for v in drawn(notes, notes_sheet)]
    (on_plan,) = drawn(plan, plan_sheet)

    assert on_notes == [(ViewKind.SCHEDULE, GENERAL_NOTES), (ViewKind.DETAIL, GENERAL_NOTES)]
    assert (on_plan.kind, proposed(on_plan)) == (ViewKind.SCHEDULE, (("walls", "rooms"), None, None))


def test_a_section_or_detail_naming_no_subject_takes_its_sheets_kind_else_none() -> None:
    """The ruling's "a Structural section or detail with no subject takes its Sheet's kind, else a
    Question": on a Sheet whose title names the retaining-wall kind, Foundations
    (`kind_steps("retaining_wall_details", "structural")`); a View with its own subject keeps it; on a
    Sheet whose kind names no Step (`details`) it stays unaccounted, for the Sheet's Question.

    Green on main as well: a Sheet's kind told by its title's words names the subjects the Sheet
    title's subjects already give (`views.find` reads no Jev). It pins the ruling for the builder."""
    walls, walls_sheet = model_sheet(
        ["SECTION 2-2", None, "STAIR SECTION"], title="RETAINING WALL DETAILS", discipline="structural"
    )
    typical, typical_sheet = model_sheet(
        ["SECTION 2-2", None, "SECTION 9-9"], title="TYPICAL DETAILS", discipline="structural"
    )
    foundations = views.kind_steps("retaining_wall_details", "structural")

    on_walls = [(v.kind, v.title, v.steps) for v in drawn(walls, walls_sheet)]
    on_typical = [(v.kind, v.title, proposed(v)) for v in drawn(typical, typical_sheet)]

    assert foundations == ("foundations",)
    assert on_walls == [
        (ViewKind.SECTION, "SECTION 2-2", foundations),
        (ViewKind.DETAIL, None, foundations),
        (ViewKind.SECTION, "STAIR SECTION", ("stairs",)),
    ]
    assert views.kind_steps("details", "structural") == ()
    assert on_typical == [
        (ViewKind.SECTION, "SECTION 2-2", ((), None, None)),
        (ViewKind.DETAIL, None, ((), None, None)),
        (ViewKind.SECTION, "SECTION 9-9", ((), None, None)),
    ]
