"""The activity API: the Developer's acts, from its event log, as codes with the actor's name and role
(ticket 07; m0-screens §4.4, the Vextrus Engineer's "Acts")."""

import uuid
from datetime import datetime

from django.http import HttpRequest
from ninja import Query, Router, Schema

from vextrus.platform.http.acts import declare
from vextrus.platform.http.me import RoleName
from vextrus.platform.services import activity, auth

router = Router()


class ActorOut(Schema):
    id: uuid.UUID
    name: str
    role: RoleName | None
    vextrus: bool


class ActOut(Schema):
    id: uuid.UUID
    code: str
    """The act's kind: one of the schema's `EventCode`s, worded by the web with `params`."""
    params: dict[str, str | int]
    actor: ActorOut | None
    project_id: uuid.UUID | None
    building_id: uuid.UUID | None
    subject_type: str
    subject_id: uuid.UUID | None
    occurred_at: datetime


class ActsQuery(Schema):
    actor: uuid.UUID | None = None
    """Only this person's acts."""
    project: uuid.UUID | None = None
    """Only acts on this Project."""
    before: uuid.UUID | None = None
    """Read on from this act (the last one of the previous page)."""
    limit: int = 50


@router.get("/activity", response=list[ActOut])
@declare(auth.SEE_ACTS, project="filters.project")
def list_acts(request: HttpRequest, filters: Query[ActsQuery]) -> list[ActOut]:
    """The acts, newest first, at most `limit` (up to 200) at a time."""
    return [
        ActOut(
            id=act.id,
            code=act.code,
            params=act.params,
            actor=ActorOut(**vars(act.actor)) if act.actor else None,
            project_id=act.project_id,
            building_id=act.building_id,
            subject_type=act.subject_type,
            subject_id=act.subject_id,
            occurred_at=act.occurred_at,
        )
        for act in activity.acts(
            actor_user_id=filters.actor,
            project_id=filters.project,
            before=filters.before,
            limit=filters.limit,
        )
    ]
