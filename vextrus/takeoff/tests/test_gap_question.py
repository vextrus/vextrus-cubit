"""`step1.ask_gaps` (S15-Q2): the Discipline's one numbering gap Question, kept by its Discipline.

What the acceptance (t229) leaves to the build: a kept-open answer across a later file (kept when the
file only fills a gap, the QS's again when it adds one), a gap found after the answer (a new Question,
never settled by the answer given before it), and the Question's sheets as `questions()` lists them
(a sheet beside a gap since filled is held no more, though its link stays: links are append-only).
"""

import pytest

from vextrus.takeoff.tests.acceptance.t229.plotted_set import PlottedSet
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db


def _held_numbers(the_set: PlottedSet, question: dict) -> set[str]:
    number_of = {str(p): n for n, p in the_set.proposal.items()}
    return {number_of[p] for p in question["proposals"]}


def test_a_kept_open_answer_stays_when_a_later_file_fills_a_gap(qs_project: QsProject) -> None:
    the_set = PlottedSet(qs_project)
    the_set.read("KR-STR-R0.dwg", ["S-01", "S-03", "S-05"])
    asked = the_set.the_gap_question()
    assert the_set.answer(asked["id"], "keep_open").status_code == 200

    the_set.read("KR-STR-R1.dwg", ["S-02"])

    after = the_set.the_gap_question()
    assert after["id"] == asked["id"]
    assert (after["answer"] or {}).get("option") == "keep_open"
    assert _held_numbers(the_set, after) == {"S-03", "S-05"}


def test_a_kept_open_answer_is_the_qs_s_again_when_a_later_file_adds_a_gap(
    qs_project: QsProject,
) -> None:
    the_set = PlottedSet(qs_project)
    the_set.read("KR-STR-R0.dwg", ["S-01", "S-03"])
    asked = the_set.the_gap_question()
    assert the_set.answer(asked["id"], "keep_open").status_code == 200

    the_set.read("KR-STR-R1.dwg", ["S-05"])

    after = the_set.the_gap_question()
    assert after["id"] == asked["id"]
    assert after["answer"] is None, "a gap the QS never kept open was answered for them"
    assert _held_numbers(the_set, after) == {"S-01", "S-03", "S-05"}


def test_a_gap_found_after_the_answer_is_asked_by_a_new_question(qs_project: QsProject) -> None:
    the_set = PlottedSet(qs_project)
    the_set.read("KR-STR-R0.dwg", ["S-01", "S-03"])
    first = the_set.the_gap_question()
    assert the_set.answer(first["id"], "not_in_set").status_code == 200

    the_set.read("KR-STR-R1.dwg", ["S-05"])

    after = the_set.the_gap_question()
    assert after["id"] != first["id"]
    assert after["discipline"] == first["discipline"]
    assert [g["after"] for g in after["params"]["gaps"]] == ["S-03"], "the answered gap asked again"
    assert _held_numbers(the_set, after) == {"S-03", "S-05"}
    [answered] = [q for q in the_set.questions() if q["id"] == first["id"]]
    assert answered["status"] == "answered"


def test_a_read_again_asks_the_same_question_and_holds_the_same_sheets(
    qs_project: QsProject,
) -> None:
    the_set = PlottedSet(qs_project)
    the_set.read("KR-STR-R0.dwg", ["S-01", "S-03", "S-05"])
    asked = the_set.the_gap_question()

    the_set.ask()

    after = the_set.the_gap_question()
    assert (after["id"], after["params"]) == (asked["id"], asked["params"])
    assert _held_numbers(the_set, after) == {"S-01", "S-03", "S-05"}
