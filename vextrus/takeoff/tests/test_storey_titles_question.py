"""T-W318's builder tests: the storey-titles Check's run as Step 1 records it (each finding with its
sheet and the Question that asks it), a Discipline's Question asked again when its sheets change, and
`storeys_titled` read once per distinct wording. The acceptance cases are in
`vextrus/takeoff/tests/acceptance/w318/`; their invented sets are reused here. Every number, title and
storey word is invented.

    uv run pytest vextrus/takeoff/tests/test_storey_titles_question.py
"""

import pytest

from engine.recognise import storeys
from engine.recognise.types import ViewKind
from vextrus.takeoff.models import CheckFinding, CheckRun, Question
from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.w318.storey_set import CODE, Plan, Sheet, ask, record, redraw
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db


def disagreeing(number: str, discipline: str | None = "structural") -> Sheet:
    plan = Plan(("floor_2", "floor_6"), title="2ND & 6TH FLOOR WAFFLE SLAB PLAN")
    return Sheet(number, "2ND & 8TH FLOOR", (plan,), discipline=discipline)


def test_each_finding_is_recorded_with_its_sheet_and_the_question_asking_it(
    qs_project: QsProject,
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    ids = record(member, project_id, "QV-STR-R2.dwg", [disagreeing("Q-11")])
    ids += record(member, project_id, "QV-MISC.dwg", [disagreeing("X-12", discipline=None)])
    ask(member, project_id)

    with member.acting():
        run = CheckRun.objects.filter(project_id=project_id, check_key="storey_titles").get()
        found = {f.subject_ids[0]: f for f in CheckFinding.objects.filter(run=run)}
        (question,) = Question.objects.filter(project_id=project_id, message_code=CODE)
    assert (run.passed, run.total) == (0, 2)
    assert set(found) == {str(i) for i in ids}
    assert {f.message_code for f in found.values()} == {"engine.storey_titles.differ"}
    assert found[str(ids[0])].question_id == question.id
    assert found[str(ids[1])].question_id is None  # no Discipline: asked by none


def test_a_discipline_whose_disagreeing_sheets_change_is_asked_anew(qs_project: QsProject) -> None:
    """A second disagreeing sheet read later: the Discipline's Question counting two is asked, the one
    counting one withdrawn; still one open Question for the Discipline."""
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "QV-STR-R2.dwg", [disagreeing("Q-11")])
    ask(member, project_id)
    record(member, project_id, "QV-STR-R3.dwg", [disagreeing("Q-14")])
    ask(member, project_id)

    response = api_as(member).get(f"/api/projects/{project_id}/takeoff/step1/questions")
    ours = [q for q in response.json()["questions"] if q["code"] == CODE]
    by_status = {q["status"]: q for q in ours}

    assert sorted(q["status"] for q in ours) == ["open", "withdrawn"]
    assert by_status["open"]["params"]["count"] == 2
    assert len(by_status["open"]["proposals"]) == 2
    assert by_status["withdrawn"]["params"]["count"] == 1


def test_the_titles_storeys_are_read_once_per_distinct_wording(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    section = Plan(kind=ViewKind.SECTION, title="SECTION T-T")
    record(
        member,
        project_id,
        "QV-STR-R2.dwg",
        [Sheet(f"Q-2{n}", "3RD & 9TH FLOOR", (section,)) for n in range(4)]
        + [Sheet("Q-29", "ROOF", (section,)), Sheet("Q-30", None, (section,))],
    )
    read = storeys.read
    seen: list[str] = []

    def counted(text: str, *args: object, **kwargs: bool) -> storeys.Storeys:
        seen.append(text)
        return read(text, *args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(storeys, "read", counted)
    with member.acting():
        listed = step1.proposals(project_id)

    assert sorted(seen) == ["3RD & 9TH FLOOR", "ROOF"]
    titled = {p.number: p.storeys_titled for p in listed}
    assert titled["Q-20"] == ("floor_3", "floor_9")
    assert titled["Q-30"] is None


def test_a_question_asked_again_in_the_same_words_lets_go_of_a_sheet_that_now_agrees(
    qs_project: QsProject,
) -> None:
    """Two disagreeing sheets, then the second's plan corrected and a third found disagreeing: the
    count and the example are unchanged, yet the open Question holds the first and the third only
    (the one holding the second is withdrawn: a Question's holds are only ever added to)."""
    member, project_id = qs_project.member, qs_project.project_id
    first, second = record(
        member, project_id, "QV-STR-R2.dwg", [disagreeing("Q-11"), disagreeing("Q-12")]
    )
    ask(member, project_id)
    redraw(member, second, 1, [Plan(("floor_2", "floor_8"), title="2ND & 8TH FLOOR WAFFLE SLAB PLAN")])
    [third] = record(member, project_id, "QV-STR-R3.dwg", [disagreeing("Q-13")])
    ask(member, project_id)

    response = api_as(member).get(f"/api/projects/{project_id}/takeoff/step1/questions")
    ours = [q for q in response.json()["questions"] if q["code"] == CODE]
    [question] = [q for q in ours if q["status"] == "open"]
    ids = {p["sheet_id"]: p["id"] for p in proposals_of(qs_project)}

    assert sorted(q["status"] for q in ours) == ["open", "withdrawn"]
    assert question["params"]["count"] == 2
    assert set(question["proposals"]) == {ids[str(first)], ids[str(third)]}


def proposals_of(qs: QsProject) -> list[dict[str, str]]:
    response = api_as(qs.member).get(f"/api/projects/{qs.project_id}/takeoff/step1/proposals")
    listed: list[dict[str, str]] = response.json()["proposals"]
    return listed


def test_an_answered_question_never_takes_a_sheet_found_later(qs_project: QsProject) -> None:
    """Answered "the plans are right" over two sheets; then one is corrected and another found
    disagreeing with the same count and example: the answered Question keeps what it held, and the
    new sheet is asked by a new open Question."""
    member, project_id = qs_project.member, qs_project.project_id
    first, second = record(
        member, project_id, "QV-STR-R2.dwg", [disagreeing("Q-11"), disagreeing("Q-12")]
    )
    ask(member, project_id)
    questions = f"/api/projects/{project_id}/takeoff/step1/questions"
    [asked] = [q for q in api_as(member).get(questions).json()["questions"] if q["code"] == CODE]
    answered = api_as(member).post(f"{questions}/{asked['id']}/answer", {"option": "plans_right"})
    assert answered.status_code == 200, answered.content
    redraw(member, second, 1, [Plan(("floor_2", "floor_8"), title="2ND & 8TH FLOOR WAFFLE SLAB PLAN")])
    [third] = record(member, project_id, "QV-STR-R3.dwg", [disagreeing("Q-13")])
    ask(member, project_id)

    ours = {q["id"]: q for q in api_as(member).get(questions).json()["questions"] if q["code"] == CODE}
    ids = {p["sheet_id"]: p["id"] for p in proposals_of(qs_project)}

    assert ours[asked["id"]]["status"] == "answered"
    assert set(ours[asked["id"]]["proposals"]) == {ids[str(first)], ids[str(second)]}
    [now] = [q for q in ours.values() if q["status"] == "open"]
    assert set(now["proposals"]) == {ids[str(first)], ids[str(third)]}
