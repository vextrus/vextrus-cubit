"""S21-C2 (a): a sheet whose title block is a stale copy of its same-title partner's is asked once,
by the open `same_title` conflict, never again by a separate storey-titles Question.

The authority: the ticket S21-C2 (session 21, Train C), from G1's script layer on Train B's head ("one
Discipline raises 4 machine-doubt Questions, cap 3"): "fold storey_titles.differs into an open
same_title conflict when the sheet's title storeys equal its partner's plans (no separate
storey_titles Question then)". The rule, as the diagnosis states it: title storeys of X == plan
storeys of a same_title partner Y, != X's own plans. The conflict's answer settles it. The owner's
cap: at most 3 Questions per Discipline (Q5).

Shapes only: two consecutive sheets of one title whose title blocks state one pair of storeys; the
first's plans draw them, the second's plans draw two others (19b parts the pair as `same_title`, a
stale title block on the next sheet). Every number, title and storey word is invented.

The seam: sheets and views recorded through the drawings services and `set_questions` as the read job
calls it (`w318.storey_set`), then the API's Step 1 Questions as the QS; the Check's run as recorded
(`CheckRun`, `CheckFinding`), as w318 reads it.

Not pinned (no authority gives them): what answering the conflict does to the folded finding, and a
stale copy whose partner's conflict is no longer open.

    uv run pytest vextrus/takeoff/tests/acceptance/ts21c2
"""

import uuid
from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.takeoff.models import CheckFinding, CheckRun
from vextrus.takeoff.tests.acceptance.w318.storey_set import CHECK, CODE, Plan, Sheet, ask, record
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db

SAME_TITLE = "engine.conflicts.same_title"
FINDING = "engine.storey_titles.differ"
"""The Check's finding for one sheet (19b), as its run records it."""
ASKED_APART = "the stale copy asked apart from its same_title conflict"
"""What each red test says on a base that asks the stale copy by a storey-titles Question."""
ARCHITECTURAL = "architectural"
FILE = "KR-ARC-R0.dwg"
TITLE = "BLOCK ALPHA LAYOUT"
"""Both sheets' one title (invented)."""
STATED = "MEZZANINE & GROUND FLOOR"
"""Both title blocks' storeys (invented words, 13's keys `ground` and `mezzanine`)."""

DRAWS_THE_TITLE = Sheet(
    "A-31",
    STATED,
    (
        Plan(("ground",), title="PANEL KQ-1"),
        Plan(("mezzanine",), title="PANEL KQ-2"),
    ),
    title=TITLE,
    discipline=ARCHITECTURAL,
)
"""Y: its plans draw the storeys its title states."""
STALE_COPY = Sheet(
    "A-32",
    STATED,
    (
        Plan(("floor_2",), title="PANEL KQ-3"),
        Plan(("floor_3",), title="PANEL KQ-4"),
    ),
    title=TITLE,
    discipline=ARCHITECTURAL,
)
"""X, the next sheet: its title block states Y's plans' storeys; its own plans draw two others."""


