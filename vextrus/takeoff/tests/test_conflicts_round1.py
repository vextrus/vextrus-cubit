"""#161's fix round 1: 19b compares every listed sheet, a decided one keeping a run's context, and
each Conflict is trimmed to its undecided sheets (F1); copies of a number one of which is confirmed
are no `same_number` Question (the refuter's 35); a Question the QS kept open hands that answer to
the Question that supersedes it (F2)."""

import uuid
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    exclude,
    jev_says,
    proposals,
    questions,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
STRUCTURAL_B = "KR-STR-B-R0.dwg"
THREE_S04 = [
    Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev=rev, date=date)
    for rev, date in (("R0", "02.08.2026"), ("R1", "14.08.2026"), ("R2", "30.08.2026"))
]
RUN = [
    Sheet(f"S-{n:02d}", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)) for n in (9, 10, 11)
]  # one title on consecutive numbers: a continuation, no conflict


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def open_conflicts(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    return [q for q in questions(api, project_id) if q["kind"] == "conflict" and q["status"] == "open"]


def of_number(api: Any, project_id: uuid.UUID, number: str) -> list[dict[str, Any]]:
    return sorted(
        (p for p in proposals(api, project_id) if p["number"] == number),
        key=lambda p: p["revision_mark"],
    )


@pytest.mark.parametrize("act", ["confirm", "exclude"])
def test_a_decided_sheet_in_the_middle_of_a_run_keeps_the_run_a_continuation(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, act: str
) -> None:
    """F1: S-09, S-10, S-11 all "COLUMN SCHEDULE"; S-10 decided, S-09 and S-11 are still a run, not
    a same_title Question."""
    read(qs_project, monkeypatch, STRUCTURAL, RUN)
    api = api_as(qs_project.member)
    assert open_conflicts(api, qs_project.project_id) == []
    [s10] = of_number(api, qs_project.project_id, "S-10")

    if act == "confirm":
        response = confirm(api, qs_project.project_id, [s10["id"]])
    else:
        response = exclude(api, qs_project.project_id, [s10["id"]], "for_information")
    assert response.status_code == 200, response.content
    read(qs_project, monkeypatch, STRUCTURAL_B, [Sheet("S-20", "BEAM SCHEDULE", ("BEAM SCHEDULE",))])

    assert open_conflicts(api, qs_project.project_id) == []


def test_three_copies_one_confirmed_by_hand_ask_no_same_number(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The refuter's 35: R2 confirmed by hand; R0 and R1 are no new "Two sheets are numbered S-04"
    (its "keep latest" would confirm R1 beside R2), and no open Question holds R2."""
    read(qs_project, monkeypatch, STRUCTURAL, THREE_S04)
    api = api_as(qs_project.member)
    r2 = of_number(api, qs_project.project_id, "S-04")[-1]
    assert r2["revision_mark"] == "R2"

    response = confirm(api, qs_project.project_id, [r2["id"]])

    assert response.status_code == 200, response.content
    assert open_conflicts(api, qs_project.project_id) == []


def test_three_copies_one_left_out_by_hand_ask_of_the_other_two(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """F1's trim: R0 left out; the Question is of R1 and R2, its words counting two."""
    read(qs_project, monkeypatch, STRUCTURAL, THREE_S04)
    api = api_as(qs_project.member)
    r0, r1, r2 = of_number(api, qs_project.project_id, "S-04")

    response = exclude(api, qs_project.project_id, [r0["id"]], "superseded")

    assert response.status_code == 200, response.content
    [q] = open_conflicts(api, qs_project.project_id)
    assert q["code"] == conflict_codes.SAME_NUMBER.code
    assert q["params"] == {"number": "S-04", "copies": 2}
    assert sorted(str(i) for i in q["proposals"]) == sorted([r1["id"], r2["id"]])


def test_a_question_kept_open_hands_its_answer_to_the_one_that_supersedes_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """F2: R0 and R1 kept open (ask the consultant); a later file brings R2: the Question of three
    is kept open as the QS said, not asked afresh."""
    read(qs_project, monkeypatch, STRUCTURAL, THREE_S04[:2])
    api = api_as(qs_project.member)
    [asked] = open_conflicts(api, qs_project.project_id)
    response = answer(api, qs_project.project_id, asked["id"], "keep_open")
    assert response.status_code == 200, response.content

    read(qs_project, monkeypatch, STRUCTURAL_B, THREE_S04[2:])

    [now] = open_conflicts(api, qs_project.project_id)
    assert now["params"]["copies"] == 3
    assert now["answer"]["option"] == "keep_open"
