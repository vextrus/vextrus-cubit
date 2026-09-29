"""Fixtures for tenancy, so 08, 14, 19a and 28 write isolation tests without 07.

- `market`: the seeded Market (the only one), as `markets.MarketProfile`.
- `make_developer(name)`: a Developer on it, made as the app would (its id).
- `sign_in(role=..., developer_id=..., projects=...)`: a user with a current Membership (optionally
  scoped to Projects), signed in on a test client with `force_login`, the session naming the
  Developer, so the tenant middleware sets the tenant for every request. It returns a `Member`,
  whose `acting()` sets the same tenant for calling services directly.

- `staff`, `other_staff`, `former_staff`: members of Vextrus's staff (the last one no longer
  active). `vextrus_app` can never make a user staff (docs/data-model.md §3.0; the staff wall in
  platform's migration 0005), so these are written by the owner, committed, and shared by every test.

Every other row is written through the `default` alias as `vextrus_app`, under row-level security,
inside the test's transaction. After `migrate` and after a flush (a `transaction=True` test empties
every table), the Markets, the Library rows and the staff users are put back.
"""

import itertools
import uuid
from collections.abc import Callable, Iterable
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import datetime, timedelta
from importlib import import_module
from typing import Any

import pytest
from django.apps import AppConfig
from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.test import Client
from django.utils import timezone

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import Developer, Market, Membership, MembershipProject, User
from vextrus.platform.services import library, markets, tenancy

_MARKET_MIGRATION = "vextrus.platform.migrations.0004_bangladesh_market"
_numbers = itertools.count(1)


@receiver(post_migrate, dispatch_uid="vextrus.testing.tenancy.put_back_the_library")
def put_back_the_library(sender: AppConfig, using: str, **kwargs: Any) -> None:
    """After `migrate` or a flush through the owner: the Markets, then `sync_library`."""
    if sender.label != "platform" or using != OWNER_ALIAS:
        return
    import_module(_MARKET_MIGRATION).seed(Market, Developer, using)
    library.sync(using)
    for email, (name, active) in STAFF.items():
        User.objects.using(using).update_or_create(
            email=email,
            defaults={"name": name, "is_vextrus_staff": True, "is_active": active},
        )


STAFF_EMAIL = "arif@vextrus.example"
OTHER_STAFF_EMAIL = "other@vextrus.example"
FORMER_STAFF_EMAIL = "gone@vextrus.example"
STAFF = {
    STAFF_EMAIL: ("Arif Rahman", True),
    OTHER_STAFF_EMAIL: ("Other Staff", True),
    FORMER_STAFF_EMAIL: ("Former Staff", False),
}


@pytest.fixture
def staff(db: None) -> User:
    return User.objects.get(email=STAFF_EMAIL)


@pytest.fixture
def other_staff(db: None) -> User:
    return User.objects.get(email=OTHER_STAFF_EMAIL)


@pytest.fixture
def former_staff(db: None) -> User:
    return User.objects.get(email=FORMER_STAFF_EMAIL)


@dataclass(frozen=True)
class Member:
    user: User
    developer_id: uuid.UUID
    membership_id: uuid.UUID
    role: str
    project_ids: frozenset[uuid.UUID]
    client: Client

    def acting(self) -> AbstractContextManager[tenancy.Tenancy]:
        """Act as this member in their Developer (for calling services directly)."""
        return tenancy.acting_in(self.developer_id, user_id=self.user.pk)


@pytest.fixture
def market(db: None) -> markets.MarketProfile:
    [only] = markets.offered()
    return only


@pytest.fixture
def make_developer(db: None, market: markets.MarketProfile) -> Callable[..., uuid.UUID]:
    def make(name: str | None = None) -> uuid.UUID:
        with tenancy.acting_in(None):
            return tenancy.create_developer(name or f"Developer {next(_numbers)}", market.id)

    return make


def add_member(
    developer_id: uuid.UUID,
    *,
    role: str = "qs",
    email: str | None = None,
    projects: Iterable[uuid.UUID] = (),
    expires_at: datetime | None = None,
    user: User | None = None,
) -> tuple[User, uuid.UUID]:
    """A user (made unless given) with a current Membership in the Developer: (user, its id)."""
    number = next(_numbers)
    if user is None:
        user = User.objects.create_user(email or f"{role}{number}@example.com", f"{role} {number}")
    if expires_at is None and role == "vextrus_engineer":
        expires_at = timezone.now() + timedelta(days=30)
    with tenancy.acting_in(developer_id):
        membership = Membership.objects.create(
            tenant_id=developer_id,
            user=user,
            role=role,
            # The database's clock, as `user_developers()` reads it: current from this transaction on.
            starts_at=tenancy.DATABASE_NOW,
            accepted_at=tenancy.DATABASE_NOW,
            expires_at=expires_at,
        )
        MembershipProject.objects.bulk_create(
            MembershipProject(tenant_id=developer_id, membership=membership, project_id=project)
            for project in projects
        )
    return user, membership.id


@pytest.fixture
def sign_in(db: None, make_developer: Callable[..., uuid.UUID]) -> Callable[..., Member]:
    def make(
        *,
        role: str = "qs",
        developer_id: uuid.UUID | None = None,
        projects: Iterable[uuid.UUID] = (),
        email: str | None = None,
        expires_at: datetime | None = None,
    ) -> Member:
        developer_id = developer_id or make_developer()
        project_ids = frozenset(projects)
        user, membership_id = add_member(
            developer_id, role=role, email=email, projects=project_ids, expires_at=expires_at
        )
        client = Client()
        client.force_login(user)
        session = client.session
        session[tenancy.SESSION_TENANT] = str(developer_id)
        session.save()
        return Member(user, developer_id, membership_id, role, project_ids, client)

    return make