def step1(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


def questions(qs: QsProject) -> list[dict[str, Any]]:
    response = api_as(qs.member).get(f"{step1(qs.project_id)}/questions")
    assert response.status_code == 200, response.content
    listed: list[dict[str, Any]] = response.json()["questions"]
    return listed


def open_of(qs: QsProject, code: str) -> list[dict[str, Any]]:
    return [q for q in questions(qs) if q["code"] == code and q["status"] == "open"]


def proposal_of(qs: QsProject, number: str) -> str:
    response = api_as(qs.member).get(f"{step1(qs.project_id)}/proposals")
    assert response.status_code == 200, response.content
    (found,) = [p for p in response.json()["proposals"] if p["number"] == number]
    found_id: str = found["id"]
    return found_id


def last_run(qs: QsProject) -> tuple[CheckRun, list[CheckFinding]]:
    with qs.member.acting():
        run = CheckRun.objects.filter(project_id=qs.project_id, check_key=CHECK).order_by("-at").first()
        assert run is not None, "the storey-titles Check's run is recorded"
        return run, list(CheckFinding.objects.filter(run=run))


def disagreeing(number: str) -> Sheet:
    """A sheet of its own title whose plans contradict it (w318's shape): no same-title partner."""
    plan = Plan(("floor_1", "floor_4", "floor_7"), title="PANEL KQ-7")
    return Sheet(
        number, "1ST, 5TH & 7TH FLOOR", (plan,), title="BLOCK BRAVO LAYOUT", discipline=ARCHITECTURAL
    )


def test_a_stale_copied_title_raises_no_storey_titles_question(qs_project: QsProject) -> None:
    """ "no separate storey_titles Question then": the pair is asked by its `same_title` conflict
    alone, which holds both sheets' Proposals."""
    record(qs_project.member, qs_project.project_id, FILE, [DRAWS_THE_TITLE, STALE_COPY])
    ask(qs_project.member, qs_project.project_id)

    [conflict] = open_of(qs_project, SAME_TITLE)
    assert sorted(conflict["proposals"]) == sorted(
        [proposal_of(qs_project, "A-31"), proposal_of(qs_project, "A-32")]
    )
    stray = [(q["discipline"], q["params"].get("count")) for q in open_of(qs_project, CODE)]
    assert stray == [], f"{ASKED_APART}: storey-titles Questions {stray}"


def test_the_stale_copys_disagreement_is_recorded_under_the_same_title_question(
    qs_project: QsProject,
) -> None:
    """ "fold storey_titles.differs into an open same_title conflict": the Check still finds the stale
    copy's title against its plans (one of two examined sheets passes), and its finding is held by
    the conflict's Question, whose answer settles it."""
    record(qs_project.member, qs_project.project_id, FILE, [DRAWS_THE_TITLE, STALE_COPY])
    ask(qs_project.member, qs_project.project_id)
    [conflict] = open_of(qs_project, SAME_TITLE)

    run, findings = last_run(qs_project)

    assert (run.passed, run.total) == (1, 2)
    [finding] = findings
    assert finding.message_code == FINDING
    assert [str(s) for s in finding.subject_ids] == [str(p) for p in _sheet_ids(qs_project, ["A-32"])]
    assert str(finding.question_id) == conflict["id"], f"{ASKED_APART}: held by another Question"


def test_another_disagreeing_sheet_of_the_discipline_is_still_asked_without_the_stale_copy(
    qs_project: QsProject,
) -> None:
    """The fold is narrow: a sheet of the same Discipline whose title its plans contradict, with no
    same-title partner, is still asked by one storey-titles Question, counting it alone and holding
    only its Proposal."""
    record(
        qs_project.member,
        qs_project.project_id,
        FILE,
        [DRAWS_THE_TITLE, STALE_COPY, disagreeing("A-52")],
    )
    ask(qs_project.member, qs_project.project_id)

    [q] = open_of(qs_project, CODE)

    assert q["discipline"] == ARCHITECTURAL
    assert q["params"]["count"] == 1, f"{ASKED_APART}: the Question counts {q['params']['count']}"
    assert (q["params"]["sheet"], q["params"]["named"]) == ("A-52", "number")
    assert q["proposals"] == [proposal_of(qs_project, "A-52")]


def test_a_same_title_pair_whose_title_names_neither_sheets_plans_is_still_asked(
    qs_project: QsProject,
) -> None:
    """The rule needs the title's storeys to equal the partner's plans: a same-title pair whose title
    states storeys neither sheet's plans draw (titled the 2nd, 6th and 9th over plans of the 2nd, 5th
    and 9th, and over a plan of the 8th) is no stale copy, so both are asked by the storey-titles
    Question beside the conflict."""
    stated = "2ND, 6TH & 9TH FLOOR"
    near = Sheet(
        "A-41",
        stated,
        (Plan(("floor_2", "floor_5", "floor_9"), title="PANEL KQ-5"),),
        title="BLOCK CHARLIE LAYOUT",
        discipline=ARCHITECTURAL,
    )
    other = Sheet(
        "A-42",
        stated,
        (Plan(("floor_8",), title="PANEL KQ-6"),),
        title="BLOCK CHARLIE LAYOUT",
        discipline=ARCHITECTURAL,
    )
    record(qs_project.member, qs_project.project_id, FILE, [near, other])
    ask(qs_project.member, qs_project.project_id)

    assert len(open_of(qs_project, SAME_TITLE)) == 1
    [q] = open_of(qs_project, CODE)
    assert q["params"]["count"] == 2
    assert sorted(q["proposals"]) == sorted(
        [proposal_of(qs_project, "A-41"), proposal_of(qs_project, "A-42")]
    )


def _sheet_ids(qs: QsProject, numbers: list[str]) -> list[uuid.UUID]:
    """The printed sheets' ids by number, as the drawings services list them."""
    with qs.member.acting():
        drawing_set = drawings.set_of(qs.project_id)
        assert drawing_set is not None
        by_number = {s.number: s.id for s in drawings.sheets(drawing_set.id)}
    return [by_number[n] for n in numbers]
