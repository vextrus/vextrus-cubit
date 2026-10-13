"""An untitled piece on a notes Discipline's sheet is never a Plan view (S24-B3, R1), and the rule
reaches no further: a sheet title's own non-plan kind still decides its untitled pieces."""

from dataclasses import replace

from engine.recognise import sheets, views
from engine.recognise.tests.acceptance.ts24b3.sheet import GENERAL, LEFT, MIDDLE, read
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block
from engine.recognise.tests.test_views import framed, grid
from engine.recognise.types import Sourced, ValueSource, ViewCandidate, ViewKind

TWO = [(None, LEFT), (None, MIDDLE)]


def test_a_sheet_title_naming_a_section_keeps_its_untitled_pieces_sections_on_a_general_sheet() -> None:
    assert [v.kind for v in read(GENERAL, "SECTIONS ZQ", TWO)] == [ViewKind.SECTION] * 2


def test_a_sheet_with_no_discipline_in_the_notes_list_keeps_its_untitled_pieces_plans() -> None:
    assert [v.kind for v in read("structural", "TYPICAL ARRANGEMENTS ZQ", TWO)] == [ViewKind.PLAN] * 2


def _read(d: Sheets, discipline: str) -> list[ViewCandidate]:
    framed(d, frame_block(d), (0.0, 0.0), 1.0, {0: "GENERAL ARRANGEMENT", 2: "S-01"})
    (found,) = sheets.find(d.artefact(), discipline, DEFAULT)
    sheet = replace(found, discipline=Sourced(discipline, ValueSource.FILE))
    conventions = replace(views.default_conventions(), notes_disciplines=(GENERAL,))
    return [
        v for v in views.find(d.artefact(), sheet, conventions) if v.kind is not ViewKind.TITLE_BLOCK
    ]


def _cut_apart(d: Sheets, title: str | None) -> None:
    """A drawing cut apart where its grid was taken out: a body, the row of grid ends over it, and
    grid lines long enough to read as dividers between them."""
    grid(d, (100, 250, 500, 540))
    for x in (100, 200, 300, 400, 500):
        d.line((x, 150), (x, 200))
    d.line((100, 175), (500, 175))
    if title is not None:
        d.text(title, (100, 138, 0.0), height=6.0)
    for x in (150, 250, 350, 450):
        d.line((x, 150), (x, 540))


def _grown_again(d: Sheets) -> None:
    grid(d, (100, 300, 400, 540))
    d.text("FIRST FLOOR PLAN", (100, 288, 0.0), height=6.0)
    grid(d, (100, 100, 400, 220))
    for x in (150, 250):
        d.line((x, 100), (x, 540))
    d.line((100, 160), (660, 160))


def _boxes(found: list[ViewCandidate]) -> list[tuple[ViewKind, tuple[float, ...]]]:
    return [(v.kind, tuple(round(c) for c in v.box.to_json())) for v in found]


def test_a_titled_plan_its_grid_cuts_apart_keeps_its_whole_box_on_a_general_sheet() -> None:
    for build in (lambda d: _cut_apart(d, "FIRST FLOOR PLAN"), _grown_again):
        on_general, on_structural = Sheets(), Sheets()
        build(on_general)
        build(on_structural)
        general, structural = _read(on_general, GENERAL), _read(on_structural, "structural")
        assert _boxes(general) == _boxes(structural)
        assert [v.kind for v in general] == [ViewKind.PLAN]


def test_an_untitled_drawing_its_grid_cut_apart_is_one_detail_on_a_general_sheet() -> None:
    on_general, on_structural = Sheets(), Sheets()
    _cut_apart(on_general, None)
    _cut_apart(on_structural, None)
    general, structural = _read(on_general, GENERAL), _read(on_structural, "structural")
    assert [v.kind for v in structural] == [ViewKind.PLAN]
    assert [v.kind for v in general] == [ViewKind.DETAIL]
    assert general[0].box == structural[0].box
