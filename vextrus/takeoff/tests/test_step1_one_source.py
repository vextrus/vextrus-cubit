"""Ticket 166, fix round 1 (the words gate's must (a)): a bulk act naming a sheet an open Question
holds (a conflict, a low confidence) is refused as `question_first`, naming that Question, never as
`one_source` ("S-02 has one source" was false: the Question, not a lone confirm, settles it)."""

import uuid
from collections.abc import Callable
from dataclasses import replace
from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1 as step1_service
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    english,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

NAME = "STR-SET.dwg"
DUPLICATE = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
]
CLEAN = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
]


def _read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> None:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: sheets}))


def test_a_bulk_act_naming_a_sheet_a_conflict_holds_is_refused_naming_the_conflict(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    _read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    listed = api.post(
        f"{step1(qs_project.project_id)}/drawing-list",
        {"discipline": "structural", "text": "S-01 to S-02"},
    )
    assert listed.status_code == 200, listed.content
    [conflict] = open_questions(api, qs_project.project_id, "conflict")
    shown = proposals(api, qs_project.project_id)
    assert the(shown, "S-01")["agrees"] is True
    copy = next(p for p in shown if p["id"] in conflict["proposals"])

    refused = confirm(api, qs_project.project_id, [the(shown, "S-01")["id"], copy["id"]])

    assert refused.status_code == 409, refused.content
    assert refused.json() == {
        "code": "takeoff.step1.question_first",
        "params": {
            "count": 1,
            "asks": "held",
            "question": conflict["id"],
            "sheet": "S-02",
            "named": "number",
        },
    }
    assert all(p["decision"] != "confirmed" for p in proposals(api, qs_project.project_id))


def test_a_bulk_act_naming_sheets_low_confidence_holds_is_refused_naming_its_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.34")
    _read(qs_project, monkeypatch, CLEAN)
    api = api_as(qs_project.member)
    shown = proposals(api, qs_project.project_id)
    first = the(shown, "S-01")
    holding = [
        q
        for q in open_questions(api, qs_project.project_id, "low_confidence")
        if first["id"] in q["proposals"]
    ]
    assert holding, "the stand-in's 0.34 raises a low-confidence Question on S-01"

    refused = confirm(api, qs_project.project_id, [first["id"], the(shown, "S-02")["id"]])

    assert refused.status_code == 409, refused.content
    body = refused.json()
    assert body["code"] == "takeoff.step1.question_first"
    assert (body["params"]["asks"], body["params"]["sheet"], body["params"]["count"]) == (
        "held",
        "S-01",
        2,
    )
    assert body["params"]["question"] in {q["id"] for q in holding}
    assert all(p["decision"] != "confirmed" for p in proposals(api, qs_project.project_id))


def test_a_bulk_act_naming_a_held_files_sheet_read_anyway_is_refused_as_held_not_one_source(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The words gate's may 4: its file Question answered, no open Question holds the sheet, and it
    never agrees; "has one source" would be false of it."""
    jev_says(jev_offline, "0.97")
    _read(qs_project, monkeypatch, CLEAN)
    held_name = "STR-OLD.dwg"
    held = uploaded(qs_project.member, qs_project.project_id, held_name)
    use = readers({held_name: [Sheet("S-03", "BEAM LAYOUT", ("BEAM LAYOUT",))]}, held=[held_name])
    run_job(qs_project.member, held, monkeypatch, use)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "file_misread")
    assert answer(api, qs_project.project_id, q["id"], "read_anyway").status_code == 200
    run_job(qs_project.member, held, monkeypatch, use)
    # S-01 and S-02 with their titles read from the file name: one source each, off the
    # title-block basis (#320) too.
    sheets_of = step1_service._sheets

    def from_file_names(project_id: uuid.UUID) -> list[drawings.SheetView]:
        return [
            replace(s, sources={**s.sources, "title": "file_name"}) if s.number != "S-03" else s
            for s in sheets_of(project_id)
        ]

    monkeypatch.setattr(step1_service, "_sheets", from_file_names)
    shown = proposals(api, qs_project.project_id)
    read_anyway = the(shown, "S-03")
    assert read_anyway["agrees"] is False

    lone = the(shown, "S-02")
    assert lone["agrees"] is False

    refused = confirm(api, qs_project.project_id, [lone["id"], read_anyway["id"]])

    assert refused.status_code == 409, refused.content
    assert refused.json() == {
        "code": "takeoff.step1.held_file",
        "params": {"count": 1, "sheets": [read_anyway["id"]], "sheet": "S-03", "named": "number"},
    }
    # The words gate's may 3: the held sheet taken out, the rest is refused for its one source.
    again = confirm(api, qs_project.project_id, [lone["id"], the(shown, "S-01")["id"]])
    assert again.status_code == 409, again.content
    assert again.json()["code"] == "takeoff.step1.one_source"
    assert again.json()["params"]["sheets"] == [lone["id"], the(shown, "S-01")["id"]]
    assert all(p["decision"] != "confirmed" for p in proposals(api, qs_project.project_id))


def test_a_bulk_act_refused_for_its_question_is_refused_for_its_one_source_sheet_once_answered(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The words gate's may 5: the order is a decision. The held sheet's Question first (answer it);
    then the sheet with one source (open it on its own)."""
    jev_says(jev_offline, "0.97")
    _read(qs_project, monkeypatch, [*DUPLICATE, Sheet("S-03", "BEAM LAYOUT", ("BEAM LAYOUT",))])
    api = api_as(qs_project.member)
    listed = api.post(
        f"{step1(qs_project.project_id)}/drawing-list",
        {"discipline": "structural", "text": "S-01 to S-02"},
    )
    assert listed.status_code == 200, listed.content
    [conflict] = open_questions(api, qs_project.project_id, "conflict")
    shown = proposals(api, qs_project.project_id)
    lone = the(shown, "S-03")
    copy = next(p for p in shown if p["id"] in conflict["proposals"])
    chosen = [the(shown, "S-01")["id"], lone["id"], copy["id"]]

    first = confirm(api, qs_project.project_id, chosen)
    assert first.status_code == 409, first.content
    assert (first.json()["code"], first.json()["params"]["question"]) == (
        "takeoff.step1.question_first",
        conflict["id"],
    )
    assert answer(api, qs_project.project_id, conflict["id"], "keep_latest").status_code == 200

    second = confirm(api, qs_project.project_id, [the(shown, "S-01")["id"], lone["id"]])

    assert second.status_code == 409, second.content
    assert second.json()["code"] == "takeoff.step1.one_source"
    assert second.json()["params"]["sheets"] == [lone["id"]]


# Fix round 2, F1 (50; the words gate's class again): every reason `_agreeing` leaves a sheet out
# maps to a refusal whose words are true of it. A Question that holds the sheet (by subject, by link,
# or, the two drawing lists disagreeing, by its Discipline) is named; a held file's sheet is "held";
# only a sheet with one source is said to have one.

LISTED = (("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"))
THREE = [
    Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",)),
    Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",)),
]


Case = tuple[list[str], str, str | None]


def _typed(api: Any, qs: QsProject, text: str) -> None:
    listed = api.post(f"{step1(qs.project_id)}/drawing-list", {"discipline": "structural", "text": text})
    assert listed.status_code == 200, listed.content


def _lists_disagree(qs: QsProject, monkeypatch: pytest.MonkeyPatch, api: Any) -> Case:
    _read(
        qs,
        monkeypatch,
        [Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=LISTED), *THREE[1:]],
    )
    _typed(api, qs, "S-01 to S-04")
    [q] = open_questions(api, qs.project_id, "conflict")
    shown = proposals(api, qs.project_id)
    return [the(shown, "S-02")["id"], the(shown, "S-03")["id"]], "question_first", q["id"]


def _same_number(qs: QsProject, monkeypatch: pytest.MonkeyPatch, api: Any) -> Case:
    _read(qs, monkeypatch, DUPLICATE)
    _typed(api, qs, "S-01 to S-02")
    [q] = open_questions(api, qs.project_id, "conflict")
    shown = proposals(api, qs.project_id)
    copy = next(p for p in shown if p["id"] in q["proposals"])
    return [the(shown, "S-01")["id"], copy["id"]], "question_first", q["id"]


def _no_number(qs: QsProject, monkeypatch: pytest.MonkeyPatch, api: Any) -> Case:
    _read(qs, monkeypatch, [THREE[0], Sheet(None, "STAIR DETAILS", ("STAIR SECTION",))])
    [q] = open_questions(api, qs.project_id, "missing")
    shown = proposals(api, qs.project_id)
    return [the(shown, "S-01")["id"], the(shown, None)["id"]], "question_first", q["id"]


def _not_on_the_list(qs: QsProject, monkeypatch: pytest.MonkeyPatch, api: Any) -> Case:
    _read(qs, monkeypatch, THREE)
    _typed(api, qs, "S-01 to S-02")
    assert open_questions(api, qs.project_id) == []
    shown = proposals(api, qs.project_id)
    return [the(shown, "S-01")["id"], the(shown, "S-03")["id"]], "one_source", None


def _a_gap_and_no_list(qs: QsProject, monkeypatch: pytest.MonkeyPatch, api: Any) -> Case:
    _read(qs, monkeypatch, [THREE[0], THREE[2]])
    # The gap's `check` Question holds no sheet (it asks about S-02, which is not read).
    assert all(q["proposals"] == [] for q in open_questions(api, qs.project_id))
    shown = proposals(api, qs.project_id)
    return [the(shown, "S-01")["id"], the(shown, "S-03")["id"]], "one_source", None


REASONS: dict[str, Callable[[QsProject, pytest.MonkeyPatch, Any], Case]] = {
    "lists_disagree": _lists_disagree,
    "same_number": _same_number,
    "no_number": _no_number,
    "not_on_the_list": _not_on_the_list,
    "a_gap_and_no_list": _a_gap_and_no_list,
}


@pytest.mark.parametrize("reason", list(REASONS))
def test_every_reason_a_sheet_does_not_agree_is_refused_in_true_words(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline, reason: str
) -> None:
    jev_says(jev_offline, "0.97")
    api = api_as(qs_project.member)
    chosen, code, question = REASONS[reason](qs_project, monkeypatch, api)
    assert not any(p["agrees"] for p in proposals(api, qs_project.project_id) if p["id"] in chosen[1:])

    refused = confirm(api, qs_project.project_id, chosen)

    assert refused.status_code == 409, refused.content
    body = refused.json()
    assert body["code"] == f"takeoff.step1.{code}", body
    if question is not None:
        assert body["params"]["question"] == question
    else:
        # Only sheets with one source are said to have one: none an open Question holds.
        held = {p for q in open_questions(api, qs_project.project_id) for p in q["proposals"]}
        assert not set(body["params"]["sheets"]) & held
    assert all(p["decision"] != "confirmed" for p in proposals(api, qs_project.project_id))


def test_the_refusals_words_say_why_the_sheets_wait() -> None:
    """Fix round 2's words (the gate's mays): the number/Discipline plural says what the Question is
    about; a held sheet says why it is held."""
    assert "a Question about their number or Discipline" in (
        english("takeoff.step1.question_first") or ""
    )
    assert "is marked held because its file may be misread" in (english("takeoff.step1.held_file") or "")
