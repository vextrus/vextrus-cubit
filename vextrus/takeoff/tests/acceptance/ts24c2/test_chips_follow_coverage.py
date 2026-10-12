"""Ticket S24-C2 (G1 blocker M0-FL7, #335, #721): once a sheet is decided, the steps and Part each of its
views shows come from its Coverage row's standing steps, so the inspector's chips and the status bar's
unaccounted count never disagree.

The rule (the session's brief, S24-C2): "once a sheet is decided, each view's steps and Part shown on
the sheet come from its Coverage row's current steps. The inspector's chips and the status bar's
unaccounted count then never disagree. Before a decision, chips show the proposed steps as now."
m0-screens 6.6: a view's chips are "each proposed step ("7 Beams") or its Part, or its exclusion, or
amber "no step: unaccounted""; 6.11: a view is "unaccounted when it has no step, no Part and no
exclusion". The chip reads the sheet view's `steps` and `part` in Step 1's proposals
(`web/src/takeoff/Step1Inspector.tsx` `ViewChips`); the status bar's count is Coverage's `unaccounted`.

Fixtures are t158's invented Structural sheets (`t158/structural_views.py`): a sheet whose title and
whose drawn view's title name no subject ("TYPICAL DETAILS", "SECTION 9-9"), so the read gives the view
no step and Coverage counts it unaccounted. Confirmed as `beam_details` (a kind naming Beams, the QS's
choice over the proposed kind) the view is given Beams by the confirmation (`_account`); confirmed as
`details` (a kind naming no step) it stays unaccounted.
"""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    coverage,
    jev_says,
    proposals,
    step1,
    the,
)
from vextrus.takeoff.tests.acceptance.t158.structural_views import (
    NO_SUBJECT,
    NO_SUBJECT_KIND,
    assign,
    read,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

BEAMS_KIND = "beam_details"
"""A Structural kind naming a step (Beams), as the QS confirms the no-subject sheet."""
OTHER = Sheet("S-07", "TYPICAL DETAILS", ("SECTION 8-8",))
"""A second no-subject sheet, confirmed as `details` (no step): its view stays unaccounted."""
SECTION = NO_SUBJECT.views[0]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def chip_unaccounted(view: dict[str, Any]) -> bool:
    """What `ViewChips` shows amber "no step: unaccounted" for: not excluded (by the QS or proposed),
    no step and no Part."""
    if view["decision"] == "excluded" or view["proposed_exclusion"]:
        return False
    return not view["steps"] and view["part"] is None


def chips_unaccounted(api: Any, project_id: Any) -> int:
    return sum(chip_unaccounted(v) for p in proposals(api, project_id) for v in p["views"])


def drawn(api: Any, project_id: Any, number: str | None, title: str = SECTION) -> dict[str, Any]:
    """The sheet's view of that title, as Step 1's proposals show it."""
    views: list[dict[str, Any]] = the(proposals(api, project_id), number)["views"]
    [view] = [v for v in views if v["title"] == title]
    return view


def test_a_confirmed_sheets_view_shows_the_steps_coverage_gave_it_and_no_unaccounted(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [NO_SUBJECT])
    api = api_as(qs_project.member)
    sheet = the(proposals(api, qs_project.project_id), NO_SUBJECT.number)

    response = confirm(api, qs_project.project_id, [sheet["id"]], kind=BEAMS_KIND)

    assert response.status_code == 200, response.content
    assert coverage(api, qs_project.project_id)["by_step"] == {"beams": 1}
    view = drawn(api, qs_project.project_id, NO_SUBJECT.number)
    assert view["steps"] == ["beams"]
    assert not chip_unaccounted(view)


def test_before_a_decision_the_view_shows_the_steps_the_read_proposed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Before a decision, chips show the proposed steps as now: the read gave the view none, and
    Coverage counts it unaccounted; confirming as `beam_details` then puts it in Beams on both."""
    read(qs_project, monkeypatch, [NO_SUBJECT])
    api = api_as(qs_project.member)

    before = drawn(api, qs_project.project_id, NO_SUBJECT.number)
    assert (before["steps"], chip_unaccounted(before)) == ([], True)
    assert coverage(api, qs_project.project_id)["unaccounted"] == 1

    sheet = the(proposals(api, qs_project.project_id), NO_SUBJECT.number)
    confirm(api, qs_project.project_id, [sheet["id"]], kind=BEAMS_KIND)

    assert drawn(api, qs_project.project_id, NO_SUBJECT.number)["steps"] == ["beams"]


def test_the_chips_unaccounted_equal_the_status_bars_count_before_and_after_the_confirm(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """One sheet confirmed with a kind naming a step (its view is then accounted) and one with a kind
    naming none (its view stays unaccounted): the chips and Coverage agree before and after."""
    read(qs_project, monkeypatch, [NO_SUBJECT, OTHER])
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    assert chips_unaccounted(api, pid) == coverage(api, pid)["unaccounted"] == 2

    kinds = {NO_SUBJECT.number: BEAMS_KIND, OTHER.number: NO_SUBJECT_KIND}
    for proposal in proposals(api, pid):
        response = confirm(api, pid, [proposal["id"]], kind=kinds[proposal["number"]])
        assert response.status_code == 200, response.content

    assert chips_unaccounted(api, pid) == coverage(api, pid)["unaccounted"] == 1
    left = drawn(api, pid, OTHER.number, OTHER.views[0])
    assert (left["steps"], chip_unaccounted(left)) == ([], True)


def test_undo_of_the_confirm_restores_the_chip_and_the_count(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [NO_SUBJECT])
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    sheet = the(proposals(api, pid), NO_SUBJECT.number)
    confirm(api, pid, [sheet["id"]], kind=BEAMS_KIND)
    assert drawn(api, pid, NO_SUBJECT.number)["steps"] == ["beams"]

    response = api.post(f"{step1(pid)}/undo", {})

    assert response.status_code == 200, response.content
    view = drawn(api, pid, NO_SUBJECT.number)
    assert (view["steps"], chip_unaccounted(view)) == ([], True)
    assert chips_unaccounted(api, pid) == coverage(api, pid)["unaccounted"] == 1


def test_a_view_the_qs_put_in_a_step_on_a_confirmed_sheet_shows_that_step(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The sheet's kind names no step, so the view stays unaccounted on confirm; the QS's `assign`
    then stands for it in Coverage, and its chip shows the same step."""
    read(qs_project, monkeypatch, [NO_SUBJECT])
    api = api_as(qs_project.member)
    pid = qs_project.project_id
    sheet = the(proposals(api, pid), NO_SUBJECT.number)
    confirm(api, pid, [sheet["id"]], kind=NO_SUBJECT_KIND)
    [entry] = coverage(api, pid)["unaccounted_views"]

    response = assign(api, pid, [entry["id"]], ["beams"])

    assert response.status_code == 200, response.content
    view = drawn(api, pid, NO_SUBJECT.number)
    assert view["steps"] == ["beams"]
    assert chips_unaccounted(api, pid) == coverage(api, pid)["unaccounted"] == 0
