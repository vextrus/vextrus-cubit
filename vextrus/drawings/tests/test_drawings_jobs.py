"""A file's reading against 09's job semantics, on a real worker in its own process (ticket 14): the
stub read job (`vextrus.testing.drawings.read_stub`) runs its steps on `drawings.services.step_store()`
as 21a's will, and the file's status reads its job's state over its own columns; cancel and restart
act on the file's own job, under its row lock."""

import time
import uuid
from collections.abc import Callable

import pytest
from django.db import connection

from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.platform.services import auth, tenancy
from vextrus.projects import services as projects
from vextrus.testing import drawings as stub
from vextrus.testing.drawings import add, drawing
from vextrus.testing.jobs import finish, job_row
from vextrus.testing.tenancy import Member

pytestmark = [
    pytest.mark.django_db(transaction=True, databases=["default", "owner"]),
    pytest.mark.usefixtures("empty_drawings_queue"),
]


def wait_until(condition: Callable[[], bool], what: str, timeout: float = 60) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        if time.monotonic() > deadline:
            raise AssertionError(f"waited {timeout} s for {what}")
        time.sleep(0.05)


def a_file(member: Member, name: str = "KR-STR-R0.dwg") -> uuid.UUID:
    with member.acting():
        project = projects.create(code=f"J-{uuid.uuid4().hex[:6]}", name="Jobs")
    return add(member, project.id, name, drawing()).file.id


def read_later(member: Member, file_id: uuid.UUID) -> int:
    """Defer the stub read job for the file, as the member, and name it the file's (21a's upload)."""
    with member.acting():
        job_id = stub.read_stub.defer(file_id=file_id)
        services.attach_read_job(file_id, job_id)
    return job_id


def shown(member: Member, file_id: uuid.UUID) -> services.FileView:
    with member.acting():
        return services.file(file_id)


def steps_kept(member: Member, file_id: uuid.UUID) -> list[str]:
    with member.acting(), connection.cursor() as cursor:
        cursor.execute("select step from drawings_readstep where file_id = %s order by step", [file_id])
        return [step for (step,) in cursor.fetchall()]


