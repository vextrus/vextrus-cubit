"""Invitations and Memberships: who may open a Developer's data, which Projects, until when (ticket 07;
docs/design/m0-screens.md §1.4 and §4.4; ADR 0034).

**Who invites whom** (the owner's rulings on m0-screens §9, with the Guest of session 02): the MD
invites a QS, an MD, a Guest or a Vextrus Engineer; a QS invites only a Vextrus Engineer, to Projects
the QS may open; a Vextrus Engineer and a Guest invite no one (their roles lack `Grant.ACCESS`). The MD
renews, revokes and withdraws anyone's but their own; a QS only a Vextrus Engineer's the QS invited.

**Projects** are all (`None`) or chosen ones (ids, never none). A member given chosen Projects gives
only those, or fewer; one outside them is "not found", like any Project outside a scope.

**The link** is copied, never emailed: it works once, for `VEXTRUS_INVITATION_DAYS`, through
`tenancy.invitation_by_token`. Its token carries its tenant and is shown once; only its hash is kept,
and accepting clears even that. A lost link is replaced (`reissue_link`), which stops the old one.

**A Vextrus Engineer** is one of Vextrus's staff: their invitation is accepted only with an account
the owner marked `is_vextrus_staff` (`manage.py set_staff`); anyone else is refused and the
invitation stays unused (the owner's ruling, 28 Sep 2026).

**End dates:** a Vextrus Engineer's access always ends (30 days by default, renewable); anyone
else's where the Developer wants it. The tenant middleware checks every request, so the next request
after a revocation or an end is refused, an existing session's included.

Every act writes a DomainEvent the MD sees (`messages/invitations.py`).
"""

import uuid
from collections.abc import Collection, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q, QuerySet
from django.db.models.functions import Now
from django.utils import timezone
from django.views.decorators.debug import sensitive_variables

from engine.messages import MessageCode
from vextrus.platform.messages import invitations as codes
from vextrus.platform.models import Developer, DomainEvent, Membership, MembershipProject, Role, User
from vextrus.platform.services import auth, events, markets, tenancy
from vextrus.platform.services.auth import Refused
from vextrus.platform.services.tenancy import CurrentMembership

RENEW_DAYS: int = settings.VEXTRUS_ENGINEER_MEMBERSHIP_DAYS
"""A renewal adds this many days (m0-screens §4.4, "Renew 30 days")."""

_INVITES: dict[str, frozenset[str]] = {
    Role.MD: frozenset(Role.values),
    Role.QS: frozenset({Role.VEXTRUS_ENGINEER}),
}
"""The roles each role may give; a role absent here gives none."""

type Action = Literal["revoke", "renew", "copy_link", "withdraw"]
"""What the viewer may do to a row of Members and access: `revoke`, `renew`, `reissue_link` ("Copy
link") and `withdraw`, by the rules those acts check (`_actions`)."""


@dataclass(frozen=True)
class NewLink:
    membership_id: uuid.UUID
    token: str
    """Shown once, for the link; only its hash is kept. The web puts it after `#` in the link, so
    it never reaches a server's log."""
    link_expires_at: datetime


def link(token: str) -> str:
    """The invitation link: the web's origin (`VEXTRUS_WEB_ORIGIN`), `/join`, and the token after
    `#`, a fragment the browser never sends, so no server logs it."""
    return f"{settings.VEXTRUS_WEB_ORIGIN.rstrip('/')}/join#{token}"


# Inviting -----------------------------------------------------------------------------------------


