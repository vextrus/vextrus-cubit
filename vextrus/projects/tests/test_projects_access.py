"""The Projects of ended access and of an invitation link, by code (#75; m0-screens §4.1 and §4.2):
projects' two named cross-tenant functions, `GET /api/ended-access/projects` and
`POST /api/invitations/look-up/projects`, and each attacked as someone who should learn nothing."""

import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.db import connections
from django.test import Client
from django.utils import timezone

from vextrus.platform.services import invitations, markets, tenancy
from vextrus.projects import services
from vextrus.projects.models import Project
from vextrus.testing.auth import Api, accept_as, api_as, invitation
from vextrus.testing.tenancy import Member, add_member

pytestmark = pytest.mark.django_db

SIGNATURES = ("ended_access_projects()", "invitation_projects(uuid,text)")


@pytest.mark.parametrize("signature", SIGNATURES)
def test_each_function_is_the_owner_s_definer_with_its_search_path_pinned_run_only_by_the_app(
    signature: str,
) -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            select pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig,
                   array(select coalesce(pg_get_userbyid(a.grantee), 'PUBLIC')
                           from aclexplode(p.proacl) a where a.privilege_type = 'EXECUTE'
                          order by 1),
                   has_function_privilege('public', p.oid, 'EXECUTE'),
                   has_function_privilege('pg_read_all_data', p.oid, 'EXECUTE')
              from pg_proc p where p.oid = %s::regprocedure
            """,
            [f"public.{signature}"],
        )
        owner, definer, config, executors, public, unrelated = cursor.fetchone()

    assert owner == "vextrus"
    assert definer is True
    assert config == ["search_path=pg_catalog, pg_temp"]
    assert executors == ["vextrus", "vextrus_app"]
    assert (public, unrelated) == (False, False)


@pytest.fixture
def shapla(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_developer("Shapla Homes Ltd")


@pytest.fixture
def made(shapla: uuid.UUID) -> dict[str, uuid.UUID]:
    """Shapla's three Projects, by code."""
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
def md(sign_in: Callable[..., Member], shapla: uuid.UUID) -> Member:
    return sign_in(role="md", developer_id=shapla, email="kamal@shapla-homes.example")


def ended_guest(
    developer: uuid.UUID, projects: list[uuid.UUID], email: str = "farhana@padma-builders.example"
) -> tuple[Any, uuid.UUID]:
    """A Guest given `projects` (none: every Project), whose end date has passed: (user, its id)."""
    until = timezone.now() - timedelta(days=1)
    return add_member(developer, role="guest", email=email, projects=projects, expires_at=until)


def signed_in(user: Any) -> Api:
    """A fresh browser signed in as `user`: a new session, naming no Developer. (Signing in by
    password, the same answers: platform's `test_auth_sign_in` and the seed's tests.)"""
    client = Client()
    client.force_login(user)
    return Api(client)


def delete_project(developer: uuid.UUID, project: uuid.UUID) -> None:
    with tenancy.acting_in(developer):
        Project.objects.filter(id=project).delete()


# Ended access -------------------------------------------------------------------------------------


def test_a_fresh_browser_of_an_expired_scoped_guest_gets_its_projects_codes(
    shapla: uuid.UUID, made: dict[str, uuid.UUID]
) -> None:
    guest, membership = ended_guest(shapla, [made["KR-01"]])
    api = signed_in(guest)

    [ended] = api.get("/api/me").json()["ended"]
    response = api.get("/api/ended-access/projects")

    assert (ended["membership_id"], ended["developer_name"], ended["how"]) == (
        str(membership),
        "Shapla Homes Ltd",
        "expired",
    )
    assert response.status_code == 200
    assert response.json() == [{"membership_id": str(membership), "codes": ["KR-01"]}]


def test_codes_are_those_the_membership_gave_by_code_and_never_the_developer_s_others(
    shapla: uuid.UUID, made: dict[str, uuid.UUID], md: Member
) -> None:
    guest, membership = add_member(shapla, role="guest", projects=[made["KR-01"], made["BP-02"]])
    with md.acting():
        invitations.revoke(membership)

    with tenancy.acting_in(None, user_id=guest.pk):
        found = services.ended_access_codes()

    assert found == [services.EndedCodes(membership, ("BP-02", "KR-01"))]


def test_access_to_every_project_and_current_access_have_no_codes(
    shapla: uuid.UUID, made: dict[str, uuid.UUID], sign_in: Callable[..., Member]
) -> None:
    everything, _ = ended_guest(shapla, [])
    current = sign_in(role="guest", developer_id=shapla, projects=[made["KR-01"]])

    assert signed_in(everything).get("/api/ended-access/projects").json() == []
    assert api_as(current).get("/api/ended-access/projects").json() == []


def test_a_project_deleted_since_drops_out_without_an_error(
    shapla: uuid.UUID, made: dict[str, uuid.UUID]
) -> None:
    guest, membership = ended_guest(shapla, [made["KR-01"], made["BP-02"]])
    api = signed_in(guest)

    delete_project(shapla, made["BP-02"])
    assert api.get("/api/ended-access/projects").json() == [
        {"membership_id": str(membership), "codes": ["KR-01"]}
    ]
    delete_project(shapla, made["KR-01"])
    assert api.get("/api/ended-access/projects").json() == []
    assert api.get("/api/me").json()["ended"][0]["project_ids"] == sorted(
        [str(made["KR-01"]), str(made["BP-02"])]
    )


