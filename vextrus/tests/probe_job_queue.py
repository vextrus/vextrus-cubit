"""Run by `test_testing_database.py` in an inner pytest session (no `test_` prefix: never collected by
name). Its one test reports how many jobs the queue holds when the session's first test starts."""

import os
from pathlib import Path

import pytest
from django.db import connections


@pytest.mark.django_db(databases=["default", "owner"])
def test_report_the_queue() -> None:
    with connections["owner"].cursor() as cursor:
        cursor.execute("select current_database(), count(*) from procrastinate_jobs")
        name, count = cursor.fetchone() or ("", -1)
    Path(os.environ["JOB_QUEUE_PROBE_OUT"]).write_text(f"{name}\t{count}\n")
