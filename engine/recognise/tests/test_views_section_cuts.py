"""17's cuts of the section drawings one piece holds (session 11's scored loop): where a beam's long
section and its cross section are parted, on invented A1 sheets at 1:50, proving mechanics only, never a
reading (docs/sdlc.md)."""

import math

import pytest

from engine.recognise import views
from engine.recognise.tests.test_views import LABELS_ACROSS, drawn, labelled_sections

OX, SCALE = 10_000.0, 50.0
"""`labelled_sections`' frame: its lower-left corner in model space and its scale."""


def line(d: object, a: tuple[float, float], b: tuple[float, float]) -> None:
    """A line between two points on paper (mm)."""
    d.line((OX + a[0] * SCALE, a[1] * SCALE), (OX + b[0] * SCALE, b[1] * SCALE))  # type: ignore[attr-defined]


def test_lines_drawn_across_the_gap_edge_to_edge_still_part_the_drawings() -> None:
    """A cross section's slab lines drawn from its sides to the long section's column face lie in the
    band between them, ending at its edges: the band's own lines, not a drawing running on."""
    d, sheet = labelled_sections(
        [("LONG SECTION OF BEAM B1", (40, 300, 300, 380)), ("SECTION 1-1", (330, 300, 370, 380))],
        LABELS_ACROSS,
    )
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