def invite(
    email: str,
    role: str,
    *,
    project_ids: Iterable[uuid.UUID] | None = None,
    expires_at: datetime | None = None,
    outside_org: str = "",
) -> NewLink:
    """Invite `email` into the acting Developer as `role`, to every Project (`None`) or the ones
    given, until `expires_at` (a Vextrus Engineer's defaults to 30 days ahead)."""
    inviter = auth.acting_membership(auth.MANAGE_ACCESS)
    chosen = _scope(inviter, project_ids)  # a Project outside the scope: not found, before the role
    if role not in _INVITES.get(inviter.role, frozenset()):
        raise Refused(codes.ROLE_NOT_YOURS(role=role))
    email = _clean_email(email)
    now = timezone.now()
    if role == Role.VEXTRUS_ENGINEER and expires_at is None:
        expires_at = now + timedelta(days=RENEW_DAYS)
    expires_at = _future(expires_at, now)
    # Holding the Developer's row serialises two invitations made at once.
    list(Developer.objects.select_for_update().filter(id=inviter.tenant_id).values_list("id"))
    _refuse_if_present(inviter.tenant_id, email, now)
    token, token_hash = tenancy.new_invitation_token(inviter.tenant_id)
    membership = Membership.objects.create(
        tenant_id=inviter.tenant_id,
        role=role,
        outside_org=outside_org.strip(),
        invited_by_id=inviter.user_id,
        invited_email=email,
        expires_at=expires_at,
        invite_token_hash=token_hash,
        invite_expires_at=now + timedelta(days=settings.VEXTRUS_INVITATION_DAYS),
    )
    _write_projects(membership, chosen)
    _record(codes.INVITED, membership.id, inviter)
    assert membership.invite_expires_at is not None
    return NewLink(membership.id, token, membership.invite_expires_at)


def reissue_link(membership_id: uuid.UUID) -> NewLink:
    """A new link for an invitation not used yet; the old link stops working. It works until the
    same day the old one did."""
    actor = auth.acting_membership(auth.MANAGE_ACCESS)
    membership = _pending(actor, membership_id)
    token, token_hash = tenancy.new_invitation_token(actor.tenant_id)
    _still(_PENDING, membership.id, invite_token_hash=token_hash)
    _record(codes.LINK_REISSUED, membership.id, actor)
    assert membership.invite_expires_at is not None
    return NewLink(membership.id, token, membership.invite_expires_at)


def withdraw(membership_id: uuid.UUID) -> None:
    """Withdraw an invitation not used yet: its link no longer works."""
    actor = auth.acting_membership(auth.MANAGE_ACCESS)
    membership = _pending(actor, membership_id)
    _still(_PENDING, membership.id, revoked_at=Now())
    _record(codes.WITHDRAWN, membership.id, actor)


# Changing a member's access -----------------------------------------------------------------------


def revoke(membership_id: uuid.UUID) -> None:
    """End someone's access now: their next request is refused; what they did stays theirs."""
    actor = auth.acting_membership(auth.MANAGE_ACCESS)
    membership = _member(actor, membership_id)
    _still(_MEMBER, membership.id, revoked_at=Now())
    _record(codes.REVOKED, membership.id, actor)


def renew(membership_id: uuid.UUID) -> datetime:
    """Move an end date `RENEW_DAYS` later (from today, when it has passed); the new end."""
    actor = auth.acting_membership(auth.MANAGE_ACCESS)
    membership = _member(actor, membership_id)
    if membership.expires_at is None:
        raise Refused(codes.NO_END_DATE(), status=409)
    expires_at = max(membership.expires_at, timezone.now()) + timedelta(days=RENEW_DAYS)
    _still(_MEMBER, membership.id, expires_at=expires_at)
    _record(codes.RENEWED, membership.id, actor)
    return expires_at


def set_projects(membership_id: uuid.UUID, project_ids: Iterable[uuid.UUID] | None) -> None:
    """Set the Projects a Membership or an invitation may open: every one (`None`) or those given.

    The service an MD uses to choose an invitation's Projects, under the same rules as `invite`: the
    acting member must be allowed to change this access, and may give only Projects they may open.
    Later seeds call it too (08 scopes the seed's Guest to KR-01), acting as the seed's MD.
    """
    actor = auth.acting_membership(auth.MANAGE_ACCESS)
    membership = _changeable(actor, membership_id)
    if membership.revoked_at is not None:
        raise Refused(codes.ALREADY_ENDED(), status=409)
    chosen = _scope(actor, project_ids)
    MembershipProject.objects.filter(tenant_id=actor.tenant_id, membership_id=membership.id).delete()
    _write_projects(membership, chosen)
    _record(codes.PROJECTS_SET, membership.id, actor)


