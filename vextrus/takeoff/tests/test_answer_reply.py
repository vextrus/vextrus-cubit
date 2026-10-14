"""S27-G7 (#319): an answer's reply carries the Proposals it moved (`changed_proposals`), each exactly as
the list words it; here the paths the acceptance tests leave out: a typed number (a correction, not a
confirm or an exclusion) and `proposals`' `only` against the whole list."""

from typing import Any

import pytest

from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    KEEP_OPEN,
    Sheet,
    answer,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

UNNUMBERED = [
    Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
    Sheet(None, "STAIR DETAILS", ("STAIR SECTION",)),
    Sheet("S-03", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> None:
    file_id = uploaded(qs.member, qs.project_id, "KR-STR-R0.dwg")
    run_job(qs.member, file_id, monkeypatch, readers({"KR-STR-R0.dwg": sheets}))


def test_a_typed_number_replies_with_the_corrected_sheet_as_the_list_now_words_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, UNNUMBERED)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing")

    response = answer(api, qs_project.project_id, q["id"], "type_number", text="S-02")

    assert response.status_code == 200, response.content
    listed = the(proposals(api, qs_project.project_id), "S-02")
    assert response.json()["changed_proposals"] == [listed]


def test_keeping_a_missing_number_open_replies_with_no_sheet(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, UNNUMBERED)
    api = api_as(qs_project.member)
    [q] = open_questions(api, qs_project.project_id, "missing")

    response = answer(api, qs_project.project_id, q["id"], KEEP_OPEN)

    assert response.status_code == 200, response.content
    assert response.json()["changed_proposals"] == []


def test_only_some_sheets_are_those_rows_of_the_whole_list_unchanged(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, UNNUMBERED)
    with qs_project.member.acting():
        whole = step1.proposals(qs_project.project_id)
        some = [whole[0].sheet_id, whole[-1].sheet_id]
        only = step1.proposals(qs_project.project_id, only=some)
        none: list[Any] = step1.proposals(qs_project.project_id, only=[])

    assert only == [whole[0], whole[-1]]
    assert none == []
