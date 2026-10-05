"""Cancel on a file whose read ended well is too late (#331); the summary names a held file's sheets.

The three shapes of "ended well" (read; held and not read again; its job done) answer 409
`cancel_too_late`, and the three that did not end well (failed, refused, cancelled) are left as they
are. Every name here is invented.
"""

import uuid

import pytest
from django.db import connection

from engine.messages import Message
from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.platform.services import auth, jobs
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

SPLIT: Message = {"code": "engine.decoders_agree.disagree", "params": {}}


def refused_too_late(member: Member, file_id: uuid.UUID) -> None:
    with member.acting(), pytest.raises(auth.Refused) as refused:
        services.cancel(file_id, actor_name="Rafiq Hasan")
    assert (refused.value.status, refused.value.message) == (409, said.CANCEL_TOO_LATE())


def left_alone(member: Member, file_id: uuid.UUID) -> None:
    with member.acting():
        before = services.file(file_id)
        after = services.cancel(file_id, actor_name="Rafiq Hasan")
    assert (after.state, after.status) == (before.state, before.status)


def test_a_read_file_is_too_late(qs_project: QsProject) -> None:
    found = add(qs_project.member, qs_project.project_id, "ZB-ARC-R1.dwg", drawing()).file
    read_dwg(qs_project.member, found.id, ["A-07"])
    refused_too_late(qs_project.member, found.id)


def test_a_held_file_not_read_again_is_too_late(qs_project: QsProject) -> None:
    held = add(qs_project.member, qs_project.project_id, "ZB-STR-old.dwg", drawing()).file
    with qs_project.member.acting():
        services.quarantine(held.id, SPLIT)
    refused_too_late(qs_project.member, held.id)


def test_a_file_whose_job_is_done_is_too_late(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    found = add(qs_project.member, qs_project.project_id, "ZB-PLB-R2.dwg", drawing()).file
    with qs_project.member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "update drawings_drawingfile set read_job_id = 3, read_status = 'reading' where id = %s",
            [found.id],
        )
    monkeypatch.setattr(
        jobs, "state", lambda job_id: jobs.JobState(job_id, "read", "done", 2, 2, said.READ())
    )
    refused_too_late(qs_project.member, found.id)


def test_a_failed_a_refused_and_a_cancelled_file_are_left_as_they_are(qs_project: QsProject) -> None:
    member = qs_project.member
    failed = add(member, qs_project.project_id, "ZB-ELE-R0.dwg", drawing()).file
    scan = add(member, qs_project.project_id, "ZB-scan.pdf", drawing("pdf")).file
    waiting = add(member, qs_project.project_id, "ZB-MEC-R0.dwg", drawing()).file
    with member.acting():
        services.mark_failed(failed.id, {"code": "engine.read.reader_failed", "params": {}}, tries=1)
        services.record_reports(scan.id, upload_report=pdf_report(scan.sha256, 1, refused=True))
        services.cancel(waiting.id, actor_name="Rafiq Hasan")
    for found in (failed.id, scan.id, waiting.id):
        left_alone(member, found)


def test_the_summary_counts_a_held_files_sheets_in_both_numbers(qs_project: QsProject) -> None:
    member = qs_project.member
    read = add(member, qs_project.project_id, "ZB-ARC-R1.dwg", drawing()).file
    read_dwg(member, read.id, ["A-07"])
    held = add(member, qs_project.project_id, "ZB-STR-old.dwg", drawing()).file
    read_dwg(member, held.id, ["S-08", "S-09"], mark_read=False)
    with member.acting():
        services.quarantine(held.id, SPLIT)
        assert services.summary(services.files(read.set_id))["params"]["held_sheets"] == 0
        services.answer_held(held.id, "read_anyway")
        services.mark_read(held.id)
        params = services.summary(services.files(read.set_id))["params"]
    assert (params["sheets"], params["held_sheets"]) == (3, 2)
