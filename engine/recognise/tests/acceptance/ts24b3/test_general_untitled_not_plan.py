"""Ticket S24-B3 (#665, G1 M0-FL6): an untitled drawn piece on a General sheet is never a Plan view.

The rule (R1, the orchestrator's choice from the real-set cases, session 24): on a sheet whose
Discipline is General (a notes Discipline, `ViewConventions.notes_disciplines`), an untitled drawn
piece is never a Plan view: it is a Detail view, or a Notes view when it has more words than lines, as
now. Titled views are unchanged everywhere, and untitled pieces on other Disciplines' sheets are
unchanged. The consequence on screen (m0-screens 6.8; web/src/takeoff/storeys.tsx): a sheet with no
Plan view shows "—" for its Storeys, not amber "not stated" (the web part:
web/src/acceptance/ts24b3/). Read through 17's public reader (`views.find`) on invented sheets
(sheet.py).
"""

from engine.recognise.types import ViewKind

from .sheet import GENERAL, LEFT, LOWER, MIDDLE, RIGHT, WHOLE, read

NO_KIND = "TYPICAL ARRANGEMENTS ZQ"
"""A sheet title naming no view kind (as the real General sheets' titles: the fallback is a plan's)."""
THREE = [(None, LEFT), (None, MIDDLE), (None, RIGHT)]


def test_three_untitled_drawn_pieces_on_a_general_sheet_are_details_not_plans() -> None:
    kinds = [v.kind for v in read(GENERAL, NO_KIND, THREE)]

    assert kinds == [ViewKind.DETAIL] * 3, f"untitled pieces on a General sheet read as {kinds}"


def test_a_general_sheet_of_untitled_pieces_has_no_plan_view() -> None:
    kinds = [v.kind for v in read(GENERAL, NO_KIND, [(None, LEFT), (None, MIDDLE), (None, LOWER)])]

    assert len(kinds) == 3
    assert ViewKind.PLAN not in kinds, f"untitled pieces on a General sheet read as {kinds}"


def test_a_wordy_untitled_piece_on_a_general_sheet_stays_notes_beside_details() -> None:
    kinds = [v.kind for v in read(GENERAL, NO_KIND, [(None, LEFT), (None, MIDDLE)], wordy=(RIGHT,))]

    assert kinds == [ViewKind.DETAIL, ViewKind.DETAIL, ViewKind.NOTES], (
        f"untitled pieces on a General sheet read as {kinds}"
    )


def test_untitled_pieces_on_a_general_sheet_whose_title_names_a_plan_are_not_plans() -> None:
    kinds = [v.kind for v in read(GENERAL, "PLAN ARRANGEMENTS ZQ", THREE)]

    assert kinds == [ViewKind.DETAIL] * 3, f"untitled pieces on a General sheet read as {kinds}"


def test_the_same_pieces_on_an_architectural_sheet_titled_a_plan_stay_plans() -> None:
    """Green on the base (the guard): other Disciplines' untitled pieces are unchanged."""
    kinds = [v.kind for v in read("architectural", "GROUND FLOOR PLAN ZQ", THREE, number="A-41")]

    assert kinds == [ViewKind.PLAN] * 3


def test_the_same_pieces_on_an_architectural_sheet_titled_no_kind_stay_plans() -> None:
    """Green on the base (the guard): R1 is the General sheet's rule, not a rule for every sheet."""
    kinds = [v.kind for v in read("architectural", NO_KIND, THREE, number="A-42")]

    assert kinds == [ViewKind.PLAN] * 3


def test_a_titled_plan_on_a_general_sheet_stays_a_plan() -> None:
    """Green on the base (the guard): titled views are unchanged everywhere."""
    found = read(GENERAL, NO_KIND, [("GROUND FLOOR PLAN ZQ", WHOLE)])

    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, "GROUND FLOOR PLAN ZQ")]
