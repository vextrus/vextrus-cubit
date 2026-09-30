"""Jobs: Procrastinate, wrapped so a job acts in its tenant and nowhere else (ticket 09; ADR 0034;
docs/data-model.md §2, Events; the M0 plan, "Tenancy").

A job is a function declared with `@job`, given a `Run` and its ids:

    @jobs.job(queue=settings.VEXTRUS_CAD_QUEUE)
    def read_file(run: jobs.Run, *, file_id: uuid.UUID) -> None:
        steps = run.steps(drawings.services.step_store(), subject_id=file_id, total=2)
        read = steps.run("read", lambda: read_it(file_id), inputs=lambda: {"sha256": sha_of(file_id)})
        steps.run("check", lambda: check_it(read), inputs={"read": read["artefact_sha256"]})

- **Deferring** (`read_file.defer(file_id=…)`) happens inside the data's own transaction, acting in
  its tenant: the job is a row of that transaction, so a rollback takes it away and the worker never
  sees data that was not committed. Its arguments are the tenant's id, the acting user's id (when
  there is one) and the job's own ids: UUIDs, never data, a path or a model. The database holds the
  same line (the job wall, platform's migration 0006): the app defers a job only for the tenant it
  acts in and the user it acts as, never changes a job's task, queue, lock or arguments, never
  reopens an ended one, and while acting in a tenant touches only that tenant's jobs.
- **Running**: the worker checks the arguments again before anything else (a job refused for its
  arguments is never retried). The job's function runs with every database query refused, except
  inside a step: a step runs in its own transaction, `tenancy.acting_in(tenant_id, user_id=…)`, which
  sets `app.tenant_id`, `app.user_id` and `app.library_id` with `is_local = true` before the step
  reads anything; a step for a user with no current Membership there is refused (fail closed,
  whatever `acting_in` does). After each step the connection must carry none of the three (a step
  that set one for its session fails the job), a step may not leave `transaction.on_commit` work
  (it would run with no tenant), and the worker closes its connections after each job. The guard
  sees what passes through Django's cursor `execute`: a thread the job starts, or psycopg's
  `cursor.copy`, is not seen, so job code uses neither.
- **Steps** are kept by the caller through a `StepStore`, keyed by subject, step and a hash of the
  step's inputs: a step already recorded under the same key is skipped and its result returned, so a
  restart or a retry resumes where the last try stopped. Each step returns a JSON object, recorded in
  the step's own transaction. **Progress** is written to the store in its own transaction when a
  step starts and when the last one ends.
- **Cancel** is Procrastinate's abort: `cancel(job_id)` stops a waiting job and asks a running one
  to stop. A running job stops at its next step, or inside a step at `run.check_cancelled()`; and a
  step never commits after a cancel: its transaction reads the job's row `FOR SHARE` just before
  committing, so a cancel either committed first (the step rolls back) or waits for the step's commit.
  The same read rolls the step back when its job has been tried again since or its row is gone.
- **One try at a time.** A running try holds its job (a session advisory lock on the job's id, on
  its own connection, let go when the try ends and by PostgreSQL when the worker dies). While it
  holds it, the job wall refuses to end the job or send it back to wait, and another try of it
  refuses to start (`TryStillRunning`, tried again later). So a retry never runs one job twice at
  once, and a superseded try never ends the job its successor runs; nor does the wall let anyone
  finish a job waiting to run. Job code still never catches a step's exception: a step that raised
  has rolled back, and the job must end or be tried again as the runner decides.
- **Restart** (`restart(job_id)`) defers a failed or cancelled job again with the same ids; its
  completed steps skip. A job that raised is tried again by itself up to `VEXTRUS_JOB_TRIES`. A job
  whose worker died, froze or was cut off mid-way is found by the stalled-job retrier, a periodic
  task on the default queue (`platform/tasks/jobs.py`): a live worker beats even while it stops, so
  one silent for `VEXTRUS_JOB_STALLED_SECONDS` is not live, and the retrier ends its session if it
  still holds the job, then tries the job again (within about two minutes of the silence).
- **Stopping a worker** (Ctrl-C or SIGTERM): after `VEXTRUS_WORKER_STOP_SECONDS` (0), a running job
  stops after its current step (`Stopped`) and is tried again at once, its completed steps skipped.
  A stop is not the job's failure: it never counts against `VEXTRUS_JOB_TRIES` and never ends a job.
  A person's cancel wins over a stop, even one made while the worker drains: the job ends
  cancelled, and only then does it read "cancelled".
- **The worker** (`run_worker`, which `manage.py worker` runs) refuses to start unless 02's startup
  check passes, then runs Procrastinate's worker inside the Django process through the worker
  connector (docs/research/stack-versions.md, problem 8b). The `cad` queue's worker runs alone on
  its queue at concurrency 1, under an address-space cap (`VEXTRUS_CAD_WORKER_MEMORY_BYTES`, set at
  its start and never raised again); it refuses Python's `fork` start method, and a child forked
  inside it exits at once, so no pool relies on fork. A `cad` job run by any other worker is refused.

`state`, `cancel` and `restart` act only on the acting tenant's jobs: another tenant's job id reads
as no job. They know nothing of Projects: the caller checks the subject's Project first.
"""

