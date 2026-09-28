"""JevAnswer and JevOverride as vextrus_app meets them (ticket 15; docs/data-model.md §2): tenant
tables under row-level security, append-only, an override held to its own tenant's answer, its node,
model and Jev's choice, and to a choice its answer offered. Every write is attacked: the service, the
ORM and raw SQL, insert, update, delete and upsert."""

import json
import uuid
from collections.abc import Callable, Iterator
from decimal import Decimal
from typing import Any

import pytest
from django.db import DatabaseError, connections, transaction
from django.db.models import ProtectedError

from vextrus.platform.models import JevAnswer, JevOverride
from vextrus.platform.services import jev, tenancy
from vextrus.platform.tests.policy_coverage import (
    GLOBAL_TABLES,
    INDEX_EXCEPTIONS,
    WIDENINGS,
    coverage_problems,
)
from vextrus.testing.jev import INVENTED_SHEETS, STAND_IN_KINDS, STAND_IN_QUESTION
from vextrus.testing.tenancy import add_member

TABLES = ("platform_jevanswer", "platform_jevoverride")
RLS_REFUSED = "new row violates row-level security policy"
NO_RIGHT = "permission denied for table"


def act(cursor: Any, tenant: uuid.UUID | None = None, user: uuid.UUID | None = None) -> None:
    cursor.execute(
        "select set_config('app.tenant_id', %s, true), set_config('app.user_id', %s, true),"
        " set_config('app.library_id', '', true)",
        [str(tenant or ""), str(user or "")],
    )


def refused(cursor: Any, sql: str, params: list[Any] | None = None) -> str:
    """The error a statement raises, inside its own savepoint so the test goes on."""
    with pytest.raises(DatabaseError) as raised, transaction.atomic():
        cursor.execute(sql, params or [])
    return str(raised.value)


def count(cursor: Any, table: str) -> int:
    cursor.execute(f"select count(*) from {table}")
    [(n,)] = cursor.fetchall()
    return int(n)


@pytest.fixture
def cursor() -> Iterator[Any]:
    with connections["default"].cursor() as cursor:
        yield cursor


@pytest.fixture
def two(make_developer: Callable[..., uuid.UUID]) -> tuple[uuid.UUID, uuid.UUID]:
    return make_developer("Developer A"), make_developer("Developer B")


@pytest.fixture
def in_a(two: tuple[uuid.UUID, uuid.UUID]) -> dict[str, Any]:
    """In A: a QS, an answer (beam_layout) and an override of it (to column_layout)."""
    a, _b = two
    user, _membership = add_member(a)
    with tenancy.acting_in(a, user_id=user.pk):
        answer = jev.ask("sheet_type", INVENTED_SHEETS[0], STAND_IN_QUESTION, STAND_IN_KINDS)
        assert isinstance(answer, jev.Answer)
        override = jev.record_override(
            answer.id, subject_id=uuid.uuid4(), qs_choice="column_layout", project_id=uuid.uuid4()
        )
    return {"tenant": a, "user": user.pk, "answer": answer, "override": override}


INSERT_ANSWER = """insert into platform_jevanswer
  (id, tenant_id, cache_key, node, model_version, options, choice, confidence, probabilities, created_at)
  values (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s::jsonb, now())"""
INSERT_OVERRIDE = """insert into platform_jevoverride
  (id, tenant_id, answer_id, node, model_version, subject_id, jev_choice, qs_choice, user_id, at)
  values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())"""


def answer_row(tenant: uuid.UUID, **changes: Any) -> list[Any]:
    row: dict[str, Any] = {
        "id": uuid.uuid4(),
        "tenant_id": tenant,
        "cache_key": uuid.uuid4().hex * 2,
        "node": "sheet_type",
        "model_version": "jev-1.13.0",
        "options": json.dumps(["beam_layout", "floor_plan"]),
        "choice": "beam_layout",
        "confidence": Decimal("0.9"),
        "probabilities": json.dumps({"beam_layout": "0.95", "floor_plan": "0.05"}),
    }
    row.update(changes)
    return list(row.values())


