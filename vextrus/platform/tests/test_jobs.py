"""Jobs: the wrapper, the step runner and the services, run in this process (ticket 09).

Each attack on the trust boundary has its test: a job argument carrying anything but a tenant id and
ids; a step reading data before the tenant and the Library are set, or through the owner; a step's
settings leaking past its transaction; a job deferred outside its data's transaction; a cancelled
job's step committing after the cancel; another tenant's job named by id. The worker in its own
process is `test_jobs_worker.py`.
"""

import json
import uuid
from collections.abc import Callable
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest import mock

import pytest
from django.conf import settings
from django.db import DatabaseError, connection, connections, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from procrastinate import jobs as procrastinate_jobs
from procrastinate.job_context import AbortReason

from vextrus.platform.models import Developer, Membership
from vextrus.platform.services import jobs, tenancy
from vextrus.platform.startup import StartupRefused
from vextrus.testing import jobs as sample
from vextrus.testing.tenancy import add_member

BOTH = ["default", "owner"]
NO_ID = uuid.UUID(int=0)


def job_ids() -> list[int]:
    with connections["owner"].cursor() as cursor:
        cursor.execute(
            "select id from procrastinate_jobs where queue_name = %s order by id", [sample.TEST_QUEUE]
        )
        return [row[0] for row in cursor.fetchall()]


def defer_then_fail(developer: uuid.UUID) -> None:
    with tenancy.acting_in(developer):
        sample.two_steps.defer(subject_id=uuid.uuid4())
        raise RuntimeError("the upload's transaction fails after deferring its read")


def library_of(developer: uuid.UUID) -> uuid.UUID:
    with tenancy.acting_in(developer) as acting:
        assert acting.library_id is not None
        return acting.library_id


def app_job_row(job_id: int) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            "select status::text, attempts, args, lock from procrastinate_jobs where id = %s",
            [job_id],
        )
        status, attempts, args, lock = cursor.fetchone()
    args = json.loads(args) if isinstance(args, str) else args
    return {"status": status, "attempts": attempts, "args": args, "lock": lock}


# Declaring a job ----------------------------------------------------------------------------------


def test_a_job_takes_the_run_then_only_keyword_ids() -> None:
    def positional_id(run: jobs.Run, file_id: uuid.UUID) -> None: ...
    def defaulted(run: jobs.Run, *, file_id: uuid.UUID = NO_ID) -> None: ...
    def not_an_id(run: jobs.Run, *, path: str) -> None: ...
    def tenant(run: jobs.Run, *, tenant_id: uuid.UUID) -> None: ...
    def no_run() -> None: ...

    for fn in (positional_id, defaulted, not_an_id, tenant, no_run):
        with pytest.raises(TypeError):
            jobs.job()(fn)


# Deferring: in the data's transaction, acting in its tenant, ids only -------------------------------


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_job_is_deferred_only_inside_a_transaction(
    make_developer: Callable[..., uuid.UUID], empty_test_queues: None
) -> None:
    make_developer()
    with pytest.raises(jobs.NotInTransaction):
        sample.two_steps.defer(subject_id=uuid.uuid4())
    assert job_ids() == []


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_job_deferred_in_a_transaction_that_rolls_back_is_gone_with_its_data(
    make_developer: Callable[..., uuid.UUID], empty_test_queues: None
) -> None:
    developer = make_developer()
    with pytest.raises(RuntimeError):
        defer_then_fail(developer)

    assert job_ids() == []

    with tenancy.acting_in(developer):
        kept = sample.two_steps.defer(subject_id=uuid.uuid4())
    assert job_ids() == [kept]


