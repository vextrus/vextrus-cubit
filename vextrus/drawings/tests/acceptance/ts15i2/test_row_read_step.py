"""S15-I2 (#541): a file's row on the Drawing Set shows its read step.

The Finishing step (#440). m0-screens 4.5, "Reading a DWG": "Opening the file" → … → "Reading sheet 12
of 38" → "Finishing". The files list sends a file in that step as `reading` with the words
`drawings.files.finishing`, both while its read job runs the step and in the moment after the job ended
before its row has (T-W327's "Finishing moment", whose cancel is 409 `drawings.files.cancel_too_late`).
The page's rule for the row's acts (`web/src/acceptance/ts15i2/finishing.test.tsx`) rests on these
words; these tests hold them.

Read again (#441, G1 walk item FL3): after "Read again" on a file whose read was cancelled, the row's
progress counts from the new run's start; nothing is carried from the cancelled run.

m0-screens 4.5, "The file's life": "Reading sheet 12 of 38"; the time left is "Appended once 3 sheets
are done and the rate is steady: ', about 3 min left'". After Read again the read job runs again with
its completed steps skipped (09's jobs: a skipped step reports no progress), so the new run's first
step is the sheet the cancel stopped. The sheets done in the cancelled run are not the new run's:
its "3 sheets done" and its rate are its own sheets'.

The read job is played on 09's StepStore as a job runs its steps (each sheet's step reported as it
starts, `progress`, with the clock it is given, and kept once done, `record`); cancel and Read again
are the API's. Every file name and person here is invented.
"""

import hashlib
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

import pytest
from django.db import connection
from django.utils import timezone

from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.drawings.services.reads import ReadStepStore
from vextrus.platform.services import jobs
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

SHEETS = 20
STOPPED_AT = 12
"""The cancel stops the first run while it reads sheet 12: sheets 1 to 11 are kept."""


def row(project: QsProject, file_id: uuid.UUID) -> tuple[str, dict[str, Any]]:
    """The file's row as the Drawing Set's list sends it: its state and its words."""
    response = api_as(project.member).get(f"/api/projects/{project.project_id}/drawings/files")
    assert response.status_code == 200, response.content
    [found] = [f for f in response.json()["files"] if f["id"] == str(file_id)]
    return found["state"], found["status"]


def reaches(project: QsProject, file_id: uuid.UUID, position: int, at: datetime) -> None:
    """The read job starts sheet `position` at `at`, the sheet before it kept as done."""
    with project.member.acting():
        if position > 1:
            done = services.sheet_step(position - 1)
            key = jobs.StepKey(file_id, done, hashlib.sha256(done.encode()).hexdigest())
            if services.step_store().completed(key) is None:
                services.step_store().record(key, {"sheet": position - 1})
        ReadStepStore(clock=lambda: at).progress(
            file_id, jobs.Progress(position, SHEETS + 4, services.sheet_step(position))
        )


@pytest.fixture
def now(monkeypatch: pytest.MonkeyPatch) -> Callable[[datetime], None]:
    """Fixes "now" for the row's words, so they never depend on how long the test takes."""

    def fix(at: datetime) -> None:
        monkeypatch.setattr(timezone, "now", lambda: at)

    return fix


def cancelled_at_sheet_12_then_read_again(
    project: QsProject, now: Callable[[datetime], None]
) -> tuple[uuid.UUID, datetime]:
    """A DWG of 20 sheets read at a minute a sheet up to sheet 12, cancelled, and read again: the
    file and the moment Read again was pressed."""
    found = add(project.member, project.project_id, "RA-STR-R1.dwg", drawing()).file
    read_dwg(project.member, found.id, [f"S-{n:02d}" for n in range(1, SHEETS + 1)], mark_read=False)
    start = timezone.now() - timedelta(hours=2)
    for position in range(1, STOPPED_AT + 1):
        reaches(project, found.id, position, start + timedelta(minutes=position - 1))
    now(start + timedelta(minutes=STOPPED_AT - 1))
    first_run = row(project, found.id)
    assert first_run[0] == "reading"
    assert first_run[1]["code"] == "drawings.files.reading_sheet_left", first_run
    client = api_as(project.member)
    base = f"/api/projects/{project.project_id}/drawings/files/{found.id}"
    cancelled = client.post(f"{base}/cancel")
    assert (cancelled.status_code, cancelled.json()["state"]) == (200, "cancelled"), cancelled.content
    again = client.post(f"{base}/restart")
    assert again.status_code == 200, again.content
    return found.id, start + timedelta(minutes=30)


