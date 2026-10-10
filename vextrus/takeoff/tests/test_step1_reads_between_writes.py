"""An act's reads answered once between its writes (`step1.reads_between_writes`, #638): S15-A2's
500 ms bound on an act. The memo is safe only if every statement that can change what a read sees
forgets it, and nothing outside an act is remembered."""

from collections.abc import Callable

import pytest
from django.db import connection, transaction

from vextrus.takeoff.services import step1

pytestmark = pytest.mark.django_db


def counted() -> tuple[Callable[[], int], list[int]]:
    calls: list[int] = []

    def read() -> int:
        calls.append(1)
        return len(calls)

    return read, calls


def run(sql: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(sql)


def test_outside_an_act_every_read_is_read() -> None:
    read, calls = counted()
    step1._remembered("k", read)
    step1._remembered("k", read)
    assert len(calls) == 2


def test_inside_an_act_a_read_is_read_once_until_a_write() -> None:
    read, calls = counted()
    with transaction.atomic(), step1.reads_between_writes():
        run("create temp table memo_probe (n int)")
        assert step1._remembered("k", read) == 1
        assert step1._remembered("k", read) == 1
        run("select 1")
        assert step1._remembered("k", read) == 1
        run("insert into memo_probe values (1)")
        assert step1._remembered("k", read) == 2
        run("  UPDATE memo_probe set n = 2")
        assert step1._remembered("k", read) == 3
        run("with gone as (delete from memo_probe returning n) select count(*) from gone")
        assert step1._remembered("k", read) == 4
    assert len(calls) == 4


def test_a_savepoint_made_or_released_keeps_the_reads_and_a_rollback_to_one_forgets_them() -> None:
    read, calls = counted()
    with transaction.atomic(), step1.reads_between_writes():
        step1._remembered("k", read)
        with transaction.atomic():  # SAVEPOINT ... RELEASE SAVEPOINT: no row changes
            step1._remembered("k", read)
        assert len(calls) == 1
        try:
            with transaction.atomic():
                raise RuntimeError("rolled back to the savepoint")
        except RuntimeError:
            pass
        step1._remembered("k", read)
    assert len(calls) == 2


def test_a_setting_changed_by_select_set_config_forgets_the_reads() -> None:
    """`set_config` moves the tenant row-level security reads by, though it is a SELECT."""
    read, calls = counted()
    with transaction.atomic(), step1.reads_between_writes():
        step1._remembered("k", read)
        run("select set_config('app.memo_probe', 'x', true)")
        step1._remembered("k", read)
    assert len(calls) == 2


def test_the_memo_ends_with_the_act_and_a_nested_block_shares_it() -> None:
    read, calls = counted()
    with transaction.atomic(), step1.reads_between_writes():
        step1._remembered("k", read)
        with step1.reads_between_writes():
            step1._remembered("k", read)
        assert len(calls) == 1
    step1._remembered("k", read)
    assert len(calls) == 2


def test_a_refused_read_is_never_remembered() -> None:
    tries: list[int] = []

    def refused() -> int:
        tries.append(1)
        raise LookupError("not in scope")

    with transaction.atomic(), step1.reads_between_writes():
        for _ in range(2):
            with pytest.raises(LookupError):
                step1._remembered("scope", refused)
    assert len(tries) == 2
