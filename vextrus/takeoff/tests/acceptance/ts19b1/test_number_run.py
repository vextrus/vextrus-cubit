"""S19-B1: the owner's ruling, session 18 (docs/rulings.md, `step1.second_source.no_list_no_pdf =
unbroken-number-run`): "Number run counts (Recommended)": when a Discipline has no drawing list and
no PDF, an unbroken run of sheet numbers counts as the second source; a sheet in that run with no open
Question can be confirmed in bulk.

The set: one structural DWG and nothing else (no drawing list drawn, none typed, no PDF), read by 21a's
read job with the readers given (ticket 21c's fixtures: invented sheets, number and title from each
sheet's title block). "Agrees" is `ProposalView.agrees` in `GET {step1}/proposals`; the bulk act is
`POST {step1}/confirm` naming more than one sheet (m0-screens 6.4).

The reading of "an unbroken run" pinned here (the acceptance writer's, for the orchestrator to check
against the ruling): a run is a maximal stretch of consecutive running numbers in one series of the
Discipline (S-01, S-02, S-03), two numbers or more; a gap ends one run and starts another, as a gap
holds only the sheets beside it (the owner's ruling, session 11, "gap local"); a lone number, with no
neighbour either side, is in no run and keeps one source. A sheet beside a gap is held by the open gap
Question while it is open (today's rule), and joins its run once that Question is answered.

Not pinned (no authority gives them): runs across series (S-01 beside SD-02), suffixed numbers
(S-04A), the run's words on the screen.
"""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
ONE_SOURCE = "takeoff.step1.one_source"
QUESTION_FIRST = "takeoff.step1.question_first"

TITLES = {
    1: "GENERAL NOTES",
    2: "PILE LAYOUT PLAN",
    3: "PILE CAP DETAILS",
    4: "COLUMN LAYOUT PLAN",
    5: "COLUMN SCHEDULE",
    6: "GRADE BEAM LAYOUT",
    7: "FIRST FLOOR BEAM LAYOUT",
    8: "FIRST FLOOR SLAB LAYOUT",
    9: "STAIR DETAILS",
    10: "LIFT CORE DETAILS",
}


def sheet(n: int, title: str | None = None, **kw: Any) -> Sheet:
    words = title if title is not None else TITLES[n]
    return Sheet(f"S-{n:02d}", words, (words,), **kw)


RUN = [sheet(n) for n in range(1, 6)]
"""S-01 to S-05: one unbroken run, no list, no PDF."""

HELD_IN_RUN = [
    sheet(1),
    sheet(2, "BEAM LAYOUT PLAN"),
    sheet(3),
    sheet(4, "BEAM LAYOUT PLAN"),
    sheet(5),
]
"""S-02 and S-04 of one title that do not run on: one open `conflict` Question holds both (t166's
SAME_TITLE, inside a run)."""

GAPPED = [sheet(n) for n in (1, 2, 3, 5, 6, 7, 10)]
"""S-04 missing, and S-08 and S-09: the runs S-01 to S-03 and S-05 to S-07; S-10 alone."""

TWICE = [
    sheet(1),
    sheet(2, rev="R1", date="14.09.2026"),
    sheet(2, rev="R0", date="02.08.2026"),
    sheet(3),
]
"""Two copies of S-02 in the run S-01 to S-03 (t166's DUPLICATE)."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> None:
    """The structural DWG alone, read by the read job (no PDF uploaded, no list drawn or typed)."""
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)
    run_job(qs.member, file_id, monkeypatch, readers({STRUCTURAL: sheets}))


def agrees(qs: QsProject) -> dict[str | None, bool]:
    return {p["number"]: p["agrees"] for p in proposals(api_as(qs.member), qs.project_id)}


def ids(qs: QsProject, numbers: list[str]) -> list[str]:
    listed = proposals(api_as(qs.member), qs.project_id)
    return [the(listed, n)["id"] for n in numbers]


def decisions(qs: QsProject) -> dict[str | None, str | None]:
    return {p["number"]: p["decision"] for p in proposals(api_as(qs.member), qs.project_id)}


def refused(response: Any) -> str:
    assert response.status_code == 409, (response.status_code, response.content)
    code: str = response.json()["code"]
    return code


# (1) An unbroken run is the second source -----------------------------------------------------------


def test_every_sheet_of_an_unbroken_run_agrees_with_no_list_and_no_pdf(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "When a Discipline has no drawing list and no PDF, an unbroken run of sheet numbers counts as
    the second source": S-01 to S-05, no open Question, every sheet agrees."""
    read(qs_project, monkeypatch, RUN)
    assert open_questions(api_as(qs_project.member), qs_project.project_id) == []

    assert agrees(qs_project) == dict.fromkeys(["S-01", "S-02", "S-03", "S-04", "S-05"], True)


