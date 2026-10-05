"""Ticket 166 (M0 fix W8): confirm refuses one-source sheets in a multi-sheet act; an answer is
recorded as an answer.

The authority:
- m0-screens 6.4: "Sheets "with one source" (5) are never in the bulk act; the QS confirms each in
  sheet mode (6.5)." §9 row 18: "A sheet with one source ... never in the bulk act; confirmed one by
  one".
- Issue #166: "A multi-sheet confirm including one-source sheets returns 409 with a refusal body
  naming them." and "Who-did-what shows an answered Question as the answer, not "in bulk"."
- m0-screens 6.6 (5): who did what is "every act on the sheet ... each "what"": the act that decided
  a sheet is the record of it. Its kind is `Confirmation.kind`, whose vocabulary already names the
  answer (`ConfirmationKind.QUESTION_ANSWER`, "question_answer").

The rulings pinned here (the orchestrator's brief for 166): the refusal is all or nothing (nothing is
confirmed when any named sheet has one source), its body is a code with English in the catalogue
whose params carry the ids of the one-source sheets named, and a confirm of one sheet with one source
still succeeds. "Agrees" is ticket 22's contract kept in `step1.py` (`ProposalView.agrees`); a sheet
whose `agrees` is false is a sheet "with one source".
"""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest

from vextrus.takeoff.models import Proposal
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    english,
    jev_says,
    keys,
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
ELECTRICAL = "KR-ELE-R0.dwg"

LISTED = (("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"))
AGREEING = [
    Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=LISTED),
    Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
]
"""Structural with its drawing list drawn on S-01: every sheet agrees (two sources)."""

ONE_SOURCE = [
    Sheet("E-01", "ELECTRICAL LEGEND AND NOTES", ("ELECTRICAL LEGEND AND NOTES",)),
    Sheet("E-03", "TYPICAL FLOOR LIGHTING LAYOUT", ("TYPICAL FLOOR LIGHTING LAYOUT",)),
    Sheet("E-05", "TYPICAL FLOOR POWER LAYOUT", ("TYPICAL FLOOR POWER LAYOUT",)),
]
"""Electrical with no drawing list and no Plot, its numbering skipping E-02 and E-04: each sheet sits
beside an unanswered gap, so it has one source (W320: numbering without a gap beside it is the title
block's second source)."""

SAME_TITLE = [
    Sheet("S-01", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
    Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    Sheet("S-04", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
]
"""Two sheets of one title that do not run on: one `conflict` Question holding S-01 and S-04."""

DUPLICATE = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
]
"""Two copies of S-02: one `conflict` Question whose first option keeps R1 and leaves R0 out."""

ANSWER = "question_answer"


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, drawn: dict[str, list[Sheet]]) -> None:
    for name, sheets in drawn.items():
        file_id = uploaded(qs.member, qs.project_id, name)
        run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))


def strings(value: object) -> Iterator[str]:
    """Every string anywhere in a refusal's params (ids may be listed or keyed)."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from strings(k)
            yield from strings(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from strings(v)


def named(body: dict[str, Any], sheet: dict[str, Any]) -> bool:
    """The refusal names the sheet, by its Proposal's id or its printed sheet's."""
    said = set(strings(body.get("params", {})))
    return sheet["id"] in said or sheet["sheet_id"] in said


def the_act_of(proposal_id: str) -> str:
    """The kind of the act that decided the sheet: who did what's "what" (m0-screens 6.6)."""
    row = Proposal.objects.select_related("confirmation").get(id=uuid.UUID(proposal_id))
    assert row.confirmation is not None, "the sheet was decided by no act"
    return str(row.confirmation.kind)


def refused_one_source(response: Any) -> dict[str, Any]:
    assert response.status_code == 409, (response.status_code, response.content)
    body: dict[str, Any] = response.json()
    assert isinstance(body.get("code"), str), body
    assert body["code"], body
    assert english(body["code"]) is not None, f"{body['code']} has no English in web/src/messages"
    return body


# The world these tests stand on ------------------------------------------------------------------


