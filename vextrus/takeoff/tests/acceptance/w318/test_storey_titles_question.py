"""T-W318's acceptance, part C: Step 1 runs the storey-titles Check (19b,
`engine/check/storey_titles.py`; M0.md: "Storey in the title against storeys in the view titles on the
same sheet") and asks what it finds as one Question per Discipline, not one per Sheet (the owner's
ruling of 5 Oct 2026, #229's model: "one Question per Discipline's gaps"); a View keeps where its
storeys came from; each Proposal gives the storeys its Sheet's title states, as keys.

The seam: sheets and views recorded through `drawings.record_sheets` / `drawings.record_views`, then
`read_propose.proposals.set_questions(project_id)` as the read job calls it, then the API
`GET /api/projects/{id}/takeoff/step1/questions` and `/proposals` as the QS. The names fixed by the
ticket: the code `engine.storey_titles.differs` (params `discipline`, `count`, `sheet`, `named`,
`stated`, `not_drawn`, `not_named`; the last five the first disagreeing Sheet's), kind `check` with
`check_code` `storey_titles`, options `plans_right`, `title_right`, `keep_open` (none picked), the
View field `storeys_source` (`"sheet_title"` or null) and the Proposal field `storeys_titled`. Every
number, title and storey word is invented.

    uv run pytest vextrus/takeoff/tests/acceptance/w318
"""

import uuid
from typing import Any

import pytest

from engine.recognise.types import Box, StoreysMeaning, ViewCandidate, ViewKind
from vextrus.takeoff.models import CheckRun
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

from .storey_set import CHECK, CODE, OPTIONS, Plan, Sheet, ask, record, redraw

pytestmark = pytest.mark.django_db

FLOOR_TO_FLOOR = StoreysMeaning.FLOOR_TO_FLOOR


