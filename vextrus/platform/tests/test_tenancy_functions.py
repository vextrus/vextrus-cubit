"""platform's four named cross-tenant functions: each returns what it should and nothing more
(docs/data-model.md §3.0; the M0 plan, 02; #75 for `ended_access`)."""

import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.db import connections
from django.utils import timezone

from vextrus.platform.models import Membership, MembershipProject, User
from vextrus.platform.services import invitations, tenancy
from vextrus.platform.services.markets import MarketProfile
from vextrus.testing.tenancy import add_member

SIGNATURES = (
    "user_developers()",
    "staff_developers()",
    "invitation_by_token(uuid,text)",
    "ended_access()",
)


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


@pytest.mark.django_db
@pytest.mark.parametrize("signature", SIGNATURES)
def test_no_role_without_the_grant_may_run_it(signature: str) -> None:
    """PUBLIC holds no EXECUTE, so a role granted nothing (a predefined one, say) cannot run it."""
    with connections["default"].cursor() as cursor:
        cursor.execute(
            "select has_function_privilege('public', %s, 'EXECUTE'), "
            "has_function_privilege('pg_read_all_data', %s, 'EXECUTE')",
            [f"public.{signature}"] * 2,
        )

        assert cursor.fetchone() == (False, False)


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
    make_developer: Callable[..., uuid.UUID], staff: User, former_staff: User
) -> None:
    make_developer("Shapla Homes Ltd")
    meghna = make_developer("Meghna Properties Ltd")
    member, _ = add_member(meghna, role="md")

    assert staff_sees(staff) == ["Meghna Properties Ltd", "Shapla Homes Ltd"]
    assert staff_sees(member) == []
    assert staff_sees(former_staff) == []
    assert staff_sees(None) == []


@pytest.fixture
def invitation(
    make_developer: Callable[..., uuid.UUID], staff: User
) -> tuple[uuid.UUID, tenancy.Invitation]:
    developer = make_developer("Shapla Homes Ltd")
    with tenancy.acting_in(developer):
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


# ended_access (#75) -----------------------------------------------------------------------------


def ended_for(user: User | None) -> list[tenancy.EndedAccess]:
    with tenancy.acting_in(None, user_id=user.pk if user else None):
        return tenancy.ended_access()


def person(email: str, name: str) -> User:
    return User.objects.create_user(email, name)


def set_membership(developer: uuid.UUID, membership: uuid.UUID, **change: Any) -> None:
    with tenancy.acting_in(developer):
        Membership.objects.filter(id=membership).update(**change)


def revoke_as(md: User, developer: uuid.UUID, membership: uuid.UUID) -> None:
    """Revoke through the service, as the MD: the act names who did it."""
    with tenancy.acting_in(developer, user_id=md.pk):
        invitations.revoke(membership)


@pytest.fixture
def shapla(make_developer: Callable[..., uuid.UUID]) -> tuple[uuid.UUID, User]:
    """Shapla Homes Ltd and its MD, Kamal Uddin."""
    developer = make_developer("Shapla Homes Ltd")
    kamal = person("kamal@shapla-homes.example", "Kamal Uddin")
    add_member(developer, role="md", user=kamal)
    return developer, kamal


@pytest.mark.django_db
def test_ended_access_names_the_developer_who_revoked_it_when_and_its_projects(
    shapla: tuple[uuid.UUID, User],
) -> None:
    developer, kamal = shapla
    kr01, bp02 = sorted([uuid.uuid4(), uuid.uuid4()])
    guest, membership = add_member(developer, role="guest", projects=[bp02, kr01])

    revoke_as(kamal, developer, membership)

    [ended] = ended_for(guest)
    with tenancy.acting_in(developer):
        revoked_at = Membership.objects.get(id=membership).revoked_at
    assert revoked_at is not None
    assert ended == tenancy.EndedAccess(
        membership_id=membership,
        developer_id=developer,
        developer_name="Shapla Homes Ltd",
        role="guest",
        ended_at=revoked_at,
        how="revoked",
        revoked_by="Kamal Uddin",
        project_ids=(kr01, bp02),
    )


@pytest.mark.django_db
def test_ended_access_says_when_an_end_date_passed_and_names_no_one(
    shapla: tuple[uuid.UUID, User],
) -> None:
    developer, _kamal = shapla
    kr01 = uuid.uuid4()
    until = timezone.now() - timedelta(days=3)
    guest, membership = add_member(developer, role="guest", projects=[kr01], expires_at=until)

    [ended] = ended_for(guest)

    assert (ended.membership_id, ended.developer_name, ended.how, ended.ended_at) == (
        membership,
        "Shapla Homes Ltd",
        "expired",
        until,
    )
    assert (ended.revoked_by, ended.project_ids) == (None, (kr01,))


