"""A drawing list read on a sheet, with its revision marks (ticket 22, review round 1, M14): the
list's row names the copy it lists ("S-07 B"), so a pre-pick between two copies of one number can
name the list as its second source (m0-screens 6.7: "the drawing list on S-01, row 19: "S-19 R1"").
The API sends the marks it read, by number, and the sheet it was read on."""

from typing import Any

import pytest

from vextrus.takeoff.services import step1
from vextrus.testing.auth import api_as
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db


def listed(project: Step1Project) -> dict[str, Any]:
    url = f"/api/projects/{project.project_id}/takeoff/step1/drawing-list?discipline=structural"
    response = api_as(project.member).get(url)
    assert response.status_code == 200, response.content
    body: dict[str, Any] = response.json()
    return body


def test_the_list_read_on_a_sheet_sends_each_numbers_mark(step1_project: Step1Project) -> None:
    with step1_project.member.acting():
        step1.record_read_list(
            step1_project.sheets[0],
            "structural",
            [("S-01", "NOTES", "R0"), ("S-02", "PLAN"), ("S-03", "PLAN", "B")],
        )

    body = listed(step1_project)

    assert body["read_marks"] == {"S-01": "R0", "S-03": "B"}
    assert body["read_on"] == str(step1_project.sheets[0])


def test_with_no_list_read_there_are_no_marks(step1_project: Step1Project) -> None:
    assert listed(step1_project)["read_marks"] == {}
