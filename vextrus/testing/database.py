"""The test database: made by the owner, migrated through the owner alias, kept between runs.

Its name is the worktree's database and a hash of every migration and of the checkout
(`vextrus.settings.db`), so an unchanged schema is reused, a changed one gets a fresh database and two
checkouts never share one. Under pytest-xdist each worker gets its own, `<name>_test_<hash>_gw<N>`:
pytest-django's `django_db_modify_db_settings` appends the suffix to `TEST.NAME` before it is read.
Both aliases point at it; the tests connect as `vextrus_app` through `default`, and every flush runs
as the owner (`vextrus.platform.database`). Each session starts with an empty job queue
(`empty_job_queue`). Old test databases are left in place; drop them by name when wanted.
"""

import pytest
from django.conf import settings
from django.core.management import call_command
from django.db import connections
from pytest_django.plugin import DjangoDbBlocker

from vextrus.platform.database import empty_job_queue, ensure_database


@pytest.fixture(scope="session")
def django_db_setup(django_db_modify_db_settings: None, django_db_blocker: DjangoDbBlocker) -> None:
    name = settings.DATABASES["default"]["TEST"]["NAME"]
    with django_db_blocker.unblock():
        for alias in settings.DATABASES:
            connections[alias].close()
            settings.DATABASES[alias]["NAME"] = name
            connections[alias].settings_dict["NAME"] = name
        ensure_database(name)
        call_command("migrate", verbosity=0, interactive=False)
        # The database outlives a run: a job an interrupted run committed (or one from before flush
        # emptied the queue) would reach this session's first test (t21a counts the `cad` queue).
        empty_job_queue()