import asyncio
import contextlib
import hashlib
import inspect
import json
import logging
import multiprocessing
import os
import re
import resource
import sys
import uuid
from collections.abc import Callable, Iterator, Mapping, Sequence
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, Protocol

from django.conf import settings
from django.db import connections
from procrastinate import exceptions as procrastinate_errors
from procrastinate import jobs as procrastinate_jobs
from procrastinate.contrib.django import app
from procrastinate.contrib.django.django_connector import DjangoConnector
from procrastinate.job_context import AbortReason, JobContext
from procrastinate.manager import JobManager
from procrastinate.retry import BaseRetryStrategy, RetryDecision

from engine.messages import Message
from vextrus.platform import startup
from vextrus.platform.messages import jobs as words
from vextrus.platform.services import events, tenancy

logger = logging.getLogger(__name__)

type Json = bool | int | float | str | list[Json] | dict[str, Json] | None
type StepResult = dict[str, Json]
"""What a step returns and its store keeps: a JSON object (ids, hashes, counts; never a model)."""
type Inputs = Mapping[str, object] | Callable[[], Mapping[str, object]] | None
"""What a step's result depends on, hashed into its key: a mapping, or a function of the data read
inside the step's transaction. JSON values and UUIDs."""

JobId = int

_NAME = re.compile(r"[a-z][a-z0-9_]{0,63}")
_ID_ARGUMENT = re.compile(r"[a-z][a-z0-9_]*_id")
_FORKED_CHILD_EXIT = 70


# The caller's store --------------------------------------------------------------------------------


@dataclass(frozen=True)
class StepKey:
    subject_id: uuid.UUID
    step: str
    input_hash: str
    """sha256 of the step's inputs as canonical JSON (sorted keys, UUIDs as text)."""


@dataclass(frozen=True)
class Progress:
    done: int
    """Steps finished (run or skipped) before this report."""
    total: int
    step: str | None
    """The step starting now; None once the last has ended."""


class StepStore(Protocol):
    """Where a job's completed steps are kept: the caller's table (14's ReadStep), under row-level
    security. Every method is called inside a transaction acting in the job's tenant."""

    def completed(self, key: StepKey) -> StepResult | None:
        """The result recorded under `key`, or None if the step has not completed."""
        ...

    def record(self, key: StepKey, result: StepResult) -> None:
        """Keep a step's result; called in the step's own transaction, which may still roll back."""
        ...

    def progress(self, subject_id: uuid.UUID, progress: Progress) -> None:
        """Note how far the subject's steps have come; called in a transaction of its own."""
        ...


# Refusals -------------------------------------------------------------------------------------------


class JobRefused(Exception):
    """A job that must not run: arguments other than a tenant id and ids, an unknown tenant, a
    `cad` job outside the `cad` worker. Never tried again."""


class NotInTransaction(RuntimeError):
    """A job is deferred only inside its data's transaction, acting in its tenant."""


class OutsideStep(RuntimeError):
    """A job touched the database outside a step, or through an alias other than the app's."""


class TenancyLeaked(RuntimeError):
    """A step left a tenant setting on its connection beyond its transaction. Never tried again."""


class Cancelled(procrastinate_errors.JobAborted):
    """The job was cancelled: it stops, and its current step rolls back. It ends cancelled."""


class Stopped(procrastinate_errors.JobAborted):
    """The worker is stopping: the job stops after its current step and is tried again (never
    ended by a stop, so no job reads "cancelled" unless someone cancelled it)."""


class TryStillRunning(RuntimeError):
    """Another try of this job still holds it (its worker is alive): this try waits its turn."""


class NotRestartable(RuntimeError):
    """Only a failed or cancelled job is restarted."""


class WorkerRefused(RuntimeError):
    """A worker asked to run as it must not (its queues, its concurrency, its start method)."""


# Declaring and deferring a job ----------------------------------------------------------------------

_registered: dict[str, Job] = {}


