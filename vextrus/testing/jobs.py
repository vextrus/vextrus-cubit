"""Fixtures for jobs (ticket 09): a real StepStore, sample jobs, running a job inline, and a worker
in its own process.

- `TableStepStore`: a StepStore over tables in the test-only schema `vextrus_testing` (made by the
  owner once per test database, outside `public`, so the policy-coverage test does not see them),
  under row-level security like a tenant table. Its rows roll back with their step, and a worker in
  another process sees them once committed. `step_store` gives one; 14's ReadStep replaces it.
- `run_inline(job, tenant_id=…, **ids)`: run a job's function in this process and transaction,
  its arguments checked as the worker checks them (no Procrastinate, no worker).
- `start_worker(queues, …)`: `jobs.run_worker` in a child process, on the test database, as
  `vextrus_app` (or as another role, to be refused), with settings overridden.
- The sample jobs, `two_steps` (the test queue) and `cad_steps` (the `cad` queue), run steps whose
  behaviour a test scripts per subject and step (`script(...)`): `ok`, `fail`, `cancel_self` (the
  step cancels its own job from another connection, then returns), `cancel_inline`,
  `wait_for_cancel`, `hang`, `fork`, `leak` (a session-level tenant setting), `read_owner`,
  `on_commit`, `supersede` (the owner tries the job again meanwhile), `vanish` (its row is gone),
  `sleep:<seconds>` (a long step), `retry_self` (the app tries to retry and end its running job).
"""

import asyncio
import json
import os
import resource
import subprocess
import sys
import time
import uuid
from collections.abc import Callable, Iterator, Sequence
from typing import Any
from urllib.parse import quote

import psycopg
import pytest
from django.conf import settings
from django.db import connections, transaction
from procrastinate.contrib.django import app
from procrastinate.contrib.django.utils import connector_params
from procrastinate.job_context import AbortReason
from pytest_django.plugin import DjangoDbBlocker

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import Developer
from vextrus.platform.services import jobs

TEST_QUEUE = "vextrus_test"
SCHEMA = "vextrus_testing"
_OWN_TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid"
_TABLES = {
    "steps": """subject_id uuid not null, step text not null, input_hash text not null,
                result jsonb not null, primary key (tenant_id, subject_id, step, input_hash)""",
    "progress": "seq bigserial primary key, subject_id uuid not null, done int not null,"
    " total int not null, step text",
    "script": "subject_id uuid not null, step text not null, action text not null,"
    " primary key (tenant_id, subject_id, step)",
    "runs": "seq bigserial primary key, subject_id uuid not null, step text not null",
}


def make_tables(cursor: Any) -> None:
    """The test schema's tables, as the owner, idempotently (the test database is reused)."""
    cursor.execute(f"create schema if not exists {SCHEMA}")
    cursor.execute(f"grant usage on schema {SCHEMA} to {settings.VEXTRUS_APP_ROLE}")
    for table, columns in _TABLES.items():
        cursor.execute(
            f"create table if not exists {SCHEMA}.{table} (tenant_id uuid not null, {columns})"
        )
        cursor.execute(f"alter table {SCHEMA}.{table} enable row level security")
        cursor.execute(f"drop policy if exists own_tenant on {SCHEMA}.{table}")
        cursor.execute(f"create policy own_tenant on {SCHEMA}.{table} using ({_OWN_TENANT})")
    cursor.execute(
        f"grant select, insert, update, delete on all tables in schema {SCHEMA}"
        f" to {settings.VEXTRUS_APP_ROLE}"
    )
    cursor.execute(f"grant usage on all sequences in schema {SCHEMA} to {settings.VEXTRUS_APP_ROLE}")


@pytest.fixture(scope="session")
def job_tables(django_db_setup: None, django_db_blocker: DjangoDbBlocker) -> None:
    with django_db_blocker.unblock(), connections[OWNER_ALIAS].cursor() as cursor:
        make_tables(cursor)


def _tenant_sql(sql: str, params: Sequence[Any] = ()) -> list[tuple[Any, ...]]:
    with connections["default"].cursor() as cursor:
        cursor.execute(sql, list(params))
        return list(cursor.fetchall()) if cursor.description else []


