"""Ticket 21c's proposals by Discipline and Step 1 per Discipline (docs/plans/M0.md, 21c: "Proposals
... following 17's rules by Discipline (steps 5-10 from Structural views only; an architectural copy
of a structural plan proposed out, 'the structural set governs'; fixture plans and toilet details to
the Plumbing and sanitary Part as well as steps 11-12; legends to their Discipline's Part or Step 2
...)"; "MEP sheets proposed under their Disciplines with their views assigned to their Parts"; "a file
of a new Discipline opening only its own Step 1 while Structural stays confirmed"), m0-screens 6.11,
and two issues handed to 21c:

- #102: a sheet with no Discipline ("its Questions are 21c's"): asked which Discipline it is (the
  model's `missing_discipline`, the Market's Disciplines as options), and compared against every
  Discipline's numbers (#102: "compare Discipline-less sheets against every Discipline's numbers").
- #135: a sheet 21b leaves out for unreadable writing is "also absent from Coverage, which promises to
  leave nothing silently unread": Coverage counts it (`unread_sheets`).
"""

import uuid
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from .step1_whole import (
    KEEP_OPEN,
    Sheet,
    answer,
    confirm,
    coverage,
    jev_says,
    keys,
    open_questions,
    picked,
    progress,
    proposals,
    readers,
    run_job,
    the,
    uploaded,
)

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
ARCHITECTURAL = "KR-ARC-R0.dwg"
ELECTRICAL = "KR-ELE-R0.dwg"
NO_DISCIPLINE = "GENERAL NOTES.dwg"
DRAWN: dict[str, list[Sheet]] = {
    STRUCTURAL: [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet(
            "S-02",
            "GROUND FLOOR BEAM LAYOUT PLAN",
            ("GROUND FLOOR BEAM LAYOUT PLAN", "TYPICAL BEAM SECTION"),
        ),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ],
    ARCHITECTURAL: [
        Sheet("A-01", "GROUND FLOOR PLAN", ("GROUND FLOOR PLAN", "TOILET DETAIL")),
        Sheet("A-02", "COLUMN LAYOUT PLAN", ("COLUMN LAYOUT PLAN",)),
    ],
    ELECTRICAL: [
        Sheet(
            "E-01", "LIGHTING LAYOUT PLAN", ("GROUND FLOOR LIGHTING LAYOUT PLAN", "ELECTRICAL LEGEND")
        ),
    ],
}


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str,
         drawn: dict[str, list[Sheet]] = DRAWN) -> uuid.UUID:  # fmt: skip
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers(drawn))
    return file_id


def ids(listed: list[dict[str, Any]], discipline: str | None) -> list[str]:
    return [p["id"] for p in listed if p["discipline"] == discipline]


# 17's rules, by Discipline -------------------------------------------------------------------------


def test_structural_views_are_proposed_to_steps_5_to_10_by_their_subject(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, STRUCTURAL)

    shown = coverage(api_as(qs_project.member), qs_project.project_id)

    assert shown["by_step"] == {"foundations": 1, "beams": 2, "columns": 1}
    # Four drawn views and three title blocks (a View, CONTEXT.md; ruling R2), proposed out.
    assert (shown["proposed"], shown["unaccounted"]) == (7, 0)
    assert shown["by_reason"] == {"for_information": 3}


def test_an_architectural_plan_of_the_structure_is_proposed_out_and_a_toilet_detail_to_plumbing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5: "an architectural plan that draws structure ..., 'duplicate: the structural set
    governs'"; "Architectural fixture plans and toilet details go to steps 11 and 12 and to the
    Plumbing and sanitary Part as well"."""
    read(qs_project, monkeypatch, ARCHITECTURAL)

    shown = coverage(api_as(qs_project.member), qs_project.project_id)

    assert shown["views"] == 5  # three drawn views and each sheet's title block
    assert shown["by_reason"] == {"duplicate": 1, "for_information": 2}
    assert shown["by_step"] == {"walls": 2, "rooms": 2, "plumbing": 1}
    assert shown["unaccounted"] == 0


def test_an_mep_sheet_is_proposed_under_its_discipline_its_views_to_its_part(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5: "MEP sheets are proposed and confirmed like any other, under their own
    Discipline ... Their views are proposed as assigned to their Discipline Part" (the legend too)."""
    read(qs_project, monkeypatch, ELECTRICAL)
    api = api_as(qs_project.member)

    [sheet] = proposals(api, qs_project.project_id)
    shown = coverage(api, qs_project.project_id)

    assert (sheet["number"], sheet["discipline"]) == ("E-01", "electrical")
    assert sheet["id"] != sheet["sheet_id"]
    # The lighting plan, the legend and the sheet's title block (proposed out for information).
    assert (shown["views"], shown["proposed"], shown["by_step"]) == (3, 3, {"electrical": 2})
    assert shown["by_reason"] == {"for_information": 1}


def test_an_mep_sheet_confirmed_has_its_views_assigned_to_its_part_and_its_step_1_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, ELECTRICAL)
    api = api_as(qs_project.member)
    [sheet] = proposals(api, qs_project.project_id)

    response = confirm(api, qs_project.project_id, [sheet["id"]])

    assert response.status_code == 200, response.content
    shown = coverage(api, qs_project.project_id)
    assert (shown["assigned"], shown["proposed"], shown["unaccounted"]) == (2, 0, 0)
    assert shown["by_step"] == {"electrical": 2}
    assert progress(api, qs_project.project_id)["electrical"]["status"] == "confirmed"


