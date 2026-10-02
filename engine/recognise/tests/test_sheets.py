"""`sheets.find`: the sheets of a drawing, and what each one's title block says (13).

Hand-built artefacts (engine/recognise/tests/drawing.py): invented frames and values, the mechanics
of every rule in the module's docstring, each through `find` or `segment`, the stage's interface.
"""

import json
import math

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.read.anchor import DwgAnchor
from engine.recognise import sheets
from engine.recognise.sheets import MODEL_SHEET, find, segment
from engine.recognise.tests.drawing import (
    DEFAULT,
    H,
    Sheets,
    W,
    frame_block,
    label_at,
    rectangle,
    value_at,
)
from engine.recognise.types import (
    Exclusion,
    ExclusionReason,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
)
from engine.render.fixtures.artefacts import PAPER


def placed_frame(
    d: Sheets,
    block: str,
    point: tuple[float, float],
    values: dict[int, str],
    *,
    scale: float = 1.0,
    rotation: float = 0.0,
    extrusion: tuple[float, float, float] = (0.0, 0.0, 1.0),
    kind: str = "MTEXT",
) -> str:
    """Insert a frame block and write each value loose in model space, under its cell's label,
    where the insert puts that place in the world (through 11's placement)."""
    insert = d.insert(
        block,
        (point[0], point[1], 0.0),
        scale=(scale, scale, scale),
        rotation_radians=math.radians(rotation),
        extrusion=extrusion,
    )
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in values.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(
            text,
            (x, y, 0.0),
            kind=kind,
            height=5.0 * scale,
            rotation_radians=math.radians(rotation) if kind != "MTEXT" else 0.0,
            direction=(math.cos(math.radians(rotation)), math.sin(math.radians(rotation)), 0.0),
        )
    return insert


def by_number(found: list[SheetCandidate]) -> dict[str | None, SheetCandidate]:
    return {s.number.value if s.number else None: s for s in found}


# Frames in model space, placed through 11's transform --------------------------------------------------


@pytest.mark.parametrize(
    ("scale", "rotation", "extrusion", "box"),
    [
        (1.0, 0.0, (0.0, 0.0, 1.0), (10_000.0, 0.0, 10_000.0 + W, H)),
        (50.0, 0.0, (0.0, 0.0, 1.0), (10_000.0, 0.0, 10_000.0 + 50 * W, 50 * H)),
        (1.0, 90.0, (0.0, 0.0, 1.0), (10_000.0 - H, 0.0, 10_000.0, W)),
        (1.0, 270.0, (0.0, 0.0, 1.0), (10_000.0, -W, 10_000.0 + H, 0.0)),
        (1.0, 0.0, (0.0, 0.0, -1.0), (-10_000.0 - W, 0.0, -10_000.0, H)),
    ],
)
def test_a_frame_is_found_where_its_insert_draws_it(
    scale: float,
    rotation: float,
    extrusion: tuple[float, float, float],
    box: tuple[float, float, float, float],
) -> None:
    """A rotated, scaled or mirrored frame lands where AutoCAD draws it; its box is its own drawn
    extent, and its values are read in its own axes."""
    d = Sheets()
    block = frame_block(d)
    placed_frame(
        d, block, (10_000.0, 0.0), {0: "COLUMN LAYOUT PLAN", 2: "S-07", 3: "12.08.2026"},
        scale=scale, rotation=rotation, extrusion=extrusion,
    )  # fmt: skip

    found = find(d.artefact(), None, DEFAULT)

    assert len(found) == 1
    sheet = found[0]
    assert sheet.location.box is not None
    got = (sheet.location.box.x0, sheet.location.box.y0, sheet.location.box.x1, sheet.location.box.y1)
    assert got == pytest.approx(box, abs=1e-6)
    assert sheet.number == Sourced("S-07", ValueSource.TITLE_BLOCK_TEXT)
    assert sheet.title == Sourced("COLUMN LAYOUT PLAN", ValueSource.TITLE_BLOCK_TEXT)
    assert sheet.issue_date == Sourced("12.08.2026", ValueSource.TITLE_BLOCK_TEXT)


def test_a_frame_turned_off_a_right_angle_is_found_in_its_turned_box() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0.0, 0.0), {2: "S-01", 0: "PILE LAYOUT PLAN"}, rotation=30)

    (sheet,) = find(d.artefact(), None, DEFAULT)

    c, s = math.cos(math.radians(30)), math.sin(math.radians(30))
    corners = [(x * c - y * s, x * s + y * c) for x, y in ((0, 0), (W, 0), (W, H), (0, H))]
    assert sheet.location.box is not None
    assert sheet.location.box.x0 == pytest.approx(min(p[0] for p in corners))
    assert sheet.location.box.y1 == pytest.approx(max(p[1] for p in corners))
    assert sheet.number is not None
    assert sheet.number.value == "S-01"


