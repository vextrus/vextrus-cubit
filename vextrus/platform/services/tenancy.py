"""Tenancy: which Developer a request or a step acts in, as row-level security reads it
(docs/data-model.md §2 and §3.0; the M0 plan, "Tenancy").

Row-level security reads three transaction-local settings: `app.user_id`, `app.tenant_id` and
`app.library_id`. They are set here only, always all three (an empty string for none, which the
policies read through `nullif`), inside a transaction, with `is_local = true`:
- the tenant middleware calls `enter_request` inside the request's `transaction.atomic()`;
- a job step, the seed or a test calls `acting_in(tenant_id)`, which opens its own atomic block;
- `create_developer` and `staff_open` switch the current transaction to the new Developer.

`current_membership()` gives the request's current Membership with its Project scope (none = all).
The only cross-tenant reads are six named database functions: platform's four, wrapped below
(`user_developers`, `staff_developers`, `invitation_by_token` and `ended_access`), and `projects`'
two, which read platform only through them (`ended_access_projects` and `invitation_projects`,
wrapped in `projects.services.access`).
"""

import hashlib
import secrets
import uuid
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Literal

from django.conf import settings
from django.contrib.sessions.backends.base import SessionBase
from django.core.exceptions import PermissionDenied
from django.db import connection, transaction
from django.db.models import DateTimeField, Q
from django.db.models.expressions import RawSQL
from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone

from vextrus.platform.ids import new_id
from vextrus.platform.messages import tenancy as acts
from vextrus.platform.models import Developer, Market, Membership, MembershipProject, Role, User
from vextrus.platform.services import events

DATABASE_NOW = RawSQL("pg_catalog.now()", [], output_field=DateTimeField())
"""The transaction's start by the database's clock: the "now" the named functions compare with
(`user_developers` holds a Membership current from its `starts_at` until its `expires_at`). Django's
`Now()` is the statement's time and the app's clock is its own; neither agrees with it (07)."""

SESSION_TENANT = "vextrus.tenant_id"
"""The session key naming the Developer a member works in (the chooser writes it)."""
SESSION_ENDED = "vextrus.ended_membership_id"
"""The session key naming the Membership whose end made the session forget its Developer, so a
reload still shows "Access ended" (m0-screens §4.1), not the chooser. Only `enter_request` writes it;
choosing a Developer and signing in forget it, and signing out flushes the session."""
STAFF_SESSION_TENANT = "vextrus.staff_tenant_id"
"""The session key naming the Developer a member of Vextrus's staff acts in, in the admin only."""


@dataclass(frozen=True)
class CurrentMembership:
    """The acting user's current Membership in the acting Developer."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    expires_at: datetime | None
    project_ids: frozenset[uuid.UUID] = field(default_factory=frozenset)
    """The Projects it may open; empty means every Project."""

    def may_open(self, project_id: uuid.UUID) -> bool:
        return not self.project_ids or project_id in self.project_ids


@dataclass(frozen=True)
class Tenancy:
    """What a request or a step acts as. With no tenant, it sees no tenant's rows."""

    user_id: uuid.UUID | None = None
    tenant_id: uuid.UUID | None = None
    library_id: uuid.UUID | None = None
    membership: CurrentMembership | None = None


_NOBODY = Tenancy()
_current: ContextVar[Tenancy] = ContextVar("vextrus_tenancy", default=_NOBODY)


def current() -> Tenancy:
    return _current.get()


def current_membership() -> CurrentMembership | None:
    """The request's current Membership and its Project scope, or None (no tenant, or staff)."""
    return _current.get().membership


def current_tenant_id() -> uuid.UUID | None:
    return _current.get().tenant_id


# The settings -----------------------------------------------------------------------------------


