"""Ticket W316 (#316, #335) at Step 1: a Structural Sheet confirmed as a site plan accounts for its
plan View in Step 14, "Site works and MEP" (`site_mep`), and the read's own proposals leave no View of
a site-works or general-notes Sheet unaccounted, so they hold no Part back (G1's finish line item 7,
"Coverage ... 0 unaccounted").

The read is 21a's job on invented sheets through 21c's harness (`t21c/step1_whole.py`, as t158's tests
read): the sheet and view finders run as they are, Jev offline and sure. The seam: Step 1's API as the
web calls it (`coverage`, `progress`, `proposals`, `confirm`, `undo`). The Step keys are the Library's
(`vextrus/takeoff/library.py`). Every title is invented.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    coverage,
    jev_says,
    progress,
    proposals,
    step1,
)
from vextrus.takeoff.tests.acceptance.t158.structural_views import VIEWS_UNACCOUNTED, read
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

SITE_MEP = "site_mep"
GENERAL_NOTES = "general_notes"
UNTOLD = Sheet("S-31", "OVERALL ARRANGEMENT", ("ARRANGEMENT PLAN",))
"""A Structural sheet whose title and whose plan's title name no subject: the read gives its plan no
Step, so it is unaccounted until the sheet's confirmed kind names one."""
SITE_WORKS = Sheet(
    "S-32",
    "BOUNDARY WALL AND SITE DRAIN DETAILS",
    ("SECTION 3-3", "SECTION 7-7", "TYPICAL COPING DETAIL"),
)
GENERAL_NOTES_SHEET = Sheet(
    "S-33", "GENERAL NOTES AND SCHEDULE OF CONCRETE MIXES", ("TYPICAL BAR SPLICE DETAIL", "DETAIL 4")
)


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def test_a_sheet_confirmed_as_a_site_plan_accounts_its_plan_to_site_works_and_mep(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [UNTOLD])
    api = api_as(qs_project.member)
    project = qs_project.project_id
    [proposal] = proposals(api, project)
    assert coverage(api, project)["unaccounted"] == 1

    response = confirm(api, project, [proposal["id"]], kind="site_plan")

    assert response.status_code == 200, response.content
    shown = coverage(api, project)
    assert (shown["unaccounted"], shown["unaccounted_views"]) == (0, [])
    assert shown["by_step"] == {SITE_MEP: 1}


def test_undoing_the_site_plan_confirmation_takes_its_step_back(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Step goes with the act that gave it; confirmed again as plain `details` (a kind that names
    no Step), the plan stays unaccounted."""
    read(qs_project, monkeypatch, [UNTOLD])
    api = api_as(qs_project.member)
    project = qs_project.project_id
    [proposal] = proposals(api, project)
    confirm(api, project, [proposal["id"]], kind="site_plan")
    assert coverage(api, project)["by_step"] == {SITE_MEP: 1}

    undone = api.post(f"{step1(project)}/undo", {})

    assert undone.status_code == 200, undone.content
    shown = coverage(api, project)
    assert shown["unaccounted"] == 1
    assert shown["by_step"].get(SITE_MEP, 0) == 0

    [again] = proposals(api, project)
    response = confirm(api, project, [again["id"]], kind="details")

    assert response.status_code == 200, response.content
    assert coverage(api, project)["unaccounted"] == 1


def test_the_reads_own_proposals_leave_no_view_of_site_works_or_general_notes_unaccounted(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [SITE_WORKS, GENERAL_NOTES_SHEET])
    api = api_as(qs_project.member)
    project = qs_project.project_id

    shown = coverage(api, project)
    held = [item["code"] for item in progress(api, project)["structural"]["outstanding"]]

    # Five drawn views and the two sheets' title blocks (proposed out for information).
    assert (shown["views"], shown["unaccounted"], shown["unaccounted_views"]) == (7, 0, [])
    assert shown["by_step"] == {SITE_MEP: 3, GENERAL_NOTES: 2}
    assert VIEWS_UNACCOUNTED not in held
