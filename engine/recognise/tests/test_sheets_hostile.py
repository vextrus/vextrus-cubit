"""The sheet finder's trust boundary: a ReadArtefact is hostile input (13's prompt, "Your trust
boundary"). Each attack asserts what is left (the candidates' fields, or the counts), not only that
nothing raised, by every route in: an attribute, TEXT, MTEXT and the file's name.
"""

import builtins
import contextlib
import math
import os
import pathlib
from collections.abc import Iterator
from dataclasses import replace

import pytest

from engine.geometry import placement
from engine.read.artefact import AnyEntity
from engine.recognise import sheets
from engine.recognise.sheets import MAX_FIELD, MAX_RAW_TEXT, find, segment
from engine.recognise.tests.drawing import (
    DEFAULT,
    Sheets,
    frame_block,
    label_at,
    rectangle,
    value_at,
)
from engine.recognise.tests.test_sheets import placed_frame
from engine.recognise.types import (
    Exclusion,
    ExclusionReason,
    SheetCandidate,
    SheetField,
    SheetLocation,
    Sourced,
    ValueSource,
)


@contextlib.contextmanager
def nothing_opened() -> Iterator[list[str]]:
    """Every way to open or follow a path raises, and is noted, while the block runs."""
    tried: list[str] = []

    def refuse(*args: object, **kwargs: object) -> None:
        tried.append(str(args[:1]))
        raise AssertionError(f"the sheet finder opened {args[:1]!r}")

    with pytest.MonkeyPatch.context() as patch:
        for owner, name in ((builtins, "open"), (os, "open"), (os, "stat"), (os, "readlink"),
                            (pathlib.Path, "open"), (pathlib.Path, "resolve")):  # fmt: skip
            patch.setattr(owner, name, refuse)
        yield tried


# Frames nested, looping, degenerate --------------------------------------------------------------------


def test_a_frame_rectangle_drawn_inside_a_frames_box_is_part_of_that_sheet() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "S-01"})
    d.entity("LWPOLYLINE", rectangle(50, 50, 400, 300))
    d.text("SHEET NO", (60, 280, 0))
    d.text("SCALE", (60, 270, 0))

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.number is not None
    assert sheet.number.value == "S-01"
    assert result.counts["frame_inside_frame"] == 1


@pytest.mark.parametrize(
    "scale",
    [
        (0.0, 1.0, 1.0),
        (1.0, 0.0, 1.0),
        (math.inf, 1.0, 1.0),
        (math.nan, math.nan, 1.0),
        (1e-320, 1e-320, 1.0),
    ],
)
def test_a_frame_insert_at_a_scale_of_0_or_not_finite_is_skipped_and_counted(
    scale: tuple[float, float, float],
) -> None:
    d = Sheets()
    block = frame_block(d)
    d.insert(block, (0, 0, 0), scale=scale)
    placed_frame(d, block, (5000, 0), {2: "S-02"})

    result = segment(d.artefact(), None, DEFAULT)

    assert [s.number.value for s in result.sheets if s.number] == ["S-02"]
    assert result.counts["frame_degenerate"] + result.counts["insert_degenerate"] >= 1


def test_a_frame_insert_lying_flat_with_a_z_scale_of_0_is_read() -> None:
    """10's reader met a Z scale of 0 on a real file: the frame lies flat in XY and is still a sheet."""
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "S-03"}, scale=1.0)
    insert = next(e for e in d.entities.values() if e.type == "INSERT")
    d.entities[insert.handle] = type(insert)(**{**insert.__dict__, "scale": (1.0, 1.0, 0.0)})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.number is not None
    assert sheet.number.value == "S-03"