def test_a_frame_is_found_by_its_title_block_whatever_its_block_is_called() -> None:
    """No frame block name is written in code: a block called anything, its base point far from
    its geometry, is a frame when its rectangle holds a title block."""
    d = Sheets()
    block = frame_block(d, "ARROW-7", base=(-5_000_000.0, 2_000_000.0, 0.0))
    placed_frame(d, block, (0.0, 0.0), {2: "11"})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.location.box is not None
    assert sheet.location.box.x0 == pytest.approx(5_000_000.0)
    assert sheet.number is not None
    assert sheet.number.value == "11"


def test_a_rectangle_without_a_title_block_is_no_frame_and_a_title_block_alone_is_none() -> None:
    d = Sheets()
    d.entity("LWPOLYLINE", rectangle(0, 0, W, H))  # a border, no title block: no sheet by itself
    d.text("SCALE", (0.5 * W, 0.5 * H + 5000, 0))  # labels far from any rectangle
    d.text("DATE", (0.5 * W, 0.5 * H + 5010, 0))
    strip = d.block("STRIP")  # a title block with no border around it
    d.entity("LWPOLYLINE", rectangle(0, 0, 180, 40), owner=strip)
    d.text("SHEET NO", (5, 30, 0), owner=strip)
    d.text("DATE", (5, 10, 0), owner=strip)
    d.insert(strip, (5000, 5000, 0))

    assert find(d.artefact(), None, DEFAULT) == []


def test_the_frames_of_a_row_are_read_in_rows_then_left_to_right() -> None:
    d = Sheets()
    block = frame_block(d)
    for i, (x, y) in enumerate([(2000, 0), (0, 0), (1000, 0), (0, -1000)]):
        placed_frame(d, block, (x, y), {2: f"0{i + 1}"})

    numbers = [s.number.value for s in find(d.artefact(), None, DEFAULT) if s.number]

    assert numbers == ["02", "03", "01", "04"]


# What a title block says -------------------------------------------------------------------------------


def test_each_value_is_the_nearest_label_before_it() -> None:
    """Labels in a row with their values under them: each value belongs to its own label, never to a
    neighbour's; a value after its label on one line is read too."""
    d = Sheets()
    block = d.block("ROW")
    d.entity("LWPOLYLINE", rectangle(0, 0, W, H), owner=block)
    for x, label in ((700, "SCALE"), (740, "SHEET NO"), (790, "DATE")):
        d.text(label, (x, 40, 0), height=3.0, owner=block)
    d.text("SHEET TITLE:", (700, 80, 0), height=3.0, owner=block)
    d.insert(block, (0, 0, 0))
    d.text("1:100", (701, 32, 0), height=3.0)
    d.text("A-12", (741, 32, 0), height=5.0)
    d.text("03-02-2026", (791, 32, 0), height=3.0)
    d.text("SECOND FLOOR PLAN", (730, 80, 0), height=4.0)

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.number is not None
    assert sheet.number.value == "A-12"
    assert sheet.issue_date is not None
    assert sheet.issue_date.value == "03-02-2026"
    assert sheet.title is not None
    assert sheet.title.value == "SECOND FLOOR PLAN"
    assert sheet.storeys_as_stated == Sourced("SECOND FLOOR", ValueSource.TITLE_BLOCK_TEXT)


def test_a_label_and_its_value_in_one_text_are_read() -> None:
    d = Sheets()
    block = frame_block(d, labels=("SCALE", "DATE"))
    d.insert(block, (0, 0, 0))
    x, y, _ = label_at(4)
    d.text("SHEET NO: E-09", (x, y, 0))

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.number == Sourced("E-09", ValueSource.TITLE_BLOCK_TEXT)


def test_a_title_over_several_lines_is_one_title() -> None:
    d = Sheets()
    insert = placed_frame(d, frame_block(d), (0, 0), {2: "S-03"})
    placed = chain_transform(chain(d.artefact(), [insert]))
    for i, line in enumerate(("BEAM LAYOUT PLAN", "(1ST TO 3RD FLOOR)")):
        x, y, _ = placed.apply((0.8 * W + 12.0, H - 35.0 - 8.0 * i, 0.0))
        d.text(line, (x, y, 0), height=5.0)
    wrapped = placed_frame(d, frame_block(d, "SHEET2"), (1000, 0), {2: "S-04"})
    x, y, _ = chain_transform(chain(d.artefact(), [wrapped])).apply(value_at(0))
    d.text("SLAB LAYOUT\\P(TOP LAYER)", (x, y, 0), kind="MTEXT", height=5.0)

    found = by_number(find(d.artefact(), None, DEFAULT))

    assert found["S-03"].title is not None
    assert found["S-03"].title.value == "BEAM LAYOUT PLAN (1ST TO 3RD FLOOR)"
    assert found["S-04"].title is not None
    assert found["S-04"].title.value == "SLAB LAYOUT (TOP LAYER)"