def test_another_user_s_ended_access_never_gives_its_codes(
    shapla: uuid.UUID,
    made: dict[str, uuid.UUID],
    make_developer: Callable[..., uuid.UUID],
    sign_in: Callable[..., Member],
) -> None:
    mine, my_membership = ended_guest(shapla, [made["KR-01"]])
    ended_guest(shapla, [made["BP-02"]], email="other@padma-builders.example")
    meghna = make_developer("Meghna Properties Ltd")
    with tenancy.acting_in(meghna):
        mg01 = services.create(code="MG-01", name="Meghna Heights").id
    ended_guest(meghna, [mg01], email="third@example.com")
    stranger = sign_in(role="qs", developer_id=shapla)

    assert signed_in(mine).get("/api/ended-access/projects").json() == [
        {"membership_id": str(my_membership), "codes": ["KR-01"]}
    ]
    body = api_as(stranger).get("/api/ended-access/projects")
    assert body.json() == []


def test_signed_out_no_codes(api: Api) -> None:
    response = api.get("/api/ended-access/projects")

    assert (response.status_code, response.json()) == (
        401,
        {"code": "platform.auth.signed_out", "params": {}},
    )


def test_with_no_user_set_the_function_gives_nothing(
    shapla: uuid.UUID, made: dict[str, uuid.UUID]
) -> None:
    ended_guest(shapla, [made["KR-01"]])

    with tenancy.acting_in(None), connections["default"].cursor() as cursor:
        cursor.execute("select * from public.ended_access_projects()")
        assert cursor.fetchall() == []


def shadow(cursor: Any, tables: tuple[str, ...]) -> None:
    """The caller's own tables, named as the functions' tables, holding what would leak."""
    for table in tables:
        cursor.execute(f"create temporary table {table} (like public.{table})")


def test_a_table_the_caller_makes_named_projects_project_shadows_nothing(
    shapla: uuid.UUID, made: dict[str, uuid.UUID], market: markets.MarketProfile
) -> None:
    guest, _membership = ended_guest(shapla, [made["KR-01"]])
    with tenancy.acting_in(None, user_id=guest.pk):
        before = services.ended_access_codes()
    assert before

    with tenancy.acting_in(None, user_id=guest.pk), connections["default"].cursor() as cursor:
        shadow(cursor, ("projects_project", "platform_membership", "platform_membershipproject"))
        cursor.execute(
            "insert into pg_temp.projects_project (id, tenant_id, code, code_key, name, address, "
            "market_id, currency_code, unit_system, created_at) "
            "values (%s, %s, 'XX-99', 'xx-99', 'Shadow', '', %s, 'XXX', 'metric', now())",
            [made["KR-01"], shapla, market.id],
        )
        after = services.ended_access_codes()

    assert after == before


# An invitation link's Projects --------------------------------------------------------------------


def look_up_projects(token: str, *, csrf: bool = True) -> Any:
    return Api().post("/api/invitations/look-up/projects", {"token": token}, csrf=csrf)


def test_a_link_names_the_projects_it_gives_by_code_and_name(
    md: Member, made: dict[str, uuid.UUID]
) -> None:
    _, token = invitation(md, "farhana@padma-builders.example", "guest", project_ids=[made["KR-01"]])
    _, both = invitation(
        md, "rafiq@padma-builders.example", "guest", project_ids=[made["SG-03"], made["BP-02"]]
    )
    _, everything = invitation(md, "rumana@shapla-homes.example", "qs")

    response = look_up_projects(token)

    assert response.status_code == 200
    assert response.json() == [{"code": "KR-01", "name": "Kadam Residence"}]
    assert look_up_projects(both).json() == [
        {"code": "BP-02", "name": "Bokul Place"},
        {"code": "SG-03", "name": "Shimul Garden"},
    ]
    assert look_up_projects(everything).json() == []


def test_a_project_deleted_since_the_invitation_drops_out(
    md: Member, made: dict[str, uuid.UUID], shapla: uuid.UUID
) -> None:
    _, token = invitation(
        md, "farhana@padma-builders.example", "guest", project_ids=[made["KR-01"], made["BP-02"]]
    )

    delete_project(shapla, made["BP-02"])

    assert look_up_projects(token).json() == [{"code": "KR-01", "name": "Kadam Residence"}]


UNUSABLE = ["used", "withdrawn", "link expired", "guessed", "another developer's", "malformed", ""]


