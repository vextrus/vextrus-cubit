"""Floods cost work in proportion to what the drawing holds (review round 1, finding 5): 100,000 frames
in a row took 895 s, 8,000 in a column ten times what they took in a row, 3,000 labels and 3,000 values
in one frame 15 s, 2,000 register headings 5 s. Each test counts operations (the index's work, frame
comparisons, label-value pairs weighed, headings read, frames weighed per viewport), never time.
"""

from collections.abc import Callable
from typing import Any

import pytest

from engine.read.artefact import ReadArtefact
from engine.recognise import register, sheets
from engine.recognise.sheets import segment
from engine.recognise.tests.drawing import DEFAULT, H, Sheets, W, frame_block, label_at, value_at
from engine.recognise.tests.test_sheets import placed_frame


@pytest.fixture
def index_work(monkeypatch: pytest.MonkeyPatch) -> Callable[[], int]:
    """The work every index built since the last call has done: nodes visited and points given."""
    made: list[Any] = []

    class Counted(sheets._Index):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, **kwargs)
            made.append(self)

    monkeypatch.setattr(sheets, "_Index", Counted)

    def spent() -> int:
        total = sum(int(index.work) for index in made)
        made.clear()
        return total

    return spent


def calls(monkeypatch: pytest.MonkeyPatch, owner: object, name: str) -> list[int]:
    """Count the calls of `owner.name` into the one-element list returned."""
    count = [0]
    original = getattr(owner, name)

    def counted(*args: Any, **kwargs: Any) -> Any:
        count[0] += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(owner, name, counted)
    return count


def frames(n: int, *, column: bool) -> ReadArtefact:
    d = Sheets()
    block = frame_block(d)
    for k in range(n):
        d.insert(block, (0.0, k * (H + 50), 0.0) if column else (k * (W + 50), 0.0, 0.0))
    return d.artefact()


@pytest.mark.parametrize("column", [False, True])
def test_frames_in_a_row_or_a_column_cost_index_work_in_proportion(
    column: bool, index_work: Callable[[], int]
) -> None:
    """A two-dimensional index: frames sharing an x range (a column) are found as cheaply as frames
    in a row; the work of twice the frames is about twice the work (a tree's logarithm aside)."""
    counts = []
    for n in (200, 400):
        result = segment(frames(n, column=column), None, DEFAULT)
        assert len(result.sheets) == n
        counts.append(index_work())

    assert counts[1] <= 2.5 * counts[0]


def test_a_row_and_a_column_of_frames_cost_the_same_index_work(index_work: Callable[[], int]) -> None:
    segment(frames(400, column=False), None, DEFAULT)
    row = index_work()
    segment(frames(400, column=True), None, DEFAULT)
    column = index_work()

    assert column <= 2 * row
    assert row <= 2 * column


def test_telling_a_titled_frame_from_a_cover_compares_no_frames(monkeypatch: pytest.MonkeyPatch) -> None:
    """`f in frames` compared every frame with every other: 200 million comparisons at 20,000 frames.
    Membership is by identity now."""
    compared = calls(monkeypatch, sheets._Frame, "__eq__")

    result = segment(frames(300, column=False), None, DEFAULT)

    assert len(result.sheets) == 300
    assert compared[0] == 0


