"""`register.find`: the drawing list drawn on a sheet, row by row (13).

Invented registers on hand-built sheets: with a header naming the columns, without one, turned a
quarter turn with its sheet, and on a layout; every entry's `sheet` the very object passed in.
"""

import math

import pytest

from engine.read.anchor import DwgAnchor
from engine.recognise import register
from engine.recognise.sheets import find
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, value_at
from engine.recognise.tests.test_sheets import placed_frame
from engine.recognise.types import Box, SheetCandidate, SheetLocation
from engine.render.fixtures.artefacts import MODEL

ROWS = (("A-00", "DRAWING LIST & NOTES", "NTS", "R0"), ("A-01", "SITE PLAN", "1:200", "R0"),
        ("A-02", "GROUND FLOOR PLAN", "1:100", "R1"))  # fmt: skip


def _draw_register(
    d: Sheets,
    origin: tuple[float, float],
    *,
    header: bool = True,
    rotation: float = 0.0,
    owner: str | None = None,
) -> None:
    """A register's heading, a header row and three rows, each row 8 below the one before, turned
    about `origin` by `rotation` degrees."""
    c, s = math.cos(math.radians(rotation)), math.sin(math.radians(rotation))

    def at(u: float, v: float) -> tuple[float, float, float]:
        return (origin[0] + u * c - v * s, origin[1] + u * s + v * c, 0.0)

    space = MODEL if owner is None else owner
    direction = (c, s, 0.0)
    d.text(
        "LIST OF DRAWINGS (ARCHITECTURAL)",
        at(0, 0),
        kind="MTEXT",
        height=5.0,
        direction=direction,
        owner=space,
    )
    top = -12.0
    if header:
        for u, label in ((0, "SHEET NO."), (30, "DRAWING TITLE"), (120, "SCALE"), (150, "REV.")):
            d.text(label, at(u, top), rotation_radians=math.radians(rotation), height=3.0, owner=space)
        top -= 8.0
    for i, row in enumerate(ROWS):
        for u, value in zip((0, 30, 120, 150), row, strict=True):
            d.text(
                value,
                at(u, top - 8.0 * i),
                rotation_radians=math.radians(rotation),
                height=3.0,
                owner=space,
            )
    d.text(
        "NOTES:",
        at(0, top - 8.0 * 3 - 60),
        rotation_radians=math.radians(rotation),
        height=3.0,
        owner=space,
    )
    d.text(
        "A-99 IS NOT A ROW",
        at(0, top - 8.0 * 3 - 68),
        rotation_radians=math.radians(rotation),
        height=3.0,
        owner=space,
    )


@pytest.mark.parametrize("rotation", [0.0, 90.0])
def test_a_register_under_its_heading_is_read_row_by_row(rotation: float) -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "A-00"}, rotation=rotation)
    x, y = (100.0, 500.0) if rotation == 0 else (-500.0, 100.0)
    _draw_register(d, (x, y), rotation=rotation)
    artefact = d.artefact()
    sheets = find(artefact, "architectural", DEFAULT)

    entries = register.find(artefact, sheets)

    assert [(e.number, e.title, e.revision_mark) for e in entries] == [
        ("A-00", "DRAWING LIST & NOTES", "R0"),
        ("A-01", "SITE PLAN", "R0"),
        ("A-02", "GROUND FLOOR PLAN", "R1"),
    ]
    assert all(e.sheet is sheets[0] for e in entries)
    assert all(len(e.anchors) == 3 for e in entries)
    key = sheets[0].anchors[0]
    assert isinstance(key, DwgAnchor)
    assert all(isinstance(a, DwgAnchor) and a.sheet == key.sheet for e in entries for a in e.anchors)
    boxes = [e.row_box for e in entries]
    assert all(isinstance(b, Box) for b in boxes)
    assert len({(b.x0, b.y0) for b in boxes}) == 3


def test_a_register_with_no_header_reads_each_rows_number_title_and_mark() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "A-00"})
    _draw_register(d, (100.0, 500.0), header=False)
    artefact = d.artefact()
    sheets = find(artefact, None, DEFAULT)

    entries = register.find(artefact, sheets)

    assert [(e.number, e.title, e.revision_mark) for e in entries] == [
        ("A-00", "DRAWING LIST & NOTES", "R0"),
        ("A-01", "SITE PLAN", "R0"),
        ("A-02", "GROUND FLOOR PLAN", "R1"),
    ]


