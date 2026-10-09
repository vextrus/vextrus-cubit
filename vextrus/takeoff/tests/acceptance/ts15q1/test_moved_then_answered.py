"""S18-Q1: an answer to a kind Question after a sheet's file moved Discipline (the re-read rule: a
grouped kind Question's membership and words are recomputed on read, never stored; docs/plans/M1.md
C9, the session 18 ruling).

Review round 3 of PR #566 (on S15-Q1's head, 9dc7ec1f):
- l3-f1 and l1-f4: an answer naming the sheets the QS saw is refused (409, `group_changed`) when the
  Question now holds others; when a sheet was let go (its file moved to another Discipline) the
  refusal counts the sheets it held before (`len(held)`), not those the card now shows, and its words
  say sheets "were added" when one was taken away;
- l1-f1: a kind answer records its kind on each sheet it leaves open (another Question, a same-number
  conflict, holds it first); a sheet whose file then moves to another Discipline, confirmed alone,
  takes the old group's structural kind, though a moved sheet never takes the group's answer.

Not pinned (no authority gives them): the refusal's other words and params; the kind a moved sheet
takes when confirmed alone, but that it is not the group's answer.
"""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, confirm, proposals
from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import beams, jev_unsure
from vextrus.takeoff.tests.acceptance.ts15q1.moves import (
    AWAY,
    GROUP_CHANGED,
    answer_seen,
    by_number,
    move,
    read_file,
    the_structural_kind_question,
    words,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

ANSWERED = "beam_details"
"""The QS's answer: Jev's second kind (kinds_set's stand-in ranks "Beam layout" first)."""


def _seen_three_then_one_moved(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> tuple[dict[str, Any], Any]:
    """The QS loads the card of S-01 to S-03; then S-03's file is set to architectural. The answer
    naming the 3 sheets seen is sent; answered: the card seen and the reply."""
    jev_unsure(jev_offline)
    read_file(qs_project, monkeypatch, "KR-STR-R0.dwg", beams([1, 2]))
    later = read_file(qs_project, monkeypatch, "KR-STR-R1.dwg", beams([3]))
    api = api_as(qs_project.member)
    seen = the_structural_kind_question(api, qs_project.project_id)
    assert len(seen["proposals"]) == 3
    move(api, qs_project.project_id, later, AWAY)
    reply = answer_seen(api, qs_project.project_id, seen["id"], ANSWERED, seen["proposals"])
    return seen, reply


def test_an_answer_to_a_group_that_let_a_sheet_go_is_refused_counting_the_sheets_the_card_shows(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """l3-f1, l1-f4: the refusal's `sheets` is what the card holds now (2), never the 3 it held
    before; nothing is confirmed."""
    _seen, reply = _seen_three_then_one_moved(qs_project, monkeypatch, jev_offline)
    api = api_as(qs_project.member)

    assert reply.status_code == 409, reply.content
    body = reply.json()
    card = the_structural_kind_question(api, qs_project.project_id)
    assert body["code"] == GROUP_CHANGED
    assert len(card["proposals"]) == 2
    assert body["params"]["sheets"] == 2, f"the refusal counts {body['params']['sheets']}, the card 2"
    assert [p["decision"] for p in proposals(api, qs_project.project_id)] == [None] * 3


def test_the_refusal_for_a_group_that_let_a_sheet_go_never_says_sheets_were_added(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """l3-f1: the group lost a sheet; the words the web shows for the refusal (its code's English with
    its params) do not say sheets were added."""
    _seen, reply = _seen_three_then_one_moved(qs_project, monkeypatch, jev_offline)

    assert reply.status_code == 409, reply.content
    body = reply.json()
    shown = words(body["code"], body["params"])
    assert "added" not in shown.lower(), shown


def test_a_sheet_left_waiting_by_the_kind_answer_then_moved_never_takes_the_groups_kind(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """l1-f1: two copies of S-01 (a same-number conflict, so the kind answer leaves both open) in one
    file, S-02 and S-03 in another, one structural group. The QS answers the group, sets the copies'
    file to architectural, then confirms one copy alone: it is not confirmed with the structural kind
    the group was answered, which the moved sheet never takes."""
    jev_unsure(jev_offline)
    copies = [
        Sheet("S-01", "BEAM DRAWING A", ("BEAM B1",)),
        Sheet("S-01", "BEAM DRAWING Y", ("BEAM B9",)),
    ]
    first = read_file(qs_project, monkeypatch, "KR-STR-R0.dwg", copies)
    read_file(qs_project, monkeypatch, "KR-STR-R1.dwg", beams([2, 3]))
    api = api_as(qs_project.member)
    card = the_structural_kind_question(api, qs_project.project_id)
    assert len(card["proposals"]) == 4
    answered = answer_seen(api, qs_project.project_id, card["id"], ANSWERED, card["proposals"])
    assert answered.status_code == 200, answered.content
    copy = next(p for p in proposals(api, qs_project.project_id) if p["title"] == "BEAM DRAWING A")
    assert copy["decision"] is None

    move(api, qs_project.project_id, first, AWAY)
    alone = confirm(api, qs_project.project_id, [copy["id"]])

    assert alone.status_code == 200, alone.content
    after = next(p for p in proposals(api, qs_project.project_id) if p["id"] == copy["id"])
    assert after["decision"] == "confirmed"
    assert after["confirmed_kind"] != ANSWERED, "the moved sheet took the structural group's answer"
    others = by_number(api, qs_project.project_id)
    assert [others[n]["confirmed_kind"] for n in ("S-02", "S-03")] == [ANSWERED] * 2