# Accepting a link ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class LinkDetails:
    """What the link's page shows before joining (m0-screens §4.2, "Invitation link opened")."""

    developer_name: str
    invited_by: str | None
    role: str
    email: str
    project_ids: tuple[uuid.UUID, ...]
    """The Projects it gives; empty means every Project."""
    expires_at: datetime | None
    link_expires_at: datetime
    has_account: bool
    """The email has an account already: sign in with it to accept; else choose a name and password."""
    market: markets.MarketProfile
    """The Developer's Market: the page is shown in its language, locale and time zone."""
    language: auth.Language


@sensitive_variables("token")
def look_up(token: str) -> LinkDetails:
    """What a link offers, or `UNUSABLE` (used, withdrawn, expired, or never issued: never which)."""
    found = tenancy.invitation_by_token(token)
    if found is None:
        raise Refused(codes.UNUSABLE(), status=404)
    inviter = None
    if found.invited_by_id is not None:
        inviter = User.objects.filter(id=found.invited_by_id).values_list("name", flat=True).first()
    market = markets.by_code(found.market_code)
    return LinkDetails(
        developer_name=found.developer_name,
        invited_by=inviter,
        role=found.role,
        email=found.invited_email,
        project_ids=found.project_ids,
        expires_at=found.expires_at,
        link_expires_at=found.invite_expires_at,
        has_account=User.objects.filter(email__iexact=found.invited_email).exists(),
        market=market,
        language=auth.language_of(market),
    )


@sensitive_variables("token")
def accept(token: str, user: User) -> uuid.UUID:
    """Accept the link as `user`, whose email must be the invited one; the Developer's id.

    The link works once: the Membership is taken only while it is still an unused, unwithdrawn,
    unexpired invitation holding this token's hash, in one conditional update (two accepts at once:
    one wins), and the hash is cleared. Access that would already have ended is not taken.
    """
    found = tenancy.invitation_by_token(token)
    parts = tenancy.invitation_token_parts(token)
    if found is None or parts is None:
        raise Refused(codes.UNUSABLE(), status=404)
    if user.email.lower() != found.invited_email.lower():
        raise Refused(codes.WRONG_ACCOUNT(email=found.invited_email))
    if found.role == Role.VEXTRUS_ENGINEER and not _is_staff(user):
        raise Refused(codes.ENGINEER_NOT_STAFF())  # the invitation stays unused
    tenant_id, token_hash = parts
    try:
        # Not yet a member: the system acts in the invitation's Developer, under the user's name.
        with tenancy.acting_in(tenant_id):
            if Membership.objects.filter(
                tenant_id=tenant_id, user=user, revoked_at__isnull=True
            ).exists():
                raise Refused(codes.ALREADY_MEMBER(email=user.email), status=409)
            taken = (
                Membership.objects.filter(
                    id=found.id,
                    tenant_id=tenant_id,
                    user__isnull=True,
                    revoked_at__isnull=True,
                    invite_token_hash=token_hash,
                    invite_expires_at__gt=Now(),
                )
                .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=Now()))
                .update(
                    user=user,
                    accepted_at=tenancy.DATABASE_NOW,
                    starts_at=tenancy.DATABASE_NOW,
                    invite_token_hash="",
                )
            )
            if taken != 1:
                raise Refused(codes.UNUSABLE(), status=404)
            events.record(
                codes.ACCEPTED,
                subject_type="membership",
                subject_id=found.id,
                actor_user_id=user.pk,
            )
    except IntegrityError:  # another Membership of theirs was made at the same moment
        raise Refused(codes.ALREADY_MEMBER(email=user.email), status=409) from None
    return tenant_id


@sensitive_variables("token", "password")
def join(token: str, name: str, password: str) -> tuple[User, uuid.UUID]:
    """Make the invited email's account, with its name and password, and accept the link with it.

    Only for an email with no account yet (one with an account signs in and accepts); the new user
    and the Developer's id.
    """
    found = tenancy.invitation_by_token(token)
    if found is None:
        raise Refused(codes.UNUSABLE(), status=404)
    email = found.invited_email
    if User.objects.filter(email__iexact=email).exists():
        raise Refused(codes.SIGN_IN_FIRST(email=email), status=409)
    if found.role == Role.VEXTRUS_ENGINEER:  # a new account is never staff: only the owner makes one
        raise Refused(codes.ENGINEER_NOT_STAFF())
    name = name.strip()
    if not name:
        raise Refused(codes.NAME_REQUIRED(), status=400)
    user = User(email=User.objects.normalize_email(email), name=name)
    auth.check_password(password, user)
    user.set_password(password)
    try:
        with transaction.atomic():
            user.save()
    except IntegrityError:  # the same email joined at the same moment
        raise Refused(codes.SIGN_IN_FIRST(email=email), status=409) from None
    return user, accept(token, user)