def test_the_sheet_title_cell_is_preferred_to_a_drawing_title_cell() -> None:
    """The conventions' words are preferred in their order: "sheet title" before "drawing title",
    and a value written for this sheet before one drawn in the frame's block."""
    d = Sheets()
    block = frame_block(d, labels=("DRAWING TITLE", "SHEET TITLE", "SHEET NO"))
    d.text("ELECTRICAL DRAWINGS", value_at(0), height=5.0, owner=block)
    placed_frame(d, block, (0, 0), {1: "LIGHTING LAYOUT PLAN", 2: "E-02"})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.title is not None
    assert sheet.title.value == "LIGHTING LAYOUT PLAN"


def test_an_empty_title_cell_takes_no_other_cells_text() -> None:
    d = Sheets()
    block = frame_block(d, labels=("SHEET TITLE", "SCALE", "SHEET NO"))
    d.text("AS SHOWN", value_at(1), height=3.0, owner=block)
    placed_frame(d, block, (0, 0), {2: "18"})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.title is None
    assert sheet.number is not None
    assert sheet.number.value == "18"


def test_attributes_are_read_first_a_titles_lines_in_order() -> None:
    d = Sheets()
    block = frame_block(
        d, attdefs=("TITLE", "TITLE2", "DRAWING_TITLE", "SHEET_NO", "REV", "REV1", "DATE")
    )
    insert = d.insert(block, (0, 0, 0))
    for tag, text in (("TITLE2", "BAR BENDING SCHEDULE"), ("TITLE", "FOUNDATION NOTES &"),
                      ("DRAWING_TITLE", "NOTES"), ("SHEET_NO", "S-01"), ("REV", "R2"),
                      ("REV1", "R0"), ("DATE", "27-11-2025")):  # fmt: skip
        d.attrib(insert, text, value_at(0), tag=tag)
    d.text("S-99", value_at(3))  # a loose text where the number sits: attributes come first

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.title == Sourced(
        "FOUNDATION NOTES & BAR BENDING SCHEDULE", ValueSource.TITLE_BLOCK_ATTRIBUTE
    )
    assert sheet.number == Sourced("S-01", ValueSource.TITLE_BLOCK_ATTRIBUTE)
    assert sheet.revision_mark == Sourced("R2", ValueSource.TITLE_BLOCK_ATTRIBUTE)
    assert sheet.issue_date == Sourced("27-11-2025", ValueSource.TITLE_BLOCK_ATTRIBUTE)


def test_an_empty_attribute_is_no_value_and_the_title_block_text_is_read() -> None:
    d = Sheets()
    block = frame_block(d, attdefs=("SHEET_NO", "TITLE"))
    insert = placed_frame(d, block, (0, 0), {0: "ROOF PLAN"})
    d.attrib(insert, "  ", value_at(1), tag="TITLE")
    d.attrib(insert, "A-06", value_at(2), tag="SHEET_NO")

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.number == Sourced("A-06", ValueSource.TITLE_BLOCK_ATTRIBUTE)
    assert sheet.title == Sourced("ROOF PLAN", ValueSource.TITLE_BLOCK_TEXT)


def test_attributes_burst_to_text_are_read_where_the_block_defines_them() -> None:
    d = Sheets()
    block = frame_block(d, labels=(), attdefs=("TITLE", "SCALE", "SHEET_NO"))
    d.text("SCALE", label_at(5), owner=block)
    d.text("JOB NO", label_at(6), owner=block)
    placed_frame(d, block, (500, 0), {0: "TOILET DETAILS", 2: "A-25"}, kind="TEXT")

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.number == Sourced("A-25", ValueSource.TITLE_BLOCK_TEXT)
    assert sheet.title == Sourced("TOILET DETAILS", ValueSource.TITLE_BLOCK_TEXT)


# Frames that are not sheets, and sheets that are not framed --------------------------------------------


