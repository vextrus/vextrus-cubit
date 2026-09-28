"""`tenancy.acting_in` for a user never widens to the whole tenant (the orchestrator's note to 07, from
08's session): a user acts in a Developer only through a current Membership there, as the tenant
middleware's `enter_request` does; with no user, a system step acts in the Developer."""

import uuid
from collections.abc import Callable
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from vextrus.platform.messages import invitations as codes
from vextrus.platform.models import Developer, Membership
from vextrus.platform.services import events, tenancy
from vextrus.platform.services.events import NoTenant
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


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
