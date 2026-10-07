"""S16-L's security wall: a second tenant reads none of the Live Model's new tables, and the app role
can neither rewrite nor delete a ModelVersion (M1.md C7: "each with its policy"; docs/data-model.md §2,
append-only; the M0 pattern of `vextrus/live_model/tests/test_tenancy_sql.py`)."""

import uuid
from collections.abc import Callable

import pytest
from django.db import connections

from vextrus.live_model.tests.acceptance.ts16l.model import building_of, column, live
from vextrus.live_model.tests.attacks import DENIED, act, ids, refused
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

NEW_TABLES = (
    "live_model_disciplinepart",
    "live_model_modelversion",
    "live_model_elementstate",
    "live_model_elementtrace",
    "live_model_viewplacement",
    "live_model_viewplacementstorey",
)
WRITTEN_BY_APPLY = ("live_model_modelversion", "live_model_elementstate", "live_model_elementtrace")


@pytest.mark.django_db
@pytest.mark.parametrize("table", NEW_TABLES)
def test_every_new_table_has_row_level_security_and_a_policy(table: str) -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute("select relrowsecurity from pg_class where relname = %s", [table])
        row = cursor.fetchone()
        assert row is not None, f"no table {table}"
        assert row == (True,)
        cursor.execute("select count(*) from pg_policies where tablename = %s", [table])
        assert cursor.fetchone()[0] >= 1


@pytest.mark.django_db
@pytest.mark.parametrize("table", WRITTEN_BY_APPLY)
def test_a_second_tenant_reads_none_of_the_applied_rows(
    table: str, qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        live.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        with connections["default"].cursor() as cursor:
            mine = ids(cursor, table)
    assert mine, "tenant A's own rows are seen"
    other = sign_in(role="qs")
    with other.acting(), connections["default"].cursor() as cursor:
        assert ids(cursor, table) == set()
    with connections["default"].cursor() as cursor:
        act(cursor, tenant=None)
        assert ids(cursor, table) == set()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "statement",
    [
        "update live_model_modelversion set figures_changed = not figures_changed",
        "update live_model_modelversion set seq = seq + 100",
        "delete from live_model_modelversion",
    ],
)
def test_the_app_role_cannot_rewrite_or_delete_a_model_version(
    statement: str, qs_project: QsProject
) -> None:
    building = building_of(qs_project)
    with qs_project.member.acting():
        live.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        with connections["default"].cursor() as cursor:
            assert DENIED in refused(lambda: cursor.execute(statement))
