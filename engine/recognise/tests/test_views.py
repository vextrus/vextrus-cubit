"""17's views module on hand-built ReadArtefacts (no toolchain): invented frames and views, proving
mechanics only, never a reading (docs/sdlc.md)."""

import math
from dataclasses import replace

import numpy as np
import pytest

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, H, Sheets, W, frame_block, rectangle, value_at
from engine.recognise.types import (
    Box,
    Exclusion,
    ExclusionReason,
    Layer,
    SheetCandidate,
    StoreysMeaning,
    ViewCandidate,
    ViewKind,
)

CONVENTIONS = views.default_conventions()


def framed(d: Sheets, block: str, at: tuple[float, float], scale: float, values: dict[int, str]) -> str:
    """A frame insert in model space, its values written loose under their labels (13's reading)."""
    insert = d.insert(block, (at[0], at[1], 0.0), scale=(scale, scale, scale))
    placed = chain_transform(chain(d.artefact(), [insert]))
    for cell, text in values.items():
        x, y, _ = placed.apply(value_at(cell))
        d.text(text, (x, y, 0.0), height=5.0 * scale)
    return insert


def grid(d: Sheets, box: tuple[float, float, float, float], *, owner: str | None = None) -> None:
    """A view's drawing: a 4 x 4 grid of lines filling `box`."""
    x0, y0, x1, y1 = box
    extra = {} if owner is None else {"owner": owner}
    for i in range(5):
        x = x0 + (x1 - x0) * i / 4
        y = y0 + (y1 - y0) * i / 4
        d.line((x, y0), (x, y1), **extra)
        d.line((x0, y), (x1, y), **extra)


def model_sheet(
    drawn: list[tuple[str | None, tuple[float, float, float, float]]],
    *,
    scale: float = 50.0,
    title: str = "GENERAL ARRANGEMENT",
    number: str = "S-01",
    notes: tuple[tuple[str, tuple[float, float], float], ...] = (),
) -> tuple[Sheets, SheetCandidate]:
    """One frame at `scale` in model space (its lower-left corner at 10,000, 0), each view drawn at
    its paper box (mm) with its title 12 mm under it."""
    d = Sheets()
    block = frame_block(d)
    ox, oy = 10_000.0, 0.0
    framed(d, block, (ox, oy), scale, {0: title, 2: number})
    for view_title, (x0, y0, x1, y1) in drawn:
        grid(d, (ox + x0 * scale, oy + y0 * scale, ox + x1 * scale, oy + y1 * scale))
        if view_title is not None:
            d.text(view_title, (ox + x0 * scale, oy + (y0 - 12) * scale, 0.0), height=6.0 * scale)
    for text, (x, y), height in notes:
        d.text(text, (ox + x * scale, oy + y * scale, 0.0), height=height * scale)
    found = sheets.find(d.artefact(), "structural", DEFAULT)
    assert len(found) == 1
    return d, found[0]


def drawn(d: Sheets, sheet: SheetCandidate) -> list[ViewCandidate]:
    """The sheet's views but its title block (every framed sheet has one)."""
    return [
        v for v in views.find(d.artefact(), sheet, CONVENTIONS) if v.kind is not ViewKind.TITLE_BLOCK
    ]


def near(a: Box, b: tuple[float, float, float, float], by: float = 2.0) -> bool:
    return all(abs(p - q) <= by for p, q in zip(a.to_json(), b, strict=True))


# Boxes on paper ----------------------------------------------------------------------------------------


def test_a_model_space_views_box_is_on_paper_in_mm_from_the_frames_corner() -> None:
    d, sheet = model_sheet([("GROUND FLOOR BEAM LAYOUT PLAN", (40, 300, 340, 560))], scale=50.0)
    (view,) = drawn(d, sheet)
    assert view.kind is ViewKind.PLAN
    assert view.title == "GROUND FLOOR BEAM LAYOUT PLAN"
    assert near(view.box, (40, 288, 340, 560))


def test_a_frame_drawn_as_a_rectangle_takes_the_paper_that_makes_its_scale_round() -> None:
    """No insert to read the scale from: an A1 rectangle 100 times its size is at 1:100."""
    assert views._paper_scale(Sheets().artefact(), None, Box(0, 0, 84_100, 59_400)) == pytest.approx(100)
    assert views._paper_scale(Sheets().artefact(), None, Box(0, 0, 42_000, 29_700)) == pytest.approx(100)


def test_a_layout_sheets_views_seen_through_a_viewport_are_placed_on_its_paper() -> None:
    """A layout with a title block in paper space and a viewport showing model space at 1:100."""
    d = Sheets()
    block = frame_block(d)
    layout = d.layout("S-02")
    insert = d.insert(block, owner=layout)
    d.attrib(insert, "S-02", value_at(2), height=5.0)
    d.attrib(insert, "SLAB LAYOUT", value_at(0), height=5.0)
    # model space: a drawing 30 m by 20 m at the origin, its title under it
    grid(d, (0.0, 0.0, 30_000.0, 20_000.0))
    d.text("1ST FLOOR SLAB LAYOUT PLAN", (0.0, -1_200.0, 0.0), height=600.0)
    # a viewport 400 x 300 on paper centred at (250, 300), showing model (15000, 9000) at 1:100
    d.entity(
        "VIEWPORT",
        {"id": 2, "center": [250.0, 300.0, 0.0], "width": 400.0, "height": 300.0,
         "view_center_point": [15_000.0, 9_000.0, 0.0], "view_height": 30_000.0},
        owner=layout,
    )  # fmt: skip
    found = sheets.find(d.artefact(), "structural", DEFAULT)
    (sheet,) = [s for s in found if s.location.layout == "S-02"]
    (view,) = drawn(d, sheet)
    assert view.title == "1ST FLOOR SLAB LAYOUT PLAN"
    assert view.storeys == ("floor_1",)
    # model (0, 0) lands at (250 - 150, 300 - 90) on paper; the title's baseline 12 mm under it
    assert near(view.box, (100, 198, 400, 410))


def test_the_title_block_is_a_view_proposed_out_for_information_and_no_other_views() -> None:
    d, sheet = model_sheet([("COLUMN LAYOUT PLAN", (40, 300, 340, 560))], title="COLUMN LAYOUT PLAN")
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert [v.kind for v in found] == [ViewKind.PLAN, ViewKind.TITLE_BLOCK]  # last, out of the rows
    plan, block = found
    assert plan.title == "COLUMN LAYOUT PLAN"
    assert plan.box.x1 < 0.8 * W
    # the title-block strip, bounded by its ruled border and the frame's (frame_block)
    assert near(block.box, (0.8 * W, 0, W, H), by=0.5)
    assert block.title is None
    assert block.steps == ()
    assert block.part is None
    assert block.exclusion == Exclusion(ExclusionReason.FOR_INFORMATION)
    assert views.working_view(found) == 0


