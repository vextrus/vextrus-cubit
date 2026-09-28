"""Members and access: who can open the Developer's Projects, invitations, renewing and revoking
(ticket 07; docs/design/m0-screens.md §4.4). Who may do which is `services.invitations`'."""

import uuid
from datetime import datetime
from typing import Literal

from django.http import HttpRequest
from ninja import Field, Router, Schema, Status

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.http.me import RoleName
from vextrus.platform.services import auth, invitations

router = Router()

type MemberAction = Literal["revoke", "renew", "copy_link", "withdraw"]
"""An act on a row of Members and access (`services.invitations.Action`)."""


class PersonOut(Schema):
    membership_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email: str
    role: RoleName
    outside_org: str
    all_projects: bool
    project_ids: list[uuid.UUID]
    since: datetime
    until: datetime | None
    ended_at: datetime | None
    how_ended: str | None
    revoked_by: str | None
    invited_by: str | None
    invited_by_id: uuid.UUID | None
    acts: int
    last_act_at: datetime | None
    actions: list[MemberAction]
    """What the signed-in member may do to this access now, by the server's rules: `revoke`,
    `renew`."""


class PendingOut(Schema):
    membership_id: uuid.UUID
    email: str
    role: RoleName
    outside_org: str
    all_projects: bool
    project_ids: list[uuid.UUID]
    until: datetime | None
    link_expires_at: datetime
    invited_by: str | None
    invited_by_id: uuid.UUID | None
    actions: list[MemberAction]
    """What the signed-in member may do to this invitation now, by the server's rules: `copy_link`
    (`POST …/link`), `withdraw`."""


class MembersOut(Schema):
    people: list[PersonOut]
    vextrus_access: list[PersonOut]
    invitations: list[PendingOut]


class InviteIn(Schema):
    email: str = Field(max_length=254)
    role: RoleName
    project_ids: list[uuid.UUID] | None = Field(None, max_length=1000)
    """None: every Project; else the chosen ones (at least one)."""
    expires_at: datetime | None = None
    """When the access ends; a Vextrus Engineer's defaults to 30 days ahead."""
    outside_org: str = Field("", max_length=200)
    """The invited person's firm, for someone from outside the Developer."""


class InvitationLinkOut(Schema):
    """A new invitation link's token (an invitation made, or its link made again)."""

    membership_id: uuid.UUID
    token: str
    """Shown once: the web builds the link with it after `#`, so no server logs it."""
    link_expires_at: datetime


class RenewedOut(Schema):
    expires_at: datetime


_REFUSALS: dict[int, type[Refusal]] = {400: Refusal, 404: Refusal, 409: Refusal}


@router.get("/members", response=MembersOut)
@declare(auth.SEE_PEOPLE)
def list_members(request: HttpRequest) -> MembersOut:
    found = invitations.members()
    return MembersOut(
        people=[PersonOut(**vars(person)) for person in found.people],
        vextrus_access=[PersonOut(**vars(person)) for person in found.vextrus_access],
        invitations=[PendingOut(**vars(pending)) for pending in found.invitations],
    )


@router.post("/members/invitations", response={201: InvitationLinkOut, **_REFUSALS})
@declare(auth.MANAGE_ACCESS)
def invite(request: HttpRequest, payload: InviteIn) -> Status[InvitationLinkOut]:
    link = invitations.invite(
        payload.email,
        payload.role,
        project_ids=payload.project_ids,
        expires_at=payload.expires_at,
        outside_org=payload.outside_org,
    )
    return Status(201, InvitationLinkOut(**vars(link)))


@router.post("/members/invitations/{membership_id}/link", response={200: InvitationLinkOut, **_REFUSALS})
@declare(auth.MANAGE_ACCESS)
def reissue_link(request: HttpRequest, membership_id: uuid.UUID) -> InvitationLinkOut:
    """A new link for an invitation not used yet ("Copy link"); the old link stops working."""
    return InvitationLinkOut(**vars(invitations.reissue_link(membership_id)))


@router.post("/members/invitations/{membership_id}/withdraw", response={204: None, **_REFUSALS})
@declare(auth.MANAGE_ACCESS)
def withdraw(request: HttpRequest, membership_id: uuid.UUID) -> Status[None]:
    invitations.withdraw(membership_id)
    return Status(204, None)


@router.post("/members/{membership_id}/revoke", response={204: None, **_REFUSALS})
@declare(auth.MANAGE_ACCESS)
def revoke(request: HttpRequest, membership_id: uuid.UUID) -> Status[None]:
    invitations.revoke(membership_id)
    return Status(204, None)


@router.post("/members/{membership_id}/renew", response={200: RenewedOut, **_REFUSALS})
@declare(auth.MANAGE_ACCESS)
def renew(request: HttpRequest, membership_id: uuid.UUID) -> RenewedOut:
    return RenewedOut(expires_at=invitations.renew(membership_id))