def _set(tenancy: Tenancy) -> None:
    """Set all three settings for the rest of this transaction (never outside one)."""
    if connection.get_autocommit():
        raise transaction.TransactionManagementError(
            "the tenant settings are transaction-local: set them inside transaction.atomic()"
        )
    values = [
        settings.VEXTRUS_USER_SETTING,
        _text(tenancy.user_id),
        settings.VEXTRUS_TENANT_SETTING,
        _text(tenancy.tenant_id),
        settings.VEXTRUS_LIBRARY_SETTING,
        _text(tenancy.library_id),
    ]
    with connection.cursor() as cursor:
        cursor.execute(
            "select set_config(%s, %s, true), set_config(%s, %s, true), set_config(%s, %s, true)",
            values,
        )


def _text(value: uuid.UUID | None) -> str:
    return "" if value is None else str(value)


class LibraryNotATenant(PermissionDenied):
    """A Library is never the acting tenant: its rows are written only by `sync_library`, through
    the owner alias, and the own-tenant policy would let code acting in it write them (07)."""


def _enter(tenancy: Tenancy) -> Tenancy:
    """Act as `tenancy`; its library is read from the tenant's own row when not given.

    Every way of acting in a tenant comes here (`acting_in`, `enter_request`, `choose_developer`,
    `staff_open`, `create_developer`), so a Library is refused here, whoever asks.
    """
    _set(Tenancy(user_id=tenancy.user_id))
    if tenancy.tenant_id is not None:
        _set(Tenancy(user_id=tenancy.user_id, tenant_id=tenancy.tenant_id))
        found = (
            Developer.objects.filter(id=tenancy.tenant_id)
            .values_list("library_id", "is_library")
            .first()
        )
        if found is not None and found[1]:
            _set(Tenancy(user_id=tenancy.user_id))
            raise LibraryNotATenant(tenancy.tenant_id)
        if tenancy.library_id is None:
            library_id = found[0] if found is not None else None
            tenancy = Tenancy(tenancy.user_id, tenancy.tenant_id, library_id, tenancy.membership)
    _set(tenancy)
    _current.set(tenancy)
    return tenancy


@contextmanager
def acting_in(tenant_id: uuid.UUID | None, *, user_id: uuid.UUID | None = None) -> Iterator[Tenancy]:
    """Act in a Developer inside a new atomic block (a job step, the seed, a test).

    On leaving normally, the settings and `current()` go back to what they were; on an error the
    block rolls back, and the settings with it.

    With no user (a job step of the system, the seed), it acts in the Developer. With a user, it acts
    in the Developer only through that user's current Membership there, as `enter_request` does: a
    user whose Membership there lapsed, was revoked, has not started or never existed acts in no
    tenant, seeing no tenant's rows and writing none, never the whole tenant with no scope (07).
    """
    before = _current.get()
    with transaction.atomic():
        _set(Tenancy(user_id=user_id))
        membership = _membership(user_id, tenant_id)
        if user_id is not None and membership is None:
            tenant_id = None
        try:
            yield _enter(Tenancy(user_id=user_id, tenant_id=tenant_id, membership=membership))
        finally:
            _current.set(before)
        _set(before)


# Requests ---------------------------------------------------------------------------------------


def enter_request(request: HttpRequest) -> Tenancy:
    """Set the request's tenancy inside its transaction (the tenant middleware calls this).

    Signed out: nobody. In the admin, a member of Vextrus's staff acts in the Developer they picked
    through `staff_developers` (no Membership). Elsewhere, the session names the Developer, and the
    user's Membership there must be current; if it is not, the session forgets it, and keeps the
    Membership that ended there, if one did (`SESSION_ENDED`).
    """
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return _enter(_NOBODY)
    user_id: uuid.UUID = user.pk
    session: SessionBase = request.session
    if user.is_vextrus_staff and _in_admin(request):
        tenant_id = _uuid(session.get(STAFF_SESSION_TENANT))
        try:
            tenancy = _enter(Tenancy(user_id=user_id, tenant_id=tenant_id))
        except LibraryNotATenant:
            tenant_id, tenancy = None, _enter(Tenancy(user_id=user_id))
            session.pop(STAFF_SESSION_TENANT, None)
        if tenant_id is not None and not _is_developer(tenant_id):
            session.pop(STAFF_SESSION_TENANT, None)
            return _enter(Tenancy(user_id=user_id))
        return tenancy
    tenant_id = _uuid(session.get(SESSION_TENANT))
    _set(Tenancy(user_id=user_id))
    membership = _membership(user_id, tenant_id) if tenant_id else None
    if tenant_id is not None and membership is None:
        session.pop(SESSION_TENANT, None)
        _keep_ended(session, tenant_id)
        return _enter(Tenancy(user_id=user_id))
    return _enter(Tenancy(user_id=user_id, tenant_id=tenant_id, membership=membership))