def test_a_title_block_ruled_in_pieces_is_bounded_by_its_nearest_rules() -> None:
    """A title block in the lower-right corner, its border drawn as loose lines in pieces, and a rule
    between its cells: its box is the corner the frame's and its rules bound, not a cell of it."""
    d = Sheets()
    block = d.block("CORNER", (0.0, 0.0, 0.0))
    d.entity("LWPOLYLINE", rectangle(0, 0, W, H), owner=block)
    for i, label in enumerate(("SHEET TITLE", "SCALE", "SHEET NO", "DATE")):
        d.text(label, (0.6 * W + 10.0, 180.0 - 40.0 * i, 0.0), height=3.0, owner=block)
    d.insert(block)
    d.line((0.6 * W, 0), (0.6 * W, 120))  # its left border in two pieces
    d.line((0.6 * W, 120), (0.6 * W, 200))
    d.line((0.6 * W, 200), (0.7 * W, 200))  # its top border in two pieces
    d.line((0.7 * W, 200), (W, 200))
    d.line((0.6 * W, 100), (W, 100))  # a rule between its cells
    d.text("GENERAL ARRANGEMENT", (0.6 * W + 12.0, 165.0, 0.0), height=5.0)
    d.text("S-01", (0.6 * W + 12.0, 85.0, 0.0), height=5.0)
    grid(d, (40, 300, 340, 560))
    d.text("BEAM LAYOUT PLAN", (40, 288, 0.0), height=6.0)
    d.text("DETAIL", (0.6 * W + 12.0, 120.0, 0.0), height=6.0)  # a loose word in the title block
    (sheet,) = sheets.find(d.artefact(), "structural", DEFAULT)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert [v.kind for v in found] == [ViewKind.PLAN, ViewKind.TITLE_BLOCK]
    assert near(found[1].box, (0.6 * W, 0, W, 200), by=0.5)
    assert found[0].title == "BEAM LAYOUT PLAN"
    assert found[0].box.x1 < 0.6 * W


def test_a_sheet_with_no_title_block_text_has_no_title_block_view() -> None:
    ruled = np.array([[0, 0, W, 0], [0, H, W, H], [0.8 * W, 0, 0.8 * W, H]], dtype=np.float64)
    paper = views._Paper((0.0, 0.0, W, H), ruled, [], frame=ruled)
    assert views._title_block(paper) is None


def test_a_view_with_no_title_is_a_plan_when_it_is_large_and_nothing_when_small() -> None:
    d, sheet = model_sheet([(None, (40, 300, 340, 560)), (None, (400, 40, 420, 60))])
    (view,) = drawn(d, sheet)
    assert view.kind is ViewKind.PLAN
    assert view.title is None
    assert view.storeys == ()


# What a view says --------------------------------------------------------------------------------------


def test_a_scale_on_the_titles_line_is_the_views_stated_scale() -> None:
    d, sheet = model_sheet(
        [("BEAM DETAIL", (40, 300, 340, 560)), ("STAIR SECTION", (400, 300, 640, 560))],
        notes=(("SCALE 1:20", (280, 288), 3.0), ("N.T.S.", (600, 288), 3.0)),
    )
    found = {v.title: v for v in drawn(d, sheet)}
    assert found["BEAM DETAIL"].stated_scale == "1:20"
    assert not found["BEAM DETAIL"].not_to_scale
    assert found["STAIR SECTION"].stated_scale == "N.T.S."
    assert found["STAIR SECTION"].not_to_scale


@pytest.mark.parametrize(
    ("title", "kind"),
    [
        ("TYPICAL BEAM SECTION DETAIL", ViewKind.DETAIL),  # the conventions' first-listed kind wins
        ("SECTION A-A", ViewKind.SECTION),
        ("KEY PLAN", ViewKind.KEY_PLAN),
        ("COLUMN SCHEDULE", ViewKind.SCHEDULE),
        ("FRONT ELEVATION", ViewKind.ELEVATION),
        ("3D VIEW", ViewKind.PERSPECTIVE),
        ("GENERAL NOTES", ViewKind.NOTES),
        ("SYMBOL LEGEND", ViewKind.LEGEND),
        ("PILE LAYOUT", ViewKind.PLAN),
        ("PILE CAP", None),
    ],
)
def test_a_titles_kind(title: str, kind: ViewKind | None) -> None:
    assert views._kind(title, views._reading(CONVENTIONS)) == kind


@pytest.mark.parametrize(
    ("title", "subject", "layer"),
    [
        ("PILE CAP LAYOUT PLAN", "pile_cap", None),
        ("PILE LAYOUT PLAN", "pile", None),
        ("1ST FLOOR SLAB REINFORCEMENT (TOP BARS)", "slab", Layer.TOP),
        ("ROOF SLAB BOTTOM REINFORCEMENT", "slab", Layer.BOTTOM),
        ("TOP FLOOR BEAM LAYOUT PLAN", "beam", None),  # "top floor" is a storey
        ("GROUND FLOOR PLAN", None, None),
    ],
)
def test_a_titles_subject_and_layer(title: str, subject: str | None, layer: Layer | None) -> None:
    reading = views._reading(CONVENTIONS)
    assert views._subject(title, reading) == subject
    assert views._layer(title, reading) == layer


def test_a_column_plans_storeys_run_floor_to_floor_and_a_beam_plans_are_at_floor_level() -> None:
    d, sheet = model_sheet(
        [
            ("COLUMN LAYOUT PLAN GROUND TO 3RD FLOOR", (40, 300, 340, 560)),
            ("2ND & 4TH FLOOR BEAM LAYOUT PLAN", (400, 300, 640, 560)),
        ]
    )
    column, beam = drawn(d, sheet)
    assert column.storeys == ("ground", "floor_1", "floor_2", "floor_3")
    assert column.storeys_meaning is StoreysMeaning.FLOOR_TO_FLOOR
    assert beam.storeys == ("floor_2", "floor_4")
    assert beam.storeys_meaning is StoreysMeaning.AT_FLOOR_LEVEL


# Reading order and the working view --------------------------------------------------------------------


