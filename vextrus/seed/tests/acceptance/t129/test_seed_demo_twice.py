"""`seed_demo` run twice (#129; the orchestrator's ruling, session 06): "`seed_demo` refuses when the
demo's Developers already exist, with a message naming `flush` then `seed_demo`, and adds no rows;
`flush` then `seed_demo` still succeeds (#95's promise); a first run on an empty database still seeds
everything."

Rows are counted through the owner alias: row-level security hides other tenants' rows from
`vextrus_app`. The refusal is a `CommandError` (chosen by the acceptance writer: the way a Django
command refuses, printed without a traceback)."""

from collections import Counter
from collections.abc import Iterator

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connections
from django.db.models.signals import post_migrate

from vextrus.platform.database import OWNER_ALIAS
from vextrus.seed import platform as seed_platform
from vextrus.testing.tenancy import put_back_the_library

BOTH = ["default", "owner"]
DEMO_DEVELOPERS = {"Shapla Homes Ltd": 1, "Meghna Properties Ltd": 1, "Chameli Homes Ltd": 1}


def owner_rows(sql: str) -> list[tuple[object, ...]]:
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(sql)
        return list(cursor.fetchall())


def developers() -> Counter[str]:
    """Every Developer that is not a Library tenant, by name, however many there are."""
    return Counter(
        str(name) for (name,) in owner_rows("select name from platform_developer where not is_library")
    )


def every_table_count() -> dict[str, int]:
    """The number of rows in every table of the schema, as the owner sees them."""
    tables = [
        str(table)
        for (table,) in owner_rows(
            "select table_name from information_schema.tables"
            " where table_schema = current_schema() and table_type = 'BASE TABLE' order by 1"
        )
    ]
    counts: dict[str, int] = {}
    for table in tables:
        [(count,)] = owner_rows(f'select count(*) from "{table}"')
        assert isinstance(count, int)
        counts[table] = count
    return counts


@pytest.fixture
def demo_password(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, "a demo password for the tests")


@pytest.fixture
def without_the_tests_put_back() -> Iterator[None]:
    """The product as the owner runs it: the tests' own `post_migrate` put-back switched off."""
    post_migrate.disconnect(dispatch_uid="vextrus.testing.tenancy.put_back_the_library")
    try:
        yield
    finally:
        post_migrate.connect(
            put_back_the_library, dispatch_uid="vextrus.testing.tenancy.put_back_the_library"
        )


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_first_seed_demo_on_an_empty_database_seeds_every_developer_once(demo_password: None) -> None:
    assert developers() == Counter()

    call_command("seed_demo", verbosity=0)

    assert developers() == DEMO_DEVELOPERS
    [(sheets,)] = owner_rows("select count(*) from drawings_sheetrevision")
    assert isinstance(sheets, int)
    assert sheets > 0


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_second_seed_demo_refuses_naming_flush_then_seed_demo(demo_password: None) -> None:
    call_command("seed_demo", verbosity=0)

    with pytest.raises(CommandError) as refused:
        call_command("seed_demo", verbosity=0)

    said = str(refused.value)
    assert "flush" in said, said
    assert "seed_demo" in said, said
    assert said.index("flush") < said.rindex("seed_demo"), f"flush is not named before seed_demo: {said}"


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_refused_second_seed_demo_adds_no_rows(demo_password: None) -> None:
    call_command("seed_demo", verbosity=0)
    before = every_table_count()

    with pytest.raises(CommandError):
        call_command("seed_demo", verbosity=0)

    after = every_table_count()
    assert {t: (before[t], after[t]) for t in before if before[t] != after[t]} == {}
    assert developers() == DEMO_DEVELOPERS


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_flush_then_seed_demo_after_a_seed_still_succeeds(
    demo_password: None, without_the_tests_put_back: None
) -> None:
    call_command("seed_demo", verbosity=0)

    call_command("flush", interactive=False, verbosity=0)
    call_command("seed_demo", verbosity=0)

    assert developers() == DEMO_DEVELOPERS
