"""T-W334's group data beyond its acceptance: each group's id is its first sheet's, a decision never
splits a group (a group is what the drawings say), a series' runs told apart by marks. Invented
sheets read through 21c's fixtures, Jev offline."""

import uuid

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
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

STRUCTURAL = "QX-STR-R0.dwg"
DOORS = "DOOR D2-D5 DETAILS", "DOOR D6-D9 DETAILS"


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def test_a_group_is_named_by_its_first_sheet_and_a_decision_never_splits_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheets = [
        Sheet("S-21", DOORS[0], (DOORS[0],)),
        Sheet("S-22", DOORS[1], (DOORS[1],)),
        Sheet("S-26", "RAMP DETAILS", ("RAMP DETAIL R1",)),
        Sheet("S-29", "RAMP DETAILS", ("RAMP DETAIL R2",)),
    ]
    api = api_as(qs_project.member)
    file_id = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL)
    run_job(qs_project.member, file_id, monkeypatch, readers({STRUCTURAL: sheets}))
    listed = {p["number"]: p for p in proposals(api, qs_project.project_id)}

    assert confirm(api, qs_project.project_id, [listed["S-22"]["id"]]).status_code == 200
    shown = {p["number"]: p for p in proposals(api, qs_project.project_id)}

    assert shown["S-22"]["decision"] == "confirmed"
    assert shown["S-21"]["continuation"] == shown["S-22"]["continuation"] == shown["S-21"]["sheet_id"]
    assert shown["S-22"]["continuation_title"] == "DOOR D2-D9 DETAILS"
    assert shown["S-26"]["series"] == shown["S-29"]["series"] == shown["S-26"]["sheet_id"]
    assert {shown[n]["continuation"] for n in ("S-26", "S-29")} == {None}
    assert uuid.UUID(shown["S-21"]["continuation"])
