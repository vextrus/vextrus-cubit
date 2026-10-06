"""S15-Q2 (#534, rebuilding ticket 229): "a numbering gap holds only its neighbours; one merged gap
Question", judged against S15-Q1's rule for a grouped Question (a Question's identity is its group,
never a Sheet's name; one answer for the group; an answer is never undone, m0-screens 6 "Undo").

The owner's ruling, session 11 ("Plot match + gap local"): "a sheet whose Plot page matched (number and
title read alike) has its second source; a numbering gap holds only the sheets beside it; all of one
Discipline's gaps are asked as one Question". `CONTEXT.md`, Question: "answered once for every element
it unblocks".

The one gap Question is the Discipline's: a second file of the Discipline that adds gaps, or fills one,
changes what it asks, never which Question it is. While it is open it holds the sheets beside its
gaps; once answered (but "Keep open, ask the consultant") it holds none, and an undo after it takes
back the act after the answer, never the answer.

Not pinned (no authority gives them): the gap Question's words and the shape of its params beyond
naming the sheets beside each gap; what a new gap found after the Question was answered raises.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t229.plotted_set import PlottedSet, strings
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db

STRUCTURAL = "KR-STR-R0.dwg"
STRUCTURAL_TOO = "KR-STR-R1.dwg"
ARCHITECTURAL = "KR-ARC-R0.dwg"
SEVEN = ["S-01", "S-02", "S-03", "S-04", "S-06", "S-07", "S-08"]
"""S-05 missing: the gap is between S-04 and S-06."""


# The gap Question is the Discipline's, whatever its gaps --------------------------------------------


def test_the_gap_question_keeps_its_id_when_another_file_adds_gaps(qs_project: QsProject) -> None:
    """S-01, S-03 and S-05 are asked as one Question; a second structural file brings S-07 and S-09,
    so S-06 and S-08 are missing too: the open Question asks all four gaps and is the same Question."""
    the_set = PlottedSet(qs_project)
    the_set.read(STRUCTURAL, ["S-01", "S-03", "S-05"])
    first = the_set.the_gap_question()

    the_set.read(STRUCTURAL_TOO, ["S-07", "S-09"])

    after = the_set.the_gap_question()
    assert after["id"] == first["id"], "the Discipline's gap Question was asked anew"
    assert {"S-01", "S-03", "S-05", "S-07", "S-09"} <= strings(after["params"])


def test_a_file_that_fills_one_gap_keeps_the_question_for_the_other(qs_project: QsProject) -> None:
    """S-02 and S-04 missing; a second file brings S-02: the same Question stays open for S-04's gap,
    which now holds S-03 and S-05 alone, so S-01 and S-02 agree on their Plot pages."""
    the_set = PlottedSet(qs_project)
    the_set.read(STRUCTURAL, ["S-01", "S-03", "S-05"])
    first = the_set.the_gap_question()

    the_set.read(STRUCTURAL_TOO, ["S-02"])

    after = the_set.the_gap_question()
    assert after["id"] == first["id"], "the Discipline's gap Question was asked anew"
    shown = the_set.agrees()
    wanted = {"S-01": True, "S-02": True, "S-03": False, "S-05": False}
    assert shown == wanted, "not only S-03 and S-05 held"


def test_each_discipline_with_gaps_asks_its_own_one_gap_question(qs_project: QsProject) -> None:
    """ "All of one Discipline's gaps are asked as one Question": two gaps in Structural and two in
    Architectural are two Questions, one per Discipline."""
    the_set = PlottedSet(qs_project)
    the_set.read(STRUCTURAL, ["S-01", "S-03", "S-05"])
    the_set.read(ARCHITECTURAL, ["A-01", "A-03", "A-05"])

    asked = the_set.gap_questions()

    shown = sorted(q["discipline"] for q in asked)
    assert shown == ["architectural", "structural"], f"not one gap Question per Discipline: {shown}"


# One answer for every gap; the sheets beside them are held only while it is open --------------------


@pytest.mark.parametrize("option", ["not_sent_yet", "not_in_set", "file_not_added"])
def test_answering_the_gap_question_lets_the_sheets_beside_the_gap_agree(
    qs_project: QsProject, option: str
) -> None:
    """A Question is "answered once for every element it unblocks": answered, the gap holds S-04 and
    S-06 no more, and every sheet, its Plot page matched, joins one bulk act."""
    the_set = PlottedSet(qs_project)
    the_set.read(STRUCTURAL, SEVEN)
    question = the_set.the_gap_question()

    answered = the_set.answer(question["id"], option)

    assert answered.status_code == 200, answered.content
    assert the_set.agrees() == dict.fromkeys(SEVEN, True), "the answered gap still holds a sheet"
    confirmed = the_set.confirm(SEVEN)
    assert confirmed.status_code == 200, confirmed.content
    assert [p["decision"] for p in the_set.proposals()] == ["confirmed"] * len(SEVEN)


def test_kept_open_the_gap_question_still_holds_only_the_sheets_beside_the_gap(
    qs_project: QsProject,
) -> None:
    """ "Keep open, ask the consultant" keeps the Question open: S-04 and S-06 are still held, and
    only they."""
    the_set = PlottedSet(qs_project)
    the_set.read(STRUCTURAL, SEVEN)
    question = the_set.the_gap_question()

    kept = the_set.answer(question["id"], "keep_open")

    assert kept.status_code == 200, kept.content
    shown = the_set.agrees()
    assert shown == {n: n not in ("S-04", "S-06") for n in SEVEN}, "not only S-04 and S-06 held"


def test_an_undo_after_the_gap_answer_takes_back_the_bulk_act_and_never_the_answer(
    qs_project: QsProject,
) -> None:
    """m0-screens 6, Undo: "Ctrl Z passes over any other answer to the act before it", and an answer
    is never undone: after the gap answer and a bulk act, one undo takes back the bulk act alone; the
    gap Question stays answered and holds no sheet."""
    the_set = PlottedSet(qs_project)
    the_set.read(STRUCTURAL, SEVEN)
    question = the_set.the_gap_question()
    assert the_set.answer(question["id"], "not_in_set").status_code == 200
    confirmed = the_set.confirm(SEVEN)
    assert confirmed.status_code == 200, f"the seven do not agree once answered: {confirmed.content!r}"

    undone = the_set.undo()

    assert undone.status_code == 200, undone.content
    assert [p["decision"] for p in the_set.proposals()] == [None] * len(SEVEN)
    [after] = [q for q in the_set.questions() if q["id"] == question["id"]]
    assert (after["status"], after["answer"]["option"]) == ("answered", "not_in_set")
    assert the_set.gap_questions() == []
    assert the_set.agrees() == dict.fromkeys(SEVEN, True)