def job(*, queue: str | None = None) -> Callable[[Callable[..., None]], Job]:
    """Declare a job: `fn(run, *, <name>_id: uuid.UUID, …)`, on `queue` (the default queue if none)."""

    def declare(fn: Callable[..., None]) -> Job:
        return Job(fn, queue=queue or settings.VEXTRUS_DEFAULT_QUEUE)

    return declare


class Job:
    """A declared job: `defer(**ids)` queues it; the worker runs it."""

    def __init__(self, fn: Callable[..., None], *, queue: str) -> None:
        self.fn = fn
        self.queue = queue
        self.name = f"{fn.__module__}.{fn.__qualname__}"
        self.ids = _declared_ids(fn)
        if self.name in _registered:
            raise ValueError(f"a job named {self.name} is already declared")
        _registered[self.name] = self
        self.task = app.task(name=self.name, queue=queue, pass_context=True, retry=_Retry())(
            self._run_in_worker
        )

    def __repr__(self) -> str:
        return f"<Job {self.name} on {self.queue}>"

    def defer(self, **ids: uuid.UUID) -> JobId:
        """Queue the job in the current transaction, acting in its tenant, for the acting user."""
        alias = settings.PROCRASTINATE_DATABASE_ALIAS
        if not connections[alias].in_atomic_block:
            raise NotInTransaction(f"{self.name} is deferred inside its data's transaction.atomic()")
        acting = tenancy.current()
        if acting.tenant_id is None or events.acting_tenant_id() != acting.tenant_id:
            raise NotInTransaction(f"{self.name} is deferred while acting in its tenant")
        if set(ids) != self.ids:
            raise JobRefused(f"{self.name} takes {sorted(self.ids)}, was given {sorted(ids)}")
        for name, value in ids.items():
            if type(value) is not uuid.UUID:
                raise JobRefused(f"{self.name}: {name} must be a UUID, not {type(value).__name__}")
        arguments = {"tenant_id": str(acting.tenant_id), **{k: str(v) for k, v in ids.items()}}
        if acting.user_id is not None:
            arguments["user_id"] = str(acting.user_id)
        # Always through Django's connection, so the job is a row of the data's transaction, even
        # inside a worker, whose Procrastinate app runs on a pool of its own.
        deferrer = self.task.configure(lock=self._lock(arguments))
        manager = JobManager(DjangoConnector(alias))
        deferred = manager.defer_job(deferrer.make_new_job(**arguments))
        assert deferred.id is not None
        return deferred.id

    def _lock(self, arguments: Mapping[str, str]) -> str:
        """Jobs of one task on the same ids run one at a time (a restart waits for the last try)."""
        ids = ",".join(f"{k}={arguments[k]}" for k in sorted(arguments) if k != "user_id")
        return f"{arguments['tenant_id']}:{self.name}:{ids}"  # the job wall: the tenant first

    def _run_in_worker(self, context: JobContext, /, **raw: object) -> None:
        """Procrastinate's entry: check the arguments, hold the job for this try, run, then let it
        go and close the connections (before Procrastinate records how the try ended)."""
        alias = settings.PROCRASTINATE_DATABASE_ALIAS
        held = False
        try:
            arguments = self.parse(raw)
            if self.queue == settings.VEXTRUS_CAD_QUEUE and not _cad_worker.ready:
                raise JobRefused(f"{self.name} runs only in the {self.queue} queue's own worker")
            assert context.job.id is not None
            held = _hold(alias, context.job.id)
            if not held:
                raise TryStillRunning(f"job {context.job.id} is still running in another try")
            run = Run(
                job_id=context.job.id,
                tenant_id=arguments.tenant_id,
                user_id=arguments.user_id,
                abort_reason=context.abort_reason,
                attempts=context.job.attempts,
            )
            self.call(run, arguments.ids)
        finally:
            if held:
                # Let go before the connection closes: a backend exits a moment after its client,
                # and Procrastinate may record the end of this try at once.
                with contextlib.suppress(Exception), connections[alias].cursor() as cursor:
                    cursor.execute("select pg_advisory_unlock(%s, %s)", _try_key(context.job.id or 0))
            for connection in connections.all(initialized_only=True):
                connection.close()

    def parse(self, raw: Mapping[str, object]) -> Arguments:
        """The job's arguments, or JobRefused: a tenant id, an optional user id and the job's ids,
        each a UUID in its canonical text, and nothing else."""
        required = {"tenant_id", *self.ids}
        if not required <= raw.keys() <= required | {"user_id"}:
            raise JobRefused(f"{self.name}: arguments {sorted(raw)}, expected {sorted(required)}")
        parsed = {name: _uuid(name, value) for name, value in raw.items()}
        tenant_id = parsed.pop("tenant_id")
        user_id = parsed.pop("user_id", None)
        return Arguments(tenant_id, user_id, parsed)

    def call(self, run: Run, ids: Mapping[str, uuid.UUID]) -> None:
        """Run the job's function with every query refused outside its steps."""
        with _only_in_steps():
            self.fn(run, **ids)


