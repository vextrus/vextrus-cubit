"""Steps 3, 4 and 6's API (ticket S16-T2; session 16's contract, takeoff T2; M1.md C9, C17): the
storey list and its view placements, typed levels, confirm, exclude, the size answer, n / N; one
DomainEvent per act; `live_model.services.apply` called by the acts and by nothing else; a second
Developer gets 404. Proposals are seeded directly, as T1's read job will leave them."""

import uuid
from dataclasses import dataclass, field
from typing import Any

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from vextrus.live_model import services as live_model_services
from vextrus.platform.services import tenancy
from vextrus.projects import services as projects
from vextrus.takeoff.models import Proposal, ProposalSubject, Question, QuestionKind, QuestionStatus
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def url(project_id: uuid.UUID, path: str) -> str:
    return f"/api/projects/{project_id}/takeoff/{path}"


@dataclass
class Applied:
    """A stand-in for `live_model.services.apply` that records each call."""

    calls: list[tuple[Any, ...]] = field(default_factory=list)

    def __call__(
        self, building_id: uuid.UUID, confirmation_id: uuid.UUID, changes: Any, *, cause: str
    ) -> Any:
        self.calls.append((building_id, confirmation_id, changes, cause))
        return Ref(seq=len(self.calls), figures_changed=True)


@dataclass(frozen=True)
class Ref:
    seq: int
    figures_changed: bool


@pytest.fixture
def applied(monkeypatch: pytest.MonkeyPatch) -> Applied:
    stand_in = Applied()
    monkeypatch.setattr(live_model_services, "apply", stand_in, raising=False)
    monkeypatch.setattr(live_model_services, "primitives", lambda building_id, seq: [], raising=False)
    return stand_in


def seed(
    member: Member, project_id: uuid.UUID, step: str, family: str, values: list[dict[str, Any]]
) -> list[uuid.UUID]:
    with member.acting():
        tenant = tenancy.current_tenant_id()
        assert tenant is not None
        made = [
            Proposal(
                tenant_id=tenant,
                project_id=project_id,
                step=step,
                subject=ProposalSubject.ELEMENT,
                subject_id=uuid.uuid4(),
                family_key=family,
                candidate_key=f"{family}|{v.get('mark', i)}",
                values=v,
            )
            for i, v in enumerate(values)
        ]
        Proposal.objects.bulk_create(made)
    return [p.id for p in made]


def columns(member: Member, project_id: uuid.UUID, count: int) -> list[uuid.UUID]:
    return seed(
        member,
        project_id,
        "columns",
        "column",
        [{"mark": f"C{i + 1}", "section_b": "254", "section_d": "508"} for i in range(count)],
    )


def events(member: Member, project_id: uuid.UUID) -> int:
    with member.acting(), connection.cursor() as cursor:
        cursor.execute("select count(*) from platform_domainevent where project_id = %s", [project_id])
        row = cursor.fetchone()
    assert row is not None
    return int(row[0])


def step_row(member: Member, project_id: uuid.UUID, step: str) -> dict[str, Any]:
    response = api_as(member).get(url(project_id, "steps"))
    assert response.status_code == 200
    [row] = [r for r in response.json() if r["step"] == step]
    return dict(row)


def test_steps_lists_storeys_grid_and_columns(qs_project: QsProject) -> None:
    response = api_as(qs_project.member).get(url(qs_project.project_id, "steps"))

    assert response.status_code == 200
    rows = response.json()
    assert {"storeys", "grid", "columns"} <= {r["step"] for r in rows}
    for row in rows:
        assert {"step", "status", "n", "N", "open_questions"} <= set(row)


def test_steps_counts_n_of_N_for_the_columns_proposed(qs_project: QsProject, applied: Applied) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    ids = columns(member, project_id, 3)

    before = step_row(member, project_id, "columns")
    api_as(member).post(
        url(project_id, "confirmations"),
        {"act": "confirm", "step": "columns", "proposal_ids": [str(ids[0])]},
    )
    after = step_row(member, project_id, "columns")

    assert (before["n"], before["N"]) == (0, 3)
    assert (after["n"], after["N"]) == (1, 3)


