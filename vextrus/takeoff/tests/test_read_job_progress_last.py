"""S15-A1: `step1.retire_questions` writes no progress row, so the read job writes Step 1's progress
rows itself, after the set's Questions round (`proposals.set_questions`): they count every Question
the round asked. Invented: two sheets of one number, a `same_number` conflict once proposed."""

import pytest

from vextrus.takeoff.library import SHEETS
from vextrus.takeoff.models import StepProgress
from vextrus.takeoff.services import step1
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from .acceptance.t21c.step1_whole import Sheet, jev_says, open_questions, readers, run_job, uploaded

pytestmark = pytest.mark.django_db

NAME = "KR-STR-R0.dwg"
DRAWN = [
    Sheet("S-01", "GROUND FLOOR PLAN", ("GROUND FLOOR PLAN",)),
    Sheet("S-01", "FIRST FLOOR PLAN", ("FIRST FLOOR PLAN",)),
]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def test_the_read_job_writes_progress_after_the_sets_questions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = uploaded(qs_project.member, qs_project.project_id, NAME)

    run_job(qs_project.member, file_id, monkeypatch, readers({NAME: DRAWN}))

    assert open_questions(api_as(qs_project.member), qs_project.project_id, "conflict")
    with qs_project.member.acting():
        stored = {
            row.discipline: (row.placed, row.total, row.open_questions, row.status)
            for row in StepProgress.objects.filter(
                project_id=qs_project.project_id, step=SHEETS, building_id=None
            )
        }
        counted = {
            r.discipline or "": (r.confirmed, r.total, r.open_questions, r.status)
            for r in step1.progress(qs_project.project_id).disciplines
        }
    assert stored == counted
    assert sum(questions for _n, _total, questions, _status in stored.values()) >= 1
