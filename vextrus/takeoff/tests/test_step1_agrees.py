"""A Proposal's `agrees` (ticket 22; m0-screens §5, "What 'agrees' means"): the field Step 1's bulk act
("Confirm 16, leave out 1 ↵", 6.4) is worked out from. A sheet read from its title block agrees once
a second source confirms it: its Discipline's drawing list names it (or, with no list, the numbering
runs without a gap and its Plot page matched). A sheet in an open Question, or with one source, never
agrees."""

from typing import Any

import pytest

from engine.messages import Message
from vextrus.takeoff.models import QuestionKind
from vextrus.takeoff.services import step1
from vextrus.testing.auth import api_as
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
