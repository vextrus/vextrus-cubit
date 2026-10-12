"""An untitled piece on a notes Discipline's sheet is never a Plan view (S24-B3, R1), and the rule
reaches no further: a sheet title's own non-plan kind still decides its untitled pieces."""

from engine.recognise.tests.acceptance.ts24b3.sheet import GENERAL, LEFT, MIDDLE, read
from engine.recognise.types import ViewKind

TWO = [(None, LEFT), (None, MIDDLE)]


def test_a_sheet_title_naming_a_section_keeps_its_untitled_pieces_sections_on_a_general_sheet() -> None:
    assert [v.kind for v in read(GENERAL, "SECTIONS ZQ", TWO)] == [ViewKind.SECTION] * 2


def test_a_sheet_with_no_discipline_in_the_notes_list_keeps_its_untitled_pieces_plans() -> None:
    assert [v.kind for v in read("structural", "TYPICAL ARRANGEMENTS ZQ", TWO)] == [ViewKind.PLAN] * 2
