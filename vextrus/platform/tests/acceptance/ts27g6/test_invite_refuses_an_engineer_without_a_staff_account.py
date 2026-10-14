"""Ticket S27-G6, part f-7 (#831; G1 walk 1, M0-FL10): the MD's invite form refuses, at invite time,
a Vextrus Engineer invitation for an email with no Vextrus staff account.

Today "Create link" succeeds and the invitation is listed under "Invitations not used yet", though its
link can only refuse later ("This invitation is for a Vextrus Engineer, so only a Vextrus account can
take it", `platform.invitations.engineer_not_staff`; the owner's ruling of 28 Sep 2026: a Vextrus
Engineer's invitation is accepted only with an account of Vextrus's staff). The triage's fix: "the
invite form refuses an Engineer email with no staff account". This is a trust boundary, so it is pinned
on the API, whoever calls it.

Pinned here: the refusal's code `platform.invitations.no_vextrus_account` (new; its words are the web's
and the words gate's) and status 409, as every other refusal about the invited email's account
(`already_member`, `already_invited`, `access_ended`); and that a refused invitation leaves nothing
behind: no row under "Invitations not used yet", no Membership, no link.
"""

from typing import Any

import pytest

from vextrus.platform.models import Membership, User
from vextrus.testing.auth import api_as
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

NO_VEXTRUS_ACCOUNT = "platform.invitations.no_vextrus_account"
REFUSED = "the Vextrus Engineer invitation was not refused at invite time"


def _invite(member: Member, email: str, role: str = "vextrus_engineer") -> Any:
    return api_as(member).post("/api/members/invitations", {"email": email, "role": role})


def _left_nothing(team: dict[str, Member], email: str) -> None:
    listed = api_as(team["md"]).get("/api/members").json()["invitations"]
    assert [i for i in listed if i["email"].lower() == email.lower()] == [], (
        "a refused invitation is listed under Invitations not used yet"
    )
    with team["md"].acting():
        assert not Membership.objects.filter(invited_email__iexact=email).exists(), (
            "a refused invitation left a Membership"
        )


def _refused(response: Any) -> None:
    assert response.status_code != 201, REFUSED
    assert (response.status_code, response.json()["code"]) == (409, NO_VEXTRUS_ACCOUNT), REFUSED


def test_the_md_cannot_invite_an_engineer_by_an_email_with_no_account(team: dict[str, Member]) -> None:
    email = "nobody@vextrus.example"

    response = _invite(team["md"], email)

    _refused(response)
    _left_nothing(team, email)


def test_the_md_cannot_invite_an_engineer_by_an_account_that_is_not_vextrus_staff(
    team: dict[str, Member],
) -> None:
    email = "rumana@example.com"
    User.objects.create_user(email, "Rumana Akter")

    response = _invite(team["md"], email)

    _refused(response)
    _left_nothing(team, email)


def test_the_md_cannot_invite_an_engineer_by_a_former_staff_account(
    team: dict[str, Member], former_staff: User
) -> None:
    response = _invite(team["md"], former_staff.email)

    _refused(response)
    _left_nothing(team, former_staff.email)


def test_a_qs_cannot_invite_an_engineer_by_an_email_with_no_account(team: dict[str, Member]) -> None:
    email = "nobody@vextrus.example"

    response = _invite(team["qs"], email)

    _refused(response)
    _left_nothing(team, email)


def test_an_engineer_with_a_staff_account_is_still_invited_whatever_the_email_s_case(
    team: dict[str, Member], staff: User, other_staff: User
) -> None:
    """The guard: a staff account's email, as typed or in capitals, still makes a link."""
    as_typed = _invite(team["md"], other_staff.email)
    in_capitals = _invite(team["qs"], staff.email.upper())

    assert (as_typed.status_code, in_capitals.status_code) == (201, 201), (
        "a staff account's invitation was refused"
    )
    seen = api_as(team["md"]).get("/api/members").json()["invitations"]
    listed = sorted(i["email"].lower() for i in seen)
    assert listed == sorted([other_staff.email.lower(), staff.email.lower()])