def test_views_are_read_in_rows_top_to_bottom_each_left_to_right() -> None:
    d, sheet = model_sheet(
        [
            ("BEAM SCHEDULE", (40, 60, 340, 250)),
            ("SECTION 1-1", (400, 330, 640, 560)),
            ("BEAM LAYOUT PLAN", (40, 300, 340, 560)),
            ("BEAM DETAIL", (400, 60, 640, 230)),
        ]
    )
    titles = [v.title for v in drawn(d, sheet)]
    assert titles == ["BEAM LAYOUT PLAN", "SECTION 1-1", "BEAM SCHEDULE", "BEAM DETAIL"]


def view(kind: ViewKind, exclusion: Exclusion | None = None) -> ViewCandidate:
    return ViewCandidate(box=Box(0, 0, 1, 1), kind=kind, exclusion=exclusion)


def test_the_working_view_is_the_first_plan_not_proposed_out() -> None:
    out = Exclusion(ExclusionReason.FOR_INFORMATION)
    assert views.working_view([view(ViewKind.KEY_PLAN, out), view(ViewKind.SECTION)]) is None
    assert views.working_view([view(ViewKind.PLAN, out), view(ViewKind.PLAN)]) == 1
    assert views.working_view([]) is None


# What a view is proposed for ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("kind", "subject", "discipline", "steps", "part", "reason"),
    [
        (ViewKind.PLAN, "beam", "structural", ("beams",), None, None),
        (ViewKind.SCHEDULE, "column", "structural", ("columns",), None, None),
        (ViewKind.PLAN, "pile_cap", "structural", ("foundations",), None, None),
        (ViewKind.PLAN, None, "structural", (), None, None),
        (ViewKind.LEGEND, None, "structural", ("general_notes",), None, None),
        (ViewKind.LEGEND, None, "architectural", ("general_notes",), None, None),
        (ViewKind.LEGEND, None, "electrical", (), "electrical", None),
        (ViewKind.PLAN, None, "plumbing", (), "plumbing", None),
        (ViewKind.KEY_PLAN, None, "structural", (), None, ExclusionReason.FOR_INFORMATION),
        (ViewKind.PERSPECTIVE, None, "architectural", (), None, ExclusionReason.FOR_INFORMATION),
        (ViewKind.TITLE_BLOCK, None, "electrical", (), None, ExclusionReason.FOR_INFORMATION),
        (ViewKind.PLAN, "column", "architectural", (), None, ExclusionReason.DUPLICATE),
        (ViewKind.PLAN, "beam", "architectural", (), None, ExclusionReason.DUPLICATE),
        (ViewKind.PLAN, "fixture", "architectural", ("walls", "rooms"), "plumbing", None),
        (ViewKind.DETAIL, "toilet", "architectural", ("walls", "rooms"), "plumbing", None),
        (ViewKind.PLAN, "beam", None, (), None, None),
    ],
)
def test_a_views_proposal_by_its_discipline(
    kind: ViewKind,
    subject: str | None,
    discipline: str | None,
    steps: tuple[str, ...],
    part: str | None,
    reason: ExclusionReason | None,
) -> None:
    found_steps, found_part, exclusion = views._proposal(kind, subject, discipline)
    assert found_steps == steps
    assert found_part == part
    assert (exclusion.reason if exclusion else None) == reason


@pytest.mark.parametrize(
    ("kind", "subject", "discipline", "on_sheet", "steps"),
    [
        (ViewKind.SECTION, None, "structural", ("beam",), ("beams",)),
        (ViewKind.SECTION, None, "structural", ("slab",), ("slabs",)),
        (ViewKind.SCHEDULE, None, "structural", ("shear_wall",), ("columns",)),
        (ViewKind.DETAIL, None, "structural", ("pile",), ("foundations",)),
        (ViewKind.SECTION, None, "structural", ("column", "beam"), ("columns", "beams")),
        (ViewKind.SECTION, None, "structural", ("column", "shear_wall"), ("columns",)),
        (ViewKind.SECTION, "column", "structural", ("beam",), ("columns",)),  # its own title first
        (ViewKind.DETAIL, "opening", "structural", ("stair",), ("stairs",)),  # a subject of no Step
        (ViewKind.PLAN, "grid", "structural", (), ("grid",)),
        (ViewKind.PLAN, None, "structural", ("grid",), ("grid",)),
        (ViewKind.SECTION, None, "structural", (), ()),  # nothing names its subject: unaccounted
        (ViewKind.SECTION, None, "structural", ("toilet",), ()),
        (ViewKind.SECTION, None, "architectural", ("beam",), ("walls", "rooms")),
        (ViewKind.SECTION, None, None, ("beam",), ()),
    ],
)
def test_a_structural_view_naming_no_subject_takes_its_sheet_titles(
    kind: ViewKind,
    subject: str | None,
    discipline: str | None,
    on_sheet: tuple[str, ...],
    steps: tuple[str, ...],
) -> None:
    found_steps, part, exclusion = views._proposal(kind, subject, discipline, on_sheet)
    assert (found_steps, part, exclusion) == (steps, None, None)


def test_the_sheet_titles_subject_never_brings_back_a_view_proposed_out() -> None:
    for kind in (ViewKind.TITLE_BLOCK, ViewKind.KEY_PLAN, ViewKind.PERSPECTIVE):
        found_steps, _, exclusion = views._proposal(kind, None, "structural", ("beam",))
        assert found_steps == ()
        assert exclusion == Exclusion(ExclusionReason.FOR_INFORMATION)


def test_a_section_on_a_beam_sheet_is_proposed_for_beams_its_own_subject_kept_none() -> None:
    d, sheet = model_sheet([("SECTION 1-1", (40, 300, 340, 560))], title="BEAM DETAILS")
    (found,) = drawn(d, sheet)
    assert (found.kind, found.subject, found.steps) == (ViewKind.SECTION, None, ("beams",))


def test_a_section_on_a_sheet_whose_title_names_no_subject_is_proposed_for_nothing() -> None:
    d, sheet = model_sheet([("SECTION 9-9", (40, 300, 340, 560))], title="TYPICAL DETAILS")
    (found,) = drawn(d, sheet)
    assert (found.subject, found.steps, found.exclusion) == (None, (), None)


@pytest.mark.parametrize(
    ("kind", "steps"),
    [
        ("beam_details", ("beams",)),
        ("beam_layout", ("beams",)),
        ("column_schedule", ("columns",)),
        ("shear_wall_details", ("columns",)),
        ("pile_details", ("foundations",)),
        ("pile_cap_details", ("foundations",)),
        ("foundation_details", ("foundations",)),
        ("slab_layout", ("slabs",)),
        ("stair_details", ("stairs",)),
        ("tank_details", ("tanks",)),
        ("grid_layout", ("grid",)),
        ("details", ()),
        ("site_plan", ()),
        ("general_notes", ("general_notes",)),
    ],
)
def test_a_structural_sheet_kind_names_its_steps(kind: str, steps: tuple[str, ...]) -> None:
    assert views.kind_steps(kind, "structural") == steps


