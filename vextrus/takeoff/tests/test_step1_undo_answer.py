"""Ticket 156, fix round 1, F2 (50): undo never takes back an act made by answering a Question.
The web's guard was per tab: after a reload, Ctrl Z took back the answer's confirm (then its
exclusion) and left the Question answered. The server refuses as `answer_stays`, and changes
nothing."""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    jev_says,
    open_questions,
    proposals,
    questions,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

NAME = "STR-SET.dwg"
DUPLICATE = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
]
REFUSED = {"code": "takeoff.step1.answer_stays", "params": {}}


def _answered(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> tuple[Any, str]:
    """S-02's two copies, their conflict answered `keep_latest` (R1 confirmed, R0 left out)."""
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: DUPLICATE}))
    api = api_as(qs.member)
    listed = api.post(
        f"{step1(qs.project_id)}/drawing-list",
        {"discipline": "structural", "text": "S-01 to S-02"},
    )
    assert listed.status_code == 200, listed.content
    [conflict] = open_questions(api, qs.project_id, "conflict")
    assert answer(api, qs.project_id, conflict["id"], "keep_latest").status_code == 200
    return api, conflict["id"]


def _state(api: Any, qs: QsProject, question: str) -> tuple[list[Any], str]:
    copies = sorted(
        (p["revision_mark"], p["decision"])
        for p in proposals(api, qs.project_id)
        if p["number"] == "S-02"
    )
    status = next(q["status"] for q in questions(api, qs.project_id) if q["id"] == question)
    return copies, status


def test_undo_after_an_answer_is_refused_and_changes_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    api, question = _answered(qs_project, monkeypatch)
    before = _state(api, qs_project, question)
    assert before == ([("R0", "excluded"), ("R1", "confirmed")], "answered")

    # As after a reload: a fresh tab knows nothing of the answer; both presses reach the server.
    for _ in range(2):
        response = api.post(f"{step1(qs_project.project_id)}/undo")
        assert (response.status_code, response.json()) == (409, REFUSED)

    assert _state(api, qs_project, question) == before


def test_an_act_after_the_answer_is_undone_then_the_answer_stays(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    api, question = _answered(qs_project, monkeypatch)
    s01 = the(proposals(api, qs_project.project_id), "S-01")
    assert confirm(api, qs_project.project_id, [s01["id"]]).status_code == 200

    first = api.post(f"{step1(qs_project.project_id)}/undo")
    assert first.status_code == 200, first.content
    assert the(proposals(api, qs_project.project_id), "S-01")["decision"] is None

    second = api.post(f"{step1(qs_project.project_id)}/undo")
    assert (second.status_code, second.json()) == (409, REFUSED)
    assert _state(api, qs_project, question) == ([("R0", "excluded"), ("R1", "confirmed")], "answered")
