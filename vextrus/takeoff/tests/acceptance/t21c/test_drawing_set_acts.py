"""Issue #118, handed to 21c: the Drawing Set's acts that had no operation behind them (20b's design
gate: "Each needs its operation and then its words and control; 22 and 21c should pick them up").
21c supplies the operations and fields; 22 wires the controls to them.

- **"Open the Question"** (m0-screens 4.5, a held file's row and report): the held file's
  `file_misread` Question is the one whose `subject_id` is the file's id.
- **The held file's answers** (4.5's "Held, answered" row): "Held, read anyway: its sheets are marked"
  / "Set aside: waiting for the re-saved file" / "Set aside: sent to Vextrus to check", as the file's
  status, from answering its Question.
- **"Mark for Vextrus"** on a file that could not be read (4.5's Failed row):
  `POST /api/projects/{project_id}/drawings/files/{file_id}/mark-for-vextrus`, the file then carrying
  `marked_for_vextrus: true` (the acceptance writer's names).
- **The Bangla text section's sheets** ("Then the sheets, each a link into Step 1 ('A-02: 5 texts')"):
  the report's `bangla_sheets`, each `{sheet_id, number, texts}` in sheet order.
- **The Fonts table's "Sheets" column**: each of the report's `font_rows` carries `sheets`, how many
  of the file's sheets its texts are on.
- **"Open in Step 1"**: each of the file's sheets is a Proposal carrying the file's id (`file_id`).
"""

import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from engine.messages import read as read_codes
from engine.read import ReadArtefact, ReadError
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

from .step1_whole import (
    NOT_FOUND,
    Sheet,
    a_file,
    answer,
    english,
    files_path,
    got,
    jev_says,
    open_questions,
    proposals,
    questions,
    readers,
    run_job,
    the,
    uploaded,
)

pytestmark = pytest.mark.django_db

HELD = "KR-STR-old.dwg"
STRUCTURAL = "KR-STR-R0.dwg"
SHEETS = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "GROUND FLOOR PLAN", ("GROUND FLOOR BEAM LAYOUT PLAN",), bangla=2),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), bangla=1),
]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def held_file(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, HELD)
    run_job(qs.member, file_id, monkeypatch, readers({HELD: SHEETS}, held=[HELD]))
    return file_id


def status_words(api: Any, project_id: uuid.UUID, file_id: uuid.UUID) -> str | None:
    return english(a_file(api, project_id, file_id)["status"]["code"])


# Open the Question, and the held file's answers ---------------------------------------------------


