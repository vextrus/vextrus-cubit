"""07's trust boundary, attacked as an attacker would (ticket 07's brief, "Your trust boundary"): each
test is one attempt, and asserts it fails. The broader cases live beside the features they attack
(test_auth_acts, test_auth_invitations, test_auth_members, test_auth_sign_in, test_auth_acting)."""

import logging
import re
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

from vextrus.platform.http.acts import declaration_of
from vextrus.platform.messages import invitations as codes
from vextrus.platform.models import Membership
from vextrus.platform.services import auth, invitations, tenancy
from vextrus.testing.auth import Api, api_as, invitation, served_operations
from vextrus.testing.tenancy import Member

PASSWORD = "a long enough passphrase 7"

pytestmark = pytest.mark.django_db


def fill(route: str) -> str:
    return "/" + re.sub(r"<[^>]+>", lambda _: str(uuid.uuid4()), route)


def _lacks(role: str, view: Callable[..., object]) -> bool:
    declaration = declaration_of(view)
    return (
        declaration is not None
        and declaration.act is not None
        and not auth.allows(role, declaration.act)
    )


@pytest.mark.parametrize("role", ["guest", "md"])
def test_no_declared_change_act_answers_a_guest_or_the_md_with_success(
    team: dict[str, Member], role: str
) -> None:
    """Every operation whose act needs a grant the role lacks, whatever module declares it."""
    member = api_as(team[role])
    refused = [served for served in served_operations() if _lacks(role, served.operation.view_func)]
    if role == "guest":  # platform's own: members, access, acts (the MD lacks only CHANGE's)
        assert refused

    for served in refused:
        response = member.send(served.method.lower(), fill(served.route), {})
        # 403 by the guard; 404 for a Project outside the scope; 422 when Ninja refuses the body
        # before the guard runs. Never a success.
        assert response.status_code in {403, 404, 422}, (served.route, response.content)
        if response.status_code == 403:
            assert response.json()["code"] == "platform.auth.not_allowed"


def test_a_qs_cannot_take_a_new_link_for_an_invitation_the_md_made(team: dict[str, Member]) -> None:
    md_invitation, _ = invitation(team["md"], "new-md@example.com", "md")

    response = api_as(team["qs"]).post(f"/api/members/invitations/{md_invitation}/link")

    assert (response.status_code, response.json()["code"]) == (403, codes.NOT_YOURS_TO_CHANGE.code)


