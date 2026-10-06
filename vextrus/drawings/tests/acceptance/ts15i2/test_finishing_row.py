"""S15-I2 (#440): the Drawing Set's row says when a DWG's read is in its Finishing step, so the page
can leave "Cancel reading" off it.

m0-screens 4.5, "Reading a DWG": "Opening the file" → … → "Reading sheet 12 of 38" → "Finishing". The
files list sends a file in that step as `reading` with the words `drawings.files.finishing`, both while
its read job runs the step and in the moment after the job ended before its row has (T-W327's
"Finishing moment", whose cancel is 409 `drawings.files.cancel_too_late`). The page's rule for the
row's acts (the web's acceptance, `web/src/acceptance/ts15i2/finishing.test.tsx`) rests on these words.

Every file name here is invented.
"""

import uuid
from typing import Any

import pytest
from django.db import connection

from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.platform.services import jobs
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

FINISHING = {"code": "drawings.files.finishing", "params": {}}


def listed(project: QsProject, file_id: uuid.UUID) -> tuple[str, dict[str, Any]]:
    response = api_as(project.member).get(f"/api/projects/{project.project_id}/drawings/files")
    assert response.status_code == 200, response.content
    [found] = [f for f in response.json()["files"] if f["id"] == str(file_id)]
    return found["state"], found["status"]


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

    assert listed(qs_project, file_id) == ("reading", FINISHING)


def test_a_dwg_whose_job_ended_before_its_row_is_listed_reading_finishing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = a_dwg_at_its_last_step(qs_project, "FN-ARC-R1.dwg")
    with qs_project.member.acting():
        services.step_store().progress(file_id, jobs.Progress(5, 7, services.sheet_step(3)))
    job_says(monkeypatch, "done")

    assert listed(qs_project, file_id) == ("reading", FINISHING)


def test_a_dwg_reading_its_last_sheet_is_not_yet_finishing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = a_dwg_at_its_last_step(qs_project, "FN-ELE-R1.dwg")
    job_says(monkeypatch, "running")
    with qs_project.member.acting():
        services.step_store().progress(file_id, jobs.Progress(5, 7, services.sheet_step(3)))

    assert listed(qs_project, file_id) == ("reading", said.READING_SHEET(position=3, total=3))
