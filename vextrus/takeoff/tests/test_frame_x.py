"""S25-D1 round 4 (#774; m0-screens 6.7): a sheet laid out in the drawing says where its frame sits
along its file's x axis (`x_mm`), so two copies in one file do not read alike in the copies table."""

from types import SimpleNamespace
from typing import Any, cast

import pytest

from vextrus.drawings import services as drawings
from vextrus.takeoff.services.step1 import _frame_x_mm
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    jev_says,
    proposals,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db


def sheet(location: dict[str, Any], unit: str) -> drawings.SheetView:
    return cast(drawings.SheetView, SimpleNamespace(location=location, drawing_unit=unit))


@pytest.mark.parametrize(
    ("location", "unit", "expected"),
    [
        ({"box": ["2460", "0", "3000", "800"]}, "ft", 2460 * 304.8),
        ({"box": [-1180, 0, 0, 1]}, "inch", -1180 * 25.4),
        ({"box": ["12500.5", "0", "1", "1"]}, "mm", 12500.5),
        ({"box": ["3", "0", "1", "1"]}, "m", 3000.0),
        ({"layout": "A-24", "box": None}, "mm", None),
        ({"layout": "A-24"}, "mm", None),
        ({"box": ["5", "0", "1", "1"]}, "", None),
        ({"box": ["NaN", "0", "1", "1"]}, "mm", None),
        ({"box": ["Infinity", "0", "1", "1"]}, "mm", None),
        ({"box": ["not a number", "0", "1", "1"]}, "mm", None),
        ({"box": []}, "mm", None),
    ],
)
def test_the_frames_x_is_its_boxs_x0_in_millimetres(
    location: dict[str, Any], unit: str, expected: float | None
) -> None:
    assert _frame_x_mm(sheet(location, unit)) == expected


def test_two_copies_laid_out_in_one_file_carry_different_frame_positions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    name = "KR-STR-R0.dwg"
    copies = [
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
    ]
    file_id = uploaded(qs_project.member, qs_project.project_id, name)
    run_job(qs_project.member, file_id, monkeypatch, readers({name: copies}))

    api = api_as(qs_project.member)
    xs = [p["x_mm"] for p in proposals(api, qs_project.project_id) if p["number"] == "S-02"]

    assert len(xs) == 2
    assert all(isinstance(x, float) for x in xs)
    assert xs[0] != xs[1]