def _try_key(job_id: JobId) -> list[int]:
    """The advisory lock a running try holds on its job: the job's id as two int4 keys (the job
    wall's trigger computes the same)."""
    return [job_id >> 31, job_id & 0x7FFFFFFF]


def _hold(alias: str, job_id: JobId) -> bool:
    """Hold the job for this try, for the life of this connection (PostgreSQL lets go when the
    worker dies, so the retrier and the job wall can tell a live try from a dead one)."""
    with connections[alias].cursor() as cursor:
        cursor.execute("select pg_try_advisory_lock(%s, %s)", _try_key(job_id))
        row = cursor.fetchone()
    return bool(row and row[0])


@dataclass(frozen=True)
class Arguments:
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None
    ids: dict[str, uuid.UUID]


def _declared_ids(fn: Callable[..., None]) -> frozenset[str]:
    parameters = list(inspect.signature(fn).parameters.values())
    if not parameters or parameters[0].kind != inspect.Parameter.POSITIONAL_OR_KEYWORD:
        raise TypeError(f"{fn.__qualname__} takes the Run first")
    ids = []
    for parameter in parameters[1:]:
        if (
            parameter.kind != inspect.Parameter.KEYWORD_ONLY
            or parameter.default is not inspect.Parameter.empty
            or not _ID_ARGUMENT.fullmatch(parameter.name)
            or parameter.name in ("tenant_id", "user_id")
        ):
            raise TypeError(
                f"{fn.__qualname__}: after the Run, a job takes only keyword ids named *_id "
                f"(not tenant_id or user_id), with no default; {parameter.name!r} is not one"
            )
        ids.append(parameter.name)
    return frozenset(ids)


def _uuid(name: str, value: object) -> uuid.UUID:
    if not isinstance(value, str):
        raise JobRefused(f"{name} is not an id: {type(value).__name__}")
    try:
        parsed = uuid.UUID(value)
    except ValueError:
        raise JobRefused(f"{name} is not an id") from None
    if str(parsed) != value:
        raise JobRefused(f"{name} is not an id in its canonical form")
    return parsed


# Running: the Run, its steps, and the wall around them ----------------------------------------------

_in_step: ContextVar[bool] = ContextVar("vextrus_job_in_step", default=False)
_guarded: ContextVar[bool] = ContextVar("vextrus_job_guarded", default=False)


@contextlib.contextmanager
def _only_in_steps() -> Iterator[None]:
    """Refuse every query outside a step, and every query through an alias but the app's."""
    alias = settings.PROCRASTINATE_DATABASE_ALIAS

    def guard(name: str) -> Callable[..., Any]:
        def check(execute: Callable[..., Any], sql: str, *args: Any) -> Any:
            if name != alias:
                raise OutsideStep(f"a job queried the {name!r} alias; jobs use only {alias!r}")
            if not _in_step.get():
                raise OutsideStep("a job read or wrote data outside a step (the tenant is not set)")
            return execute(sql, *args)

        return check

    token = _guarded.set(True)
    try:
        with contextlib.ExitStack() as stack:
            for name in connections:
                stack.enter_context(connections[name].execute_wrapper(guard(name)))
            yield
    finally:
        _guarded.reset(token)


@contextlib.contextmanager
def _queries_allowed() -> Iterator[None]:
    token = _in_step.set(True)
    try:
        yield
    finally:
        _in_step.reset(token)


