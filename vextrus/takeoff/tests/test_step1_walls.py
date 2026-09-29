"""Step 1's tables hold their walls whoever writes (migration 0001), by every write, not only the one
a service makes: the app deletes nothing of takeoff's, changes a Confirmation only by undoing it,
never changes a drawing list, writes no Library row, and no row names another Project's or another
Developer's."""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.db import DatabaseError, connection, transaction

from vextrus.projects import services as projects
from vextrus.takeoff.models import Confirmation, DrawingRegister, Proposal
from vextrus.takeoff.services import step1
from vextrus.testing.auth import api_as
from vextrus.testing.takeoff import Step1Project
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def refused(sql: str, params: list[Any]) -> str:
    """Run `sql` as the app in its own savepoint, its deferred keys checked at once; the database's
    refusal, or fail."""
    try:
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("set constraints all immediate")
            cursor.execute(sql, params)
    except DatabaseError as error:
        return str(error)
    raise AssertionError(f"the app could run: {sql}")


def step1_url(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


@pytest.fixture
def acted(step1_project: Step1Project) -> Step1Project:
    """S-01 confirmed and a structural drawing list set, by the QS."""
    client = api_as(step1_project.member)
    url = step1_url(step1_project.project_id)
    assert (
        client.post(f"{url}/confirm", {"proposals": [str(step1_project.proposals[0])]}).status_code
        == 200
    )
    body = {"discipline": "structural", "text": "S-01 to S-03"}
    assert client.post(f"{url}/drawing-list", body).status_code == 200
    return step1_project


@pytest.mark.parametrize(
    "table",
    ["takeoff_proposal", "takeoff_confirmation", "takeoff_coverage", "takeoff_stepprogress",
     "takeoff_drawingregister", "takeoff_registerentry"],
)  # fmt: skip
def test_the_app_deletes_nothing_of_step_1(acted: Step1Project, table: str) -> None:
    with acted.member.acting():
        assert "permission denied" in refused(f"delete from {table}", [])


def test_a_confirmation_is_changed_only_by_undoing_it(acted: Step1Project) -> None:
    with acted.member.acting():
        [act] = Confirmation.objects.filter(project_id=acted.project_id, act="confirm")
        assert "permission denied" in refused(
            "update takeoff_confirmation set by_name = 'Someone else' where id = %s", [act.id]
        )
        assert "permission denied" in refused(
            "update takeoff_confirmation set user_id = user_id where id = %s", [act.id]
        )
        with connection.cursor() as cursor:
            cursor.execute("update takeoff_confirmation set undone_at = now() where id = %s", [act.id])


def test_a_drawing_list_is_never_changed(acted: Step1Project) -> None:
    with acted.member.acting():
        [row] = DrawingRegister.objects.filter(project_id=acted.project_id)
        assert "permission denied" in refused(
            "update takeoff_drawingregister set raw_text = 'S-01' where id = %s", [row.id]
        )
        assert "permission denied" in refused(
            "update takeoff_registerentry set number = 'S-99' where register_id = %s", [row.id]
        )


@pytest.mark.parametrize("table", ["takeoff_takeoffstep", "takeoff_check"])
def test_the_app_writes_no_library_row(step1_project: Step1Project, table: str) -> None:
    with step1_project.member.acting():
        assert "permission denied" in refused(f"update {table} set key = key", [])
        assert "permission denied" in refused(f"delete from {table}", [])


def test_a_row_never_names_another_projects_row(step1_project: Step1Project) -> None:
    member = step1_project.member
    with member.acting():
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project")
        question = step1.raise_question(
            other.id, "missing", {"code": "takeoff.step1.no_number", "params": {}}
        )
        proposal = Proposal.objects.get(id=step1_project.proposals[0])
        # A link of the other Project naming this Project's Proposal: the composite key refuses it.
        assert "same_project" in refused(
            "insert into takeoff_questionlink (id, tenant_id, project_id, question_id, proposal_id)"
            " values (%s, %s, %s, %s, %s)",
            [uuid.uuid4(), member.developer_id, other.id, question, proposal.id],
        )
        # Moving a Proposal to the other Project: the trigger refuses it.
        assert "another Project" in refused(
            "update takeoff_proposal set project_id = %s where id = %s", [other.id, proposal.id]
        )


def test_a_row_never_names_another_developers_project(
    step1_project: Step1Project, sign_in: Callable[..., Member]
) -> None:
    stranger = sign_in(role="qs")
    with stranger.acting():
        assert "cannot read" in refused(
            "insert into takeoff_question (id, tenant_id, project_id, step, discipline, kind,"
            " question_key, message_code, params, options, check_code, status, created_at)"
            " values (%s, %s, %s, 'sheets', '', 'missing', 'k', 'c', '{}', '[]', '', 'open', now())",
            [uuid.uuid4(), stranger.developer_id, step1_project.project_id],
        )
