"""S27-G7 (#319): an answer's reply carries the Proposals it moved, so Step 1's screen can show the
answer without fetching the whole Proposals list again (session 26's G1 walk, M0-FL8 f-6: 2.7-4.2 s
from Enter to the Questions count on 218 sheets, the 643 KB list read again after each answer; the
triage's fix: "apply the answer's returned delta ... and refetch in the background").

The reply stays the answered Question (`Step1QuestionOut`), with one key more, `changed_proposals`:
each Proposal the answer confirmed or left out, exactly as `GET .../step1/proposals` lists it after the
answer, and no other. An answer that moves no sheet carries an empty list. The order is not pinned.

The Questions are 21c's, raised by the read job on invented sheets (../t21c/step1_whole.py).
"""

from typing import Any

import pytest

from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from ..t21c.step1_whole import (
    KEEP_OPEN,
    Sheet,
    answer,
    jev_says,
    keys,
    of_number,
    open_questions,
    proposals,
    readers,
    run_job,
    the,
    uploaded,
)

pytestmark = pytest.mark.django_db

KEY = "changed_proposals"

DUPLICATE = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
    Sheet("S-03", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
]
SAME_TITLE = [
    Sheet("S-01", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
    Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    Sheet("S-04", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
]
A_05 = Sheet("A-05", "SECTION A-A & ELEVATION", ("SECTION A-A", "FRONT ELEVATION"))


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet], name: str) -> None:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))


def by_id(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {r["id"]: r for r in rows}


def answered(qs: QsProject, kind: str, option_at: int) -> tuple[dict[str, Any], dict[str, Any]]:
    """The one open Question of `kind` answered with its option at `option_at`: it and the reply."""
    api = api_as(qs.member)
    [q] = open_questions(api, qs.project_id, kind)
    response = answer(api, qs.project_id, q["id"], keys(q)[option_at])
    assert response.status_code == 200, response.content
    return q, response.json()


def listed_now(qs: QsProject) -> dict[str, dict[str, Any]]:
    return by_id(proposals(api_as(qs.member), qs.project_id))


def test_keeping_the_latest_copy_replies_with_both_copies_as_the_list_now_shows_them(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5, option 1: keep the later revision, leave the other out as superseded."""
    read(qs_project, monkeypatch, DUPLICATE, "KR-STR-R0.dwg")
    q, reply = answered(qs_project, "conflict", 0)

    assert (reply["id"], reply["status"]) == (q["id"], "answered")
    moved = by_id(reply[KEY])
    now = listed_now(qs_project)
    copies = {p["id"] for p in of_number(list(now.values()), "S-02")}
    assert set(moved) == copies
    assert moved == {i: now[i] for i in copies}
    assert sorted(p["decision"] for p in moved.values()) == ["confirmed", "excluded"]


def test_keeping_all_copies_replies_with_every_sheet_it_confirmed_and_no_other(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, SAME_TITLE, "KR-STR-R0.dwg")
    q, reply = answered(qs_project, "conflict", 0)

    assert keys(q)[0] == "keep_all"
    moved = by_id(reply[KEY])
    now = listed_now(qs_project)
    held = {the(list(now.values()), n)["id"] for n in ("S-01", "S-04")}
    assert moved == {i: now[i] for i in held}
    assert {p["decision"] for p in moved.values()} == {"confirmed"}


def test_answering_a_kind_question_replies_with_the_sheet_it_confirmed_with_that_kind(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """#228: a kind Question is raised when Jev's top two are close; answering confirms its sheets."""
    jev_says(jev_offline, "0.34", second="0.30")
    read(qs_project, monkeypatch, [A_05], "KR-ARC-R0.dwg")
    q, reply = answered(qs_project, "low_confidence", 0)

    now = listed_now(qs_project)
    [held] = q["proposals"]
    assert by_id(reply[KEY]) == {held: now[held]}
    assert now[held]["decision"] == "confirmed"


def test_an_answer_that_moves_no_sheet_replies_with_an_empty_list(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """'Keep open, ask the consultant' keeps the Question open and decides nothing."""
    read(qs_project, monkeypatch, DUPLICATE, "KR-STR-R0.dwg")
    q, reply = answered(qs_project, "conflict", -1)

    assert keys(q)[-1] == KEEP_OPEN
    assert reply[KEY] == []
