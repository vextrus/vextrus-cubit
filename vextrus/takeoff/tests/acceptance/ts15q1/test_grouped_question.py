"""S15-Q1, second half: "a Question groups the Sheets it asks about, one answer confirms them all"
(the session 15 ticket), and its finish check "Questions per Discipline <= 3" (the owner's Q5 limit:
at most 3 Questions per Discipline).

On main every sheet whose kind Jev is unsure of is its own "What kind of sheet is N?" Question
(discovery 01 section 0 item 3: 82 of 109 Questions on the larger real set). Here many invented
structural sheets share one uncertainty (Jev's top two the same two kinds, close), so they are one
group: one Question holds them all, the Discipline asks at most 3 Questions, and one answer confirms
every sheet of the group in one act.

The group's identity is the group, not a sheet's name (discovery 02 section 4 item 4: "Key identity on
the group, not the Sheet's name"): a second file of the Discipline whose sheets share the uncertainty,
numbered before and after the first file's, joins the Question already open, which keeps its id.

Not pinned (no authority gives them): the group Question's words, its subject, and whether a group of
other kinds' sheets (Jev unsure between other kinds) is a second Question or the same.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import answer, proposals
from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import (
    STRUCTURAL,
    STRUCTURAL_TOO,
    beams,
    columns,
    ids_of,
    jev_unsure,
    kind_questions,
    open_in,
    read,
    the_one_kind_question,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

LIMIT = 3
"""The owner's Q5: at most 3 Questions per Discipline."""
TWELVE = beams(range(1, 13))
"""S-01 to S-12, each a beam sheet Jev is unsure of between "Beam layout" and "Beam details"."""


def test_twelve_sheets_of_one_uncertain_kind_ask_the_discipline_at_most_three_questions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The finish check: "Questions per Discipline <= 3", here on 12 sheets main asks 12 times."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, TWELVE)
    api = api_as(qs_project.member)

    asked = open_in(api, qs_project.project_id, "structural")

    assert len(asked) <= LIMIT, f"too many Questions in structural: {len(asked)}"


def test_beam_and_column_sheets_of_two_uncertainties_ask_the_discipline_at_most_three_questions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The finish check on a set of two uncertainties: 8 beam sheets and 6 column sheets."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, [*beams(range(1, 9)), *columns(range(9, 15))])
    api = api_as(qs_project.member)

    asked = open_in(api, qs_project.project_id, "structural")
    held = sorted({p for q in kind_questions(api, qs_project.project_id) for p in q["proposals"]})

    assert len(asked) <= LIMIT, f"too many Questions in structural: {len(asked)}"
    assert held == sorted(ids_of(api, qs_project.project_id).values()), "a sheet not asked"


def test_one_question_holds_every_sheet_of_the_uncertain_kind(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The ticket: "a Question groups the Sheets it asks about"."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, TWELVE)
    api = api_as(qs_project.member)

    q = the_one_kind_question(api, qs_project.project_id)

    assert q["kind"] == "low_confidence"
    assert q["discipline"] == "structural"
    assert sorted(q["proposals"]) == sorted(ids_of(api, qs_project.project_id).values())
    assert {"beam_layout", "beam_details"} <= {o["key"] for o in q["options"]}
    assert q["options"][-1]["key"] == "keep_open"


def test_the_groups_question_keeps_its_identity_when_another_file_adds_sheets_named_before_and_after(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """Discovery 02 section 4 item 4: "Key identity on the group, not the Sheet's name". The first
    file's S-05 to S-08 are asked; the second file's S-01 to S-03 and S-12 (now the first and the last
    by number) join the same open Question, which is not withdrawn and replaced."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams(range(5, 9)))
    api = api_as(qs_project.member)
    first = the_one_kind_question(api, qs_project.project_id)

    read(qs_project, monkeypatch, STRUCTURAL_TOO, beams([1, 2, 3, 12]))

    after = the_one_kind_question(api, qs_project.project_id)
    assert after["id"] == first["id"], "the group's Question was asked anew"
    assert sorted(after["proposals"]) == sorted(ids_of(api, qs_project.project_id).values())
    assert len(after["proposals"]) == 8


def test_one_answer_confirms_every_sheet_of_the_group_with_its_kind_in_one_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The ticket: "one answer confirms them all"; one act: each sheet "Confirmed in bulk with 11
    other sheets" (`decided_with`, the sheets its deciding act decided)."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, TWELVE)
    api = api_as(qs_project.member)
    q = the_one_kind_question(api, qs_project.project_id)

    response = answer(api, qs_project.project_id, q["id"], "beam_details")

    assert response.status_code == 200, response.content
    assert response.json()["status"] == "answered"
    after = proposals(api, qs_project.project_id)
    assert [p["decision"] for p in after] == ["confirmed"] * 12
    assert [p["confirmed_kind"] for p in after] == ["beam_details"] * 12
    assert [p["decided_with"] for p in after] == [12] * 12
    assert kind_questions(api, qs_project.project_id) == []
