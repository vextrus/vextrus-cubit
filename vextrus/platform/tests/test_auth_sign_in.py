"""Signing in and out, sessions, CSRF, choosing the current Developer, and `/api/me` (ticket 07)."""

import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.conf import settings
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.utils import timezone

from vextrus.platform.models import Membership, User
from vextrus.platform.services import markets, tenancy
from vextrus.testing.auth import Api, api_as
from vextrus.testing.tenancy import Member, add_member

PASSWORD = "a long enough passphrase 7"

pytestmark = pytest.mark.django_db


def person(email: str = "nusrat@example.com", name: str = "Nusrat Jahan") -> User:
    return User.objects.create_user(email, name, PASSWORD)


def sign_in(api: Api, email: str, password: str = PASSWORD) -> tuple[int, Any]:
    response = api.post("/api/auth/sign-in", {"email": email, "password": password})
    return response.status_code, response.json()


def test_signing_in_with_one_membership_works_in_its_developer(
    api: Api, make_developer: Callable[..., uuid.UUID], market: markets.MarketProfile
) -> None:
    developer = make_developer("Shapla Homes Ltd")
    user = person()
    add_member(developer, role="qs", user=user)

    code, me = sign_in(api, "NUSRAT@example.com")

    assert code == 200
    assert me["user"] == {"id": str(user.pk), "name": "Nusrat Jahan", "email": "nusrat@example.com"}
    assert me["developer_id"] == str(developer)
    assert [(m["developer_name"], m["role"], m["project_ids"]) for m in me["memberships"]] == [
        ("Shapla Homes Ltd", "qs", [])
    ]
    assert me["market"] == {
        "code": market.code,
        "name": market.labels["en"],
        "language": {"code": "en", "direction": "ltr"},
        "locale": market.borrowed_locales["en"],
        "grouping": market.grouping,
        "digits": market.digits,
        "currency": {
            "code": market.currency.code,
            "minor_units": market.currency.minor_units,
            "symbol": market.currency_symbol,
            "symbol_position": market.currency_symbol_position["en"],
        },
        "time_zone": market.time_zone,
        "unit_systems": {
            "offered": list(market.unit_systems),
            "default": market.default_unit_system,
        },
        "days_off": list(market.days_off),
    }
    assert api.get("/api/members").status_code == 200  # the session works in it


@pytest.mark.parametrize(
    ("email", "password"),
    [("nusrat@example.com", "wrong password here"), ("nobody@example.com", PASSWORD)],
)
def test_a_wrong_email_or_password_is_refused_without_saying_which(
    api: Api, email: str, password: str
) -> None:
    person()

    assert sign_in(api, email, password) == (
        401,
        {"code": "platform.auth.wrong_credentials", "params": {}},
    )
    assert api.get("/api/me").status_code == 401


def test_signing_in_needs_the_csrf_token(api: Api) -> None:
    person()

    response = api.post(
        "/api/auth/sign-in", {"email": "nusrat@example.com", "password": PASSWORD}, csrf=False
    )

    assert response.status_code == 403
    assert api.get("/api/me").status_code == 401


def test_signing_in_gives_the_session_a_new_key_and_a_new_csrf_token(api: Api) -> None:
    person()
    planted = SessionStore()
    planted[tenancy.SESSION_TENANT] = str(uuid.uuid4())
    planted.create()
    assert planted.session_key is not None
    api.client.cookies[settings.SESSION_COOKIE_NAME] = planted.session_key
    token_before = api.csrf_token()

    assert sign_in(api, "nusrat@example.com")[0] == 200

    assert api.session_key not in (None, planted.session_key)
    assert not Session.objects.filter(session_key=planted.session_key).exists()
    assert api.csrf_token() != token_before
    stored = SessionStore(session_key=api.session_key).load()
    assert tenancy.SESSION_TENANT not in stored  # what the planted session named is forgotten