def override_row(in_a: dict[str, Any], **changes: Any) -> list[Any]:
    answer: jev.Answer = in_a["answer"]
    row: dict[str, Any] = {
        "id": uuid.uuid4(),
        "tenant_id": in_a["tenant"],
        "answer_id": answer.id,
        "node": answer.node,
        "model_version": answer.model,
        "subject_id": uuid.uuid4(),
        "jev_choice": answer.choice,
        "qs_choice": "floor_plan",
        "user_id": in_a["user"],
    }
    row.update(changes)
    return list(row.values())


# The policy and the grants ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_both_tables_pass_the_policy_coverage_test_with_no_allowlist_entry(cursor: Any) -> None:
    checked, problems = coverage_problems(cursor)

    assert set(TABLES) <= set(checked)
    assert [problem for problem in problems if "jev" in problem] == []
    allowlisted = {*GLOBAL_TABLES, *INDEX_EXCEPTIONS, *(table for table, _policy in WIDENINGS)}
    assert not any("jev" in entry for entry in allowlisted)


@pytest.mark.django_db
@pytest.mark.parametrize("table", TABLES)
def test_vextrus_app_may_only_read_and_add_to_both(cursor: Any, table: str) -> None:
    cursor.execute(
        "select privilege_type from information_schema.role_table_grants"
        " where grantee = 'vextrus_app' and table_name = %s",
        [table],
    )

    assert {privilege for (privilege,) in cursor.fetchall()} == {"SELECT", "INSERT"}


# Another tenant's rows -------------------------------------------------------------------------------


@pytest.mark.django_db
def test_b_reads_none_of_a_s_rows(
    cursor: Any, in_a: dict[str, Any], two: tuple[uuid.UUID, uuid.UUID]
) -> None:
    _a, b = two
    act(cursor, tenant=b)
    assert (count(cursor, "platform_jevanswer"), count(cursor, "platform_jevoverride")) == (0, 0)
    act(cursor, tenant=None)
    assert (count(cursor, "platform_jevanswer"), count(cursor, "platform_jevoverride")) == (0, 0)
    act(cursor, tenant=in_a["tenant"])
    assert (count(cursor, "platform_jevanswer"), count(cursor, "platform_jevoverride")) == (1, 1)

    with tenancy.acting_in(b):
        assert (JevAnswer.objects.count(), JevOverride.objects.count()) == (0, 0)
        assert not JevAnswer.objects.filter(id=in_a["answer"].id).exists()


