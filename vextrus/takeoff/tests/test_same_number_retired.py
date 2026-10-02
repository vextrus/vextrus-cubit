"""#161 beyond its acceptance tests: the orchestrator's rulings 3 to 5 on hand-built artefacts, as
`acceptance/t21c` builds them. A conflict not found again is retired (`withdrawn`, still listed) and
asked again (open) when it is found again; an answered one is never touched; the sheets of a file of
no Discipline are compared with each other, and only with each other."""

import uuid
from typing import Any

import pytest

from engine.messages import conflicts as conflict_codes
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    a_file,
    answer,
    jev_says,
    proposals,
    questions,
    readers,
    run_job,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
STRUCTURAL_B = "KR-STR-B-R0.dwg"
NO_DISCIPLINE = "KR-SET4-R0.dwg"
"""Its name names no Discipline, and one of its sheets is not bare-numbered: never General (#159)."""
TWO_S04 = [
    Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R0", date="02.08.2026"),
    Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R1", date="14.08.2026"),
]
THIRD_S04 = [Sheet("S-04", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",), rev="R2", date="30.08.2026")]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def same_number(api: Any, project_id: uuid.UUID) -> list[dict[str, Any]]:
    """Every `same_number` Question, open or not."""
    return [q for q in questions(api, project_id) if q["code"] == conflict_codes.SAME_NUMBER.code]


def status_by_copies(api: Any, project_id: uuid.UUID) -> dict[int, str]:
    return {q["params"]["copies"]: q["status"] for q in same_number(api, project_id)}


def test_a_conflict_found_again_after_it_was_retired_is_open_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Rulings 3 and 4: a third copy retires the Question of two (withdrawn, still listed); the third
    file moved to another Discipline retires the Question of three, and the one of two is asked again."""
    read(qs_project, monkeypatch, STRUCTURAL, TWO_S04)
    later = read(qs_project, monkeypatch, STRUCTURAL_B, THIRD_S04)
    api = api_as(qs_project.member)
    assert status_by_copies(api, qs_project.project_id) == {2: "withdrawn", 3: "open"}

    response = api.send(
        "put",
        f"/api/projects/{qs_project.project_id}/drawings/files/{later}/discipline",
        {"discipline": "architectural"},
    )

    assert response.status_code == 200, response.content
    assert status_by_copies(api, qs_project.project_id) == {2: "open", 3: "withdrawn"}


def test_an_answered_conflict_is_never_withdrawn_by_a_later_read(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ruling 3: the QS kept both copies (confirming them), so the Question is not found again by a
    later read, and stays answered; the third copy beside two confirmed ones is no `same_number`
    copy (ruling 2: a Revision question later)."""
    read(qs_project, monkeypatch, STRUCTURAL, TWO_S04)
    api = api_as(qs_project.member)
    [asked] = same_number(api, qs_project.project_id)
    response = answer(api, qs_project.project_id, asked["id"], "keep_all")
    assert response.status_code == 200, response.content

    read(qs_project, monkeypatch, STRUCTURAL_B, THIRD_S04)

    assert status_by_copies(api, qs_project.project_id) == {2: "answered"}


def test_the_sheets_of_a_file_of_no_discipline_are_compared_with_each_other_only(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ruling 5: its two 05s are one Question holding both, of no Discipline; Structural's 05 is in
    none of them."""
    read(qs_project, monkeypatch, STRUCTURAL, [Sheet("05", "BEAM SCHEDULE", ("BEAM SCHEDULE",))])
    unassigned = read(qs_project, monkeypatch, NO_DISCIPLINE, [
        Sheet("05", "SITE NOTES", ("SITE NOTES",), rev="R0"),
        Sheet("05", "SITE NOTES", ("SITE NOTES",), rev="R1"),
        Sheet("X-02", "NOTES", ("NOTES",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    assert a_file(api, qs_project.project_id, unassigned)["discipline"] is None
    mine = sorted(
        p["id"]
        for p in proposals(api, qs_project.project_id)
        if p["number"] == "05" and p["file_name"] == NO_DISCIPLINE
    )
    assert len(mine) == 2

    [asked] = same_number(api, qs_project.project_id)

    assert (asked["status"], asked["params"]) == ("open", {"number": "05", "copies": 2})
    assert sorted(str(i) for i in asked["proposals"]) == mine