def test_confirm_answers_its_confirmation_and_model_version(
    qs_project: QsProject, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    ids = columns(member, project_id, 2)

    response = api_as(member).post(
        url(project_id, "confirmations"),
        {"act": "confirm", "step": "columns", "proposal_ids": [str(i) for i in ids]},
    )

    assert response.status_code == 200
    body = response.json()
    assert {"confirmation_id", "model_version_seq", "figures_changed"} <= set(body)
    assert body["model_version_seq"] == 1
    assert len(applied.calls) == 1
    building_id, confirmation_id, _changes, _cause = applied.calls[0]
    assert str(confirmation_id) == str(body["confirmation_id"])
    with member.acting():
        assert str(building_id) == str(projects.buildings(project_id)[0].id)


def test_every_act_writes_exactly_one_domain_event(qs_project: QsProject, applied: Applied) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    ids = [str(i) for i in columns(member, project_id, 4)]
    qs = api_as(member)
    acts: list[dict[str, Any]] = [
        {"act": "confirm", "step": "columns", "proposal_ids": [ids[0]]},
        {"act": "exclude", "step": "columns", "proposal_ids": [ids[1]], "reason": "not_a_column"},
        {
            "act": "edit",
            "step": "columns",
            "proposal_ids": [ids[2]],
            "values": {"section_b": "300", "section_d": "450", "unit": "mm"},
        },
        {"act": "unconfirm", "step": "columns", "proposal_ids": [ids[0]]},
    ]

    for act in acts:
        before = events(member, project_id)
        response = qs.post(url(project_id, "confirmations"), act)
        assert response.status_code == 200, (act["act"], response.content)
        assert events(member, project_id) == before + 1, act["act"]


def test_reading_the_steps_never_reaches_the_live_model(qs_project: QsProject, applied: Applied) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    columns(member, project_id, 2)
    qs = api_as(member)

    assert qs.get(url(project_id, "steps")).status_code == 200
    assert qs.get(url(project_id, "steps/columns/proposals") + "?group=mark").status_code == 200
    assert qs.get(url(project_id, "storeys")).status_code == 200

    assert applied.calls == []


def test_an_excluded_proposal_is_never_shown_confirmed(qs_project: QsProject, applied: Applied) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [excluded, kept] = columns(member, project_id, 2)
    qs = api_as(member)

    response = qs.post(
        url(project_id, "confirmations"),
        {"act": "exclude", "step": "columns", "proposal_ids": [str(excluded)], "reason": "not_a_column"},
    )

    assert response.status_code == 200
    listed = qs.get(url(project_id, "steps/columns/proposals") + "?group=mark")
    assert listed.status_code == 200
    states = {p["id"]: p["state"] for g in listed.json()["groups"] for p in g["proposals"]}
    assert states[str(excluded)] != "confirmed"
    assert states[str(kept)] != "confirmed"


def test_primitives_answer_one_row_per_element_in_c17_shape(
    qs_project: QsProject, applied: Applied
) -> None:
    response = api_as(qs_project.member).get(url(qs_project.project_id, "model/primitives"))

    assert response.status_code == 200
    rows = response.json()
    assert isinstance(rows, list)
    for row in rows:
        assert {"element_id", "family", "storey", "part", "state", "primitives"} <= set(row)
        assert row["state"] in ("confirmed", "proposal", "held")


def test_edit_with_section_values_answers_the_size_question(
    qs_project: QsProject, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    [column] = seed(member, project_id, "columns", "column", [{"mark": "C1"}])
    with member.acting():
        tenant = tenancy.current_tenant_id()
        assert tenant is not None
        question = Question.objects.create(
            tenant_id=tenant,
            project_id=project_id,
            step="columns",
            kind=QuestionKind.MISSING,
            question_key=f"size|{column}",
            subject_id=column,
            message_code="engine.column.size_not_read",
        )

    response = api_as(member).post(
        url(project_id, "confirmations"),
        {
            "act": "edit",
            "step": "columns",
            "proposal_ids": [str(column)],
            "values": {"section_b": "254", "section_d": "508", "unit": "mm"},
        },
    )

    assert response.status_code == 200
    with member.acting():
        question.refresh_from_db()
    assert question.status == QuestionStatus.ANSWERED
    assert len(applied.calls) == 1


def test_typed_levels_show_as_typed_on_the_storey_list(qs_project: QsProject) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    seed(
        member,
        project_id,
        "storeys",
        "storey",
        [{"name": "Ground floor", "order": 0}, {"name": "First floor", "order": 1}],
    )
    qs = api_as(member)
    listed = qs.get(url(project_id, "storeys"))
    assert listed.status_code == 200
    storeys = listed.json()["storeys"]
    assert len(storeys) == 2
    assert "view_placements" in listed.json()
    first = storeys[0]["id"]

    typed = qs.send(
        "put", url(project_id, "storeys/levels"), {"levels": [{"storey_id": first, "level_m": "3.048"}]}
    )

    assert typed.status_code == 200
    [row] = [s for s in qs.get(url(project_id, "storeys")).json()["storeys"] if s["id"] == first]
    assert row["level_basis"] == "typed"
    assert row["level_m"] == "3.048"


def test_a_second_developer_gets_404_on_every_endpoint(
    qs_project: QsProject, sign_in: Any, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    ids = columns(member, project_id, 1)
    outsider = api_as(sign_in(role="qs"))

    for method, path, body in (
        ("get", "steps", None),
        ("get", "steps/columns/proposals?group=mark", None),
        ("get", "storeys", None),
        ("put", "storeys/levels", {"levels": []}),
        ("put", f"view-placements/{uuid.uuid4()}", {"storey_ids": []}),
        ("post", "confirmations", {"act": "confirm", "step": "columns", "proposal_ids": [str(ids[0])]}),
        ("get", "model/primitives", None),
    ):
        response = outsider.send(method, url(project_id, path), body)
        assert (response.status_code, response.json()) == (
            404,
            {"code": "platform.auth.not_found", "params": {}},
        ), (method, path)

    assert applied.calls == []
    assert step_row(member, project_id, "columns")["n"] == 0


def test_a_confirm_at_500_proposals_costs_no_more_queries_than_at_5(
    qs_project: QsProject, applied: Applied
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    few = [str(i) for i in columns(member, project_id, 5)]
    many = [
        str(i)
        for i in seed(
            member,
            project_id,
            "columns",
            "column",
            [{"mark": f"D{i}", "section_b": "254", "section_d": "508"} for i in range(500)],
        )
    ]
    qs = api_as(member)

    with CaptureQueriesContext(connection) as at_5:
        assert (
            qs.post(
                url(project_id, "confirmations"),
                {"act": "confirm", "step": "columns", "proposal_ids": few},
            ).status_code
            == 200
        )
    with CaptureQueriesContext(connection) as at_500:
        assert (
            qs.post(
                url(project_id, "confirmations"),
                {"act": "confirm", "step": "columns", "proposal_ids": many},
            ).status_code
            == 200
        )

    assert len(at_500) <= len(at_5) + 5