class TableStepStore:
    """A StepStore over `vextrus_testing.steps` and `.progress`, in the acting tenant."""

    def completed(self, key: jobs.StepKey) -> jobs.StepResult | None:
        rows = _tenant_sql(
            f"select result from {SCHEMA}.steps where subject_id = %s and step = %s and input_hash = %s",
            [key.subject_id, key.step, key.input_hash],
        )
        if not rows:
            return None
        result = rows[0][0]
        return json.loads(result) if isinstance(result, str) else result  # type: ignore[no-any-return]

    def record(self, key: jobs.StepKey, result: jobs.StepResult) -> None:
        _tenant_sql(
            f"insert into {SCHEMA}.steps (tenant_id, subject_id, step, input_hash, result)"
            f" values (nullif(current_setting('app.tenant_id', true), '')::uuid, %s, %s, %s, %s)",
            [key.subject_id, key.step, key.input_hash, json.dumps(result)],
        )

    def progress(self, subject_id: uuid.UUID, progress: jobs.Progress) -> None:
        _tenant_sql(
            f"insert into {SCHEMA}.progress (tenant_id, subject_id, done, total, step)"
            f" values (nullif(current_setting('app.tenant_id', true), '')::uuid, %s, %s, %s, %s)",
            [subject_id, progress.done, progress.total, progress.step],
        )


@pytest.fixture
def step_store(job_tables: None) -> TableStepStore:
    return TableStepStore()


# Reading the test tables as the owner (they are under row-level security for the app) -------------


def _owner_rows(sql: str, params: Sequence[Any]) -> list[tuple[Any, ...]]:
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(sql, list(params))
        return list(cursor.fetchall())