@pytest.mark.django_db
def test_a_job_is_deferred_only_while_acting_in_a_tenant_as_the_database_reads_it(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    mine, theirs = make_developer(), make_developer()
    with transaction.atomic(), pytest.raises(jobs.NotInTransaction):
        sample.two_steps.defer(subject_id=uuid.uuid4())
    with tenancy.acting_in(mine):
        with connection.cursor() as cursor:
            cursor.execute("select set_config('app.tenant_id', %s, true)", [str(theirs)])
        with pytest.raises(jobs.NotInTransaction):
            sample.two_steps.defer(subject_id=uuid.uuid4())


@pytest.mark.django_db
@pytest.mark.parametrize(
    "ids",
    [
        {},
        {"subject_id": str(uuid.uuid4())},
        {"subject_id": uuid.uuid4().hex},
        {"subject_id": 42},
        {"subject_id": {"sheet": "S-101"}},
        {"subject_id": Path("/etc/passwd")},
        {"subject_id": uuid.uuid4(), "path": "/etc/passwd"},
        {"subject_id": uuid.uuid4(), "tenant_id": uuid.uuid4()},
        {"subject_id": uuid.uuid4(), "user_id": uuid.uuid4()},
    ],
)
def test_a_job_s_arguments_are_its_ids_as_uuids_and_nothing_else(
    make_developer: Callable[..., uuid.UUID], ids: dict[str, Any]
) -> None:
    with tenancy.acting_in(make_developer()), pytest.raises(jobs.JobRefused):
        sample.two_steps.defer(**ids)


@pytest.mark.django_db
def test_a_model_is_never_an_argument(make_developer: Callable[..., uuid.UUID]) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        row = Developer.objects.get(id=developer)
        with pytest.raises(jobs.JobRefused):
            sample.two_steps.defer(subject_id=row)  # type: ignore[arg-type]


@pytest.mark.django_db
def test_a_deferred_job_carries_its_tenant_its_user_and_its_ids_as_text(
    sign_in: Callable[..., Any],
) -> None:
    member = sign_in()
    subject = uuid.uuid4()
    with member.acting():
        job_id = sample.two_steps.defer(subject_id=subject)
        row = app_job_row(job_id)

    assert row["args"] == {
        "tenant_id": str(member.developer_id),
        "user_id": str(member.user.pk),
        "subject_id": str(subject),
    }
    assert row["lock"] == (
        f"{member.developer_id}:{sample.two_steps.name}:"
        f"subject_id={subject},tenant_id={member.developer_id}"
    )


# The job wall: the database's own line -----------------------------------------------------------


def insert_job(cursor: Any, args: str) -> None:
    cursor.execute(
        "insert into procrastinate_jobs (queue_name, task_name, args) values (%s, %s, %s::jsonb)",
        [sample.TEST_QUEUE, sample.two_steps.name, args],
    )


@pytest.mark.django_db
def test_the_app_may_insert_a_job_only_for_the_tenant_it_acts_in(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    mine, theirs = make_developer(), make_developer()
    with tenancy.acting_in(mine):
        for args in (
            f'{{"tenant_id": "{theirs}", "subject_id": "{uuid.uuid4()}"}}',
            f'{{"tenant_id": "{str(mine).upper()}", "subject_id": "{uuid.uuid4()}"}}',
        ):
            with (
                pytest.raises(DatabaseError, match="only for the tenant it acts in"),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                insert_job(cursor, args)
        with connection.cursor() as cursor:
            insert_job(cursor, f'{{"tenant_id": "{mine}", "subject_id": "{uuid.uuid4()}"}}')
        with (
            pytest.raises(DatabaseError, match="only for the tenant it acts in"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            insert_job(cursor, '{"timestamp": 1}')  # naming no tenant, while acting in one
    with connection.cursor() as cursor:
        insert_job(cursor, '{"timestamp": 1}')  # a periodic job, deferred by a worker (no tenant)

    with (
        pytest.raises(DatabaseError, match="only for the tenant it acts in"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        insert_job(cursor, f'{{"tenant_id": "{mine}", "subject_id": "{uuid.uuid4()}"}}')


@pytest.mark.django_db
def test_the_app_may_never_rewrite_a_job_s_arguments(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    mine, theirs = make_developer(), make_developer()
    with tenancy.acting_in(mine):
        job_id = sample.two_steps.defer(subject_id=uuid.uuid4())
    for acting in (mine, theirs, None):
        with (
            tenancy.acting_in(acting),
            pytest.raises(DatabaseError, match="task, queue, lock or arguments"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "update procrastinate_jobs set args = jsonb_set(args, '{tenant_id}', to_jsonb(%s::text))"
                " where id = %s",
                [str(theirs), job_id],
            )
    with connection.cursor() as cursor:  # the worker's own updates pass
        cursor.execute("update procrastinate_jobs set status = 'doing' where id = %s", [job_id])


@pytest.mark.django_db
def test_the_app_may_defer_a_job_only_as_the_user_it_acts_as_and_only_waiting(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    user, _membership = add_member(developer)
    someone_else, _other = add_member(make_developer())
    subject = uuid.uuid4()
    refusals = [
        (
            f'{{"tenant_id": "{developer}", "user_id": "{someone_else.pk}", "subject_id": "{subject}"}}',
            "insert into procrastinate_jobs (queue_name, task_name, args) values (%s, %s, %s::jsonb)",
            "only for the user it acts as",
        ),
        (
            f'{{"tenant_id": "{developer}", "subject_id": "{subject}"}}',
            (
                "insert into procrastinate_jobs (queue_name, task_name, args, status)"
                " values (%s, %s, %s::jsonb, 'doing')"
            ),
            "only as waiting",
        ),
        (
            f'{{"tenant_id": "{developer}", "subject_id": "{subject}"}}',
            (
                "insert into procrastinate_jobs (queue_name, task_name, args, lock)"
                f" values (%s, %s, %s::jsonb, '{uuid.uuid4()}:{sample.two_steps.name}:x')"
            ),
            "lock a job only under the tenant it acts in",
        ),
    ]
    with tenancy.acting_in(developer, user_id=user.pk):
        for args, sql, problem in refusals:
            with (
                pytest.raises(DatabaseError, match=problem),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(sql, [sample.TEST_QUEUE, sample.two_steps.name, args])
        sample.two_steps.defer(subject_id=subject)  # the acting user, waiting, locked under its tenant


@pytest.mark.django_db
def test_the_app_may_not_retarget_reopen_rewind_delete_or_touch_another_tenant_s_job(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    mine, theirs = make_developer(), make_developer()
    with tenancy.acting_in(theirs):
        job_id = sample.two_steps.defer(subject_id=uuid.uuid4())
    statements = [
        ("update procrastinate_jobs set task_name = 'another.task' where id = %s", "task, queue"),
        ("update procrastinate_jobs set queue_name = 'cad' where id = %s", "task, queue"),
        ("update procrastinate_jobs set lock = 'x' where id = %s", "task, queue"),
    ]
    for sql, problem in statements:
        with (
            pytest.raises(DatabaseError, match=problem),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(sql, [job_id])
    with tenancy.acting_in(mine):
        for sql in (
            "update procrastinate_jobs set status = 'cancelled' where id = %s",
            "select procrastinate_cancel_job_v1(%s, true, false)",
        ):
            with (
                pytest.raises(DatabaseError, match="only the jobs of the tenant it acts in"),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(sql, [job_id])
        with (
            pytest.raises(DatabaseError, match="permission denied"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute("delete from procrastinate_jobs where id = %s", [job_id])
    with connection.cursor() as cursor:  # the worker's own path: it fails the job
        cursor.execute(
            "update procrastinate_jobs set status = 'failed', attempts = 3 where id = %s", [job_id]
        )
    for sql, problem in (
        ("select procrastinate_retry_job_v2(%s, now(), null, null, null)", "reopen a job"),
        ("update procrastinate_jobs set attempts = 0 where id = %s", "take back a job's tries"),
    ):
        with (
            pytest.raises(DatabaseError, match=problem),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(sql, [job_id])


# The worker's check of the arguments -------------------------------------------------------------


def worker_context(job_id: int | None = None, task: str = sample.two_steps.name) -> Any:
    return SimpleNamespace(
        job=SimpleNamespace(id=job_id, task_name=task, attempts=0), abort_reason=lambda: None
    )


RAW_REFUSED = [
    {},
    {"subject_id": str(uuid.UUID(int=1))},
    {"tenant_id": "not an id", "subject_id": str(uuid.UUID(int=1))},
    {"tenant_id": "0190C0DE-ABCD-7000-8000-00000000000F", "subject_id": str(uuid.UUID(int=1))},
    {"tenant_id": uuid.UUID(int=2).hex, "subject_id": str(uuid.UUID(int=1))},
    {"tenant_id": str(uuid.UUID(int=2)), "subject_id": 7},
    {"tenant_id": str(uuid.UUID(int=2)), "subject_id": {"id": str(uuid.UUID(int=1))}},
    {"tenant_id": str(uuid.UUID(int=2)), "subject_id": [str(uuid.UUID(int=1))]},
    {"tenant_id": str(uuid.UUID(int=2)), "subject_id": str(uuid.UUID(int=1)), "path": "/etc"},
    {"tenant_id": str(uuid.UUID(int=2)), "subject_id": str(uuid.UUID(int=1)), "sheet": "S-101"},
    {"tenant_id": str(uuid.UUID(int=2)), "subject_id": "<Developer: Rupayan>"},
    {"tenant_id": str(uuid.UUID(int=2)), "subject_id": str(uuid.UUID(int=1)), "user_id": None},
]


@pytest.mark.django_db
@pytest.mark.parametrize("raw", RAW_REFUSED)
def test_the_worker_refuses_any_argument_but_a_tenant_id_and_ids_before_any_query(
    raw: dict[str, Any],
) -> None:
    with CaptureQueriesContext(connection) as queries, pytest.raises(jobs.JobRefused):
        sample.two_steps._run_in_worker(worker_context(), **raw)

    assert len(queries) == 0
    decision = sample.two_steps.task.retry_strategy.get_retry_decision(  # type: ignore[union-attr]
        exception=jobs.JobRefused("refused"),
        job=procrastinate_jobs.Job(
            queue=sample.TEST_QUEUE, lock=None, queueing_lock=None, task_name=sample.two_steps.name
        ),
    )
    assert decision is None


@pytest.mark.django_db
def test_a_cad_job_is_refused_by_any_worker_but_the_cad_queue_s(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    raw = {"tenant_id": str(make_developer()), "subject_id": str(uuid.uuid4())}
    assert not jobs._cad_worker.ready

    with CaptureQueriesContext(connection) as queries, pytest.raises(jobs.JobRefused, match="cad"):
        sample.cad_steps._run_in_worker(worker_context(task=sample.cad_steps.name), **raw)

    assert len(queries) == 0


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_the_worker_closes_its_connections_after_each_job_and_lets_go_of_it(
    make_developer: Callable[..., uuid.UUID],
    step_store: sample.TableStepStore,
    empty_test_queues: None,
) -> None:
    developer = make_developer()
    for _ in range(2):
        subject = uuid.uuid4()
        with tenancy.acting_in(developer):
            job_id = sample.two_steps.defer(subject_id=subject)
        with connections["owner"].cursor() as cursor:  # as the worker's fetch leaves it
            cursor.execute("update procrastinate_jobs set status = 'doing' where id = %s", [job_id])

        sample.two_steps._run_in_worker(
            worker_context(job_id), tenant_id=str(developer), subject_id=str(subject)
        )

        assert all(c.connection is None for c in connections.all(initialized_only=True))
        with connections["owner"].cursor() as cursor:  # the try let go: its job may now end
            cursor.execute(
                "select pg_try_advisory_xact_lock(%s, %s)", [job_id >> 31, job_id & 0x7FFFFFFF]
            )
            assert cursor.fetchone() == (True,)
        assert set(sample.recorded_steps(subject)) == {"first", "second"}


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_try_waits_its_turn_while_another_try_still_holds_its_job(
    make_developer: Callable[..., uuid.UUID],
    step_store: sample.TableStepStore,
    empty_test_queues: None,
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    with tenancy.acting_in(developer):
        job_id = sample.two_steps.defer(subject_id=subject)
    with connections["owner"].cursor() as cursor:
        cursor.execute("select pg_advisory_lock(%s, %s)", [job_id >> 31, job_id & 0x7FFFFFFF])
    try:
        with pytest.raises(jobs.TryStillRunning):
            sample.two_steps._run_in_worker(
                worker_context(job_id), tenant_id=str(developer), subject_id=str(subject)
            )
    finally:
        with connections["owner"].cursor() as cursor:
            cursor.execute("select pg_advisory_unlock(%s, %s)", [job_id >> 31, job_id & 0x7FFFFFFF])
    assert sample.committed_runs(subject) == []


# The steps --------------------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_each_step_acts_in_the_tenant_its_library_and_as_its_user_and_reports_progress(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer, other = make_developer(), make_developer()
    user, _membership = add_member(developer)
    subject = uuid.uuid4()

    sample.run_inline(sample.two_steps, tenant_id=developer, user_id=user.pk, subject_id=subject)

    recorded = sample.recorded_steps(subject)
    assert set(recorded) == {"first", "second"}
    for result in recorded.values():
        assert result["tenant_id"] == str(developer)
        assert result["library_id"] == str(library_of(developer))
        assert result["user_id"] == str(user.pk)
        assert result["role"] == settings.VEXTRUS_APP_ROLE
        assert result["developers"] == 1  # its own row only: row-level security binds the step
    assert other != developer
    assert sample.progress_log(subject) == [
        jobs.Progress(0, 2, "first"),
        jobs.Progress(1, 2, "second"),
        jobs.Progress(2, 2, None),
    ]
    assert sample.committed_runs(subject) == ["first", "second"]


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_system_step_acts_for_no_user(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    subject = uuid.uuid4()
    sample.run_inline(sample.two_steps, tenant_id=make_developer(), subject_id=subject)

    assert {result["user_id"] for result in sample.recorded_steps(subject).values()} == {""}


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_restart_skips_the_completed_steps_and_runs_the_rest(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, second="fail")
    with pytest.raises(RuntimeError, match="as scripted"):
        sample.run_inline(sample.two_steps, tenant_id=developer, subject_id=subject)
    assert set(sample.recorded_steps(subject)) == {"first"}
    assert sample.committed_runs(subject) == ["first"]  # the failed step's run rolled back

    sample.script(developer, subject, second="ok")
    sample.run_inline(sample.two_steps, tenant_id=developer, subject_id=subject)

    assert set(sample.recorded_steps(subject)) == {"first", "second"}
    assert sample.committed_runs(subject) == ["first", "second"]  # first ran once
    assert sample.progress_log(subject)[-2:] == [
        jobs.Progress(1, 2, "second"),
        jobs.Progress(2, 2, None),
    ]


@pytest.mark.django_db
def test_a_step_reruns_when_its_inputs_change_and_its_result_is_what_the_store_returns(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    run = jobs.Run(job_id=None, tenant_id=developer, user_id=None, abort_reason=lambda: None)
    steps = run.steps(step_store, uuid.uuid4(), total=3)
    calls: list[int] = []

    def read(value: int) -> Callable[[], jobs.StepResult]:
        def fn() -> jobs.StepResult:
            calls.append(value)
            return {"value": value, "file": str(uuid.UUID(int=value))}

        return fn

    first = steps.run("read", read(1), inputs={"sha256": "a" * 64})
    again = steps.run("read", read(2), inputs=lambda: {"sha256": "a" * 64})
    changed = steps.run("read", read(3), inputs={"sha256": "b" * 64})

    assert calls == [1, 3]
    assert first == again == {"value": 1, "file": str(uuid.UUID(int=1))}
    assert changed["value"] == 3
    with pytest.raises(TypeError, match="JSON object"):
        steps.run("bad", lambda: ["not", "an", "object"])  # type: ignore[arg-type,return-value]
    with pytest.raises(ValueError, match="lower-case"):
        steps.run("Read Sheet", read(4))
    with pytest.raises(ValueError, match="JSON compliant"):
        steps.run("nan", lambda: {"x": float("nan")})


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_job_touching_data_outside_a_step_is_refused_before_it_reads(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    with pytest.raises(jobs.OutsideStep, match="outside a step"):
        sample.run_inline(
            sample.reads_outside_a_step, tenant_id=make_developer(), subject_id=uuid.uuid4()
        )


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_step_may_not_read_through_the_owner(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="read_owner")

    with pytest.raises(jobs.OutsideStep, match="'owner' alias"):
        sample.run_inline(sample.two_steps, tenant_id=developer, subject_id=subject)
    assert sample.recorded_steps(subject) == {}
    assert sample.committed_runs(subject) == []


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_step_that_leaves_a_tenant_setting_on_its_connection_fails_the_job_for_good(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="leak")

    with pytest.raises(jobs.TenancyLeaked):
        sample.run_inline(sample.two_steps, tenant_id=developer, subject_id=subject)

    assert connection.connection is None  # closed: the next job starts clean
    assert "second" not in sample.recorded_steps(subject)
    with connection.cursor() as cursor:
        cursor.execute("select coalesce(current_setting('app.tenant_id', true), '')")
        assert cursor.fetchone() == ("",)
    assert (
        jobs._Retry().get_retry_decision(
            exception=jobs.TenancyLeaked("leak"),
            job=procrastinate_jobs.Job(
                queue=sample.TEST_QUEUE, lock=None, queueing_lock=None, task_name="t"
            ),
        )
        is None
    )


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_no_setting_outlives_a_step_s_transaction(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    user, _membership = add_member(developer)
    sample.run_inline(sample.two_steps, tenant_id=developer, user_id=user.pk, subject_id=uuid.uuid4())

    with connection.cursor() as cursor:
        cursor.execute(
            "select coalesce(current_setting('app.tenant_id', true), ''),"
            " coalesce(current_setting('app.user_id', true), ''),"
            " coalesce(current_setting('app.library_id', true), '')"
        )
        assert cursor.fetchone() == ("", "", "")
    assert tenancy.current() == tenancy.Tenancy()


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_step_for_a_user_whose_membership_has_ended_is_refused(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    user, membership_id = add_member(developer)
    with tenancy.acting_in(developer):
        Membership.objects.filter(id=membership_id).update(revoked_at=timezone.now())
    subject = uuid.uuid4()

    # Refused whether acting_in keeps the tenant for such a user (main) or drops it (07's fix).
    with pytest.raises(jobs.JobRefused, match="no longer has a current Membership") as refused:
        sample.run_inline(sample.two_steps, tenant_id=developer, user_id=user.pk, subject_id=subject)
    assert sample.committed_runs(subject) == []
    assert sample.recorded_steps(subject) == {}
    never_retried = jobs._Retry().get_retry_decision(
        exception=refused.value,
        job=procrastinate_jobs.Job(
            queue=sample.TEST_QUEUE, lock=None, queueing_lock=None, task_name="t"
        ),
    )
    assert never_retried is None


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_step_may_not_leave_work_for_after_its_commit(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="on_commit")

    with pytest.raises(jobs.OutsideStep, match="on_commit"):
        sample.run_inline(sample.two_steps, tenant_id=developer, subject_id=subject)
    assert sample.committed_runs(subject) == []


@pytest.mark.django_db(transaction=True, databases=BOTH)
@pytest.mark.parametrize("action", ["supersede", "vanish"])
def test_a_try_that_was_superseded_or_whose_job_is_gone_commits_nothing(
    make_developer: Callable[..., uuid.UUID],
    step_store: sample.TableStepStore,
    empty_test_queues: None,
    action: str,
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first=action)
    with tenancy.acting_in(developer):
        job_id = sample.two_steps.defer(subject_id=subject)
    with connections["owner"].cursor() as cursor:  # as the worker's fetch leaves it
        cursor.execute("update procrastinate_jobs set status = 'doing' where id = %s", [job_id])

    with pytest.raises(jobs.Cancelled):
        sample.run_inline(
            sample.two_steps, tenant_id=developer, subject_id=subject, job_id=job_id, attempts=0
        )
    assert sample.recorded_steps(subject) == {}
    assert sample.committed_runs(subject) == []


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_job_for_no_developer_is_refused(step_store: sample.TableStepStore) -> None:
    with pytest.raises(jobs.JobRefused, match="no Developer"):
        sample.run_inline(sample.two_steps, tenant_id=uuid.uuid4(), subject_id=uuid.uuid4())


# Cancel -----------------------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_step_cancelled_while_it_runs_rolls_back_and_the_next_never_starts(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="cancel_inline")

    def reason() -> AbortReason | None:
        return AbortReason.USER_REQUEST if subject in sample.INLINE_CANCELS else None

    with pytest.raises(jobs.Cancelled):
        sample.run_inline(sample.two_steps, tenant_id=developer, subject_id=subject, abort_reason=reason)

    assert sample.recorded_steps(subject) == {}
    assert sample.committed_runs(subject) == []


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_stopping_worker_lets_the_running_step_commit_then_stops(
    make_developer: Callable[..., uuid.UUID], step_store: sample.TableStepStore
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="cancel_inline")

    def reason() -> AbortReason | None:
        return AbortReason.SHUTDOWN if subject in sample.INLINE_CANCELS else None

    with pytest.raises(jobs.Stopped):
        sample.run_inline(sample.two_steps, tenant_id=developer, subject_id=subject, abort_reason=reason)

    assert set(sample.recorded_steps(subject)) == {"first"}
    assert sample.committed_runs(subject) == ["first"]


# State, cancel and restart ------------------------------------------------------------------------


@pytest.mark.django_db
def test_state_cancel_and_restart_see_only_the_acting_tenant_s_jobs(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    mine, theirs = make_developer(), make_developer()
    with tenancy.acting_in(theirs):
        their_job = sample.two_steps.defer(subject_id=uuid.uuid4())

    with tenancy.acting_in(mine):
        assert jobs.state(their_job) is None
        assert jobs.cancel(their_job) is False
        with pytest.raises(jobs.NotRestartable):
            jobs.restart(their_job)
        assert jobs.state("1; drop table x") is None  # type: ignore[arg-type]
    assert jobs.state(their_job) is None  # no tenant: no job

    with tenancy.acting_in(theirs):
        state = jobs.state(their_job)
        assert state is not None
        assert (state.status, state.message) == (
            "waiting",
            {"code": "platform.jobs.waiting", "params": {}},
        )


@pytest.mark.django_db
def test_cancelling_a_waiting_job_stops_it_and_a_restart_defers_it_again(
    sign_in: Callable[..., Any],
) -> None:
    member = sign_in()
    subject = uuid.uuid4()
    with member.acting():
        job_id = sample.two_steps.defer(subject_id=subject)
        with pytest.raises(jobs.NotRestartable, match="todo"):
            jobs.restart(job_id)

        assert jobs.cancel(job_id) is True
        state = jobs.state(job_id)
        assert state is not None
        assert state.status == "cancelled"
        assert jobs.cancel(job_id) is False  # already ended

        again = jobs.restart(job_id)

        assert again != job_id
        assert app_job_row(again)["args"] == app_job_row(job_id)["args"]
        assert app_job_row(again)["status"] == "todo"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("status", "attempts", "abort", "expected", "message"),
    [
        ("todo", 0, False, "waiting", {"code": "platform.jobs.waiting", "params": {}}),
        (
            "todo",
            1,
            False,
            "retrying",
            {"code": "platform.jobs.retrying", "params": {"attempt": 2, "tries": 3}},
        ),
        ("doing", 0, False, "running", {"code": "platform.jobs.running", "params": {}}),
        ("doing", 1, True, "stopping", {"code": "platform.jobs.stopping", "params": {}}),
        ("succeeded", 1, False, "done", {"code": "platform.jobs.done", "params": {}}),
        ("failed", 3, False, "failed", {"code": "platform.jobs.failed", "params": {"tries": 3}}),
        ("aborted", 1, False, "cancelled", {"code": "platform.jobs.cancelled", "params": {}}),
    ],
)
def test_a_job_s_state_is_a_status_word_and_its_message(
    make_developer: Callable[..., uuid.UUID],
    status: str,
    attempts: int,
    abort: bool,
    expected: str,
    message: dict[str, Any],
) -> None:
    developer = make_developer()
    with tenancy.acting_in(developer):
        job_id = sample.two_steps.defer(subject_id=uuid.uuid4())
        with connection.cursor() as cursor:
            cursor.execute(
                "update procrastinate_jobs set status = %s, attempts = %s, abort_requested = %s"
                " where id = %s",
                [status, attempts, abort, job_id],
            )
        state = jobs.state(job_id)

    assert state is not None
    assert (state.status, state.message, state.tries) == (expected, message, 3)


# Retries -----------------------------------------------------------------------------------------


@pytest.mark.parametrize(("attempts", "retried"), [(0, True), (1, True), (2, False)])
def test_a_job_that_raised_is_tried_three_times_in_all(attempts: int, retried: bool) -> None:
    job = procrastinate_jobs.Job(
        queue=sample.TEST_QUEUE, lock=None, queueing_lock=None, task_name="t", attempts=attempts
    )

    decision = jobs._Retry().get_retry_decision(exception=RuntimeError("boom"), job=job)

    assert (decision is not None) is retried


# The worker's refusals, before it starts ----------------------------------------------------------


@pytest.mark.parametrize(
    ("queues", "concurrency", "problem"),
    [
        ([], None, "name the queues"),
        (["cad", "default"], None, "runs that queue alone"),
        (["cad"], 2, "concurrency 1"),
    ],
)
def test_a_worker_asked_to_run_as_it_must_not_is_refused_before_it_starts(
    queues: list[str], concurrency: int | None, problem: str
) -> None:
    with (
        mock.patch("vextrus.platform.startup.check") as check,
        mock.patch("vextrus.platform.services.jobs.app.run_worker") as run,
        pytest.raises(jobs.WorkerRefused, match=problem),
    ):
        jobs.run_worker(queues, concurrency=concurrency)

    check.assert_not_called()
    run.assert_not_called()


def test_the_cad_worker_refuses_the_fork_start_method_before_setting_its_cap() -> None:
    with (
        mock.patch("multiprocessing.get_start_method", return_value="fork"),
        mock.patch("resource.setrlimit") as setrlimit,
        pytest.raises(jobs.WorkerRefused, match="fork"),
    ):
        jobs.prepare_cad_worker()

    setrlimit.assert_not_called()
    assert not jobs._cad_worker.ready


@pytest.mark.django_db
def test_a_worker_checks_the_database_role_before_it_starts() -> None:
    refused = StartupRefused("connected as vextrus, not vextrus_app")
    with (
        mock.patch("vextrus.platform.startup.check", side_effect=refused) as check,
        mock.patch("vextrus.platform.services.jobs.app.run_worker") as run,
        pytest.raises(StartupRefused),
    ):
        jobs.run_worker([settings.VEXTRUS_DEFAULT_QUEUE])

    check.assert_called_once_with("default")
    run.assert_not_called()


def test_the_stalled_job_retrier_runs_every_minute_on_the_default_queue() -> None:
    from procrastinate.contrib.django import app

    [retrier] = [
        periodic
        for periodic in app.periodic_registry.periodic_tasks.values()
        if periodic.task.name == "vextrus.platform.retry_stalled_jobs"
    ]
    assert retrier.cron == "* * * * *"
    assert retrier.task.queue == settings.VEXTRUS_DEFAULT_QUEUE


@pytest.mark.parametrize(
    ("arguments", "queues", "concurrency", "wait"),
    [
        ([], ["default"], None, True),
        (["--queue", "cad", "--no-wait"], ["cad"], None, False),
        (["--queue", "a", "--queue", "b", "--concurrency", "4"], ["a", "b"], 4, True),
    ],
)
def test_the_worker_command_runs_the_worker_on_its_queues(
    arguments: list[str], queues: list[str], concurrency: int | None, wait: bool
) -> None:
    from django.core.management import call_command

    with mock.patch.object(jobs, "run_worker") as run:
        call_command("worker", *arguments)

    run.assert_called_once_with(queues, concurrency=concurrency, wait=wait)


def test_the_worker_command_reports_a_refusal_as_its_error() -> None:
    from django.core.management import CommandError, call_command

    with (
        mock.patch.object(jobs, "run_worker", side_effect=jobs.WorkerRefused("runs that queue alone")),
        pytest.raises(CommandError, match="runs that queue alone"),
    ):
        call_command("worker", "--queue", "cad", "--queue", "default")