# Who has access -----------------------------------------------------------------------------------


@dataclass(frozen=True)
class Person:
    """A Membership someone accepted, current or ended."""

    membership_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    role: str
    outside_org: str
    all_projects: bool
    project_ids: tuple[uuid.UUID, ...]
    """Its Projects the viewer may open too (every one of them, for a viewer with all Projects)."""
    since: datetime
    until: datetime | None
    ended_at: datetime | None
    how_ended: str | None
    """`revoked` or `expired`, once ended."""
    revoked_by: str | None
    invited_by: str | None
    invited_by_id: uuid.UUID | None
    acts: int
    """How many acts the Developer's event log holds under their name (those the viewer may see)."""
    last_act_at: datetime | None
    actions: tuple[Action, ...]
    """What the viewer may do to it now: `revoke`, `renew`."""


@dataclass(frozen=True)
class Pending:
    """An invitation not used yet, whose link still works."""

    membership_id: uuid.UUID
    email: str
    role: str
    outside_org: str
    all_projects: bool
    project_ids: tuple[uuid.UUID, ...]
    until: datetime | None
    link_expires_at: datetime
    invited_by: str | None
    invited_by_id: uuid.UUID | None
    actions: tuple[Action, ...]
    """What the viewer may do to it now: `copy_link` (a new link), `withdraw`."""


@dataclass(frozen=True)
class Members:
    """Members and access (m0-screens §4.4). A Vextrus Engineer sees the people only."""

    people: tuple[Person, ...]
    vextrus_access: tuple[Person, ...]
    invitations: tuple[Pending, ...]


def members() -> Members:
    """Who can open the acting Developer's Projects, and which, and until when.

    A viewer given chosen Projects sees the people with access to all Projects or to one of theirs,
    and of each person's chosen Projects only those the viewer may open.
    """
    viewer = auth.acting_membership(auth.SEE_PEOPLE)
    sees_access = auth.allows(viewer.role, auth.SEE_ACCESS)
    tenant_id = viewer.tenant_id
    now = timezone.now()
    rows = list(Membership.objects.filter(tenant_id=tenant_id).order_by("created_at", "id"))
    projects = _projects_of(tenant_id, [row.id for row in rows])
    revoked_by = _revokers(tenant_id, [row.id for row in rows if row.revoked_at is not None])
    user_ids = {row.user_id for row in rows} | {row.invited_by_id for row in rows}
    users = {user.pk: user for user in User.objects.filter(id__in=[i for i in user_ids if i])}
    acts = _acts_by_actor(viewer)

    people: list[Person] = []
    vextrus: list[Person] = []
    pending: list[Pending] = []
    for row in rows:
        seen = _seen_projects(viewer, projects.get(row.id, frozenset()))
        if seen is None:
            continue
        all_projects, project_ids = seen
        inviter = users[row.invited_by_id].name if row.invited_by_id in users else None
        if row.user_id is None:
            live = row.revoked_at is None and row.invite_expires_at and row.invite_expires_at > now
            if sees_access and live:
                assert row.invite_expires_at is not None
                pending.append(
                    Pending(
                        membership_id=row.id,
                        email=row.invited_email,
                        role=row.role,
                        outside_org=row.outside_org,
                        all_projects=all_projects,
                        project_ids=project_ids,
                        until=row.expires_at,
                        link_expires_at=row.invite_expires_at,
                        invited_by=inviter,
                        invited_by_id=row.invited_by_id,
                        actions=_actions(viewer, row, now),
                    )
                )
            continue
        user = users[row.user_id]
        ended_at, how = auth.ending(row.revoked_at, row.expires_at, now) or (None, None)
        count, last = acts.get(user.pk, (0, None))
        person = Person(
            membership_id=row.id,
            user_id=user.pk,
            name=user.name,
            email=user.email,
            role=row.role,
            outside_org=row.outside_org,
            all_projects=all_projects,
            project_ids=project_ids,
            since=row.accepted_at or row.starts_at,
            until=row.expires_at,
            ended_at=ended_at,
            how_ended=how,
            revoked_by=revoked_by.get(row.id),
            invited_by=inviter,
            invited_by_id=row.invited_by_id,
            acts=count,
            last_act_at=last,
            actions=_actions(viewer, row, now),
        )
        if row.role != Role.VEXTRUS_ENGINEER:
            people.append(person)
        elif sees_access:
            vextrus.append(person)
    people.sort(key=lambda p: (p.ended_at is not None, p.name.lower(), p.membership_id))
    vextrus.sort(key=lambda p: (p.ended_at is not None, p.since), reverse=False)
    return Members(tuple(people), tuple(vextrus), tuple(pending))