def test_a_frame_flooded_with_labels_weighs_at_most_max_labels_against_each_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weighed = calls(monkeypatch, sheets, "_after")
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "S-01"}, scale=100.0)
    for k in range(500):
        d.text("SCALE", (1000.0 + (k % 50) * 400, 1000.0 + (k // 50) * 20, 0.0), height=2.5)
        d.text("X", (1000.0 + (k % 50) * 400 + 20, 1000.0 + (k // 50) * 20, 0.0), height=2.5)

    result = segment(d.artefact(), None, DEFAULT)

    assert len(result.sheets) == 1
    values = 500 + 1
    assert weighed[0] <= sheets.MAX_LABELS * values
    assert result.counts["frame_labels_capped"] == 1


def test_a_frame_flooded_with_values_weighs_at_most_max_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sheets, "MAX_VALUES", 100)
    weighed = calls(monkeypatch, sheets, "_after")
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "S-01"}, scale=100.0)
    for k in range(1000):
        d.text("X", (1000.0 + (k % 50) * 400, 1000.0 + (k // 50) * 20, 0.0), height=2.5)

    result = segment(d.artefact(), None, DEFAULT)

    assert len(result.sheets) == 1
    assert weighed[0] <= len(DEFAULT.title_block_fields) * 8 * 100
    assert result.counts["frame_values_capped"] == 1


def test_frames_stacked_on_the_same_texts_share_one_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    """Frames drawn over one another (none holding another) each read the texts under them: without a
    budget, 100 stacked frames over 1,000 texts weigh 100 times what one does. Past the space's
    budget of pairs (in proportion to its texts; made small here), a frame is read without its
    values, and that is counted; every frame is still a sheet."""
    monkeypatch.setattr(sheets, "MIN_PAIRS", 0)
    monkeypatch.setattr(sheets, "PAIRS_PER_TEXT", 8)
    weighed = calls(monkeypatch, sheets, "_after")
    d = Sheets()
    block = frame_block(d)
    for k in range(100):
        d.insert(block, (float(k), float(k), 0.0))
    for k in range(1000):
        d.text("X", (100.0 + (k % 40) * 10, 100.0 + (k // 40) * 10, 0.0), height=2.5)

    result = segment(d.artefact(), None, DEFAULT)

    texts = 1000 + 100 * 4
    assert len(result.sheets) == 100
    assert weighed[0] <= 8 * texts
    assert result.counts["read_budget"] >= 1


def test_a_sheet_flooded_with_headings_reads_at_most_max_headings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    read = calls(monkeypatch, register, "_lines")
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {2: "A-00"}, scale=100.0)
    for k in range(500):
        d.text(f"DRAWING LIST {k}", (1000.0 + (k % 50) * 500, 1000.0 + (k // 50) * 20, 0.0), height=2.5)
    artefact = d.artefact()

    register.find(artefact, sheets.find(artefact, None, DEFAULT))

    assert read[0] <= register.MAX_HEADINGS


def test_layouts_showing_many_frames_weigh_few_per_viewport(monkeypatch: pytest.MonkeyPatch) -> None:
    """Which frames a layout shows needs only whether it shows none, one or more: each viewport
    weighs at most two frames that it shows, and at most `MAX_WINDOW_FRAMES` in all."""
    d = Sheets()
    block = frame_block(d)
    for k in range(300):
        d.insert(block, (k * (W + 50), 0.0, 0.0))
    for k in range(100):
        tab = d.layout(f"L{k}")
        d.entity(
            "VIEWPORT",
            {"center": [400.0, 300.0, 0.0], "width": 800.0, "height": 500.0, "id": 2,
             "view_center_point": [150 * (W + 50), 0.0, 0.0], "view_height": 1e7},
            owner=tab,
        )  # fmt: skip
        d.text("SHEET NO", label_at(0), owner=tab)
        d.text("SCALE", label_at(1), owner=tab)
    weighed = calls(monkeypatch, sheets, "_box_share")

    result = segment(d.artefact(), None, DEFAULT)

    assert len(result.sheets) == 300 + 100
    assert weighed[0] <= 100 * 2


def test_a_value_is_still_read_where_a_label_names_it() -> None:
    """The caps never bind on a real title block (at most 21 labels and 442 texts in any frame of the
    real sets, measured): a frame's values are read as before."""
    d = Sheets()
    placed_frame(d, frame_block(d), (0, 0), {0: "BEAM LAYOUT PLAN", 2: "S-07"})

    (sheet,) = sheets.find(d.artefact(), None, DEFAULT)

    assert sheet.number is not None
    assert sheet.number.value == "S-07"
    assert value_at(2)[0] > label_at(2)[0]
