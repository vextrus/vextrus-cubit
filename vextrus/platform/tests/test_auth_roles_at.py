"""`invitations.roles_at` (ticket 22; the refuter's finding on M8): the role a user held in the acting
Developer when they acted, never their role now. A QS who confirmed a sheet, was revoked, and came
back as a Guest still shows as the QS who confirmed it; at a time they held no Membership, none."""

import uuid
from collections.abc import Callable
from datetime import timedelta

import pytest
from django.utils import timezone

from vextrus.platform.models import Membership, User
from vextrus.platform.services import invitations, tenancy

pytestmark = pytest.mark.django_db


def test_the_role_is_the_one_held_when_the_user_acted(make_developer: Callable[..., uuid.UUID]) -> None:
    developer = make_developer()
    other = make_developer()
    user = User.objects.create_user("again@example.com", "Again Person")
    t0 = timezone.now() - timedelta(days=10)
    with tenancy.acting_in(developer):
        Membership.objects.create(
            tenant_id=developer,
            user=user,
            role="qs",
            starts_at=t0,
            accepted_at=t0,
            revoked_at=t0 + timedelta(days=2),
        )
        Membership.objects.create(
            tenant_id=developer,
            user=user,
            role="guest",
            starts_at=t0 + timedelta(days=3),
            accepted_at=t0 + timedelta(days=3),
        )
    with tenancy.acting_in(other):
        Membership.objects.create(tenant_id=other, user=user, role="md", starts_at=t0, accepted_at=t0)

    as_qs, between, as_guest, before = (
        t0 + timedelta(days=1),
        t0 + timedelta(days=2, hours=12),
        t0 + timedelta(days=4),
        t0 - timedelta(days=1),
    )
    with tenancy.acting_in(developer):
        roles = invitations.roles_at(
            [(user.pk, as_qs), (user.pk, between), (user.pk, as_guest), (user.pk, before)]
        )

    assert roles == {(user.pk, as_qs): "qs", (user.pk, as_guest): "guest"}


def test_with_no_acting_developer_no_role_is_read(make_developer: Callable[..., uuid.UUID]) -> None:
    assert invitations.roles_at([(uuid.uuid4(), timezone.now())]) == {}
