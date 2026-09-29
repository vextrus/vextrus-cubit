"""Whom Step 1's read-only bar names (ticket 22; the design gate's M11; m0-screens 6.12): "Nusrat
Jahan (QS) confirms the sheet list". The progress operation sends `qs`, the names of the people whose
current Membership is a QS's and may open this Project; the MD and a Guest read it like the QS."""

from collections.abc import Callable
from typing import Any

import pytest

from vextrus.platform.services import invitations
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def qs_named(member: Member, project: QsProject) -> list[str]:
    response = api_as(member).get(f"/api/projects/{project.project_id}/takeoff/step1/progress")
    assert response.status_code == 200, response.content
    body: dict[str, Any] = response.json()
    return list(body["qs"])


@pytest.mark.parametrize("role", ["md", "guest", "qs"])
def test_every_role_reads_the_projects_qs(
    qs_project: QsProject, sign_in: Callable[..., Member], role: str
) -> None:
    reader = sign_in(
        role=role, developer_id=qs_project.member.developer_id, projects=[qs_project.project_id]
    )

    named = qs_named(reader, qs_project)

    assert qs_project.member.user.name in named
    assert all(name != reader.user.name for name in named) or role == "qs"


def test_a_qs_of_other_projects_only_an_ended_one_and_other_roles_are_not_named(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    developer = qs_project.member.developer_id
    with qs_project.member.acting():
        from vextrus.projects import services as projects

        other = projects.create(code="T-OTHER", name="Another project").id
    elsewhere = sign_in(role="qs", developer_id=developer, projects=[other])
    md = sign_in(role="md", developer_id=developer)
    ended = sign_in(role="qs", developer_id=developer)
    with md.acting():
        invitations.revoke(ended.membership_id)
    stranger = sign_in(role="qs")  # another Developer's QS

    named = qs_named(md, qs_project)

    assert named == [qs_project.member.user.name]
    for someone in (elsewhere, md, ended, stranger):
        assert someone.user.name not in named


def test_with_no_acting_developer_no_one_is_named(qs_project: QsProject) -> None:
    assert invitations.names_of("qs", qs_project.project_id) == []
