"""S15-Q1: "one undo reverts it" (the session 15 ticket): the act a group's answer made is undone by
one undo, which puts every sheet it confirmed back to undecided and asks the Question again.

This changes m0-screens §6's Undo paragraph (session 09's ruling on #156: "It never takes back an
answer that confirmed or excluded sheets"; `takeoff.step1.answer_stays`) for the kind Question's
answer. That ruling's reason, "undoing the act such an answer made would leave the Question answered
with nothing holding its sheets", is met here by the Question being open again. The report names the
conflict for the owner; this file holds only that promise, so it can be withdrawn whole.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import answer, proposals, step1
from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import (
    STRUCTURAL,
    beams,
    jev_unsure,
    read,
    the_one_kind_question,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db


def test_one_undo_after_the_groups_answer_puts_all_its_sheets_back_and_asks_it_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams(range(1, 9)))
    api = api_as(qs_project.member)
    q = the_one_kind_question(api, qs_project.project_id)
    answered = answer(api, qs_project.project_id, q["id"], "beam_layout")
    assert answered.status_code == 200, answered.content

    undone = api.post(f"{step1(qs_project.project_id)}/undo", {})

    assert undone.status_code == 200, f"the answer's act not undone: {undone.content!r}"
    assert undone.json()["sheets"] == 8
    after = proposals(api, qs_project.project_id)
    assert [p["decision"] for p in after] == [None] * 8
    assert [p["confirmed_kind"] for p in after] == [None] * 8
    again = the_one_kind_question(api, qs_project.project_id)
    assert sorted(again["proposals"]) == sorted(q["proposals"])