def test_a_file_of_a_new_discipline_opens_only_its_own_step_1_while_structural_stays_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5: "A file of a Discipline not received before (Electrical arriving after
    Structural is confirmed) opens only that Part's Step 1: it is not a Revision, and no confirmed
    Part reopens"."""
    read(qs_project, monkeypatch, STRUCTURAL)
    api = api_as(qs_project.member)
    structural = ids(proposals(api, qs_project.project_id), "structural")
    # One by one: its sheets have one source each, never in a bulk act (m0-screens 6.4; ticket 166).
    for proposal in structural:
        confirm(api, qs_project.project_id, [proposal])
    assert progress(api, qs_project.project_id)["structural"]["status"] == "confirmed"

    read(qs_project, monkeypatch, ELECTRICAL)

    rows = progress(api, qs_project.project_id)
    assert (rows["structural"]["status"], rows["structural"]["confirmed"]) == ("confirmed", 3)
    assert (rows["electrical"]["status"], rows["electrical"]["confirmed"]) == ("in_review", 0)
    listed = proposals(api, qs_project.project_id)
    assert all(p["decision"] == "confirmed" for p in listed if p["discipline"] == "structural")
    assert [p["number"] for p in listed if p["discipline"] == "electrical"] == ["E-01"]
    assert all(p["id"] != p["sheet_id"] for p in listed)


# #102: a sheet with no Discipline ----------------------------------------------------------------


def test_a_sheet_with_no_discipline_is_asked_which_discipline_it_is(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, NO_DISCIPLINE, {NO_DISCIPLINE: [
        Sheet("N-01", "GENERAL NOTES", ("GENERAL NOTES",)),
    ]})  # fmt: skip
    api = api_as(qs_project.member)
    sheet = the(proposals(api, qs_project.project_id), "N-01")
    assert sheet["discipline"] is None

    [q] = open_questions(api, qs_project.project_id, "missing_discipline")

    assert q["subject_id"] == sheet["sheet_id"]
    assert q["proposals"] == [sheet["id"]]
    assert {"structural", "architectural", "electrical"} <= set(keys(q))
    assert keys(q)[-1] == KEEP_OPEN
    assert picked(q) == []


def test_answering_which_discipline_lists_the_sheet_under_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, NO_DISCIPLINE, {NO_DISCIPLINE: [
        Sheet("N-01", "GENERAL NOTES", ("GENERAL NOTES",)),
    ]})  # fmt: skip
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing_discipline")

    response = answer(api, qs_project.project_id, q["id"], "structural")

    assert response.status_code == 200, response.content
    assert the(proposals(api, qs_project.project_id), "N-01")["discipline"] == "structural"
    assert None not in progress(api, qs_project.project_id)


def test_a_sheet_with_no_discipline_numbered_like_a_disciplines_sheet_raises_a_conflict(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#102: "A general-notes file numbering its sheets from 01 ... collides with the first
    structural sheets' numbers; 19b raises no `same_number` ... because it compares only sheets with
    a Discipline"."""
    drawn = {
        STRUCTURAL: [
            Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
            Sheet("02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
        ],
        NO_DISCIPLINE: [Sheet("01", "GENERAL NOTES", ("GENERAL NOTES",))],
    }
    read(qs_project, monkeypatch, STRUCTURAL, drawn)
    read(qs_project, monkeypatch, NO_DISCIPLINE, drawn)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    ones = [p for p in listed if p["number"] == "01"]
    assert sorted(p["discipline"] or "" for p in ones) == ["", "structural"]

    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert q["code"] == conflict_codes.SAME_NUMBER.code
    assert sorted(q["proposals"]) == sorted(p["id"] for p in ones)


# #135: a sheet left out for unreadable writing ------------------------------------------------------


def test_a_sheet_left_out_for_unreadable_writing_is_counted_in_coverage(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, STRUCTURAL, {STRUCTURAL: [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-02", "BEAM %%%% LAYOUT", ("ROOF BEAM LAYOUT PLAN",)),
    ]})  # fmt: skip
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    assert [p["number"] for p in listed] == ["S-01"]  # 21b's: the unreadable sheet is not listed
    assert all(p["id"] != p["sheet_id"] for p in listed)

    shown = coverage(api, qs_project.project_id)

    assert shown["unread_sheets"] == 1
    assert shown["views"] == 2  # S-01's view and its title block; nothing of the sheet left out