@pytest.mark.parametrize("case", UNUSABLE)
def test_an_unusable_link_is_refused_as_the_look_up_refuses_it_byte_for_byte(
    md: Member,
    made: dict[str, uuid.UUID],
    shapla: uuid.UUID,
    make_developer: Callable[..., uuid.UUID],
    staff: Any,
    settings: Any,
    case: str,
) -> None:
    membership, token = invitation(md, staff.email, "guest", project_ids=[made["KR-01"]])
    tenant, secret = token.split(".", 1)
    if case == "used":
        accept_as(token, staff)
    elif case == "withdrawn":
        with md.acting():
            invitations.withdraw(membership)
    elif case == "link expired":  # a link made to work until yesterday
        settings.VEXTRUS_INVITATION_DAYS = -1
        _, token = invitation(md, "late@example.com", "guest", project_ids=[made["KR-01"]])
    elif case == "guessed":
        token = f"{tenant}.{secret[:-1]}{'y' if secret.endswith('x') else 'x'}"
    elif case == "another developer's":
        token = f"{make_developer('Meghna Properties Ltd')}.{secret}"
    elif case == "malformed":
        token = secret
    else:
        token = ""

    projects = look_up_projects(token)
    look_up = Api().post("/api/invitations/look-up", {"token": token})

    assert (projects.status_code, projects.content) == (look_up.status_code, look_up.content)
    assert projects.content == b'{"code": "platform.invitations.unusable", "params": {}}'
    assert "KR-01" not in projects.content.decode()


def test_a_token_too_long_is_refused_as_the_look_up_refuses_it() -> None:
    token = "x" * 201

    projects = look_up_projects(token)
    look_up = Api().post("/api/invitations/look-up", {"token": token})

    assert projects.status_code == 422
    assert (projects.status_code, projects.content) == (look_up.status_code, look_up.content)


def test_the_link_s_projects_need_the_csrf_token(md: Member, made: dict[str, uuid.UUID]) -> None:
    _, token = invitation(md, "farhana@padma-builders.example", "guest", project_ids=[made["KR-01"]])

    response = look_up_projects(token, csrf=False)

    assert (response.status_code, response.json()) == (
        403,
        {"code": "platform.auth.csrf_failed", "params": {}},
    )


def test_as_sql_only_the_exact_token_hash_names_projects(
    md: Member, made: dict[str, uuid.UUID], shapla: uuid.UUID, market: markets.MarketProfile
) -> None:
    _, token = invitation(md, "farhana@padma-builders.example", "guest", project_ids=[made["KR-01"]])
    parts = tenancy.invitation_token_parts(token)
    assert parts is not None
    tenant_id, token_hash = parts

    with tenancy.acting_in(None), connections["default"].cursor() as cursor:
        cursor.execute("select * from public.invitation_projects(%s, %s)", [tenant_id, token_hash])
        assert cursor.fetchall() == [("KR-01", "Kadam Residence")]
        for wrong in (
            (tenant_id, ""),
            (tenant_id, token_hash[:-1] + ("1" if token_hash.endswith("0") else "0")),
            (market.library_id, token_hash),
        ):
            cursor.execute("select * from public.invitation_projects(%s, %s)", list(wrong))
            assert cursor.fetchall() == [], wrong

        shadow(cursor, ("projects_project", "platform_membership", "platform_developer"))
        cursor.execute(
            "insert into pg_temp.projects_project (id, tenant_id, code, code_key, name, address, "
            "market_id, currency_code, unit_system, created_at) "
            "values (%s, %s, 'XX-99', 'xx-99', 'Shadow', '', %s, 'XXX', 'metric', now())",
            [made["KR-01"], shapla, market.id],
        )
        cursor.execute("select * from public.invitation_projects(%s, %s)", [tenant_id, token_hash])
        assert cursor.fetchall() == [("KR-01", "Kadam Residence")]


# Another Developer's Project id, planted where only the id is checked -----------------------------


@pytest.fixture
def meghna_secret(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    """Another Developer's Project, whose id an MD could name (a Project id is an upward stamp in
    platform: nothing there resolves it)."""
    meghna = make_developer("Meghna Properties Ltd")
    with tenancy.acting_in(meghna):
        return services.create(code="MX-77", name="Meghna Secret Tower").id


def test_a_link_never_names_another_developer_s_project_it_was_given_by_id(
    md: Member, made: dict[str, uuid.UUID], meghna_secret: uuid.UUID
) -> None:
    _, both = invitation(
        md, "farhana@padma-builders.example", "guest", project_ids=[made["KR-01"], meghna_secret]
    )
    _, only_theirs = invitation(md, "rafiq@padma-builders.example", "guest", project_ids=[meghna_secret])

    assert look_up_projects(both).json() == [{"code": "KR-01", "name": "Kadam Residence"}]
    assert look_up_projects(only_theirs).json() == []


def test_ended_access_never_names_another_developer_s_project_it_was_given_by_id(
    shapla: uuid.UUID, made: dict[str, uuid.UUID], meghna_secret: uuid.UUID
) -> None:
    guest, membership = ended_guest(shapla, [made["KR-01"], meghna_secret])
    other, _ = ended_guest(shapla, [meghna_secret], email="rafiq@padma-builders.example")

    assert signed_in(guest).get("/api/ended-access/projects").json() == [
        {"membership_id": str(membership), "codes": ["KR-01"]}
    ]
    body = signed_in(other).get("/api/ended-access/projects")
    assert body.json() == []
    assert "MX-77" not in body.content.decode()
