"""#159 beyond its acceptance tests: the real loss of a Discipline chosen while the file read, the
General default's edges, and the General sheets' views.

The loss: the QS's choice, sent while the read's last step ran, waits for that step (it holds the
file) and lands once the file is read. The sheets moved with it, but each sheet's `missing_discipline`
Question stayed open, asking again what the QS had just said and holding the sheet from being
confirmed: the choice looked lost. It is now the Question's answer.
"""

import uuid
from typing import Any

import pytest

from engine.recognise import views as view_finder
from engine.recognise.types import ViewConventions, ViewKind
from vextrus.drawings.messages import files as drawing_words
from vextrus.platform.services import tenancy
from vextrus.takeoff import library as takeoff_library
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.services.read_propose import proposals as read_proposals
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    a_file,
    confirm,
    coverage,
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

STEP_2 = takeoff_library.STEPS[1].key


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


def test_a_discipline_chosen_before_the_sheets_whose_numbers_are_taken_is_refused_not_joined(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The orchestrator's ruling (session 08): refused with the words it gets after the read, never a
    silent join by number. Chosen while the reader runs, the numbers are not yet read: the choice is
    refused when they are (the file's finding holds the refusal), and chosen again, it is refused 409."""
    structural = read(
        qs_project,
        monkeypatch,
        "KR-STR-R0.dwg",
        [Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)), Sheet("02", "COLUMN SCHEDULE", ())],
    )
    api = api_as(qs_project.member)
    file_id = uploaded(qs_project.member, qs_project.project_id, "KR-SET3-R0.dwg")
    series = [Sheet(f"{n:02d}", f"GENERAL NOTES {n}", ("GENERAL NOTES",)) for n in range(1, 4)]
    given = readers({"KR-SET3-R0.dwg": series})
    chosen: list[Any] = []

    def reading_while_the_qs_chooses(path: Any, name: str) -> Any:
        with tenancy.acting_in(qs_project.member.developer_id, user_id=qs_project.member.user.pk):
            chosen.append(discipline_of(api, qs_project, file_id, "structural"))
        return given.dwg(path, name)

    run_job(
        qs_project.member,
        file_id,
        monkeypatch,
        files.Readers(
            dwg=reading_while_the_qs_chooses,
            second=given.second,
            fonts=given.fonts,
            bangla_ansi=given.bangla_ansi,
            pdf=given.pdf,
        ),
    )

    assert [r.status_code for r in chosen] == [200]  # the numbers were not read yet
    shown = a_file(api, qs_project.project_id, file_id)
    assert shown["discipline"] != "structural"
    assert shown["finding"]["code"] == drawing_words.DISCIPLINE_SHEET_TAKEN.code
    assert shown["finding"]["params"]["sheet"] == "01"
    listed = proposals(api, qs_project.project_id)
    theirs = {p["number"]: p for p in listed if p["file_name"] == "KR-STR-R0.dwg"}
    assert theirs["01"]["title"] == "PILE LAYOUT PLAN"  # never joined, never retitled
    assert all(p["discipline"] != "structural" for p in listed if p["file_name"] == "KR-SET3-R0.dwg")
    assert a_file(api, qs_project.project_id, structural)["discipline"] == "structural"

    again = discipline_of(api, qs_project, file_id, "structural")

    assert again.status_code == 409  # type: ignore[attr-defined]
    assert again.json()["code"] == drawing_words.DISCIPLINE_SHEET_TAKEN.code  # type: ignore[attr-defined]
    chosen_now = discipline_of(api, qs_project, file_id, "architectural")
    assert chosen_now.status_code == 200, chosen_now.content  # type: ignore[attr-defined]
    assert a_file(api, qs_project.project_id, file_id)["finding"] is None


@pytest.mark.xfail(
    strict=True,
    reason="#159 fix round 1 F3, not fixed: re-proposing a read file's views needs a grant ruling "
    "(drawings_view's app grant updates decisions only; takeoff_coverage(step) have no DELETE)",
)
def test_a_wrong_general_default_corrected_proposes_the_files_views_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#159 fix round 1 (F3): a bare-numbered structural file defaults to General (every view Step 2's);
    the QS's Structural moves its views out of Step 2, to Structural's own proposals (Coverage follows)."""
    file_id = read(
        qs_project,
        monkeypatch,
        "KR-SET4-R0.dwg",
        [
            Sheet("01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
            Sheet("02", "BEAM LAYOUT PLAN", ("BEAM LAYOUT PLAN",)),
        ],
    )
    api = api_as(qs_project.member)
    assert a_file(api, qs_project.project_id, file_id)["discipline"] == "general"

    chosen = discipline_of(api, qs_project, file_id, "structural")

    assert chosen.status_code == 200, chosen.content  # type: ignore[attr-defined]
    listed = [p for p in proposals(api, qs_project.project_id) if p["file_name"] == "KR-SET4-R0.dwg"]
    assert {p["discipline"] for p in listed} == {"structural"}
    confirmed = confirm(api, qs_project.project_id, [p["id"] for p in listed])
    assert confirmed.status_code == 200, confirmed.content
    shown = coverage(api, qs_project.project_id)
    assert STEP_2 not in shown["by_step"], shown
    assert shown["by_step"], shown
