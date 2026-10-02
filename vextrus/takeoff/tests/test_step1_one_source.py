"""Ticket 166, fix round 1 (the words gate's must (a)): a bulk act naming a sheet an open Question
holds (a conflict, a low confidence) is refused as `question_first`, naming that Question, never as
`one_source` ("S-02 has one source" was false: the Question, not a lone confirm, settles it)."""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
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
    shown = proposals(api, qs_project.project_id)
    read_anyway = the(shown, "S-03")
    assert read_anyway["agrees"] is False

    lone = the(shown, "S-02")
    assert lone["agrees"] is False  # S-01 and S-02 with no list or Plot: one source each

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