def test_a_box_around_a_row_of_frames_is_not_a_sheet() -> None:
    d = Sheets()
    block = frame_block(d)
    for i, (x, y) in enumerate(((0, 0), (1000, 0), (0, -800), (1000, -800))):
        placed_frame(d, block, (x, y), {2: f"0{i + 1}"})
    d.entity("LWPOLYLINE", rectangle(-50, -850, 1900, 700))

    result = segment(d.artefact(), None, DEFAULT)

    assert sorted(s.number.value for s in result.sheets if s.number) == ["01", "02", "03", "04"]
    assert result.counts["frame_holds_frames"] == 1


def test_a_box_around_one_frame_is_not_a_sheet_the_frame_is() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (100, 100), {2: "07"})
    d.entity("LWPOLYLINE", rectangle(0, 0, W + 400, H + 300))

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.box is not None
    assert sheet.location.box.x0 == pytest.approx(100)
    assert result.counts["frame_box_around_frame"] == 1


def test_a_frame_inside_a_frame_is_one_sheet() -> None:
    """A frame block inserted inside another frame's drawing area, and a frame block inserting
    itself: one sheet, the outer, with placement's limits on the loop."""
    d = Sheets()
    outer = frame_block(d, "OUTER")
    inner = frame_block(d, "INNER")
    d.insert(inner, (50, 50, 0), scale=(0.5, 0.5, 0.5), owner=outer)
    d.insert(outer, (0, 0, 0), owner=outer)  # the block inserts itself
    placed_frame(d, outer, (0, 0), {2: "S-40"})

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.number is not None
    assert sheet.number.value == "S-40"
    assert result.counts["frame_inside_frame"] >= 1
    assert result.counts["walk_loop"] >= 1


def test_a_frame_drawn_twice_in_one_place_is_one_sheet() -> None:
    d = Sheets()
    block = frame_block(d)
    d.insert(block, (0, 0, 0))
    placed_frame(d, block, (0, 0), {2: "S-02"})

    result = segment(d.artefact(), None, DEFAULT)

    assert len(result.sheets) == 1
    assert result.counts["frame_inside_frame"] == 1


def test_a_cover_with_no_title_block_is_kept_proposed_out_as_cover_index() -> None:
    d = Sheets()
    block = frame_block(d)
    for i in range(2):
        placed_frame(d, block, (1000 * (i + 1), 0), {2: f"0{i + 1}"})
    d.entity("LWPOLYLINE", rectangle(0, 0, 0.6 * W, 0.6 * H))
    d.entity("LWPOLYLINE", rectangle(10, 10, 0.6 * W - 10, 0.6 * H - 10))
    for i, line in enumerate(("RIVERSIDE HOMES", "STRUCTURAL DRAWINGS", "PREPARED FOR A CLIENT")):
        d.text(line, (40, 200 - 30 * i, 0), height=12.0)
    d.entity("LWPOLYLINE", rectangle(-3000, 0, -3000 + 0.6 * W, 40))  # a strip: no sheet's shape
    d.text("NOTE", (-2990, 10, 0))

    result = segment(d.artefact(), None, DEFAULT)

    covers = [s for s in result.sheets if s.number is None]
    assert len(result.sheets) == 3
    assert len(covers) == 1
    assert covers[0].location.box is not None
    assert covers[0].location.box.x1 == pytest.approx(0.6 * W)
    assert covers[0].title is None
    # A plain rectangle of text may be a cover or a box of notes: kept, never counted as a sheet (#162).
    assert covers[0].exclusion == Exclusion(ExclusionReason.COVER_INDEX)
    assert all(s.exclusion is None for s in result.sheets if s.number is not None)
    assert result.counts["cover"] == 1
    assert result.counts["cover_proposed_out"] == 1


def test_a_contents_sheet_written_as_one_text_of_many_lines_is_a_cover() -> None:
    d = Sheets()
    block = frame_block(d)
    for i in range(2):
        placed_frame(d, block, (1000 * (i + 1), 0), {2: f"0{i + 1}"})
    d.entity("LWPOLYLINE", rectangle(0, 0, 0.6 * W, 0.6 * H))
    d.text("CONTENTS\\PFOUNDATIONS\\PFRAME\\PFINISHES", (40, 300, 0), kind="MTEXT", height=12.0)

    result = segment(d.artefact(), None, DEFAULT)

    assert result.counts["cover"] == 1
    assert len(result.sheets) == 3


def test_a_boxed_note_inside_a_sheet_is_no_cover() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "01"})
    d.entity("LWPOLYLINE", rectangle(50, 50, 350, 250))
    for i in range(4):
        d.text(f"NOTE {i}", (60, 200 - 20 * i, 0))

    assert len(find(d.artefact(), None, DEFAULT)) == 1


# Layouts -----------------------------------------------------------------------------------------------


