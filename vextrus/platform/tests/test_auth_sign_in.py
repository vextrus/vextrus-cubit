"""Signing in and out, sessions, CSRF, choosing the current Developer, and `/api/me` (ticket 07)."""

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
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
    [ended] = me["ended"]
    assert (ended["revoked_by"], ended["project_ids"]) == (None, [])  # no act names who revoked it


def test_me_after_the_end_date_says_it_expired(sign_in: Callable[..., Member]) -> None:
    guest = sign_in(role="guest", expires_at=timezone.now() + timedelta(days=1))
    with guest.acting():
        Membership.objects.filter(id=guest.membership_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )

    me = api_as(guest).get("/api/me").json()

    assert [(e["how"], e["role"]) for e in me["ended"]] == [("expired", "guest")]


# "Access ended" on a fresh load (#75; m0-screens §4.1) ---------------------------------------------


def to_the_millisecond(moment: datetime) -> datetime:
    """A time as the API sends it (its JSON carries milliseconds)."""
    return moment.replace(microsecond=moment.microsecond // 1000 * 1000)


def shapla_with_md(make_developer: Callable[..., uuid.UUID]) -> tuple[uuid.UUID, Api]:
    """Shapla Homes Ltd and its MD, Kamal Uddin, signed in."""
    developer = make_developer("Shapla Homes Ltd")
    kamal = person("kamal@shapla-homes.example", "Kamal Uddin")
    add_member(developer, role="md", user=kamal)
    md = Api()
    assert sign_in(md, "kamal@shapla-homes.example")[0] == 200
    return developer, md


def test_a_fresh_browser_of_a_revoked_engineer_is_told_the_developer_who_revoked_it_and_when(
    make_developer: Callable[..., uuid.UUID], staff: User
) -> None:
    developer, md = shapla_with_md(make_developer)
    staff.set_password(PASSWORD)
    staff.save(update_fields=["password"])
    _engineer, membership = add_member(developer, role="vextrus_engineer", user=staff)
    assert md.post(f"/api/members/{membership}/revoke").status_code == 204

    browser = Api()
    code, me = sign_in(browser, staff.email)

    assert code == 200
    assert (me["developer_id"], me["memberships"], me["ended_membership_id"]) == (None, [], None)
    [ended] = me["ended"]
    with tenancy.acting_in(developer):
        revoked_at = Membership.objects.get(id=membership).revoked_at
    assert revoked_at is not None
    assert ended == {
        "membership_id": str(membership),
        "developer_id": str(developer),
        "developer_name": "Shapla Homes Ltd",
        "role": "vextrus_engineer",
        "ended_at": ended["ended_at"],
        "how": "revoked",
        "revoked_by": "Kamal Uddin",
        "project_ids": [],
    }
    assert datetime.fromisoformat(ended["ended_at"]) == to_the_millisecond(revoked_at)
    assert browser.get("/api/me").json()["ended"] == [ended]


def test_a_fresh_browser_of_an_expired_scoped_guest_is_told_the_developer_the_date_and_projects(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer("Shapla Homes Ltd")
    kr01 = uuid.uuid4()
    until = timezone.now() - timedelta(days=2)
    add_member(developer, role="guest", user=person(), projects=[kr01], expires_at=until)

    code, me = sign_in(Api(), "nusrat@example.com")

    assert code == 200
    [ended] = me["ended"]
    assert (ended["developer_name"], ended["how"], ended["revoked_by"], ended["project_ids"]) == (
        "Shapla Homes Ltd",
        "expired",
        None,
        [str(kr01)],
    )
    assert datetime.fromisoformat(ended["ended_at"]) == to_the_millisecond(until)


def test_a_session_whose_access_ends_keeps_saying_so_after_a_reload(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer, md = shapla_with_md(make_developer)
    guest = sign_in(role="guest", developer_id=developer)
    other = make_developer("Meghna Properties Ltd")
    add_member(other, role="qs", user=guest.user)
    api = api_as(guest)
    assert api.get("/api/me").json()["ended_membership_id"] is None

    assert md.post(f"/api/members/{guest.membership_id}/revoke").status_code == 204
    # Refused: they hold another Developer, so they are asked to choose.
    assert api.get("/api/projects").json() == {"code": "platform.auth.choose_developer", "params": {}}

    for _reload in range(2):
        me = api.get("/api/me").json()
        assert (me["developer_id"], me["ended_membership_id"]) == (None, str(guest.membership_id))
        assert [e["membership_id"] for e in me["ended"]] == [str(guest.membership_id)]
    chosen = api.post("/api/me/developer", {"developer_id": str(other)}).json()
    assert (chosen["developer_id"], chosen["ended_membership_id"]) == (str(other), None)
    assert api.get("/api/me").json()["ended_membership_id"] is None


def test_signing_out_and_in_again_forgets_the_ended_membership(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer, md = shapla_with_md(make_developer)
    user = person()
    _user, membership = add_member(developer, role="qs", user=user)
    api = Api()
    assert sign_in(api, user.email)[0] == 200
    md.post(f"/api/members/{membership}/revoke")
    api.get("/api/projects")
    assert api.get("/api/me").json()["ended_membership_id"] == str(membership)

    stored = SessionStore(session_key=api.session_key)
    assert stored.load()[tenancy.SESSION_ENDED] == str(membership)
    code, me = sign_in(api, user.email)  # again, on the same browser: a new session
    assert (code, me["ended_membership_id"]) == (200, None)
    assert api.post("/api/auth/sign-out").status_code == 204
    code, me = sign_in(api, user.email)
    assert (code, me["ended_membership_id"]) == (200, None)
    assert [e["membership_id"] for e in me["ended"]] == [str(membership)]


def plant(member: Member, value: str) -> None:
    """Write the session's ended Membership as no request would: the server alone sets it."""
    session = member.client.session
    session[tenancy.SESSION_ENDED] = value
    session.save()


@pytest.mark.parametrize("planted", ["random", "not a uuid", "another user's", "never ended"])
def test_a_planted_or_stale_ended_membership_is_never_answered(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID], planted: str
) -> None:
    developer, md = shapla_with_md(make_developer)
    member = sign_in(role="qs", developer_id=developer)
    theirs = sign_in(role="guest", developer_id=developer)
    md.post(f"/api/members/{theirs.membership_id}/revoke")
    value = {
        "random": str(uuid.uuid4()),
        "not a uuid": "x",
        "another user's": str(theirs.membership_id),
        "never ended": str(member.membership_id),
    }[planted]
    plant(member, value)
    api = api_as(member)

    me = api.get("/api/me").json()

    assert (me["developer_id"], me["ended_membership_id"], me["ended"]) == (
        str(developer),
        None,
        [],
    )
    assert tenancy.SESSION_ENDED not in SessionStore(session_key=api.session_key).load()
    assert str(theirs.membership_id) not in api.get("/api/me").content.decode()


def test_an_ended_membership_current_again_is_no_longer_answered(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer, md = shapla_with_md(make_developer)
    guest = sign_in(role="guest", developer_id=developer, expires_at=timezone.now() + timedelta(days=1))
    with guest.acting():
        Membership.objects.filter(id=guest.membership_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
    api = api_as(guest)
    assert api.get("/api/me").json()["ended_membership_id"] == str(guest.membership_id)

    assert md.post(f"/api/members/{guest.membership_id}/renew").status_code == 200

    me = api.get("/api/me").json()
    assert (me["ended_membership_id"], me["ended"]) == (None, [])
    assert [m["id"] for m in me["memberships"]] == [str(guest.membership_id)]
    with guest.acting():
        Membership.objects.filter(id=guest.membership_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
    assert api.get("/api/me").json()["ended_membership_id"] is None  # forgotten, not revived


def test_choosing_a_developer_never_held_ended_or_a_library_is_one_answer(
    sign_in: Callable[..., Member],
    make_developer: Callable[..., uuid.UUID],
    market: markets.MarketProfile,
) -> None:
    member = sign_in(role="qs")
    ended = make_developer("Ended Homes Ltd")
    add_member(ended, role="qs", user=member.user, expires_at=timezone.now() - timedelta(days=1))
    never = make_developer("Never Held Ltd")
    api = api_as(member)

    answers = {
        name: api.post("/api/me/developer", {"developer_id": str(developer)})
        for name, developer in (
            ("ended", ended),
            ("never held", never),
            ("library", market.library_id),
            ("random", uuid.uuid4()),
        )
    }

    assert {(r.status_code, r.content) for r in answers.values()} == {
        (404, b'{"code": "platform.auth.not_found", "params": {}}')
    }
    assert api.get("/api/me").json()["developer_id"] == str(member.developer_id)


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


def test_the_session_keeps_the_ended_membership_of_the_developer_it_forgot_not_the_newest(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    worked_in = make_developer("Shapla Homes Ltd")
    guest = sign_in(role="guest", developer_id=worked_in, expires_at=timezone.now() + timedelta(days=1))
    with guest.acting():
        Membership.objects.filter(id=guest.membership_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
    elsewhere = make_developer("Meghna Properties Ltd")
    _user, newer = add_member(elsewhere, role="qs", user=guest.user)
    with tenancy.acting_in(elsewhere):
        Membership.objects.filter(id=newer).update(revoked_at=timezone.now())
    api = api_as(guest)

    api.get("/api/projects")  # the session forgets Shapla here
    me = api.get("/api/me").json()

    assert [e["membership_id"] for e in me["ended"]] == [str(newer), str(guest.membership_id)]
    assert me["ended_membership_id"] == str(guest.membership_id)
