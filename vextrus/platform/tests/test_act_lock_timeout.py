"""An act's lock wait is bounded (S15-A2, `deadlocks.retried`): past `LOCK_TIMEOUT_MS` the act is
rolled back and refused, `platform.acts.busy` (503), and the request's transaction stays usable."""

from collections.abc import Iterator

import pytest
from django.db import DataError, connection, connections, transaction

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.messages import acts as said
from vextrus.platform.services import auth, deadlocks

pytestmark = pytest.mark.django_db(databases=["default", OWNER_ALIAS])

KEY = 7_315_002
"""An advisory lock no code takes: the stand-in for a row another transaction holds."""


@pytest.fixture
def held() -> Iterator[None]:
    """The lock, held by another connection until the test ends."""
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute("select pg_advisory_lock(%s)", [KEY])
    try:
        yield
    finally:
        with connections[OWNER_ALIAS].cursor() as cursor:
            cursor.execute("select pg_advisory_unlock(%s)", [KEY])


def lock_timeout() -> str:
    with connection.cursor() as cursor:
        cursor.execute("select current_setting('lock_timeout')")
        return str(cursor.fetchone()[0])


def take_the_lock() -> str:
    with connection.cursor() as cursor:
        cursor.execute("select pg_advisory_xact_lock(%s)", [KEY])
    return "done"


def test_an_act_waits_on_a_lock_at_most_the_timeout_then_is_refused_busy(
    held: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(deadlocks, "LOCK_TIMEOUT_MS", 100)
    before = lock_timeout()

    with transaction.atomic():  # the request's transaction
        with pytest.raises(auth.Refused) as refused:
            deadlocks.retried(take_the_lock, what="step1.confirm")
        after = lock_timeout()  # the transaction is still usable

    assert refused.value.status == 503
    assert refused.value.message == said.BUSY()
    assert after == before, "the refused act's lock_timeout rolled back with it"


def test_an_act_runs_with_the_timeout_set_and_keeps_its_work(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(deadlocks, "LOCK_TIMEOUT_MS", 1234)

    with transaction.atomic():
        seen = deadlocks.retried(lock_timeout, what="step1.confirm")
        assert deadlocks.retried(take_the_lock, what="step1.confirm") == "done"

    assert seen == "1234ms"


def test_another_database_error_is_raised_as_it_is() -> None:
    def broken() -> None:
        with connection.cursor() as cursor:
            cursor.execute("select 1 / 0")

    with transaction.atomic(), pytest.raises(DataError, match="division by zero"):
        deadlocks.retried(broken, what="step1.confirm")