def roles_of(user_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Each user's role in the acting Developer, from their latest Membership of it (current or
    ended): how Step 1's "Who did what" names an actor ("Nusrat Jahan, QS", m0-screens 6.6)."""
    tenant_id = tenancy.current_tenant_id()
    wanted = {i for i in user_ids if i}
    if tenant_id is None or not wanted:
        return {}
    found: dict[uuid.UUID, str] = {}
    rows = Membership.objects.filter(tenant_id=tenant_id, user_id__in=wanted).order_by(
        "created_at", "id"
    )
    for user_id, role in rows.values_list("user_id", "role"):
        found[user_id] = role
    return found


def names_of(role: str, project_id: uuid.UUID) -> list[str]:
    """The names of the people whose current Membership of the acting Developer has `role` and may
    open `project_id` (all its Projects, or that one), in order of name: whom Step 1's read-only bar
    names ("Nusrat Jahan (QS) confirms the sheet list", m0-screens 6.12). Every role may read it."""
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        return []
    now = timezone.now()
    current = Membership.objects.filter(
        tenant_id=tenant_id, role=role, user__isnull=False, revoked_at__isnull=True, starts_at__lte=now
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
    rows = list(current.values_list("id", "user_id"))
    scopes = _projects_of(tenant_id, [membership_id for membership_id, _ in rows])
    users = [
        user_id
        for membership_id, user_id in rows
        if membership_id not in scopes or project_id in scopes[membership_id]
    ]
    names = User.objects.filter(id__in=users, is_active=True).values_list("name", flat=True)
    return sorted(set(names), key=str.lower)


@dataclass(frozen=True)
class Hidden:
    """What a member given chosen Projects may not see of their Developer's people: the Memberships
    `members()` leaves out (none of their Projects is the viewer's), and the users holding only
    those. A viewer with every Project sees everyone."""

    memberships: frozenset[uuid.UUID]
    users: frozenset[uuid.UUID]


def hidden_from(viewer: CurrentMembership) -> Hidden:
    if not viewer.project_ids:
        return Hidden(frozenset(), frozenset())
    rows = list(Membership.objects.filter(tenant_id=viewer.tenant_id).values_list("id", "user_id"))
    projects = _projects_of(viewer.tenant_id, [row[0] for row in rows])
    hidden = {m for m, _ in rows if _seen_projects(viewer, projects.get(m, frozenset())) is None}
    seen_users = {u for m, u in rows if u is not None and m not in hidden}
    users = {u for m, u in rows if u is not None and m in hidden} - seen_users
    return Hidden(frozenset(hidden), frozenset(users))


def visible_events(viewer: CurrentMembership) -> QuerySet[DomainEvent]:
    """The Developer's events the viewer may see: for a member given chosen Projects, those on their
    Projects or on none, and never one about, or by, someone `members()` hides from them."""
    found = DomainEvent.objects.filter(tenant_id=viewer.tenant_id)
    if not viewer.project_ids:
        return found
    hidden = hidden_from(viewer)
    return (
        found.filter(Q(project_id__isnull=True) | Q(project_id__in=viewer.project_ids))
        .exclude(subject_type="membership", subject_id__in=hidden.memberships)
        .exclude(actor_user_id__in=hidden.users)
    )


# Helpers ------------------------------------------------------------------------------------------


def _is_staff(user: User) -> bool:
    """Whether the account is one of Vextrus's staff now, read from its row (the owner sets it)."""
    return User.objects.filter(pk=user.pk, is_vextrus_staff=True, is_active=True).exists()


def _clean_email(email: str) -> str:
    email = User.objects.normalize_email(email.strip())
    try:
        validate_email(email)
    except ValidationError:
        raise Refused(codes.INVALID_EMAIL(), status=400) from None
    return email


def _future(expires_at: datetime | None, now: datetime) -> datetime | None:
    if expires_at is None:
        return None
    if timezone.is_naive(expires_at):
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= now:
        raise Refused(codes.END_IN_PAST(), status=400)
    return expires_at


def _scope(actor: CurrentMembership, project_ids: Iterable[uuid.UUID] | None) -> frozenset[uuid.UUID]:
    """The Projects to give (empty: all), as the actor may give them."""
    if project_ids is None:
        if actor.project_ids:
            raise Refused(codes.PROJECTS_NOT_YOURS())
        return frozenset()
    chosen = frozenset(project_ids)
    if not chosen:
        raise Refused(codes.CHOOSE_A_PROJECT(), status=400)
    if not all(actor.may_open(project) for project in chosen):
        raise auth.NotFound
    return chosen


def _refuse_if_present(tenant_id: uuid.UUID, email: str, now: datetime) -> None:
    """Refuse inviting someone already a member, whose access ended unrevoked, or already invited."""
    user = User.objects.filter(email__iexact=email).first()
    if user is not None:
        for expires_at in Membership.objects.filter(
            tenant_id=tenant_id, user=user, revoked_at__isnull=True
        ).values_list("expires_at", flat=True):
            if expires_at is not None and expires_at <= now:
                raise Refused(codes.ACCESS_ENDED(email=email), status=409)
            raise Refused(codes.ALREADY_MEMBER(email=email), status=409)
    if Membership.objects.filter(
        tenant_id=tenant_id,
        user__isnull=True,
        revoked_at__isnull=True,
        invite_expires_at__gt=now,
        invited_email__iexact=email,
    ).exists():
        raise Refused(codes.ALREADY_INVITED(email=email), status=409)


def _write_projects(membership: Membership, chosen: Collection[uuid.UUID]) -> None:
    MembershipProject.objects.bulk_create(
        MembershipProject(tenant_id=membership.tenant_id, membership=membership, project_id=project)
        for project in sorted(chosen)
    )


def _changeable(actor: CurrentMembership, membership_id: uuid.UUID) -> Membership:
    """The acting Developer's Membership the actor may change: the MD anyone's but their own, a QS
    a Vextrus Engineer's the QS invited. Another Developer's is not found (the user's own rows in
    other Developers are readable, so the tenant is named here, not left to the policy)."""
    membership = Membership.objects.filter(id=membership_id, tenant_id=actor.tenant_id).first()
    if membership is None or membership.id in hidden_from(actor).memberships:
        raise auth.NotFound  # one the actor could not see in `members()` is not found, as missing
    refused = _change_refused(actor, membership)
    if refused is not None:
        raise refused
    return membership


def _change_refused(actor: CurrentMembership, membership: Membership) -> Refused | None:
    """Why the actor may not change this Membership (one they can see), or None when they may."""
    if membership.user_id == actor.user_id:
        return Refused(codes.NOT_YOURSELF())
    if actor.role == Role.MD:
        return None
    if (
        actor.role == Role.QS
        and membership.role == Role.VEXTRUS_ENGINEER
        and membership.invited_by_id == actor.user_id
    ):
        return None
    return Refused(codes.NOT_YOURS_TO_CHANGE())


def _open(membership: Membership, now: datetime) -> bool:
    """An invitation not used, withdrawn or past its link's end."""
    return (
        membership.user_id is None
        and membership.revoked_at is None
        and membership.invite_expires_at is not None
        and membership.invite_expires_at > now
    )


def _pending(actor: CurrentMembership, membership_id: uuid.UUID) -> Membership:
    membership = _changeable(actor, membership_id)
    if not _open(membership, timezone.now()):
        raise Refused(codes.NO_LONGER_OPEN(), status=409)
    return membership


def _actions(viewer: CurrentMembership, membership: Membership, now: datetime) -> tuple[Action, ...]:
    """What the viewer may do to a Membership `members()` shows them, by the rules each act checks
    (`auth.MANAGE_ACCESS`, `_changeable`, then `_pending`, or `_member` and `renew`'s end date), so
    the web never works a right out for itself."""
    if (
        not auth.allows(viewer.role, auth.MANAGE_ACCESS)
        or _change_refused(viewer, membership) is not None
    ):
        return ()
    if membership.user_id is None:
        return ("copy_link", "withdraw") if _open(membership, now) else ()
    if membership.revoked_at is not None:
        return ()
    return ("revoke", "renew") if membership.expires_at is not None else ("revoke",)


def _member(actor: CurrentMembership, membership_id: uuid.UUID) -> Membership:
    membership = _changeable(actor, membership_id)
    if membership.user_id is None:
        raise auth.NotFound
    if membership.revoked_at is not None:
        raise Refused(codes.ALREADY_ENDED(), status=409)
    return membership


_PENDING = Q(user__isnull=True, revoked_at__isnull=True)
_MEMBER = Q(user__isnull=False, revoked_at__isnull=True)


def _still(state: Q, membership_id: uuid.UUID, **changes: object) -> None:
    """Change a Membership only while it is still in the state just checked: an accept or a
    revocation committed in between refuses the act, rather than recording it on the wrong state."""
    if Membership.objects.filter(state, id=membership_id).update(**changes) != 1:
        raise Refused(codes.ALREADY_ENDED() if state is _MEMBER else codes.NO_LONGER_OPEN(), status=409)


def _record(kind: MessageCode, membership_id: uuid.UUID, actor: CurrentMembership) -> None:
    events.record(kind, subject_type="membership", subject_id=membership_id, actor_user_id=actor.user_id)


def _projects_of(
    tenant_id: uuid.UUID, membership_ids: list[uuid.UUID]
) -> dict[uuid.UUID, frozenset[uuid.UUID]]:
    found: dict[uuid.UUID, set[uuid.UUID]] = {}
    for membership_id, project_id in MembershipProject.objects.filter(
        tenant_id=tenant_id, membership_id__in=membership_ids
    ).values_list("membership_id", "project_id"):
        found.setdefault(membership_id, set()).add(project_id)
    return {key: frozenset(value) for key, value in found.items()}


def _seen_projects(
    viewer: CurrentMembership, theirs: frozenset[uuid.UUID]
) -> tuple[bool, tuple[uuid.UUID, ...]] | None:
    """(all Projects?, the Projects shown), or None when the viewer shares no Project with them."""
    if not theirs:
        return True, ()
    shown = theirs if not viewer.project_ids else theirs & viewer.project_ids
    if not shown:
        return None
    return False, tuple(sorted(shown))


def _revokers(tenant_id: uuid.UUID, membership_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not membership_ids:
        return {}
    by_membership: dict[uuid.UUID, uuid.UUID] = {}
    for subject_id, actor_id in (
        DomainEvent.objects.filter(
            tenant_id=tenant_id,
            kind=codes.REVOKED.code,
            subject_id__in=membership_ids,
            actor_user_id__isnull=False,
        )
        .order_by("occurred_at", "id")
        .values_list("subject_id", "actor_user_id")
    ):
        if subject_id is not None and actor_id is not None:
            by_membership[subject_id] = actor_id
    names = dict(User.objects.filter(id__in=set(by_membership.values())).values_list("id", "name"))
    return {subject: names[actor] for subject, actor in by_membership.items() if actor in names}


def _acts_by_actor(viewer: CurrentMembership) -> dict[uuid.UUID, tuple[int, datetime | None]]:
    """Each actor's count of acts and their latest, among the acts the viewer may see."""
    if not auth.allows(viewer.role, auth.SEE_ACTS):
        return {}
    visible = visible_events(viewer).filter(actor_user_id__isnull=False)
    return {
        row["actor_user_id"]: (row["count"], row["last"])
        for row in visible.order_by()
        .values("actor_user_id")
        .annotate(count=Count("id"), last=Max("occurred_at"))
        if row["actor_user_id"] is not None
    }
