"""What one file can make the finder hold (review round 2): sheets per file, sheets from layouts that
cannot be told empty, placed texts and candidate frames per space, and frames stacked in one place.
Hostile files only (the real sets hold at most 87 sheets a file, 7,882 placed texts and 9,066
candidate frames a space); each test counts items, never time or bytes.
"""

from typing import Any

import pytest

from engine.recognise import sheets
from engine.recognise.sheets import segment
from engine.recognise.tests.drawing import DEFAULT, Sheets, W, frame_block, label_at, value_at


def row_of_frames(n: int) -> Sheets:
    d = Sheets()
    block = frame_block(d)
    for k in range(n):
        d.insert(block, (k * (W + 50), 0.0, 0.0))
    return d


def test_a_file_gives_at_most_max_sheets_and_counts_the_rest(monkeypatch: pytest.MonkeyPatch) -> None:
    """At 14's measured 8.5 ms a sheet, 1,000 sheets record in under 9 s; a titled frame costs about
    4 walk visits, so without a cap one file could give a million (review round 2, finding A). Past
    the cap no sheet's values are read."""
    read: list[int] = [0]
    model_sheet = sheets._Reader.model_sheet

    def counted(self: Any, *args: Any, **kwargs: Any) -> Any:
        read[0] += 1
        return model_sheet(self, *args, **kwargs)

    monkeypatch.setattr(sheets._Reader, "model_sheet", counted)

    result = segment(row_of_frames(sheets.MAX_SHEETS + 50).artefact(), None, DEFAULT)

    assert len(result.sheets) == sheets.MAX_SHEETS
    assert result.counts["sheets_capped"] == 50
    assert read[0] == sheets.MAX_SHEETS


def test_layouts_that_cannot_be_told_empty_become_few_sheets() -> None:
    """5,000 stale layouts whose viewport the reader lost became 5,000 live sheets, past the one-blank
    cap (review round 2, finding A): at most `MAX_UNKNOWN_LAYOUTS` such layouts are sheets; the rest
    are counted."""
    d = Sheets()
    for i in range(5):
        d.line((i, 0), (i, 1))
    for i in range(sheets.MAX_UNKNOWN_LAYOUTS + 50):
        tab = d.layout(f"Layout{i}")
        d.entity("VIEWPORT", {"id": 2}, owner=tab)
        d.text("SHEET NO", label_at(0), owner=tab)
        d.text("SCALE", label_at(1), owner=tab)

    result = segment(d.artefact(), None, DEFAULT)

    assert len(result.sheets) == sheets.MAX_UNKNOWN_LAYOUTS
    assert result.counts["layout_viewport_unknown"] == sheets.MAX_UNKNOWN_LAYOUTS
    assert result.counts["layout_viewport_unknown_capped"] == 50


def test_a_space_holds_at_most_max_texts_placed_texts(monkeypatch: pytest.MonkeyPatch) -> None:
    """Texts nested under inserts multiply: 1,117 entities placed a million texts at 1.34 GB (review
    round 2, finding B). A space places at most `MAX_TEXTS`, the rest counted; what it placed first
    is read as ever."""
    monkeypatch.setattr(sheets, "MAX_TEXTS", 500)
    held: list[int] = []
    space = sheets._Segmenter.space

    def recorded(self: Any, handle: str) -> Any:
        found = space(self, handle)
        held.append(len(found.texts))
        return found

    monkeypatch.setattr(sheets._Segmenter, "space", recorded)
    d = Sheets()
    frame = frame_block(d)
    d.insert(frame, (0.0, 0.0, 0.0))
    d.text("S-01", value_at(2))
    leaf = d.block("LEAF")
    for k in range(10):
        d.text("NOTE", (k * 10.0, 0.0, 0.0), owner=leaf)
    middle = d.block("MIDDLE")
    for k in range(100):
        d.insert(leaf, (0.0, k * 5.0, 0.0), owner=middle)
    for k in range(2):
        d.insert(middle, (10_000.0 + k * 200.0, 0.0, 0.0))

    result = segment(d.artefact(), None, DEFAULT)

    assert held == [500]
    assert result.counts["texts_capped"] == 4 + 1 + 2000 - 500
    (sheet,) = result.sheets
    assert sheet.number is not None
    assert sheet.number.value == "S-01"


def test_a_space_holds_at_most_max_frames_candidate_frames(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sheets, "MAX_FRAMES", 100)

    result = segment(row_of_frames(150).artefact(), None, DEFAULT)

    assert len(result.sheets) == 100
    assert result.counts["frames_capped"] == 50


def test_frames_stacked_in_one_place_are_one_sheet() -> None:
    """Frames past the read budget were kept unchecked, so 20,000 identical frames in one place gave
    21 sheets (review round 2): a frame drawn again where one was already decided is that one."""
    d = Sheets()
    block = frame_block(d)
    for _ in range(2000):
        d.insert(block, (0.0, 0.0, 0.0))

    result = segment(d.artefact(), None, DEFAULT)

    assert len(result.sheets) == 1
    assert result.counts["frame_inside_frame"] >= 1