class Run:
    """What a job's function is given: its tenant, its user, its steps, and whether to stop."""

    def __init__(
        self,
        *,
        job_id: JobId | None,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID | None,
        abort_reason: Callable[[], AbortReason | None],
        attempts: int | None = None,
    ) -> None:
        self.job_id = job_id
        self.tenant_id = tenant_id
        self.user_id = user_id
        self._abort_reason = abort_reason
        self._attempts = attempts
        """The job's tries before this one, as fetched: a later try (the retrier's) supersedes it."""

    def steps(self, store: StepStore, subject_id: uuid.UUID, *, total: int) -> Steps:
        """The steps of one subject (a file), kept in `store`; `total` is how many it expects."""
        return Steps(self, store, subject_id, total)

    def check_cancelled(self) -> None:
        """Raise Cancelled if the job was cancelled or its worker is stopping (call it inside a
        long step; the runner calls it between steps)."""
        # A person's cancel wins over a stop: during a stop Procrastinate keeps the reason SHUTDOWN
        # and ignores a later cancel, so the job's row is read as well.
        reason = self._abort_reason()
        if reason == AbortReason.USER_REQUEST or self._stopped(lock=False):
            raise Cancelled(f"job {self.job_id} was cancelled")
        if reason == AbortReason.SHUTDOWN:
            raise Stopped(f"job {self.job_id} stops with its worker")

    def _cancelled_before_commit(self) -> bool:
        """Whether a cancel came before this step's commit (a stopping worker lets the step commit
        and stops after it). The job's row is held until the commit, so a cancel after this waits."""
        return self._abort_reason() == AbortReason.USER_REQUEST or self._stopped(lock=True)

    @contextlib.contextmanager
    def acting(self) -> Iterator[None]:
        """One step's transaction, acting in the job's tenant as its user (the system: no user)."""
        alias = settings.PROCRASTINATE_DATABASE_ALIAS
        with _queries_allowed(), tenancy.acting_in(self.tenant_id, user_id=self.user_id) as acting:
            if self.user_id is not None and acting.membership is None:
                # Fail closed, whether acting_in keeps the tenant (main) or drops it (07): the
                # person who asked no longer holds a current Membership here.
                raise JobRefused(
                    f"the user who asked, {self.user_id}, no longer has a current Membership in"
                    f" {self.tenant_id}: the job is refused"
                )
            if acting.tenant_id != self.tenant_id or acting.library_id is None:
                raise JobRefused(f"no Developer {self.tenant_id} to act in")
            callbacks = len(connections[alias].run_on_commit)
            yield
            if len(connections[alias].run_on_commit) != callbacks:
                # It would run after the commit, with no tenant set and every query allowed.
                raise OutsideStep("a step registered transaction.on_commit; do that work in a step")
        self._check_no_tenant_left()

    def _stopped(self, *, lock: bool) -> bool:
        """Whether this try must stop: its job's row is gone, is no longer running, asks it to stop,
        or has been tried again since (the retrier judged this try's worker dead). With `lock`, the
        row is held until the commit, so a cancel or a retry after this waits for it."""
        if self.job_id is None:
            return False
        alias = settings.PROCRASTINATE_DATABASE_ALIAS
        suffix = " for share" if lock else ""
        with _queries_allowed(), connections[alias].cursor() as cursor:
            cursor.execute(
                f"select status::text, abort_requested, attempts from procrastinate_jobs"
                f" where id = %s{suffix}",
                [self.job_id],
            )
            row = cursor.fetchone()
        if row is None:
            return True
        status, abort_requested, attempts = row
        superseded = self._attempts is not None and attempts != self._attempts
        return status != "doing" or bool(abort_requested) or superseded

    def _check_no_tenant_left(self) -> None:
        alias = settings.PROCRASTINATE_DATABASE_ALIAS
        connection = connections[alias]
        if connection.in_atomic_block:
            return  # inside an outer transaction (a test), the settings end with it
        with _queries_allowed(), connection.cursor() as cursor:
            cursor.execute(
                "select coalesce(current_setting(%s, true), ''),"
                " coalesce(current_setting(%s, true), ''),"
                " coalesce(current_setting(%s, true), '')",
                [
                    settings.VEXTRUS_TENANT_SETTING,
                    settings.VEXTRUS_USER_SETTING,
                    settings.VEXTRUS_LIBRARY_SETTING,
                ],
            )
            left = cursor.fetchone()
        if left is None or any(left):
            with contextlib.suppress(Exception), connection.cursor() as cursor:
                cursor.execute("select pg_advisory_unlock_all()")  # before the job's end is recorded
            connection.close()
            raise TenancyLeaked("a step left a tenant setting on its connection after its commit")


