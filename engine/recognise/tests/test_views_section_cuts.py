"""17's cuts of the section drawings one piece holds (session 11's scored loop): where a beam's long
section and its cross section are parted, on invented A1 sheets at 1:50, proving mechanics only, never a
reading (docs/sdlc.md)."""

import math

import pytest

from engine.recognise import views
from engine.recognise.tests.drawing import Sheets
from engine.recognise.tests.test_views import (
    LABELS_ACROSS,
    drawn,
    grid,
    labelled_sections,
    near,
    one_sheet,
)
from engine.recognise.types import ViewKind

OX, SCALE = 10_000.0, 50.0
"""`labelled_sections`' frame: its lower-left corner in model space and its scale."""


def line(d: object, a: tuple[float, float], b: tuple[float, float]) -> None:
    """A line between two points on paper (mm)."""
    d.line((OX + a[0] * SCALE, a[1] * SCALE), (OX + b[0] * SCALE, b[1] * SCALE))  # type: ignore[attr-defined]


def test_lines_drawn_across_the_gap_edge_to_edge_still_part_the_drawings() -> None:
    """A cross section's slab lines drawn from its sides to the long section's column face lie in the
    band between them, ending at its edges: the band's own lines, not a drawing running on. Its title
    is lettered smaller than the long section's, as drawn."""
    d, sheet = labelled_sections([("LONG SECTION OF BEAM B1", (40, 300, 300, 380))], LABELS_ACROSS)
    grid(d, (OX + 330 * SCALE, 300 * SCALE, OX + 370 * SCALE, 380 * SCALE))
    d.text("SECTION 1-1", (OX + 330 * SCALE, 290 * SCALE, 0.0), height=4.0 * SCALE)
    for y in (340, 370):
        line(d, (300, y), (330, y))
    found = drawn(d, sheet)
    assert [v.title for v in found] == ["LONG SECTION OF BEAM B1", "SECTION 1-1"]
    long, cross = (v.box for v in found)
    assert long.x0 == pytest.approx(40, abs=1)
    assert long.x1 < 330  # its own bar labels in the band, never its cross section
    assert cross.x0 >= 314
    assert cross.x1 == pytest.approx(370, abs=15)  # its drawing and its title, which is wider


