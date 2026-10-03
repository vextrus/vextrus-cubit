"""Ticket 158: a QS act puts a view in a Takeoff Step, with its refusals.

#158, "Acceptance to pin": "API test: a QS act puts a view in a Step, with refusal bodies"; "Why it
matters": "Excluding beam long sections to get past the gate would be a wrong act that loses Rebar and
concrete the Takeoff needs." The act's name and body are the acceptance writer's (see
`structural_views.py`). m0-screens 6.11: a view is "assigned once its sheet is confirmed with at least
one step"; "unaccounted when it has no step, no Part and no exclusion"; §5: a Part's Step 1 is
confirmed when "none of its views is unaccounted". 19a's API: every role reads Step 1, only the QS and
the Vextrus Engineer act on it; another Developer's Project is the one 404.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.projects import services as projects
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    NOT_FOUND,
    confirm,
    coverage,
    english,
    exclude,
    jev_says,
    progress,
    proposals,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

from .structural_views import (
    NO_SUBJECT,
    NO_SUBJECT_KIND,
    STEP_UNKNOWN,
    VIEW_EXCLUDED,
    assign,
    read,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def unaccounted_view(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> str:
    """Read one Structural sheet whose view names no subject and confirm the sheet: its view stays
    unaccounted. The view's Proposal id, which the act takes."""
    read(qs, monkeypatch, [NO_SUBJECT])
    api = api_as(qs.member)
    [sheet] = proposals(api, qs.project_id)
    response = confirm(api, qs.project_id, [sheet["id"]], kind=NO_SUBJECT_KIND)
    assert response.status_code == 200, response.content
    [view] = coverage(api, qs.project_id)["unaccounted_views"]
    view_id: str = view["id"]
    return view_id


def still_unaccounted(api: Any, project_id: uuid.UUID, view_id: str) -> bool:
    return [v["id"] for v in coverage(api, project_id)["unaccounted_views"]] == [view_id]


def test_the_qs_puts_an_unaccounted_view_in_beams_and_structural_reaches_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    view_id = unaccounted_view(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert progress(api, qs_project.project_id)["structural"]["status"] == "in_review"

    response = assign(api, qs_project.project_id, [view_id], ["beams"])

    assert response.status_code == 200, response.content
    assert response.json()["by"] == qs_project.member.user.name
    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["unaccounted_views"]) == (0, [])
    assert shown["by_step"] == {"beams": 1}
    assert shown["assigned"] == 1
    row = progress(api, qs_project.project_id)["structural"]
    assert (row["status"], row["outstanding"]) == ("confirmed", [])


def test_a_view_may_be_put_in_several_steps(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens 6.9 (M1's dialog, kept): "A view may feed several steps"."""
    view_id = unaccounted_view(qs_project, monkeypatch)
    api = api_as(qs_project.member)

    response = assign(api, qs_project.project_id, [view_id], ["beams", "slabs"])

    assert response.status_code == 200, response.content
    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["assigned"]) == (0, 1)
    assert shown["by_step"] == {"beams": 1, "slabs": 1}


def test_the_same_act_sent_twice_counts_the_view_once(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    view_id = unaccounted_view(qs_project, monkeypatch)
    api = api_as(qs_project.member)

    first = assign(api, qs_project.project_id, [view_id], ["beams"])
    assign(api, qs_project.project_id, [view_id], ["beams"])

    assert first.status_code == 200, first.content
    shown = coverage(api, qs_project.project_id)
    assert (shown["views"], shown["assigned"], shown["by_step"]) == (2, 1, {"beams": 1})


def test_another_developer_cannot_put_the_view_in_a_step(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    view_id = unaccounted_view(qs_project, monkeypatch)
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Their project").id
    api = api_as(stranger)

    on_ours = assign(api, qs_project.project_id, [view_id], ["beams"])
    on_theirs = assign(api, theirs, [view_id], ["beams"])

    assert (on_ours.status_code, on_ours.json()) == (404, NOT_FOUND)
    assert (on_theirs.status_code, on_theirs.json()) == (404, NOT_FOUND)
    assert still_unaccounted(api_as(qs_project.member), qs_project.project_id, view_id)


@pytest.mark.parametrize("role", ["md", "guest"])
def test_the_md_and_a_guest_cannot_put_a_view_in_a_step(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    sign_in: Callable[..., Member],
    role: str,
) -> None:
    view_id = unaccounted_view(qs_project, monkeypatch)
    reader = api_as(
        sign_in(
            role=role,
            developer_id=qs_project.member.developer_id,
            projects=[qs_project.project_id],
        )
    )

    response = assign(reader, qs_project.project_id, [view_id], ["beams"])

    refused = {"code": "platform.auth.not_allowed", "params": {"role": role}}
    assert (response.status_code, response.json()) == (403, refused)
    assert still_unaccounted(api_as(qs_project.member), qs_project.project_id, view_id)


def test_a_key_that_is_no_takeoff_step_is_refused(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`pile_cap` is a subject; its Step is `foundations` (the Library's keys)."""
    view_id = unaccounted_view(qs_project, monkeypatch)
    api = api_as(qs_project.member)

    response = assign(api, qs_project.project_id, [view_id], ["pile_cap"])

    assert response.status_code == 400, response.content
    assert response.json()["code"] == STEP_UNKNOWN
    assert english(STEP_UNKNOWN) is not None
    assert still_unaccounted(api, qs_project.project_id, view_id)


def test_a_view_the_qs_excluded_is_not_put_in_a_step(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    view_id = unaccounted_view(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    left_out = exclude(api, qs_project.project_id, [view_id], "for_information")
    assert left_out.status_code == 200, left_out.content

    response = assign(api, qs_project.project_id, [view_id], ["beams"])

    assert response.status_code == 409, response.content
    assert response.json()["code"] == VIEW_EXCLUDED
    assert english(VIEW_EXCLUDED) is not None
    shown = coverage(api, qs_project.project_id)
    assert shown["by_reason"] == {"for_information": 2}  # the view and the title block
    assert shown["by_step"] == {}
