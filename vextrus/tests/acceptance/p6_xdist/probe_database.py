"""Run only by `test_database_names.py` in an inner pytest session (no `test_` prefix: never collected
by name). Its one test appends the worker and the database each alias names, as one tab-separated line,
to the file `XDIST_PROBE_OUT` names."""

import os
from pathlib import Path

import pytest
from django.db import connection, connections


@pytest.mark.django_db
def test_report_the_database() -> None:
    worker = os.environ.get("PYTEST_XDIST_WORKER", "serial")
    names = (connection.settings_dict["NAME"], connections["owner"].settings_dict["NAME"])
    with Path(os.environ["XDIST_PROBE_OUT"]).open("a") as out:
        out.write("\t".join((worker, *names)) + "\n")