@pytest.mark.django_db
def test_access_revoked_after_its_end_date_passed_expired_and_no_revoker_is_named(
    shapla: tuple[uuid.UUID, User],
) -> None:
    developer, kamal = shapla
    until = timezone.now() - timedelta(days=1)
    guest, membership = add_member(developer, role="guest", expires_at=until)

    revoke_as(kamal, developer, membership)

    [ended] = ended_for(guest)
    assert (ended.how, ended.ended_at, ended.revoked_by) == ("expired", until, None)


@pytest.mark.django_db
def test_a_revocation_no_act_names_has_no_revoker(shapla: tuple[uuid.UUID, User]) -> None:
    developer, _kamal = shapla
    guest, membership = add_member(developer, role="guest")

    set_membership(developer, membership, revoked_at=timezone.now())

    [ended] = ended_for(guest)
    assert (ended.how, ended.revoked_by) == ("revoked", None)


@pytest.mark.django_db
def test_another_user_s_ended_access_is_never_returned_in_the_same_developer_or_another(
    shapla: tuple[uuid.UUID, User], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer, kamal = shapla
    meghna = make_developer("Meghna Properties Ltd")
    mine, my_membership = add_member(developer, role="qs")
    theirs, their_membership = add_member(developer, role="guest")
    _theirs, elsewhere = add_member(meghna, role="qs", user=theirs)
    revoke_as(kamal, developer, their_membership)
    set_membership(meghna, elsewhere, revoked_at=timezone.now())

    assert ended_for(mine) == []
    assert ended_for(kamal) == []
    assert {e.membership_id for e in ended_for(theirs)} == {their_membership, elsewhere}
    revoke_as(kamal, developer, my_membership)
    assert [e.membership_id for e in ended_for(mine)] == [my_membership]


@pytest.mark.django_db
@pytest.mark.parametrize("state", ["pending", "withdrawn", "link expired"])
def test_an_invitation_never_accepted_is_never_ended_access(
    shapla: tuple[uuid.UUID, User], state: str
) -> None:
    developer, kamal = shapla
    invited = person("farhana@padma-builders.example", "Farhana Kabir")
    with tenancy.acting_in(developer, user_id=kamal.pk):
        link = invitations.invite(invited.email, "guest")
        if state == "withdrawn":
            invitations.withdraw(link.membership_id)
    if state == "link expired":
        set_membership(developer, link.membership_id, invite_expires_at=timezone.now())

    assert ended_for(invited) == []


@pytest.mark.django_db
def test_a_pending_invitation_again_leaves_the_ended_access_shown_until_it_is_accepted(
    shapla: tuple[uuid.UUID, User],
) -> None:
    developer, kamal = shapla
    guest, first = add_member(developer, role="guest", email="farhana@padma-builders.example")
    revoke_as(kamal, developer, first)
    with tenancy.acting_in(developer, user_id=kamal.pk):
        link = invitations.invite(guest.email, "guest")

    assert [e.membership_id for e in ended_for(guest)] == [first]
    with tenancy.acting_in(None):
        invitations.accept(link.token, guest)
    assert ended_for(guest) == []


@pytest.mark.django_db
def test_revoked_then_invited_again_its_later_end_is_its_own_and_never_the_first_revoker_s(
    shapla: tuple[uuid.UUID, User],
) -> None:
    developer, kamal = shapla
    now = timezone.now()
    guest, first = add_member(developer, role="guest", email="farhana@padma-builders.example")
    revoke_as(kamal, developer, first)
    set_membership(developer, first, revoked_at=now - timedelta(days=5))
    with tenancy.acting_in(developer, user_id=kamal.pk):
        link = invitations.invite(guest.email, "guest", expires_at=now + timedelta(days=1))
    with tenancy.acting_in(None):
        invitations.accept(link.token, guest)
    assert ended_for(guest) == []  # current again: the Developer is no longer "ended"

    set_membership(developer, link.membership_id, expires_at=now - timedelta(days=1))

    [ended] = ended_for(guest)
    assert (ended.membership_id, ended.how, ended.revoked_by) == (link.membership_id, "expired", None)


@pytest.mark.django_db
def test_ended_access_is_one_per_developer_newest_first(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    first, second, third = (make_developer(n) for n in ("First", "Second", "Third"))
    now = timezone.now()
    user = person("nusrat@example.com", "Nusrat Jahan")
    for developer, days in ((first, 3), (second, 1), (third, 2)):
        _user, membership = add_member(developer, role="qs", user=user)
        set_membership(developer, membership, revoked_at=now - timedelta(days=days))
    _user, newer = add_member(second, role="qs", user=user)  # held again, then ended later
    set_membership(second, newer, revoked_at=now - timedelta(hours=1))

    ended = ended_for(user)

    assert [e.developer_name for e in ended] == ["Second", "Third", "First"]
    assert ended[0].membership_id == newer


@pytest.mark.django_db
def test_every_developer_held_is_either_current_or_ended_never_both(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    now = timezone.now()
    user = person("nusrat@example.com", "Nusrat Jahan")
    names = ("Current", "Revoked", "Expired", "Revoked, then current", "Expired, then revoked")
    developers = {name: make_developer(name) for name in names}
    for name, developer in developers.items():
        expired = now - timedelta(days=1) if name.startswith("Expired") else None
        _user, membership = add_member(developer, role="qs", user=user, expires_at=expired)
        if "revoked" in name.lower():
            set_membership(developer, membership, revoked_at=now)
        if name.endswith("then current"):
            add_member(developer, role="qs", user=user)

    with tenancy.acting_in(None, user_id=user.pk):
        current = {choice.name for choice in tenancy.user_developers()}
        ended = {e.developer_name for e in tenancy.ended_access()}

    assert current == {"Current", "Revoked, then current"}
    assert ended == {"Revoked", "Expired", "Expired, then revoked"}


@pytest.mark.django_db
def test_access_ended_in_a_library_is_never_listed(market: MarketProfile) -> None:
    user = person("nusrat@example.com", "Nusrat Jahan")
    with tenancy.acting_in(None), connections["default"].cursor() as cursor:
        cursor.execute("select set_config('app.tenant_id', %s, true)", [str(market.library_id)])
        cursor.execute(
            """insert into platform_membership
                 (id, tenant_id, user_id, role, outside_org, created_at, starts_at, accepted_at,
                  revoked_at, invited_email, invite_token_hash)
               values (%s, %s, %s, 'qs', '', now(), now(), now(), now(), '', '')""",
            [uuid.uuid4(), market.library_id, user.pk],
        )

    assert ended_for(user) == []


@pytest.mark.django_db
def test_ended_access_gives_nothing_with_no_user_set(shapla: tuple[uuid.UUID, User]) -> None:
    developer, kamal = shapla
    _guest, membership = add_member(developer, role="guest")
    revoke_as(kamal, developer, membership)

    assert ended_for(None) == []
    with tenancy.acting_in(None), connections["default"].cursor() as cursor:
        cursor.execute("select set_config('app.user_id', '', true)")
        cursor.execute("select * from public.ended_access()")
        assert cursor.fetchall() == []


SHADOWED = (
    "platform_membership",
    "platform_developer",
    "platform_user",
    "platform_domainevent",
    "platform_membershipproject",
)


@pytest.mark.django_db
def test_a_table_the_caller_makes_with_a_platform_table_s_name_shadows_nothing(
    shapla: tuple[uuid.UUID, User], market: MarketProfile
) -> None:
    developer, kamal = shapla
    guest, membership = add_member(developer, role="guest", projects=[uuid.uuid4()])
    revoke_as(kamal, developer, membership)
    before = ended_for(guest)
    assert before

    with tenancy.acting_in(None, user_id=guest.pk), connections["default"].cursor() as cursor:
        for table in SHADOWED:
            cursor.execute(f"create temporary table {table} (like public.{table})")
        # Were these read, the Membership would be current and the names others.
        cursor.execute(
            "insert into pg_temp.platform_membership select * from public.platform_membership"
        )
        cursor.execute("update pg_temp.platform_membership set revoked_at = null")
        cursor.execute(
            "insert into pg_temp.platform_developer (id, tenant_id, name, market_id, library_id, "
            "home_region, is_library, created_at) values (%s, %s, 'Shadow', %s, %s, '', false, now())",
            [developer, developer, market.id, market.library_id],
        )
        cursor.execute(
            "insert into pg_temp.platform_user (id, password, email, name, phone, "
            "is_vextrus_staff, is_active) values (%s, '', 'x@example.com', 'Shadow', '', false, true)",
            [kamal.pk],
        )
        cursor.execute("select count(*) from platform_membership where revoked_at is null")
        assert cursor.fetchone() == (1,)  # the caller's own name finds its own table
        after = tenancy.ended_access()

    assert after == before
