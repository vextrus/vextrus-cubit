"""One post-act function (S15-A1: "Each act reads the set once: set-wide reads and one post-act
function"): an act ends in one pass that keeps Step 1's progress rows, so the rows are written once
per act, never again by the Questions it retires, and still say what `step1.progress` counts.

On T-W319's invented Project at its smaller size (`tw319.cost`): three Disciplines, so three progress
rows."""

import pytest

from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose import proposals
from vextrus.testing.drawings import QsProject

from ..tw319.cost import SMALL, project_of
from .acts import (
    ACT_NAMES,
    ACTS,
    Act,
    OverHttp,
    captured,
    measured,
    progress_counted,
    progress_rows,
    progress_writes,
    stale_conflict,
)

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


@pytest.mark.parametrize("act", ACTS, ids=ACT_NAMES)
def test_an_act_writes_each_progress_row_once(qs_project: QsProject, act: Act) -> None:
    project = project_of(qs_project, SMALL)

    seen = measured(project, OverHttp(project), act)

    rows = len(progress_rows(project))
    writes = progress_writes(seen)
    assert rows == 3, progress_rows(project)
    assert writes <= rows, f"the progress rows were written {writes} times for {rows} rows"


@pytest.mark.parametrize("act", ACTS, ids=ACT_NAMES)
def test_after_an_act_the_progress_rows_say_what_progress_counts(
    qs_project: QsProject, act: Act
) -> None:
    project = project_of(qs_project, SMALL)

    measured(project, OverHttp(project), act)

    stored, counted = progress_rows(project), progress_counted(project)
    assert stored == counted, f"the progress rows say {stored}, progress counts {counted}"


def test_retiring_questions_writes_no_progress_row(qs_project: QsProject) -> None:
    project = project_of(qs_project, SMALL)
    stale = stale_conflict(project)

    with project.member.acting(), captured() as seen:
        retired = step1.retire_questions(project.project_id, proposals.CONFLICT_CODES, [])

    with project.member.acting():
        [question] = [q for q in step1.questions(project.project_id) if q.id == stale]
    assert (retired, question.status) == (1, "withdrawn")
    writes = progress_writes(seen)
    assert writes == 0, f"retiring Questions wrote the progress rows {writes} times"