def _keep_ended(session: SessionBase, tenant_id: uuid.UUID) -> None:
    """Keep the Membership whose end the session's Developer was forgotten for (read, as
    `ended_access` reads it, for the signed-in user alone); none, when none ended there."""
    ended = next((held for held in ended_access() if held.developer_id == tenant_id), None)
    if ended is None:
        session.pop(SESSION_ENDED, None)
    else:
        session[SESSION_ENDED] = str(ended.membership_id)


def session_ended(request: HttpRequest, ended: Iterable[EndedAccess]) -> uuid.UUID | None:
    """The Membership whose end made this session forget its Developer, while it is still among the
    user's `ended` access; else None, and the session forgets it (it is current again, or it was
    never the user's)."""
    session: SessionBase = request.session
    kept = _uuid(session.get(SESSION_ENDED))
    if kept is not None and kept in {held.membership_id for held in ended}:
        return kept
    session.pop(SESSION_ENDED, None)
    return None


def leave_request() -> None:
    _current.set(_NOBODY)


def choose_developer(request: HttpRequest, developer_id: uuid.UUID) -> Tenancy:
    """Work in one of the user's own Developers (the "Which Developer?" chooser, 07)."""
    if developer_id not in {choice.id for choice in user_developers()}:
        raise NotYours(developer_id)
    request.session[SESSION_TENANT] = str(developer_id)
    request.session.pop(SESSION_ENDED, None)
    return enter_request(request)


def _in_admin(request: HttpRequest) -> bool:
    # `reverse` includes the script prefix, as `path` does (`path_info` does not).
    return request.path.startswith(reverse("admin:index"))


def _uuid(value: object) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value)) if value else None
    except ValueError:
        return None


def _is_developer(tenant_id: uuid.UUID) -> bool:
    return Developer.objects.filter(id=tenant_id, is_library=False).exists()


def _membership(user_id: uuid.UUID | None, tenant_id: uuid.UUID | None) -> CurrentMembership | None:
    """The user's current Membership in the Developer, read through the user's own rows.

    "Current" is judged by the database's clock, `DATABASE_NOW`, as `user_developers()` judges it,
    so the two never disagree about one Membership (the app's clock runs a little ahead)."""
    if user_id is None or tenant_id is None:
        return None
    found = (
        Membership.objects.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            accepted_at__isnull=False,
            revoked_at__isnull=True,
            starts_at__lte=DATABASE_NOW,
        )
        .exclude(expires_at__lte=DATABASE_NOW)
        .values_list("id", "role", "expires_at")
        .first()
    )
    if found is None:
        return None
    membership_id, role, expires_at = found
    # A Membership's Projects are read in its own tenant (MembershipProject has no user policy).
    _set(Tenancy(user_id=user_id, tenant_id=tenant_id))
    project_ids = frozenset(
        MembershipProject.objects.filter(tenant_id=tenant_id, membership_id=membership_id).values_list(
            "project_id", flat=True
        )
    )
    _set(Tenancy(user_id=user_id))
    return CurrentMembership(membership_id, tenant_id, user_id, role, expires_at, project_ids)


# platform's named cross-tenant functions -------------------------------------------------------


@dataclass(frozen=True)
class DeveloperChoice:
    id: uuid.UUID
    name: str


