"""The test database starts each session with an empty job queue (T-XDIST, fix round 1): the database
outlives a run, so a job an interrupted run committed would otherwise reach the next session's first
test, as t21a's `cad` counts did under `-n 8`."""

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from django.conf import settings

REPO = Path(__file__).resolve().parents[2]
PROBE = Path(__file__).with_name("probe_job_queue.py")
PROBE_DB = "p6xdist_queue_probe"


def inner_environ(out: Path) -> dict[str, str]:
    """This run's environment, never a worker's, on its own fixed database name."""
    environ = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PYTEST_XDIST_") and key != "PYTEST_ADDOPTS"
    }
    for variable in ("DATABASE_URL", "DATABASE_OWNER_URL"):
        if variable in environ:
            environ[variable] = urlunsplit(urlsplit(environ[variable])._replace(path=""))
    environ["VEXTRUS_DB_NAME"] = PROBE_DB
    environ["JOB_QUEUE_PROBE_OUT"] = str(out)
    return environ


def session(out: Path) -> tuple[str, int]:
    done = subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "no:cacheprovider", "-rf", str(PROBE)],
        cwd=REPO,
        env=inner_environ(out),
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stdout[-4000:] + done.stderr[-4000:]
    name, count = out.read_text().strip().split("\t")
    return name, int(count)


def owner_connection(dbname: str) -> psycopg.Connection:
    owner = settings.DATABASES["owner"]
    params = {"host": owner["HOST"], "port": owner["PORT"], "user": owner["USER"], "dbname": dbname}
    if owner["PASSWORD"]:
        params["password"] = owner["PASSWORD"]
    return psycopg.connect(**params, autocommit=True)


def test_a_job_left_committed_by_an_earlier_run_is_gone_when_the_next_session_starts(
    tmp_path: Path,
) -> None:
    name, _ = session(tmp_path / "first.txt")  # makes and migrates the probe's test database
    assert name.startswith(f"{PROBE_DB}_test_"), name
    with owner_connection(name) as connection:
        connection.execute(
            "insert into procrastinate_jobs (queue_name, task_name, args)"
            " values (%s, 'vextrus.probe', '{}'::jsonb)",
            [settings.VEXTRUS_CAD_QUEUE],
        )

    again, count = session(tmp_path / "second.txt")

    assert again == name
    assert count == 0, f"{count} job(s) left in {name} reached the session's first test"