def test_a_register_on_a_layout_is_read_in_paper_units() -> None:
    d = Sheets()
    for i in range(4):
        d.line((10 * i, 0), (10 * i, 50))
    tab = d.layout("A-00")
    view = {"center": [300.0, 300.0, 0.0], "width": 400.0, "height": 400.0, "id": 2,
            "view_center_point": [20.0, 25.0, 0.0], "view_height": 100.0}  # fmt: skip
    d.entity("VIEWPORT", view, owner=tab)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)
    d.text("A-00", value_at(2), owner=tab)
    _draw_register(d, (100.0, 500.0), owner=tab)
    artefact = d.artefact()
    sheets = find(artefact, None, DEFAULT)

    entries = register.find(artefact, sheets)

    assert [e.number for e in entries] == ["A-00", "A-01", "A-02"]
    assert entries[0].row_box.y0 < 500
    assert all(e.sheet is sheets[0] for e in entries)


def test_a_sheet_with_no_register_gives_no_entries_and_a_copy_of_a_sheet_is_not_it() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "A-00"})
    artefact = d.artefact()
    sheets = find(artefact, None, DEFAULT)

    assert register.find(artefact, sheets) == []
    assert register.find(artefact, []) == []


def test_a_sheet_made_without_anchors_still_reads_its_register() -> None:
    d = Sheets()
    _draw_register(d, (100.0, 500.0))
    bare = SheetCandidate(SheetLocation(box=Box(0, 0, 841, 594)))

    entries = register.find(d.artefact(), [bare])

    assert [e.number for e in entries] == ["A-00", "A-01", "A-02"]
    assert all(e.anchors == () for e in entries)
    assert all(e.sheet is bare for e in entries)


def test_a_register_is_read_to_its_bound() -> None:
    d = Sheets()
    d.text("DRAWING LIST", (0, 0, 0), height=5.0)
    for i in range(register.MAX_ROWS + 50):
        d.text(f"S-{i + 1}", (0, -10.0 - 8.0 * i, 0), height=3.0)
        d.text(f"SHEET {i + 1}", (30, -10.0 - 8.0 * i, 0), height=3.0)
    bare = SheetCandidate(SheetLocation(box=Box(-10, -8.0 * (register.MAX_ROWS + 60), 500, 10)))

    entries = register.find(d.artefact(), [bare])

    assert len(entries) == register.MAX_ROWS


def test_a_header_names_the_columns_wherever_the_heading_stands() -> None:
    """The heading over the table's right half, a note column beside it, and a sheet whose own title
    begins like a heading: the rows are the header's columns' texts only, read once."""
    d = Sheets()
    block = frame_block(d, labels=("SHEET TITLE", "SCALE", "SHEET NO"))
    placed_frame(d, block, (0, 0), {0: "DRAWING LIST & NOTES", 2: "A-00"})
    d.text("LIST OF DRAWINGS", (200, 500, 0), height=5.0)
    for u, label in ((0, "SHEET NO."), (40, "DRAWING TITLE"), (200, "SCALE"), (240, "REV.")):
        d.text(label, (u, 480, 0), height=3.0)
    for i, (number, title, scale, mark) in enumerate(ROWS):
        y = 470 - 8.0 * i
        for u, value in ((0, number), (40, title), (200, scale), (240, mark)):
            d.text(value, (u, y, 0), height=3.0)
        d.text(f"{i + 1}. ALL SIZES IN MILLIMETRES", (300, y, 0), height=3.0)
    artefact = d.artefact()
    sheets = find(artefact, None, DEFAULT)

    entries = register.find(artefact, sheets)

    assert [(e.number, e.title, e.revision_mark) for e in entries] == [
        ("A-00", "DRAWING LIST & NOTES", "R0"),
        ("A-01", "SITE PLAN", "R0"),
        ("A-02", "GROUND FLOOR PLAN", "R1"),
    ]


def test_a_list_of_two_numbered_lines_with_no_header_is_no_register() -> None:
    d = Sheets()
    d.text("DRAWING LIST", (0, 0, 0), height=5.0)
    d.text("S-01", (0, -10, 0), height=3.0)
    d.text("S-02", (0, -18, 0), height=3.0)
    bare = SheetCandidate(SheetLocation(box=Box(-10, -100, 500, 10)))

    assert register.find(d.artefact(), [bare]) == []