@dataclass(frozen=True)
class PendingInvitation:
    id: uuid.UUID
    tenant_id: uuid.UUID
    developer_name: str
    role: str
    invited_email: str
    invited_by_id: uuid.UUID | None
    outside_org: str
    starts_at: datetime
    expires_at: datetime | None
    invite_expires_at: datetime
    project_ids: tuple[uuid.UUID, ...]


@dataclass(frozen=True)
class EndedAccess:
    """A Developer whose access has ended for the signed-in user, who holds no current Membership
    there now: their latest-ended Membership in it (the "Access ended" page, m0-screens §4.1)."""

    membership_id: uuid.UUID
    developer_id: uuid.UUID
    developer_name: str
    role: str
    ended_at: datetime
    how: Literal["revoked", "expired"]
    """By its end date, if that passed first; else revoked."""
    revoked_by: str | None
    """The name of whoever revoked it; None when it expired, or when no act names who did."""
    project_ids: tuple[uuid.UUID, ...]
    """The Projects it gave; empty means every Project (`projects` names them)."""


class NotYours(PermissionDenied):
    """A Developer the signed-in user may not act in."""


def user_developers() -> list[DeveloperChoice]:
    """The Developers of the signed-in user's current Memberships, by name."""
    with connection.cursor() as cursor:
        cursor.execute("select id, name from user_developers()")
        return [DeveloperChoice(*row) for row in cursor.fetchall()]


def staff_developers() -> list[DeveloperChoice]:
    """Every Developer, by name, when the signed-in user is Vextrus staff; else none."""
    with connection.cursor() as cursor:
        cursor.execute("select id, name from staff_developers()")
        return [DeveloperChoice(*row) for row in cursor.fetchall()]


def invitation_by_token(token: str) -> PendingInvitation | None:
    """The one pending invitation a link's token names, or None (used, withdrawn, expired, wrong)."""
    parts = invitation_token_parts(token)
    if parts is None:
        return None
    tenant_id, token_hash = parts
    with connection.cursor() as cursor:
        cursor.execute("select * from invitation_by_token(%s, %s)", [tenant_id, token_hash])
        row = cursor.fetchone()
        names = [column.name for column in cursor.description or ()]
    if row is None:
        return None
    found = dict(zip(names, row, strict=True))
    return PendingInvitation(**{**found, "project_ids": tuple(found["project_ids"])})


def ended_access() -> list[EndedAccess]:
    """The signed-in user's ended access, newest first: one per Developer where they held an
    accepted Membership and now hold no current one (never a Library)."""
    with connection.cursor() as cursor:
        cursor.execute("select * from public.ended_access()")
        names = [column.name for column in cursor.description or ()]
        rows = [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]
    return [EndedAccess(**{**row, "project_ids": tuple(row["project_ids"])}) for row in rows]


# Invitation tokens: "<tenant id>.<secret>"; only the token's hash is stored -----------------------


def new_invitation_token(tenant_id: uuid.UUID) -> tuple[str, str]:
    """(the token, its hash): the token carries its tenant, so a link names one Developer."""
    token = f"{tenant_id}.{secrets.token_urlsafe(32)}"
    return token, _hash(token)


def invitation_token_parts(token: str) -> tuple[uuid.UUID, str] | None:
    head, dot, secret = token.partition(".")
    tenant_id = _uuid(head)
    if not dot or not secret or tenant_id is None:
        return None
    return tenant_id, _hash(token)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# Staff's acts in the admin ----------------------------------------------------------------------


class FirstInvitationRefused(PermissionDenied):
    """Staff may create only a Developer's first MD invitation, and never for one of Vextrus.

    `reason`: `no_developer` (none is picked), `staff` (the email is one of Vextrus's staff, the
    inviter's own among them) or `not_first` (the Developer has a current Membership or a pending
    invitation: one lapsed or withdrawn does not count).
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def staff_open(request: HttpRequest, developer_id: uuid.UUID) -> Tenancy:
    """A member of staff picks the Developer they act in, in the admin. The pick is an act that
    Developer's MD sees."""
    if developer_id not in {choice.id for choice in staff_developers()}:
        raise NotYours(developer_id)
    request.session[STAFF_SESSION_TENANT] = str(developer_id)
    tenancy = _enter(Tenancy(user_id=request.user.pk, tenant_id=developer_id))
    events.record(
        acts.STAFF_OPENED,
        subject_type="developer",
        subject_id=developer_id,
        actor_user_id=request.user.pk,
    )
    return tenancy


