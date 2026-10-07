"""One kind Question per group (S15-Q1), at its edges: a sheet that comes after the group's answer is
asked, never decided by an answer given before it; a sheet of the group whose number is still asked
keeps the kind the answer gave while the others are confirmed; the words count the sheets held."""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import Sheet, answer, exclude, proposals
from vextrus.takeoff.tests.acceptance.ts15q1.kinds_set import (
    STRUCTURAL,
    STRUCTURAL_TOO,
    beams,
    jev_unsure,
    kind_questions,
    read,
    the_one_kind_question,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline


@pytest.mark.django_db
def test_the_words_count_the_sheets_the_group_holds_and_name_one_sheet_alone(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1]))
    api = api_as(qs_project.member)
    alone = the_one_kind_question(api, qs_project.project_id)

    read(qs_project, monkeypatch, STRUCTURAL_TOO, beams([2, 3]))

    grouped = the_one_kind_question(api, qs_project.project_id)
    assert alone["params"] == {"sheet": "S-01", "named": "number", "sheets": 1}
    assert alone["subject_id"] is None
    assert grouped["params"] == {"sheet": "", "named": "group", "sheets": 3}


@pytest.mark.django_db
def test_a_sheet_after_the_groups_answer_is_asked_anew_not_decided_by_it(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1, 2]))
    api = api_as(qs_project.member)
    first = the_one_kind_question(api, qs_project.project_id)
    assert answer(api, qs_project.project_id, first["id"], "beam_layout").status_code == 200

    read(qs_project, monkeypatch, STRUCTURAL_TOO, beams([3]))

    again = the_one_kind_question(api, qs_project.project_id)
    later = next(p for p in proposals(api, qs_project.project_id) if p["number"] == "S-03")
    assert again["id"] != first["id"]
    assert again["proposals"] == [later["id"]]
    assert later["decision"] is None


@pytest.mark.django_db
def test_a_groups_sheet_still_asked_its_number_keeps_the_kind_while_the_others_are_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_unsure(jev_offline)
    unnumbered = Sheet(None, "BEAM DRAWING Z", ("BEAM BZ",))
    read(qs_project, monkeypatch, STRUCTURAL, [*beams([1, 2]), unnumbered])
    api = api_as(qs_project.member)
    [q] = kind_questions(api, qs_project.project_id)
    assert len(q["proposals"]) == 3

    response = answer(api, qs_project.project_id, q["id"], "beam_details")

    assert response.status_code == 200, response.content
    by_title = {p["title"]: p for p in proposals(api, qs_project.project_id)}
    assert [by_title[t]["decision"] for t in ("BEAM DRAWING A", "BEAM DRAWING B")] == ["confirmed"] * 2
    assert [by_title[t]["decided_with"] for t in ("BEAM DRAWING A", "BEAM DRAWING B")] == [2, 2]
    waiting = by_title["BEAM DRAWING Z"]
    assert waiting["decision"] is None
    assert waiting["kind"] == "beam_details"


@pytest.mark.django_db
def test_a_groups_sheet_left_out_stays_out_when_the_group_is_answered(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """The refuter's case (score 75): the answer confirms the group's sheets, never one the QS left
    out; that one keeps the kind for its confirmation back in."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1, 2, 3]))
    api = api_as(qs_project.member)
    q = the_one_kind_question(api, qs_project.project_id)
    ids = {p["number"]: p["id"] for p in proposals(api, qs_project.project_id)}
    assert exclude(api, qs_project.project_id, [ids["S-03"]], "superseded").status_code == 200

    assert answer(api, qs_project.project_id, q["id"], "beam_details").status_code == 200

    after = {p["number"]: p for p in proposals(api, qs_project.project_id)}
    assert [after[n]["decision"] for n in ("S-01", "S-02", "S-03")] == [
        "confirmed",
        "confirmed",
        "excluded",
    ]
    assert [after[n]["decided_with"] for n in ("S-01", "S-02")] == [2, 2]


@pytest.mark.django_db
def test_every_held_sheet_left_out_confirms_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1, 2]))
    api = api_as(qs_project.member)
    q = the_one_kind_question(api, qs_project.project_id)
    ids = [p["id"] for p in proposals(api, qs_project.project_id)]
    assert exclude(api, qs_project.project_id, ids, "superseded").status_code == 200

    assert answer(api, qs_project.project_id, q["id"], "beam_details").status_code == 200

    assert [p["decision"] for p in proposals(api, qs_project.project_id)] == ["excluded", "excluded"]
