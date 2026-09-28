"""The worker in its own process (ticket 09): `jobs.run_worker` on the test database, through
Procrastinate's worker connector, as a deployed worker runs.

Attacks tried here: a worker started as any role but `vextrus_app`; a cancelled job's step committing
after the cancel; the memory cap absent from a `cad` worker, or a process forking under it. And the
stories: a job shows progress, stops on cancel, and resumes by itself after its worker is killed.
"""

import os
import signal
import subprocess
import sys
import time
import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.conf import settings

from vextrus.platform.services import jobs, tenancy
from vextrus.testing import jobs as sample
from vextrus.testing.tenancy import add_member

BOTH = ["default", "owner"]
pytestmark = [
    pytest.mark.django_db(transaction=True, databases=BOTH),
    pytest.mark.usefixtures("empty_test_queues"),
]


def defer(job: jobs.Job, developer: uuid.UUID, subject: uuid.UUID) -> int:
    with tenancy.acting_in(developer):
        return job.defer(subject_id=subject)


def wait_until(condition: Callable[[], bool], what: str, timeout: float = 30) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        if time.monotonic() > deadline:
            raise AssertionError(f"waited {timeout} s for {what}")
        time.sleep(0.05)


def test_a_worker_runs_a_job_s_steps_as_vextrus_app_in_its_tenant(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    job_id = defer(sample.two_steps, developer, subject)

    output = sample.finish(sample.start_worker([sample.TEST_QUEUE]))

    assert sample.job_row(job_id)["status"] == "succeeded", output
    recorded = sample.recorded_steps(subject)
    assert set(recorded) == {"first", "second"}
    for result in recorded.values():
        assert result["role"] == settings.VEXTRUS_APP_ROLE
        assert result["tenant_id"] == str(developer)
        assert result["library_id"] not in ("", None)
        assert result["developers"] == 1
    assert sample.progress_log(subject)[-1] == jobs.Progress(2, 2, None)


def test_a_worker_connected_as_the_owner_refuses_to_start_and_takes_no_job(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    job_id = defer(sample.two_steps, make_developer(), uuid.uuid4())

    worker = sample.start_worker([sample.TEST_QUEUE], role_alias="owner")
    output = sample.finish(worker)

    assert worker.returncode != 0
    assert "refusing to start" in output
    assert "connected as vextrus, not vextrus_app" in output
    assert sample.job_row(job_id)["status"] == "todo"


def test_the_worker_command_refuses_the_owner_too(make_developer: Callable[..., uuid.UUID]) -> None:
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "vextrus.settings.test",
        "DATABASE_URL": sample.database_url("owner"),
        "DATABASE_OWNER_URL": sample.database_url("owner"),
    }
    done = subprocess.run(
        [sys.executable, "manage.py", "worker", "--queue", sample.TEST_QUEUE, "--no-wait"],
        cwd=settings.BASE_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )

    assert done.returncode != 0
    assert "refusing to start" in done.stderr


def test_a_step_that_is_cancelled_before_it_commits_rolls_back_and_the_job_ends_cancelled(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="cancel_self")
    job_id = defer(sample.two_steps, developer, subject)

    output = sample.finish(sample.start_worker([sample.TEST_QUEUE]))

    row = sample.job_row(job_id)
    assert row["status"] == "aborted", output
    assert sample.recorded_steps(subject) == {}
    assert sample.committed_runs(subject) == []  # the step's own writes rolled back with it
    with tenancy.acting_in(developer):
        state = jobs.state(job_id)
    assert state is not None
    assert state.status == "cancelled"


def test_a_running_job_stops_on_cancel_and_its_step_leaves_nothing(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, second="wait_for_cancel")
    job_id = defer(sample.two_steps, developer, subject)
    worker = sample.start_worker([sample.TEST_QUEUE])
    try:
        wait_until(
            lambda: jobs.Progress(1, 2, "second") in sample.progress_log(subject),
            "the second step to start",
        )
        with tenancy.acting_in(developer):
            assert jobs.cancel(job_id) is True
            state = jobs.state(job_id)
            assert state is not None
            assert state.status in ("stopping", "cancelled")
        output = sample.finish(worker)
    finally:
        worker.kill()

    assert sample.job_row(job_id)["status"] == "aborted", output
    assert set(sample.recorded_steps(subject)) == {"first"}
    assert sample.committed_runs(subject) == ["first"]


def test_a_job_whose_worker_was_killed_is_tried_again_and_resumes_after_its_last_step(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, second="hang")
    job_id = defer(sample.two_steps, developer, subject)
    worker = sample.start_worker([sample.TEST_QUEUE], wait=True)
    try:
        wait_until(
            lambda: jobs.Progress(1, 2, "second") in sample.progress_log(subject),
            "the second step to start",
        )
    finally:
        worker.send_signal(signal.SIGKILL)  # the server restarts mid-step
        sample.finish(worker)
    assert sample.job_row(job_id)["status"] == "doing"
    assert sample.retry_stalled_now() == []  # its heartbeat is still fresh
    make_stale(job_id)

    # The dead worker's backend lets go of the job a moment after its process dies.
    retried: list[int] = []

    def retried_once() -> bool:
        retried.extend(sample.retry_stalled_now())
        return bool(retried)

    wait_until(retried_once, "the retry")
    assert retried == [job_id]

    row = sample.job_row(job_id)
    assert (row["status"], row["attempts"]) == ("todo", 1)
    with tenancy.acting_in(developer):
        state = jobs.state(job_id)
    assert state is not None
    assert state.message == {"code": "platform.jobs.retrying", "params": {"attempt": 2, "tries": 3}}
    sample.script(developer, subject, second="ok")
    output = sample.finish(sample.start_worker([sample.TEST_QUEUE]))
    assert sample.job_row(job_id)["status"] == "succeeded", output
    assert sample.committed_runs(subject) == ["first", "second"]  # first ran once


def test_a_running_try_can_be_neither_retried_nor_ended_by_another_and_its_job_finishes(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="retry_self")
    job_id = defer(sample.two_steps, developer, subject)

    output = sample.finish(sample.start_worker([sample.TEST_QUEUE]))

    row = sample.job_row(job_id)
    assert (row["status"], row["attempts"]) == ("succeeded", 1), output
    first = sample.recorded_steps(subject)["first"]
    assert (first["retry_refused"], first["end_refused"]) == (True, True), output
    assert sample.committed_runs(subject) == ["first", "second"]
    with tenancy.acting_in(developer):
        state = jobs.state(job_id)
    assert state is not None
    assert state.status == "done"


def test_the_retrier_leaves_a_live_try_alone_however_long_its_worker_is_silent(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, second="sleep:6")
    job_id = defer(sample.two_steps, developer, subject)
    worker = sample.start_worker([sample.TEST_QUEUE], wait=True)
    try:
        wait_until(
            lambda: jobs.Progress(1, 2, "second") in sample.progress_log(subject),
            "the second step to start",
        )
        make_stale(job_id)  # as a worker that stopped beating, or was pruned by another

        assert sample.retry_stalled_now() == []

        assert sample.job_row(job_id)["status"] == "doing"
        wait_until(lambda: sample.job_row(job_id)["status"] != "doing", "the try to finish")
    finally:
        worker.send_signal(signal.SIGTERM)
        output = sample.finish(worker)
    row = sample.job_row(job_id)
    assert (row["status"], row["attempts"]) == ("succeeded", 1), output
    assert sample.committed_runs(subject) == ["first", "second"]


def test_a_stopped_worker_stops_after_the_current_step_and_the_job_resumes_after_it(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="sleep:4")
    job_id = defer(sample.two_steps, developer, subject)
    worker = sample.start_worker([sample.TEST_QUEUE], wait=True)
    try:
        wait_until(
            lambda: jobs.Progress(0, 2, "first") in sample.progress_log(subject),
            "the first step to start",
        )
        worker.send_signal(signal.SIGTERM)  # Ctrl-C or a deploy's stop
        time.sleep(0.5)
        make_stale(job_id)  # Procrastinate stops the heartbeat while the worker drains
        assert sample.retry_stalled_now() == []  # the draining try is alive: left alone
        output = sample.finish(worker)
    finally:
        worker.kill()

    row = sample.job_row(job_id)
    assert (row["status"], row["attempts"]) == ("todo", 1), output
    assert set(sample.recorded_steps(subject)) == {"first"}  # the current step committed
    with tenancy.acting_in(developer):
        state = jobs.state(job_id)
    assert state is not None
    assert state.message == {"code": "platform.jobs.retrying", "params": {"attempt": 2, "tries": 3}}

    output = sample.finish(sample.start_worker([sample.TEST_QUEUE]))

    assert sample.job_row(job_id)["status"] == "succeeded", output
    assert sample.committed_runs(subject) == ["first", "second"]  # first ran once


def test_a_job_for_a_user_whose_membership_has_ended_is_refused_once_and_commits_nothing(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    user, membership_id = add_member(developer)
    subject = uuid.uuid4()
    with tenancy.acting_in(developer, user_id=user.pk):
        job_id = sample.two_steps.defer(subject_id=subject)
    _owner("update platform_membership set revoked_at = now() where id = %s", [membership_id])

    output = sample.finish(sample.start_worker([sample.TEST_QUEUE]))

    row = sample.job_row(job_id)
    assert (row["status"], row["attempts"]) == ("failed", 1), output
    assert "no longer has a current Membership" in output
    assert sample.recorded_steps(subject) == {}
    assert sample.committed_runs(subject) == []


def test_a_stalled_job_that_was_cancelled_ends_cancelled_and_one_on_its_last_try_ends_failed(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    cancelled = defer(sample.two_steps, developer, uuid.uuid4())
    exhausted = defer(sample.two_steps, developer, uuid.uuid4())
    for job_id, attempts, abort in ((cancelled, 0, True), (exhausted, 2, False)):
        orphan(job_id, attempts=attempts, abort=abort)

    assert sample.retry_stalled_now() == []

    assert sample.job_row(cancelled)["status"] == "aborted"
    assert sample.job_row(exhausted)["status"] == "failed"


def test_the_cad_worker_runs_under_its_memory_cap_and_a_fork_inside_it_is_refused(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, measure="fork")
    job_id = defer(sample.cad_steps, developer, subject)
    cap = 16 * 1024**3

    output = sample.finish(
        sample.start_worker(
            [settings.VEXTRUS_CAD_QUEUE], overrides={"VEXTRUS_CAD_WORKER_MEMORY_BYTES": cap}
        )
    )

    assert sample.job_row(job_id)["status"] == "succeeded", output
    measured = sample.recorded_steps(subject)["measure"]
    assert measured["rlimit_as"] == [cap, cap]
    assert measured["forked_child_exit"] == 70
    assert "forked inside the cad worker is refused" in output


def test_a_cad_worker_with_no_cap_set_says_so_and_a_plain_worker_has_none(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    cad_subject, plain_subject = uuid.uuid4(), uuid.uuid4()
    cad_job = defer(sample.cad_steps, developer, cad_subject)
    plain_job = defer(sample.two_steps, developer, plain_subject)

    cad_output = sample.finish(sample.start_worker([settings.VEXTRUS_CAD_QUEUE]))
    plain_output = sample.finish(
        sample.start_worker([sample.TEST_QUEUE], overrides={"VEXTRUS_CAD_WORKER_MEMORY_BYTES": 1024**3})
    )

    assert sample.job_row(cad_job)["status"] == "succeeded", cad_output
    assert "without a memory cap" in cad_output
    assert sample.job_row(plain_job)["status"] == "succeeded", plain_output
    unlimited = sample.recorded_steps(plain_subject)["first"]["rlimit_as"]
    assert unlimited != [1024**3, 1024**3]


def test_a_step_that_leaks_a_tenant_setting_fails_its_job_without_a_retry(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    sample.script(developer, subject, first="leak")
    job_id = defer(sample.two_steps, developer, subject)

    output = sample.finish(sample.start_worker([sample.TEST_QUEUE]))

    row = sample.job_row(job_id)
    assert (row["status"], row["attempts"]) == ("failed", 1), output
    assert "TenancyLeaked" in output


# Helpers: a worker that died, as the database sees it -------------------------------------------


def _owner(sql: str, params: list[Any]) -> None:
    from django.db import connections

    with connections["owner"].cursor() as cursor:
        cursor.execute(sql, params)


def make_stale(job_id: int) -> None:
    """The job's worker last beat an hour ago."""
    _owner(
        "update procrastinate_workers set last_heartbeat = now() - interval '1 hour'"
        " where id = (select worker_id from procrastinate_jobs where id = %s)",
        [job_id],
    )


def orphan(job_id: int, *, attempts: int, abort: bool) -> None:
    """The job is running on a worker that is gone (its row pruned)."""
    _owner(
        "update procrastinate_jobs set status = 'doing', worker_id = null, attempts = %s,"
        " abort_requested = %s where id = %s",
        [attempts, abort, job_id],
    )
