"""Who may do what: acts, the role-to-act rule, `require`, and signing in (ticket 07).

**Acts.** Every operation of every module does one act. A module declares its acts in its own package,
each with the grant it needs, and never edits a list here:

    from vextrus.platform.services.auth import Act, Grant

    OPEN = Act("projects.open", Grant.LOOK)
    CREATE = Act("projects.create", Grant.CHANGE)

**The role-to-act rule** is `ROLES`, from grant to the roles holding it (docs/design/m0-screens.md
§1.4; the owner's rulings on its §9). It is the one place the Guest's and the MD's read-only states
are decided: a Guest and an MD may LOOK but never CHANGE; a Developer that wants an outsider to work
gives them the QS role instead.

**`require(act, project_id)`** refuses an act the acting Membership's role lacks, and answers "not
found" for a Project outside the Membership's scope, so a Project's existence never leaks (the M0
plan, "Project scope"). An operation declares its act through `platform.http.acts.declare`, which
calls `require`; a service may call it again once it knows the Project (by its code, say).

A refusal is a `Refused`, carrying the HTTP status and the machine's sentence (`{code, params}`); the
declared operation turns it into its response, so a service raises one anywhere below a view.
"""

import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Literal

from django.contrib.auth import authenticate, login, logout, password_validation
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone
from django.utils.translation import get_language_info

from engine.messages import Message, MessageCode
from vextrus.platform.messages import auth as codes
from vextrus.platform.models import Membership, Role, User
from vextrus.platform.services import markets, tenancy
from vextrus.platform.services.tenancy import CurrentMembership

# Acts and the role-to-act rule --------------------------------------------------------------------


class Grant(StrEnum):
    """What an act needs. The grants are platform's; the acts are every module's own."""

    ACCOUNT = "account"
    """The signed-in user's own account (who they are, which Developer they work in, signing out):
    anyone signed in, with or without a current Membership."""
    LOOK = "look"
    """Read a Developer's data: its projects, drawings, Takeoff. Every role."""
    CHANGE = "change"
    """Change that data. The QS and the Vextrus Engineer; never the MD or a Guest."""
    PEOPLE = "people"
    """See who has access to the Developer. Everyone but a Guest."""
    ACCESS = "access"
    """Give, renew and end access, and see Vextrus's access and the unused invitations. The MD and
    the QS; `services.invitations` narrows the QS's to the Vextrus Engineers they invite."""
    ACTS = "acts"
    """Read the Developer's acts, the event log. The MD and the QS."""


ROLES: Mapping[Grant, frozenset[str]] = {
    Grant.ACCOUNT: frozenset(Role.values),
    Grant.LOOK: frozenset(Role.values),
    Grant.CHANGE: frozenset({Role.QS, Role.VEXTRUS_ENGINEER}),
    Grant.PEOPLE: frozenset({Role.QS, Role.MD, Role.VEXTRUS_ENGINEER}),
    Grant.ACCESS: frozenset({Role.QS, Role.MD}),
    Grant.ACTS: frozenset({Role.QS, Role.MD}),
}
"""The roles holding each grant (m0-screens §1.4)."""


@dataclass(frozen=True)
class Act:
    """One thing a member may do, named `<module>.<what>` ("projects.create"), and its grant."""

    code: str
    grant: Grant

    def __post_init__(self) -> None:
        MessageCode(self.code)  # the same dotted lower-case words a message code is named by
        if not isinstance(self.grant, Grant):
            raise TypeError(f"{self.code}'s grant must be a Grant, not {self.grant!r}")


# platform's own acts
ACCOUNT = Act("platform.account", Grant.ACCOUNT)
SEE_PEOPLE = Act("platform.see_people", Grant.PEOPLE)
SEE_ACCESS = Act("platform.see_access", Grant.ACCESS)
MANAGE_ACCESS = Act("platform.manage_access", Grant.ACCESS)
SEE_ACTS = Act("platform.see_acts", Grant.ACTS)


def allows(role: str, act: Act) -> bool:
    return role in ROLES[act.grant]


# Refusals -----------------------------------------------------------------------------------------


class Refused(Exception):
    """An act refused: the HTTP status and why, as the machine's sentence."""

    status = 403

    def __init__(self, message: Message, status: int | None = None) -> None:
        super().__init__(message["code"])
        self.message = message
        if status is not None:
            self.status = status