def _viewport(
    d: Sheets, owner: str, view: tuple[float, float], number: int, height: float = 500.0
) -> None:
    d.entity(
        "VIEWPORT",
        {"center": [300.0, 300.0, 0.0], "width": 400.0, "height": 400.0, "id": number,
         "view_center_point": [view[0], view[1], 0.0], "view_height": height},
        owner=owner,
    )  # fmt: skip


def _main(d: Sheets, owner: str) -> None:
    d.entity(
        "VIEWPORT",
        {"center": [420.0, 297.0, 0.0], "width": 900.0, "height": 650.0, "id": 1,
         "view_center_point": [420.0, 297.0, 0.0], "view_height": 650.0},
        owner=owner,
    )  # fmt: skip


def test_a_layout_whose_viewport_shows_model_space_is_a_sheet_read_from_its_title_block() -> None:
    d = Sheets()
    for i in range(5):
        d.line((10 * i, 0), (10 * i, 100))
    sheet_tab = d.layout("S-101")
    _main(d, sheet_tab)
    _viewport(d, sheet_tab, (20.0, 50.0), 2)
    frame = frame_block(d)
    d.insert(frame, (0, 0, 0), owner=sheet_tab)
    d.text("S-101", value_at(2), owner=sheet_tab)
    d.text("PILE LAYOUT PLAN", value_at(0), owner=sheet_tab)

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.location.layout == "S-101"
    assert sheet.number == Sourced("S-101", ValueSource.TITLE_BLOCK_TEXT)
    assert sheet.title is not None
    assert sheet.title.value == "PILE LAYOUT PLAN"
    assert sheet.exclusion is None
    assert isinstance(sheet.anchors[0], DwgAnchor)
    assert sheet.anchors[0].sheet == "S-101"