@pytest.mark.parametrize(
    ("title", "named"),
    [
        ("U.G.W.R DETAILS", {"tank"}),
        ("UGWR SECTION", {"tank"}),
        ("OVERHEAD WATER TANK DETAILS", {"tank"}),
        ("LINTEL & SUNSHADE DETAILS", {"beam", "slab"}),
        ("SECTION OF CHAJJA", {"slab"}),
    ],
)
def test_the_subject_words_of_tanks_lintels_and_sunshades(title: str, named: set[str]) -> None:
    assert views.subjects(title) == named


def test_a_detail_on_a_lintel_and_sunshade_sheet_goes_to_beams_and_slabs() -> None:
    on_sheet = views._subjects_in_order(
        "LINTEL, SUNSHADE & TYPICAL DETAILS", views._reading(CONVENTIONS)
    )
    steps, _, _ = views._proposal(ViewKind.DETAIL, None, "structural", on_sheet)
    assert steps == ("beams", "slabs")


def test_no_other_disciplines_sheet_kind_names_a_step() -> None:
    assert views.kind_steps("beam_details", "architectural") == ()
    assert views.kind_steps("beam_details", None) == ()


def test_every_structural_kind_but_the_general_ones_names_a_step() -> None:
    """The conventions' Structural kinds, each told a Step but those that name no subject."""
    kinds = sheets.default_conventions().sheet_kinds["structural"]
    told = {kind for kind in kinds if views.kind_steps(kind, "structural")}
    assert set(kinds) - told == {"site_plan", "details", "roof_structure_details"}


def test_steps_five_to_ten_are_proposed_for_structural_views_only() -> None:
    structural = {s for steps in views.STRUCTURAL_STEPS.values() for s in steps}
    for subject in views.STRUCTURAL_STEPS:
        steps, _, _ = views._proposal(ViewKind.PLAN, subject, "architectural")
        assert not set(steps) & structural, subject


# Hostile input -----------------------------------------------------------------------------------------


def test_the_grid_is_bounded_however_large_the_paper() -> None:
    """A frame rectangle a billion units wide is still a grid of at most `MAX_GRID` cells a side."""
    paper = views._Paper((0.0, 0.0, 1e9, 1e9), np.array([[0.0, 0.0, 1e9, 1e9]]), [])
    pieces = views._pieces(paper, [], ())
    assert len(pieces) == 1


def test_the_points_laid_on_the_grid_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(views, "MAX_SAMPLES", 1000)
    segments = np.array([[0.0, float(y), 400.0, float(y)] for y in range(0, 500, 5)])
    paper = views._Paper((0.0, 0.0, 841.0, 594.0), segments, [])
    assert views._pieces(paper, [], ())


def test_a_segment_not_finite_or_outside_is_clipped_away() -> None:
    segments = np.array([[-10.0, 5.0, 20.0, 5.0], [50.0, 50.0, 60.0, 60.0]])
    clipped = views._clip(segments, (0.0, 0.0, 10.0, 10.0))
    assert clipped.tolist() == [[0.0, 5.0, 10.0, 5.0]]


def test_pieces_join_across_diagonal_neighbours_and_part_across_a_gap() -> None:
    grid_ = np.zeros((5, 7), dtype=bool)
    grid_[0, 0] = grid_[1, 1] = True  # diagonal: one piece
    grid_[4, 6] = True  # apart
    labels, count = views._label(grid_)
    assert count == 2
    assert labels[0, 0] == labels[1, 1] != labels[4, 6]


def test_a_sheet_that_is_not_a_sheet_candidate_is_refused() -> None:
    with pytest.raises(TypeError):
        views.find(Sheets().artefact(), "S-01", CONVENTIONS)  # type: ignore[arg-type]


def test_a_layout_the_file_does_not_hold_has_no_views() -> None:
    from engine.recognise.types import SheetLocation

    sheet = SheetCandidate(location=SheetLocation(layout="NOT THERE"))
    assert views.find(Sheets().artefact(), sheet, CONVENTIONS) == []


def test_the_frame_rectangle_is_read_at_every_scale() -> None:
    for scale in (1.0, 20.0, 100.0):
        d, sheet = model_sheet([("BEAM LAYOUT PLAN", (40, 300, 340, 560))], scale=scale)
        (found,) = drawn(d, sheet)
        assert near(found.box, (40, 288, 340, 560)), (scale, found.box)
        assert math.isclose(found.box.x1 - found.box.x0, 300, abs_tol=2)


def test_a_divider_between_rows_of_views_joins_nothing() -> None:
    """A line ruled across the sheet between two rows of details: the rows stay two views each."""
    d, sheet = model_sheet(
        [
            ("SECTION 1-1", (40, 330, 300, 560)),
            ("SECTION 2-2", (400, 330, 640, 560)),
            ("SECTION 3-3", (40, 60, 300, 280)),
        ]
    )
    d.line((10_000.0 + 20 * 50, 284 * 50), (10_000.0 + 660 * 50, 284 * 50))  # 640 mm, 4 mm off a view
    found = drawn(d, sheet)
    assert [v.title for v in found] == ["SECTION 1-1", "SECTION 2-2", "SECTION 3-3"]
    assert near(found[2].box, (40, 48, 300, 280))


def test_a_view_with_no_title_takes_the_kind_its_sheet_title_names() -> None:
    d, sheet = model_sheet([(None, (40, 300, 340, 560))], title="COLUMN SCHEDULE")
    (found,) = drawn(d, sheet)
    assert found.kind is ViewKind.SCHEDULE


def test_every_walk_of_a_file_spends_one_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    """Three layouts of 40 lines each, a file budget of 50 visits: the layouts together read at most
    50 entities, never 50 each."""
    monkeypatch.setattr(views, "MAX_VISITS", 50)
    d = Sheets()
    layouts = [d.layout(f"L{i}") for i in range(3)]
    for layout in layouts:
        for i in range(40):
            d.line((float(i), 0.0), (float(i), 10.0), owner=layout)
    walker = views._Walker(d.artefact())
    read = sum(len(walker.walk(layout).segments) for layout in layouts)
    assert 0 < read <= 50
    assert walker.visits == 0


