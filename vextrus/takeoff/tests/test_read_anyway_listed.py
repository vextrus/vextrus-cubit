"""#165 (W7): a held file answered "read anyway" joins the sheet list only with its Questions. Its
answer is kept at once, but its sheets are proposed and asked about only by its read job's last
step (`finishing`); on the real set the job took 40 s, and in that window its 28 sheets were listed
with no Question, so the QS saw a file read anyway that asked nothing. As a normal read's sheets are
listed in the transaction that asks their Questions (`files._finish`), so are a held file's.

The re-read is stopped before `finishing` by a font reader that fails (a fault the job's runner
tries again), leaving the file where the walk found it: answered, its sheets recorded, not finished.
"""

import uuid
from dataclasses import replace

import pytest

from engine.read import ReadArtefact
from engine.render.fonts import FontReport
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from .acceptance.t21c.step1_whole import (
    Sheet,
    a_file,
    answer,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    uploaded,
)

pytestmark = pytest.mark.django_db

NAME = "KR-PLB-R0.dwg"
SHEETS = [
    Sheet("P-01", "GROUND FLOOR PLUMBING PLAN", ("GROUND FLOOR PLUMBING PLAN",)),
    Sheet(None, "RISER DIAGRAM", ("RISER DIAGRAM",)),
    Sheet(None, "TOILET DETAILS", ("TOILET DETAIL",)),
]
"""Invented: two sheets with no number, a `missing` Question each once the file is proposed."""


class Interrupted(Exception):
    """The re-read's fault before its last step (a worker stopped, a bug): tried again later."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def held_and_answered(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: SHEETS}, held=[NAME]))
    api = api_as(qs.member)
    [q] = open_questions(api, qs.project_id, "file_misread")
    response = answer(api, qs.project_id, q["id"], "read_anyway")
    assert response.status_code == 200, response.content
    return file_id


def reread_stopped_before_finishing(
    qs: QsProject, file_id: uuid.UUID, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fails(_: ReadArtefact) -> FontReport:
        raise Interrupted

    stopped = replace(readers({NAME: SHEETS}, held=[NAME]), fonts=fails)
    with pytest.raises(Interrupted):
        run_job(qs.member, file_id, monkeypatch, stopped)


def test_a_held_file_read_anyway_lists_no_sheet_before_its_questions_are_asked(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_and_answered(qs_project, monkeypatch)
    reread_stopped_before_finishing(qs_project, file_id, monkeypatch)
    api = api_as(qs_project.member)
    assert open_questions(api, qs_project.project_id, "missing") == []

    assert [p for p in proposals(api, qs_project.project_id) if p["file_id"] == str(file_id)] == []
    assert a_file(api, qs_project.project_id, file_id)["sheets_found"] is None


def test_a_held_file_read_anyway_lists_its_sheets_with_their_questions_once_read(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_and_answered(qs_project, monkeypatch)
    reread_stopped_before_finishing(qs_project, file_id, monkeypatch)

    run_job(qs_project.member, file_id, monkeypatch, readers({NAME: SHEETS}, held=[NAME]))

    api = api_as(qs_project.member)
    listed = [p for p in proposals(api, qs_project.project_id) if p["file_id"] == str(file_id)]
    assert len(listed) == 3
    numberless = sorted((p["sheet_id"], (p["id"],)) for p in listed if p["number"] is None)
    missing = open_questions(api, qs_project.project_id, "missing")
    assert sorted((q["subject_id"], tuple(q["proposals"])) for q in missing) == numberless
    assert a_file(api, qs_project.project_id, file_id)["sheets_found"] == 3


# Round 1 (F2, F3): the file's row and report while it is read again, and a re-read that failed ----


def _job_says(monkeypatch: pytest.MonkeyPatch, status: str, *, attempt: int = 1) -> list[int]:
    """The file's job seen as `status` (the inline runner leaves its queued row as it was); answers
    the ids `jobs.restart` was asked to run again."""
    from vextrus.platform.services import jobs

    restarted: list[int] = []

    def state(job_id: int) -> jobs.JobState:
        return jobs.JobState(job_id, "read_file", status, attempt, 3, {"code": "x", "params": {}})

    def restart(job_id: int) -> int:
        restarted.append(job_id)
        return job_id + 1000

    def cancel(job_id: int) -> bool:
        return True

    monkeypatch.setattr(jobs, "cancel", cancel)
    monkeypatch.setattr(jobs, "state", state)
    monkeypatch.setattr(jobs, "restart", restart)
    return restarted


def _report(qs: QsProject, file_id: uuid.UUID) -> list[str]:
    from vextrus.drawings import services as drawings

    with qs.member.acting():
        return [m["code"] for m in drawings.report(file_id).readers]


def test_a_held_file_read_again_shows_as_reading_with_its_step_never_as_listed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_and_answered(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    queued = a_file(api, qs_project.project_id, file_id)
    reread_stopped_before_finishing(qs_project, file_id, monkeypatch)
    _job_says(monkeypatch, "running")

    running = a_file(api, qs_project.project_id, file_id)

    assert (queued["state"], queued["status"]["code"]) == ("waiting", "drawings.files.waiting")
    assert running["state"] == "reading"  # the web polls a reading row until it ends
    assert running["status"]["code"] == "drawings.files.finishing"  # its step, not "being read"
    assert _report(qs_project, file_id) == ["drawings.reports.read_anyway_pending"]


def test_a_held_file_read_anyway_is_held_with_its_sheets_once_its_read_ends(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_and_answered(qs_project, monkeypatch)
    run_job(qs_project.member, file_id, monkeypatch, readers({NAME: SHEETS}, held=[NAME]))
    _job_says(monkeypatch, "done")

    ended = a_file(api_as(qs_project.member), qs_project.project_id, file_id)

    assert (ended["state"], ended["status"]["code"]) == ("held", "drawings.files.held_read_anyway")
    assert ended["sheets_found"] == 3
    assert _report(qs_project, file_id) == ["drawings.reports.read_anyway"]


def test_a_held_file_whose_read_again_failed_says_so_and_is_tried_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_and_answered(qs_project, monkeypatch)
    reread_stopped_before_finishing(qs_project, file_id, monkeypatch)
    restarted = _job_says(monkeypatch, "failed", attempt=3)
    api = api_as(qs_project.member)

    failed = a_file(api, qs_project.project_id, file_id)
    again = api.post(f"/api/projects/{qs_project.project_id}/drawings/files/{file_id}/restart", {})

    assert (failed["state"], failed["status"]) == (
        "failed",
        {"code": "drawings.files.failed", "params": {"tries": 3}},
    )
    assert _report(qs_project, file_id) == ["drawings.reports.read_anyway_stopped"]
    assert again.status_code == 200, again.content
    assert len(restarted) == 1
    from vextrus.drawings import services as drawings

    with qs_project.member.acting():
        kept = drawings.file(file_id)
        answered = drawings.held_answer(file_id)
    assert kept.read_job_id == restarted[0] + 1000  # its job run again, its kept steps skipped
    assert answered == drawings.HeldAnswer.READ_ANYWAY  # still held, as its answer left it


def test_a_held_file_read_again_can_be_cancelled_and_stays_held(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The ux-critic's round: its row offers "Cancel reading" while it is read again; the act
    cancels its job and keeps who did it, and the file stays held (its answer kept)."""
    from vextrus.drawings import services as drawings

    file_id = held_and_answered(qs_project, monkeypatch)
    _job_says(monkeypatch, "running")
    api = api_as(qs_project.member)

    cancelled = api.post(f"/api/projects/{qs_project.project_id}/drawings/files/{file_id}/cancel", {})
    _job_says(monkeypatch, "cancelled")
    shown = a_file(api, qs_project.project_id, file_id)

    assert cancelled.status_code == 200, cancelled.content
    assert (shown["state"], shown["status"]["code"]) == ("cancelled", "drawings.files.cancelled")
    assert _report(qs_project, file_id) == ["drawings.reports.read_anyway_stopped"]
    with qs_project.member.acting():
        assert drawings.held_answer(file_id) == drawings.HeldAnswer.READ_ANYWAY