@pytest.mark.parametrize("z", [0.0, 1.0])
def test_frames_inside_a_wrapper_lying_flat_at_a_z_scale_of_0_are_read(z: float) -> None:
    """Review round 1: three frames in a block inserted at scale (1, 1, 0) were all lost as singular
    (`frame_degenerate`), while the renderer drew them; 10's reader has met a Z scale of 0 on a real
    file. A frame is read from above: only its XY placement must be undoable."""
    d = Sheets()
    frame = frame_block(d)
    wrapper = d.block("WRAP")
    for k in range(3):
        d.insert(frame, (k * 1000.0, 0.0, 0.0), owner=wrapper)
        x, y, _ = value_at(2)
        d.text(f"S-0{k + 1}", (k * 1000.0 + x, y, 0.0), height=5.0, owner=wrapper)
    d.insert(wrapper, (0, 0, 0), scale=(1.0, 1.0, z))

    result = segment(d.artefact(), None, DEFAULT)

    assert [s.number.value if s.number else None for s in result.sheets] == ["S-01", "S-02", "S-03"]
    assert result.counts["frame_degenerate"] == 0


def test_a_frame_stood_on_its_edge_is_not_read() -> None:
    """Seen from above, a frame whose plane holds the Z axis is a line: its XY placement cannot be
    undone, and it is counted, never read."""
    d = Sheets()
    placed_frame(d, frame_block(d), (5000, 0), {2: "S-02"})
    d.insert(frame_block(d, "EDGE"), (0, 0, 0), extrusion=(1.0, 0.0, 0.0))

    result = segment(d.artefact(), None, DEFAULT)

    assert [s.number.value for s in result.sheets if s.number] == ["S-02"]
    assert result.counts["frame_degenerate"] == 1


def test_a_walk_stops_at_its_visit_budget_and_says_so(monkeypatch: pytest.MonkeyPatch) -> None:
    """Work is bounded by counted steps, never wall time, so 4 cores and 24 read alike."""
    monkeypatch.setattr(sheets, "MAX_VISITS", 50)
    d = Sheets()
    for i in range(200):
        d.line((i, 0), (i, 1))

    result = segment(d.artefact(), None, DEFAULT)

    assert result.counts["walk_visit_limit"] == 1
    assert result.sheets == []


# Layouts ----------------------------------------------------------------------------------------------


def test_thousands_of_layouts_are_read_in_linear_work_with_no_phantom(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """5,000 empty layouts and 5,000 holding only a title block: none is a sheet, model space is
    walked once, and the entities visited stay in proportion to the entities there are."""
    visits: list[int] = []
    walked: list[str] = []

    class Counted(placement.Walk):
        def entities(
            self, block: str, chain: placement.Chain = ()
        ) -> Iterator[tuple[AnyEntity, placement.Chain]]:
            if not chain:
                walked.append(block)
            yield from super().entities(block, chain)
            if not chain:
                visits.append(self.visits)

    monkeypatch.setattr(sheets, "Walk", Counted)
    d = Sheets()
    frame = frame_block(d)
    placed_frame(d, frame, (0, 0), {2: "S-01"})
    for i in range(5000):
        d.layout(f"Empty {i}")
    for i in range(5000):
        tab = d.layout(f"Titled {i}")
        d.insert(frame, (0, 0, 0), owner=tab)
    artefact = d.artefact()

    result = segment(artefact, None, DEFAULT)

    assert [s.number.value for s in result.sheets if s.number] == ["S-01"]
    assert len(result.sheets) == 1
    model = next(h for h, b in artefact.blocks.items() if b.layout == "Model")
    assert walked.count(model) == 1
    assert sum(visits) <= 3 * len(artefact.entities) + 100 * len(artefact.blocks)
    assert result.counts["layout_empty"] == 5001  # Layout1 too
    assert result.counts["layout_title_block_only"] == 5000


def _looking(d: Sheets, tab: str) -> None:
    """A viewport on `tab` looking at the lines the tests draw in model space."""
    view = {"center": [100.0, 100.0, 0.0], "width": 100.0, "height": 100.0, "id": 2,
            "view_center_point": [2.0, 0.5, 0.0], "view_height": 10.0}  # fmt: skip
    d.entity("VIEWPORT", view, owner=tab)


@pytest.mark.parametrize("name", ["", "   ", "\u200b\u202e", "\t\n"])
def test_a_layout_named_empty_or_invisible_is_left_out_and_counted(name: str) -> None:
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    tab = d.layout(name)
    _looking(d, tab)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert result.sheets == []
    assert result.counts["layout_unnamed"] == 1


def test_a_viewport_whose_values_the_reader_lost_is_not_taken_for_autocads_own() -> None:
    """The reader lost one viewport's values on a synthetic file: taken for the main viewport, its
    layout read as a title block alone and was dropped. The finder cannot tell what it shows, so the
    titled layout stays a sheet (review round 1: never proposed out as blank on a guess)."""
    d = Sheets()
    tab = d.layout("S-102")
    d.entity("VIEWPORT", {}, owner=tab)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.layout == "S-102"
    assert sheet.exclusion is None
    assert result.counts["viewport_unreadable"] == 1
    assert result.counts["layout_viewport_unknown"] == 1


def _titled(d: Sheets, name: str, viewport: dict[str, object]) -> str:
    """A layout with a frame, its number and title, and one viewport besides AutoCAD's own."""
    tab = d.layout(name)
    d.entity(
        "VIEWPORT",
        {"center": [420.0, 297.0, 0.0], "width": 900.0, "height": 650.0, "id": 1,
         "view_center_point": [420.0, 297.0, 0.0], "view_height": 650.0},
        owner=tab,
    )  # fmt: skip
    d.entity("VIEWPORT", {"id": 2, **viewport}, owner=tab)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)
    d.text("S-01", value_at(2), owner=tab)
    d.text("BEAM LAYOUT PLAN", value_at(0), owner=tab)
    return tab


