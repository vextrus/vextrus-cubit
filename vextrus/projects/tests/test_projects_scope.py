"""Listing and getting Projects: only those the current Membership may open (s02 Q11; ADR 0034).

A Project outside the scope, another Developer's, and one that never existed are one answer,
`ProjectNotFound`, reached by the same queries, so a Project's existence never leaks.
"""

import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.contrib.sessions.backends.db import SessionStore
from django.db import connection, transaction
from django.test import RequestFactory
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from vextrus.platform.services import tenancy
from vextrus.projects import services
from vextrus.testing.tenancy import Member


@pytest.fixture
def shapla(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_developer("Shapla Homes Ltd")


@pytest.fixture
def made(shapla: uuid.UUID) -> dict[str, uuid.UUID]:
    """Shapla's three Projects, made by the seed's way (no Membership), by code."""
    with tenancy.acting_in(shapla):
        return {
            code: services.create(code=code, name=name).id
            for code, name in (
                ("SG-03", "Shimul Garden"),
                ("KR-01", "Kadam Residence"),
                ("BP-02", "Bokul Place"),
            )
        }


@pytest.fixture
def guest(sign_in: Callable[..., Member], shapla: uuid.UUID, made: dict[str, uuid.UUID]) -> Member:
    """A Guest given only KR-01 (m0-screens §7)."""
    return sign_in(role="guest", developer_id=shapla, projects=[made["KR-01"]])


@pytest.fixture
def outsider(sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]) -> Member:
    """Meghna's QS, with Meghna's one Project."""
    member = sign_in(role="qs", developer_id=make_developer("Meghna Properties Ltd"))
    with member.acting():
        services.create(code="MG-01", name="Meghna Heights")
    return member


def codes(found: list[services.ProjectView]) -> list[str]:
    return [project.code for project in found]


@pytest.mark.django_db
def test_a_member_given_every_project_lists_them_all_by_code(
    sign_in: Callable[..., Member], shapla: uuid.UUID, made: dict[str, uuid.UUID]
) -> None:
    qs = sign_in(role="qs", developer_id=shapla)

    with qs.acting():
        assert codes(services.list()) == ["BP-02", "KR-01", "SG-03"]
        assert services.get(made["SG-03"]).name == "Shimul Garden"


@pytest.mark.django_db
def test_a_member_given_chosen_projects_lists_and_gets_only_those(
    guest: Member, made: dict[str, uuid.UUID]
) -> None:
    with guest.acting():
        assert codes(services.list()) == ["KR-01"]
        assert services.get(made["KR-01"]).code == "KR-01"
        assert [b.ordinal for b in services.buildings(made["KR-01"])] == [1]
        for code in ("BP-02", "SG-03"):
            with pytest.raises(services.ProjectNotFound):
                services.get(made[code])
            with pytest.raises(services.ProjectNotFound):
                services.buildings(made[code])


@pytest.mark.django_db
def test_another_developers_projects_are_invisible_to_list_get_and_buildings(
    outsider: Member, sign_in: Callable[..., Member], shapla: uuid.UUID, made: dict[str, uuid.UUID]
) -> None:
    qs = sign_in(role="qs", developer_id=shapla)
    with outsider.acting():
        [meghnas] = services.list()

    with qs.acting():
        assert meghnas.id not in {project.id for project in services.list()}
        with pytest.raises(services.ProjectNotFound):
            services.get(meghnas.id)
        with pytest.raises(services.ProjectNotFound):
            services.buildings(meghnas.id)
    with outsider.acting():
        assert codes(services.list()) == ["MG-01"]
        for project_id in made.values():
            with pytest.raises(services.ProjectNotFound):
                services.get(project_id)


@pytest.mark.django_db
def test_a_scope_naming_another_developers_project_opens_nothing_there(
    outsider: Member, sign_in: Callable[..., Member], shapla: uuid.UUID
) -> None:
    with outsider.acting():
        [meghnas] = services.list()
    # A Membership of Shapla's whose scope names Meghna's Project, as a forged row would.
    member = sign_in(role="qs", developer_id=shapla, projects=[meghnas.id])

    with member.acting():
        assert services.list() == []
        with pytest.raises(services.ProjectNotFound):
            services.get(meghnas.id)


