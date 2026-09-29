"""A Proposal's `agrees` (ticket 22; m0-screens §5, "What 'agrees' means"): the field Step 1's bulk act
("Confirm 16, leave out 1 ↵", 6.4) is worked out from. A sheet read from its title block agrees once
a second source confirms it: its Discipline's drawing list names it (or, with no list, the numbering
runs without a gap and its Plot page matched). A sheet in an open Question, or with one source, never
agrees."""

import uuid
from dataclasses import replace
from typing import Any

import pytest

from engine.messages import Message
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import QuestionKind
from vextrus.takeoff.services import step1
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db


def agrees(project: Step1Project) -> dict[str | None, bool]:
    body: dict[str, Any] = (
        api_as(project.member).get(f"/api/projects/{project.project_id}/takeoff/step1/proposals").json()
    )
    return {p["number"]: p["agrees"] for p in body["proposals"]}


def test_with_no_list_and_no_plot_every_sheet_has_one_source(step1_project: Step1Project) -> None:
    assert agrees(step1_project) == {"S-01": False, "S-02": False, "S-03": False}


def test_a_drawing_list_naming_a_sheet_is_its_second_source(step1_project: Step1Project) -> None:
    with step1_project.member.acting():
        step1.set_list(step1_project.project_id, "structural", "S-01 to S-02", actor_name="QS")

    assert agrees(step1_project) == {"S-01": True, "S-02": True, "S-03": False}


def test_two_lists_that_disagree_leave_every_sheet_with_one_source(step1_project: Step1Project) -> None:
    with step1_project.member.acting():
        step1.record_read_list(
            step1_project.sheets[0],
            "structural",
            [("S-01", "NOTES"), ("S-02", "PLAN"), ("S-03", "PLAN")],
        )
        step1.set_list(step1_project.project_id, "structural", "S-01 to S-04", actor_name="QS")

    assert set(agrees(step1_project).values()) == {False}


def test_a_sheet_in_an_open_question_does_not_agree(step1_project: Step1Project) -> None:
    with step1_project.member.acting():
        step1.set_list(step1_project.project_id, "structural", "S-01 to S-03", actor_name="QS")
        step1.raise_question(
            step1_project.project_id,
            QuestionKind.LOW_CONFIDENCE,
            Message(code="takeoff.step1.which_kind", params={"number": "S-02"}),
            subject_id=step1_project.sheets[1],
            discipline="structural",
        )
        step1.raise_question(
            step1_project.project_id,
            QuestionKind.CONFLICT,
            Message(code="engine.conflicts.same_number", params={"number": "S-03", "copies": 2}),
            discipline="structural",
            blocks=[step1_project.proposals[2]],
        )

    assert agrees(step1_project) == {"S-01": True, "S-02": False, "S-03": False}


def test_the_field_is_on_the_schema_the_web_reads() -> None:
    from vextrus.takeoff.schemas.step1 import Step1ProposalOut

    assert Step1ProposalOut.model_fields["agrees"].annotation is bool


def test_two_sheets_of_one_number_never_agree_even_on_the_list(qs_project: QsProject) -> None:
    """The refuter's finding (ticket 22, score 35): a list naming S-02 made both copies agree, so one
    bulk act would have confirmed both; which copy is the sheet is a Question's."""
    member = qs_project.member
    structural = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, structural.id, ["S-01", "S-02", "S-02"])
    with member.acting():
        drawing_set = drawings.set_of(qs_project.project_id)
        assert drawing_set is not None
        ids = [step1.propose_sheet(s.id) for s in drawings.sheets(drawing_set.id)]
        step1.set_list(qs_project.project_id, "structural", "S-01 to S-02", actor_name="QS")
    body: dict[str, Any] = (
        api_as(member).get(f"/api/projects/{qs_project.project_id}/takeoff/step1/proposals").json()
    )

    assert len(ids) == 3
    assert sorted((p["number"], p["agrees"]) for p in body["proposals"]) == [
        ("S-01", True),
        ("S-02", False),
        ("S-02", False),
    ]


def test_with_no_list_a_run_without_a_gap_and_its_plot_pages_agree(
    step1_project: Step1Project, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The no-list branch (m0-screens §5): S-01 to S-03 run without a gap, and each sheet whose Plot
    page matched agrees; S-03, with no Plot page, has one source."""
    real = step1._sheets

    def with_plots(project_id: uuid.UUID) -> list[drawings.SheetView]:
        return [
            replace(s, plot=replace(s.plot, page=i + 1)) if s.number != "S-03" else s
            for i, s in enumerate(real(project_id))
        ]

    monkeypatch.setattr(step1, "_sheets", with_plots)

    assert agrees(step1_project) == {"S-01": True, "S-02": True, "S-03": False}
