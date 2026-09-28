"""`tenancy.acting_in` for a user never widens to the whole tenant (the orchestrator's note to 07, from
08's session): a user acts in a Developer only through a current Membership there, as the tenant
middleware's `enter_request` does; with no user, a system step acts in the Developer."""

import uuid
from collections.abc import Callable
from datetime import timedelta

import pytest
from django.contrib.sessions.backends.db import SessionStore
from django.db import connection, transaction
from django.test import RequestFactory
from django.utils import timezone

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.messages import invitations as codes
from vextrus.platform.models import Developer, Membership, User
from vextrus.platform.services import events, markets, tenancy
from vextrus.platform.services.events import NoTenant
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def tenant_setting() -> str:
    with connection.cursor() as cursor:
        cursor.execute("select current_setting('app.tenant_id', true)")
        return str(cursor.fetchone()[0])


@pytest.mark.parametrize("ending", ["lapsed", "revoked", "not started", "never a member"])
def test_a_user_without_a_current_membership_acts_in_no_tenant(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID], ending: str
) -> None:
    member = sign_in(role="qs")
    developer = member.developer_id
    now = timezone.now()
    change = {
        "lapsed": {"expires_at": now - timedelta(seconds=1)},
        "revoked": {"revoked_at": now},
        "not started": {"starts_at": now + timedelta(hours=1)},
        "never a member": {},
    }[ending]
    if ending == "never a member":
        developer = make_developer()
    with tenancy.acting_in(member.developer_id):
        Membership.objects.filter(id=member.membership_id).update(**change)

    with tenancy.acting_in(developer, user_id=member.user.pk) as acting:
        assert (acting.tenant_id, acting.library_id, acting.membership) == (None, None, None)
        assert tenancy.current_membership() is None
        assert tenancy.current_tenant_id() is None
        assert tenant_setting() == ""
        assert Developer.objects.count() == 0
        with pytest.raises(NoTenant):
            events.record(codes.REVOKED, subject_type="membership")


def test_a_user_with_a_current_membership_acts_in_its_developer_and_scope(
    sign_in: Callable[..., Member],
) -> None:
    project = uuid.uuid4()
    guest = sign_in(role="guest", projects=[project])

    with tenancy.acting_in(guest.developer_id, user_id=guest.user.pk) as acting:
        assert acting.tenant_id == guest.developer_id
        assert acting.membership is not None
        assert acting.membership.project_ids == frozenset({project})
        assert tenant_setting() == str(guest.developer_id)


def test_with_no_user_a_system_step_acts_in_the_developer(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()

    with tenancy.acting_in(developer) as acting:
        assert acting.tenant_id == developer
        assert acting.membership is None
        assert Developer.objects.count() == 1


# A Library is never the acting tenant (the orchestrator's second note to 07, from 28's session) ---


def test_acting_in_a_library_is_refused_and_leaves_no_tenant_set(
    market: markets.MarketProfile,
) -> None:
    with tenancy.acting_in(None):
        with pytest.raises(tenancy.LibraryNotATenant), tenancy.acting_in(market.library_id):
            pass  # never reached: nothing may run acting in a Library
        assert tenant_setting() == ""
        assert tenancy.current_tenant_id() is None


def test_a_user_acting_in_a_library_acts_in_no_tenant(
    market: markets.MarketProfile, sign_in: Callable[..., Member]
) -> None:
    member = sign_in(role="md")

    with tenancy.acting_in(market.library_id, user_id=member.user.pk) as acting:
        assert acting.tenant_id is None
        assert tenant_setting() == ""


@pytest.mark.parametrize("key", [tenancy.SESSION_TENANT, tenancy.STAFF_SESSION_TENANT])
def test_a_session_naming_a_library_acts_in_no_tenant(
    market: markets.MarketProfile, staff: User, key: str
) -> None:
    request = RequestFactory().get("/admin/" if key == tenancy.STAFF_SESSION_TENANT else "/api/me")
    request.user = staff
    request.session = SessionStore()
    request.session[key] = str(market.library_id)

    with transaction.atomic():
        entered = tenancy.enter_request(request)
        assert entered.tenant_id is None
        assert tenant_setting() == ""
    tenancy.leave_request()


def test_staff_cannot_pick_a_library(market: markets.MarketProfile, staff: User) -> None:
    request = RequestFactory().get("/admin/")
    request.user = staff
    request.session = SessionStore()

    with tenancy.acting_in(None, user_id=staff.pk), pytest.raises(tenancy.NotYours):
        tenancy.staff_open(request, market.library_id)


def test_the_app_cannot_write_a_library_row_by_any_entry_point(
    market: markets.MarketProfile,
) -> None:
    with pytest.raises(tenancy.LibraryNotATenant), tenancy.acting_in(market.library_id):
        Developer.objects.filter(id=market.library_id).update(name="rewritten")
    library = Developer.objects.using(OWNER_ALIAS).get(id=market.library_id)
    assert library.name != "rewritten"
