"""The events service: every domain act writes one DomainEvent in the act's own transaction
(docs/data-model.md §2, Events).

An event's kind is a message code declared with `event=True` (so the web words it and the OpenAPI
schema lists it); its payload holds ids and counts only; its time is stored in UTC. It is written in
the tenant the transaction acts in (`app.tenant_id`), and the app can never update or delete one.
"""

import uuid
from collections.abc import Collection, Mapping, Sequence
from datetime import datetime

from django.db import connection
from django.db.models import Max
from django.utils import timezone

from engine.messages import MessageCode
from vextrus.platform.models import DomainEvent

type Value = int | uuid.UUID
"""A payload value: a count or an id. Never prose, a float or a name."""


class NoTenant(RuntimeError):
    """An act was recorded outside any tenant."""


def acting_tenant_id() -> uuid.UUID | None:
    """The tenant this transaction acts in, as row-level security reads it."""
    with connection.cursor() as cursor:
        cursor.execute("select nullif(current_setting('app.tenant_id', true), '')")
        row = cursor.fetchone()
    return uuid.UUID(row[0]) if row and row[0] else None


def record(
    kind: MessageCode,
    *,
    subject_type: str,
    subject_id: uuid.UUID | None = None,
    actor_user_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    building_id: uuid.UUID | None = None,
    payload: Mapping[str, Value] | None = None,
    occurred_at: datetime | None = None,
) -> uuid.UUID:
    """Write one DomainEvent in the acting tenant and return its id."""
    if not kind.event:
        raise ValueError(f"{kind.code} is not declared as an event (event=True)")
    tenant_id = acting_tenant_id()
    if tenant_id is None:
        raise NoTenant(f"{kind.code} was recorded outside any tenant")
    event = DomainEvent.objects.create(
        tenant_id=tenant_id,
        kind=kind.code,
        subject_type=subject_type,
        subject_id=subject_id,
        actor_user_id=actor_user_id,
        project_id=project_id,
        building_id=building_id,
        payload=_ids_and_counts(payload or {}),
        occurred_at=occurred_at or timezone.now(),
    )
    return event.id


def latest(
    kinds: Sequence[MessageCode], *, subject_type: str, subject_ids: Collection[uuid.UUID]
) -> dict[tuple[str, uuid.UUID], datetime]:
    """When each subject's latest event of each kind happened, in the acting tenant (row-level
    security): `{(kind's code, subject_id): occurred_at}` (a module's state kept as its events, e.g.
    `drawings`' "Mark for Vextrus")."""
    if not kinds or not subject_ids:
        return {}
    found = (
        DomainEvent.objects.filter(
            kind__in=[k.code for k in kinds],
            subject_type=subject_type,
            subject_id__in=list(subject_ids),
        )
        .values_list("kind", "subject_id")
        .annotate(at=Max("occurred_at"))
    )
    return {(kind, subject): at for kind, subject, at in found if subject is not None}


def _ids_and_counts(payload: Mapping[str, Value]) -> dict[str, int | str]:
    kept: dict[str, int | str] = {}
    for name, value in payload.items():
        if isinstance(value, bool) or not isinstance(value, int | uuid.UUID):
            raise TypeError(f"an event's payload holds ids and counts only; {name} is {value!r}")
        kept[name] = str(value) if isinstance(value, uuid.UUID) else value
    return kept
