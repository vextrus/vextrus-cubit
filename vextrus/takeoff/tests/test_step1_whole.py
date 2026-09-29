"""Ticket 21c's own tests beside its acceptance tests: the answer's refusals, a view left out on its
own, and the walls of the acts it adds (on hand-built artefacts, as `acceptance/t21c` builds them)."""

import uuid
from collections.abc import Callable

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    KEEP_OPEN,
    NOT_FOUND,
    Sheet,
    answer,
    confirm,
    coverage,
    exclude,
    jev_says,
    keys,
    open_questions,
    proposals,
    questions,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

NAME = "KR-STR-R0.dwg"
DUPLICATE = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
    Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
]
LOOSE = [Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN", "SECTION A-A"))]
"""A pile plan and a section no step reads: one view unaccounted."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: sheets}))
    return file_id


def test_a_question_answered_once_refuses_a_second_answer_and_keeps_the_first(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")
    assert answer(api, qs_project.project_id, q["id"], "keep_latest").status_code == 200

    again = answer(api, qs_project.project_id, q["id"], "keep_all")

    assert (again.status_code, again.json()) == (
        409,
        {"code": "takeoff.proposals.answered_already", "params": {}},
    )
    [done] = [x for x in questions(api, qs_project.project_id) if x["id"] == q["id"]]
    assert done["answer"]["option"] == "keep_latest"


def test_keep_open_then_an_answer_settles_the_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DUPLICATE)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "conflict")
    assert answer(api, qs_project.project_id, q["id"], KEEP_OPEN).status_code == 200

    response = answer(api, qs_project.project_id, q["id"], keys(q)[0])

    assert response.status_code == 200, response.content
    assert open_questions(api, qs_project.project_id, "conflict") == []


def test_a_view_left_out_on_its_own_stays_out_when_its_sheet_is_confirmed_and_undo_brings_it_back(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, LOOSE)
    api = api_as(qs_project.member)
    [lone] = coverage(api, qs_project.project_id)["unaccounted_views"]

    left_out = exclude(api, qs_project.project_id, [lone["id"]], "other", "part of the title block")
    assert left_out.status_code == 200, left_out.content
    confirm(api, qs_project.project_id, [p["id"] for p in proposals(api, qs_project.project_id)])

    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["excluded"], shown["by_reason"]) == (0, 1, {"other": 1})
    # The confirmation first, then the view's own exclusion: each undo takes back one act.
    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200
    assert api.post(f"{step1(qs_project.project_id)}/undo", {}).status_code == 200
    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["excluded"]) == (1, 0)
    assert [v["view_id"] for v in shown["unaccounted_views"]] == [lone["view_id"]]


def test_a_typed_number_holding_a_drawing_code_is_refused_and_changes_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
    ])  # fmt: skip
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing")

    raw = answer(api, qs_project.project_id, q["id"], "type_number", text="S-%%C02")
    empty = answer(api, qs_project.project_id, q["id"], "type_number")

    assert (raw.status_code, raw.json()["code"]) == (400, "drawings.sheets.number_unreadable")
    assert (empty.status_code, empty.json()["code"]) == (400, "takeoff.proposals.number_needed")
    assert the(proposals(api, qs_project.project_id), None)["sheet_id"] == q["subject_id"]
    assert [x["id"] for x in open_questions(api, qs_project.project_id, "missing")] == [q["id"]]


def test_another_developers_view_cannot_be_left_out_nor_its_question_answered(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sign_in: Callable[..., Member]
) -> None:
    read(qs_project, monkeypatch, LOOSE)
    mine = api_as(qs_project.member)
    [lone] = coverage(mine, qs_project.project_id)["unaccounted_views"]
    other = sign_in(role="qs")
    with other.acting():
        from vextrus.projects import services as projects

        theirs = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Their project").id
    api = api_as(other)

    refused = exclude(api, theirs, [lone["id"]], "other", "not theirs")
    across = exclude(api, qs_project.project_id, [lone["id"]], "other", "not theirs")

    assert (refused.status_code, refused.json()) == (404, NOT_FOUND)
    assert (across.status_code, across.json()) == (404, NOT_FOUND)
    assert coverage(mine, qs_project.project_id)["unaccounted"] == 1