class Steps:
    """The steps of one subject: each run once, in its own transaction, and skipped once recorded."""

    def __init__(self, run: Run, store: StepStore, subject_id: uuid.UUID, total: int) -> None:
        self._run = run
        self._store = store
        self.subject_id = subject_id
        self.total = total
        self.done = 0

    def expect(self, total: int) -> None:
        """Change how many steps the subject expects (once a step has found how many sheets)."""
        self.total = total

    def run(self, name: str, fn: Callable[[], StepResult], *, inputs: Inputs = None) -> StepResult:
        """Run step `name` unless its store holds it under the same inputs; its result either way.

        `fn` and `inputs` (when a function) run inside the step's transaction, acting in the tenant.
        """
        if not _NAME.fullmatch(name):
            raise ValueError(f"a step's name is lower-case words: {name!r}")
        self._run.check_cancelled()
        with self._run.acting():
            recorded = self._store.completed(self._key(name, inputs))
            if recorded is None:
                self._store.progress(self.subject_id, Progress(self.done, self.total, name))
        if recorded is None:
            with self._run.acting():
                key = self._key(name, inputs)
                recorded = self._store.completed(key)  # a try that raced this one
                if recorded is None:
                    recorded = _as_json_object(fn(), name)
                    self._store.record(key, recorded)
                    if self._run._cancelled_before_commit():
                        raise Cancelled(f"job {self._run.job_id} was cancelled")
        self.done += 1
        if self.done == self.total:
            with self._run.acting():
                self._store.progress(self.subject_id, Progress(self.done, self.total, None))
        return recorded

    def _key(self, name: str, inputs: Inputs) -> StepKey:
        values = inputs() if callable(inputs) else (inputs or {})
        return StepKey(self.subject_id, name, input_hash(values))


def input_hash(inputs: Mapping[str, object]) -> str:
    """sha256 of the inputs as canonical JSON: sorted keys, no spaces, UUIDs as text."""
    text = json.dumps(inputs, sort_keys=True, separators=(",", ":"), default=_json_default)
    return hashlib.sha256(text.encode()).hexdigest()


def _as_json_object(result: object, step: str) -> StepResult:
    """The step's result as its store gives it back on a restart: a JSON object."""
    if not isinstance(result, dict):
        raise TypeError(f"step {step!r} returns a JSON object (a dict), not {type(result).__name__}")
    text = json.dumps(result, sort_keys=True, allow_nan=False, default=_json_default)
    parsed: StepResult = json.loads(text)
    return parsed


def _json_default(value: object) -> str:
    if isinstance(value, uuid.UUID):
        return str(value)
    raise TypeError(f"not JSON: {type(value).__name__}")


# State, cancel and restart, within the acting tenant -------------------------------------------------


@dataclass(frozen=True)
class JobState:
    id: JobId
    task: str
    status: str
    """`waiting`, `running`, `retrying`, `stopping`, `cancelled`, `failed` or `done`."""
    attempt: int
    """The try running or last run, from 1 (0 while it waits for its first)."""
    tries: int
    message: Message


def state(job_id: JobId) -> JobState | None:
    """The acting tenant's job, or None (no such job, or another tenant's)."""
    row = _own_job(job_id)
    if row is None:
        return None
    task, status, attempts, abort_requested = row
    tries = settings.VEXTRUS_JOB_TRIES
    # `attempts` counts real tries only (a stop is none), so a waiting or running try is at most
    # the last; `min` holds "try N of M" to N <= M even if VEXTRUS_JOB_TRIES is lowered later.
    upcoming = min(attempts + 1, tries)
    if status == "todo":
        name, attempt = ("retrying", upcoming) if attempts else ("waiting", 0)
    elif status in ("doing", "aborting"):
        name = "stopping" if abort_requested or status == "aborting" else "running"
        attempt = upcoming
    else:
        name = {"succeeded": "done", "failed": "failed"}.get(status, "cancelled")
        attempt = attempts  # the tries made, as they were made
    if name == "running" and attempt > 1:
        message = words.RUNNING_AGAIN(attempt=attempt, tries=tries)
    else:
        message = {
            "waiting": words.WAITING(),
            "running": words.RUNNING(),
            "retrying": words.RETRYING(attempt=attempt, tries=tries),
            "stopping": words.STOPPING(),
            "cancelled": words.CANCELLED(),
            "failed": words.FAILED(tries=attempt),
            "done": words.DONE(),
        }[name]
    return JobState(job_id, task, name, attempt, tries, message)


def cancel(job_id: JobId) -> bool:
    """Cancel the acting tenant's job: a waiting one never runs, a running one stops and its current
    step rolls back. False if there is no such job, or it has already ended."""
    if _own_job(job_id) is None:
        return False
    with connections[settings.PROCRASTINATE_DATABASE_ALIAS].cursor() as cursor:
        cursor.execute("select procrastinate_cancel_job_v1(%s, true, false)", [job_id])
        row = cursor.fetchone()
    return bool(row and row[0] is not None)


def restart(job_id: JobId) -> JobId:
    """Defer a failed or cancelled job of the acting tenant again, with the same ids, for the acting
    user; its completed steps skip. Inside the data's transaction, as `defer`."""
    row = _own_job(job_id)
    if row is None:
        raise NotRestartable(f"no job {job_id}")
    task, status, _attempts, _abort = row
    if status not in ("failed", "cancelled", "aborted"):
        raise NotRestartable(f"job {job_id} is {status}")
    declared = _registered.get(task)
    if declared is None:
        raise NotRestartable(f"job {job_id}'s task {task} is not declared here")
    with connections[settings.PROCRASTINATE_DATABASE_ALIAS].cursor() as cursor:
        cursor.execute("select args from procrastinate_jobs where id = %s", [job_id])
        (raw,) = cursor.fetchone() or ({},)
    arguments = declared.parse(json.loads(raw) if isinstance(raw, str) else raw)
    return declared.defer(**arguments.ids)