@pytest.mark.django_db
def test_b_cannot_add_a_row_as_a(
    cursor: Any, in_a: dict[str, Any], two: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = two
    b_user, _membership = add_member(b)
    act(cursor, tenant=b, user=b_user.pk)

    assert RLS_REFUSED in refused(cursor, INSERT_ANSWER, answer_row(a))
    assert RLS_REFUSED in refused(cursor, INSERT_OVERRIDE, override_row(in_a))
    assert RLS_REFUSED in refused(cursor, INSERT_OVERRIDE, override_row(in_a, user_id=b_user.pk))
    with (
        tenancy.acting_in(b),
        pytest.raises(DatabaseError, match="row-level security"),
        transaction.atomic(),
    ):
        JevAnswer.objects.create(**dict(zip(ANSWER_FIELDS, answer_row(a), strict=True)))
    act(cursor, tenant=a)
    assert (count(cursor, "platform_jevanswer"), count(cursor, "platform_jevoverride")) == (1, 1)


ANSWER_FIELDS = (
    "id",
    "tenant_id",
    "cache_key",
    "node",
    "model_version",
    "options",
    "choice",
    "confidence",
    "probabilities",
)


@pytest.mark.django_db
def test_an_override_on_a_s_answer_fails_from_b_even_by_raw_sql(
    cursor: Any, in_a: dict[str, Any], two: tuple[uuid.UUID, uuid.UUID]
) -> None:
    _a, b = two
    b_user, _membership = add_member(b)
    act(cursor, tenant=b, user=b_user.pk)

    error = refused(cursor, INSERT_OVERRIDE, override_row(in_a, tenant_id=b, user_id=b_user.pk))

    assert 'violates foreign key constraint "platform_jevoverride_its_answer"' in error
    act(cursor, tenant=b)
    assert count(cursor, "platform_jevoverride") == 0


# Append-only ----------------------------------------------------------------------------------------

WRITES = [
    "update platform_jevanswer set choice = 'floor_plan'",
    "update platform_jevanswer set confidence = 0.1",
    "delete from platform_jevanswer",
    "update platform_jevoverride set qs_choice = 'floor_plan'",
    "update platform_jevoverride set user_id = user_id",
    "delete from platform_jevoverride",
]


@pytest.mark.django_db
@pytest.mark.parametrize("sql", WRITES)
def test_no_row_of_either_is_ever_changed_or_deleted_by_sql(
    cursor: Any, in_a: dict[str, Any], sql: str
) -> None:
    act(cursor, tenant=in_a["tenant"])

    assert NO_RIGHT in refused(cursor, sql)


@pytest.mark.django_db
def test_no_row_of_either_is_ever_changed_or_deleted_through_the_orm(in_a: dict[str, Any]) -> None:
    with tenancy.acting_in(in_a["tenant"]):
        free = jev.ask("sheet_type", INVENTED_SHEETS[1], STAND_IN_QUESTION, STAND_IN_KINDS)
        assert isinstance(free, jev.Answer)  # an answer no override protects
        answer = JevAnswer.objects.get(id=in_a["answer"].id)
        override = JevOverride.objects.get()
        attempts: list[Callable[[], object]] = [
            lambda: JevAnswer.objects.update(choice="floor_plan"),
            lambda: JevAnswer.objects.filter(id=free.id).delete(),
            lambda: JevAnswer.objects.filter(id=free.id)._raw_delete(JevAnswer.objects.db),
            lambda: JevOverride.objects.update(qs_choice="floor_plan"),
            lambda: JevOverride.objects.all().delete(),
            lambda: answer.save(),
            lambda: override.save(),
        ]
        for attempt in attempts:
            with pytest.raises(DatabaseError, match="permission denied"), transaction.atomic():
                attempt()
        # Django refuses this one itself, before any SQL: an override protects its answer.
        with pytest.raises(ProtectedError), transaction.atomic():
            JevAnswer.objects.filter(id=answer.id).delete()
        assert sorted(JevAnswer.objects.values_list("choice", flat=True)) == [
            "beam_layout",
            "floor_plan",
        ]
        assert JevOverride.objects.get().qs_choice == "column_layout"


@pytest.mark.django_db
def test_no_answer_is_upserted_by_sql_or_the_orm(cursor: Any, in_a: dict[str, Any]) -> None:
    answer: jev.Answer = in_a["answer"]
    with tenancy.acting_in(in_a["tenant"]):
        cache_key = JevAnswer.objects.get().cache_key
    act(cursor, tenant=in_a["tenant"])
    upsert = INSERT_ANSWER + " on conflict (tenant_id, cache_key) do update set choice = excluded.choice"

    assert NO_RIGHT in refused(
        cursor, upsert, answer_row(in_a["tenant"], cache_key=cache_key, choice="floor_plan")
    )
    with tenancy.acting_in(in_a["tenant"]):
        clash = JevAnswer(
            **dict(zip(ANSWER_FIELDS, answer_row(in_a["tenant"], cache_key=cache_key), strict=True))
        )
        clash.options, clash.probabilities = (
            ["beam_layout", "floor_plan"],
            {"beam_layout": "0.1", "floor_plan": "0.9"},
        )
        with pytest.raises(DatabaseError, match="permission denied"), transaction.atomic():
            JevAnswer.objects.bulk_create(
                [clash],
                update_conflicts=True,
                unique_fields=["tenant_id", "cache_key"],
                update_fields=["choice"],
            )
        assert JevAnswer.objects.get().choice == answer.choice


@pytest.mark.django_db
def test_no_override_is_upserted(cursor: Any, in_a: dict[str, Any]) -> None:
    act(cursor, tenant=in_a["tenant"])
    upsert = INSERT_OVERRIDE + " on conflict (id) do update set qs_choice = excluded.qs_choice"

    assert NO_RIGHT in refused(cursor, upsert, override_row(in_a, id=in_a["override"]))


# What a row may hold ----------------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("changes", "constraint"),
    [
        ({"choice": "slab_layout"}, "platform_jevanswer_offered"),
        ({"options": json.dumps(["beam_layout"])}, "platform_jevanswer_offered"),
        ({"options": json.dumps({"beam_layout": 1, "floor_plan": 0})}, "platform_jevanswer_offered"),
        (
            {"options": json.dumps([f"k{n}" for n in range(256)] + ["beam_layout"])},
            "platform_jevanswer_offered",
        ),
        ({"probabilities": json.dumps(["0.95", "0.05"])}, "platform_jevanswer_offered"),
        ({"probabilities": json.dumps({"floor_plan": "1"})}, "platform_jevanswer_offered"),
        ({"confidence": Decimal("1.0001")}, "platform_jevanswer_confidence"),
        ({"confidence": Decimal("-0.0001")}, "platform_jevanswer_confidence"),
        ({"cache_key": "ABC"}, "platform_jevanswer_key_shape"),
        ({"cache_key": "g" * 64}, "platform_jevanswer_key_shape"),
        ({"node": "Sheet type"}, "platform_jevanswer_keys"),
        (
            {"choice": "Beam_layout", "options": json.dumps(["Beam_layout", "x"])},
            "platform_jevanswer_keys",
        ),
        ({"model_version": "Jev latest"}, "platform_jevanswer_model_shape"),
    ],
)
def test_an_answer_holds_one_of_its_options_a_confidence_from_0_to_1_and_a_key_s_shape(
    cursor: Any, two: tuple[uuid.UUID, uuid.UUID], changes: dict[str, Any], constraint: str
) -> None:
    a, _b = two
    act(cursor, tenant=a)

    assert constraint in refused(cursor, INSERT_ANSWER, answer_row(a, **changes))


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("changes", "error"),
    [
        ({"node": "storey"}, "platform_jevoverride_its_answer"),
        ({"model_version": "jev-1.14.0"}, "platform_jevoverride_its_answer"),
        ({"jev_choice": "floor_plan", "qs_choice": "section"}, "platform_jevoverride_its_answer"),
        ({"answer_id": uuid.uuid4()}, "platform_jevoverride"),
        ({"qs_choice": "beam_layout"}, "platform_jevoverride_qs_not_jev"),
        ({"qs_choice": "storey_plan"}, "must be one its answer offered"),
        ({"qs_choice": "Floor_plan"}, "platform_jevoverride_qs_not_jev"),
    ],
)
def test_an_override_is_its_answer_s_and_names_another_option_it_offered(
    cursor: Any, in_a: dict[str, Any], changes: dict[str, Any], error: str
) -> None:
    act(cursor, tenant=in_a["tenant"], user=in_a["user"])

    assert error in refused(cursor, INSERT_OVERRIDE, override_row(in_a, **changes))


@pytest.mark.django_db
def test_an_override_by_raw_sql_that_holds_every_rule_is_taken(
    cursor: Any, in_a: dict[str, Any]
) -> None:
    act(cursor, tenant=in_a["tenant"], user=in_a["user"])

    cursor.execute(INSERT_OVERRIDE, override_row(in_a))

    assert count(cursor, "platform_jevoverride") == 2