def test_a_held_files_question_is_the_one_about_that_file(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_file(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert status_words(api, qs_project.project_id, file_id) == (
        "Held: the two readers disagree, so it may be misread"
    )

    about = [q for q in questions(api, qs_project.project_id) if q["subject_id"] == str(file_id)]

    assert [(q["kind"], q["status"]) for q in about] == [("file_misread", "open")]


def test_read_it_anyway_lists_the_files_sheets_each_marked_held(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_file(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "file_misread")

    response = answer(api, qs_project.project_id, q["id"], "read_anyway")
    # Its sheets are read by the file's read job (queued by the answer; run here as its worker would).
    run_job(qs_project.member, file_id, monkeypatch, readers({HELD: SHEETS}, held=[HELD]))

    assert response.status_code == 200, response.content
    assert status_words(api, qs_project.project_id, file_id) == (
        "Held, read anyway: its sheets are marked"
    )
    listed = proposals(api, qs_project.project_id)
    assert [p["number"] for p in listed] == ["S-01", "S-02", "S-03"]
    assert all(p["held"] and p["file_id"] == str(file_id) for p in listed)
    assert open_questions(api, qs_project.project_id, "file_misread") == []


@pytest.mark.parametrize(
    ("option", "words"),
    [
        ("sent_to_vextrus", "Set aside: sent to Vextrus to check"),
        ("await_resaved", "Set aside: waiting for the re-saved file"),
    ],
)
def test_setting_the_file_aside_says_so_on_its_row_and_lists_nothing_from_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, option: str, words: str
) -> None:
    file_id = held_file(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "file_misread")

    response = answer(api, qs_project.project_id, q["id"], option)

    assert response.status_code == 200, response.content
    assert status_words(api, qs_project.project_id, file_id) == words
    assert proposals(api, qs_project.project_id) == []
    [done] = [x for x in questions(api, qs_project.project_id) if x["id"] == q["id"]]
    assert done["status"] == "answered"


# Mark for Vextrus, on a file that could not be read ----------------------------------------------


def failed_file(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)

    def fails(path: Path, name: str) -> ReadArtefact:
        raise ReadError(read_codes.READER_FAILED())

    given = readers({STRUCTURAL: SHEETS})
    use = type(given)(**{**given.__dict__, "dwg": fails})
    with pytest.raises(Exception, match="was not read"):
        run_job(qs.member, file_id, monkeypatch, use)
    return file_id


def mark_path(project_id: uuid.UUID, file_id: uuid.UUID) -> str:
    return f"{files_path(project_id)}/{file_id}/mark-for-vextrus"


def test_a_file_that_could_not_be_read_can_be_marked_for_vextrus(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = failed_file(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    assert a_file(api, qs_project.project_id, file_id)["state"] == "failed"

    response = api.post(mark_path(qs_project.project_id, file_id))

    assert response.status_code == 200, response.content
    assert response.json()["marked_for_vextrus"] is True
    assert a_file(api, qs_project.project_id, file_id)["marked_for_vextrus"] is True


def test_the_md_cannot_mark_a_file_and_another_developer_finds_none(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    file_id = failed_file(qs_project, monkeypatch)
    md = api_as(sign_in(role="md", developer_id=qs_project.member.developer_id))
    stranger = api_as(sign_in(role="qs"))

    by_md = md.post(mark_path(qs_project.project_id, file_id))
    by_stranger = stranger.post(mark_path(qs_project.project_id, file_id))

    assert by_md.status_code == 403, by_md.content
    assert (by_stranger.status_code, by_stranger.json()) == (404, NOT_FOUND)
    shown = a_file(api_as(qs_project.member), qs_project.project_id, file_id)
    assert shown["marked_for_vextrus"] is False


# The report's sheets: Bangla text and fonts; Open in Step 1 ---------------------------------------


def read_file_with_bangla(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, STRUCTURAL)
    run_job(qs.member, file_id, monkeypatch, readers({STRUCTURAL: SHEETS}))
    return file_id


def test_the_report_names_each_sheet_with_bangla_text_and_how_many_texts(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read_file_with_bangla(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    report = got(api, f"{files_path(qs_project.project_id)}/{file_id}/report")

    assert report["bangla_sheets"] == [
        {"sheet_id": the(listed, "S-02")["sheet_id"], "number": "S-02", "texts": 2},
        {"sheet_id": the(listed, "S-03")["sheet_id"], "number": "S-03", "texts": 1},
    ]


def test_each_font_row_says_how_many_sheets_its_texts_are_on(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read_file_with_bangla(qs_project, monkeypatch)

    report = got(api_as(qs_project.member), f"{files_path(qs_project.project_id)}/{file_id}/report")

    rows = report["font_rows"]
    assert rows
    assert all(isinstance(r["sheets"], int) and 0 <= r["sheets"] <= len(SHEETS) for r in rows)
    # Every sheet's title block is lettered in the drawing's one font.
    assert max(r["sheets"] for r in rows) == len(SHEETS)


def test_each_sheet_of_a_read_file_is_a_proposal_carrying_the_files_id(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read_file_with_bangla(qs_project, monkeypatch)

    listed = proposals(api_as(qs_project.member), qs_project.project_id)

    assert [p["number"] for p in listed] == ["S-01", "S-02", "S-03"]
    assert all(p["file_id"] == str(file_id) and p["id"] != p["sheet_id"] for p in listed)
