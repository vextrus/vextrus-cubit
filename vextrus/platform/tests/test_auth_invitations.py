"""Invitations by copied link, who invites whom, renew, revoke, and the next request after an end
(ticket 07; m0-screens §1.4, §4.2, §4.4 and §9's rulings)."""

import hashlib
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta

import pytest
from django.db import connection
from django.utils import timezone

from vextrus.platform.messages import invitations as codes
from vextrus.platform.models import DomainEvent, Membership, MembershipProject, User
from vextrus.platform.services import auth, invitations, tenancy
from vextrus.testing.auth import Api, api_as, invitation
from vextrus.testing.tenancy import Member, add_member

PASSWORD = "a long enough passphrase 7"

pytestmark = pytest.mark.django_db


def refusal(response: object) -> tuple[int, str]:
    return response.status_code, response.json()["code"]  # type: ignore[attr-defined]


def invite(api: Api, email: str, role: str, **fields: object) -> object:
    return api.post("/api/members/invitations", {"email": email, "role": role, **fields})


def membership(member: Member, membership_id: uuid.UUID) -> Membership:
    with member.acting():
        return Membership.objects.get(id=membership_id)


# Who invites whom ---------------------------------------------------------------------------------


@pytest.mark.parametrize("role", ["qs", "md", "guest", "vextrus_engineer"])
def test_the_md_invites_every_role(team: dict[str, Member], role: str) -> None:
    response = invite(api_as(team["md"]), f"new-{role}@example.com", role)

    assert response.status_code == 201  # type: ignore[attr-defined]
    made = membership(team["md"], uuid.UUID(response.json()["membership_id"]))  # type: ignore[attr-defined]
    assert (made.role, made.invited_by_id, made.user_id) == (role, team["md"].user.pk, None)


@pytest.mark.parametrize("role", ["qs", "md", "guest"])
def test_a_qs_invites_only_a_vextrus_engineer(team: dict[str, Member], role: str) -> None:
    qs = api_as(team["qs"])

    assert refusal(invite(qs, "x@example.com", role)) == (403, codes.ROLE_NOT_YOURS.code)
    assert invite(qs, "arif@example.com", "vextrus_engineer").status_code == 201  # type: ignore[attr-defined]


@pytest.mark.parametrize("inviter", ["vextrus_engineer", "guest"])
def test_an_engineer_and_a_guest_invite_no_one(team: dict[str, Member], inviter: str) -> None:
    response = invite(api_as(team[inviter]), "x@example.com", "vextrus_engineer")

    assert refusal(response) == (403, "platform.auth.not_allowed")


def test_a_qs_given_chosen_projects_invites_only_to_those(
    sign_in: Callable[..., Member],
) -> None:
    mine, also_mine, other = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    qs = sign_in(role="qs", projects=[mine, also_mine])
    api = api_as(qs)

    assert refusal(invite(api, "a@example.com", "vextrus_engineer")) == (
        403,
        codes.PROJECTS_NOT_YOURS.code,
    )
    assert refusal(invite(api, "a@example.com", "vextrus_engineer", project_ids=[str(other)])) == (
        404,
        "platform.auth.not_found",
    )
    assert refusal(invite(api, "a@example.com", "vextrus_engineer", project_ids=[])) == (
        400,
        codes.CHOOSE_A_PROJECT.code,
    )
    made = invite(api, "a@example.com", "vextrus_engineer", project_ids=[str(mine)])
    assert made.status_code == 201  # type: ignore[attr-defined]
    with qs.acting():
        assert list(
            MembershipProject.objects.filter(
                membership_id=made.json()["membership_id"]  # type: ignore[attr-defined]
            ).values_list("project_id", flat=True)
        ) == [mine]