def test_a_layout_whose_viewports_show_nothing_is_proposed_out_as_blank_with_no_value() -> None:
    """A stale layout: a template's title block over an empty region of model space is proposed out
    as blank, carrying none of the template's values (the QS review, Q7)."""
    d = Sheets()
    for i in range(5):
        d.line((10 * i, 0), (10 * i, 100))
    stale = d.layout("Layout9")
    _main(d, stale)
    for i in range(4):
        _viewport(d, stale, (90_000.0 + 1000 * i, 50_000.0), 2 + i)
    d.insert(frame_block(d), (0, 0, 0), owner=stale)
    d.text("01", value_at(2), owner=stale)
    d.text("APPROVAL DRAWING", value_at(0), owner=stale)

    result = segment(d.artefact(), "electrical", DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.layout == "Layout9"
    assert sheet.exclusion == Exclusion(ExclusionReason.BLANK)
    assert (sheet.number, sheet.title, sheet.issue_date) == (None, None, None)
    assert result.counts["layout_blank"] == 1


def _paper_sheet(
    number: str | None,
    title: str | None,
    *,
    labels: tuple[str, ...] = ("SHEET TITLE", "SCALE", "SHEET NO", "DATE"),
    date: str | None = None,
) -> Sheets:
    """A layout drawn in paper space only (its main viewport, no other): a title block, its values
    as given, and notes enough to be more than a title block."""
    d = Sheets()
    tab = d.layout("Layout1")
    _main(d, tab)
    d.insert(frame_block(d, labels=labels), (0, 0, 0), owner=tab)
    for cell, value in ((2, number), (0, title), (3, date)):
        if value is not None:
            d.text(value, value_at(cell), owner=tab)
    for i in range(sheets.MIN_PAPER_CONTENT + 5):
        d.text(f"NOTE {i + 1}", (40, 400 - 12 * i, 0), owner=tab)
    return d


def _proposed_blank(result: sheets.Segmentation, name: str = "Layout1") -> None:
    """The layout is kept, proposed out as `blank` with no value read, and counted a template."""
    (sheet,) = result.sheets
    assert sheet.location.layout == name
    assert sheet.exclusion == Exclusion(ExclusionReason.BLANK)
    assert (sheet.number, sheet.title, sheet.issue_date) == (None, None, None)
    assert result.counts["layout_template"] == 1


def test_a_paper_layout_with_an_empty_title_block_is_a_template_proposed_out() -> None:
    """A stale template tab (#162): a title block with no value over notes, no viewport showing
    model space, is no live sheet: it is kept, proposed out as blank (the takeoff neither asks
    about it nor counts it), never dropped."""
    _proposed_blank(segment(_paper_sheet(None, None).artefact(), None, DEFAULT))


def test_a_paper_sheet_whose_labels_are_unknown_and_date_blank_is_kept_proposed_out() -> None:
    """The review's attack A: its number and title under words the conventions lack, its date cell
    blank: nothing read is not empty, so it is kept (proposed out), never dropped."""
    labels = ("DESCRIPTION", "SCALE", "DRAWING REF", "DATE")
    d = _paper_sheet("A-901", "GENERAL NOTES", labels=labels)

    _proposed_blank(segment(d.artefact(), None, DEFAULT))


def test_a_paper_sheet_whose_values_are_stroked_is_kept_proposed_out() -> None:
    """The review's attack B: its number and title drawn as strokes, not text."""
    d = _paper_sheet(None, None)
    for cell in (0, 2):
        x, y, _ = value_at(cell)
        for k in range(6):
            d.line((x + 4 * k, y), (x + 4 * k + 3, y + 5), owner="Layout1")

    _proposed_blank(segment(d.artefact(), None, DEFAULT))


def test_a_paper_sheet_whose_tab_is_named_by_its_number_stays_a_sheet() -> None:
    """The review's attack E: its title block not read, its tab named "S-901 GENERAL NOTES": a
    sheet, asked its number, as before #162."""
    d = Sheets()
    tab = d.layout("S-901 GENERAL NOTES")
    _main(d, tab)
    labels = ("DESCRIPTION", "SCALE", "DRAWING REF", "DATE")
    d.insert(frame_block(d, labels=labels), (0, 0, 0), owner=tab)
    d.text("S-901", value_at(2), owner=tab)
    for i in range(sheets.MIN_PAPER_CONTENT + 5):
        d.text(f"NOTE {i + 1}", (40, 400 - 12 * i, 0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.layout == "S-901 GENERAL NOTES"
    assert sheet.exclusion is None
    assert result.counts["layout_template"] == 0


def test_a_mark_from_the_file_name_does_not_fill_a_template() -> None:
    d = _paper_sheet(None, None)
    d.source_name = "KR-STR-R3.dwg"

    result = segment(d.artefact(), None, DEFAULT)

    _proposed_blank(result)
    assert result.counts["layout_blank"] == 1


def _titled_layout_with_viewport(view_height: float) -> Sheets:
    """A titled layout, its title block empty, whose one viewport looks at drawn model space."""
    d = Sheets()
    for i in range(10):
        d.line((1000.0 + 10 * i, 1000.0), (1000.0 + 10 * i, 1100.0))
    tab = d.layout("Layout1")
    _main(d, tab)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)
    _viewport(d, tab, (1050.0, 1050.0), 2, height=view_height)
    return d


def test_a_layout_showing_model_space_with_an_empty_title_block_stays_a_sheet() -> None:
    result = segment(_titled_layout_with_viewport(500.0).artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.exclusion is None
    assert result.counts["layout_template"] == 0


def test_a_layout_whose_viewport_cannot_be_read_with_an_empty_title_block_stays_a_sheet() -> None:
    result = segment(_titled_layout_with_viewport(0.0).artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.exclusion is None
    assert result.counts["layout_viewport_unknown"] == 1
    assert result.counts["layout_template"] == 0


def test_a_second_template_in_a_file_is_counted_for_the_qs() -> None:
    """One blank per file: a second is counted (`layout_blank_not_proposed`, a limit the QS is told),
    never dropped unseen."""
    d = _paper_sheet(None, None)
    tab = d.layout("Layout2")
    _main(d, tab)
    d.insert(frame_block(d, "SHEET2"), (0, 0, 0), owner=tab)
    for i in range(sheets.MIN_PAPER_CONTENT + 5):
        d.text(f"NOTE {i + 1}", (40, 400 - 12 * i, 0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert [s.exclusion for s in result.sheets] == [Exclusion(ExclusionReason.BLANK)]
    assert result.counts["layout_template"] == 2
    assert result.counts["layout_blank_not_proposed"] == 1
    assert "layout_blank_not_proposed" in sheets.LIMITS


@pytest.mark.parametrize(("number", "title"), [("S-901", None), (None, "GENERAL NOTES")])
def test_a_paper_layout_with_a_number_or_a_title_stays_a_sheet(
    number: str | None, title: str | None
) -> None:
    result = segment(_paper_sheet(number, title).artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.layout == "Layout1"
    assert sheet.exclusion is None
    assert (sheet.number and sheet.number.value, sheet.title and sheet.title.value) == (number, title)
    assert result.counts["layout_template"] == 0


def test_a_paper_sheet_whose_number_and_title_labels_are_unknown_stays_a_sheet() -> None:
    """The refuter's probe (#162): its number and title under words the conventions lack, its date
    read: a filled title block, so a sheet (asked its number), never a template dropped unseen."""
    d = _paper_sheet(
        "A-901", "GENERAL NOTES", labels=("DESCRIPTION", "SCALE", "DRAWING REF", "DATE"),
        date="12.08.2026",
    )  # fmt: skip

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.exclusion is None
    assert sheet.issue_date is not None
    assert result.counts["layout_template"] == 0


def test_a_paper_sheet_read_past_a_limit_is_never_dropped_as_a_template(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Past the pair budget its number is not read: the layout stays a sheet, the limit counted."""
    monkeypatch.setattr(sheets, "MAX_PAIRS", 0)

    result = segment(_paper_sheet("S-901", "GENERAL NOTES").artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.number is None
    assert result.counts["pair_budget"] > 0
    assert result.counts["layout_template"] == 0


def test_a_layout_with_only_its_main_viewport_is_no_sheet() -> None:
    d = Sheets()
    _main(d, PAPER)
    d.line((0, 0), (100, 0))

    result = segment(d.artefact(), None, DEFAULT)

    assert result.sheets == []
    assert result.counts["layout_empty"] == 1


def test_a_layout_plotting_a_model_space_frame_is_one_sheet_the_frame() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "S-05"})
    plot = d.layout("Plot")
    _main(d, plot)
    _viewport(d, plot, (W / 2, H / 2), 2, height=H * 1.2)

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.box is not None
    assert sheet.number is not None
    assert sheet.number.value == "S-05"
    assert result.counts["layout_plots_frames"] == 1


def test_a_layout_with_its_own_title_block_showing_one_frame_is_the_sheet() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "S-05"})
    tab = d.layout("S-05 (plot)")
    _main(d, tab)
    _viewport(d, tab, (W / 2, H / 2), 2, height=H * 1.2)
    d.insert(frame_block(d, "PAPER-FRAME"), (0, 0, 0), owner=tab)
    d.text("S-05", value_at(2), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.layout == "S-05 (plot)"
    assert result.counts["frame_plotted_by_layout"] == 1


# The Discipline, the revision mark, the anchors --------------------------------------------------------


def test_the_discipline_is_the_files_else_the_numbers_prefix() -> None:
    d = Sheets()
    block = frame_block(d)
    for i, number in enumerate(("S-01", "A-02", "X-03", "04")):
        placed_frame(d, block, (1000 * i, 0), {2: number})
    artefact = d.artefact()

    from_file = by_number(find(artefact, "plumbing", DEFAULT))
    from_prefix = by_number(find(artefact, None, DEFAULT))
    unknown_file = by_number(find(artefact, "landscape", DEFAULT))

    assert from_file["S-01"].discipline == Sourced("plumbing", ValueSource.FILE)
    assert from_prefix["S-01"].discipline == Sourced("structural", ValueSource.TITLE_BLOCK_TEXT)
    assert from_prefix["A-02"].discipline == Sourced("architectural", ValueSource.TITLE_BLOCK_TEXT)
    assert from_prefix["X-03"].discipline is None
    assert from_prefix["04"].discipline is None
    assert unknown_file["A-02"].discipline == Sourced("architectural", ValueSource.TITLE_BLOCK_TEXT)


@pytest.mark.parametrize(
    ("name", "mark"),
    [
        ("KR-01_STRUCTURAL WORKING DRAWING_R0.dwg", "R0"),
        ("ARCH-REV-3.dwg", "REV-3"),
        ("Structural Working Drawing_Final.dwg", None),
        ("..\\..\\sets\\old\\KR_R2.dwg", "R2"),
        ("../../etc/passwd", None),
        ("folder/sub/KR_R1.DWG", "R1"),
        ("bad\x00name_R4.dwg", None),
        ("x" * 10_000 + "_R5.dwg", None),
        ("", None),
    ],
)
def test_the_revision_mark_comes_else_from_the_file_name(name: str, mark: str | None) -> None:
    """ "R0, from the file name"; "Final" is not a mark; the name alone is read, never opened."""
    d = Sheets(source_name=name)
    placed_frame(d, frame_block(d), (0, 0), {2: "S-01"})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.revision_mark == (None if mark is None else Sourced(mark, ValueSource.FILE_NAME))


def test_a_title_block_revision_mark_comes_before_the_file_names() -> None:
    d = Sheets(source_name="KR_R0.dwg")
    block = frame_block(d, labels=("SHEET NO", "REV"))
    placed_frame(d, block, (0, 0), {0: "S-01", 1: "R3"})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.revision_mark == Sourced("R3", ValueSource.TITLE_BLOCK_TEXT)


def test_a_sheets_anchors_are_its_frame_then_each_values_text() -> None:
    d = Sheets()
    insert = placed_frame(d, frame_block(d), (0, 0), {0: "GROUND FLOOR PLAN", 2: "A-02"})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    frame, *values = sheet.anchors
    assert isinstance(frame, DwgAnchor)
    assert frame.sheet == MODEL_SHEET + insert
    assert frame.handle == insert
    assert frame.inserts == ()
    assert len(values) == 2
    assert all(isinstance(a, DwgAnchor) and a.sheet == MODEL_SHEET + insert for a in values)


def test_a_model_sheets_key_holds_a_slash_no_layout_name_can() -> None:
    """14's resolve treats the key as opaque; its "/" keeps it apart from every layout's name."""
    d = Sheets()
    outer = d.block("GROUP")
    frame = frame_block(d)
    nested = d.insert(frame, (0, 0, 0), owner=outer)
    group = d.insert(outer, (5000, 0, 0))
    x, y, _ = chain_transform(chain(d.artefact(), [group, nested])).apply(value_at(2))
    d.text("S-09", (x, y, 0))

    (sheet,) = find(d.artefact(), None, DEFAULT)

    anchor = sheet.anchors[0]
    assert isinstance(anchor, DwgAnchor)
    assert anchor.sheet == f"{MODEL_SHEET}{group}/{nested}"
    assert anchor.inserts == (group,)


# The judgement request ---------------------------------------------------------------------------------


def test_the_sheet_type_request_offers_the_disciplines_kinds_with_code_facts() -> None:
    sheet = SheetCandidate(
        SheetLocation(layout="L"),
        number=Sourced("S-12", ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced("PILE CAP LAYOUT PLAN", ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced("structural", ValueSource.FILE),
    )

    request = sheets.judgement(sheet, ("PILE CAP LAYOUT", "SECTION A-A"))

    assert request is not None
    assert request.node == "sheet_type"
    assert request.options == DEFAULT.kinds("structural")
    assert "pile_cap_layout" in request.options
    assert request.options[-3:] == ("cover_index", "general_notes", "other")
    assert dict(request.facts) == {
        "title": "PILE CAP LAYOUT PLAN",
        "discipline": "structural",
        "view_titles": '["PILE CAP LAYOUT", "SECTION A-A"]',
    }


def test_the_request_always_gives_the_three_facts_the_node_takes_and_no_number() -> None:
    """The ruling with 15 (review round 1): exactly `title` ("" when none), `discipline` and
    `view_titles` (a JSON array's text, "[]" when none); 15 refuses any other fact as a bad question."""
    numbered = SheetCandidate(
        SheetLocation(layout="L"),
        number=Sourced("S-12", ValueSource.TITLE_BLOCK_TEXT),
        title=Sourced("BEAM LAYOUT", ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced("structural", ValueSource.FILE),
    )
    untitled = SheetCandidate(
        SheetLocation(layout="L"), discipline=Sourced("structural", ValueSource.FILE)
    )

    titled = sheets.judgement(numbered)
    viewed = sheets.judgement(untitled, ["BEAM LAYOUT", 'A "QUOTED" VIEW'])

    assert titled is not None
    assert viewed is not None
    assert dict(titled.facts) == {
        "title": "BEAM LAYOUT",
        "discipline": "structural",
        "view_titles": "[]",
    }
    assert viewed.facts["title"] == ""
    assert json.loads(viewed.facts["view_titles"]) == ["BEAM LAYOUT", 'A "QUOTED" VIEW']
    assert set(viewed.facts) == {"title", "discipline", "view_titles"}


def test_the_request_is_bounded_and_none_without_a_discipline_or_anything_to_judge() -> None:
    location = SheetLocation(layout="L")
    long = SheetCandidate(
        location,
        title=Sourced("X" * 5000, ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced("electrical", ValueSource.FILE),
    )
    request = sheets.judgement(long, [f"VIEW {i}" for i in range(100)])

    assert request is not None
    assert len(request.facts["title"]) == sheets.MAX_FACT
    views = json.loads(request.facts["view_titles"])
    assert len(views) == sheets.MAX_FACTS
    assert all(len(v) <= sheets.MAX_FACT for v in views)
    assert sheets.judgement(SheetCandidate(location, title=long.title)) is None
    assert sheets.judgement(SheetCandidate(location, discipline=long.discipline)) is None


def test_the_kinds_are_data_the_conventions_carry() -> None:
    sheet = SheetCandidate(
        SheetLocation(layout="L"),
        title=Sourced("ANY", ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced("landscape", ValueSource.FILE),
    )
    own = type(DEFAULT)(sheet_kinds={"landscape": ("planting_plan", "hardscape_plan")})

    request = sheets.judgement(sheet, conventions=own)

    assert request is not None
    assert request.options == ("planting_plan", "hardscape_plan")