def test_a_line_lying_in_the_gap_but_running_past_its_edge_still_crosses_it() -> None:
    """Two lines lying in the band, one running on 10 mm into the cross section: two lines cross the
    band, as `CUT_CROSSINGS` counts them, so the piece is one drawing, its tallest title's."""
    d, sheet = labelled_sections(
        [("LONG SECTION OF BEAM B1", (40, 300, 300, 380)), (None, (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
    line(d, (300, 340), (330, 340))
    line(d, (300, 370), (340, 370))
    line(d, (290, 355), (345, 355))  # running into both: a crossing however the others are counted
    d.text("SEC. 1-1", (OX + 330 * SCALE, 294 * SCALE, 0.0), height=4.0 * SCALE)
    (view,) = drawn(d, sheet)
    assert view.title == "LONG SECTION OF BEAM B1"
    assert view.box.x1 >= 370


def test_more_lines_lying_in_the_gap_than_bridges_join_the_drawings() -> None:
    """Past `MAX_BRIDGES` lines in the band (a hatch, a drawing's own fill), it parts nothing."""
    d, sheet = labelled_sections(
        [("LONG SECTION OF BEAM B1", (40, 300, 300, 380)), (None, (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
    for i in range(views.MAX_BRIDGES + views.CUT_CROSSINGS + 1):
        line(d, (300, 305 + 10 * i), (330, 305 + 10 * i))
    d.text("SEC. 1-1", (OX + 330 * SCALE, 294 * SCALE, 0.0), height=4.0 * SCALE)
    (view,) = drawn(d, sheet)
    assert view.title == "LONG SECTION OF BEAM B1"
    assert view.box.x1 >= 370


def test_a_band_of_lines_under_a_drawing_is_never_a_part_of_its_own() -> None:
    """A 1 mm band (a title's frame) under the long section, its title under it, the cross section's
    title higher: the band across between band and drawing would leave the long section's title only
    its band. No part less tall than `MIN_DRAWING` of its titles' heights is cut off; the piece, which
    cannot be cut otherwise, is the long section's (lettered taller), its title on its drawing."""
    d, sheet = labelled_sections(
        [(None, (40, 300, 300, 380)), (None, (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
    for y in (340, 370):
        line(d, (290, y), (345, y))  # two lines running into both: no band down
    for a, b in (
        ((40, 293), (300, 293)),
        ((40, 294), (300, 294)),
        ((40, 293), (40, 294)),
        ((300, 293), (300, 294)),
    ):
        line(d, a, b)  # a closed band, 1 mm tall
    d.text("LONG SECTION OF BEAM B1", (OX + 40 * SCALE, 285 * SCALE, 0.0), height=5.0 * SCALE)
    d.text("SEC. 1-1", (OX + 330 * SCALE, 296 * SCALE, 0.0), height=4.0 * SCALE)
    (view,) = drawn(d, sheet)
    assert view.title == "LONG SECTION OF BEAM B1"
    assert view.box.y0 == pytest.approx(285, abs=1)
    assert view.box.y1 == pytest.approx(380, abs=1)
    assert view.box.x1 >= 370


def test_a_cut_parts_a_drawings_lines_at_the_band_never_past_it() -> None:
    """A line one part keeps (by its middle) running across the band into the other's share: the part's
    box stops at the cut, so the cross section's drawing is never the long section's too."""
    d, sheet = labelled_sections(
        [("LONG SECTION OF BEAM B1", (40, 300, 300, 380)), ("SECTION 1-1", (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
    line(d, (40, 390), (360, 390))  # the long section's top bar run on over its cross section
    found = drawn(d, sheet)
    assert [v.title for v in found] == ["LONG SECTION OF BEAM B1", "SECTION 1-1"]
    long, _ = (v.box for v in found)
    assert long.x1 < 330  # its own bar labels in the band, never its cross section


# A title's lines under it ---------------------------------------------------------------------------


def test_a_callout_starting_at_the_titles_end_is_no_line_of_the_title() -> None:
    """Two cross sections stacked; the lower one's bar label stands under the upper one's title,
    starting where that title ends, its leader running down to the lower drawing. It overlaps the title
    across less than `LINE_ACROSS` of its own width: no title line, so the upper view's box stops at its
    title and the label is the lower drawing's."""
    d, sheet = labelled_sections(
        [("SECTION 1-1", (330, 300, 370, 380)), ("SECTION 2-2", (330, 200, 370, 260))], []
    )
    d.text("2-16 ST.", (OX + 375 * SCALE, 278 * SCALE, 0.0), height=5.0 * SCALE)
    line(d, (375, 279), (365, 262))  # its leader, down to the lower drawing
    upper, lower = drawn(d, sheet)
    assert (upper.title, lower.title) == ("SECTION 1-1", "SECTION 2-2")
    assert upper.box.y0 == pytest.approx(288, abs=0.5)
    assert lower.box.y1 >= 283


def test_a_line_set_under_its_title_is_still_the_titles() -> None:
    """The guard: a scale line set under its title, from the same left edge, is the title's line."""
    d, sheet = labelled_sections([("SECTION 1-1", (330, 300, 370, 380))], [])
    d.text("SCALE 1:20", (OX + 330 * SCALE, 280 * SCALE, 0.0), height=5.0 * SCALE)
    (view,) = drawn(d, sheet)
    assert view.box.y0 == pytest.approx(280, abs=0.5)


def test_a_turned_tag_under_a_titles_line_is_no_line_of_the_title() -> None:
    """A mark lettered up the sheet (turned a quarter) under a title's second line: its box is taller
    than twice its lettering, so it is no title line; the view's box stops at the second line."""
    d, sheet = labelled_sections([("SECTION 1-1", (330, 300, 370, 380))], [])
    d.text("TOP VIEW", (OX + 330 * SCALE, 280 * SCALE, 0.0), height=5.0 * SCALE)
    d.text("SD1", (OX + 336 * SCALE, 250 * SCALE, 0.0), height=5.0 * SCALE, rotation_radians=math.pi / 2)
    (view,) = drawn(d, sheet)
    assert view.box.y0 == pytest.approx(280, abs=0.5)


# A title's words ---------------------------------------------------------------------------------------


def test_a_titles_marks_and_sizes_are_no_words() -> None:
    """A long section's title and its second line in one MTEXT, 16 tokens with its mark's letter, its
    size's and its levels' figures, 9 words of two letters or more: a title (`MAX_TITLE_WORDS`)."""
    d, sheet = labelled_sections([(None, (40, 300, 300, 380))], [])
    d.text(
        "LONG SECTION OF BEAM B9 (10 X 14)\\PSTEP 6 AND SOFFIT 2 FROM AXIS 5",
        (OX + 40 * SCALE, 296 * SCALE, 0.0),
        kind="MTEXT",
        height=5.0 * SCALE,
    )
    (view,) = drawn(d, sheet)
    assert view.title is not None
    assert view.title.startswith("LONG SECTION OF BEAM B9")
    assert view.kind is ViewKind.SECTION


def test_one_line_of_more_words_than_a_title_has_is_still_no_title() -> None:
    """The guard: 13 words of two letters or more on one line are a note's sentence, no title."""
    d, sheet = labelled_sections([(None, (40, 300, 300, 380))], [])
    d.text(
        "LONG SECTION OF BEAM AT THE STEP AND SOFFIT FROM THE NEXT AXIS",
        (OX + 40 * SCALE, 292 * SCALE, 0.0),
        height=5.0 * SCALE,
    )
    found = drawn(d, sheet)
    assert all(v.title is None for v in found)


def test_a_long_sections_spans_joined_edge_to_edge_are_never_parted() -> None:
    """Refuter, loop 3 (65): a long section drawn as two spans, its beam lines drawn edge to edge across
    the column between them, its cross section beside it crossed by two lines (no band). The gap
    between the spans is no cross section's: the far side's lines span more than `CROSS_WIDTHS` of
    the cross section's title, so the long section stays one drawing."""
    d, sheet = labelled_sections([(None, (330, 300, 370, 380))], LABELS_ACROSS)
    for box in ((40, 300, 160, 380), (190, 300, 300, 380)):
        grid(d, (OX + box[0] * SCALE, box[1] * SCALE, OX + box[2] * SCALE, box[3] * SCALE))
    for y in (340, 370):
        line(d, (160, y), (190, y))  # the beam's lines across the column
    for y in (345, 355):
        line(d, (290, y), (345, y))  # running into both: no band between long and cross section
    d.text("LONG SECTION OF BEAM B1", (OX + 40 * SCALE, 288 * SCALE, 0.0), height=6.0 * SCALE)
    d.text("SECTION 1-1", (OX + 330 * SCALE, 288 * SCALE, 0.0), height=4.0 * SCALE)
    (view,) = drawn(d, sheet)
    assert view.title == "LONG SECTION OF BEAM B1"
    assert view.box.x0 == pytest.approx(40, abs=1)
    assert view.box.x1 >= 370


def test_a_gap_parts_no_drawings_whose_titles_are_lettered_alike() -> None:
    """The cross section's rule: lines lying in a gap part a drawing only from a cross section beside
    it, its title lettered `TALLER` times smaller than the long section's."""
    d, sheet = labelled_sections(
        [("LONG SECTION OF BEAM B1", (40, 300, 300, 380)), ("SECTION 1-1", (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
    for y in (340, 370):
        line(d, (300, y), (330, y))
    (view,) = drawn(d, sheet)  # both titles 6 mm: the gap parts nothing
    assert view.box.x1 >= 370


def test_a_two_line_note_naming_a_kind_is_no_title() -> None:
    """Refuter, loop 3 (65): an unnumbered note in one MTEXT of two lines, 14 words, naming a section
    and notes, at the sheet's lettering: no title (its words run past `MAX_TITLE_WORDS`)."""
    d, sheet = labelled_sections([(None, (40, 300, 300, 380))], [])
    d.text(
        "FOR BEAM REINFORCEMENT REFER TO THE SECTION DRAWINGS\\PON SHEET S-07 AND THE GENERAL NOTES",
        (OX + 40 * SCALE, 292 * SCALE, 0.0),
        kind="MTEXT",
        height=5.0 * SCALE,
    )
    found = drawn(d, sheet)
    assert all(v.title is None for v in found)


# A ruled table of any size --------------------------------------------------------------------------


def table(d: object, rows: list[float], x0: float = 400.0, x1: float = 480.0) -> None:
    """A ruled table at 1:1 on an A1 sheet: a rule across at each of `rows`, framed down both ends,
    two rules down between them under its header row, and three cells of text a row."""
    lo, hi = rows[0], rows[-1]
    inner = (x0 + (x1 - x0) / 4, x0 + (x1 - x0) * 5 / 8)
    for y in rows:
        d.line((x0, y), (x1, y))  # type: ignore[attr-defined]
    for x in (x0, x1):
        d.line((x, lo), (x, hi))  # type: ignore[attr-defined]
    for x in inner:
        d.line((x, lo), (x, rows[-2]))  # type: ignore[attr-defined]
    for a in rows[:-2]:  # every row under the header
        for x in (x0 + 2, inner[0] + 2, inner[1] + 2):
            d.text("C1", (x, a + 2, 0.0), height=2.5)  # type: ignore[attr-defined]


def test_a_small_ruled_table_beside_a_plan_is_a_schedule() -> None:
    """A column schedule set beside its plan, far smaller than `MIN_UNTITLED` of the paper and its
    rules far shorter than `DIVIDER_SHARE` of it: a schedule of its own."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    table(d, [480.0, 490.0, 500.0, 510.0, 520.0, 530.0])
    found = drawn(d, one_sheet(d))
    schedules = [v for v in found if v.kind is ViewKind.SCHEDULE]
    assert len(schedules) == 1
    assert near(schedules[0].box, (400, 480, 480, 530), by=1.0)


def test_lines_alike_of_many_spacings_are_no_table() -> None:
    """The guard: the same rules spaced 10, 30, 10, 45 mm apart (a drawing's lines of one length) are no
    table's rows (`TABLE_ROW_SPREAD`)."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    table(d, [400.0, 410.0, 440.0, 450.0, 495.0, 505.0])
    assert not [v for v in drawn(d, one_sheet(d)) if v.kind is ViewKind.SCHEDULE]


def test_ruled_lines_naming_one_mark_a_band_are_no_table() -> None:
    """The guard: rules framed and divided like a table, but one text a band (a drawing's members, each
    named once): fewer than `TABLE_CELLS` texts a row, no table."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    rows = [480.0, 490.0, 500.0, 510.0, 520.0, 530.0]
    for y in rows:
        d.line((400.0, y), (480.0, y))
    for x in (400.0, 480.0):
        d.line((x, rows[0]), (x, rows[-1]))
    d.line((440.0, rows[0]), (440.0, rows[-2]))
    for a in rows[:-1]:
        d.text("B1", (402.0, a + 2, 0.0), height=2.5)
    assert not [v for v in drawn(d, one_sheet(d)) if v.kind is ViewKind.SCHEDULE]


def test_a_ruled_table_inside_a_titled_plans_box_is_still_a_schedule() -> None:
    """A table drawn within the plan's box (its title running wide under it), its rules near the plan's
    lines: no part of the plan's drawing, a schedule wherever it stands."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    table(d, [436.0, 446.0, 456.0, 466.0, 476.0, 486.0], x0=120.0, x1=184.0)
    found = drawn(d, one_sheet(d))
    schedules = [v for v in found if v.kind is ViewKind.SCHEDULE]
    assert len(schedules) == 1
    assert near(schedules[0].box, (120, 436, 184, 486), by=1.0)


def test_a_stairs_treads_numbered_in_figures_are_no_schedule() -> None:
    """Refuter 2, loop 3 (70): a dog-leg stair in a plan, its two flights' treads aligned and numbered,
    its centre line stopping under the landing (a header row's shape): no letter in its rows, so no
    schedule; the plan stays the only view."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    ys = [436.0 + 5 * i for i in range(10)]
    for y in ys:
        d.line((200.0, y), (220.0, y))
        d.line((220.0, y), (240.0, y))
    for x in (200.0, 240.0):
        d.line((x, ys[0]), (x, 491.0))
    d.line((200.0, 491.0), (240.0, 491.0))  # the landing's far wall
    d.line((220.0, ys[0]), (220.0, ys[-1]))  # the centre line between the flights
    for i, y in enumerate(ys[:-1]):
        d.text(str(i + 1), (208.0, y + 1.5, 0.0), height=2.0)
        d.text(str(18 - i), (228.0, y + 1.5, 0.0), height=2.0)
    d.text("LANDING", (210.0, 485.0, 0.0), height=2.0)
    d.text("UP", (202.0, 438.0, 0.0), height=2.0)
    found = drawn(d, one_sheet(d))
    assert [v.kind for v in found] == [ViewKind.PLAN]


def test_a_windows_glazing_bars_are_no_schedule() -> None:
    """Refuter 2, loop 3 (55): a window elevation in a titled detail, its transoms evenly spaced and its
    mullion running the full height, a word in each pane: no header row spans the mullion, no
    schedule."""
    d = Sheets()
    grid(d, (40, 300, 140, 400))
    rows = [320.0, 335.0, 350.0, 365.0, 380.0]
    for y in rows:
        d.line((70.0, y), (110.0, y))
    for x in (70.0, 95.0, 110.0):
        d.line((x, rows[0]), (x, rows[-1]))
    for y in rows[:-1]:
        d.text("GLASS", (73.0, y + 5, 0.0), height=2.0)
        d.text("GLASS", (97.0, y + 5, 0.0), height=2.0)
    d.text("WINDOW W1 ELEVATION", (40, 288, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    assert not [v for v in found if v.kind is ViewKind.SCHEDULE]


# A plan's storeys in brackets under its title -----------------------------------------------------


def test_a_plans_storeys_in_brackets_under_its_title_continue_it() -> None:
    """ "(2ND TO 6TH FLOOR)" set under a plan's title is the title's: the view's title says it."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("WASHROOM FITTINGS PLAN", (40, 288, 0.0), height=6.0)
    d.text("(2ND TO 6TH FLOOR)", (40, 279, 0.0), height=6.0)
    (view,) = drawn(d, one_sheet(d))
    assert view.title == "WASHROOM FITTINGS PLAN (2ND TO 6TH FLOOR)"


def test_a_bracketed_remark_under_a_title_is_not_its_title() -> None:
    """The guards: a bracketed remark naming no storeys under a plan's title, and a bracketed line
    under a section's title, stay the view's lines, not its title."""
    for title, line in (
        ("WASHROOM FITTINGS PLAN", "(SEE NOTES)"),
        ("LONG SECTION OF BEAM B1", "(2ND TO 6TH FLOOR)"),
    ):
        d = Sheets()
        grid(d, (40, 300, 340, 560))
        d.text(title, (40, 288, 0.0), height=6.0)
        d.text(line, (40, 279, 0.0), height=6.0)
        (view,) = drawn(d, one_sheet(d))
        assert view.title == title


# Review round 1 (PR 409): each finding's case, red on 59eb6cb44 ----------------------------------------


def test_two_thin_sections_stacked_in_one_piece_are_still_parted() -> None:
    """Round 1, F5: two cross sections 12 mm tall stacked in one piece, joined by bar labels, their
    titles 6 mm tall: each part is a drawing taller than its title (`MIN_PART`), so the piece is cut
    and both are views."""
    labels = [("2-16 ST.", (402.0, 312.0 + 8 * i)) for i in range(4)]
    d, sheet = labelled_sections(
        [("SECTION 1-1", (330, 300, 400, 312)), ("SECTION 2-2", (330, 340, 400, 352))], labels
    )
    found = drawn(d, sheet)
    assert sorted(v.title for v in found if v.title) == ["SECTION 1-1", "SECTION 2-2"]


def test_a_titles_frame_alone_is_never_a_part() -> None:
    """The guard: a frame boxed round the long section's title, 2.4 title heights tall, under the
    drawing. A part holding only lines round its titles is their frame, never a drawing, so the piece
    is the long section's and the frame its."""
    d, sheet = labelled_sections(
        [(None, (40, 300, 300, 380)), (None, (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
    for y in (340, 370):
        line(d, (290, y), (345, y))  # two lines running into both: no band down
    for a, b in (
        ((38, 282), (200, 282)),
        ((38, 294), (200, 294)),
        ((38, 282), (38, 294)),
        ((200, 282), (200, 294)),
    ):
        line(d, a, b)  # the title's frame, 12 mm tall
    d.text("LONG SECTION OF BEAM B1", (OX + 40 * SCALE, 285 * SCALE, 0.0), height=5.0 * SCALE)
    d.text("SEC. 1-1", (OX + 330 * SCALE, 296 * SCALE, 0.0), height=4.0 * SCALE)
    (view,) = drawn(d, sheet)
    assert view.title == "LONG SECTION OF BEAM B1"
    assert view.box.y1 == pytest.approx(380, abs=1)


def callout_beside_a_plan(callout: str) -> list[object]:
    """A beam plan with its member labels (the sheet's lettering), an untitled drawing beside it and
    a one-line callout under that drawing at the sheet's lettering."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    grid(d, (400, 300, 560, 420))
    d.text("GROUND FLOOR BEAM LAYOUT PLAN", (40, 288, 0.0), height=6.0)
    for i in range(12):
        d.text(f"B{i + 1}", (60 + 20 * i, 330, 0.0), height=2.5)
    d.text(callout, (400, 292, 0.0), height=2.5)
    return drawn(d, one_sheet(d))  # type: ignore[return-value]


@pytest.mark.parametrize(
    "callout",
    [
        "SEE DETAIL D-3 ON SHEET S-07 FOR BEAM B-12 (250X450) AT GRID C/4-5",
        "SECTION AT GRID 3-3 BETWEEN C-D, EL. +3.050 TO +6.100, SEE S-12",
        "SECTION THRU BEAM B-4 (250X450) REFER S-9 FOR BARS AT GRID 2/C-D",
    ],
)
def test_a_callout_full_of_figures_and_references_is_no_title(callout: str) -> None:
    """Round 1, F4: a callout of more tokens than `MAX_TITLE_WORDS`, few of them words, pointing
    elsewhere (see, refer, sheet): no title, so the drawing beside it stays untitled."""
    found = callout_beside_a_plan(callout)
    assert [v.title for v in found if v.title] == ["GROUND FLOOR BEAM LAYOUT PLAN"]  # type: ignore[attr-defined]


def test_a_text_of_more_tokens_than_twice_a_titles_words_is_no_title() -> None:
    """Round 1, F4: past `2 * MAX_TITLE_WORDS` tokens a text is a note however few its words."""
    found = callout_beside_a_plan(
        "DETAIL B-1 B-2 B-3 B-4 B-5 B-6 B-7 B-8 B-9 B-10 B-11 B-12 B-13 (10X14) (12X16) (8X10)"
    )
    assert [v.title for v in found if v.title] == ["GROUND FLOOR BEAM LAYOUT PLAN"]  # type: ignore[attr-defined]


def test_a_wardrobes_compartments_in_its_titled_elevation_are_no_schedule() -> None:
    """Round 1, lens 2's F2: a wardrobe elevation, its shelves evenly spaced, its sides framing them,
    its partition stopping under a loft spanning the top, a word in each compartment: a ruled grid
    making the bulk of a titled drawing is that drawing (`TABLE_DRAWN`), never a schedule."""
    d = Sheets()
    grid(d, (200, 300, 300, 400))  # another drawing, apart
    d.text("GROUND FLOOR PLAN", (200, 288, 0.0), height=6.0)
    for a, b in (
        ((60, 315), (120, 315)),
        ((60, 315), (60, 390)),
        ((120, 315), (120, 390)),
        ((60, 390), (120, 390)),
    ):
        d.line(a, b)  # the carcass
    rows = [320.0, 335.0, 350.0, 365.0, 380.0]
    for y in rows:
        d.line((70.0, y), (110.0, y))
    for x in (70.0, 110.0):
        d.line((x, rows[0]), (x, rows[-1]))
    d.line((90.0, rows[0]), (90.0, rows[-2]))  # the partition, under the loft
    for y in rows[:-2]:
        d.text("SHELF", (72.0, y + 5, 0.0), height=2.0)
        d.text("HOOKS", (92.0, y + 5, 0.0), height=2.0)
    d.text("LOFT", (72.0, rows[-2] + 5, 0.0), height=2.0)
    d.text("FLAP", (92.0, rows[-2] + 5, 0.0), height=2.0)
    d.text("WARDROBE W1 ELEVATION", (60, 305, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    assert not [v for v in found if v.kind is ViewKind.SCHEDULE]
    elevation = next(v for v in found if v.kind is ViewKind.ELEVATION)
    assert near(elevation.box, (60, 305, 120, 390), by=40.0)


def plan_over(line_under: str) -> object:
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("WASHROOM FITTINGS PLAN", (40, 288, 0.0), height=6.0)
    d.text(line_under, (40, 279, 0.0), height=6.0)
    (view,) = drawn(d, one_sheet(d))
    return view


@pytest.mark.parametrize(
    "line_under",
    [
        "(EXCEPT 5TH FLOOR)",
        "(SEE 2ND FLOOR PLAN)",
        "(SAME AS 3RD FLOOR)",
        "(FOR 2ND FLOOR SLAB)",
        "(5TH FLOOR ONLY)",
        "(SIMILAR TO 4TH FLOOR)",
    ],
)
def test_a_bracketed_line_excepting_or_pointing_at_a_storey_is_no_storeys_line(line_under: str) -> None:
    """Round 1, F3: a bracketed line naming a storey among other words (it excepts it, points at it or
    says what of it) is no statement of the storeys the plan draws: the title stays its own."""
    view = plan_over(line_under)
    assert view.title == "WASHROOM FITTINGS PLAN"  # type: ignore[attr-defined]
    assert not {"floor_2", "floor_3", "floor_4", "floor_5"} & set(view.storeys)  # type: ignore[attr-defined]


@pytest.mark.parametrize(
    "line_under", ["(2ND, 4TH & 6TH FLOORS)", "(14TH - 17TH FLOOR)", "(2ND AND 3RD FLOOR)", "(ROOF)"]
)
def test_a_bracketed_list_or_range_of_storeys_is_the_titles(line_under: str) -> None:
    """The guard: storeys listed or ranged, with nothing else, continue the title."""
    view = plan_over(line_under)
    assert view.title == f"WASHROOM FITTINGS PLAN {line_under}"  # type: ignore[attr-defined]


def test_plans_whose_storeys_are_only_bracketed_raise_no_same_storey_conflict() -> None:
    """Round 1, F2: two plumbing sheets, each a different washroom's fittings plan over one bracketed
    range of storeys. The line continues each title, but the storeys it names are where the plan
    applies, not the storey it draws: the plans' storeys stay their titles' own (none stated), so the
    two give no same_storey Conflict (a part plan is no storey drawn twice)."""
    from dataclasses import replace

    from engine.recognise import conflicts, sheets
    from engine.recognise.tests.drawing import DEFAULT, frame_block
    from engine.recognise.tests.test_views import CONVENTIONS, framed

    found_sheets, found_views = [], []
    for number, sheet_title in (("P-01", "WASHROOM W1 DETAILS"), ("P-02", "WASHROOM W2 DETAILS")):
        d = Sheets()
        grid(d, (40, 300, 340, 560))
        d.text("SANITARY FITTINGS PLAN", (40, 288, 0.0), height=6.0)
        d.text("(2ND TO 6TH FLOOR)", (40, 279, 0.0), height=6.0)
        framed(d, frame_block(d), (0.0, 0.0), 1.0, {0: sheet_title, 2: number})
        (sheet,) = sheets.find(d.artefact(), "plumbing", DEFAULT)
        plans = [v for v in views.find(d.artefact(), sheet, CONVENTIONS) if v.kind is ViewKind.PLAN]
        assert [v.title for v in plans] == ["SANITARY FITTINGS PLAN (2ND TO 6TH FLOOR)"]
        assert plans[0].subject == "fixture"
        found_sheets.append(replace(sheet, group="b1"))
        found_views.append(plans)
    found = conflicts.find(found_sheets, found_views, DEFAULT)
    assert not [c for c in found if getattr(c, "kind", None) == conflicts.SAME_STOREY]


def test_a_titled_schedules_own_ruled_rows_are_no_second_schedule() -> None:
    """Round 1's measure (the Sample Project's general sheet): a titled schedule whose ruled rows are
    also a small table, and a sub-table in its corner. Both lie in the titled schedule's box: its own,
    never an untitled schedule (each would be a view no Step accounts for)."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    table(d, [400.0, 410.0, 420.0, 430.0, 440.0, 450.0], x0=400.0, x1=560.0)
    table(d, [452.0, 456.0, 460.0, 464.0, 468.0, 472.0], x0=500.0, x1=560.0)
    d.text("QX FIXING SCHEDULE", (400, 476, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    schedules = [v for v in found if v.kind is ViewKind.SCHEDULE]
    assert [v.title for v in schedules] == ["QX FIXING SCHEDULE"]


def test_a_thin_strip_clear_of_its_titles_band_is_still_no_part() -> None:
    """The guard for `MIN_PART`: the 1 mm band under the long section, but its title set lower, clear of
    the band by more than its height: no frame of the title, yet a part less tall than its title is no
    drawing, so the piece stays the long section's."""
    d, sheet = labelled_sections(
        [(None, (40, 300, 300, 380)), (None, (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
    for y in (340, 370):
        line(d, (290, y), (345, y))  # two lines running into both: no band down
    for a, b in (
        ((40, 293), (300, 293)),
        ((40, 294), (300, 294)),
        ((40, 293), (40, 294)),
        ((300, 293), (300, 294)),
    ):
        line(d, a, b)  # a closed band, 1 mm tall
    d.text("LONG SECTION OF BEAM B1", (OX + 40 * SCALE, 280 * SCALE, 0.0), height=5.0 * SCALE)
    d.text("SEC. 1-1", (OX + 330 * SCALE, 296 * SCALE, 0.0), height=4.0 * SCALE)
    (view,) = drawn(d, sheet)
    assert view.title == "LONG SECTION OF BEAM B1"
    assert view.box.y1 == pytest.approx(380, abs=1)