def test_an_engineer_s_access_ends_30_days_ahead_by_default_a_guest_s_only_if_chosen(
    team: dict[str, Member],
) -> None:
    md = api_as(team["md"])
    engineer = invite(md, "e@example.com", "vextrus_engineer").json()  # type: ignore[attr-defined]
    guest = invite(md, "g@example.com", "guest").json()  # type: ignore[attr-defined]
    until = timezone.now() + timedelta(days=5)
    dated = invite(md, "d@example.com", "guest", expires_at=until.isoformat()).json()  # type: ignore[attr-defined]

    expires = membership(team["md"], uuid.UUID(engineer["membership_id"])).expires_at
    assert expires is not None
    assert abs(expires - (timezone.now() + timedelta(days=30))) < timedelta(minutes=1)
    assert membership(team["md"], uuid.UUID(guest["membership_id"])).expires_at is None
    assert membership(team["md"], uuid.UUID(dated["membership_id"])).expires_at == until
    link_until = timezone.now() + timedelta(days=7)
    assert abs(datetime.fromisoformat(engineer["link_expires_at"]) - link_until) < timedelta(minutes=1)


def test_an_end_date_in_the_past_or_a_bad_email_is_refused(team: dict[str, Member]) -> None:
    md = api_as(team["md"])
    past = (timezone.now() - timedelta(days=1)).isoformat()

    assert refusal(invite(md, "p@example.com", "guest", expires_at=past)) == (
        400,
        codes.END_IN_PAST.code,
    )
    assert refusal(invite(md, "not an email", "guest")) == (400, codes.INVALID_EMAIL.code)


def test_someone_already_a_member_or_invited_is_refused(
    team: dict[str, Member], sign_in: Callable[..., Member]
) -> None:
    md = api_as(team["md"])
    ended = User.objects.create_user("ended@example.com", "Ended")
    add_member(
        team["md"].developer_id,
        role="guest",
        user=ended,
        expires_at=timezone.now() + timedelta(seconds=1),
    )
    with team["md"].acting():
        Membership.objects.filter(user=ended).update(expires_at=timezone.now())
    invite(md, "pending@example.com", "qs")

    assert refusal(invite(md, team["qs"].user.email.upper(), "guest")) == (
        409,
        codes.ALREADY_MEMBER.code,
    )
    assert refusal(invite(md, "Pending@Example.com", "qs")) == (409, codes.ALREADY_INVITED.code)
    assert refusal(invite(md, "ended@example.com", "guest")) == (409, codes.ACCESS_ENDED.code)


# The link -----------------------------------------------------------------------------------------


def test_only_the_token_s_hash_is_kept_and_no_event_holds_it(team: dict[str, Member]) -> None:
    membership_id, token = invitation(team["md"], "arif@example.com")

    made = membership(team["md"], membership_id)
    assert made.invite_token_hash == hashlib.sha256(token.encode()).hexdigest()
    secret = token.split(".", 1)[1]
    with connection.cursor() as cursor:
        cursor.execute("select row_to_json(m)::text from platform_membership m")
        rows = " ".join(row[0] for row in cursor.fetchall())
    with team["md"].acting():
        payloads = " ".join(str(p) for p in DomainEvent.objects.values_list("payload", flat=True))
    assert secret not in rows
    assert secret not in payloads
    assert token.startswith(f"{team['md'].developer_id}.")


def test_the_link_page_says_what_it_offers(team: dict[str, Member]) -> None:
    project = uuid.uuid4()
    _, token = invitation(team["md"], "farhana@example.com", "guest", project_ids=[project])

    page = Api().post("/api/invitations/look-up", {"token": token})

    assert page.status_code == 200
    details = page.json()
    assert (details["invited_by"], details["role"], details["email"]) == (
        team["md"].user.name,
        "guest",
        "farhana@example.com",
    )
    assert details["project_ids"] == [str(project)]
    assert details["has_account"] is False


def accept_new(token: str, name: str = "Arif Rahman", password: str = PASSWORD) -> tuple[Api, object]:
    api = Api()
    return api, api.post("/api/invitations/accept", {"token": token, "name": name, "password": password})


def test_a_new_person_joins_by_the_link_and_works_in_the_developer(team: dict[str, Member]) -> None:
    membership_id, token = invitation(team["md"], "arif@example.com")

    api, response = accept_new(token)

    assert response.status_code == 200  # type: ignore[attr-defined]
    me = response.json()  # type: ignore[attr-defined]
    assert me["developer_id"] == str(team["md"].developer_id)
    assert me["user"]["email"] == "arif@example.com"
    assert [m["role"] for m in me["memberships"]] == ["vextrus_engineer"]
    joined = membership(team["md"], membership_id)
    assert joined.user is not None
    assert joined.user.check_password(PASSWORD)
    assert (joined.invite_token_hash, joined.accepted_at is not None) == ("", True)
    assert api.get("/api/members").status_code == 200
    with team["md"].acting():
        assert DomainEvent.objects.filter(
            kind=codes.ACCEPTED.code, subject_id=membership_id, actor_user_id=joined.user_id
        ).exists()