# Round 2: a re-read that ran out of memory says so; a stopping re-read is still being read -------


def test_a_held_file_whose_read_again_ran_out_of_memory_keeps_that_reason_until_tried_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    from vextrus.drawings import services as drawings
    from vextrus.takeoff.services.read_propose import files

    file_id = held_and_answered(qs_project, monkeypatch)

    def full(_: ReadArtefact) -> FontReport:
        raise MemoryError

    with pytest.raises(files.FileNotRead):
        run_job(
            qs_project.member,
            file_id,
            monkeypatch,
            replace(readers({NAME: SHEETS}, held=[NAME]), fonts=full),
        )
    _job_says(monkeypatch, "failed")
    api = api_as(qs_project.member)
    failed = a_file(api, qs_project.project_id, file_id)
    said = _report(qs_project, file_id)
    again = api.post(f"/api/projects/{qs_project.project_id}/drawings/files/{file_id}/restart", {})

    assert failed["state"] == "failed"
    assert failed["finding"] == {"code": "engine.read.limit_reached", "params": {"limit": "memory"}}
    assert said == ["engine.read.limit_reached"]
    assert again.status_code == 200, again.content
    assert again.json()["finding"]["code"] == "engine.decoders_agree.disagree"
    with qs_project.member.acting():
        assert drawings.held_answer(file_id) == drawings.HeldAnswer.READ_ANYWAY


def test_a_held_file_whose_read_again_is_stopping_is_still_said_to_be_read(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_and_answered(qs_project, monkeypatch)
    _job_says(monkeypatch, "stopping")

    shown = a_file(api_as(qs_project.member), qs_project.project_id, file_id)

    assert shown["state"] == "stopping"
    assert _report(qs_project, file_id) == ["drawings.reports.read_anyway_pending"]