def step1(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


def proposals(qs: QsProject) -> list[dict[str, Any]]:
    response = api_as(qs.member).get(f"{step1(qs.project_id)}/proposals")
    assert response.status_code == 200, response.content
    listed: list[dict[str, Any]] = response.json()["proposals"]
    return listed


def of_number(qs: QsProject, number: str) -> dict[str, Any]:
    (found,) = [p for p in proposals(qs) if p["number"] == number]
    return found


def asked(qs: QsProject) -> list[dict[str, Any]]:
    """Every Step 1 Question of the new code, open or not."""
    response = api_as(qs.member).get(f"{step1(qs.project_id)}/questions")
    assert response.status_code == 200, response.content
    return [q for q in response.json()["questions"] if q["code"] == CODE]


def open_asked(qs: QsProject) -> list[dict[str, Any]]:
    return [q for q in asked(qs) if q["status"] == "open"]


def answer(qs: QsProject, question_id: str, option: str) -> Any:
    return api_as(qs.member).post(
        f"{step1(qs.project_id)}/questions/{question_id}/answer", {"option": option}
    )


def last_run(qs: QsProject) -> CheckRun:
    with qs.member.acting():
        found = (
            CheckRun.objects.filter(project_id=qs.project_id, check_key=CHECK).order_by("-at").first()
        )
    assert found is not None, "the storey-titles Check's run is recorded"
    return found


def disagreeing(number: str, discipline: str | None = "structural") -> Sheet:
    """A Sheet whose title states the 1st, 5th and 7th floors above a plan of the 1st, 4th and 7th:
    one storey no plan draws, one on the plan the title does not name."""
    plan = Plan(("floor_1", "floor_4", "floor_7"), title="1ST, 4TH & 7TH FLOOR RIB LAYOUT PLAN")
    return Sheet(number, "1ST, 5TH & 7TH FLOOR", (plan,), discipline=discipline)


# One Question per Discipline ---------------------------------------------------------------------------


def test_a_title_its_plan_contradicts_raises_one_check_question(qs_project: QsProject) -> None:
    """C1: one disagreeing Sheet -> exactly one open Question of the code, of its Discipline, holding
    its Proposal, with the Sheet's counts and words; options none picked."""
    record(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", [disagreeing("S-41")])
    ask(qs_project.member, qs_project.project_id)

    [q] = open_asked(qs_project)

    assert q["kind"] == "check"
    assert q["check_code"] == CHECK
    assert q["discipline"] == "structural"
    assert q["proposals"] == [of_number(qs_project, "S-41")["id"]]
    params = q["params"]
    assert (params["discipline"], params["count"]) == ("structural", 1)
    assert (params["sheet"], params["named"], params["stated"]) == (
        "S-41",
        "number",
        "1ST, 5TH & 7TH FLOOR",
    )
    assert (params["not_drawn"], params["not_named"]) == (1, 1)
    assert [o["key"] for o in q["options"]] == OPTIONS
    assert [o["key"] for o in q["options"] if o.get("picked")] == []


def test_disagreeing_sheets_are_asked_once_per_discipline(qs_project: QsProject) -> None:
    """C2: five disagreeing structural Sheets and one architectural -> two Questions: the structural
    one counting five and holding their five Proposals, the architectural one counting one."""
    member, project_id = qs_project.member, qs_project.project_id
    numbers = [f"S-4{n}" for n in range(1, 6)]
    record(member, project_id, "KR-STR-R0.dwg", [disagreeing(n) for n in numbers])
    record(member, project_id, "KR-ARC-R0.dwg", [disagreeing("A-52", "architectural")])
    ask(member, project_id)

    found = {q["discipline"]: q for q in open_asked(qs_project)}

    assert set(found) == {"structural", "architectural"}
    assert found["structural"]["params"]["count"] == 5
    held = {of_number(qs_project, n)["id"] for n in numbers}
    assert set(found["structural"]["proposals"]) == held
    assert len(found["structural"]["proposals"]) == 5
    assert found["architectural"]["params"]["count"] == 1
    assert found["architectural"]["proposals"] == [of_number(qs_project, "A-52")["id"]]


AGREEING = [
    Sheet(
        "S-61",
        "3RD & 4TH FLOOR",
        (
            Plan(("floor_3",), title="3RD FLOOR RIB LAYOUT PLAN", subject="slab"),
            Plan(("floor_4",), title="4TH FLOOR RIB LAYOUT PLAN", subject="slab"),
        ),
    ),
    Sheet("S-62", "8TH FLOOR", (Plan(("floor_8",), subject="beam", source="sheet_title"),)),
    Sheet(
        "S-63",
        "1ST TO TOP FLOOR",
        (
            Plan(
                tuple(f"floor_{n}" for n in range(1, 10)),
                meaning=FLOOR_TO_FLOOR,
                subject="column",
                title="COLUMN LAYOUT PLAN 1ST TO 9TH FLOOR",
            ),
        ),
    ),
    Sheet("S-64", "2ND FLOOR", (Plan(kind=ViewKind.SECTION, title="SECTION Q-Q"),)),
]
"""Sheets the Check passes or leaves out: plans that agree with the title; a plan that took its
Sheet's storeys; "1st to top floor" over plans of the 1st to 9th (a symbolic storey alone never
fires); a Sheet with no plan View (it sits out)."""


def test_titles_their_plans_agree_with_raise_nothing_and_the_run_is_recorded(
    qs_project: QsProject,
) -> None:
    """C3: no Question; the Check's run recorded with every examined Sheet passed (three: the Sheet
    with no plan View is not examined)."""
    record(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", AGREEING)
    ask(qs_project.member, qs_project.project_id)

    assert asked(qs_project) == []
    run = last_run(qs_project)
    assert (run.passed, run.total) == (3, 3)


def test_a_sheet_with_no_discipline_raises_no_question(qs_project: QsProject) -> None:
    """C3: a disagreeing Sheet with no Discipline is asked about by no Discipline's Question."""
    record(
        qs_project.member, qs_project.project_id, "KR-MISC.dwg", [disagreeing("X-7", discipline=None)]
    )
    assert of_number(qs_project, "X-7")["discipline"] is None
    ask(qs_project.member, qs_project.project_id)

    assert open_asked(qs_project) == []


# Asked again, retired, decided -------------------------------------------------------------------------


def test_asking_twice_keeps_one_question_and_a_corrected_plan_withdraws_it(
    qs_project: QsProject,
) -> None:
    """C4: `set_questions` twice -> still one Question; the plan read again with the title's storeys
    and the Questions asked again -> it is withdrawn, no longer open."""
    member, project_id = qs_project.member, qs_project.project_id
    [sheet_id] = record(member, project_id, "KR-STR-R0.dwg", [disagreeing("S-41")])
    ask(member, project_id)
    ask(member, project_id)
    [first] = open_asked(qs_project)
    assert len(asked(qs_project)) == 1

    corrected = Plan(("floor_1", "floor_5", "floor_7"), title="1ST, 5TH & 7TH FLOOR RIB LAYOUT PLAN")
    redraw(member, sheet_id, 0, [corrected])
    ask(member, project_id)

    assert open_asked(qs_project) == []
    (after,) = (q for q in asked(qs_project) if q["id"] == first["id"])
    assert after["status"] == "withdrawn"


def test_a_confirmed_sheet_is_not_held(qs_project: QsProject) -> None:
    """C5: of two disagreeing Sheets, the one already confirmed is not in the Question's holds."""
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "KR-STR-R0.dwg", [disagreeing("S-41"), disagreeing("S-42")])
    decided = of_number(qs_project, "S-41")["id"]
    confirmed = api_as(member).post(f"{step1(project_id)}/confirm", {"proposals": [decided]})
    assert confirmed.status_code == 200, confirmed.content
    ask(member, project_id)

    [q] = open_asked(qs_project)

    assert q["proposals"] == [of_number(qs_project, "S-42")["id"]]
    assert q["params"]["count"] == 1


def test_a_question_whose_disagreeing_sheets_are_all_decided_is_not_asked(qs_project: QsProject) -> None:
    """C5: the only disagreeing Sheet is confirmed: nothing to ask."""
    member, project_id = qs_project.member, qs_project.project_id
    record(member, project_id, "KR-STR-R0.dwg", [disagreeing("S-41")])
    decided = of_number(qs_project, "S-41")["id"]
    confirmed = api_as(member).post(f"{step1(project_id)}/confirm", {"proposals": [decided]})
    assert confirmed.status_code == 200, confirmed.content
    ask(member, project_id)

    assert open_asked(qs_project) == []


# Answers -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize("option", ["plans_right", "title_right"])
def test_an_answer_is_recorded_and_changes_no_proposal_and_no_storey(
    qs_project: QsProject, option: str
) -> None:
    """C6: either answer is recorded under the QS's name and decides nothing: the QS corrects a plan's
    storeys in the inspector (story 28)."""
    record(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", [disagreeing("S-41")])
    ask(qs_project.member, qs_project.project_id)
    [q] = open_asked(qs_project)
    before = of_number(qs_project, "S-41")

    response = answer(qs_project, q["id"], option)

    assert response.status_code == 200, response.content
    [after_q] = [x for x in asked(qs_project) if x["id"] == q["id"]]
    assert after_q["status"] == "answered"
    assert after_q["answer"]["option"] == option
    assert after_q["answer"]["by"] == qs_project.member.user.name
    after = of_number(qs_project, "S-41")
    assert after["decision"] is None
    assert [v["storeys"] for v in after["views"]] == [v["storeys"] for v in before["views"]]


def test_keep_open_keeps_the_question_open(qs_project: QsProject) -> None:
    """C6: "Keep open, ask the consultant" keeps it open."""
    record(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", [disagreeing("S-41")])
    ask(qs_project.member, qs_project.project_id)
    [q] = open_asked(qs_project)

    response = answer(qs_project, q["id"], "keep_open")

    assert response.status_code == 200, response.content
    assert [x["id"] for x in open_asked(qs_project)] == [q["id"]]


def test_an_option_not_offered_is_refused(qs_project: QsProject) -> None:
    """C6: an option the Question does not offer is refused (400) and changes nothing."""
    record(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", [disagreeing("S-41")])
    ask(qs_project.member, qs_project.project_id)
    [q] = open_asked(qs_project)

    response = answer(qs_project, q["id"], "keep_all")

    assert response.status_code == 400, response.content
    assert [x["id"] for x in open_asked(qs_project)] == [q["id"]]


# The View's source, the Sheet's title storeys ----------------------------------------------------------


def test_a_views_storeys_source_comes_back_from_the_proposals_api(qs_project: QsProject) -> None:
    """C7: a View recorded with the Sheet title as its source comes back as `"sheet_title"`; one
    recorded without it as null."""
    record(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", [
        Sheet("S-71", "6TH FLOOR", (Plan(("floor_6",), subject="slab", source="sheet_title"),)),
        Sheet("S-72", "7TH FLOOR", (
            Plan(("floor_7",), subject="slab", title="7TH FLOOR RIB LAYOUT PLAN"),
        )),
    ])  # fmt: skip

    inherited = [v for v in of_number(qs_project, "S-71")["views"] if v["kind"] == "plan"]
    own = [v for v in of_number(qs_project, "S-72")["views"] if v["kind"] == "plan"]

    assert [(v["storeys"], v["storeys_source"]) for v in inherited] == [(["floor_6"], "sheet_title")]
    assert [(v["storeys"], v["storeys_source"]) for v in own] == [(["floor_7"], None)]
    block = [v for v in of_number(qs_project, "S-72")["views"] if v["kind"] == "title_block"]
    assert [v["storeys_source"] for v in block] == [None]


def test_a_source_with_no_storeys_is_refused_as_a_candidate() -> None:
    """C7: a source with no storeys is refused, as `ViewCandidate` refuses it."""
    given: dict[str, Any] = {
        "box": Box(0.0, 0.0, 10.0, 10.0),
        "kind": ViewKind.PLAN,
        "storeys_source": "sheet_title",
    }

    with pytest.raises(ValueError, match=r"(?i)storey"):
        ViewCandidate(**given)


def test_each_proposal_gives_its_sheet_titles_storeys_as_keys(qs_project: QsProject) -> None:
    """C8: `storeys_titled`, the keys the Sheet's stated title reads to (with where a range runs to),
    null when it states none or its words read to no key; for a Sheet with plan Views (inherited or
    not) and for one with none."""
    section = Plan(kind=ViewKind.SECTION, title="SECTION R-R")
    record(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", [
        Sheet("S-81", "3RD & 5TH FLOOR", (section,)),
        Sheet("S-82", "1ST TO TOP FLOOR", (section,)),
        Sheet("S-83", None, (section,)),
        Sheet("S-84", "LEVEL +2.10", (section,)),
        Sheet("S-85", "9TH FLOOR", (Plan(("floor_9",), subject="slab", source="sheet_title"),)),
        Sheet("S-86", "2ND & 6TH FLOOR", (
            Plan(("floor_2",), subject="slab", title="2ND FLOOR RIB LAYOUT PLAN"),
            Plan(("floor_6",), subject="slab", title="6TH FLOOR RIB LAYOUT PLAN"),
        )),
    ])  # fmt: skip

    titled = {p["number"]: p["storeys_titled"] for p in proposals(qs_project)}

    assert titled == {
        "S-81": ["floor_3", "floor_5"],
        "S-82": ["floor_1", "top"],
        "S-83": None,
        "S-84": None,
        "S-85": ["floor_9"],
        "S-86": ["floor_2", "floor_6"],
    }