def test_a_user_with_several_developers_chooses_one(
    api: Api, make_developer: Callable[..., uuid.UUID]
) -> None:
    shapla, meghna, other = make_developer("Shapla"), make_developer("Meghna"), make_developer()
    user = person()
    add_member(shapla, role="qs", user=user)
    add_member(meghna, role="guest", user=user)

    code, me = sign_in(api, "nusrat@example.com")
    assert code == 200
    assert me["developer_id"] is None
    assert me["market"] is None
    assert sorted(m["developer_name"] for m in me["memberships"]) == ["Meghna", "Shapla"]
    assert api.get("/api/members").json() == {"code": "platform.auth.choose_developer", "params": {}}

    chosen = api.post("/api/me/developer", {"developer_id": str(meghna)})
    assert chosen.status_code == 200
    assert chosen.json()["developer_id"] == str(meghna)
    assert api.get("/api/members").status_code == 403  # a Guest there: no Members page

    refused = api.post("/api/me/developer", {"developer_id": str(other)})
    assert (refused.status_code, refused.json()["code"]) == (404, "platform.auth.not_found")
    assert api.get("/api/me").json()["developer_id"] == str(meghna)


def test_a_developer_whose_membership_ended_cannot_be_chosen(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    member = sign_in(role="qs")
    ended = make_developer()
    add_member(ended, role="qs", user=member.user, expires_at=timezone.now() - timedelta(days=1))
    api = api_as(member)

    refused = api.post("/api/me/developer", {"developer_id": str(ended)})

    assert refused.status_code == 404
    assert api.get("/api/me").json()["developer_id"] == str(member.developer_id)


def test_signing_out_ends_the_session(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="qs")
    api = api_as(member)
    key = api.session_key

    assert api.post("/api/auth/sign-out").status_code == 204

    assert api.get("/api/me").status_code == 401
    assert not Session.objects.filter(session_key=key).exists()
    replayed = Api()
    assert key is not None
    replayed.client.cookies[settings.SESSION_COOKIE_NAME] = key
    assert replayed.get("/api/me").status_code == 401


def test_signing_out_needs_the_csrf_token(sign_in: Callable[..., Member]) -> None:
    api = api_as(sign_in(role="qs"))

    assert api.post("/api/auth/sign-out", csrf=False).status_code == 403
    assert api.get("/api/me").status_code == 200


def test_an_inactive_user_cannot_sign_in(api: Api) -> None:
    User.objects.create_user("gone@example.com", "Gone", PASSWORD, is_active=False)

    assert sign_in(api, "gone@example.com")[0] == 401


def test_me_carries_each_membership_s_projects_and_end(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    project = uuid.uuid4()
    until = timezone.now() + timedelta(days=28)
    guest = sign_in(role="guest", projects=[project], expires_at=until)

    me = api_as(guest).get("/api/me").json()

    [held] = me["memberships"]
    assert held["id"] == str(guest.membership_id)
    assert held["role"] == "guest"
    assert held["project_ids"] == [str(project)]
    assert held["expires_at"] is not None
    assert me["ended"] == []


def test_me_after_revocation_names_the_ended_access_and_no_developer(
    sign_in: Callable[..., Member],
) -> None:
    engineer = sign_in(role="vextrus_engineer")
    with engineer.acting():
        Membership.objects.filter(id=engineer.membership_id).update(revoked_at=timezone.now())
    api = api_as(engineer)

    assert api.get("/api/members").json() == {"code": "platform.auth.no_access", "params": {}}
    me = api.get("/api/me").json()

    assert me["developer_id"] is None
    assert me["memberships"] == []
    assert [(e["developer_id"], e["role"], e["how"]) for e in me["ended"]] == [
        (str(engineer.developer_id), "vextrus_engineer", "revoked")
    ]


def test_me_after_the_end_date_says_it_expired(sign_in: Callable[..., Member]) -> None:
    guest = sign_in(role="guest", expires_at=timezone.now() + timedelta(days=1))
    with guest.acting():
        Membership.objects.filter(id=guest.membership_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )

    me = api_as(guest).get("/api/me").json()

    assert [(e["how"], e["role"]) for e in me["ended"]] == [("expired", "guest")]


def test_the_csrf_endpoint_sets_the_cookie(api: Api) -> None:
    response = api.client.get("/api/auth/csrf")

    assert response.status_code == 200
    assert api.client.cookies[settings.CSRF_COOKIE_NAME].value
    assert response.json()["token"]


def test_signing_in_again_as_the_same_user_still_gives_a_new_key(api: Api) -> None:
    person()
    assert sign_in(api, "nusrat@example.com")[0] == 200
    first = api.session_key

    assert sign_in(api, "nusrat@example.com")[0] == 200

    assert api.session_key not in (None, first)
    assert not Session.objects.filter(session_key=first).exists()
    assert api.get("/api/me").status_code == 200