def _own_job(job_id: JobId) -> tuple[str, str, int, bool] | None:
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None or type(job_id) is not int:
        return None
    with connections[settings.PROCRASTINATE_DATABASE_ALIAS].cursor() as cursor:
        cursor.execute(
            "select task_name, status::text, attempts, abort_requested from procrastinate_jobs"
            " where id = %s and args ->> 'tenant_id' = %s",
            [job_id, str(tenant_id)],
        )
        row = cursor.fetchone()
    return None if row is None else (row[0], row[1], row[2], row[3])


# Retries ---------------------------------------------------------------------------------------------


STOP_PRIORITY = -(2**31)
"""The priority a stop's retry asks for: the job wall reads it as "a stop", keeps the job's priority
and its tries as they were, so a worker's stop never counts against VEXTRUS_JOB_TRIES."""


class _Retry(BaseRetryStrategy):
    """Try a job up to VEXTRUS_JOB_TRIES times, unless it was refused, leaked a setting or ran out
    of memory (the `cad` worker's cap: the same try would reach it again, 24); a job stopped with its
    worker is always tried again, at once."""

    def get_retry_decision(
        self, *, exception: BaseException, job: procrastinate_jobs.Job
    ) -> RetryDecision | None:
        if isinstance(exception, Stopped):
            # Tried again at once, and not counted: the job wall keeps its tries as they were.
            return RetryDecision(retry_in={"seconds": 0}, priority=STOP_PRIORITY)
        if isinstance(exception, Cancelled | JobRefused | TenancyLeaked | MemoryError):
            return None  # a cancel ends cancelled, even during a stop
        if job.attempts + 1 >= settings.VEXTRUS_JOB_TRIES:
            return None
        return RetryDecision(retry_in={"seconds": settings.VEXTRUS_JOB_RETRY_SECONDS})


async def retry_stalled(manager: JobManager) -> list[JobId]:
    """Try again every running job whose try is dead (a server restart): the ids tried.

    A live worker beats every VEXTRUS_WORKER_HEARTBEAT_SECONDS, even while it stops (`run_worker`
    keeps its own beat past Procrastinate's shutdown), so a worker silent for
    VEXTRUS_JOB_STALLED_SECONDS is dead, frozen or cut off. If its session still holds the job, the
    retrier ends that session (PostgreSQL would keep it for hours behind a half-open connection),
    then tries the job again. A job that was cancelled ends as cancelled; one on its last try ends as
    failed.
    """
    retried = []
    stalled = await manager.get_stalled_jobs(
        seconds_since_heartbeat=settings.VEXTRUS_JOB_STALLED_SECONDS
    )
    for found in stalled:
        assert found.id is not None
        try:
            hi, lo = _try_key(found.id)
            # Its worker has been silent for VEXTRUS_JOB_STALLED_SECONDS, though a live worker beats
            # every VEXTRUS_WORKER_HEARTBEAT_SECONDS even while it stops: frozen, or cut off from
            # its host. Its session still holds the job (PostgreSQL keeps a half-open connection for
            # hours): end that session, as its own role may, and the job is let go at once.
            ended = await manager.connector.execute_query_one_async(
                query="""
                    select count(pg_terminate_backend(pid, 5000)) as ended from pg_locks
                     where locktype = 'advisory' and granted and classid = %(hi)s
                       and objid = %(lo)s and objsubid = 2 and pid <> pg_backend_pid()
                """,
                hi=hi,
                lo=lo,
            )
            if ended["ended"]:
                logger.warning("ended the silent session holding stalled job %s", found.id)
            [current] = await manager.list_jobs_async(id=found.id)
            if current.status != "doing":
                continue
            if current.abort_requested:
                await manager.finish_job_by_id_async(
                    found.id, status=procrastinate_jobs.Status.ABORTED, delete_job=False
                )
            elif current.attempts + 1 >= settings.VEXTRUS_JOB_TRIES:
                await manager.finish_job_by_id_async(
                    found.id, status=procrastinate_jobs.Status.FAILED, delete_job=False
                )
            else:
                await manager.retry_job(current)
                retried.append(found.id)
        except Exception:  # it moved on meanwhile; the next round sees it again
            logger.exception("could not retry stalled job %s", found.id)
    return retried


