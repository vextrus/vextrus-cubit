"""Signing in and out, the CSRF token, and an invitation link's page and acceptance (ticket 07;
docs/design/m0-screens.md §4.2).

The token of an invitation link travels only in a POST body, never in a URL a server logs: the web
reads it from the link's fragment (`/join#<token>`).
"""

import uuid
from datetime import datetime

from django.http import HttpRequest
from django.middleware.csrf import get_token
from ninja import Field, Router, Schema, Status

from vextrus.platform.http.acts import Refusal, declare, public
from vextrus.platform.http.me import MarketOut, MeOut, RoleName, market_out, me_out
from vextrus.platform.models import User
from vextrus.platform.services import auth, invitations, tenancy

router = Router()


class CsrfOut(Schema):
    token: str
    """Sent back in the `X-CSRFToken` header of every unsafe request."""


class SignIn(Schema):
    email: str = Field(max_length=254)
    password: str = Field(max_length=4096)


class TokenIn(Schema):
    token: str = Field(max_length=200)


class AcceptIn(Schema):
    token: str = Field(max_length=200)
    name: str = Field("", max_length=200)
    """For a new account: the name to be known by."""
    password: str = Field("", max_length=4096)
    """For a new account: its password."""


class InvitationLookUpOut(Schema):
    """What an invitation link offers (`POST /api/invitations/look-up`)."""

    developer_name: str
    invited_by: str | None
    role: RoleName
    email: str
    project_ids: list[uuid.UUID]
    """The Projects it gives; empty means every Project."""
    expires_at: datetime | None
    link_expires_at: datetime
    has_account: bool
    market: MarketOut
    """The Developer's Market, to word and format the page with (no Developer is current yet)."""


@router.get("/auth/csrf", auth=None, response=CsrfOut)
@public
def csrf(request: HttpRequest) -> CsrfOut:
    """The CSRF token (and its cookie), fetched before signing in."""
    return CsrfOut(token=get_token(request))


@router.post("/auth/sign-in", auth=None, response={200: MeOut, 401: Refusal})
@public
def sign_in(request: HttpRequest, payload: SignIn) -> MeOut:
    auth.sign_in(request, payload.email, payload.password)
    return me_out(auth.me(request))


@router.post("/auth/sign-out", response={204: None})
@declare(auth.ACCOUNT)
def sign_out(request: HttpRequest) -> Status[None]:
    auth.sign_out(request)
    return Status(204, None)


@router.post("/invitations/look-up", auth=None, response={200: InvitationLookUpOut, 404: Refusal})
@public
def look_up(request: HttpRequest, payload: TokenIn) -> InvitationLookUpOut:
    """What an invitation link offers, before joining."""
    found = invitations.look_up(payload.token)
    return InvitationLookUpOut(
        developer_name=found.developer_name,
        invited_by=found.invited_by,
        role=found.role,  # type: ignore[arg-type]
        email=found.email,
        project_ids=list(found.project_ids),
        expires_at=found.expires_at,
        link_expires_at=found.link_expires_at,
        has_account=found.has_account,
        market=market_out(found.market, found.language),
    )


@router.post(
    "/invitations/accept",
    auth=None,
    response={200: MeOut, 400: Refusal, 404: Refusal, 409: Refusal},
)
@public
def accept(request: HttpRequest, payload: AcceptIn) -> MeOut:
    """Accept a link: signed in as the invited email, or, for an email with no account yet, making
    it with the name and password given. Then work in the Developer that invited."""
    user = request.user
    if isinstance(user, User) and user.is_authenticated:
        developer_id = invitations.accept(payload.token, user)
        tenancy.enter_request(request)
        auth.choose(request, developer_id)
    else:
        new_user, developer_id = invitations.join(payload.token, payload.name, payload.password)
        auth.start_session(request, new_user, developer_id)
    return me_out(auth.me(request))
