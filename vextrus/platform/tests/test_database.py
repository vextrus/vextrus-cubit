"""The two roles in use: the app connects as vextrus_app; migrations and flushes run as the owner."""

import psycopg
import pytest
from django.conf import settings
from django.core.management import call_command
from django.db import IntegrityError, ProgrammingError, connections

from vextrus.platform.database import ensure_database
from vextrus.platform.models import User


def current_user(alias: str) -> str:
    with connections[alias].cursor() as cursor:
        cursor.execute("select current_user")
        row = cursor.fetchone()
    assert row is not None
    return str(row[0])


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_app_connects_as_vextrus_app_and_the_owner_as_vextrus() -> None:
    assert current_user("default") == "vextrus_app"
    assert current_user("owner") == "vextrus"


@pytest.mark.django_db
def test_the_migrations_ran_as_the_owner_so_the_app_owns_no_table() -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute(
            "select tableowner, count(*) from pg_tables where schemaname = 'public' group by 1"
        )
        owners = dict(cursor.fetchall())

    assert set(owners) == {"vextrus"}
    assert owners["vextrus"] > 0


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_a_flush_asked_of_the_app_runs_as_the_owner() -> None:
    User.objects.db_manager("owner").create_user("flushed@example.com", "Flushed")

    call_command("flush", database="default", interactive=False, verbosity=0)

    # Only the tests' own staff users, put back by the owner after every flush, remain.
    assert not User.objects.using("owner").filter(email="flushed@example.com").exists()


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_the_app_itself_cannot_truncate() -> None:
    with (
        pytest.raises(ProgrammingError, match="permission denied"),
        connections["default"].cursor() as cursor,
    ):
        cursor.execute("truncate platform_user")


@pytest.mark.django_db(databases=["owner"])
def test_one_email_whatever_its_case_is_one_user() -> None:
    users = User.objects.db_manager("owner")
    made = users.create_user("Rahim@Example.com", "Rahim")

    assert users.get_by_natural_key("rahim@example.COM") == made
    with pytest.raises(IntegrityError):
        users.create_user("RAHIM@example.com", "Another Rahim")


@pytest.mark.django_db(databases=["owner"])
def test_only_vextrus_staff_may_use_the_admin() -> None:
    users = User.objects.db_manager("owner")
    staff = users.create_superuser("staff@example.com", "Staff", "a long password 1")
    member = users.create_user("qs@example.com", "QS", "a long password 2")

    assert (staff.is_staff, staff.has_perm("platform.view_user")) == (True, True)
    assert (member.is_staff, member.has_perm("platform.view_user")) == (False, False)


def test_ensure_database_creates_a_missing_database_once() -> None:
    name = settings.DATABASES["owner"]["TEST"]["NAME"] + "_probe"
    owner = settings.DATABASES["owner"]
    params = {"host": owner["HOST"], "port": owner["PORT"], "user": owner["USER"], "dbname": "postgres"}
    if owner["PASSWORD"]:
        params["password"] = owner["PASSWORD"]
    try:
        assert ensure_database(name) is True
        assert ensure_database(name) is False
    finally:
        with psycopg.connect(**params, autocommit=True) as connection:
            connection.execute(f'drop database if exists "{name}"')


@pytest.mark.django_db(databases=["default", "owner"])
def test_flush_empties_the_job_queue_too() -> None:
    """procrastinate's tables are not Django-managed, so Django's own flush left a job a transactional
    test committed for the next test on that database (T-XDIST: t19a's seed job failed t21a's counts)."""
    owner = connections["owner"]
    with owner.cursor() as cursor:
        cursor.execute(
            "insert into procrastinate_jobs (queue_name, task_name, args)"
            " values (%s, 'vextrus.probe', '{}'::jsonb)",
            [settings.VEXTRUS_CAD_QUEUE],
        )

    call_command("flush", interactive=False, verbosity=0)

    with owner.cursor() as cursor:
        cursor.execute("select count(*) from procrastinate_jobs")
        assert cursor.fetchone() == (0,)