def test_a_qs_cannot_widen_an_engineer_beyond_their_own_projects(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer = make_developer()
    mine, other = uuid.uuid4(), uuid.uuid4()
    qs = sign_in(role="qs", developer_id=developer, projects=[mine])
    engineer, _ = invitation(qs, "e@example.com", project_ids=[mine])

    with qs.acting():
        with pytest.raises(auth.NotFound):
            invitations.set_projects(engineer, [mine, other])
        with pytest.raises(auth.Refused) as refused:
            invitations.set_projects(engineer, None)
    assert refused.value.message["code"] == codes.PROJECTS_NOT_YOURS.code


def test_revoked_access_is_not_renewed_back(team: dict[str, Member]) -> None:
    md = api_as(team["md"])
    target = team["vextrus_engineer"].membership_id
    md.post(f"/api/members/{target}/revoke")

    response = md.post(f"/api/members/{target}/renew")

    assert (response.status_code, response.json()["code"]) == (409, codes.ALREADY_ENDED.code)
    assert api_as(team["vextrus_engineer"]).get("/api/members").status_code == 403


def test_a_stale_read_of_a_taken_link_cannot_take_it_again(
    team: dict[str, Member], monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    """Two accepts at once: each read the pending invitation; the second finds it taken."""
    _, token = invitation(team["md"], "arif@example.com", "guest")
    with tenancy.acting_in(None):
        stale = tenancy.invitation_by_token(token)
    assert stale is not None
    Api().post("/api/invitations/accept", {"token": token, "name": "A", "password": PASSWORD})
    second = sign_in(role="qs", email="arif2@example.com")  # a user elsewhere, email matched below
    monkeypatch.setattr(
        tenancy,
        "invitation_by_token",
        lambda _token: type(stale)(**{**vars(stale), "invited_email": "arif2@example.com"}),
    )

    with pytest.raises(auth.Refused) as refused, tenancy.acting_in(None):
        invitations.accept(token, second.user)

    assert refused.value.message["code"] == codes.UNUSABLE.code
    with team["md"].acting():
        assert (
            Membership.objects.filter(tenant_id=team["md"].developer_id, user=second.user).count() == 0
        )


def test_the_token_is_never_logged(team: dict[str, Member], caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    membership_id, token = invitation(team["md"], "arif@example.com", "guest")
    api = Api()

    api.post("/api/invitations/look-up", {"token": token})
    api.post("/api/invitations/accept", {"token": token, "name": "A", "password": "short"})
    api.post("/api/invitations/accept", {"token": token, "name": "A", "password": PASSWORD})
    api.post("/api/invitations/accept", {"token": token, "name": "A", "password": PASSWORD})
    new = api_as(team["md"]).post(f"/api/members/invitations/{membership_id}/link")

    secret = token.split(".", 1)[1]
    assert secret not in caplog.text
    assert "Not Found: /api/invitations/accept" in caplog.text  # the refusals were logged, by path only
    assert new.status_code == 409  # used: no new link


def test_an_engineer_s_end_date_cannot_be_removed_by_inviting_without_one(
    team: dict[str, Member],
) -> None:
    response = api_as(team["md"]).post(
        "/api/members/invitations",
        {"email": "e@example.com", "role": "vextrus_engineer", "expires_at": None},
    )

    with team["md"].acting():
        made = Membership.objects.get(id=response.json()["membership_id"])
    assert made.expires_at is not None
    assert made.expires_at > timezone.now() + timedelta(days=29)


def test_a_withdraw_that_loses_the_race_to_an_accept_changes_nothing(
    team: dict[str, Member], monkeypatch: pytest.MonkeyPatch
) -> None:
    """The withdraw read the invitation as pending; the accept committed before its write."""
    membership_id, token = invitation(team["md"], "arif@example.com", "guest")
    with team["md"].acting():
        stale = Membership.objects.get(id=membership_id)
    Api().post("/api/invitations/accept", {"token": token, "name": "A", "password": PASSWORD})
    monkeypatch.setattr(invitations, "_pending", lambda _actor, _id: stale)

    with team["md"].acting(), pytest.raises(auth.Refused) as refused:
        invitations.withdraw(membership_id)

    assert refused.value.message["code"] == codes.UNUSABLE.code
    with team["md"].acting():
        assert Membership.objects.get(id=membership_id).revoked_at is None


def test_a_renew_that_loses_the_race_to_a_revoke_changes_nothing(
    team: dict[str, Member], monkeypatch: pytest.MonkeyPatch
) -> None:
    target = team["vextrus_engineer"].membership_id
    with team["md"].acting():
        stale = Membership.objects.get(id=target)
        invitations.revoke(target)
    monkeypatch.setattr(invitations, "_member", lambda _actor, _id: stale)

    with team["md"].acting(), pytest.raises(auth.Refused) as refused:
        invitations.renew(target)

    assert refused.value.message["code"] == codes.ALREADY_ENDED.code
    with team["md"].acting():
        assert Membership.objects.get(id=target).expires_at == stale.expires_at


# A member given chosen Projects: nothing about people outside them (the orchestrator's review) ---


@pytest.fixture
def scoped(sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]) -> dict[str, Any]:
    """An MD given P1, and around them a QS given P2 only, a pending Guest invited to P2 only, and
    a QS with every Project."""
    developer = make_developer()
    p1, p2 = uuid.uuid4(), uuid.uuid4()
    md = sign_in(role="md", developer_id=developer, projects=[p1])
    boss = sign_in(role="md", developer_id=developer)
    apart = sign_in(role="qs", developer_id=developer, projects=[p2], email="apart@example.com")
    everywhere = sign_in(role="qs", developer_id=developer, email="everywhere@example.com")
    pending, _ = invitation(boss, "guest-p2@example.com", "guest", project_ids=[p2])
    return {"md": md, "boss": boss, "apart": apart, "everywhere": everywhere, "pending": pending}


def test_a_scoped_md_acts_on_no_one_it_cannot_see(scoped: dict[str, Any]) -> None:
    md = api_as(scoped["md"])
    apart = scoped["apart"].membership_id
    pending = scoped["pending"]
    shown = {p["email"] for p in md.get("/api/members").json()["people"]}
    assert "apart@example.com" not in shown

    for path in (f"/api/members/{apart}/revoke", f"/api/members/{apart}/renew"):
        response = md.post(path)
        assert (response.status_code, response.json()["code"]) == (404, "platform.auth.not_found")
    for path in (
        f"/api/members/invitations/{pending}/withdraw",
        f"/api/members/invitations/{pending}/link",
    ):
        response = md.post(path)
        assert (response.status_code, response.json()["code"]) == (404, "platform.auth.not_found")
    with scoped["boss"].acting():
        assert Membership.objects.get(id=apart).revoked_at is None
        assert Membership.objects.get(id=pending).revoked_at is None
    renewed = md.post(f"/api/members/{scoped['everywhere'].membership_id}/revoke")
    assert renewed.status_code == 204  # one it can see


def test_a_scoped_member_reads_no_act_about_or_by_someone_it_cannot_see(
    scoped: dict[str, Any],
) -> None:
    boss, md = scoped["boss"], scoped["md"]
    _, token = invitation(boss, "joiner-p2@example.com", "guest", project_ids=[uuid.uuid4()])
    Api().post("/api/invitations/accept", {"token": token, "name": "Joiner", "password": PASSWORD})
    with boss.acting():
        invitations.set_projects(
            scoped["apart"].membership_id,
            list(scoped["apart"].project_ids),
        )

    everything = api_as(boss).get("/api/activity", limit=200).content.decode()
    seen = api_as(md).get("/api/activity", limit=200).content.decode()
    counted = {p["email"]: p["acts"] for p in api_as(md).get("/api/members").json()["people"]}

    apart = str(scoped["apart"].membership_id)
    for hidden in ("guest-p2@example.com", "Joiner", apart, str(scoped["pending"])):
        assert hidden in everything
        assert hidden not in seen, hidden
    assert "everywhere@example.com" in counted
    assert "joiner-p2@example.com" not in counted
