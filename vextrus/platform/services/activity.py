"""The activity API's service: the Developer's acts, from its event log, in words the web fills in
(ticket 07; docs/data-model.md §2, Events; m0-screens §4.4, "Acts").

Each act is its DomainEvent's kind, a message code every module declares with `event=True` (the
OpenAPI schema lists them as `EventCode`, so this module names none of a higher module's), with its
parameters filled in: `actor`, the acting user's name; `subject`, the name of what the act was about
when platform knows it (a person, a Developer); and the event's own payload of ids and counts. Each
carries the actor's name and role, and whether they are of Vextrus, so the web shows "(Vextrus)".

Only the acting Developer's events are read (row-level security holds that), and a member given
chosen Projects sees what `/api/members` shows them and no more: the acts on those Projects and the
Developer's own, never another Project's, nor one about or by a person hidden from them there
(`invitations.visible_events`).
The actors named are the Developer's members, and Vextrus's staff who opened it in the admin: the MD
sees those picks by name (ADR 0034).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from django.db.models import Q

from engine.messages import Param
from vextrus.platform.models import Developer, DomainEvent, Membership, Role, User
from vextrus.platform.services import auth, invitations

MAX_LIMIT = 200


@dataclass(frozen=True)
class Actor:
    id: uuid.UUID
    name: str
    role: str | None
    """Their role in this Developer, or None for Vextrus's staff acting in the admin."""
    vextrus: bool
    """A Vextrus Engineer, or one of Vextrus's staff: the web adds "(Vextrus)" after the name."""


@dataclass(frozen=True)
class ActView:
    id: uuid.UUID
    code: str
    params: dict[str, Param]
    actor: Actor | None
    project_id: uuid.UUID | None
    building_id: uuid.UUID | None
    subject_type: str
    subject_id: uuid.UUID | None
    occurred_at: datetime


def acts(
    *,
    actor_user_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    before: uuid.UUID | None = None,
    limit: int = 50,
) -> list[ActView]:
    """The acting Developer's acts, newest first: all, or one person's, or one Project's; `before`
    an act's id to read on from it."""
    viewer = auth.require(auth.SEE_ACTS, project_id)
    assert viewer is not None
    found = invitations.visible_events(viewer)
    if actor_user_id is not None:
        found = found.filter(actor_user_id=actor_user_id)
    if project_id is not None:
        found = found.filter(project_id=project_id)
    if before is not None:
        mark = found.filter(id=before).values_list("occurred_at", "id").first()
        if mark is None:
            raise auth.NotFound
        found = found.filter(Q(occurred_at__lt=mark[0]) | Q(occurred_at=mark[0], id__lt=mark[1]))
    events = list(found.order_by("-occurred_at", "-id")[: max(1, min(limit, MAX_LIMIT))])

    actor_ids = {event.actor_user_id for event in events if event.actor_user_id}
    users = {user.pk: user for user in User.objects.filter(id__in=actor_ids)}
    roles = _roles(viewer.tenant_id, actor_ids)
    subjects = _subjects(viewer.tenant_id, events)
    shown = []
    for event in events:
        user = users.get(event.actor_user_id) if event.actor_user_id else None
        actor = None
        if user is not None:
            role = roles.get(user.pk)
            actor = Actor(
                user.pk, user.name, role, role == Role.VEXTRUS_ENGINEER or user.is_vextrus_staff
            )
        params: dict[str, Param] = dict(event.payload)
        params["actor"] = actor.name if actor else ""
        params["subject"] = subjects.get((event.subject_type, event.subject_id), "")
        shown.append(
            ActView(
                id=event.id,
                code=event.kind,
                params=params,
                actor=actor,
                project_id=event.project_id,
                building_id=event.building_id,
                subject_type=event.subject_type,
                subject_id=event.subject_id,
                occurred_at=event.occurred_at,
            )
        )
    return shown


def _roles(tenant_id: uuid.UUID, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Each actor's role in the Developer, from their latest Membership there."""
    roles: dict[uuid.UUID, str] = {}
    for user_id, role in (
        Membership.objects.filter(tenant_id=tenant_id, user_id__in=user_ids)
        .order_by("created_at", "id")
        .values_list("user_id", "role")
    ):
        if user_id is not None:
            roles[user_id] = role
    return roles


def _subjects(
    tenant_id: uuid.UUID, events: list[DomainEvent]
) -> dict[tuple[str, uuid.UUID | None], str]:
    """The names of the people and Developers the acts were about (other subjects are the web's)."""
    memberships = {e.subject_id for e in events if e.subject_type == "membership" and e.subject_id}
    names: dict[tuple[str, uuid.UUID | None], str] = {}
    rows = Membership.objects.filter(tenant_id=tenant_id, id__in=memberships).values_list(
        "id", "user_id", "invited_email"
    )
    people = {row[1] for row in rows if row[1]}
    user_names = dict(User.objects.filter(id__in=people).values_list("id", "name"))
    for membership_id, user_id, email in rows:
        names["membership", membership_id] = user_names.get(user_id, email) if user_id else email
    if any(e.subject_type == "developer" for e in events):
        for developer_id, name in Developer.objects.filter(id=tenant_id).values_list("id", "name"):
            names["developer", developer_id] = name
    return names
