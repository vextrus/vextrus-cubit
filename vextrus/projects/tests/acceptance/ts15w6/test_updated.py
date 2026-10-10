"""Ticket S15-W6's acceptance tests (#548; walk #325, FL13): the Projects list's "Updated"
(docs/design/m0-screens.md §4.3, "Updated | date") is the time of the Project's newest DomainEvent,
sent with each Project of `GET /api/projects` as `updated_at`, to every role that may open it.

Every act on a Project writes one DomainEvent with its `project_id` (docs/data-model.md §2, Events;
`platform.services.events`): its creation, a file's, and, from S15-A3 (#539) on, every Step 1 act. So
"Updated" moves with acts by reading the event log alone, and holds once A3 lands. An event on another
Project, on none (a Membership's), or in another Developer never moves it.

The Step 1 act here is a DomainEvent of S15-A3's kind written through platform's events service, as
A3's acts write theirs (this module may not import takeoff, a higher layer). Its kind does not matter
to the rule; times are the creation's plus whole days, so the order is fixed and nothing waits. The
API writes a time to the millisecond, so times are compared to the millisecond.
"""

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

import pytest

from engine.messages import MessageCode
from vextrus.platform.services import events, tenancy
from vextrus.projects import services
from vextrus.projects.messages.projects import CREATED
from vextrus.testing.auth import Api, api_as
from vextrus.testing.tenancy import Member

STEP1_CONFIRMED = MessageCode("takeoff.step1.confirmed", params=("sheets",), event=True)
"""S15-A3's "the QS confirmed sheets" act (`takeoff.step1.confirmed`), declared here as data only."""


def made(developer_id: uuid.UUID, *codes: str) -> dict[str, uuid.UUID]:
    """Projects created in the Developer as the system (the seed's way), by code; each writes its
    `projects.projects.created` DomainEvent."""
    with tenancy.acting_in(developer_id):
        return {code: services.create(code=code, name=f"Project {code}").id for code in codes}


def ms(at: datetime) -> datetime:
    """The time to the millisecond, as the API's JSON writes it."""
    return at.replace(microsecond=at.microsecond // 1000 * 1000)


def created_at(developer_id: uuid.UUID, project_id: uuid.UUID) -> datetime:
    """When the Project's creation was recorded, as its DomainEvent says."""
    with tenancy.acting_in(developer_id):
        found = events.latest([CREATED], subject_type="project", subject_ids=[project_id])
    return ms(found[(CREATED.code, project_id)])


def act(developer_id: uuid.UUID, project_id: uuid.UUID | None, at: datetime) -> None:
    """A Step 1 act on the Project (or, with none, an act on no Project) at `at`, in the Developer."""
    with tenancy.acting_in(developer_id):
        events.record(
            STEP1_CONFIRMED,
            subject_type="project" if project_id else "developer",
            subject_id=project_id,
            project_id=project_id,
            payload={"sheets": 3},
            occurred_at=at,
        )


def updated(api: Api) -> dict[str, datetime]:
    """Each listed Project's `updated_at` (to the millisecond), by code."""
    response = api.get("/api/projects")
    assert response.status_code == 200
    listed: list[dict[str, Any]] = response.json()
    return {project["code"]: ms(datetime.fromisoformat(project["updated_at"])) for project in listed}


def member(
    role: str, developer: uuid.UUID, project: uuid.UUID, sign_in: Callable[..., Member]
) -> Member:
    """A member of `role`; a Guest is given the one Project, as an invitation names it."""
    return sign_in(role=role, developer_id=developer, projects=[project] if role == "guest" else [])


@pytest.mark.django_db
def test_a_project_with_no_act_since_its_creation_was_updated_when_it_was_created(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer = make_developer()
    ids = made(developer, "KR-01")

    assert updated(api_as(sign_in(role="qs", developer_id=developer))) == {
        "KR-01": created_at(developer, ids["KR-01"])
    }


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["qs", "md", "vextrus_engineer", "guest"])
def test_the_newest_act_on_a_project_is_when_it_was_updated_for_every_role(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID], role: str
) -> None:
    developer = make_developer()
    ids = made(developer, "KR-01")
    start = created_at(developer, ids["KR-01"])
    # Written out of order: the newest is the one with the latest time, not the last written.
    act(developer, ids["KR-01"], start + timedelta(days=1))
    act(developer, ids["KR-01"], start + timedelta(days=5))
    act(developer, ids["KR-01"], start + timedelta(days=2))

    listed = updated(api_as(member(role, developer, ids["KR-01"], sign_in)))

    assert listed == {"KR-01": start + timedelta(days=5)}


@pytest.mark.django_db
def test_an_act_on_another_project_or_on_none_never_moves_a_project(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer = make_developer()
    ids = made(developer, "KR-01", "BP-02", "SG-03")
    start = created_at(developer, ids["SG-03"])
    act(developer, ids["KR-01"], start + timedelta(days=3))
    act(developer, ids["BP-02"], start + timedelta(days=8))
    act(developer, None, start + timedelta(days=9))

    listed = updated(api_as(sign_in(role="md", developer_id=developer)))

    assert listed == {
        "BP-02": start + timedelta(days=8),
        "KR-01": start + timedelta(days=3),
        "SG-03": start,
    }


@pytest.mark.django_db
def test_another_developers_act_never_moves_a_project_even_naming_its_id(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    shapla, meghna = make_developer(), make_developer()
    ours = made(shapla, "KR-01")["KR-01"]
    theirs = made(meghna, "MG-01")["MG-01"]
    start = created_at(shapla, ours)
    # A crafted event in the other Developer naming this Developer's Project, and one on its own.
    act(meghna, ours, start + timedelta(days=9))
    act(meghna, theirs, start + timedelta(days=4))

    assert updated(api_as(sign_in(role="qs", developer_id=shapla))) == {"KR-01": start}
    assert updated(api_as(sign_in(role="qs", developer_id=meghna))) == {
        "MG-01": start + timedelta(days=4)
    }