def test_the_electrical_sheets_have_one_source_and_the_structural_ones_agree(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The fixture's premise (m0-screens §5, "What 'agrees' means"), so a refusal below is for the
    right reason."""
    read(qs_project, monkeypatch, {STRUCTURAL: AGREEING, ELECTRICAL: ONE_SOURCE})
    listed = proposals(api_as(qs_project.member), qs_project.project_id)

    assert {p["number"]: p["agrees"] for p in listed} == {
        "S-01": True, "S-02": True, "S-03": True, "E-01": False, "E-03": False, "E-05": False,
    }  # fmt: skip


# One source: never in the bulk act (m0-screens 6.4) ----------------------------------------------


def test_a_multi_sheet_confirm_of_one_source_sheets_is_refused_409_naming_each(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Issue #166: "The confirm endpoint accepted 17 one-source Structural sheets in one act (200)";
    now "returns 409 with a refusal body naming them"."""
    read(qs_project, monkeypatch, {ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    body = refused_one_source(confirm(api, qs_project.project_id, [p["id"] for p in listed]))

    assert all(named(body, p) for p in listed), body


def test_a_bulk_act_with_one_one_source_sheet_among_agreeing_ones_confirms_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """All or nothing: the act is refused whole; the agreeing sheets named with it stay unconfirmed,
    and the refusal names the one-source sheet, not the agreeing ones."""
    read(qs_project, monkeypatch, {STRUCTURAL: AGREEING, ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    agreeing = [the(listed, n) for n in ("S-01", "S-02", "S-03")]
    lone = the(listed, "E-03")

    body = refused_one_source(confirm(api, qs_project.project_id, [p["id"] for p in [*agreeing, lone]]))

    assert named(body, lone), body
    assert not any(named(body, p) for p in agreeing), body
    assert [p["decision"] for p in proposals(api, qs_project.project_id)] == [None] * 6


def test_one_source_sheets_named_by_their_printed_sheet_ids_are_refused_alike(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The confirm takes a Proposal's id or its printed sheet's (21c's `_chosen`); the rule holds
    whichever the caller sends."""
    read(qs_project, monkeypatch, {ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    body = refused_one_source(
        confirm(api, qs_project.project_id, [the(listed, n)["sheet_id"] for n in ("E-01", "E-05")])
    )

    assert named(body, the(listed, "E-01")), body
    assert named(body, the(listed, "E-05")), body
    assert [p["decision"] for p in proposals(api, qs_project.project_id)] == [None] * 3


def test_a_one_source_sheet_confirmed_on_its_own_is_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "The QS confirms each in sheet mode (6.5)": one sheet, one act, 200."""
    read(qs_project, monkeypatch, {ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)
    lone = the(proposals(api, qs_project.project_id), "E-01")

    response = confirm(api, qs_project.project_id, [lone["id"]])

    assert response.status_code == 200, response.content
    after = {p["number"]: p["decision"] for p in proposals(api, qs_project.project_id)}
    assert after == {"E-01": "confirmed", "E-03": None, "E-05": None}


def test_each_one_source_sheet_confirmed_one_by_one_ends_all_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §7: "then E-01 to E-03 confirmed one by one"."""
    read(qs_project, monkeypatch, {ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)

    for number in ("E-01", "E-03", "E-05"):
        lone = the(proposals(api, qs_project.project_id), number)
        response = confirm(api, qs_project.project_id, [lone["id"]])
        assert response.status_code == 200, (number, response.content)

    assert [p["decision"] for p in proposals(api, qs_project.project_id)] == ["confirmed"] * 3


def test_the_bulk_act_of_agreeing_sheets_still_confirms_them_in_one_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """6.4: "`Enter` confirms ... them in one act": the refusal is for one-source sheets only."""
    read(qs_project, monkeypatch, {STRUCTURAL: AGREEING, ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)
    agreeing = [p for p in proposals(api, qs_project.project_id) if p["agrees"]]

    response = confirm(api, qs_project.project_id, [p["id"] for p in agreeing])

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 3
    after = {p["number"]: p["decision"] for p in proposals(api, qs_project.project_id)}
    assert after == {
        "S-01": "confirmed", "S-02": "confirmed", "S-03": "confirmed",
        "E-01": None, "E-03": None, "E-05": None,
    }  # fmt: skip


# An answer is recorded as an answer (m0-screens 6.6's who did what) ------------------------------


def test_answering_keep_all_confirms_both_sheets_it_holds_though_neither_agrees(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Sheets in an open Question never agree; answering it confirms what it held (m0-screens §5:
    "Answering confirms 2 sheets."), so the one-source refusal is the confirm endpoint's, not the
    answer's."""
    read(qs_project, monkeypatch, {STRUCTURAL: SAME_TITLE})
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")
    assert "keep_all" in keys(q)

    response = answer(api, qs_project.project_id, q["id"], "keep_all")

    assert response.status_code == 200, response.content
    after = {p["number"]: p["decision"] for p in proposals(api, qs_project.project_id)}
    assert (after["S-01"], after["S-04"]) == ("confirmed", "confirmed")


def test_sheets_an_answer_confirms_are_recorded_as_the_answer_not_in_bulk(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Issue #166: answering "records it as "Confirmed in bulk with 1 other sheet"". The act that
    decided each sheet is of kind "question_answer", not "bulk"."""
    read(qs_project, monkeypatch, {STRUCTURAL: SAME_TITLE})
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert answer(api, qs_project.project_id, q["id"], "keep_all").status_code == 200

    assert [the_act_of(i) for i in q["proposals"]] == [ANSWER, ANSWER]


def test_the_copy_an_answer_keeps_and_the_copy_it_leaves_out_are_both_recorded_as_the_answer(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5's option 1, "Keep rev B ...; exclude rev A as superseded": one answer, and each
    copy's who-did-what says it was that answer, not "Confirmed" or "Excluded" on their own."""
    read(qs_project, monkeypatch, {STRUCTURAL: DUPLICATE})
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert answer(api, qs_project.project_id, q["id"], keys(q)[0]).status_code == 200

    copies = {p["revision_mark"]: p for p in proposals(api, qs_project.project_id)
              if p["number"] == "S-02"}  # fmt: skip
    assert (copies["R1"]["decision"], copies["R0"]["decision"]) == ("confirmed", "excluded")
    assert (the_act_of(copies["R1"]["id"]), the_act_of(copies["R0"]["id"])) == (ANSWER, ANSWER)


def test_a_sheet_confirmed_by_the_qs_on_its_own_is_still_recorded_as_single(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The answer's kind is the answer's alone: a confirm of one sheet stays "single" and a bulk act
    of agreeing sheets stays "bulk" (m0-screens 6.6: "Confirmed in bulk with 55 other sheets")."""
    read(qs_project, monkeypatch, {STRUCTURAL: AGREEING, ELECTRICAL: ONE_SOURCE})
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    agreeing = [p["id"] for p in listed if p["agrees"]]
    lone = the(listed, "E-01")["id"]

    assert confirm(api, qs_project.project_id, agreeing).status_code == 200
    assert confirm(api, qs_project.project_id, [lone]).status_code == 200

    assert [the_act_of(i) for i in agreeing] == ["bulk"] * 3
    assert the_act_of(lone) == "single"