# The worker ------------------------------------------------------------------------------------------


@dataclass
class _CadWorker:
    ready: bool = False
    fork_guard: bool = False


_cad_worker = _CadWorker()


def run_worker(queues: Sequence[str], *, concurrency: int | None = None, wait: bool = True) -> None:
    """Run a worker in this process on `queues` until stopped (or, without `wait`, until none is
    left). Refuses to start unless row-level security binds it (02's startup check)."""
    queues = list(queues)
    cad = settings.VEXTRUS_CAD_QUEUE
    if not queues:
        raise WorkerRefused("name the queues this worker runs")
    if cad in queues:
        if queues != [cad]:
            raise WorkerRefused(f"the {cad} queue's worker runs that queue alone")
        if concurrency not in (None, settings.VEXTRUS_CAD_WORKER_CONCURRENCY):
            raise WorkerRefused(
                f"the {cad} queue runs at concurrency {settings.VEXTRUS_CAD_WORKER_CONCURRENCY}"
            )
        concurrency = settings.VEXTRUS_CAD_WORKER_CONCURRENCY
    startup.check(settings.PROCRASTINATE_DATABASE_ALIAS)
    if cad in queues:
        prepare_cad_worker()
    for connection in connections.all(initialized_only=True):
        connection.close()
    worker_connector = app.connector.get_worker_connector()  # type: ignore[attr-defined]
    with app.replace_connector(worker_connector):
        asyncio.run(
            _run(
                queues=queues,
                concurrency=concurrency or 1,
                wait=wait,
                # On a stop, a running job gets this long, then stops after its current step and
                # is tried again (its completed steps skip).
                shutdown_graceful_timeout=settings.VEXTRUS_WORKER_STOP_SECONDS,
                update_heartbeat_interval=settings.VEXTRUS_WORKER_HEARTBEAT_SECONDS,
                stalled_worker_timeout=settings.VEXTRUS_JOB_STALLED_SECONDS,
            )
        )


async def _run(**options: Any) -> None:
    """Procrastinate's worker, with a heartbeat of our own beside it: Procrastinate stops beating
    when a stop begins, while its running jobs drain; ours beats until the worker has stopped, so
    only a dead, frozen or cut-off worker ever falls silent."""
    async with app.open_async():
        app.perform_import_paths()  # type: ignore[no-untyped-call]
        worker = app._worker(**options)
        beat = asyncio.create_task(_beat(worker), name="vextrus heartbeat")
        try:
            await worker.run()  # type: ignore[no-untyped-call]
        finally:
            beat.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await beat


async def _beat(worker: Any) -> None:
    while True:
        await asyncio.sleep(settings.VEXTRUS_WORKER_HEARTBEAT_SECONDS)
        if worker.worker_id is not None:
            with contextlib.suppress(Exception):  # a missed beat is only a late one
                await app.job_manager.update_heartbeat(worker.worker_id)


def prepare_cad_worker() -> None:
    """Make this process the `cad` queue's worker: no fork, and the address-space cap set now.

    The cap bounds this process and, since a limit is inherited, every reader it starts (each on its
    own); it is lowered for good (the hard limit too), so no job can raise it again.
    """
    if multiprocessing.get_start_method() == "fork":
        raise WorkerRefused("the cad worker refuses the fork start method (forkserver or spawn)")
    cap = settings.VEXTRUS_CAD_WORKER_MEMORY_BYTES
    if cap is not None:
        if type(cap) is not int or cap <= 0:
            raise WorkerRefused("VEXTRUS_CAD_WORKER_MEMORY_BYTES is a positive number of bytes")
        _soft, hard = resource.getrlimit(resource.RLIMIT_AS)
        limit = cap if hard == resource.RLIM_INFINITY else min(cap, hard)
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
    else:
        logger.warning(
            "the cad worker runs without a memory cap: VEXTRUS_CAD_WORKER_MEMORY_BYTES is unset"
        )
    if not _cad_worker.fork_guard:
        os.register_at_fork(after_in_child=_refuse_forked_child)
        _cad_worker.fork_guard = True
    _cad_worker.ready = True


def _refuse_forked_child() -> None:
    """A child forked in the cad worker exits at once: no pool relies on fork (a forked copy of a
    threaded, capped process may deadlock). A program started by `subprocess` without a
    `preexec_fn` is exec'd without this hook and runs as normal."""
    with contextlib.suppress(Exception):
        sys.stderr.write("vextrus: a process forked inside the cad worker is refused\n")
        sys.stderr.flush()
    os._exit(_FORKED_CHILD_EXIT)