def test_a_read_job_keeps_its_steps_and_its_last_step_marks_the_file_read(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in(role="qs")
    file_id = a_file(member)
    read_later(member, file_id)

    output = finish(stub.start_worker())

    assert shown(member, file_id).status == said.READ(), output
    assert steps_kept(member, file_id) == sorted(stub.STUB_STEPS)


def test_a_waiting_read_counts_only_the_developers_own_files_ahead(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in(role="qs")
    stranger = sign_in(role="qs")
    read_later(stranger, a_file(stranger, "T.dwg"))
    first = a_file(member)
    read_later(member, first)
    second = a_file(member, "KR-ARC-R0.dwg")
    read_later(member, second)

    assert shown(member, first).status == said.WAITING(ahead=0)
    assert shown(member, second).status == said.WAITING(ahead=1)


def test_a_running_read_is_cancelled_its_step_rolls_back_and_it_reads_again_once(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in(role="qs")
    file_id = a_file(member)
    stub.script(file_id, reading="wait_for_cancel")
    job_id = read_later(member, file_id)
    worker = stub.start_worker()
    # The opening step committed, and the reading step began (its words alone would not say so:
    # "Reading the drawing" is also what a running read says before its first step).
    wait_until(lambda: steps_kept(member, file_id) == [services.OPENING], "the opening step")
    wait_until(lambda: shown(member, file_id).status == said.READING_DRAWING(), "the reading step")

    with member.acting():
        stopping = services.cancel(file_id, actor_name=member.user.name)
    wait_until(lambda: job_row(job_id)["status"] == "aborted", "the job to stop")
    finish(worker)
    with member.acting():
        services.cancel(file_id, actor_name="Someone Else")
        cancelled = services.file(file_id)
        with connection.cursor() as cursor:
            cursor.execute(
                "select count(*) from platform_domainevent where kind = %s", [said.READ_CANCELLED.code]
            )
            [(acts,)] = cursor.fetchall()
        restarted = services.restart(file_id)
        with pytest.raises(auth.Refused) as again:
            services.restart(file_id)

    assert (stopping.state, stopping.status) == ("stopping", said.STOPPING())
    assert cancelled.state == "cancelled"
    assert cancelled.status["params"]["actor"] == member.user.name
    assert acts == 1  # the second cancel wrote nothing
    assert steps_kept(member, file_id) == [services.OPENING]  # the stopped step rolled back
    assert (restarted.state, restarted.read_job_id != job_id) == ("waiting", True)
    assert (again.value.status, again.value.message) == (409, said.NOT_STOPPED())
    stub.script(file_id, reading="ok")
    finish(stub.start_worker())
    assert shown(member, file_id).status == said.READ()
    assert steps_kept(member, file_id) == sorted(stub.STUB_STEPS)


def test_a_cancel_after_the_last_step_leaves_the_file_read(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="qs")
    file_id = a_file(member)
    read_later(member, file_id)
    finish(stub.start_worker())

    with member.acting():
        after = services.cancel(file_id, actor_name=member.user.name)

    assert after.status == said.READ()


def test_a_read_job_that_crashed_reads_failed_though_it_never_wrote_so(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in(role="qs")
    file_id = a_file(member)
    stub.script(file_id, second_reader="fail")
    job_id = read_later(member, file_id)

    output = finish(stub.start_worker(overrides={"VEXTRUS_JOB_RETRY_SECONDS": 0}))

    assert job_row(job_id)["status"] == "failed", output
    failed = shown(member, file_id)
    assert (failed.state, failed.status) == ("failed", said.FAILED(tries=3))
    with member.acting():
        restarted = services.restart(file_id)
    assert restarted.state == "waiting"
    assert steps_kept(member, file_id) == [services.OPENING, services.READING]


def test_a_read_tried_again_by_itself_says_which_try(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="qs")
    file_id = a_file(member)
    stub.script(file_id, opening="fail")
    job_id = read_later(member, file_id)

    finish(stub.start_worker(overrides={"VEXTRUS_JOB_RETRY_SECONDS": 3600}))

    assert job_row(job_id)["status"] == "todo"
    assert shown(member, file_id).status == said.RETRYING(attempt=2, tries=3)


def test_a_read_job_acts_only_in_its_developer(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="qs")
    stranger = sign_in(role="qs")
    file_id = a_file(member)
    with tenancy.acting_in(stranger.developer_id, user_id=stranger.user.pk):
        # The stranger's own job, naming our file: its steps find no such file.
        job_id = stub.read_stub.defer(file_id=file_id)

    output = finish(stub.start_worker(overrides={"VEXTRUS_JOB_RETRY_SECONDS": 0}))

    assert job_row(job_id)["status"] == "failed", output
    assert steps_kept(member, file_id) == []
    assert shown(member, file_id).state == "waiting"


def test_two_restart_clicks_at_once_start_one_read(sign_in: Callable[..., Member]) -> None:
    import threading

    from django.db import connections

    member = sign_in(role="qs")
    file_id = a_file(member)
    job_id = read_later(member, file_id)
    with member.acting():
        services.cancel(file_id, actor_name=member.user.name)
    barrier = threading.Barrier(2)
    answers: list[str] = []

    def click() -> None:
        try:
            with tenancy.acting_in(member.developer_id, user_id=member.user.pk):
                barrier.wait(timeout=30)
                try:
                    answers.append(str(services.restart(file_id).state))
                except auth.Refused as refused:
                    answers.append(refused.message["code"])
        finally:
            connections.close_all()

    clicks = [threading.Thread(target=click) for _ in range(2)]
    for thread in clicks:
        thread.start()
    for thread in clicks:
        thread.join(timeout=60)

    assert sorted(answers) == ["drawings.files.not_stopped", "waiting"]
    with connection.cursor() as cursor:
        cursor.execute(
            "select count(*) from procrastinate_jobs where queue_name = %s and id <> %s",
            [stub.TEST_QUEUE, job_id],
        )
        assert cursor.fetchone() == (1,)
