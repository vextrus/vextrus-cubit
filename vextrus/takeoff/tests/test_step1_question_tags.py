"""Ticket 156, fix round 2, M1: a Question's tag is fixed for life. The web numbered Questions by
their place in the open queue, so answering one renumbered the rest (the toast said Q1, the
Answered list then Q5). The server now gives each its place in the order raised (`raised`)."""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    jev_says,
    open_questions,
    questions,
    readers,
    run_job,
    step1,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

NAME = "STR-SET.dwg"
SHEETS = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
    Sheet("S-03", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",), rev="B", date="20.09.2026"),
    Sheet("S-03", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",), rev="A", date="01.08.2026"),
]


def _raised(api: Any, qs: QsProject) -> dict[str, tuple[str, int]]:
    return {q["id"]: (q["status"], q["raised"]) for q in questions(api, qs.project_id)}


def test_each_question_keeps_its_place_in_the_order_raised_after_an_answer(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    file_id = uploaded(qs_project.member, qs_project.project_id, NAME)
    run_job(qs_project.member, file_id, monkeypatch, readers({NAME: SHEETS}))
    api = api_as(qs_project.member)
    listed = api.post(
        f"{step1(qs_project.project_id)}/drawing-list",
        {"discipline": "structural", "text": "S-01 to S-03"},
    )
    assert listed.status_code == 200, listed.content
    before = _raised(api, qs_project)
    assert len(before) >= 2, before
    assert sorted(place for _, place in before.values()) == list(range(1, len(before) + 1))

    # The one asked last: answering it leaves the first open, whose place must not move up.
    conflict = max(open_questions(api, qs_project.project_id, "conflict"), key=lambda q: q["raised"])
    assert answer(api, qs_project.project_id, conflict["id"], "keep_latest").status_code == 200

    after = _raised(api, qs_project)
    assert after[conflict["id"]][0] == "answered"
    assert {qid: place for qid, (_, place) in after.items()} == {
        qid: place for qid, (_, place) in before.items()
    }
