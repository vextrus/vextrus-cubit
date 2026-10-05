"""Ticket 21c's Questions, raised by the read job as codes (docs/plans/M0.md, 21c: "Questions as codes:
`file_misread` for each file `drawings` holds ..., `missing`, `conflict` for a duplicate number with
revision mark, date and source file, for two sheets with one title that are not a continuation and
two plans of one storey, subject and layer (19b's conflicts), and for a read and a pasted or typed
drawing list that disagree, `low_confidence`, boundary storeys ..., `check`; the Checks run"), and
their answers (m0-screens §5 and 6.7: "Answering records who and when and confirms or excludes what
the Question held"; "'Keep open, ask the consultant' keeps the Question open").

The options are keyed as the seed keys them (`vextrus/seed/takeoff.py`: `{key, picked}`, the last
`keep_open`); the words of each are the web's.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from engine.messages import register_check as list_codes
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import CheckRun
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

from .step1_whole import (
    HELD_OPTIONS,
    KEEP_OPEN,
    Sheet,
    a_file,
    answer,
    coverage,
    jev_says,
    keys,
    of_number,
    open_questions,
    picked,
    progress,
    proposals,
    questions,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
HELD = "KR-STR-old.dwg"


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet], name: str = STRUCTURAL,
         *, held: bool = False) -> uuid.UUID:  # fmt: skip
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}, held=[name] if held else []))
    return file_id


def by_id(listed: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {p["id"]: p for p in listed}


# A held file: `file_misread` ---------------------------------------------------------------------


PLAIN = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
]


def test_a_file_whose_readers_disagree_raises_one_file_misread_question_about_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read(qs_project, monkeypatch, PLAIN, HELD, held=True)
    api = api_as(qs_project.member)
    shown = a_file(api, qs_project.project_id, file_id)
    assert shown["state"] == "held"

    [q] = open_questions(api, qs_project.project_id, "file_misread")

    assert q["subject_id"] == str(file_id)
    assert q["discipline"] == "structural"
    # Its words are the file's finding, the two readers' counts (m0-screens 6.7's held-file row).
    assert (q["code"], q["params"]) == (shown["finding"]["code"], shown["finding"]["params"])
    assert keys(q) == HELD_OPTIONS
    assert picked(q) == []  # "none pre-picked; screens.md Step 1 ruling 3"


def test_a_held_files_sheets_are_neither_listed_nor_counted(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, PLAIN, HELD, held=True)
    api = api_as(qs_project.member)
    assert open_questions(api, qs_project.project_id, "file_misread")

    assert proposals(api, qs_project.project_id) == []
    assert coverage(api, qs_project.project_id)["views"] == 0


def test_reading_a_held_file_again_asks_its_question_once(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read(qs_project, monkeypatch, PLAIN, HELD, held=True)

    run_job(qs_project.member, file_id, monkeypatch, readers({HELD: PLAIN}, held=[HELD]))

    asked = questions(api_as(qs_project.member), qs_project.project_id)
    assert [q["kind"] for q in asked] == ["file_misread"]


# Conflicts ---------------------------------------------------------------------------------------


DUPLICATE = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
]


def test_two_sheets_with_one_number_raise_one_conflict_holding_both_copies(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    copies = of_number(listed, "S-02")

    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert q["code"] == conflict_codes.SAME_NUMBER.code
    assert q["params"]["number"] == "S-02"
    assert q["discipline"] == "structural"
    assert sorted(q["proposals"]) == sorted(p["id"] for p in copies)
    # Each copy with its revision mark, date and source file, from the Proposals it holds.
    held = by_id(listed)
    assert sorted(held[i]["revision_mark"] for i in q["proposals"]) == ["R0", "R1"]
    assert all(held[i]["issue_date"] and held[i]["file_name"] == STRUCTURAL for i in q["proposals"])
    assert keys(q)[-1] == KEEP_OPEN


def test_answering_the_first_option_keeps_the_later_revision_and_leaves_the_other_out_as_superseded(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5: option 1 "Keep rev B (20 Aug 2026); exclude rev A as superseded"."""
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")

    response = answer(api, qs_project.project_id, q["id"], keys(q)[0])

    assert response.status_code == 200, response.content
    copies = {p["revision_mark"]: p for p in of_number(proposals(api, qs_project.project_id), "S-02")}
    assert copies["R1"]["decision"] == "confirmed"
    assert (copies["R0"]["decision"], copies["R0"]["excluded_reason"]) == ("excluded", "superseded")
    assert copies["R1"]["decided_by"] == qs_project.member.user.name
    [done] = [x for x in questions(api, qs_project.project_id) if x["id"] == q["id"]]
    assert done["status"] == "answered"
    assert done["answered_at"] is not None