class NotSignedIn(Refused):
    status = 401

    def __init__(self) -> None:
        super().__init__(codes.SIGNED_OUT())


class NoDeveloper(Refused):
    status = 403

    def __init__(self) -> None:
        super().__init__(codes.NO_DEVELOPER())


class NotAllowed(Refused):
    status = 403

    def __init__(self, role: str) -> None:
        super().__init__(codes.NOT_ALLOWED(role=role))


class NotFound(Refused):
    """Not found, whether it is missing, another Developer's or outside the Project scope."""

    status = 404

    def __init__(self) -> None:
        super().__init__(codes.NOT_FOUND())


# The check ----------------------------------------------------------------------------------------


def require(act: Act, project_id: uuid.UUID | None = None) -> CurrentMembership | None:
    """The acting Membership, when it may do `act` (in the Project, when one is named); else a refusal.

    Signed out: `NotSignedIn`. An ACCOUNT act needs nothing more (and returns the Membership, if
    any). Any other needs a current Membership in the Developer the session names (the tenant
    middleware checks it on every request, so a revoked or expired one is refused on the next
    request, an existing session's included): else `NoDeveloper`. A Project outside the scope is
    `NotFound`, checked before the role, so its existence never leaks; then the role must hold the
    act's grant, else `NotAllowed`.
    """
    acting = tenancy.current()
    if acting.user_id is None:
        raise NotSignedIn
    membership = acting.membership
    if act.grant is Grant.ACCOUNT:
        if project_id is not None:
            raise TypeError(f"{act.code} is the user's own account's: it acts in no Project")
        return membership
    if membership is None or membership.tenant_id != acting.tenant_id:
        raise NoDeveloper
    if project_id is not None and not membership.may_open(project_id):
        raise NotFound
    if not allows(membership.role, act):
        raise NotAllowed(membership.role)
    return membership


def acting_membership(act: Act) -> CurrentMembership:
    """`require(act)` for an act that needs a Membership (any grant but ACCOUNT)."""
    membership = require(act)
    if membership is None:
        raise NoDeveloper
    return membership


# Signing in and out, and choosing the Developer ---------------------------------------------------


def sign_in(request: HttpRequest, email: str, password: str) -> User:
    """Sign in by email and password, never saying which was wrong.

    Django's `login` gives the session a new key (no session fixation) and a new CSRF token. Whatever
    Developer the session named before is forgotten; with exactly one current Membership, its
    Developer becomes the current one, else the user chooses (m0-screens §4.2).
    """
    user = authenticate(request, username=email.strip(), password=password)
    if not isinstance(user, User):
        raise Refused(codes.WRONG_CREDENTIALS(), status=401)
    start_session(request, user)
    return user


def start_session(request: HttpRequest, user: User, developer_id: uuid.UUID | None = None) -> None:
    """Sign `user` in on this request, working in `developer_id`, or in their only Developer."""
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    # `login` keeps the key when the same user signs in again on a signed-in session: never keep it.
    request.session.cycle_key()
    request.session.pop(tenancy.SESSION_TENANT, None)
    tenancy.enter_request(request)
    if developer_id is None:
        choices = tenancy.user_developers()
        developer_id = choices[0].id if len(choices) == 1 else None
    if developer_id is not None:
        choose(request, developer_id)


def sign_out(request: HttpRequest) -> None:
    """End the session: its data is flushed and its key dropped."""
    logout(request)
    tenancy.enter_request(request)


def choose(request: HttpRequest, developer_id: uuid.UUID) -> None:
    """Work in one of the user's Developers; one they hold no current Membership in is not found."""
    try:
        tenancy.choose_developer(request, developer_id)
    except tenancy.NotYours:
        raise NotFound from None


# Passwords ----------------------------------------------------------------------------------------

_PASSWORD_CODES: Mapping[str, MessageCode] = {
    "password_too_common": codes.PASSWORD_TOO_COMMON,
    "password_too_similar": codes.PASSWORD_TOO_SIMILAR,
    "password_entirely_numeric": codes.PASSWORD_ENTIRELY_NUMERIC,
}


def check_password(password: str, user: User) -> None:
    """Refuse a password the rules refuse (settings `AUTH_PASSWORD_VALIDATORS`), by its code."""
    try:
        password_validation.validate_password(password, user)
    except ValidationError as refused:
        first = refused.error_list[0]
        params = first.params if isinstance(first.params, dict) else {}
        if first.code == "password_too_short":
            message = codes.PASSWORD_TOO_SHORT(min=int(params.get("min_length", 0)))
        else:
            known = _PASSWORD_CODES.get(first.code or "")
            message = known() if known else codes.PASSWORD_REFUSED()
        raise Refused(message, status=400) from None