EMPTY_REGION = {"center": [300.0, 300.0, 0.0], "width": 400.0, "height": 400.0,
                "view_center_point": [90_000.0, 50_000.0, 0.0], "view_height": 500.0}  # fmt: skip


@pytest.mark.parametrize(
    "lost",
    [
        {"view_center_point": None},
        {"width": 0.0},
        {"view_height": -1.0},
        {"center": None},
    ],
)
def test_a_titled_layout_whose_viewport_cannot_be_read_is_a_sheet_with_its_values(
    lost: dict[str, object],
) -> None:
    """Review round 1, finding 4: a viewport whose window is unknown cannot be told empty, so its
    titled layout is kept as a sheet and its values read; the same viewport, readable over an empty
    region, is proposed out as blank."""
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    _titled(d, "S-01", {k: v for k, v in {**EMPTY_REGION, **lost}.items() if v is not None})

    result = segment(d.artefact(), "structural", DEFAULT)

    (sheet,) = result.sheets
    assert sheet.exclusion is None
    assert sheet.number == Sourced("S-01", ValueSource.TITLE_BLOCK_TEXT)
    assert sheet.title == Sourced("BEAM LAYOUT PLAN", ValueSource.TITLE_BLOCK_TEXT)
    assert result.counts["viewport_unreadable"] == 1
    assert result.counts["layout_viewport_unknown"] == 1
    assert result.counts["layout_blank"] == 0


def test_a_titled_layout_past_the_viewport_budget_is_a_sheet_with_its_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sheets, "MAX_VIEWPORTS", 1)
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    _titled(d, "First", EMPTY_REGION)
    _titled(d, "Second", EMPTY_REGION)

    result = segment(d.artefact(), "structural", DEFAULT)

    first, second = result.sheets
    assert first.exclusion == Exclusion(ExclusionReason.BLANK)
    assert second.exclusion is None
    assert second.number == Sourced("S-01", ValueSource.TITLE_BLOCK_TEXT)
    assert result.counts["viewport_budget"] == 1
    assert result.counts["layout_viewport_unknown"] == 1