def test_one_title_on_sheets_that_do_not_run_on_raises_a_same_title_conflict(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [
        Sheet("S-01", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
        Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
        Sheet("S-04", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert q["code"] == conflict_codes.SAME_TITLE.code
    assert sorted(q["proposals"]) == sorted(the(listed, n)["id"] for n in ("S-01", "S-04"))


def test_a_continuation_raises_no_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5: "identical titles on consecutive numbers are one continuation ... with no
    Question"."""
    read(qs_project, monkeypatch, [
        Sheet("S-01", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    assert len(proposals(api, qs_project.project_id)) == 3
    assert all(p["id"] != p["sheet_id"] for p in proposals(api, qs_project.project_id))

    assert open_questions(api, qs_project.project_id) == []


def test_two_plans_of_one_storey_subject_and_layer_raise_a_same_storey_conflict(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan = "5TH FLOOR SLAB BOTTOM REINFORCEMENT PLAN"
    read(qs_project, monkeypatch, [
        Sheet("S-01", "SLAB LAYOUT", (plan,)),
        Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-03", "SLAB REINFORCEMENT PLAN", (plan,)),  # a layout Sheet: T-W334
    ])  # fmt: skip
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert q["code"] == conflict_codes.SAME_STOREY.code
    assert (q["params"]["layer"], q["params"]["subject"], q["params"]["storey"]) == (
        "bottom",
        "slab",
        "floor_5",
    )
    assert sorted(q["proposals"]) == sorted(the(listed, n)["id"] for n in ("S-01", "S-03"))


def test_a_read_drawing_list_and_a_pasted_one_that_disagree_raise_a_conflict(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5: "The drawing list on S-01 and the one you pasted differ" (N shows "—" until
    answered)."""
    listed_rows = (("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"))
    read(qs_project, monkeypatch, [
        Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=listed_rows),
        Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    assert open_questions(api, qs_project.project_id, "conflict") == []

    pasted = api.post(
        f"{step1(qs_project.project_id)}/drawing-list",
        {"discipline": "structural", "text": "S-01 to S-04"},
    )

    assert pasted.status_code == 200, pasted.content
    [q] = open_questions(api, qs_project.project_id, "conflict")
    assert q["discipline"] == "structural"
    assert keys(q)[-1] == KEEP_OPEN
    assert progress(api, qs_project.project_id)["structural"]["total"] is None


# Missing, low confidence, boundary storeys --------------------------------------------------------


def test_a_sheet_with_no_number_raises_a_missing_question_that_a_typed_number_answers(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    unnumbered = the(proposals(api, qs_project.project_id), None)

    [q] = open_questions(api, qs_project.project_id, "missing")
    assert q["subject_id"] == unnumbered["sheet_id"]
    assert q["proposals"] == [unnumbered["id"]]
    # No list names it: "Leave it without a number", "Type a number", "Keep open" (m0-screens §7, Q3).
    assert keys(q) == ["no_number", "type_number", KEEP_OPEN]
    assert picked(q) == []

    response = answer(api, qs_project.project_id, q["id"], "type_number", text="S-02")

    assert response.status_code == 200, response.content
    assert the(proposals(api, qs_project.project_id), "S-02")["sheet_id"] == unnumbered["sheet_id"]


A_05 = Sheet("A-05", "SECTION A-A & ELEVATION", ("SECTION A-A", "FRONT ELEVATION"))
"""m0-screens §7: A-05 "SECTION A-A & ELEVATION" (kind unclear)."""


def test_jevs_sure_answer_is_the_proposed_kind_and_asks_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [A_05], "KR-ARC-R0.dwg")
    api = api_as(qs_project.member)

    [sheet] = proposals(api, qs_project.project_id)

    assert sheet["jev_pick"] is not None
    assert sheet["jev_pick"]["choice"] == sheet["jev_pick"]["options"][0]
    assert sheet["kind"] == sheet["jev_pick"]["choice"]
    assert open_questions(api, qs_project.project_id, "low_confidence") == []


def test_jevs_unsure_answer_raises_a_low_confidence_question_with_the_kinds_none_picked(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """§7's Q4, "the kind of A-05 (no pre-pick)": the kinds its Discipline has, most likely first,
    none pre-picked unless a second source agrees (Jev is one source)."""
    jev_says(jev_offline, "0.34")
    read(qs_project, monkeypatch, [A_05], "KR-ARC-R0.dwg")
    api = api_as(qs_project.member)
    [sheet] = proposals(api, qs_project.project_id)

    [q] = open_questions(api, qs_project.project_id, "low_confidence")

    assert q["subject_id"] == sheet["sheet_id"]
    assert q["proposals"] == [sheet["id"]]
    assert q["discipline"] == "architectural"
    assert len(keys(q)) >= 3
    assert keys(q)[-1] == KEEP_OPEN
    assert picked(q) == []


def test_with_typesafe_down_every_sheet_is_still_proposed_its_kind_left_to_the_qs(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_down: Callable[[str], None]
) -> None:
    jev_down("timeout")
    file_id = read(qs_project, monkeypatch, PLAIN)
    api = api_as(qs_project.member)

    listed = proposals(api, qs_project.project_id)

    assert [p["number"] for p in listed] == ["S-01", "S-02"]
    assert all(p["id"] != p["sheet_id"] and p["jev_pick"] is None for p in listed)
    with qs_project.member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ


def test_two_column_ranges_meeting_at_one_storey_ask_where_the_first_ends(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens 6.7's boundary storey: "Does 'Basement to 1st floor' include the 1st storey?" ...
    "S-08 'Column layout plan, 1st to 9th floor' also starts at the 1st" (19b raises no conflict for
    them: consecutive ranges meet at a floor)."""
    read(qs_project, monkeypatch, [
        Sheet("S-07", "COLUMN LAYOUT PLAN BASEMENT TO 1ST FLOOR",
              ("COLUMN LAYOUT PLAN BASEMENT TO 1ST FLOOR",)),
        Sheet("S-08", "COLUMN LAYOUT PLAN 1ST TO 9TH FLOOR", ("COLUMN LAYOUT PLAN 1ST TO 9TH FLOOR",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    asked = open_questions(api, qs_project.project_id)

    assert [q for q in asked if q["code"] == conflict_codes.SAME_STOREY.code] == []
    [q] = [q for q in asked if the(listed, "S-07")["id"] in q["proposals"]]
    assert keys(q)[-1] == KEEP_OPEN
    assert picked(q) == []


# The Checks: the drawing list against the sheets -----------------------------------------------


def test_the_checks_run_on_reading_and_a_listed_sheet_in_no_file_raises_a_check_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [
        Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=(
            ("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"),
            ("S-04", "ROOF BEAM LAYOUT PLAN"),
        )),
        Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)

    [q] = open_questions(api, qs_project.project_id, "check")

    assert (q["check_code"], q["code"], q["params"]) == (
        "register",
        list_codes.NOT_FOUND.code,
        {"number": "S-04"},
    )
    assert keys(q)[-1] == KEEP_OPEN
    with qs_project.member.acting():
        ran = CheckRun.objects.filter(project_id=qs_project.project_id, trigger="read")
        assert "register" in {r.check_key for r in ran}


# Answering ---------------------------------------------------------------------------------------


def test_keep_open_keeps_the_question_open_and_its_discipline_unconfirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")
    others = [p["id"] for p in proposals(api, qs_project.project_id) if p["id"] not in q["proposals"]]
    api.post(f"{step1(qs_project.project_id)}/confirm", {"proposals": others})

    response = answer(api, qs_project.project_id, q["id"], KEEP_OPEN)

    assert response.status_code == 200, response.content
    assert [x["id"] for x in open_questions(api, qs_project.project_id, "conflict")] == [q["id"]]
    row = progress(api, qs_project.project_id)["structural"]
    assert row["open_questions"] == 1
    assert row["status"] != "confirmed"


def test_an_option_the_question_does_not_offer_is_refused_with_a_code_and_changes_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")

    response = answer(api, qs_project.project_id, q["id"], "an_option_never_offered")

    assert response.status_code == 400, response.content
    assert set(response.json()) == {"code", "params"}
    assert [x["id"] for x in open_questions(api, qs_project.project_id, "conflict")] == [q["id"]]
    assert all(p["decision"] is None for p in proposals(api, qs_project.project_id))


def test_the_md_reads_the_questions_but_cannot_answer_one(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    md = api_as(sign_in(role="md", developer_id=qs_project.member.developer_id))
    [q] = open_questions(md, qs_project.project_id, "conflict")

    response = answer(md, qs_project.project_id, q["id"], keys(q)[0])

    assert response.status_code == 403, response.content
    assert [x["id"] for x in open_questions(md, qs_project.project_id, "conflict")] == [q["id"]]
