"""S21-C2's builder tests: a stale copy's storey-titles finding folds into its `same_title` conflict
only while that conflict is open, and the conflict's answer settles it; a kind group is the unordered
pair of Jev's top two kinds. The acceptance cases are in `vextrus/takeoff/tests/acceptance/ts21c2/`;
their invented sets are reused here. Every number, title and storey word is invented.

    uv run pytest vextrus/takeoff/tests/test_stale_title_fold.py
"""

from typing import Any

import pytest
from django.utils import timezone

from vextrus.takeoff.models import CheckFinding, CheckRun, Question, QuestionStatus
from vextrus.takeoff.services.read_propose.proposals import kind_group
from vextrus.takeoff.tests.acceptance.w318.storey_set import (
    CHECK,
    CODE,
    Plan,
    Sheet,
    ask,
    record,
    redraw,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

SAME_TITLE = "engine.conflicts.same_title"
TITLE = "BLOCK DELTA LAYOUT"
STATED = "MEZZANINE & GROUND FLOOR"


def pair() -> list[Sheet]:
    """Y draws the storeys the shared title states; X, the next sheet, draws two others."""
    drawn = Sheet(
        "A-61",
        STATED,
        (Plan(("ground",), title="PANEL KZ-1"), Plan(("mezzanine",), title="PANEL KZ-2")),
        title=TITLE,
        discipline="architectural",
    )
    stale = Sheet(
        "A-62",
        STATED,
        (Plan(("floor_2",), title="PANEL KZ-3"), Plan(("floor_3",), title="PANEL KZ-4")),
        title=TITLE,
        discipline="architectural",
    )
    return [drawn, stale]


def listed(qs: QsProject) -> list[dict[str, Any]]:
    response = api_as(qs.member).get(f"/api/projects/{qs.project_id}/takeoff/step1/questions")
    assert response.status_code == 200, response.content
    found: list[dict[str, Any]] = response.json()["questions"]
    return found


def of(qs: QsProject, code: str) -> list[dict[str, Any]]:
    return [q for q in listed(qs) if q["code"] == code]


def answer(qs: QsProject, question_id: str, option: str) -> None:
    path = f"/api/projects/{qs.project_id}/takeoff/step1/questions/{question_id}/answer"
    response = api_as(qs.member).post(path, {"option": option})
    assert response.status_code == 200, response.content


def last_findings(qs: QsProject) -> list[CheckFinding]:
    with qs.member.acting():
        run = CheckRun.objects.filter(project_id=qs.project_id, check_key=CHECK).order_by("-at").first()
        assert run is not None
        return list(CheckFinding.objects.filter(run=run))


@pytest.mark.django_db
def test_the_conflicts_answer_settles_the_stale_copy_read_again(qs_project: QsProject) -> None:
    """Answered "keep all": read again, the stale copy is asked by no storey-titles Question, its
    finding still under the answered conflict."""
    record(qs_project.member, qs_project.project_id, "KZ-ARC-R0.dwg", pair())
    ask(qs_project.member, qs_project.project_id)
    [conflict] = of(qs_project, SAME_TITLE)
    answer(qs_project, conflict["id"], "keep_all")

    ask(qs_project.member, qs_project.project_id)

    assert of(qs_project, CODE) == []
    [finding] = last_findings(qs_project)
    assert str(finding.question_id) == conflict["id"]


@pytest.mark.django_db
def test_a_stale_copy_whose_conflict_is_answered_is_asked_by_the_storey_titles_question(
    qs_project: QsProject,
) -> None:
    """The fold needs the conflict open: the conflict answered while the stale copy stays undecided
    (set by hand: no answer of Step 1's leaves a held sheet so), then its plans redrawn (a
    disagreement the answer never saw), it is asked by the Discipline's storey-titles Question."""
    _, stale = record(qs_project.member, qs_project.project_id, "KZ-ARC-R0.dwg", pair())
    ask(qs_project.member, qs_project.project_id)
    [conflict] = of(qs_project, SAME_TITLE)
    with qs_project.member.acting():
        Question.objects.filter(id=conflict["id"]).update(
            status=QuestionStatus.ANSWERED,
            answer={"option": "keep_all", "by": "test"},
            answered_at=timezone.now(),
        )
    redraw(qs_project.member, stale, 1, [Plan(("floor_4",), title="PANEL KZ-5")])

    ask(qs_project.member, qs_project.project_id)

    [asked] = [q for q in of(qs_project, CODE) if q["status"] == "open"]
    assert (asked["params"]["sheet"], asked["params"]["count"]) == ("A-62", 1)
    [finding] = last_findings(qs_project)
    assert str(finding.question_id) == asked["id"]


@pytest.mark.django_db
def test_both_sheets_stale_copies_of_each_other_are_both_held_by_the_conflict(
    qs_project: QsProject,
) -> None:
    """Two sheets of one title whose title blocks each state the other's plans: both fold."""
    first = Sheet(
        "A-71",
        "6TH & 9TH FLOOR",
        (Plan(("floor_5",), title="PANEL KZ-6"), Plan(("floor_8",), title="PANEL KZ-7")),
        title=TITLE,
        discipline="architectural",
    )
    second = Sheet(
        "A-72",
        "5TH & 8TH FLOOR",
        (Plan(("floor_6",), title="PANEL KZ-8"), Plan(("floor_9",), title="PANEL KZ-9")),
        title=TITLE,
        discipline="architectural",
    )
    record(qs_project.member, qs_project.project_id, "KZ-ARC-R0.dwg", [first, second])
    ask(qs_project.member, qs_project.project_id)

    [conflict] = [q for q in of(qs_project, SAME_TITLE) if q["status"] == "open"]
    assert [q for q in of(qs_project, CODE) if q["status"] == "open"] == []
    assert sorted(str(f.question_id) for f in last_findings(qs_project)) == [conflict["id"]] * 2


def test_a_kind_group_is_the_unordered_pair_of_jevs_top_two() -> None:
    assert kind_group("structural", ["beam_layout", "beam_details", "other"]) == kind_group(
        "structural", ["beam_details", "beam_layout"]
    )
    assert kind_group("structural", ["beam_layout", "beam_details"]) != kind_group(
        "structural", ["beam_details", "column_schedule"]
    )
    assert kind_group("structural", ["beam_layout"]) == ["which_kind", "structural", "beam_layout"]
    assert kind_group(None, ["b", "a"]) == ["which_kind", "", "a", "b"]
