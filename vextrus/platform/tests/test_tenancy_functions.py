"""The three named cross-tenant functions: each returns what it should and nothing more
(docs/data-model.md §3.0; the M0 plan, 02)."""

import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.db import connections
from django.utils import timezone

from vextrus.platform.models import Membership, MembershipProject, User
from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile
from vextrus.testing.tenancy import add_member

SIGNATURES = ("user_developers()", "staff_developers()", "invitation_by_token(uuid,text)")


@pytest.mark.django_db
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
                          order by 1)
              from pg_proc p where p.oid = %s::regprocedure
            """,
            [f"public.{signature}"],
        )
        owner, definer, config, executors = cursor.fetchone()

    assert owner == "vextrus"
    assert definer is True
    assert config == ["search_path=pg_catalog, pg_temp"]
    assert executors == ["vextrus", "vextrus_app"]


def in_developers(user: User | None) -> list[str]:
    with tenancy.acting_in(None, user_id=user.pk if user else None):
        return [choice.name for choice in tenancy.user_developers()]


def staff_sees(user: User | None) -> list[str]:
    with tenancy.acting_in(None, user_id=user.pk if user else None):
        return [choice.name for choice in tenancy.staff_developers()]


@pytest.mark.django_db
def test_user_developers_gives_the_developers_of_the_user_s_current_memberships_only(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    current, revoked, ended, later, unrelated = (
        make_developer(name) for name in ("Current", "Revoked", "Ended", "Later", "Unrelated")
    )
    user, _ = add_member(current, role="qs")
    add_member(revoked, role="qs", user=user)
    add_member(ended, role="qs", user=user)
    add_member(later, role="qs", user=user)
    add_member(unrelated, role="md")
    now = timezone.now()
    with tenancy.acting_in(revoked):
        Membership.objects.filter(tenant_id=revoked).update(revoked_at=now)
    with tenancy.acting_in(ended):
        Membership.objects.filter(tenant_id=ended).update(expires_at=now - timedelta(seconds=1))
    with tenancy.acting_in(later):
        Membership.objects.filter(tenant_id=later).update(starts_at=now + timedelta(days=1))

    assert in_developers(user) == ["Current"]
    assert in_developers(None) == []


@pytest.mark.django_db
def test_user_developers_lists_several_by_name_and_never_a_library(
    make_developer: Callable[..., uuid.UUID], market: MarketProfile
) -> None:
    b, a = make_developer("B Homes"), make_developer("A Homes")
    user, _ = add_member(b, role="qs")
    add_member(a, role="guest", user=user)

    assert in_developers(user) == ["A Homes", "B Homes"]
    assert market.library_id not in {c.id for c in tenancy.user_developers()}


@pytest.mark.django_db
def test_staff_developers_gives_every_developer_to_staff_and_nothing_to_anyone_else(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    make_developer("Shapla Homes Ltd")
    meghna = make_developer("Meghna Properties Ltd")
    member, _ = add_member(meghna, role="md")
    staff = User.objects.create_user("staff@vextrus.example", "Staff", is_vextrus_staff=True)
    gone = User.objects.create_user(
        "gone@vextrus.example", "Gone", is_vextrus_staff=True, is_active=False
    )

    assert staff_sees(staff) == ["Meghna Properties Ltd", "Shapla Homes Ltd"]
    assert staff_sees(member) == []
    assert staff_sees(gone) == []
    assert staff_sees(None) == []


@pytest.fixture
def invitation(make_developer: Callable[..., uuid.UUID]) -> tuple[uuid.UUID, tenancy.Invitation]:
    developer = make_developer("Shapla Homes Ltd")
    staff = User.objects.create_user("staff@vextrus.example", "Staff", is_vextrus_staff=True)
    with tenancy.acting_in(developer, user_id=staff.pk):
        made = tenancy.invite_first_md("kamal@shapla-homes.example", invited_by=staff)
        MembershipProject.objects.create(
            tenant_id=developer, membership_id=made.membership_id, project_id=uuid.UUID(int=7)
        )
    return developer, made


def lookup(token: str) -> tenancy.PendingInvitation | None:
    with tenancy.acting_in(None):
        return tenancy.invitation_by_token(token)


@pytest.mark.django_db
def test_invitation_by_token_gives_the_one_pending_invitation_its_token_names(
    invitation: tuple[uuid.UUID, tenancy.Invitation],
) -> None:
    developer, made = invitation

    found = lookup(made.token)

    assert found is not None
    assert (found.id, found.tenant_id, found.developer_name) == (
        made.membership_id,
        developer,
        "Shapla Homes Ltd",
    )
    assert (found.role, found.invited_email) == ("md", "kamal@shapla-homes.example")
    assert found.project_ids == (uuid.UUID(int=7),)


@pytest.mark.django_db
def test_invitation_by_token_gives_nothing_without_its_exact_token(
    invitation: tuple[uuid.UUID, tenancy.Invitation], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer, made = invitation
    other = make_developer("Meghna Properties Ltd")
    _tenant, secret = made.token.split(".", 1)

    assert lookup(f"{developer}.{secret[:-1]}x") is None
    assert lookup(f"{other}.{secret}") is None
    assert lookup(secret) is None
    assert lookup("") is None
    with tenancy.acting_in(None), connections["default"].cursor() as cursor:
        cursor.execute("select * from invitation_by_token(%s, %s)", [developer, ""])
        assert cursor.fetchall() == []


@pytest.mark.django_db
@pytest.mark.parametrize("ending", ["accepted", "revoked", "link expired"])
def test_invitation_by_token_gives_nothing_once_the_invitation_is_used_withdrawn_or_old(
    invitation: tuple[uuid.UUID, tenancy.Invitation], ending: str
) -> None:
    developer, made = invitation
    now = timezone.now()
    joined = User.objects.create_user("kamal@shapla-homes.example", "Kamal Uddin")
    changes: dict[str, dict[str, Any]] = {
        "accepted": {"user": joined, "accepted_at": now},
        "revoked": {"revoked_at": now},
        "link expired": {"invite_expires_at": now - timedelta(seconds=1)},
    }
    change = changes[ending]
    with tenancy.acting_in(developer):
        Membership.objects.filter(id=made.membership_id).update(**change)

    assert lookup(made.token) is None
