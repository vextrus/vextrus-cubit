"""Ticket 24f, F5 (session 06's ruling): "Join on frame IoU >= 0.8 whenever the key sheet has a `frame`,
even when only one export sheet shares the layout." A layout sheet (no frame) still joins on its layout.

Invented keys and exports only.
"""

import re
from pathlib import Path

import pytest

from tools.scorer.tests.acceptance.t24s.runs import Place, export_sheet, key_sheet

FRAME = [0.0, 0.0, 1000.0, 700.0]
ELSEWHERE = [5000.0, 5000.0, 6000.0, 5700.0]  # IoU 0 with FRAME
IOU_0_7 = [0.0, 0.0, 1000.0, 490.0]  # 1000 x 490 over 1000 x 700


def total(output: str, name: str, n: int, of: int) -> bool:
    return (
        re.search(rf"(?im)^.*\b{re.escape(name)}\b.*(?<![\d/])\b{n} / {of}\b(?![\d/])", output)
        is not None
    )


def lone_sheet(place: Place, *, frame: list[float] | None, box: list[float]) -> None:
    place.write_keys(
        [key_sheet("Model", "QZ-901", "Invented first plan", "first floor", [], frame=frame)]
    )
    place.write_run([export_sheet("Model", "QZ-901", "Invented first plan", "first floor", [], box=box)])


@pytest.mark.parametrize("box", [ELSEWHERE, IOU_0_7], ids=["no-overlap", "iou-0.7"])
def test_a_lone_model_space_sheet_whose_frame_does_not_match_does_not_join(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], box: list[float]
) -> None:
    place = Place(tmp_path)
    lone_sheet(place, frame=FRAME, box=box)

    assert place.score() == 0
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "sheets", 0, 1), shown
    assert "the sheet missing" in shown, shown
    assert "extra sheets 1" in shown, shown


def test_a_lone_model_space_sheet_whose_frame_matches_joins(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    lone_sheet(place, frame=FRAME, box=[0.0, 0.0, 1000.0, 560.0])  # IoU 0.8

    assert place.score() == 0
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "sheets", 1, 1), shown
    assert "sheet 1 (layout Model): pass" in shown, shown


def test_a_layout_sheet_with_no_frame_still_joins_on_its_layout(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    lone_sheet(place, frame=None, box=ELSEWHERE)

    assert place.score() == 0
    output = capfd.readouterr()
    shown = output.out + output.err
    assert total(shown, "sheets", 1, 1), shown