def test_a_link_works_once(team: dict[str, Member]) -> None:
    _, token = invitation(team["md"], "arif@example.com")
    accept_new(token)

    assert refusal(accept_new(token, name="Someone Else")[1]) == (404, codes.UNUSABLE.code)
    assert refusal(Api().post("/api/invitations/look-up", {"token": token})) == (
        404,
        codes.UNUSABLE.code,
    )


def test_a_link_stops_working_after_7_days(team: dict[str, Member]) -> None:
    membership_id, token = invitation(team["md"], "arif@example.com")
    with team["md"].acting():
        Membership.objects.filter(id=membership_id).update(
            invite_expires_at=timezone.now() - timedelta(seconds=1)
        )

    assert refusal(accept_new(token)[1]) == (404, codes.UNUSABLE.code)
    assert not User.objects.filter(email="arif@example.com").exists()


def test_a_withdrawn_link_stops_working(team: dict[str, Member]) -> None:
    membership_id, token = invitation(team["md"], "arif@example.com")

    assert (
        api_as(team["md"]).post(f"/api/members/invitations/{membership_id}/withdraw").status_code == 204
    )

    assert refusal(accept_new(token)[1]) == (404, codes.UNUSABLE.code)


def test_a_link_whose_access_would_already_have_ended_is_not_taken(team: dict[str, Member]) -> None:
    membership_id, token = invitation(
        team["md"], "g@example.com", "guest", expires_at=timezone.now() + timedelta(hours=1)
    )
    with team["md"].acting():
        Membership.objects.filter(id=membership_id).update(expires_at=timezone.now())

    assert refusal(accept_new(token)[1]) == (404, codes.UNUSABLE.code)