# Who the signed-in user is ------------------------------------------------------------------------


@dataclass(frozen=True)
class MembershipView:
    """One of the user's current Memberships, in any of their Developers."""

    id: uuid.UUID
    developer_id: uuid.UUID
    developer_name: str
    role: str
    project_ids: tuple[uuid.UUID, ...]
    """The Projects it may open; empty means every Project."""
    expires_at: datetime | None


@dataclass(frozen=True)
class EndedAccess:
    """The latest ended Membership in a Developer where the user now holds none (the "Access ended"
    page, m0-screens §4.1). Read through the user's own rows only: the Developer's name is the web's
    to remember from when it was current."""

    membership_id: uuid.UUID
    developer_id: uuid.UUID
    role: str
    ended_at: datetime
    how: Literal["revoked", "expired"]


@dataclass(frozen=True)
class Language:
    code: str
    direction: Literal["ltr", "rtl"]


@dataclass(frozen=True)
class Me:
    user_id: uuid.UUID
    name: str
    email: str
    developer_id: uuid.UUID | None
    """The Developer the session works in, or None (none chosen, or its access ended)."""
    memberships: tuple[MembershipView, ...]
    ended: tuple[EndedAccess, ...]
    market: markets.MarketProfile | None
    """The current Developer's Market, for the web's formatters."""
    language: Language | None
    """The language pages are shown in (the Market's default: users choose none in M0)."""


def me() -> Me:
    """The signed-in user, their current Memberships (each with its Projects as ids and end date),
    their ended access, and the current Developer's Market."""
    acting = tenancy.current()
    if acting.user_id is None:
        raise NotSignedIn
    user = User.objects.get(id=acting.user_id)
    memberships = []
    for choice in tenancy.user_developers():
        with tenancy.acting_in(choice.id, user_id=user.pk) as there:
            if there.membership is None:  # ended between the two reads
                continue
            held = there.membership
        memberships.append(
            MembershipView(
                id=held.id,
                developer_id=choice.id,
                developer_name=choice.name,
                role=held.role,
                project_ids=tuple(sorted(held.project_ids)),
                expires_at=held.expires_at,
            )
        )
    developer_id = acting.membership.tenant_id if acting.membership else None
    market = markets.of_developer(developer_id) if developer_id else None
    language = None
    if market is not None:
        bidi = get_language_info(market.default_language)["bidi"]
        language = Language(market.default_language, "rtl" if bidi else "ltr")
    return Me(
        user_id=user.pk,
        name=user.name,
        email=user.email,
        developer_id=developer_id,
        memberships=tuple(memberships),
        ended=_ended(user.pk, {m.developer_id for m in memberships}),
        market=market,
        language=language,
    )


def _ended(user_id: uuid.UUID, current: set[uuid.UUID]) -> tuple[EndedAccess, ...]:
    now = timezone.now()
    rows = (
        Membership.objects.filter(user_id=user_id, accepted_at__isnull=False)
        .filter(Q(revoked_at__isnull=False) | Q(expires_at__lte=now))
        .exclude(tenant_id__in=current)
        .values_list("id", "tenant_id", "role", "revoked_at", "expires_at")
    )
    latest: dict[uuid.UUID, EndedAccess] = {}
    for membership_id, tenant_id, role, revoked_at, expires_at in rows:
        end = ending(revoked_at, expires_at, now)
        if end is None:
            continue
        ended = EndedAccess(membership_id, tenant_id, role, *end)
        if tenant_id not in latest or latest[tenant_id].ended_at < ended.ended_at:
            latest[tenant_id] = ended
    return tuple(sorted(latest.values(), key=lambda e: (e.ended_at, e.membership_id), reverse=True))


def ending(
    revoked_at: datetime | None, expires_at: datetime | None, now: datetime
) -> tuple[datetime, Literal["revoked", "expired"]] | None:
    """When and how a Membership ended, or None while it has not: by its end date, or revoked
    (whichever came first)."""
    if expires_at is not None and expires_at <= now and (revoked_at is None or expires_at < revoked_at):
        return expires_at, "expired"
    if revoked_at is not None:
        return revoked_at, "revoked"
    return None
