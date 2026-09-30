"""#159 beyond its acceptance tests: the real loss of a Discipline chosen while the file read, the
General default's edges, and the General sheets' views.

The loss: the QS's choice, sent while the read's last step ran, waits for that step (it holds the
file) and lands once the file is read. The sheets moved with it, but each sheet's `missing_discipline`
Question stayed open, asking again what the QS had just said and holding the sheet from being
confirmed: the choice looked lost. It is now the Question's answer.
"""

import uuid

import pytest

from engine.recognise import views as view_finder
from engine.recognise.types import ViewConventions, ViewKind
from vextrus.takeoff.services.read_propose import proposals as read_proposals
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    a_file,
    confirm,
    jev_says,
    open_questions,
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


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, sheets: list[Sheet]) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: sheets}))
    return file_id


def discipline_of(api: object, qs: QsProject, file_id: uuid.UUID, key: str) -> object:
    return api.send(  # type: ignore[attr-defined]
        "put",
        f"/api/projects/{qs.project_id}/drawings/files/{file_id}/discipline",
        {"discipline": key},
    )


def test_a_discipline_chosen_once_the_file_is_read_answers_its_sheets_questions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """One bare-numbered sheet: no General, so its Discipline is asked; the QS's choice answers it."""
    file_id = read(qs_project, monkeypatch, "KR-X-R0.dwg", [Sheet("07", "ROOF PLAN", ("ROOF PLAN",))])
    api = api_as(qs_project.member)
    assert a_file(api, qs_project.project_id, file_id)["discipline"] is None
    assert len(open_questions(api, qs_project.project_id, "missing_discipline")) == 1

    response = discipline_of(api, qs_project, file_id, "architectural")

    assert response.status_code == 200, response.content  # type: ignore[attr-defined]
    assert open_questions(api, qs_project.project_id, "missing_discipline") == []
    [answered] = [q for q in questions(api, qs_project.project_id) if q["kind"] == "missing_discipline"]
    assert answered["answer"]["option"] == "architectural"
    assert answered["answer"]["by"] == qs_project.member.user.name  # the QS who chose, by name
    [mine] = proposals(api, qs_project.project_id)
    assert mine["discipline"] == "architectural"
    confirmed = confirm(api, qs_project.project_id, [mine["id"]])
    assert confirmed.status_code == 200, confirmed.content


def test_a_file_whose_numbered_sheets_are_not_all_bare_is_not_general(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read(
        qs_project,
        monkeypatch,
        "KR-SET4-R0.dwg",
        [Sheet("01", "GENERAL NOTES 1", ("GENERAL NOTES",)), Sheet("X-02", "NOTES", ("NOTES",))],
    )
    api = api_as(qs_project.member)

    assert a_file(api, qs_project.project_id, file_id)["discipline"] is None


def test_a_file_named_general_is_not_general_by_its_name(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The General Discipline is never read from a file's name (21c's one-sheet GENERAL NOTES.dwg)."""
    file_id = uploaded(qs_project.member, qs_project.project_id, "GENERAL NOTES.dwg")
    api = api_as(qs_project.member)

    assert a_file(api, qs_project.project_id, file_id)["discipline"] is None


@pytest.mark.parametrize("kind", [k for k in ViewKind if k is not ViewKind.TITLE_BLOCK])
def test_every_view_of_a_notes_discipline_but_its_title_block_is_step_2s(kind: ViewKind) -> None:
    assert view_finder._proposal(kind, None, "notes_key", frozenset({"notes_key"})) == (
        (view_finder.GENERAL_NOTES,),
        None,
        None,
    )
    assert view_finder._proposal(kind, None, "other", frozenset({"notes_key"})) != (
        (view_finder.GENERAL_NOTES,),
        None,
        None,
    ) or kind in (ViewKind.LEGEND, ViewKind.NOTES)


def test_the_view_conventions_carry_the_notes_disciplines_as_data() -> None:
    held = ViewConventions(notes_disciplines=("notes_key",))

    assert ViewConventions.from_json(held.to_json()) == held
    assert "notes_disciplines" not in ViewConventions().to_json()


def test_the_hook_is_registered_once() -> None:
    from vextrus.drawings.services import drawing_files

    assert drawing_files.DISCIPLINE_CHANGED.count(read_proposals.follow_discipline) == 1
