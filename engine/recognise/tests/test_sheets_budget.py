"""One budget for the whole file (review round 3): every walk of every space, the finder's and the
register's, spends one `FileBudget`, so no number of layouts or calls multiplies it; the register
holds one sheet's texts at a time; layouts past `MAX_SHEETS` are never read; and every limit is
reported, zero when not reached, so a file cut by one never reads as having no sheets without its
reason. Hostile shapes only; each test counts items or budget units, never time or bytes.
"""

from typing import Any

import pytest

from engine.read.artefact import ReadArtefact
from engine.recognise import register, sheets
from engine.recognise.sheets import LIMITS, FileBudget, find, segment
from engine.recognise.tests.drawing import DEFAULT, Sheets, frame_block, label_at, value_at


def layouts_of_nested_texts(layouts: int, texts: int = 1000) -> ReadArtefact:
    """`layouts` layout sheets, each a frame, its number and a viewport over model space, and a block
    placing `texts` nested texts (review round 3's attack, smaller)."""
    d = Sheets()
    leaf = d.block("LEAF")
    for k in range(10):
        d.text("NOTE", (k * 10.0, 0.0, 0.0), owner=leaf)
    heap = d.block("HEAP")
    for k in range(texts // 10):
        d.insert(leaf, (0.0, k * 5.0, 0.0), owner=heap)
    for k in range(5):
        d.line((k, 0), (k, 10))
    frame = frame_block(d)
    for n in range(layouts):
        tab = d.layout(f"P{n}")
        d.insert(frame, (0.0, 0.0, 0.0), owner=tab)
        d.text(f"S-{n + 1:02d}", value_at(2), owner=tab)
        d.insert(heap, (2000.0, 0.0, 0.0), owner=tab)
        d.entity(
            "VIEWPORT",
            {"center": [400.0, 300.0, 0.0], "width": 800.0, "height": 500.0, "id": 2,
             "view_center_point": [5.0, 5.0, 0.0], "view_height": 50.0},
            owner=tab,
        )  # fmt: skip
    return d.artefact()


def placed(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """The texts each walk of a space places, the finder's and the register's."""
    found: list[int] = []
    walk = sheets._Segmenter._walk

    def recorded(self: Any, handle: str, *, whole: bool) -> Any:
        walked = walk(self, handle, whole=whole)
        found.append(len(walked[0]))
        return walked

    monkeypatch.setattr(sheets._Segmenter, "_walk", recorded)
    return found


def test_every_walk_of_every_layout_spends_one_file_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    """Round 3: each layout had its own cap, so 40 layouts of 110,000 nested texts took 255 s and
    2.8 GB. The file's texts are one budget now, however many layouts spend it."""
    monkeypatch.setattr(sheets, "MAX_TEXTS", 2500)
    walked = placed(monkeypatch)

    result = segment(layouts_of_nested_texts(10), None, DEFAULT)

    assert sum(walked) == 2500
    assert result.counts["texts_capped"] == 10 * (1000 + 4 + 1) - 2500
    assert result.budget.texts == 0


def test_the_register_spends_what_the_finder_left(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sheets, "MAX_TEXTS", 5000)
    artefact = layouts_of_nested_texts(3)
    found = find(artefact, None, DEFAULT)
    left = found.budget.texts
    walked = placed(monkeypatch)

    register.find(artefact, found, budget=found.budget)

    assert left == 5000 - 3 * (1000 + 4 + 1)
    assert sum(walked) == left
    assert found.budget.texts == 0
    assert found.budget.report()["texts_capped"] == 3 * (1000 + 4 + 1) - left


def test_the_register_holds_one_sheets_texts_at_a_time(monkeypatch: pytest.MonkeyPatch) -> None:
    """Round 3: `texts_on` built every sheet's texts before the register read any, 1,000,000 texts
    for 10 layouts at once. It gives one sheet's at a time now: its first sheet walks one space."""
    artefact = layouts_of_nested_texts(5)
    found = find(artefact, None, DEFAULT)
    walked = placed(monkeypatch)

    each = sheets.texts_on(artefact, found, DEFAULT)
    first = next(each)

    assert first[0] == 0
    assert len(walked) == 1
    assert sum(1 for _ in each) == 4
    assert len(walked) == 5


def test_layouts_past_max_sheets_are_never_read(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sheets, "MAX_SHEETS", 3)
    walked = placed(monkeypatch)

    result = segment(layouts_of_nested_texts(10, texts=10), None, DEFAULT)

    assert len(result.sheets) == 3
    assert len(walked) == 1 + 3  # model space, then three layouts
    assert result.counts["layouts_not_read"] == 7


def test_every_limit_is_reported_zero_when_not_reached() -> None:
    d = Sheets()
    d.insert(frame_block(d), (0.0, 0.0, 0.0))
    d.text("S-01", value_at(2))

    report = find(d.artefact(), None, DEFAULT).budget.report()

    assert {name: report[name] for name in LIMITS} == dict.fromkeys(LIMITS, 0)
    assert report["frame"] == 1


def test_a_file_cut_by_a_limit_says_so(monkeypatch: pytest.MonkeyPatch) -> None:
    """Round 3: the file's one real frame after a flood of nested texts gave 0 sheets and no reason
    outside the finder; the report names the limit and how much it left out."""
    monkeypatch.setattr(sheets, "MAX_TEXTS", 500)
    d = Sheets()
    leaf = d.block("LEAF")
    for k in range(10):
        d.text("NOTE", (k * 10.0, 0.0, 0.0), owner=leaf)
    heap = d.block("HEAP")
    for k in range(10):
        d.insert(leaf, (0.0, k * 5.0, 0.0), owner=heap)
    for k in range(6):
        d.insert(heap, (k * 200.0, 0.0, 0.0))
    d.insert(frame_block(d), (0.0, -1000.0, 0.0))

    found = find(d.artefact(), None, DEFAULT)

    assert list(found) == []
    assert found.budget.report()["texts_capped"] == 600 + 4 - 500


def test_a_fresh_budget_is_the_files_whole_budget() -> None:
    budget = FileBudget()

    assert (budget.visits, budget.texts, budget.frames) == (
        sheets.MAX_VISITS,
        sheets.MAX_TEXTS,
        sheets.MAX_FRAMES,
    )
    assert (budget.reads.left, budget.pairs.left) == (sheets.MAX_READS, sheets.MAX_PAIRS)
    assert label_at(0) != value_at(0)
