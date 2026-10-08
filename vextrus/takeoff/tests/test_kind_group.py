"""One kind Question per group (S15-Q1), at its edges: a sheet that comes after the group's answer is
asked, never decided by an answer given before it; a sheet of the group whose number is still asked
keeps the kind the answer gave while the others are confirmed; the words count the sheets held."""

from typing import Any

import pytest

from engine.recognise import sheets as sheet_finder
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    exclude,
    proposals,
    questions,
    readers,
    run_job,
    step1,
    uploaded,
)
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
    assert grouped["params"] == {"sheet": "", "named": "group", "sheets": 3, "waiting": 0}


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


# Review round 1 (PR #566) ----------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_sheet_moved_to_another_discipline_leaves_its_group_answerable(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """f1: the QS moves one file of a group to another Discipline; the group is still answered with
    its own Discipline's kind, and the moved sheet is left undecided, never refused whole."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1, 2]))
    later = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL_TOO)
    run_job(qs_project.member, later, monkeypatch, readers({STRUCTURAL_TOO: beams([3])}))
    api = api_as(qs_project.member)
    q = the_one_kind_question(api, qs_project.project_id)
    assert len(q["proposals"]) == 3
    moved = api.send(
        "put",
        f"/api/projects/{qs_project.project_id}/drawings/files/{later}/discipline",
        {"discipline": "architectural"},
    )
    assert moved.status_code == 200, moved.content

    response = answer(api, qs_project.project_id, q["id"], "beam_details")

    assert response.status_code == 200, response.content
    after = {p["number"]: p for p in proposals(api, qs_project.project_id)}
    assert [after[n]["decision"] for n in ("S-01", "S-02", "S-03")] == ["confirmed", "confirmed", None]
    assert [after[n]["confirmed_kind"] for n in ("S-01", "S-02")] == ["beam_details"] * 2


def answer_seen(api: Any, project_id: Any, question_id: str, option: str, held: list[str]) -> Any:
    """The answer as the web sends it: with the sheets the QS saw the Question hold."""
    return api.post(
        f"{step1(project_id)}/questions/{question_id}/answer", {"option": option, "held": held}
    )


@pytest.mark.django_db
def test_an_answer_to_a_group_that_grew_since_the_qs_saw_it_is_refused_and_changes_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """f2: the QS saw "these 2 sheets"; a read added a third; the answer naming the two is refused
    (409, `group_changed`) and confirms nothing. Answered as the group holds now, it confirms all."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1, 2]))
    api = api_as(qs_project.member)
    seen = the_one_kind_question(api, qs_project.project_id)
    read(qs_project, monkeypatch, STRUCTURAL_TOO, beams([3]))

    refused = answer_seen(api, qs_project.project_id, seen["id"], "beam_layout", seen["proposals"])

    assert refused.status_code == 409, refused.content
    assert refused.json()["code"] == "takeoff.proposals.group_changed"
    assert refused.json()["params"] == {"sheets": 3}
    assert [p["decision"] for p in proposals(api, qs_project.project_id)] == [None] * 3
    now = the_one_kind_question(api, qs_project.project_id)
    done = answer_seen(api, qs_project.project_id, now["id"], "beam_layout", now["proposals"])
    assert done.status_code == 200, done.content
    assert [p["decided_with"] for p in proposals(api, qs_project.project_id)] == [3] * 3


@pytest.mark.django_db
def test_a_kind_questions_options_hold_every_kind_of_its_discipline_jevs_first(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """f3 and f4: code narrows what Jev ranks, never what the QS may pick: a kind the title's words
    left out is still an option, after Jev's, and only Jev's first is picked."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1]))
    api = api_as(qs_project.member)

    q = the_one_kind_question(api, qs_project.project_id)

    keys = [o["key"] for o in q["options"]]
    every = sheet_finder.default_conventions().kinds("structural")
    assert keys[:2] == ["beam_layout", "beam_details"]
    assert set(keys[:-1]) == set(every)
    assert keys[-1] == "keep_open"
    assert [o["key"] for o in q["options"] if o["picked"]] == ["beam_layout"]


# Review round 2 (PR #566) ----------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_kind_answer_never_confirms_a_sheet_another_open_question_holds(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """l2-f1: two copies of S-01 (a same_number conflict) share the kind group with S-02. The answer
    confirms S-02 alone; the copies stay held by their conflict, as bulk confirm's question_first
    would hold them, and the card counts them as left open."""
    jev_unsure(jev_offline)
    copies = [
        Sheet("S-01", "BEAM DRAWING A", ("BEAM B1",)),
        Sheet("S-01", "BEAM DRAWING B", ("BEAM B2",)),
        Sheet("S-02", "BEAM DRAWING C", ("BEAM B3",)),
    ]
    read(qs_project, monkeypatch, STRUCTURAL, copies)
    api = api_as(qs_project.member)
    q = the_one_kind_question(api, qs_project.project_id)
    assert len(q["proposals"]) == 3
    assert q["params"]["waiting"] == 2

    response = answer(api, qs_project.project_id, q["id"], "beam_details")

    assert response.status_code == 200, response.content
    by_title = {p["title"]: p for p in proposals(api, qs_project.project_id)}
    assert by_title["BEAM DRAWING C"]["decision"] == "confirmed"
    assert by_title["BEAM DRAWING C"]["decided_with"] == 1
    assert [by_title[t]["decision"] for t in ("BEAM DRAWING A", "BEAM DRAWING B")] == [None, None]
    conflicts = [
        x
        for x in questions(api, qs_project.project_id)
        if x["kind"] == "conflict" and x["status"] == "open"
    ]
    assert len(conflicts) == 1


@pytest.mark.django_db
def test_a_sheet_moved_to_another_discipline_is_let_go_and_never_takes_the_groups_answer(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """l1-f1: S-03's file moves to architectural; the structural group no longer holds it, and S-03
    confirmed on its own later never takes the group's structural kind."""
    jev_unsure(jev_offline)
    read(qs_project, monkeypatch, STRUCTURAL, beams([1, 2]))
    later = uploaded(qs_project.member, qs_project.project_id, STRUCTURAL_TOO)
    run_job(qs_project.member, later, monkeypatch, readers({STRUCTURAL_TOO: beams([3])}))
    api = api_as(qs_project.member)
    moved = api.send(
        "put",
        f"/api/projects/{qs_project.project_id}/drawings/files/{later}/discipline",
        {"discipline": "architectural"},
    )
    assert moved.status_code == 200, moved.content
    ids = {p["number"]: p["id"] for p in proposals(api, qs_project.project_id)}
    q = the_one_kind_question(api, qs_project.project_id)
    assert sorted(q["proposals"]) == sorted([ids["S-01"], ids["S-02"]])
    assert q["params"]["sheets"] == 2
    assert answer(api, qs_project.project_id, q["id"], "beam_details").status_code == 200

    alone = confirm(api, qs_project.project_id, [ids["S-03"]])

    assert alone.status_code == 200, alone.content
    s03 = next(p for p in proposals(api, qs_project.project_id) if p["number"] == "S-03")
    assert s03["decision"] == "confirmed"
    assert s03["confirmed_kind"] != "beam_details"