def _not_found(project_id: uuid.UUID) -> tuple[str, tuple[str, ...]]:
    """The answer and the queries run (their SQL, parameters aside) when getting a Project."""
    with CaptureQueriesContext(connection) as ran, pytest.raises(services.ProjectNotFound) as raised:
        services.get(project_id)
    return repr(raised.value.message), tuple(query["sql"].split(" WHERE ")[0] for query in ran)


@pytest.mark.django_db
def test_outside_the_scope_another_developers_and_none_at_all_are_the_same_answer_and_path(
    guest: Member, outsider: Member, made: dict[str, uuid.UUID]
) -> None:
    with outsider.acting():
        [meghnas] = services.list()

    with guest.acting():
        answers = {
            "outside the scope": _not_found(made["BP-02"]),
            "another Developer's": _not_found(meghnas.id),
            "none at all": _not_found(uuid.uuid4()),
        }

    assert len(set(answers.values())) == 1, answers
    message, queries = answers["none at all"]
    # 07's one answer for every "not found", which the guard gives too (m0-screens 4.1's words).
    assert message == repr({"code": "platform.auth.not_found", "params": {}})
    assert len(queries) == 1


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["qs", "vextrus_engineer"])
@pytest.mark.parametrize("code", ["NW-04", "BP-02", "bp-02"])
def test_a_member_given_chosen_projects_cannot_create_one_and_learns_no_code(
    sign_in: Callable[..., Member], shapla: uuid.UUID, made: dict[str, uuid.UUID], role: str, code: str
) -> None:
    # A role that may change, given only KR-01 (the Guest and the MD are refused by role, by 07's
    # guard, before this service runs). A taken code (BP-02, outside the scope) is refused the same
    # way as a free one, never as "taken", which would name a Project the member may not open.
    member = sign_in(role=role, developer_id=shapla, projects=[made["KR-01"]])

    with member.acting(), pytest.raises(services.Refused) as refused:
        services.create(code=code, name="A new one")

    assert (refused.value.field, refused.value.status, refused.value.message) == (
        None,
        403,
        {"code": "projects.projects.scoped_member_cannot_create", "params": {}},
    )
    with member.acting():
        assert codes(services.list()) == ["KR-01"]


@pytest.mark.django_db
def test_outside_any_developer_nothing_is_listed_or_found(made: dict[str, uuid.UUID]) -> None:
    with tenancy.acting_in(None):
        assert services.list() == []
        with pytest.raises(services.ProjectNotFound):
            services.get(made["KR-01"])


@pytest.mark.django_db
def test_staff_in_the_admin_see_the_developer_they_opened(
    staff: Any, shapla: uuid.UUID, made: dict[str, uuid.UUID]
) -> None:
    # Staff act in the admin with no Membership, as the tenant middleware enters their request: the
    # scope is the tenant they opened, and row-level security holds it.
    request = RequestFactory().get("/admin/")
    request.user = staff
    request.session = SessionStore()
    request.session[tenancy.STAFF_SESSION_TENANT] = str(shapla)

    with transaction.atomic():
        entered = tenancy.enter_request(request)
        try:
            assert (entered.tenant_id, entered.membership) == (shapla, None)
            assert codes(services.list()) == ["BP-02", "KR-01", "SG-03"]
        finally:
            tenancy.leave_request()


@pytest.mark.django_db
def test_a_user_whose_membership_ended_acts_in_no_developer(
    sign_in: Callable[..., Member], shapla: uuid.UUID, made: dict[str, uuid.UUID]
) -> None:
    # 07 closed 02's fail-open: a user with no current Membership there acts in no tenant at all.
    ended = sign_in(role="qs", developer_id=shapla, expires_at=timezone.now() - timedelta(seconds=1))

    with ended.acting():
        assert services.list() == []
        with pytest.raises(services.ProjectNotFound):
            services.get(made["KR-01"])