def test_read_again_waits_with_no_step_or_count_from_the_cancelled_run(
    qs_project: QsProject, now: Callable[[datetime], None]
) -> None:
    file_id, pressed = cancelled_at_sheet_12_then_read_again(qs_project, now)
    now(pressed)

    assert row(qs_project, file_id) == ("waiting", said.WAITING(ahead=0))


def test_the_new_runs_first_step_is_shown_with_no_time_left(
    qs_project: QsProject, now: Callable[[datetime], None]
) -> None:
    file_id, pressed = cancelled_at_sheet_12_then_read_again(qs_project, now)
    reaches(qs_project, file_id, STOPPED_AT, pressed)
    now(pressed)

    assert row(qs_project, file_id) == (
        "reading",
        said.READING_SHEET(position=STOPPED_AT, total=SHEETS),
    )


def test_no_time_left_until_the_new_run_has_read_three_sheets(
    qs_project: QsProject, now: Callable[[datetime], None]
) -> None:
    file_id, pressed = cancelled_at_sheet_12_then_read_again(qs_project, now)
    # The new run reads a sheet every 2 minutes: sheets 12 and 13 done, sheet 14 just started.
    for n, position in enumerate((12, 13, 14)):
        reaches(qs_project, file_id, position, pressed + timedelta(minutes=2 * n))
    now(pressed + timedelta(minutes=4))

    assert row(qs_project, file_id) == ("reading", said.READING_SHEET(position=14, total=SHEETS))


def test_the_time_left_is_the_new_runs_own_rate(
    qs_project: QsProject, now: Callable[[datetime], None]
) -> None:
    file_id, pressed = cancelled_at_sheet_12_then_read_again(qs_project, now)
    # Sheets 12, 13 and 14 read at 2 minutes each in the new run; sheet 15 just started: 6 sheets
    # left (15 to 20) at 2 minutes each.
    for n, position in enumerate((12, 13, 14, 15)):
        reaches(qs_project, file_id, position, pressed + timedelta(minutes=2 * n))
    now(pressed + timedelta(minutes=6))

    assert row(qs_project, file_id) == (
        "reading",
        said.READING_SHEET_LEFT(position=15, total=SHEETS, minutes=12),
    )


# The Finishing step (#440) ------------------------------------------------------------------------

FINISHING = {"code": "drawings.files.finishing", "params": {}}


def job_says(monkeypatch: pytest.MonkeyPatch, status: str) -> None:
    monkeypatch.setattr(
        jobs, "state", lambda job_id: jobs.JobState(job_id, "read", status, 1, 3, said.READ())
    )


def given_a_job(member: Member, file_id: uuid.UUID) -> None:
    with member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "update drawings_drawingfile set read_job_id = 7, read_status = 'reading' where id = %s",
            [file_id],
        )


def a_dwg_at_its_last_step(project: QsProject, name: str) -> uuid.UUID:
    found = add(project.member, project.project_id, name, drawing()).file
    read_dwg(project.member, found.id, ["S-21", "S-22", "S-23"], mark_read=False)
    given_a_job(project.member, found.id)
    return found.id


def test_a_dwg_whose_job_runs_its_finishing_step_is_listed_reading_finishing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = a_dwg_at_its_last_step(qs_project, "FN-STR-R1.dwg")
    job_says(monkeypatch, "running")
    with qs_project.member.acting():
        services.step_store().progress(file_id, jobs.Progress(6, 7, services.FINISHING))

    assert row(qs_project, file_id) == ("reading", FINISHING)


def test_a_dwg_whose_job_ended_before_its_row_is_listed_reading_finishing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = a_dwg_at_its_last_step(qs_project, "FN-ARC-R1.dwg")
    with qs_project.member.acting():
        services.step_store().progress(file_id, jobs.Progress(5, 7, services.sheet_step(3)))
    job_says(monkeypatch, "done")

    assert row(qs_project, file_id) == ("reading", FINISHING)


def test_a_dwg_reading_its_last_sheet_is_not_yet_finishing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = a_dwg_at_its_last_step(qs_project, "FN-ELE-R1.dwg")
    job_says(monkeypatch, "running")
    with qs_project.member.acting():
        services.step_store().progress(file_id, jobs.Progress(5, 7, services.sheet_step(3)))

    assert row(qs_project, file_id) == ("reading", said.READING_SHEET(position=3, total=3))
