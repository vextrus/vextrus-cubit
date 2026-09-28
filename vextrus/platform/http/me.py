"""`/api/me`: who is signed in, their Memberships, their ended access and the current Developer's
Market (ticket 07; the M0 plan, "The Market on the web"); and choosing the current Developer.

Each Membership carries its Projects as ids (`platform` imports no higher module; the web names them
through `projects`' list, and an ended Membership's through `GET /api/ended-access/projects`).
"""

import uuid
from datetime import datetime
from typing import Literal

from django.http import HttpRequest
from ninja import Router, Schema

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services import auth

router = Router()

type RoleName = Literal["qs", "md", "vextrus_engineer", "guest"]


class UserOut(Schema):
    id: uuid.UUID
    name: str
    email: str


class MembershipOut(Schema):
    id: uuid.UUID
    developer_id: uuid.UUID
    developer_name: str
    role: RoleName
    project_ids: list[uuid.UUID]
    """The Projects it may open; empty means every Project."""
    expires_at: datetime | None


class EndedOut(Schema):
    """Access that has ended, in a Developer where the user holds no current Membership now (the
    "Access ended" page, m0-screens §4.1)."""

    membership_id: uuid.UUID
    developer_id: uuid.UUID
    developer_name: str
    role: RoleName
    ended_at: datetime
    how: Literal["revoked", "expired"]
    """By its end date, if that passed first; else revoked."""
    revoked_by: str | None
    """The name of whoever revoked it; None when it expired, or when no act names who did."""
    project_ids: list[uuid.UUID]
    """The Projects it gave; empty means every Project."""


class LanguageOut(Schema):
    code: str
    direction: Literal["ltr", "rtl"]


class CurrencyOut(Schema):
    code: str
    minor_units: int
    symbol: str
    symbol_position: str
    """"before" or "after" the amount, in the page's language."""


class UnitSystemsOut(Schema):
    offered: list[str]
    default: str


class MarketOut(Schema):
    code: str
    name: str
    language: LanguageOut
    locale: str
    """The locale the language borrows for figures and dates."""
    grouping: str
    digits: str
    currency: CurrencyOut
    time_zone: str
    unit_systems: UnitSystemsOut
    days_off: list[int]


class MeOut(Schema):
    user: UserOut
    developer_id: uuid.UUID | None
    """The Developer the session works in; None when none is chosen or its access has ended."""
    memberships: list[MembershipOut]
    ended: list[EndedOut]
    """Newest first, one per Developer."""
    ended_membership_id: uuid.UUID | None
    """The ended Membership this session worked in, while it is one of `ended`: after a reload the
    web still shows "Access ended" for it. Choosing a Developer or signing in again clears it."""
    market: MarketOut | None


class ChooseIn(Schema):
    developer_id: uuid.UUID


def me_out(me: auth.Me) -> MeOut:
    market = None
    if me.market is not None and me.language is not None:
        language = me.language.code
        market = MarketOut(
            code=me.market.code,
            name=me.market.labels.get(language, me.market.code),
            language=LanguageOut(code=language, direction=me.language.direction),
            locale=me.market.borrowed_locales.get(language, language),
            grouping=me.market.grouping,
            digits=me.market.digits,
            currency=CurrencyOut(
                code=me.market.currency.code,
                minor_units=me.market.currency.minor_units,
                symbol=me.market.currency_symbol,
                symbol_position=me.market.currency_symbol_position.get(language, "before"),
            ),
            time_zone=me.market.time_zone,
            unit_systems=UnitSystemsOut(
                offered=list(me.market.unit_systems), default=me.market.default_unit_system
            ),
            days_off=list(me.market.days_off),
        )
    return MeOut(
        user=UserOut(id=me.user_id, name=me.name, email=me.email),
        developer_id=me.developer_id,
        memberships=[
            MembershipOut(
                id=held.id,
                developer_id=held.developer_id,
                developer_name=held.developer_name,
                role=held.role,  # type: ignore[arg-type]
                project_ids=list(held.project_ids),
                expires_at=held.expires_at,
            )
            for held in me.memberships
        ],
        ended=[
            EndedOut(
                membership_id=ended.membership_id,
                developer_id=ended.developer_id,
                developer_name=ended.developer_name,
                role=ended.role,  # type: ignore[arg-type]
                ended_at=ended.ended_at,
                how=ended.how,
                revoked_by=ended.revoked_by,
                project_ids=list(ended.project_ids),
            )
            for ended in me.ended
        ],
        ended_membership_id=me.ended_membership_id,
        market=market,
    )


@router.get("/me", response=MeOut)
@declare(auth.ACCOUNT)
def get_me(request: HttpRequest) -> MeOut:
    return me_out(auth.me(request))


@router.post("/me/developer", response={200: MeOut, 404: Refusal})
@declare(auth.ACCOUNT)
def choose_developer(request: HttpRequest, payload: ChooseIn) -> MeOut:
    """Work in one of the user's Developers (the "Which Developer?" chooser and the switcher)."""
    auth.choose(request, payload.developer_id)
    return me_out(auth.me(request))
