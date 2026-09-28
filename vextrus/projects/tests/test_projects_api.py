"""Projects over HTTP, as the web calls them (07's fixtures: `api_as`, `team`; CSRF enforced).

The guard answers first (signed out, no Membership, a Project outside the scope, the role), then the
service; either way a Project the member may not open is one answer, 404 `platform.auth.not_found`.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile
from vextrus.projects import services
from vextrus.testing.auth import Api, api_as
from vextrus.testing.tenancy import Member

NOT_FOUND = {"code": "platform.auth.not_found", "params": {}}
KADAM = {"code": "KR-01", "name": "Kadam Residence", "address": "Plot 14, Road 7"}


def made(developer_id: uuid.UUID, *codes: str) -> dict[str, uuid.UUID]:
    """Projects made in the Developer as the system (the seed's way), by code."""
    with tenancy.acting_in(developer_id):
        return {code: services.create(code=code, name=f"Project {code}").id for code in codes}


def codes_listed(api: Api) -> list[str]:
    response = api.get("/api/projects")
    assert response.status_code == 200
    return [project["code"] for project in response.json()]


# Creating ----------------------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["qs", "vextrus_engineer"])
def test_a_qs_or_an_engineer_creates_a_project_on_the_markets_currency_and_units(
    team: dict[str, Member], market: MarketProfile, role: str
) -> None:
    api = api_as(team[role])

    created = api.post("/api/projects", KADAM)

    assert created.status_code == 201
    body = created.json()
    assert {key: body[key] for key in ("code", "name", "address")} == KADAM
    assert (body["market_id"], body["currency"], body["unit_system"]) == (
        str(market.id),
        market.currency.code,
        market.default_unit_system,
    )
    assert api.get(f"/api/projects/{body['id']}").json() == body
    assert codes_listed(api) == ["KR-01"]
    with team[role].acting():
        assert len(services.buildings(uuid.UUID(body["id"]))) == 1


@pytest.mark.django_db
def test_the_display_units_may_be_any_the_market_offers(
    team: dict[str, Member], market: MarketProfile
) -> None:
    created = api_as(team["qs"]).post("/api/projects", {**KADAM, "unit_system": market.unit_systems[-1]})

    assert (created.status_code, created.json()["unit_system"]) == (201, market.unit_systems[-1])


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["md", "guest"])
def test_the_md_and_a_guest_are_refused_by_role_before_the_service_runs(
    team: dict[str, Member], role: str
) -> None:
    refused = api_as(team[role]).post("/api/projects", KADAM)

    assert refused.status_code == 403
    assert refused.json() == {"code": "platform.auth.not_allowed", "params": {"role": role}}
    assert codes_listed(api_as(team["qs"])) == []


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["qs", "vextrus_engineer"])
def test_a_member_given_chosen_projects_is_refused_whatever_code_they_ask_for(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID], role: str
) -> None:
    developer = make_developer()
    ids = made(developer, "KR-01", "BP-02")
    member = sign_in(role=role, developer_id=developer, projects=[ids["KR-01"]])
    api = api_as(member)

    answers = [api.post("/api/projects", {"code": code, "name": "New"}) for code in ("NW-04", "BP-02")]

    expected = {"code": "projects.projects.scoped_member_cannot_create", "params": {}}
    assert [(answer.status_code, answer.json()) for answer in answers] == [(403, expected)] * 2


@pytest.mark.django_db
@pytest.mark.parametrize("field", ["currency", "currency_code", "market_id", "tenant_id"])
def test_a_create_body_carrying_a_currency_market_or_tenant_is_refused(
    team: dict[str, Member], field: str
) -> None:
    refused = api_as(team["qs"]).post("/api/projects", {**KADAM, field: str(uuid.uuid4())})

    assert refused.status_code == 422
    assert codes_listed(api_as(team["qs"])) == []


@pytest.mark.django_db
def test_a_create_without_the_csrf_token_is_refused(team: dict[str, Member]) -> None:
    refused = api_as(team["qs"]).post("/api/projects", KADAM, csrf=False)

    assert refused.status_code == 403
    assert refused.json() == {"code": "platform.auth.csrf_failed", "params": {}}
    assert codes_listed(api_as(team["qs"])) == []


