"""A sheet decided by exclusion: its views show as excluded, so no chip reads "no step: unaccounted"
while Coverage counts them excluded (S24-C2 round 1). The sheet is t158's invented no-subject
Structural sheet: its view names no step, so the read leaves it unaccounted until a decision."""

import uuid
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    coverage,
    exclude,
    jev_says,
    proposals,
    step1,
    the,
)
from vextrus.takeoff.tests.acceptance.t158.structural_views import NO_SUBJECT, read
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

SECTION = NO_SUBJECT.views[0]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def _chips_unaccounted(api: Any, project_id: uuid.UUID) -> int:
    """What `ViewChips` shows amber "no step: unaccounted" for: not excluded (by the QS or proposed),
    no step and no Part."""
    return sum(
        v["decision"] != "excluded"
        and not v["proposed_exclusion"]
        and not v["steps"]
        and v["part"] is None
        for p in proposals(api, project_id)
        for v in p["views"]
    )


def _view(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    views: list[dict[str, Any]] = the(proposals(api, project_id), NO_SUBJECT.number)["views"]
    [view] = [v for v in views if v["title"] == SECTION]
    return view


def test_an_excluded_sheets_views_are_excluded_on_the_chips_and_in_coverage(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [NO_SUBJECT])
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    sheet = the(proposals(api, pid), NO_SUBJECT.number)
    assert _chips_unaccounted(api, pid) == coverage(api, pid)["unaccounted"] == 1

    response = exclude(api, pid, [sheet["id"]], "superseded")

    assert response.status_code == 200, response.content
    assert _chips_unaccounted(api, pid) == coverage(api, pid)["unaccounted"] == 0
    view = _view(api, pid)
    assert (view["decision"], view["excluded_reason"]) == ("excluded", "superseded")


def test_undoing_the_exclusion_brings_the_chip_and_the_count_back_together(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [NO_SUBJECT])
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    sheet = the(proposals(api, pid), NO_SUBJECT.number)
    exclude(api, pid, [sheet["id"]], "superseded")

    response = api.post(f"{step1(pid)}/undo", {})

    assert response.status_code == 200, response.content
    assert _chips_unaccounted(api, pid) == coverage(api, pid)["unaccounted"] == 1
    assert _view(api, pid)["decision"] is None