def recorded_steps(subject_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    """The steps committed for a subject: {step: result}."""
    rows = _owner_rows(f"select step, result from {SCHEMA}.steps where subject_id = %s", [subject_id])
    return {step: json.loads(result) if isinstance(result, str) else result for step, result in rows}


def progress_log(subject_id: uuid.UUID) -> list[jobs.Progress]:
    rows = _owner_rows(
        f"select done, total, step from {SCHEMA}.progress where subject_id = %s order by seq",
        [subject_id],
    )
    return [jobs.Progress(*row) for row in rows]


def committed_runs(subject_id: uuid.UUID) -> list[str]:
    """Each committed execution of a step's function, in order (a skipped step adds none)."""
    rows = _owner_rows(
        f"select step from {SCHEMA}.runs where subject_id = %s order by seq", [subject_id]
    )
    return [step for (step,) in rows]


def script(tenant_id: uuid.UUID, subject_id: uuid.UUID, **actions: str) -> None:
    """What each step of the subject does (`ok` if unscripted), written by the owner, committed."""
    with connections[OWNER_ALIAS].cursor() as cursor:
        for step, action in actions.items():
            cursor.execute(
                f"insert into {SCHEMA}.script (tenant_id, subject_id, step, action)"
                " values (%s, %s, %s, %s) on conflict (tenant_id, subject_id, step)"
                " do update set action = excluded.action",
                [tenant_id, subject_id, step, action],
            )


# The sample jobs ----------------------------------------------------------------------------------

INLINE_CANCELS: set[uuid.UUID] = set()
"""Subjects whose inline run a step has cancelled (`cancel_inline`)."""


def _step(run: jobs.Run, subject_id: uuid.UUID, name: str) -> Callable[[], jobs.StepResult]:
    def body() -> jobs.StepResult:
        [(action,)] = _tenant_sql(
            f"select coalesce((select action from {SCHEMA}.script where subject_id = %s"
            " and step = %s), 'ok')",
            [subject_id, name],
        ) or [("ok",)]
        _tenant_sql(
            f"insert into {SCHEMA}.runs (tenant_id, subject_id, step)"
            " values (nullif(current_setting('app.tenant_id', true), '')::uuid, %s, %s)",
            [subject_id, name],
        )
        [(tenant, user, library, role)] = _tenant_sql(
            "select current_setting('app.tenant_id', true), current_setting('app.user_id', true),"
            " current_setting('app.library_id', true), current_user"
        )
        result: jobs.StepResult = {
            "step": name,
            "n": 1,
            "tenant_id": tenant,
            "user_id": user,
            "library_id": library,
            "role": role,
            "developers": _tenant_sql("select count(*) from platform_developer")[0][0],
        }
        _act(action, run, subject_id, result)
        return result

    return body


def _act(action: str, run: jobs.Run, subject_id: uuid.UUID, result: jobs.StepResult) -> None:
    if action == "fail":
        raise RuntimeError("the step failed, as scripted")
    if action == "cancel_self":
        with psycopg.connect(**connector_params("default"), autocommit=True) as other:
            other.execute("select procrastinate_cancel_job_v1(%s, true, false)", [run.job_id])
    elif action == "cancel_inline":
        INLINE_CANCELS.add(subject_id)
    elif action.startswith("sleep:"):
        time.sleep(float(action.split(":", 1)[1]))  # a long step that never checks for a stop
    elif action == "retry_self":
        # As the retrier and the worker would, from another connection of the app: send this
        # running job back to wait, and end it. The job wall refuses both while this try lives.
        for name, sql in (
            ("retry_refused", "select procrastinate_retry_job_v2(%s, now(), null, null, null)"),
            ("end_refused", "select procrastinate_finish_job_v1(%s, 'aborted', false)"),
        ):
            with psycopg.connect(**connector_params("default"), autocommit=True) as other:
                try:
                    other.execute(sql, [run.job_id])
                    result[name] = False
                except psycopg.errors.LockNotAvailable:
                    result[name] = True
    elif action in ("wait_for_cancel", "hang"):
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if action == "wait_for_cancel":
                run.check_cancelled()
            time.sleep(0.05)
        raise RuntimeError("the step waited a minute for a cancel that never came")
    elif action == "fork":
        child = os.fork()
        if child == 0:
            os._exit(0)
        _pid, status = os.waitpid(child, 0)
        result["forked_child_exit"] = os.waitstatus_to_exitcode(status)
    elif action == "leak":
        _tenant_sql("select set_config('app.tenant_id', %s, false)", [str(uuid.uuid4())])
    elif action == "on_commit":
        transaction.on_commit(lambda: _tenant_sql("select count(*) from platform_user"))
    elif action in ("supersede", "vanish"):
        # As the retrier, from its own connection: the job is tried again, or its row is gone.
        with psycopg.connect(**connector_params(OWNER_ALIAS), autocommit=True) as other:
            if action == "supersede":
                other.execute(
                    "update procrastinate_jobs set attempts = attempts + 1 where id = %s", [run.job_id]
                )
            else:
                other.execute("delete from procrastinate_jobs where id = %s", [run.job_id])
    elif action == "bomb":  # more than any cap: the step runs out of memory
        hoard = [bytearray(2**30) for _ in range(64)]
        result["hoarded"] = len(hoard)
    elif action == "read_owner":
        with connections[OWNER_ALIAS].cursor() as cursor:
            cursor.execute("select count(*) from platform_developer")
    soft, hard = resource.getrlimit(resource.RLIMIT_AS)
    result["rlimit_as"] = [soft, hard]
    result["threads"] = len(os.listdir("/proc/self/task"))
    result["blas_threads"] = _blas_threads()


@jobs.job(queue=TEST_QUEUE)
def two_steps(run: jobs.Run, *, subject_id: uuid.UUID) -> None:
    steps = run.steps(TableStepStore(), subject_id, total=2)
    first = steps.run("first", _step(run, subject_id, "first"), inputs={"subject": subject_id})
    steps.run("second", _step(run, subject_id, "second"), inputs={"first": first["n"]})


@jobs.job(queue=settings.VEXTRUS_CAD_QUEUE)
def cad_steps(run: jobs.Run, *, subject_id: uuid.UUID) -> None:
    steps = run.steps(TableStepStore(), subject_id, total=1)
    steps.run("measure", _step(run, subject_id, "measure"))


@jobs.job(queue=TEST_QUEUE)
def reads_outside_a_step(run: jobs.Run, *, subject_id: uuid.UUID) -> None:
    Developer.objects.count()


# Running a job ------------------------------------------------------------------------------------


def run_inline(
    job: jobs.Job,
    *,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    abort_reason: Callable[[], AbortReason | None] = lambda: None,
    job_id: int | None = None,
    attempts: int | None = None,
    **ids: uuid.UUID,
) -> None:
    """Run `job` here, in the caller's transaction, its arguments checked as the worker checks."""
    raw = {"tenant_id": str(tenant_id), **{k: str(v) for k, v in ids.items()}}
    if user_id is not None:
        raw["user_id"] = str(user_id)
    arguments = job.parse(raw)
    run = jobs.Run(
        job_id=job_id,
        tenant_id=arguments.tenant_id,
        user_id=arguments.user_id,
        abort_reason=abort_reason,
        attempts=attempts,
    )
    job.call(run, arguments.ids)


def database_url(alias: str) -> str:
    """A URL for the test database through `alias`'s role (for a child process; never printed)."""
    db = settings.DATABASES[alias]
    password = f":{quote(db['PASSWORD'], safe='')}" if db["PASSWORD"] else ""
    return f"postgresql://{quote(db['USER'], safe='')}{password}@{db['HOST']}:{db['PORT']}/{db['NAME']}"


_WORKER = """
import json, sys
import django
django.setup()
from django.conf import settings
for name, value in json.loads(sys.argv[1]).items():
    setattr(settings, name, value)
import vextrus.testing.jobs
from vextrus.platform.services import jobs
jobs.run_worker(json.loads(sys.argv[2]), wait=sys.argv[3] == "wait")
"""


def start_worker(
    queues: Sequence[str],
    *,
    wait: bool = False,
    role_alias: str = "default",
    overrides: dict[str, object] | None = None,
) -> subprocess.Popen[str]:
    """`jobs.run_worker(queues)` in a child process on the test database, as `role_alias`'s role."""
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "vextrus.settings.test",
        "DATABASE_URL": database_url(role_alias),
        "DATABASE_OWNER_URL": database_url(OWNER_ALIAS),
    }
    return subprocess.Popen(
        [
            sys.executable,
            "-c",
            _WORKER,
            json.dumps(overrides or {}),
            json.dumps(list(queues)),
            "wait" if wait else "no-wait",
        ],
        cwd=settings.BASE_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def finish(worker: subprocess.Popen[str], timeout: float = 60) -> str:
    """Wait for a worker started without `wait` and return its output."""
    output, _ = worker.communicate(timeout=timeout)
    return output


def retry_stalled_now() -> list[int]:
    """One round of the stalled-job retrier, here, through the worker connector."""

    async def one_round() -> list[int]:
        async with app.open_async():
            return await jobs.retry_stalled(app.job_manager)

    with app.replace_connector(app.connector.get_worker_connector()):  # type: ignore[attr-defined]
        return asyncio.run(one_round())


def job_row(job_id: int) -> dict[str, Any]:
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(
            "select status::text, attempts, abort_requested, args, queue_name, lock"
            " from procrastinate_jobs where id = %s",
            [job_id],
        )
        row = cursor.fetchone()
    assert row is not None, f"no job {job_id}"
    names = ("status", "attempts", "abort_requested", "args", "queue", "lock")
    return dict(zip(names, row, strict=True))


@pytest.fixture
def empty_test_queues(job_tables: None, django_db_blocker: DjangoDbBlocker) -> Iterator[None]:
    """No job waits in the sample jobs' queues (the test database outlives a run)."""

    def empty() -> None:
        with django_db_blocker.unblock(), connections[OWNER_ALIAS].cursor() as cursor:
            cursor.execute(
                "delete from procrastinate_jobs where queue_name = any(%s)",
                [[TEST_QUEUE, settings.VEXTRUS_CAD_QUEUE]],
            )

    empty()
    yield
    empty()


def _blas_threads() -> int | None:
    """How many threads numpy's OpenBLAS runs (it names its own getter by its build's suffix)."""
    import ctypes

    import numpy.linalg  # noqa: F401  (loads OpenBLAS)

    with open("/proc/self/maps", encoding="utf-8") as maps:
        paths = {line.split()[-1] for line in maps if "openblas" in line.lower()}
    for path in sorted(paths):
        library = ctypes.CDLL(path)
        for name in (
            "scipy_openblas_get_num_threads64_",
            "openblas_get_num_threads64_",
            "openblas_get_num_threads",
        ):
            if hasattr(library, name):
                return int(getattr(library, name)())
    return None
