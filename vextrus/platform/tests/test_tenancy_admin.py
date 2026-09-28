"""The admin under row-level security: staff pick a Developer through `staff_developers`, see only
its rows, create Developers and each one's first MD invitation, and nothing else (ADR 0034;
docs/data-model.md §3.0; the M0 plan, 02)."""

import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.contrib import admin
from django.core.management import call_command
from django.db import connections
from django.test import Client, RequestFactory
from django.utils import timezone

from vextrus.platform.messages import tenancy as acts
from vextrus.platform.models import Developer, DomainEvent, Membership, User
from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile
from vextrus.testing.tenancy import Member, add_member


@pytest.fixture
def staff_client(db: None, staff: User) -> Client:
    client = Client()
    client.force_login(staff)
    return client


@pytest.fixture
def shapla(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_developer("Shapla Homes Ltd")


@pytest.fixture
def meghna(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_developer("Meghna Properties Ltd")


def pick(client: Client, developer: uuid.UUID) -> None:
    response = client.post(f"/admin/platform/developer/{developer}/pick/")
    assert response.status_code == 302


def events_in(developer: uuid.UUID) -> list[tuple[str, uuid.UUID | None]]:
    with tenancy.acting_in(developer):
        return list(DomainEvent.objects.order_by("occurred_at").values_list("kind", "actor_user_id"))


def test_the_admin_registers_only_developer_and_membership() -> None:
    assert set(admin.site._registry) == {Developer, Membership}


@pytest.mark.django_db
def test_the_admin_index_opens_without_reading_the_admin_log(staff_client: Client) -> None:
    response = staff_client.get("/admin/")

    assert response.status_code == 200
    assert b"Recent actions" not in response.content


@pytest.mark.django_db
def test_a_member_who_is_not_staff_cannot_open_the_admin(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="md")

    response = member.client.get("/admin/platform/membership/")

    assert response.status_code == 302
    assert response["Location"].startswith("/admin/login/")


@pytest.mark.django_db
def test_staff_pick_from_every_developer_and_each_pick_is_an_act_its_md_sees(
    staff_client: Client, staff: User, shapla: uuid.UUID, meghna: uuid.UUID, market: MarketProfile
) -> None:
    listed = staff_client.get("/admin/platform/developer/")

    assert listed.status_code == 200
    assert b"Shapla Homes Ltd" in listed.content
    assert b"Meghna Properties Ltd" in listed.content
    assert b"Bangladesh Library" not in listed.content

    pick(staff_client, shapla)

    assert staff_client.session[tenancy.STAFF_SESSION_TENANT] == str(shapla)
    assert (acts.STAFF_OPENED.code, staff.pk) in events_in(shapla)
    assert [kind for kind, _ in events_in(meghna)] == [acts.DEVELOPER_CREATED.code]


@pytest.mark.django_db
def test_a_member_who_is_not_staff_cannot_pick(
    shapla: uuid.UUID, meghna: uuid.UUID, sign_in: Callable[..., Member]
) -> None:
    member = sign_in(role="md", developer_id=shapla)
    request = RequestFactory().post("/")
    request.user = member.user
    request.session = member.client.session

    with tenancy.acting_in(None, user_id=member.user.pk), pytest.raises(tenancy.NotYours):
        tenancy.staff_open(request, meghna)


@pytest.mark.django_db
def test_staff_see_only_the_picked_developer_s_rows(
    staff_client: Client, shapla: uuid.UUID, meghna: uuid.UUID
) -> None:
    add_member(shapla, role="qs", email="nusrat@shapla-homes.example")
    add_member(meghna, role="qs", email="tanvir@meghna.example")

    before = staff_client.get("/admin/platform/membership/")
    pick(staff_client, shapla)
    memberships = staff_client.get("/admin/platform/membership/")
    own = staff_client.get(f"/admin/platform/developer/{shapla}/change/")
    other = staff_client.get(f"/admin/platform/developer/{meghna}/change/", follow=True)

    assert b"nusrat@shapla-homes.example" not in before.content
    assert b"nusrat@shapla-homes.example" in memberships.content
    assert b"tanvir@meghna.example" not in memberships.content
    assert own.status_code == 200
    assert b"Shapla Homes Ltd" in own.content
    assert b"Meghna Properties Ltd" not in other.content


@pytest.mark.django_db
def test_staff_create_a_developer_on_its_market_and_act_in_it(
    staff_client: Client, staff: User, market: MarketProfile
) -> None:
    response = staff_client.post(
        "/admin/platform/developer/add/",
        {"name": "Padma Builders Ltd", "market": str(market.id), "home_region": ""},
    )

    assert response.status_code == 302
    developer = uuid.UUID(staff_client.session[tenancy.STAFF_SESSION_TENANT])
    with tenancy.acting_in(developer):
        made = Developer.objects.get()
        assert (made.id, made.name, made.market_id) == (developer, "Padma Builders Ltd", market.id)
        assert (made.library_id, made.home_region) == (market.library_id, market.default_home_region)
    assert events_in(developer) == [(acts.DEVELOPER_CREATED.code, staff.pk)]


@pytest.mark.django_db
def test_creating_a_developer_makes_its_id_the_tenant_in_the_same_transaction(
    market: MarketProfile,
) -> None:
    with tenancy.acting_in(None):
        made = tenancy.create_developer("Karnaphuli Homes", market.id, home_region="elsewhere-1")
        assert tenancy.current_tenant_id() == made
        assert tenancy.current().library_id == market.library_id
        assert Developer.objects.values_list("id", "home_region").get() == (made, "elsewhere-1")
    assert tenancy.current_tenant_id() is None


@pytest.mark.django_db
def test_staff_create_the_first_md_invitation_and_nothing_more(
    staff_client: Client, staff: User, shapla: uuid.UUID
) -> None:
    pick(staff_client, shapla)
    add_page = staff_client.get("/admin/platform/membership/add/")

    first = staff_client.post(
        "/admin/platform/membership/add/",
        {"invited_email": "kamal@shapla-homes.example"},
        follow=True,
    )
    second = staff_client.post(
        "/admin/platform/membership/add/", {"invited_email": "someone@shapla-homes.example"}
    )

    assert add_page.status_code == 200
    assert first.redirect_chain == [("/admin/platform/membership/", 302)]
    assert f"{shapla}.".encode() in first.content  # the token, shown once
    assert second.status_code == 403
    with tenancy.acting_in(shapla):
        [invitation] = Membership.objects.all()
    assert (invitation.role, invitation.user_id, invitation.invited_by_id) == ("md", None, staff.pk)
    assert invitation.invite_token_hash
    assert invitation.invite_expires_at is not None
    assert (acts.FIRST_MD_INVITED.code, staff.pk) in events_in(shapla)


@pytest.mark.django_db
@pytest.mark.parametrize("email", ["arif@vextrus.example", "ARIF@vextrus.example", "other"])
@pytest.mark.usefixtures("other_staff")
def test_staff_never_invite_themselves_or_another_of_vextrus_s_staff(
    staff_client: Client, shapla: uuid.UUID, email: str
) -> None:
    pick(staff_client, shapla)

    response = staff_client.post(
        "/admin/platform/membership/add/",
        {"invited_email": "other@vextrus.example" if email == "other" else email},
    )

    assert response.status_code == 200  # the form again, with its error
    assert b"never invite themselves or each other" in response.content
    with tenancy.acting_in(shapla):
        assert not Membership.objects.exists()


@pytest.mark.django_db
def test_the_service_refuses_a_second_invitation_and_one_with_no_developer(
    staff: User, shapla: uuid.UUID
) -> None:
    with tenancy.acting_in(None, user_id=staff.pk), pytest.raises(tenancy.FirstInvitationRefused):
        tenancy.invite_first_md("kamal@shapla-homes.example", invited_by=staff)
    with tenancy.acting_in(shapla):
        tenancy.invite_first_md("kamal@shapla-homes.example", invited_by=staff)
        with pytest.raises(tenancy.FirstInvitationRefused) as refused:
            tenancy.invite_first_md("rumana@shapla-homes.example", invited_by=staff)
    assert refused.value.reason == "not_first"


@pytest.mark.django_db
def test_staff_cannot_change_or_delete_a_membership_nor_read_its_history(
    staff_client: Client, shapla: uuid.UUID
) -> None:
    _user, membership = add_member(shapla, role="qs")
    pick(staff_client, shapla)

    change = staff_client.post(
        f"/admin/platform/membership/{membership}/change/", {"invited_email": "x@example.com"}
    )
    delete = staff_client.post(f"/admin/platform/membership/{membership}/delete/", {"post": "yes"})
    history = staff_client.get(f"/admin/platform/developer/{shapla}/history/")

    assert change.status_code == 403
    assert delete.status_code == 403
    assert history.status_code == 404
    with tenancy.acting_in(shapla):
        assert Membership.objects.get(id=membership).role == "qs"


@pytest.mark.django_db
def test_vextrus_app_has_no_right_on_the_admin_log() -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute("select has_table_privilege('vextrus_app', 'django_admin_log', 'SELECT,INSERT')")
        assert cursor.fetchone() == (False,)


@pytest.mark.django_db
def test_staff_cannot_rename_the_developer_they_act_in(staff_client: Client, shapla: uuid.UUID) -> None:
    pick(staff_client, shapla)

    shown = staff_client.get(f"/admin/platform/developer/{shapla}/change/")
    response = staff_client.post(f"/admin/platform/developer/{shapla}/change/", {"name": "Renamed Ltd"})

    assert shown.status_code == 200
    assert response.status_code == 403
    with tenancy.acting_in(shapla):
        assert Developer.objects.get().name == "Shapla Homes Ltd"


def invite(staff: User, developer: uuid.UUID, email: str) -> tenancy.Invitation:
    with tenancy.acting_in(developer):
        return tenancy.invite_first_md(email, invited_by=staff)


@pytest.mark.django_db
@pytest.mark.parametrize("lapse", ["link expired", "withdrawn"])
def test_a_lapsed_first_invitation_may_be_issued_again_and_the_md_sees_it(
    staff_client: Client, staff: User, shapla: uuid.UUID, lapse: str
) -> None:
    first = invite(staff, shapla, "kamal@shapla-homes.example")
    change: dict[str, Any] = (
        {"invite_expires_at": timezone.now() - timedelta(seconds=1)}
        if lapse == "link expired"
        else {"revoked_at": timezone.now()}
    )
    with tenancy.acting_in(shapla):
        Membership.objects.filter(id=first.membership_id).update(**change)
    pick(staff_client, shapla)

    response = staff_client.post(
        "/admin/platform/membership/add/", {"invited_email": "kamal@shapla-homes.example"}
    )

    assert response.status_code == 302
    with tenancy.acting_in(shapla):
        assert Membership.objects.count() == 2
    assert [kind for kind, _ in events_in(shapla)][-1] == acts.FIRST_MD_REISSUED.code


@pytest.mark.django_db
def test_a_pending_first_invitation_or_a_current_md_blocks_another(
    staff: User, shapla: uuid.UUID, meghna: uuid.UUID
) -> None:
    invite(staff, shapla, "kamal@shapla-homes.example")
    add_member(meghna, role="md")

    for developer in (shapla, meghna):
        with pytest.raises(tenancy.FirstInvitationRefused) as refused:
            invite(staff, developer, "someone@example.com")
        assert refused.value.reason == "not_first"


@pytest.mark.django_db
def test_a_developer_whose_every_membership_has_ended_may_have_its_first_md_invited_again(
    staff: User, shapla: uuid.UUID
) -> None:
    _user, membership = add_member(shapla, role="md")
    with tenancy.acting_in(shapla):
        Membership.objects.filter(id=membership).update(expires_at=timezone.now())

    invite(staff, shapla, "kamal@shapla-homes.example")

    assert [kind for kind, _ in events_in(shapla)][-1] == acts.FIRST_MD_REISSUED.code


@pytest.mark.django_db(databases=["owner"])
def test_the_staff_flag_changes_only_through_the_owner_s_command(
    capsys: pytest.CaptureFixture[str],
) -> None:
    users = User.objects.db_manager("owner")
    made = users.create_user("rafiq@vextrus.example", "Rafiq Islam")

    call_command("set_staff", "RAFIQ@vextrus.example")
    promoted = users.get(id=made.pk).is_vextrus_staff
    call_command("set_staff", "rafiq@vextrus.example", "--off")

    assert promoted is True
    assert users.get(id=made.pk).is_vextrus_staff is False
    assert "rafiq@vextrus.example: not staff" in capsys.readouterr().out
