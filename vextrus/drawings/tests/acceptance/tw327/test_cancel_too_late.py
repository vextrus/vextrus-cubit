"""T-W327 (#331, G1 walk item FL3): "Cancel reading" on a file whose reading has already ended well
is told, not hidden.

The ticket's seam: `services.cancel(file_id, actor_name=...)` raises
`auth.Refused(said.CANCEL_TOO_LATE(), status=409)` for a file whose read has ended well, and the
cancel operation answers `409 {"code": "drawings.files.cancel_too_late", "params": {}}`. "Ended well":
the file is read; or held (any answer) and not being read again; or its read job is `done` while its
row has not yet ended (the "Finishing" moment). A file that failed, was cancelled or was refused keeps
today's answer (200, the file as it is, nothing written: a second click on Cancel stays harmless).

Every file name and person here is invented.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.db import connection

from engine.messages import Message
from vextrus.drawings import messages, services
from vextrus.drawings.messages import files as said
from vextrus.platform.services import auth, jobs
from vextrus.projects import services as projects
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

TOO_LATE: Message = {"code": "drawings.files.cancel_too_late", "params": {}}
"""`said.CANCEL_TOO_LATE()`, the seam this ticket adds."""
DISAGREE: Message = {"code": "engine.decoders_agree.disagree", "params": {}}


def at(project: QsProject, file_id: uuid.UUID) -> str:
    return f"/api/projects/{project.project_id}/drawings/files/{file_id}/cancel"


def cancels_recorded(member: Member, file_id: uuid.UUID) -> int:
    with member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "select count(*) from platform_domainevent where kind = %s and subject_id = %s",
            [said.READ_CANCELLED.code, file_id],
        )
        [(count,)] = cursor.fetchall()
    return int(count)


def row_of(member: Member, file_id: uuid.UUID) -> dict[str, Any]:
    with member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "select read_status, held_answer, cancelled_by, cancelled_by_name, cancelled_at"
            " from drawings_drawingfile where id = %s",
            [file_id],
        )
        [(status, answer, by, by_name, when)] = cursor.fetchall()
    return {
        "read_status": status,
        "held_answer": answer,
        "cancelled_by": by,
        "cancelled_by_name": by_name,
        "cancelled_at": when,
    }


def never_cancelled(member: Member, file_id: uuid.UUID) -> None:
    row = row_of(member, file_id)
    assert (row["cancelled_by"], row["cancelled_by_name"], row["cancelled_at"]) == (None, "", None)
    assert cancels_recorded(member, file_id) == 0


def job_says(monkeypatch: pytest.MonkeyPatch, status: str) -> None:
    """Every read job seen as `status`; `jobs.cancel` succeeds (it is never the point here)."""
    monkeypatch.setattr(
        jobs, "state", lambda job_id: jobs.JobState(job_id, "read", status, 1, 3, said.READ())
    )
    monkeypatch.setattr(jobs, "cancel", lambda job_id: True)


def given_a_job(member: Member, file_id: uuid.UUID, read_status: str | None = None) -> None:
    with member.acting(), connection.cursor() as cursor:
        if read_status is None:
            cursor.execute("update drawings_drawingfile set read_job_id = 7 where id = %s", [file_id])
        else:
            cursor.execute(
                "update drawings_drawingfile set read_job_id = 7, read_status = %s where id = %s",
                [read_status, file_id],
            )


# Case 1: a read file -------------------------------------------------------------------------------


def test_cancel_on_a_read_file_answers_409_cancel_too_late_and_leaves_it_read(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "MP-STR-R3.dwg", drawing()).file
    read_dwg(member, found.id, ["S-11", "S-12"])

    response = api_as(member).post(at(qs_project, found.id))

    assert (response.status_code, response.json()) == (409, TOO_LATE)
    with member.acting():
        after = services.file(found.id)
    assert (after.state, after.status["code"]) == ("read", "drawings.files.read")
    never_cancelled(member, found.id)


def test_the_service_refuses_a_cancel_on_a_read_file_with_cancel_too_late(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "MP-ARC-R3.dwg", drawing()).file
    read_dwg(member, found.id, ["A-21"])

    with member.acting(), pytest.raises(auth.Refused) as refused:
        services.cancel(found.id, actor_name="Tahmina Akter")

    assert (refused.value.status, refused.value.message) == (409, TOO_LATE)
    never_cancelled(member, found.id)


# Case 2: a held file -------------------------------------------------------------------------------


def test_cancel_on_a_held_file_with_no_answer_answers_409(qs_project: QsProject) -> None:
    member = qs_project.member
    held = add(member, qs_project.project_id, "MP-STR-old.dwg", drawing()).file
    with member.acting():
        services.quarantine(held.id, DISAGREE)

    response = api_as(member).post(at(qs_project, held.id))

    assert (response.status_code, response.json()) == (409, TOO_LATE)
    with member.acting():
        assert services.file(held.id).state == "held"
    never_cancelled(member, held.id)


def test_cancel_on_a_held_file_read_anyway_whose_read_ended_answers_409_and_keeps_it(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    held = add(member, qs_project.project_id, "MP-PLB-old.dwg", drawing()).file
    read_dwg(member, held.id, ["P-31", "P-32", "P-33"], mark_read=False)
    with member.acting():
        services.quarantine(held.id, DISAGREE)
        services.answer_held(held.id, "read_anyway")
        services.mark_read(held.id)  # its read again ended: its sheets are listed

    response = api_as(member).post(at(qs_project, held.id))

    assert (response.status_code, response.json()) == (409, TOO_LATE)
    with member.acting():
        after = services.file(held.id)
        answer = services.held_answer(held.id)
    assert (after.state, after.status["code"]) == ("held", "drawings.files.held_read_anyway")
    assert after.sheets_found == 3
    assert answer == services.HeldAnswer.READ_ANYWAY
    never_cancelled(member, held.id)


@pytest.mark.parametrize("answer", ["await_resaved", "sent_to_vextrus"])
def test_cancel_on_a_held_file_set_aside_answers_409(qs_project: QsProject, answer: str) -> None:
    member = qs_project.member
    held = add(member, qs_project.project_id, "MP-ELE-old.dwg", drawing()).file
    with member.acting():
        services.quarantine(held.id, DISAGREE)
        services.answer_held(held.id, answer)

    response = api_as(member).post(at(qs_project, held.id))

    assert (response.status_code, response.json()) == (409, TOO_LATE)
    never_cancelled(member, held.id)


# Case 3: the Finishing moment ----------------------------------------------------------------------


@pytest.mark.parametrize("kind", ["dwg", "pdf"])
def test_cancel_while_the_job_is_done_but_the_row_not_yet_ended_answers_409(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, kind: str
) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, f"MP-STR-R4.{kind}", drawing(kind)).file
    given_a_job(member, found.id, "reading")
    job_says(monkeypatch, "done")

    response = api_as(member).post(at(qs_project, found.id))

    assert (response.status_code, response.json()) == (409, TOO_LATE)
    assert row_of(member, found.id)["read_status"] == "reading"
    never_cancelled(member, found.id)


# Case 4: the walls that stay -----------------------------------------------------------------------


def test_a_waiting_file_is_cancelled_once_and_a_second_click_is_harmless(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    waiting = add(member, qs_project.project_id, "MP-MEC-R1.dwg", drawing()).file
    client = api_as(member)

    first = client.post(at(qs_project, waiting.id))
    second = client.post(at(qs_project, waiting.id))

    assert (first.status_code, first.json()["state"]) == (200, "cancelled")
    assert first.json()["status"]["code"] == "drawings.files.cancelled"
    assert (second.status_code, second.json()["status"]) == (200, first.json()["status"])
    assert cancels_recorded(member, waiting.id) == 1


def test_a_failed_file_and_a_refused_pdf_are_left_as_they_are(qs_project: QsProject) -> None:
    member = qs_project.member
    failed = add(member, qs_project.project_id, "MP-FIR-R2.dwg", drawing()).file
    scan = add(member, qs_project.project_id, "MP-FIR-scan.pdf", drawing("pdf")).file
    with member.acting():
        services.mark_failed(failed.id, {"code": "engine.read.reader_failed", "params": {}}, tries=2)
        services.record_reports(scan.id, upload_report=pdf_report(scan.sha256, 1, refused=True))
        before = {f.id: (f.state, f.status) for f in (services.file(failed.id), services.file(scan.id))}
    client = api_as(member)

    for found in (failed, scan):
        response = client.post(at(qs_project, found.id))
        assert response.status_code == 200, response.content
        assert (response.json()["state"], response.json()["status"]) == before[found.id]
        never_cancelled(member, found.id)
    assert before[failed.id][0] == "failed"
    assert before[scan.id][0] == "refused"


def test_a_held_file_being_read_again_is_cancelled_and_stays_held(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    member = qs_project.member
    held = add(member, qs_project.project_id, "MP-GAS-old.dwg", drawing()).file
    with member.acting():
        services.quarantine(held.id, DISAGREE)
        services.answer_held(held.id, "read_anyway")
    given_a_job(member, held.id)
    job_says(monkeypatch, "running")

    response = api_as(member).post(at(qs_project, held.id))

    assert response.status_code == 200, response.content
    row = row_of(member, held.id)
    assert (row["read_status"], row["held_answer"]) == ("quarantined", "read_anyway")
    assert row["cancelled_by_name"] == member.user.name
    assert cancels_recorded(member, held.id) == 1


@pytest.mark.parametrize("role", ["md", "guest"])
def test_the_md_and_a_guest_may_not_cancel_a_read_file(
    qs_project: QsProject, sign_in: Callable[..., Member], role: str
) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "MP-LFT-R0.dwg", drawing()).file
    read_dwg(member, found.id, ["L-01"])
    looker = api_as(sign_in(role=role, developer_id=member.developer_id))

    response = looker.post(at(qs_project, found.id))

    assert (response.status_code, response.json()) == (
        403,
        {"code": "platform.auth.not_allowed", "params": {"role": role}},
    )


def test_another_developers_read_file_is_not_found(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "MP-SAN-R0.dwg", drawing()).file
    read_dwg(member, found.id, ["SN-01"])
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code="ZX-4", name="Not theirs to see")
    client = api_as(stranger)

    for project_id in (theirs.id, qs_project.project_id):
        response = client.post(f"/api/projects/{project_id}/drawings/files/{found.id}/cancel")
        assert (response.status_code, response.json()) == (
            404,
            {"code": "platform.auth.not_found", "params": {}},
        )


# Case 5: the contract ------------------------------------------------------------------------------


def test_cancel_too_late_is_a_catalogued_code_with_no_params_and_no_event() -> None:
    held = {code.code: code for code in messages.codes()}

    assert "drawings.files.cancel_too_late" in held
    found = held["drawings.files.cancel_too_late"]
    assert (found.params, found.event) == ((), False)


# The schema's 409 for this operation: vextrus/tests/acceptance/ts15i2/test_cancel_contract.py (the
# OpenAPI schema is vextrus.api's, a layer drawings' tests may not import).