def test_the_whole_run_is_confirmed_in_one_bulk_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "A sheet in that run with no open Question can be confirmed in bulk": one act naming all
    five is accepted (200) and confirms each."""
    read(qs_project, monkeypatch, RUN)
    numbers = ["S-01", "S-02", "S-03", "S-04", "S-05"]

    response = confirm(api_as(qs_project.member), qs_project.project_id, ids(qs_project, numbers))

    assert response.status_code == 200, response.content
    assert decisions(qs_project) == dict.fromkeys(numbers, "confirmed")


# (2) An open Question still holds a sheet of the run --------------------------------------------------


def test_a_run_sheet_an_open_question_holds_does_not_agree_and_the_rest_do(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "A sheet in that run with no open Question": S-02 and S-04, held by one open `conflict`
    Question, do not agree; S-01, S-03 and S-05 do."""
    read(qs_project, monkeypatch, HELD_IN_RUN)
    assert len(open_questions(api_as(qs_project.member), qs_project.project_id, "conflict")) == 1

    assert agrees(qs_project) == {
        "S-01": True, "S-02": False, "S-03": True, "S-04": False, "S-05": True,
    }  # fmt: skip


def test_a_bulk_act_naming_a_run_sheet_an_open_question_holds_is_refused_question_first(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The held sheet is refused as today (409 `question_first`), nothing confirmed; the sheets of
    the run no Question holds are confirmed in one act."""
    read(qs_project, monkeypatch, HELD_IN_RUN)
    api = api_as(qs_project.member)

    assert refused(confirm(api, qs_project.project_id, ids(qs_project, ["S-01", "S-02"]))) == (
        QUESTION_FIRST
    )
    assert set(decisions(qs_project).values()) == {None}

    free = ["S-01", "S-03", "S-05"]
    response = confirm(api, qs_project.project_id, ids(qs_project, free))
    assert response.status_code == 200, response.content
    assert {n: decisions(qs_project)[n] for n in free} == dict.fromkeys(free, "confirmed")


# (3) A gap ends a run; a lone number is in none -------------------------------------------------------


def test_a_gap_holds_the_sheets_beside_it_and_the_runs_either_side_still_agree(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With S-04, S-08 and S-09 missing and the gap Question open: S-03, S-05, S-07 and S-10 (beside
    a gap) do not agree; S-01, S-02 (run S-01 to S-03) and S-06 (run S-05 to S-07) do."""
    read(qs_project, monkeypatch, GAPPED)

    assert agrees(qs_project) == {
        "S-01": True, "S-02": True, "S-03": False, "S-05": False,
        "S-06": True, "S-07": False, "S-10": False,
    }  # fmt: skip


def test_once_the_gap_is_answered_each_run_agrees_and_a_lone_number_does_not(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The gap Question answered ("Not sent yet"): no open Question is left, every sheet of the runs
    S-01 to S-03 and S-05 to S-07 agrees, and S-10, with no neighbour either side, keeps one
    source."""
    read(qs_project, monkeypatch, GAPPED)
    api = api_as(qs_project.member)
    [gap] = open_questions(api, qs_project.project_id)
    assert answer(api, qs_project.project_id, gap["id"], "not_sent_yet").status_code == 200
    assert open_questions(api, qs_project.project_id) == []

    assert agrees(qs_project) == {
        "S-01": True, "S-02": True, "S-03": True, "S-05": True,
        "S-06": True, "S-07": True, "S-10": False,
    }  # fmt: skip


def test_a_bulk_act_naming_a_lone_number_is_refused_one_source(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The lone S-10 is never in the bulk act (409 `one_source`, today's code), nothing confirmed;
    the two runs, S-01 to S-03 and S-05 to S-07, are confirmed in one act."""
    read(qs_project, monkeypatch, GAPPED)
    api = api_as(qs_project.member)
    [gap] = open_questions(api, qs_project.project_id)
    assert answer(api, qs_project.project_id, gap["id"], "not_sent_yet").status_code == 200

    assert refused(confirm(api, qs_project.project_id, ids(qs_project, ["S-07", "S-10"]))) == (
        ONE_SOURCE
    )
    assert set(decisions(qs_project).values()) == {None}

    runs = ["S-01", "S-02", "S-03", "S-05", "S-06", "S-07"]
    response = confirm(api, qs_project.project_id, ids(qs_project, runs))
    assert response.status_code == 200, response.content
    assert decisions(qs_project) == {**dict.fromkeys(runs, "confirmed"), "S-10": None}


# (4) Two sheets of one number never agree, in a run or not --------------------------------------------


def test_two_sheets_of_one_number_in_a_run_never_agree(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "Two sheets of one number never agree" holds inside a run: both copies of S-02 have one
    source; S-01 and S-03, the run S-01 to S-03 unbroken, agree."""
    read(qs_project, monkeypatch, TWICE)

    listed = proposals(api_as(qs_project.member), qs_project.project_id)
    copies = [p["agrees"] for p in listed if p["number"] == "S-02"]
    assert copies == [False, False]
    assert (the(listed, "S-01")["agrees"], the(listed, "S-03")["agrees"]) == (True, True)
