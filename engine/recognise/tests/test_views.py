"""17's views module on hand-built ReadArtefacts (no toolchain): invented frames and views, proving
mechanics only, never a reading (docs/sdlc.md)."""

import math

import numpy as np
import pytest

from engine.geometry.placement import chain, chain_transform
from engine.recognise import sheets, views
from engine.recognise.tests.drawing import DEFAULT, Sheets, W, frame_block, value_at
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


def near(a: Box, b: tuple[float, float, float, float], by: float = 2.0) -> bool:
    return all(abs(p - q) <= by for p, q in zip(a.to_json(), b, strict=True))


# Boxes on paper ----------------------------------------------------------------------------------------


def test_a_model_space_views_box_is_on_paper_in_mm_from_the_frames_corner() -> None:
    d, sheet = model_sheet([("GROUND FLOOR BEAM LAYOUT PLAN", (40, 300, 340, 560))], scale=50.0)
    (view,) = views.find(d.artefact(), sheet, CONVENTIONS)
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
    (view,) = views.find(d.artefact(), sheet, CONVENTIONS)
    assert view.title == "1ST FLOOR SLAB LAYOUT PLAN"
    assert view.storeys == ("floor_1",)
    # model (0, 0) lands at (250 - 150, 300 - 90) on paper; the title's baseline 12 mm under it
    assert near(view.box, (100, 198, 400, 410))


def test_the_frame_and_its_title_block_are_no_view() -> None:
    d, sheet = model_sheet([("COLUMN LAYOUT PLAN", (40, 300, 340, 560))], title="COLUMN LAYOUT PLAN")
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert [v.title for v in found] == ["COLUMN LAYOUT PLAN"]
    assert all(v.box.x1 < 0.8 * W for v in found)


def test_a_view_with_no_title_is_a_plan_when_it_is_large_and_nothing_when_small() -> None:
    d, sheet = model_sheet([(None, (40, 300, 340, 560)), (None, (400, 40, 420, 60))])
    (view,) = views.find(d.artefact(), sheet, CONVENTIONS)
    assert view.kind is ViewKind.PLAN
    assert view.title is None
    assert view.storeys == ()


# What a view says --------------------------------------------------------------------------------------


def test_a_scale_on_the_titles_line_is_the_views_stated_scale() -> None:
    d, sheet = model_sheet(
        [("BEAM DETAIL", (40, 300, 340, 560)), ("STAIR SECTION", (400, 300, 640, 560))],
        notes=(("SCALE 1:20", (280, 288), 3.0), ("N.T.S.", (600, 288), 3.0)),
    )
    found = {v.title: v for v in views.find(d.artefact(), sheet, CONVENTIONS)}
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
    column, beam = views.find(d.artefact(), sheet, CONVENTIONS)
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
    titles = [v.title for v in views.find(d.artefact(), sheet, CONVENTIONS)]
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
        (found,) = views.find(d.artefact(), sheet, CONVENTIONS)
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
    found = views.find(d.artefact(), sheet, CONVENTIONS)
    assert [v.title for v in found] == ["SECTION 1-1", "SECTION 2-2", "SECTION 3-3"]
    assert near(found[2].box, (40, 48, 300, 280))


def test_a_view_with_no_title_takes_the_kind_its_sheet_title_names() -> None:
    d, sheet = model_sheet([(None, (40, 300, 340, 560))], title="COLUMN SCHEDULE")
    (found,) = views.find(d.artefact(), sheet, CONVENTIONS)
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
