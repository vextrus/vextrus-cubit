"""Who did what (ticket 22; the design gate's M8; m0-screens 6.2, 6.6): each decided sheet carries
the role of whoever decided it and how many sheets that act decided, so the inspector reads "Confirmed
in bulk with 1 other sheet / Nusrat Jahan, QS, 29 Sep 2026, 19:28" and the list's chip their initials."""

from typing import Any

import pytest

from vextrus.testing.auth import api_as
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db


def test_a_decided_sheet_names_its_actors_role_and_its_acts_size(step1_project: Step1Project) -> None:
    client = api_as(step1_project.member)
    url = f"/api/projects/{step1_project.project_id}/takeoff/step1"
    two = [str(p) for p in step1_project.proposals[:2]]
    assert client.post(f"{url}/confirm", {"proposals": two}).status_code == 200
    one = {"proposals": [str(step1_project.proposals[2])], "reason": "superseded"}
    assert client.post(f"{url}/exclude", one).status_code == 200

    body: dict[str, Any] = client.get(f"{url}/proposals").json()

    got = {p["number"]: (p["decided_role"], p["decided_with"]) for p in body["proposals"]}
    assert got == {"S-01": ("qs", 2), "S-02": ("qs", 2), "S-03": ("qs", 1)}


def test_an_undecided_sheet_names_no_one(step1_project: Step1Project) -> None:
    body: dict[str, Any] = (
        api_as(step1_project.member)
        .get(f"/api/projects/{step1_project.project_id}/takeoff/step1/proposals")
        .json()
    )

    assert {(p["decided_role"], p["decided_with"]) for p in body["proposals"]} == {(None, 0)}
