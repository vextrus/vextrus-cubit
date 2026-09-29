"""The seed's tests leave no read job behind: the seed defers 21a's read job on the `cad` queue (MG-01's
interrupted read), and a test run with `transaction=True` commits it to the test database, which
outlives a run; other tests count the `cad` queue's jobs (t21a's upload tests)."""

from collections.abc import Iterator

import pytest
from django.conf import settings
from django.db import connections
from pytest_django.plugin import DjangoDbBlocker

from vextrus.platform.database import OWNER_ALIAS


@pytest.fixture(autouse=True)
def no_seeded_job_left(django_db_blocker: DjangoDbBlocker) -> Iterator[None]:
    yield
    with django_db_blocker.unblock(), connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(
            "delete from procrastinate_jobs where queue_name = %s", [settings.VEXTRUS_CAD_QUEUE]
        )
