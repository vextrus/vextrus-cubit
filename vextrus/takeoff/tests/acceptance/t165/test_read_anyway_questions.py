"""Issue #165 (M0 fix W7): a held file, answered "read anyway", raises the Questions a normal read
raises. The walk found a held file read anyway with 0 Questions, not even `missing` for its two
numberless sheets ("The QS who chooses to read a held file loses every check Vextrus would otherwise
make on it").

Acceptance to pin (the issue): "Held, then read anyway, yields the same Questions as a normal read of
the same artefact."

Two Projects of one Developer read the same invented sheets (21c's fixtures, `t21c/step1_whole`):
one normally, one held (the second reader disagrees, forced by the test's readers as 21c's tests
force it), answered "read anyway" and read again by its job. The Questions are compared by kind,
code, parameters, Discipline, check and the sheets they name and hold (by number and title, as the
ids differ between Projects); the held file's own `file_misread` Question is left out of the
comparison and pinned on its own (answered, asked once).
"""

import uuid
from typing import Any

import pytest

from vextrus.projects import services as projects
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from ..t21c.step1_whole import (
    Sheet,
    answer,
    jev_says,
    open_questions,
    proposals,
    questions,
    readers,
    run_job,
    uploaded,
)

pytestmark = pytest.mark.django_db

NAME = "KR-STR-R0.dwg"
SHEETS = [
    Sheet("S-01", "GENERAL NOTES", ("GENERAL NOTES",), register=(
        ("S-01", "GENERAL NOTES"), ("S-02", "PILE LAYOUT PLAN"), ("S-03", "COLUMN SCHEDULE"),
        ("S-04", "ROOF BEAM LAYOUT PLAN"),
    )),
    Sheet("S-02", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-03", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
    Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
    Sheet(None, "LIFT PIT DETAILS", ("LIFT PIT SECTION",)),
]  # fmt: skip
"""Invented: a drawing list naming a sheet in no file (a `check`), one number on two revisions (a
`conflict`) and two sheets with no number (a `missing` each), as the walk's held file had two."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def another_project(qs: QsProject) -> QsProject:
    with qs.member.acting():
        project = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another test project")
    return QsProject(qs.member, project.id)


def read_normally(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> None:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: SHEETS}))


def held_then_read_anyway(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    """The file held (its readers disagree), its `file_misread` answered "read anyway", and its read
    job (queued by the answer) run as its worker would; answers the file's id."""
    file_id = uploaded(qs.member, qs.project_id, NAME)
    held = readers({NAME: SHEETS}, held=[NAME])
    run_job(qs.member, file_id, monkeypatch, held)
    api = api_as(qs.member)
    [q] = open_questions(api, qs.project_id, "file_misread")
    response = answer(api, qs.project_id, q["id"], "read_anyway")
    assert response.status_code == 200, response.content
    run_job(qs.member, file_id, monkeypatch, held)
    return file_id


def sheet_names(api: Any, project_id: uuid.UUID) -> tuple[dict[str, Any], dict[str, Any]]:
    """Each Proposal's and each sheet's (number, title, revision mark), the same in both Projects."""
    listed = proposals(api, project_id)
    by_proposal = {p["id"]: (p["number"], p["title"], p["revision_mark"]) for p in listed}
    by_sheet = {p["sheet_id"]: (p["number"], p["title"], p["revision_mark"]) for p in listed}
    return by_proposal, by_sheet


def asked(api: Any, project_id: uuid.UUID) -> list[tuple[Any, ...]]:
    """The Project's Questions but `file_misread`, each as the QS reads it, the sheets it names and
    holds by number, title and revision mark; sorted."""
    by_proposal, by_sheet = sheet_names(api, project_id)
    found = []
    for q in questions(api, project_id):
        if q["kind"] == "file_misread":
            continue
        subject = q["subject_id"]
        found.append((
            q["kind"],
            q["status"],
            q["code"],
            repr(sorted(q["params"].items())),
            q["discipline"],
            q["check_code"],
            repr(by_sheet.get(subject, "not a sheet" if subject else None)),
            repr(sorted(repr(by_proposal.get(p)) for p in q["proposals"])),
        ))  # fmt: skip
    return sorted(found)


def test_a_held_file_read_anyway_raises_the_same_questions_as_a_normal_read(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    normal = qs_project
    read_normally(normal, monkeypatch)
    anyway = another_project(qs_project)

    held_then_read_anyway(anyway, monkeypatch)

    api = api_as(qs_project.member)
    expected = asked(api, normal.project_id)
    assert {row[0] for row in expected} >= {"missing", "conflict", "check"}  # the fixture's own
    assert asked(api, anyway.project_id) == expected


def test_a_held_file_read_anyway_asks_missing_for_each_numberless_sheet(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    held_then_read_anyway(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    numberless = [p for p in proposals(api, qs_project.project_id) if p["number"] is None]
    assert len(numberless) == 2

    missing = open_questions(api, qs_project.project_id, "missing")

    assert sorted((q["subject_id"], tuple(q["proposals"])) for q in missing) == sorted(
        (p["sheet_id"], (p["id"],)) for p in numberless
    )


def test_a_held_file_read_anyway_raises_the_conflict_for_its_number_on_two_revisions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    held_then_read_anyway(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    copies = [p for p in proposals(api, qs_project.project_id) if p["number"] == "S-03"]

    [q] = [c for c in open_questions(api, qs_project.project_id, "conflict")
           if c["params"].get("number") == "S-03"]  # fmt: skip

    assert sorted(q["proposals"]) == sorted(p["id"] for p in copies)


def test_a_held_file_read_anyway_raises_the_check_for_a_listed_sheet_in_no_file(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    held_then_read_anyway(qs_project, monkeypatch)
    api = api_as(qs_project.member)

    checks = open_questions(api, qs_project.project_id, "check")

    assert ("register", {"number": "S-04"}) in [(q["check_code"], q["params"]) for q in checks]


def test_a_held_file_read_anyway_keeps_its_file_misread_answered_and_asks_it_once(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = held_then_read_anyway(qs_project, monkeypatch)

    misread = [
        q for q in questions(api_as(qs_project.member), qs_project.project_id)
        if q["kind"] == "file_misread"
    ]  # fmt: skip

    assert [(q["subject_id"], q["status"]) for q in misread] == [(str(file_id), "answered")]