def create_developer(
    name: str,
    market_id: uuid.UUID,
    *,
    home_region: str = "",
    actor_user_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """Create a Developer on its Market, its home region the Market's default unless given.

    The new id becomes the tenant for the rest of the transaction (it must be inside one), so the
    row is written, and its act recorded, under its own tenant.
    """
    market = Market.objects.get(id=market_id)
    developer_id = new_id()
    _enter(Tenancy(user_id=actor_user_id, tenant_id=developer_id, library_id=market.tenant_id))
    Developer.objects.create(
        id=developer_id,
        tenant_id=developer_id,
        name=name,
        market=market,
        library_id=market.tenant_id,
        home_region=home_region or market.default_home_region,
    )
    events.record(
        acts.DEVELOPER_CREATED,
        subject_type="developer",
        subject_id=developer_id,
        actor_user_id=actor_user_id,
    )
    return developer_id


@dataclass(frozen=True)
class Invitation:
    membership_id: uuid.UUID
    token: str
    """Shown once, for the link; only its hash is kept."""


def first_md_refusal(email: str, *, invited_by: User) -> FirstInvitationRefused | None:
    """Why staff may not invite `email` as the acting Developer's first MD, or None."""
    tenant_id = current_tenant_id()
    if tenant_id is None:
        return FirstInvitationRefused("no_developer")
    if (
        email.strip().lower() == invited_by.email.lower()
        or User.objects.filter(email__iexact=email.strip(), is_vextrus_staff=True).exists()
    ):
        return FirstInvitationRefused("staff")
    if has_live_membership(tenant_id):
        return FirstInvitationRefused("not_first")
    return None


def has_live_membership(tenant_id: uuid.UUID) -> bool:
    """Whether the Developer has a Membership not ended (revoked or expired), or an invitation
    still pending (not withdrawn, its link not expired). Only then may staff not invite its MD."""
    now = timezone.now()
    current = Q(user__isnull=False, revoked_at__isnull=True) & (
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    )
    pending = Q(user__isnull=True, revoked_at__isnull=True, invite_expires_at__gt=now)
    return Membership.objects.filter(Q(tenant_id=tenant_id) & (current | pending)).exists()


def invite_first_md(email: str, *, invited_by: User) -> Invitation:
    """Staff's one Membership act: the acting Developer's first MD invitation, while it has no
    current Membership nor pending invitation, and never for a member of Vextrus's staff (ADR
    0034). Issued again after an earlier one lapsed, it is recorded as a reissue."""
    tenant_id = current_tenant_id()
    if tenant_id is not None:
        # Holding the Developer's row serialises two first invitations made at once.
        list(Developer.objects.select_for_update().filter(id=tenant_id).values_list("id"))
    refused = first_md_refusal(email, invited_by=invited_by)
    if refused is not None:
        raise refused
    assert tenant_id is not None
    reissued = Membership.objects.filter(tenant_id=tenant_id).exists()
    email = User.objects.normalize_email(email.strip())
    token, token_hash = new_invitation_token(tenant_id)
    membership = Membership.objects.create(
        tenant_id=tenant_id,
        role=Role.MD,
        invited_email=email,
        invited_by=invited_by,
        invite_token_hash=token_hash,
        invite_expires_at=timezone.now() + timedelta(days=settings.VEXTRUS_INVITATION_DAYS),
    )
    events.record(
        acts.FIRST_MD_REISSUED if reissued else acts.FIRST_MD_INVITED,
        subject_type="membership",
        subject_id=membership.id,
        actor_user_id=invited_by.pk,
    )
    return Invitation(membership.id, token)