def test_an_untitled_layout_whose_viewport_cannot_be_read_is_no_sheet_and_is_counted() -> None:
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    tab = d.layout("Plot")
    d.entity("VIEWPORT", {"id": 2, "center": [0.0, 0.0, 0.0], "width": 100.0}, owner=tab)
    d.line((0, 0), (10, 0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert result.sheets == []
    assert result.counts["layout_shows_unknown"] == 1


def test_stale_layouts_propose_one_blank_and_count_the_rest() -> None:
    """Review round 1, finding 7: 5,000 stale layouts (a viewport over an empty region and two
    labels) gave 5,000 blank candidates, each a row 14 would store. The first in tab order is
    proposed out as blank; the rest are counted, never listed."""
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    for i in range(5000):
        tab = d.layout(f"Layout{i}")
        d.entity("VIEWPORT", {"id": 2, **EMPTY_REGION}, owner=tab)
        d.text("SHEET NO", (10.0, 10.0, 0.0), owner=tab)
        d.text("SCALE", (10.0, 20.0, 0.0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.location.layout == "Layout0"
    assert sheet.exclusion == Exclusion(ExclusionReason.BLANK)
    assert result.counts["layout_blank"] == 1
    assert result.counts["layout_blank_not_proposed"] == 4999


def test_a_layout_name_given_twice_is_read_once() -> None:
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    for _ in range(2):
        tab = d.layout("S-01")
        _looking(d, tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert [s.location.layout for s in result.sheets] == ["S-01"]
    assert result.counts["layout_repeated"] == 1


@pytest.mark.parametrize(
    "values",
    [
        {"center": [math.nan, 0.0, 0.0], "width": 100.0, "height": 100.0, "view_height": 10.0,
         "view_center_point": [2.0, 0.5, 0.0]},
        {"center": [0.0, 0.0, 0.0], "width": 1e300, "height": 1e300, "view_height": 1e-300,
         "view_center_point": [2.0, 0.5, 0.0]},
        {"center": [0.0, 0.0, 0.0], "width": 100.0, "height": 100.0, "view_height": math.inf,
         "view_center_point": [2.0, 0.5, 0.0]},
        {"center": [0.0, 0.0, 0.0], "width": 100.0, "height": 100.0, "view_height": 10.0,
         "view_center_point": [1e300, 1e300, 0.0]},
        {"center": [0.0, 0.0, 0.0], "width": 100.0, "height": 0.0, "view_height": 10.0,
         "view_center_point": [2.0, 0.5, 0.0]},
    ],
)  # fmt: skip
def test_a_viewport_with_values_not_finite_or_huge_is_skipped_and_counted(
    values: dict[str, object],
) -> None:
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    tab = d.layout("Broken")
    d.entity("VIEWPORT", {**values, "id": 2}, owner=tab)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert result.counts["viewport_unreadable"] == 1
    (sheet,) = result.sheets  # its window unknown, the titled layout stays a sheet (review round 1)
    assert sheet.exclusion is None


# Values: paths, huge texts, invisible numbers ----------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    ["../../etc/passwd", "C:\\Windows\\System32\\config", "file:///etc/shadow", "https://example.com/x"],
)
def test_a_title_block_value_holding_a_path_is_text_never_opened(path: str) -> None:
    d = Sheets()
    block = frame_block(d, attdefs=("SHEET_NO", "TITLE"))
    insert = placed_frame(d, block, (0, 0), {})
    d.attrib(insert, path, value_at(0), tag="TITLE")
    d.attrib(insert, path, value_at(2), tag="SHEET_NO")
    d.text(path, value_at(3), kind="MTEXT")
    artefact = d.artefact()

    with nothing_opened() as tried:
        (sheet,) = find(artefact, None, DEFAULT)

    assert tried == []
    assert sheet.title is not None
    assert sheet.title.value == path
    assert sheet.number is None  # a number holds a digit; a path is no number
    assert sheet.issue_date is None or sheet.issue_date.value != path


@pytest.mark.parametrize("route", ["attrib", "TEXT", "MTEXT"])
def test_a_megabyte_of_text_is_no_field_candidate(route: str) -> None:
    d = Sheets()
    block = frame_block(d, attdefs=("TITLE", "SCALE", "SHEET_NO"))
    insert = placed_frame(d, block, (0, 0), {0: "PILE LAYOUT PLAN"})
    huge = "S-" + "9" * (1 << 20)
    if route == "attrib":
        d.attrib(insert, huge, value_at(2), tag="SHEET_NO")
    else:
        d.text(huge, value_at(2), kind=route)

    result = segment(d.artefact(), None, DEFAULT)

    (sheet,) = result.sheets
    assert sheet.number is None
    assert sheet.title is not None
    assert sheet.title.value == "PILE LAYOUT PLAN"
    assert result.counts["text_too_long"] == 1


def test_a_value_one_past_its_bound_is_no_value() -> None:
    d = Sheets()
    title = "T" * (MAX_FIELD[SheetField.TITLE] + 1)
    placed_frame(
        d, frame_block(d), (0, 0), {0: title, 2: "S-" + "1" * (MAX_FIELD[SheetField.NUMBER] - 2)}
    )

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.title is None
    assert sheet.number is not None
    assert len(sheet.number.value) == MAX_FIELD[SheetField.NUMBER]
    assert MAX_FIELD[SheetField.TITLE] < MAX_RAW_TEXT


@pytest.mark.parametrize(
    "number", ["", "   ", "\u200b", "\ufeff\u202e", "\u202e\u200b\u2066\u2069", "-", "--"]
)
@pytest.mark.parametrize("route", ["attrib", "TEXT", "MTEXT"])
def test_a_number_empty_or_only_invisible_is_none_never_a_crash(number: str, route: str) -> None:
    d = Sheets()
    block = frame_block(d, attdefs=("TITLE", "SCALE", "SHEET_NO"))
    insert = placed_frame(d, block, (0, 0), {0: "ROOF PLAN"})
    if route == "attrib":
        d.attrib(insert, number, value_at(2), tag="SHEET_NO")
    else:
        d.text(number, value_at(2), kind=route)

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.number is None
    assert sheet.title is not None


@pytest.mark.parametrize(
    ("number", "prefix"),
    [("S-\u09e6\u09ef", "structural"), ("E-\uff10\uff15", "electrical"), ("A-2\u00b2", "architectural")],
)
def test_a_number_in_unicode_digits_is_read_and_its_prefix_names_the_discipline(
    number: str, prefix: str
) -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: number})

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.number is not None
    assert sheet.number.value == number
    assert sheet.discipline is not None
    assert sheet.discipline.value == prefix


@pytest.mark.parametrize(
    "name",
    ["..\\..\\x_R1.dwg", "a/b/c/../../KR_R2.dwg", "bad\x00_R3.dwg", "\u202eKR_R4.dwg", "R" * 10_000],
)
def test_a_file_name_is_read_as_a_name_only(name: str) -> None:
    d = Sheets(source_name=name)
    placed_frame(d, frame_block(d), (0, 0), {2: "S-01"})
    artefact = d.artefact()

    with nothing_opened() as tried:
        (sheet,) = find(artefact, None, DEFAULT)

    assert tried == []
    assert sheet.number is not None
    if sheet.revision_mark is not None:
        assert len(sheet.revision_mark.value) <= MAX_FIELD[SheetField.REVISION_MARK]
        assert "\x00" not in sheet.revision_mark.value
        assert "/" not in sheet.revision_mark.value


def test_huge_and_tiny_coordinates_do_not_crash_the_reading() -> None:
    d = Sheets()
    placed_frame(d, frame_block(d), (1e15, -1e15), {2: "S-01", 0: "BEAM LAYOUT"}, scale=1e6)
    placed_frame(d, frame_block(d, "TINY"), (0, 0), {2: "S-02"}, scale=1e-9)
    d.text("ORPHAN", (math.inf, 0.0, 0.0))

    result = segment(d.artefact(), None, DEFAULT)

    numbers = sorted(s.number.value for s in result.sheets if s.number)
    assert numbers == ["S-01", "S-02"]
    assert all(s.location.box is not None and math.isfinite(s.location.box.x1) for s in result.sheets)


# Control characters: 11's `decode` keeps NUL, ESC and DEL, and PostgreSQL refuses a NUL, so one such
# text made 14 store none of a file's sheets (review round 1). No value, fact or key holds a C0 control
# character or DEL; a tab is a space.

CONTROLS = "".join(chr(c) for c in (*range(0x20), 0x7F))


def _plain(value: str) -> None:
    assert not any(c in CONTROLS for c in value), repr(value)


@pytest.mark.parametrize("route", ["attrib", "TEXT", "MTEXT", "burst"])
def test_no_control_character_reaches_a_value_by_any_route(route: str) -> None:
    d = Sheets()
    title, number, date = "BEAM\x00LAYOUT\tPLAN\x1b\x7f", "S-\x0007\x01", "12.08.\x7f2026\x1f"
    if route == "attrib":
        insert = d.insert(frame_block(d, attdefs=("TITLE", "SHEET_NO", "DATE")), (0, 0, 0))
        for tag, text in (("TITLE", title), ("SHEET_NO", number), ("DATE", date)):
            d.attrib(insert, text, value_at(0), tag=tag)
    elif route == "burst":
        block = frame_block(d, labels=(), attdefs=("TITLE", "SCALE", "SHEET_NO", "DATE"))
        d.text("SCALE", label_at(5), owner=block)
        d.text("JOB NO", label_at(6), owner=block)
        placed_frame(d, block, (500, 0), {0: title, 2: number, 3: date}, kind="TEXT")
    else:
        placed_frame(d, frame_block(d), (0, 0), {0: title, 2: number, 3: date}, kind=route)

    (sheet,) = find(d.artefact(), None, DEFAULT)

    assert sheet.title is not None
    assert sheet.title.value == "BEAMLAYOUT PLAN"
    assert sheet.number is not None
    assert sheet.number.value == "S-07"
    assert sheet.issue_date is not None
    assert sheet.issue_date.value == "12.08.2026"


def test_no_control_character_reaches_a_revision_mark_from_the_file_name() -> None:
    own = replace(DEFAULT, revision_mark_pattern=r"_(R.{1,4})\Z")
    d = Sheets(source_name="KR_R\x1b2\x7f\x08.dwg")
    placed_frame(d, frame_block(d), (0, 0), {2: "S-01"})

    (sheet,) = find(d.artefact(), None, own)

    assert sheet.revision_mark == Sourced("R2", ValueSource.FILE_NAME)


def test_no_control_character_reaches_a_judgement_fact() -> None:
    sheet = SheetCandidate(
        SheetLocation(layout="L"),
        title=Sourced("BEAM\x00 LAYOUT\x7f", ValueSource.TITLE_BLOCK_TEXT),
        discipline=Sourced("structural", ValueSource.FILE),
    )

    request = sheets.judgement(sheet, ["SECTION\tA-A\x1b", "\x00\x01"])

    assert request is not None
    for fact in request.facts.values():
        _plain(fact)
    assert request.facts["title"] == "BEAM LAYOUT"
    assert request.facts["view_titles"] == '["SECTION A-A"]'


@pytest.mark.parametrize("name", ["PLOT\x00A", "PLOT\x1b", "\x7fPLOT"])
def test_a_layout_named_with_a_control_character_is_left_out_and_counted(name: str) -> None:
    """A layout's name is its sheet's key, which must name the layout exactly, so it is never cleaned:
    AutoCAD allows no control character in one, and a name holding one is left out, counted."""
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    tab = d.layout(name)
    _looking(d, tab)
    d.insert(frame_block(d), (0, 0, 0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert result.sheets == []
    assert result.counts["layout_name_unreadable"] == 1


def test_template_layouts_past_max_sheets_are_never_walked() -> None:
    """#162 round 2: each paper layout whose title block gave nothing is proposed out, not one per
    file, so a file of templates is bounded by `MAX_SHEETS` alone: past it, layouts are counted
    (`layouts_not_read`), never walked."""
    d = Sheets()
    for i in range(sheets.MAX_SHEETS + 100):
        tab = d.layout(f"Layout{i}")
        d.text("SHEET NO", (10.0, 10.0, 0.0), owner=tab)
        d.text("SCALE", (10.0, 20.0, 0.0), owner=tab)
        for j in range(sheets.MIN_PAPER_CONTENT + 1):
            d.line((100.0 + j, 0.0), (100.0 + j, 50.0), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert len(result.sheets) == sheets.MAX_SHEETS
    assert {s.exclusion for s in result.sheets} == {Exclusion(ExclusionReason.BLANK)}
    assert result.counts["layout_template"] == sheets.MAX_SHEETS
    assert result.counts["layouts_not_read"] == 100