@pytest.mark.django_db
def test_a_taken_code_is_409_naming_the_holder_by_its_own_code(team: dict[str, Member]) -> None:
    api = api_as(team["qs"])
    api.post("/api/projects", KADAM)

    refused = api.post("/api/projects", {"code": "kr-01", "name": "Another"})

    assert refused.status_code == 409
    assert refused.json() == {
        "field": "code",
        "message": {
            "code": "projects.projects.code_taken",
            "params": {"code": "KR-01", "name": "Kadam Residence"},
        },
    }
    assert codes_listed(api) == ["KR-01"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("body", "field", "message"),
    [
        ({"code": "KR-01", "name": " "}, "name", {"code": "projects.projects.name_missing"}),
        ({"code": "", "name": "Kadam"}, "code", {"code": "projects.projects.code_missing"}),
        (
            {"code": "K" * 33, "name": "Kadam"},
            "code",
            {"code": "projects.projects.too_long", "params": {"limit": 32}},
        ),
        (
            {"code": "KR-01", "name": "Kadam", "unit_system": "cubits"},
            "unit_system",
            {"code": "projects.projects.unit_system_not_offered"},
        ),
    ],
)
def test_a_value_refused_is_400_with_its_field(
    team: dict[str, Member], body: dict[str, str], field: str, message: dict[str, Any]
) -> None:
    refused = api_as(team["qs"]).post("/api/projects", body)

    assert refused.status_code == 400
    assert refused.json() == {"field": field, "message": {"params": {}, **message}}


# Listing and getting: the scope and the tenant ---------------------------------------------------


@pytest.fixture
def shapla(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_developer("Shapla Homes Ltd")


@pytest.fixture
def shaplas(shapla: uuid.UUID) -> dict[str, uuid.UUID]:
    return made(shapla, "KR-01", "BP-02", "SG-03")


@pytest.fixture
def meghnas(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return made(make_developer("Meghna Properties Ltd"), "MG-01")["MG-01"]


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["qs", "md", "vextrus_engineer", "guest"])
def test_a_member_given_every_project_lists_and_opens_them_all(
    sign_in: Callable[..., Member], shapla: uuid.UUID, shaplas: dict[str, uuid.UUID], role: str
) -> None:
    api = api_as(sign_in(role=role, developer_id=shapla))

    assert codes_listed(api) == ["BP-02", "KR-01", "SG-03"]
    assert api.get(f"/api/projects/{shaplas['SG-03']}").json()["code"] == "SG-03"


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["guest", "md", "qs"])
def test_a_member_given_chosen_projects_sees_only_those_and_404_for_the_rest(
    sign_in: Callable[..., Member],
    shapla: uuid.UUID,
    shaplas: dict[str, uuid.UUID],
    meghnas: uuid.UUID,
    role: str,
) -> None:
    api = api_as(sign_in(role=role, developer_id=shapla, projects=[shaplas["KR-01"]]))

    assert codes_listed(api) == ["KR-01"]
    assert api.get(f"/api/projects/{shaplas['KR-01']}").status_code == 200
    # Outside the scope, another Developer's, none at all: one status, one body.
    for project_id in (shaplas["BP-02"], meghnas, uuid.uuid4()):
        answer = api.get(f"/api/projects/{project_id}")
        assert (answer.status_code, answer.json()) == (404, NOT_FOUND)


@pytest.mark.django_db
def test_another_developers_projects_are_404_and_never_listed(
    sign_in: Callable[..., Member], shapla: uuid.UUID, shaplas: dict[str, uuid.UUID], meghnas: uuid.UUID
) -> None:
    # A member given every Project: the guard lets the id by, the service answers as the guard does.
    api = api_as(sign_in(role="qs", developer_id=shapla))

    assert meghnas not in {uuid.UUID(p["id"]) for p in api.get("/api/projects").json()}
    for project_id in (meghnas, uuid.uuid4()):
        answer = api.get(f"/api/projects/{project_id}")
        assert (answer.status_code, answer.json()) == (404, NOT_FOUND)


@pytest.mark.django_db
def test_a_project_id_that_is_no_uuid_is_refused_by_validation(team: dict[str, Member]) -> None:
    assert api_as(team["qs"]).get("/api/projects/KR-01").status_code == 422


@pytest.mark.django_db
def test_signed_out_nothing_is_listed_got_or_created(api: Api, shaplas: dict[str, uuid.UUID]) -> None:
    signed_out = {"code": "platform.auth.signed_out", "params": {}}

    answers = [
        api.get("/api/projects"),
        api.get(f"/api/projects/{shaplas['KR-01']}"),
        api.post("/api/projects", KADAM),
    ]

    assert [(answer.status_code, answer.json()) for answer in answers] == [(401, signed_out)] * 3


@pytest.mark.django_db
def test_no_answer_names_a_building(team: dict[str, Member]) -> None:
    api = api_as(team["qs"])
    created = api.post("/api/projects", KADAM).json()

    for answer in (
        created,
        api.get("/api/projects").json(),
        api.get(f"/api/projects/{created['id']}").json(),
    ):
        assert "Building" not in str(answer)
