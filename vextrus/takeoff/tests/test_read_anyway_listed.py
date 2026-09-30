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
