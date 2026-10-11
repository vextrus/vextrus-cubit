"""S15-E3's acceptance, the Step 1 part: a storey Question the QS has answered is not asked again (#436's
review round 1, scored 70: "an answered storey Question is asked again").

Step 1 asks the storey-titles Check's findings as one `check` Question per Discipline (code
`engine.storey_titles.differs`, T-W318's tests in `vextrus/takeoff/tests/acceptance/w318`). The read
job and every later act ask the set's Questions again (`read_propose.proposals.set_questions`); once
the QS has answered, the same disagreement over the same Sheets is decided, and asking again must
neither re-open it nor raise a new open Question of the code.

The seam: sheets and views recorded through the drawings services and asked as the read job asks
(T-W318's `storey_set`), then the API `GET /api/projects/{id}/takeoff/step1/questions` and
`POST .../questions/{id}/answer` as the QS. Every number, title and storey word is invented.

    uv run pytest vextrus/takeoff/tests/acceptance/ts15e3 -rf
"""

import uuid
from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.w318.storey_set import CODE, Plan, Sheet, ask, record, redraw
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db

ANSWERS = ["plans_right", "title_right"]


def step1(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


def asked(qs: QsProject) -> list[dict[str, Any]]:
    """Every Step 1 Question of the storey-titles code, open or not."""
    response = api_as(qs.member).get(f"{step1(qs.project_id)}/questions")
    assert response.status_code == 200, response.content
    return [q for q in response.json()["questions"] if q["code"] == CODE]


def open_asked(qs: QsProject) -> list[dict[str, Any]]:
    return [q for q in asked(qs) if q["status"] == "open"]


PLAN = Plan(("floor_1", "floor_4", "floor_7"), title="1ST, 4TH & 7TH FLOOR RIB LAYOUT PLAN")


def disagreeing(number: str) -> Sheet:
    """A Sheet whose title states the 1st, 5th and 7th floors above a plan of the 1st, 4th and 7th."""
    return Sheet(number, "1ST, 5TH & 7TH FLOOR", (PLAN,))


def answered(qs: QsProject, option: str) -> tuple[uuid.UUID, dict[str, Any]]:
    """One disagreeing Sheet recorded and asked; its one Question answered with `option`."""
    [sheet_id] = record(qs.member, qs.project_id, "KR-STR-R0.dwg", [disagreeing("S-41")])
    ask(qs.member, qs.project_id)
    [question] = open_asked(qs)
    response = api_as(qs.member).post(
        f"{step1(qs.project_id)}/questions/{question['id']}/answer", {"option": option}
    )
    assert response.status_code == 200, response.content
    return sheet_id, question


@pytest.mark.parametrize("option", ANSWERS)
def test_an_answered_storey_question_is_not_asked_again(qs_project: QsProject, option: str) -> None:
    """The Questions asked again after the answer: no open Question of the code, the answered one
    still answered with the QS's option, and no second Question of the code."""
    _, question = answered(qs_project, option)

    ask(qs_project.member, qs_project.project_id)

    assert open_asked(qs_project) == []
    [after] = asked(qs_project)
    assert after["id"] == question["id"]
    assert after["status"] == "answered"
    assert after["answer"]["option"] == option


@pytest.mark.parametrize("option", ANSWERS)
def test_an_answered_storey_question_is_not_asked_again_when_its_sheet_is_read_again(
    qs_project: QsProject, option: str
) -> None:
    """The answered Sheet's Views read again as they were (a Read again of its file) and the Questions
    asked again: still nothing open of the code, and no second Question."""
    sheet_id, question = answered(qs_project, option)

    redraw(qs_project.member, sheet_id, 0, [PLAN])
    ask(qs_project.member, qs_project.project_id)

    assert open_asked(qs_project) == []
    assert [q["id"] for q in asked(qs_project)] == [question["id"]]


@pytest.mark.parametrize("option", ANSWERS)
def test_an_answered_storey_question_is_not_asked_again_after_one_of_its_sheets_is_confirmed(
    qs_project: QsProject, option: str
) -> None:
    """#436's round 1 finding: one Question over two disagreeing Sheets, answered; the QS confirms one
    of them and the Questions are asked again (as the next file's read asks them): the other Sheet's
    disagreement was answered with it, so nothing of the code is open again."""
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "KR-STR-R0.dwg", [disagreeing("S-41"), disagreeing("S-42")])
    ask(member, project_id)
    [question] = open_asked(qs_project)
    assert len(question["proposals"]) == 2
    response = api_as(member).post(
        f"{step1(project_id)}/questions/{question['id']}/answer", {"option": option}
    )
    assert response.status_code == 200, response.content
    listed = api_as(member).get(f"{step1(project_id)}/proposals").json()["proposals"]
    first = next(p["id"] for p in listed if p["number"] == "S-41")
    confirmed = api_as(member).post(f"{step1(project_id)}/confirm", {"proposals": [first]})
    assert confirmed.status_code == 200, confirmed.content

    record(member, project_id, "KR-ARC-R0.dwg", [Sheet("A-01", None, discipline="architectural")])
    ask(member, project_id)

    assert open_asked(qs_project) == []