def test_the_pieces_a_sheet_is_read_by_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(views, "MAX_PIECES", 3)
    segments = np.array([[float(x), 10.0, float(x) + 5, 10.0] for x in range(0, 800, 40)])
    paper = views._Paper((0.0, 0.0, 841.0, 594.0), segments, [])
    reading = views._reading(CONVENTIONS)
    assert len(views._views(paper, reading, ViewKind.PLAN)) <= 3


def test_a_notes_line_naming_a_kind_is_no_view_title() -> None:
    """A numbered note, and a line of a column of notes, name a kind but title nothing."""
    notes = (
        ("3. REFER TO SCHEDULE K FOR EACH DETAIL MARK.", (400, 520), 6.0),
        ("ALL BARS SHALL BE LAPPED AT MID SPAN", (400, 510), 6.0),
        ("LAPS ARE SHOWN ON SECTION P-P ONLY", (400, 500), 6.0),
        ("CONCRETE COVER SHALL BE 40 MM", (400, 490), 6.0),
    )
    d, sheet = model_sheet([("BEAM LAYOUT PLAN", (40, 300, 340, 560))], notes=notes)
    titles = [v.title for v in drawn(d, sheet)]
    assert titles == ["BEAM LAYOUT PLAN"]


def test_an_underlined_title_far_under_its_drawing_is_the_drawings() -> None:
    """The title 40 mm under its plan (a scale line between), underlined: the underline is the
    title's, the plan its drawing."""
    d, sheet = model_sheet([(None, (40, 300, 340, 560))], notes=(("SCALE 1:100", (40, 280), 3.0),))
    ox, s = 10_000.0, 50.0
    d.text("GROUND FLOOR BEAM LAYOUT PLAN", (ox + 40 * s, 254 * s, 0.0), height=6.0 * s)
    d.line((ox + 40 * s, 252 * s), (ox + 220 * s, 252 * s))  # the underline
    found = drawn(d, sheet)
    (plan,) = [v for v in found if v.kind is ViewKind.PLAN]
    assert plan.title == "GROUND FLOOR BEAM LAYOUT PLAN"
    assert near(plan.box, (40, 252, 340, 560))
    assert len(found) == 1


# The refuter's attacks (review before the PR), each a test --------------------------------------------


def test_a_text_of_any_height_is_read_within_the_grid() -> None:
    """A note 1e300 tall raised out of `find` (np.linspace over its box); texts are now clipped rows."""
    d, sheet = model_sheet([("BEAM LAYOUT PLAN", (40, 300, 340, 560))])
    d.text("HUGE NOTE", (10_000.0 + 400 * 50, 100 * 50, 0.0), height=1e300)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert "BEAM LAYOUT PLAN" in [v.title for v in found]


def test_many_tall_texts_lay_at_most_the_sample_bound(monkeypatch: pytest.MonkeyPatch) -> None:
    """20,000 texts 40 mm tall took 2.9 GB and raised MemoryError: their points now share the bound."""
    laid: list[int] = []
    real = views._label

    def counting(grid_: np.ndarray) -> tuple[np.ndarray, int]:
        laid.append(int(grid_.sum()))
        return real(grid_)

    monkeypatch.setattr(views, "_label", counting)
    boxes = [
        (float(x), float(y), x + 30.0, y + 40.0) for x in range(0, 800, 10) for y in range(0, 550, 2)
    ]
    rows = views._text_rows(boxes, (0.0, 0.0, 841.0, 594.0), 2.0, 300)
    assert len(rows) <= views.MAX_SAMPLES
    words = [views._Text(None, (), b, 40.0, "X") for b in boxes[:2000]]  # type: ignore[arg-type]
    paper = views._Paper((0.0, 0.0, 841.0, 594.0), np.empty((0, 4)), words)
    assert views._pieces(paper, words, range(len(words)))
    assert laid


def test_a_layout_past_what_a_float_holds_has_no_views() -> None:
    """Two lines at -1e308 and +1e308: the paper's width is infinite; `find` raised on it."""
    from engine.recognise.types import SheetLocation

    d = Sheets()
    layout = d.layout("L1")
    d.line((-1e308, 0.0), (-1e308, 1.0), owner=layout)
    d.line((1e308, 0.0), (1e308, 1.0), owner=layout)
    d.line((0.0, 0.0), (1.0, 1.0), owner=layout)
    sheet = SheetCandidate(location=SheetLocation(layout="L1"))
    assert views.find(d.artefact(), sheet, CONVENTIONS) == []


