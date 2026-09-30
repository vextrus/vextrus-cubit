"""A Proposal's `agrees` (ticket 22; m0-screens §5, "What 'agrees' means"): the field Step 1's bulk act
("Confirm 16, leave out 1 ↵", 6.4) is worked out from. A sheet read from its title block agrees once
a second source confirms it: its Discipline's drawing list names it (or, with no list, the numbering
runs without a gap and its Plot page matched). A sheet in an open Question, or with one source, never
agrees."""

import uuid
from dataclasses import replace
from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

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


def test_an_issue_date_reaches_the_web_as_an_iso_date_in_the_markets_order(
    step1_project: Step1Project, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The design gate's M1: "12.09.2026" is the 12th of September in the Market's day-month order,
    never the 9th of December; what is no calendar day is null."""
    written = {"S-01": "12.09.2026", "S-02": "31.02.2026", "S-03": ""}
    read = step1._sheets
    monkeypatch.setattr(
        step1,
        "_sheets",
        lambda project_id: [replace(s, issue_date=written[s.number or ""]) for s in read(project_id)],
    )

    body = (
        api_as(step1_project.member)
        .get(f"/api/projects/{step1_project.project_id}/takeoff/step1/proposals")
        .json()
    )

    assert {p["number"]: p["issue_date"] for p in body["proposals"]} == {
        "S-01": "2026-09-12",
        "S-02": None,
        "S-03": None,
    }


def test_the_md_and_a_guest_are_told_the_qs_by_name(step1_project: Step1Project, sign_in: Any) -> None:
    """The design gate's M11 (m0-screens §6.12): the read-only bar names the QS ("Nusrat Jahan (QS)
    confirms the sheet list"). Only the QS members who may open this Project, by name, never an email;
    a revoked QS or one given another Project is not named."""
    developer = step1_project.member.developer_id
    md = sign_in(role="md", developer_id=developer)
    guest = sign_in(role="guest", developer_id=developer, projects=[step1_project.project_id])
    elsewhere = sign_in(role="qs", developer_id=developer, projects=[uuid.uuid4()])
    gone = sign_in(role="qs", developer_id=developer, expires_at=timezone.now() - timedelta(days=1))
    qs = step1_project.member.user

    for reader in (md, guest, step1_project.member):
        path = f"/api/projects/{step1_project.project_id}/takeoff/step1/progress"
        body = api_as(reader).get(path).json()
        assert body["qs"] == [qs.name], reader.role
        assert elsewhere.user.name not in body["qs"]
        assert gone.user.name not in body["qs"]
        assert all("@" not in name for name in body["qs"])


def test_a_list_read_on_a_sheet_names_the_sheet_it_was_read_on(step1_project: Step1Project) -> None:
    """ "13 on the drawing list on S-01" (m0-screens §6.3) and Q5's Trace (the gate's M4) need the
    sheet: the list's `read_on` is that printed sheet; a list the QS typed has none."""
    project = step1_project.project_id
    path = f"/api/projects/{project}/takeoff/step1/drawing-list"
    reader = api_as(step1_project.member)
    assert reader.get(path, discipline="structural").json()["read_on"] is None

    with step1_project.member.acting():
        step1.record_read_list(
            step1_project.sheets[0], "structural", [("S-01", "NOTES"), ("S-02", "PLAN")]
        )

    assert reader.get(path, discipline="structural").json()["read_on"] == str(step1_project.sheets[0])


def test_a_read_list_gives_each_numbers_revision_mark(step1_project: Step1Project) -> None:
    """The design gate's M14 (m0-screens 7, "Two sheets, one number"): the drawing list on S-01 is a
    source of its own for which copy is current, so the API sends the marks the read list gives; a
    number listed without one is left out, and a list the QS typed gives none."""
    project = step1_project.project_id
    path = f"/api/projects/{project}/takeoff/step1/drawing-list"
    reader = api_as(step1_project.member)
    assert reader.get(path, discipline="structural").json()["read_revisions"] == {}

    with step1_project.member.acting():
        step1.record_read_list(
            step1_project.sheets[0],
            "structural",
            [("S-01", "NOTES", "A"), ("S-02", "PLAN"), ("S-07", "BEAMS", "B")],
        )

    assert reader.get(path, discipline="structural").json()["read_revisions"] == {
        "S-01": "A",
        "S-07": "B",
    }


def test_a_proposal_carries_where_each_fact_was_read_and_its_views(step1_project: Step1Project) -> None:
    """The design gate's M7 and M2 (m0-screens §6.2, §6.6): the inspector's "where each was read"
    (number, title, storeys, file and layout, Plot) and the Views section and column come from the
    Proposal; a sheet read from a frame in the drawing has no layout, and none here has a Plot page."""
    body = (
        api_as(step1_project.member)
        .get(f"/api/projects/{step1_project.project_id}/takeoff/step1/proposals")
        .json()
    )
    first = body["proposals"][0]
    assert first["number_source"] in {"title_block_attribute", "title_block_text"}
    assert first["title_source"] in {"title_block_attribute", "title_block_text"}
    assert (first["layout"], first["plot_page"], first["plot_file"]) == (None, None, None)
    assert [v["kind"] for v in first["views"]] == ["title_block"]
    shown = {"title", "stated_scale", "storeys", "storeys_meaning", "steps", "box"}
    assert set(first["views"][0]) >= shown
