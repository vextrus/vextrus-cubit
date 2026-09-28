"""The events service: one DomainEvent per act, in the acting tenant, ids and counts only, its time
in UTC, append-only (docs/data-model.md §2, Events and Types)."""

import uuid
from collections.abc import Callable
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from django.db import DatabaseError, connections, transaction

from engine.messages import MessageCode
from vextrus.platform.messages import tenancy as acts
from vextrus.platform.models import DomainEvent
from vextrus.platform.services import events, tenancy


@pytest.fixture
def developer(make_developer: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_developer()


@pytest.mark.django_db
def test_an_act_is_recorded_in_the_acting_tenant_with_ids_and_counts(developer: uuid.UUID) -> None:
    actor, subject = uuid.uuid4(), uuid.uuid4()
    with tenancy.acting_in(developer):
        made = events.record(
            acts.STAFF_OPENED,
            subject_type="developer",
            subject_id=subject,
            actor_user_id=actor,
            payload={"sheets": 12, "sheet_id": subject},
        )
        event = DomainEvent.objects.get(id=made)

    assert (event.tenant_id, event.kind, event.actor_user_id) == (
        developer,
        "platform.tenancy.staff_opened",
        actor,
    )
    assert event.payload == {"sheets": 12, "sheet_id": str(subject)}


@pytest.mark.django_db
@pytest.mark.parametrize("value", ["Shapla Homes Ltd", 1.5, True, None])
def test_a_payload_holds_ids_and_counts_only(developer: uuid.UUID, value: object) -> None:
    with tenancy.acting_in(developer), pytest.raises(TypeError, match="ids and counts only"):
        events.record(acts.STAFF_OPENED, subject_type="developer", payload={"x": value})  # type: ignore[dict-item]


@pytest.mark.django_db
def test_only_an_event_code_is_an_event_s_kind_and_only_inside_a_tenant(developer: uuid.UUID) -> None:
    with pytest.raises(ValueError, match="not declared as an event"):
        events.record(MessageCode("platform.tenancy.not_an_event"), subject_type="developer")
    with tenancy.acting_in(None), pytest.raises(events.NoTenant):
        events.record(acts.STAFF_OPENED, subject_type="developer")


@pytest.mark.django_db
def test_times_are_stored_in_utc(developer: uuid.UUID) -> None:
    in_dhaka = datetime(2026, 9, 28, 9, 30, tzinfo=ZoneInfo("Asia/Dhaka"))
    with tenancy.acting_in(developer), connections["default"].cursor() as cursor:
        made = events.record(acts.STAFF_OPENED, subject_type="developer", occurred_at=in_dhaka)
        cursor.execute("show timezone")
        zone = cursor.fetchone()
        cursor.execute("select occurred_at::text from platform_domainevent where id = %s", [made])
        stored = cursor.fetchone()

    assert zone == ("UTC",)
    assert stored == ("2026-09-28 03:30:00+00",)


@pytest.mark.django_db
def test_every_platform_time_is_a_timestamp_with_time_zone() -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute(
            """
            select table_name || '.' || column_name, data_type from information_schema.columns
             where table_schema = 'public' and table_name like 'platform_%%'
               and data_type like 'time%%'
            """
        )
        found = dict(cursor.fetchall())

    assert found
    assert set(found.values()) == {"timestamp with time zone"}


@pytest.mark.django_db
def test_an_event_is_never_updated_or_deleted(developer: uuid.UUID) -> None:
    with tenancy.acting_in(developer), connections["default"].cursor() as cursor:
        made = events.record(acts.STAFF_OPENED, subject_type="developer")
        for sql in (
            "update platform_domainevent set kind = 'x' where id = %s",
            "delete from platform_domainevent where id = %s",
        ):
            with pytest.raises(DatabaseError, match="permission denied"), transaction.atomic():
                cursor.execute(sql, [made])