def test_every_titled_detail_of_a_full_sheet_is_a_view() -> None:
    """Fourteen 50 mm details on an A1 at 1:1 gave six views: the paper's scale factor was shadowed by
    a loop's index, so the size bounds grew with each piece's number."""
    details: list[tuple[str | None, tuple[float, float, float, float]]] = []
    for i in range(14):
        x, y = 20 + (i % 7) * 90, 60 + (i // 7) * 250
        details.append((f"SECTION {i + 1}-{i + 1}", (x, y, x + 50 + i * 0.5, y + 50 + i * 0.5)))
    d, sheet = model_sheet(details, scale=1.0)
    found = drawn(d, sheet)
    assert sorted(v.title or "" for v in found) == sorted(t or "" for t, _ in details)


# Fix round 1 -------------------------------------------------------------------------------------------


def test_many_viewports_over_a_large_model_spend_one_file_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """200 viewports each showing the whole model took 119 s and 8.8 GB (review 1): each weighs the model
    against the file's one read budget, and a layout's viewports past `MAX_SHEET_VIEWPORTS` are left
    unread, both counted."""
    monkeypatch.setattr(views, "MAX_SCANS", 50_000)
    d = Sheets()
    layout = d.layout("S-09")
    for i in range(2_000):
        d.line((float(i * 10), 0.0), (float(i * 10), 10_000.0))
    for i in range(200):
        d.entity(
            "VIEWPORT",
            {"id": i + 2, "center": [400.0, 300.0, 0.0], "width": 700.0, "height": 500.0,
             "view_center_point": [10_000.0, 5_000.0, 0.0], "view_height": 10_000.0},
            owner=layout,
        )  # fmt: skip
    from engine.recognise.types import SheetLocation

    artefact = d.artefact()
    views._held.clear()
    views.find(artefact, SheetCandidate(location=SheetLocation(layout="S-09")), CONVENTIONS)
    walker = views._walker(artefact)
    assert walker.limits["viewports_capped"] == 200 - views.MAX_SHEET_VIEWPORTS
    assert walker.limits["scan_budget"] > 0
    assert 0 <= walker.scans < 50_000


def test_a_layout_frame_off_the_origin_gives_boxes_from_its_lower_left_corner() -> None:
    """The layout test above with the frame and its viewport moved by (1000, 500) on paper: the same
    boxes, measured from the frame's lower-left corner, and the frame's paper."""
    d = Sheets()
    block = frame_block(d)
    layout = d.layout("S-02")
    ox, oy = 1_000.0, 500.0
    insert = d.insert(block, (ox, oy, 0.0), owner=layout)
    at = value_at(2)
    d.attrib(insert, "S-02", (ox + at[0], oy + at[1], 0.0), height=5.0)
    grid(d, (0.0, 0.0, 30_000.0, 20_000.0))
    d.text("1ST FLOOR SLAB LAYOUT PLAN", (0.0, -1_200.0, 0.0), height=600.0)
    d.entity(
        "VIEWPORT",
        {"id": 2, "center": [ox + 250.0, oy + 300.0, 0.0], "width": 400.0, "height": 300.0,
         "view_center_point": [15_000.0, 9_000.0, 0.0], "view_height": 30_000.0},
        owner=layout,
    )  # fmt: skip
    (sheet,) = [s for s in sheets.find(d.artefact(), "structural", DEFAULT) if s.location.layout]
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    plan, _ = found
    assert near(plan.box, (100, 198, 400, 410))
    assert found.paper == pytest.approx((W, 594.0), abs=1.0)


def test_a_model_space_sheets_paper_is_its_frame_over_its_scale() -> None:
    d, sheet = model_sheet([("BEAM LAYOUT PLAN", (40, 300, 340, 560))], scale=50.0)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert found.paper == pytest.approx((W, 594.0))


def test_the_harness_takes_a_paper_only_as_two_finite_sizes() -> None:
    from engine import harness

    found = views.FoundViews()
    found.paper = (841.0, 594.0)
    assert harness._paper_of(found) == (841.0, 594.0)
    for bad in (None, (0.0, 1.0), (math.inf, 1.0), (1.0,), ("1", "2"), (True, 1.0)):
        found.paper = bad  # type: ignore[assignment]
        assert harness._paper_of(found) is None
    assert harness._paper_of([]) is None


def test_a_budget_cut_shows_in_the_views_report(monkeypatch: pytest.MonkeyPatch) -> None:
    """Review 2: a cut sheet exported `views: []` with no sign; the file's counts now come with every
    result, and the harness writes them into the file's export as `view_report`."""
    monkeypatch.setattr(views, "MAX_SCANS", 10)
    d, sheet = model_sheet([("BEAM LAYOUT PLAN", (40, 300, 340, 560))])
    views._held.clear()
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert list(found) == []
    assert found.limits == {"viewports_capped": 0, "scan_budget": 1, "read_budget": 0}


def test_a_sheet_read_in_full_reports_every_limit_at_zero() -> None:
    d, sheet = model_sheet([("BEAM LAYOUT PLAN", (40, 300, 340, 560))])
    views._held.clear()
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert found.limits == dict.fromkeys(views.LIMITS, 0)


def test_the_export_carries_the_files_view_report() -> None:
    from engine import export

    process = export.ProcessReport(export.ProcessStatus.OK, 0, None, 1.0, 1.0, 1)
    reading = export.FileReading(
        path="a.dwg", sha256="0" * 64, format="dwg", discipline_default=None, group="set",
        conventions_applied=None, process=process, stages={}, view_report={"scan_budget": 2},
    )  # fmt: skip
    assert export._file(reading, {})["view_report"] == {"scan_budget": 2}


# Session 07's loop: untitled pieces ----------------------------------------------------------------


def one_sheet(d: Sheets) -> SheetCandidate:
    """The A1 frame at 1:1 in model space around what `d` draws."""
    framed(d, frame_block(d), (0.0, 0.0), 1.0, {0: "GENERAL ARRANGEMENT", 2: "S-01"})
    (sheet,) = sheets.find(d.artefact(), "structural", DEFAULT)
    return sheet


def test_a_titles_scale_line_and_second_line_make_it_no_note() -> None:
    """A title, its scale line and a second title line in a column (three lines alike) is a title, its
    second line no view's."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 288, 0.0), height=6.0)
    d.text("NOT TO SCALE", (40, 279, 0.0), height=6.0)
    d.text("PRESENTATION PLAN", (40, 270, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, "GROUND FLOOR PLAN")]
    assert found[0].not_to_scale


def test_a_drawings_body_over_its_detached_row_is_one_view() -> None:
    """A plan whose row of grid marks, under it and apart from it, is what its title lies under."""
    d = Sheets()
    grid(d, (40, 330, 340, 560))
    grid(
        d, (40, 280, 120, 330)
    )  # a wing, one piece with the body: the body's box runs down past the row
    for x in (200, 250, 300):  # the detached row of grid marks
        d.entity("LWPOLYLINE", rectangle(x, 290, x + 26, 316))
    d.text("COLUMN LAYOUT PLAN", (200, 278, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, "COLUMN LAYOUT PLAN")]
    assert near(found[0].box, (40, 278, 340, 560))


def test_a_large_piece_inside_a_titled_drawings_box_is_that_drawings() -> None:
    d = Sheets()
    d.entity("LWPOLYLINE", rectangle(40, 200, 440, 530))  # the drawing's outline (no divider)
    grid(d, (120, 260, 360, 470))  # inside it, well apart from it
    d.text("PILE LAYOUT PLAN", (40, 188, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    assert [(v.kind, v.title) for v in found] == [(ViewKind.PLAN, "PILE LAYOUT PLAN")]


def test_a_title_inside_its_drawings_box_near_its_edge_is_the_drawings() -> None:
    """A section whose ground line runs under and past its title."""
    d = Sheets()
    grid(d, (40, 300, 340, 560))
    d.line((20, 290), (360, 290))  # the ground line
    d.line((40, 290), (40, 300))
    d.line((340, 290), (340, 300))
    d.text("SECTION A-A", (150, 292, 0.0), height=6.0)
    grid(d, (420, 300, 620, 560))
    d.line((400, 290), (640, 290))
    d.line((420, 290), (420, 300))
    d.text("SECTION B-B", (380, 292, 0.0), height=6.0)  # its start left of its drawing's box
    found = drawn(d, one_sheet(d))
    assert [(v.kind, v.title) for v in found] == [
        (ViewKind.SECTION, "SECTION A-A"),
        (ViewKind.SECTION, "SECTION B-B"),
    ]


def test_a_titles_second_line_titles_no_drawing_under_it() -> None:
    d = Sheets()
    grid(d, (40, 330, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 318, 0.0), height=6.0)
    d.text("PRESENTATION PLAN", (40, 308, 0.0), height=6.0)
    grid(d, (40, 200, 340, 290))  # an untitled drawing under the title's lines
    found = drawn(d, one_sheet(d))
    assert [v.title for v in found] == ["GROUND FLOOR PLAN", None]


def test_the_lines_a_title_block_is_bounded_by_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(views, "MAX_RULES", 50)
    lines = np.array([[0, y, 100, y] for y in range(1_000)], dtype=np.float64)
    assert len(views._rules(lines, 0, 0.1)) == 50
    assert len(views._rules(lines, 1, 0.1)) == 0  # none along y


def test_a_titled_drawing_takes_no_neighbour_that_is_not_its_body() -> None:
    """A titled section beside and under a larger drawing with no title (refuter, session 07): two
    views, the section no row of the other's."""
    d = Sheets()
    grid(d, (40, 330, 400, 560))  # the larger drawing, its title not read, with a wing down its left
    grid(d, (40, 215, 120, 330))
    grid(d, (200, 200, 400, 300))  # the section, inside the other's box, apart from its lines
    d.text("TANK SECTION", (200, 188, 0.0), height=6.0)
    found = drawn(d, one_sheet(d))
    assert sorted((v.title or "") for v in found) == ["", "TANK SECTION"]


def test_a_titles_second_line_is_in_its_views_box() -> None:
    d = Sheets()
    grid(d, (40, 330, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 318, 0.0), height=6.0)
    d.text("PRESENTATION PLAN", (40, 308, 0.0), height=6.0)
    (view,) = drawn(d, one_sheet(d))
    assert view.box.y0 <= 308.5


@pytest.mark.parametrize(
    ("text", "title"),
    [
        ("TYPICAL SECTION\\POF SHOWER", "TYPICAL SECTION OF SHOWER"),
        ("TYPICAL SECTION\\POF SHOWER\\PAND BASIN", None),  # three lines: a note's
    ],
)
def test_a_title_of_two_lines_at_most_is_a_title(text: str, title: str | None) -> None:
    d = Sheets()
    grid(d, (40, 330, 340, 560))
    d.text(text, (40, 318, 0.0), kind="MTEXT", height=6.0, attachment=1)
    (view,) = drawn(d, one_sheet(d))
    assert view.title == title


def test_a_titles_lines_under_it_are_in_its_views_box() -> None:
    """Its scale line and a smaller last line under it (refuter, session 07)."""
    d = Sheets()
    grid(d, (40, 330, 340, 560))
    d.text("GROUND FLOOR PLAN", (40, 318, 0.0), height=6.0)
    d.text("SCALE 1:100", (40, 308, 0.0), height=6.0)
    d.text("FOR APPROVAL ONLY", (40, 297, 0.0), height=4.0)
    (view,) = drawn(d, one_sheet(d))
    assert view.box.y0 <= 297.5


def test_a_notes_heading_keeps_its_lines() -> None:
    d = Sheets()
    grid(d, (40, 330, 340, 560))
    d.text("BEAM LAYOUT PLAN", (40, 318, 0.0), height=6.0)
    d.text("GENERAL NOTES", (400, 500, 0.0), height=6.0)
    for i, line in enumerate(("ALL DIMENSIONS IN MM", "CONCRETE GRADE AS SPECIFIED", "COVER 25 MM")):
        d.text(line, (400, 490 - 10 * i, 0.0), height=5.0)
    found = drawn(d, one_sheet(d))
    notes = [v for v in found if v.kind is ViewKind.NOTES]
    assert len(notes) == 1
    assert notes[0].box.y0 <= 470.5


# Fix round 1 of loop-views: a title block never eats the sheet ---------------------------------


def plan_on(d: Sheets) -> None:
    grid(d, (40, 300, 340, 560))
    d.text("GROUND FLOOR BEAM LAYOUT PLAN", (40, 288, 0.0), height=6.0)


def test_zone_marks_along_the_frames_border_are_no_title_blocks() -> None:
    """ISO 5457 zone marks inside the border (1 to 8 along the top, A to F down the left side)."""
    d = Sheets()
    block = frame_block(d)
    for i in range(8):
        d.text(str(i + 1), (40 + i * 100, H - 6, 0.0), height=3.0, owner=block)
    for i, mark in enumerate("ABCDEF"):
        d.text(mark, (3, 40 + i * 90, 0.0), height=3.0, owner=block)
    plan_on(d)
    sheet = one_sheet_of(d, block)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert [v.kind for v in found] == [ViewKind.PLAN, ViewKind.TITLE_BLOCK]
    assert near(found[1].box, (0.8 * W, 0, W, H), by=0.5)


def test_a_name_in_the_frames_far_corner_is_no_title_blocks() -> None:
    d = Sheets()
    block = frame_block(d)
    d.text("ACME CONSULTANTS", (20, H - 20, 0.0), height=5.0, owner=block)
    plan_on(d)
    sheet = one_sheet_of(d, block)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert [v.kind for v in found] == [ViewKind.PLAN, ViewKind.TITLE_BLOCK]
    assert near(found[1].box, (0.8 * W, 0, W, H), by=0.5)


def test_a_stepped_title_block_keeps_the_detail_beside_it() -> None:
    """A title block boxed at the lower right, a narrower revision table boxed on it."""
    d = Sheets()
    block = d.block("STEPPED", (0.0, 0.0, 0.0))
    d.entity("LWPOLYLINE", rectangle(0, 0, W, H), owner=block)
    d.entity("LWPOLYLINE", rectangle(0.6 * W, 0, W, 120), owner=block)
    d.entity("LWPOLYLINE", rectangle(0.8 * W, 120, W, 200), owner=block)
    d.text("REV", (0.8 * W + 5, 190, 0.0), height=3.0, owner=block)
    d.text("SHEET TITLE", (0.6 * W + 5, 110, 0.0), height=3.0, owner=block)
    d.text("SHEET NO", (0.6 * W + 5, 20, 0.0), height=3.0, owner=block)
    plan_on(d)
    grid(d, (60, 60, 300, 180))
    d.text("PILE CAP DETAIL", (60, 48, 0.0), height=6.0)
    d.insert(block)
    d.text("GENERAL ARRANGEMENT", (0.6 * W + 5, 100, 0.0), height=5.0)
    (sheet,) = sheets.find(d.artefact(), "structural", DEFAULT)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert [v.title for v in found if v.kind is not ViewKind.TITLE_BLOCK] == [
        "GROUND FLOOR BEAM LAYOUT PLAN",
        "PILE CAP DETAIL",
    ]
    (block_view,) = [v for v in found if v.kind is ViewKind.TITLE_BLOCK]
    assert near(block_view.box, (0.6 * W, 0, W, 120), by=0.5)


def test_a_title_block_covering_most_of_the_paper_is_not_read() -> None:
    """Two values 13 read at opposite corners, no ruled line between: the box would be the paper."""
    d, sheet = model_sheet([("BEAM LAYOUT PLAN", (40, 300, 340, 560))])
    paper = views._paper(d.artefact(), sheet)
    assert paper is not None
    first, second = (t for t in paper.block if t.placed.entity.handle in paper.values)
    apart = [
        replace(first, box=(10.0, 10.0, 20.0, 15.0)),
        replace(second, box=(W - 20, H - 15, W - 10, H - 10)),
    ]
    border = np.array([[0, 0, W, 0], [0, H, W, H], [0, 0, 0, H], [W, 0, W, H]], dtype=np.float64)
    spread = replace(paper, block=apart, frame=border, segments=np.empty((0, 4)))
    assert views._title_block(spread) is None
    assert views._title_block(paper) is not None


def one_sheet_of(d: Sheets, block: str) -> SheetCandidate:
    framed(d, block, (0.0, 0.0), 1.0, {0: "GENERAL ARRANGEMENT", 2: "S-01"})
    (sheet,) = sheets.find(d.artefact(), "structural", DEFAULT)
    return sheet


def plan_and_detail(d: Sheets, detail: tuple[float, float, float, float]) -> None:
    plan_on(d)
    grid(d, detail)
    d.text("PILE CAP DETAIL", (detail[0], detail[1] - 12, 0.0), height=6.0)


def read_block(d: Sheets) -> tuple[list[str | None], Box]:
    (sheet,) = sheets.find(d.artefact(), "structural", DEFAULT)
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    (block_view,) = [v for v in found if v.kind is ViewKind.TITLE_BLOCK]
    return [v.title for v in found if v.kind is not ViewKind.TITLE_BLOCK], block_view.box


def test_a_full_width_title_block_along_the_bottom_is_its_row() -> None:
    """A strip across the sheet's foot, its cells ruled apart: the frame's texts across, in its row."""
    d = Sheets()
    b = d.block("STRIP", (0.0, 0.0, 0.0))
    d.entity("LWPOLYLINE", rectangle(0, 0, W, H), owner=b)
    d.entity("LWPOLYLINE", rectangle(0, 0, W, 60), owner=b)
    for x in (180, 420, 660):
        d.line((x, 0), (x, 60), owner=b)
    d.entity("LWPOLYLINE", rectangle(20, 10, 80, 40), owner=b)  # a logo
    d.text("ACME CONSULTANTS", (90, 30, 0.0), height=5.0, owner=b)
    d.text("PROJECT", (190, 50, 0.0), height=3.0, owner=b)
    d.text("SHEET TITLE", (430, 50, 0.0), height=3.0, owner=b)
    d.text("SHEET NO", (670, 50, 0.0), height=3.0, owner=b)
    d.text("DATE", (670, 20, 0.0), height=3.0, owner=b)
    plan_and_detail(d, (400, 300, 700, 500))
    d.insert(b)
    d.text("GENERAL ARRANGEMENT", (430, 38, 0.0), height=5.0)
    d.text("S-01", (670, 38, 0.0), height=5.0)
    titles, box = read_block(d)
    assert titles == ["GROUND FLOOR BEAM LAYOUT PLAN", "PILE CAP DETAIL"]
    assert near(box, (0, 0, W, 60))


def test_a_title_block_beside_a_revision_table_in_the_far_corner_is_its_own() -> None:
    d = Sheets()
    b = d.block("REVTOP", (0.0, 0.0, 0.0))
    d.entity("LWPOLYLINE", rectangle(0, 0, W, H), owner=b)
    d.entity("LWPOLYLINE", rectangle(0.7 * W, 0, W, 120), owner=b)
    d.entity("LWPOLYLINE", rectangle(0.8 * W, H - 80, W, H), owner=b)
    d.text("REVISIONS", (0.8 * W + 5, H - 10, 0.0), height=3.0, owner=b)
    d.text("SHEET TITLE", (0.7 * W + 5, 110, 0.0), height=3.0, owner=b)
    d.text("SHEET NO", (0.7 * W + 5, 30, 0.0), height=3.0, owner=b)
    plan_and_detail(d, (0.72 * W, 200, 0.95 * W, 400))
    d.insert(b)
    d.text("GENERAL ARRANGEMENT", (0.7 * W + 5, 98, 0.0), height=5.0)
    d.text("S-01", (0.7 * W + 5, 18, 0.0), height=5.0)
    titles, box = read_block(d)
    assert titles == ["GROUND FLOOR BEAM LAYOUT PLAN", "PILE CAP DETAIL"]
    assert near(box, (0.7 * W, 0, W, 120))


def test_a_title_block_beside_frame_notes_along_the_foot_is_its_own() -> None:
    d = Sheets()
    b = d.block("LR2", (0.0, 0.0, 0.0))
    d.entity("LWPOLYLINE", rectangle(0, 0, W, H), owner=b)
    d.entity("LWPOLYLINE", rectangle(W - 180, 0, W, 60), owner=b)
    d.line((W - 90, 0), (W - 90, 60), owner=b)
    d.text("SHEET TITLE", (W - 175, 52, 0.0), height=3.0, owner=b)
    d.text("SHEET NO", (W - 85, 52, 0.0), height=3.0, owner=b)
    d.text("DRAWN", (W - 175, 20, 0.0), height=3.0, owner=b)
    d.text("CHECKED", (W - 85, 20, 0.0), height=3.0, owner=b)
    notes = ("DO NOT SCALE", "DIMENSIONS IN MILLIMETRES", "COPYRIGHT RESERVED", "RECYCLED PAPER")
    for i, note in enumerate(notes):
        d.text(note, (10 + 150 * i, 15, 0.0), height=2.5, owner=b)
    plan_and_detail(d, (400, 300, 700, 500))
    d.insert(b)
    d.text("GENERAL ARRANGEMENT", (W - 175, 40, 0.0), height=5.0)
    d.text("S-01", (W - 85, 40, 0.0), height=5.0)
    titles, box = read_block(d)
    assert titles == ["GROUND FLOOR BEAM LAYOUT PLAN", "PILE CAP DETAIL"]
    assert near(box, (W - 180, 0, W, 60))