def test_a_link_names_its_own_developer_only(
    team: dict[str, Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    other = make_developer()
    _, token = invitation(team["md"], "arif@example.com")
    moved = f"{other}.{token.split('.', 1)[1]}"

    assert refusal(accept_new(moved)[1]) == (404, codes.UNUSABLE.code)
    assert refusal(accept_new(token + "x")[1]) == (404, codes.UNUSABLE.code)
    assert refusal(accept_new("not-a-token")[1]) == (404, codes.UNUSABLE.code)


def test_a_new_link_replaces_the_old_one_and_keeps_its_end(team: dict[str, Member]) -> None:
    membership_id, old = invitation(team["md"], "arif@example.com")
    before = membership(team["md"], membership_id).invite_expires_at

    response = api_as(team["md"]).post(f"/api/members/invitations/{membership_id}/link")

    assert response.status_code == 200
    new = response.json()["token"]
    assert new != old
    assert before is not None
    kept = datetime.fromisoformat(response.json()["link_expires_at"])
    assert abs(kept - before) < timedelta(milliseconds=1)
    assert refusal(accept_new(old)[1]) == (404, codes.UNUSABLE.code)
    assert accept_new(new)[1].status_code == 200  # type: ignore[attr-defined]


def test_accepting_needs_the_csrf_token(team: dict[str, Member]) -> None:
    membership_id, token = invitation(team["md"], "arif@example.com")

    response = Api().post(
        "/api/invitations/accept",
        {"token": token, "name": "Arif", "password": PASSWORD},
        csrf=False,
    )

    assert response.status_code == 403
    assert membership(team["md"], membership_id).user_id is None


def test_a_short_password_or_no_name_is_refused(team: dict[str, Member]) -> None:
    _, token = invitation(team["md"], "arif@example.com")

    short = accept_new(token, password="short")[1]
    assert (short.status_code, short.json()) == (  # type: ignore[attr-defined]
        400,
        {"code": "platform.auth.password_too_short", "params": {"min": 12}},
    )
    assert refusal(accept_new(token, name="  ")[1]) == (400, codes.NAME_REQUIRED.code)
    assert not User.objects.filter(email="arif@example.com").exists()


def test_someone_with_an_account_signs_in_to_accept(
    team: dict[str, Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    elsewhere = make_developer()
    user = User.objects.create_user("arif@example.com", "Arif Rahman", PASSWORD)
    add_member(elsewhere, role="qs", user=user)
    membership_id, token = invitation(team["md"], "arif@example.com")

    assert refusal(accept_new(token)[1]) == (409, codes.SIGN_IN_FIRST.code)
    other = api_as(team["qs"])
    assert refusal(other.post("/api/invitations/accept", {"token": token})) == (
        403,
        codes.WRONG_ACCOUNT.code,
    )

    api = Api()
    api.post("/api/auth/sign-in", {"email": "arif@example.com", "password": PASSWORD})
    accepted = api.post("/api/invitations/accept", {"token": token})

    assert accepted.status_code == 200
    assert accepted.json()["developer_id"] == str(team["md"].developer_id)
    assert membership(team["md"], membership_id).user_id == user.pk
    assert User.objects.get(pk=user.pk).check_password(PASSWORD)  # untouched


def test_a_member_cannot_accept_a_second_membership_in_one_developer(team: dict[str, Member]) -> None:
    _, token = invitation(team["md"], "arif@example.com")
    with team["md"].acting():
        Membership.objects.filter(invited_email="arif@example.com").update(
            invited_email=team["qs"].user.email
        )

    response = api_as(team["qs"]).post("/api/invitations/accept", {"token": token})

    assert refusal(response) == (409, codes.ALREADY_MEMBER.code)


# Revoking, renewing, withdrawing ----------------------------------------------------------------


def test_revoked_access_refuses_the_next_request_of_an_existing_session(
    team: dict[str, Member],
) -> None:
    guest = api_as(team["guest"])
    assert guest.get("/api/me").json()["developer_id"] == str(team["guest"].developer_id)

    response = api_as(team["md"]).post(f"/api/members/{team['guest'].membership_id}/revoke")

    assert response.status_code == 204
    assert refusal(guest.get("/api/members")) == (403, "platform.auth.no_developer")
    assert refusal(guest.post("/api/members/invitations", {"email": "x@e.com", "role": "qs"})) == (
        403,
        "platform.auth.no_developer",
    )
    assert refusal(
        guest.post("/api/me/developer", {"developer_id": str(team["guest"].developer_id)})
    ) == (
        404,
        "platform.auth.not_found",
    )
    with team["md"].acting():
        assert DomainEvent.objects.filter(
            kind=codes.REVOKED.code, actor_user_id=team["md"].user.pk
        ).exists()


def test_expired_access_refuses_the_next_request(team: dict[str, Member]) -> None:
    engineer = api_as(team["vextrus_engineer"])
    assert engineer.get("/api/members").status_code == 200

    with team["md"].acting():
        Membership.objects.filter(id=team["vextrus_engineer"].membership_id).update(
            expires_at=timezone.now()
        )

    assert refusal(engineer.get("/api/members")) == (403, "platform.auth.no_developer")


def test_the_md_renews_30_days_and_an_expired_engineer_works_again(team: dict[str, Member]) -> None:
    engineer = team["vextrus_engineer"]
    ended = timezone.now() - timedelta(days=2)
    with team["md"].acting():
        Membership.objects.filter(id=engineer.membership_id).update(expires_at=ended)
    md = api_as(team["md"])

    renewed = md.post(f"/api/members/{engineer.membership_id}/renew")

    assert renewed.status_code == 200
    until = datetime.fromisoformat(renewed.json()["expires_at"])
    assert abs(until - (timezone.now() + timedelta(days=30))) < timedelta(minutes=1)
    assert (
        api_as(engineer)
        .post("/api/me/developer", {"developer_id": str(engineer.developer_id)})
        .status_code
        == 200
    )
    again = md.post(f"/api/members/{engineer.membership_id}/renew").json()
    assert datetime.fromisoformat(again["expires_at"]) - until == timedelta(days=30)


def test_access_without_an_end_date_is_not_renewed(team: dict[str, Member]) -> None:
    response = api_as(team["md"]).post(f"/api/members/{team['qs'].membership_id}/renew")

    assert refusal(response) == (409, codes.NO_END_DATE.code)


def test_a_qs_ends_only_an_engineer_they_invited(team: dict[str, Member]) -> None:
    qs = api_as(team["qs"])
    mine, _ = invitation(team["qs"], "mine@example.com")
    theirs, _ = invitation(team["md"], "theirs@example.com")
    _, token = invitation(team["qs"], "joined@example.com")
    accept_new(token, name="Joined")
    joined = membership(team["md"], _id_of(team["md"], "joined@example.com"))

    assert qs.post(f"/api/members/invitations/{mine}/withdraw").status_code == 204
    assert refusal(qs.post(f"/api/members/invitations/{theirs}/withdraw")) == (
        403,
        codes.NOT_YOURS_TO_CHANGE.code,
    )
    for target in ("vextrus_engineer", "guest", "md"):  # invited by no one here
        assert refusal(qs.post(f"/api/members/{team[target].membership_id}/revoke")) == (
            403,
            codes.NOT_YOURS_TO_CHANGE.code,
        )
    assert qs.post(f"/api/members/{joined.id}/renew").status_code == 200
    assert qs.post(f"/api/members/{joined.id}/revoke").status_code == 204
    assert refusal(qs.post(f"/api/members/{joined.id}/revoke")) == (409, codes.ALREADY_ENDED.code)


def _id_of(member: Member, email: str) -> uuid.UUID:
    with member.acting():
        return Membership.objects.get(invited_email=email).id


def test_no_one_ends_their_own_access(team: dict[str, Member]) -> None:
    md = api_as(team["md"])

    assert refusal(md.post(f"/api/members/{team['md'].membership_id}/revoke")) == (
        403,
        codes.NOT_YOURSELF.code,
    )


def test_another_developer_s_membership_is_not_found(
    team: dict[str, Member], sign_in: Callable[..., Member]
) -> None:
    other = sign_in(role="guest")
    add_member(other.developer_id, role="qs", user=team["md"].user)  # the MD's own row there
    [own_elsewhere] = [m.id for m in _own_rows(team["md"]) if m.tenant_id == other.developer_id]
    md = api_as(team["md"])

    for target in (other.membership_id, own_elsewhere, uuid.uuid4()):
        assert refusal(md.post(f"/api/members/{target}/revoke")) == (404, "platform.auth.not_found")
        assert refusal(md.post(f"/api/members/{target}/renew")) == (404, "platform.auth.not_found")
        assert refusal(md.post(f"/api/members/invitations/{target}/withdraw")) == (
            404,
            "platform.auth.not_found",
        )
    with other.acting():
        assert Membership.objects.get(id=other.membership_id).revoked_at is None


def _own_rows(member: Member) -> list[Membership]:
    with tenancy.acting_in(None, user_id=member.user.pk):
        return list(Membership.objects.filter(user=member.user))


# Setting a Membership's Projects (the service 08's seed calls) -------------------------------------


def test_the_md_sets_a_guest_s_projects(team: dict[str, Member]) -> None:
    project = uuid.uuid4()

    with team["md"].acting():
        invitations.set_projects(team["guest"].membership_id, [project])

    with team["guest"].acting() as acting:
        assert acting.membership is not None
        assert acting.membership.project_ids == frozenset({project})
    with team["md"].acting():
        invitations.set_projects(team["guest"].membership_id, None)
    with team["guest"].acting() as acting:
        assert acting.membership is not None
        assert acting.membership.project_ids == frozenset()


def test_only_those_allowed_set_projects(team: dict[str, Member]) -> None:
    for actor in ("qs", "vextrus_engineer", "guest"):
        with team[actor].acting(), pytest.raises(auth.Refused):
            invitations.set_projects(team["md"].membership_id, [uuid.uuid4()])


def test_a_project_outside_the_inviter_s_scope_is_not_found_before_the_role_is_asked(
    sign_in: Callable[..., Member],
) -> None:
    qs = api_as(sign_in(role="qs", projects=[uuid.uuid4()]))

    response = invite(qs, "q@example.com", "qs", project_ids=[str(uuid.uuid4())])

    assert refusal(response) == (404, "platform.auth.not_found")
