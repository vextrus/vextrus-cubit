"""S24-C1 fix round 1: the whole-run exemption judges the row as the web builds it (the run's sheets
decided alike), not every sheet of the run. The scene is the acceptance test's, with S-01 in the run."""

import uuid

import pytest

from engine.messages import Message
from vextrus.takeoff.models import QuestionKind
from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.ts24c1 import test_a_run_confirms_as_its_row as scene
from vextrus.testing.drawings import QsProject, propose_out

pytestmark = pytest.mark.django_db

RUN = ["S-01", "S-02", "S-03", "S-04"]
REST = RUN[1:]


@pytest.fixture
def the_set(qs_project: QsProject, monkeypatch: pytest.MonkeyPatch) -> scene._Set:
    titles = dict.fromkeys(RUN, scene.RUN_TITLE) | {"S-05": "LIFT CORE DETAILS"}
    monkeypatch.setattr(scene, "TITLES", titles)
    made = scene._Set(qs_project)
    listed = made.listed()
    assert len({listed[n]["continuation"] for n in RUN}) == 1
    assert listed["S-01"]["continuation"] is not None
    assert listed["S-01"]["agrees"] is True
    assert [listed[n]["agrees"] for n in REST] == [False] * 3
    return made


def test_the_one_source_rest_of_a_run_confirms_as_its_row_after_its_agreeing_sheet(
    the_set: scene._Set,
) -> None:
    first = the_set.confirm(["S-01"])
    assert first.status_code == 200, first.content

    response = the_set.confirm(REST)

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 3
    assert [the_set.decisions()[n] for n in RUN] == ["confirmed"] * 4


def test_the_rest_of_the_row_confirms_after_one_sheet_confirmed_in_sheet_mode(
    the_set: scene._Set,
) -> None:
    assert the_set.confirm(["S-04"]).status_code == 200  # sheet mode: one sheet, no bulk act

    response = the_set.confirm(["S-01", "S-02", "S-03"])

    assert response.status_code == 200, response.content


def test_a_one_source_sheet_of_the_rest_alone_or_part_of_the_rest_is_still_refused(
    the_set: scene._Set,
) -> None:
    assert the_set.confirm(["S-01"]).status_code == 200

    part = the_set.confirm(REST[:2])

    assert part.status_code == 409, part.content
    assert part.json()["code"] == scene.ONE_SOURCE
    assert [the_set.decisions()[n] for n in REST] == [None] * 3


def test_the_rest_and_a_sheet_outside_the_run_are_still_refused(the_set: scene._Set) -> None:
    assert the_set.confirm(["S-01"]).status_code == 200

    response = the_set.confirm([*REST, "S-05"])

    assert response.status_code == 409, response.content
    assert response.json()["code"] == scene.ONE_SOURCE


@pytest.fixture
def split_set(qs_project: QsProject, monkeypatch: pytest.MonkeyPatch) -> scene._Set:
    """S-00 to S-03 one run; S-01 agrees through its Plot page; S-00, S-02, S-03 have one source."""
    numbers = ["S-00", "S-01", "S-02", "S-03"]
    titles = dict.fromkeys(numbers, scene.RUN_TITLE) | {"S-04": "LIFT CORE DETAILS"}
    monkeypatch.setattr(scene, "TITLES", titles)
    made = scene._Set(qs_project)
    listed = made.listed()
    assert len({listed[n]["continuation"] for n in numbers}) == 1
    assert listed["S-00"]["continuation"] is not None
    assert [listed[n]["agrees"] for n in numbers] == [False, True, False, False]
    return made


def test_a_run_split_in_the_middle_confirms_each_of_its_rows(split_set: scene._Set) -> None:
    assert split_set.confirm(["S-01"]).status_code == 200  # the bulk act's sheet, mid-run

    below = split_set.confirm(["S-02", "S-03"])  # the web's row after S-01

    assert below.status_code == 200, below.content
    assert below.json()["sheets"] == 2
    assert [split_set.decisions()[n] for n in ["S-01", "S-02", "S-03"]] == ["confirmed"] * 3
    assert split_set.decisions()["S-00"] is None


def test_sheets_a_decided_sheet_separates_are_not_one_row(split_set: scene._Set) -> None:
    assert split_set.confirm(["S-02"]).status_code == 200  # sheet mode, mid-run

    response = split_set.confirm(["S-00", "S-03"])  # apart in the list: two rows, never one act

    assert response.status_code == 409, response.content
    assert response.json()["code"] == scene.ONE_SOURCE
    assert [split_set.decisions()[n] for n in ["S-00", "S-03"]] == [None, None]


def test_a_run_whose_middle_sheet_is_proposed_out_is_two_rows_either_side_of_it(
    the_set: scene._Set,
) -> None:
    # S-01 confirmed first, S-03 proposed out (blank): since S29-M0a the web lists S-02 and S-04 as
    # two rows (S-03 lies between them), so the two together are not one row but the bulk act.
    assert the_set.confirm(["S-01"]).status_code == 200
    propose_out(the_set.project_id, "S-03", "blank")
    assert the_set.listed()["S-03"]["proposed_exclusion"] == "blank"

    together = the_set.confirm(["S-02", "S-04"])

    assert together.status_code == 409, together.content
    assert together.json()["code"] == scene.ONE_SOURCE
    assert the_set.confirm(["S-02"]).status_code == 200
    assert the_set.confirm(["S-04"]).status_code == 200


# S29-M0a-F1: the server's rows break where the web's `sheetRows` does. A sheet of the same number
# series strictly between two members (proposed out, or held by an open Question) splits the run into
# two rows; a row act on either part is the row the web shows, not the bulk act.
LONG = ["S-01", "S-02", "S-03", "S-04", "S-05"]


@pytest.fixture
def long_set(qs_project: QsProject, monkeypatch: pytest.MonkeyPatch) -> scene._Set:
    """S-01 to S-05 one run; S-01 agrees through its Plot page; the rest have one source."""
    titles = dict.fromkeys(LONG, scene.RUN_TITLE) | {"S-06": "LIFT CORE DETAILS"}
    monkeypatch.setattr(scene, "TITLES", titles)
    made = scene._Set(qs_project)
    listed = made.listed()
    assert len({listed[n]["continuation"] for n in LONG}) == 1
    assert listed["S-01"]["continuation"] is not None
    assert [listed[n]["agrees"] for n in LONG] == [True, False, False, False, False]
    return made


def _hold(made: scene._Set, number: str) -> None:
    """An open Question on one sheet, as a low confidence asks it."""
    sheet_id = uuid.UUID(made.listed()[number]["sheet_id"])
    with made.member.acting():
        step1.raise_question(
            made.project_id,
            QuestionKind.LOW_CONFIDENCE,
            Message(code="takeoff.step1.which_kind", params={"number": number}),
            subject_id=sheet_id,
            discipline="structural",
        )


def test_the_part_of_a_run_after_a_proposed_out_middle_sheet_confirms_as_its_row(
    long_set: scene._Set,
) -> None:
    assert long_set.confirm(["S-01"]).status_code == 200
    propose_out(long_set.project_id, "S-03", "blank")

    response = long_set.confirm(["S-04", "S-05"])  # the web's row after S-03: S-04 to S-05

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 2
    decided = long_set.decisions()
    assert [decided[n] for n in ["S-02", "S-04", "S-05"]] == [None, "confirmed", "confirmed"]


def test_each_part_of_a_run_beside_a_question_held_sheet_confirms_as_its_row(
    long_set: scene._Set,
) -> None:
    _hold(long_set, "S-03")

    before = long_set.confirm(["S-01", "S-02"])  # the web's row before S-03
    after = long_set.confirm(["S-04", "S-05"])  # and after it

    assert before.status_code == 200, before.content
    assert after.status_code == 200, after.content
    decided = long_set.decisions()
    assert [decided[n] for n in LONG] == ["confirmed", "confirmed", None, "confirmed", "confirmed"]


def test_sheets_across_a_question_held_sheet_are_still_refused_as_one_row(long_set: scene._Set) -> None:
    _hold(long_set, "S-03")

    response = long_set.confirm(["S-01", "S-02", "S-04", "S-05"])

    assert response.status_code == 409, response.content
    assert response.json()["code"] == scene.ONE_SOURCE
    assert [long_set.decisions()[n] for n in LONG] == [None] * 5


def test_the_whole_run_unsplit_still_confirms_as_its_row(long_set: scene._Set) -> None:
    response = long_set.confirm(LONG)

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 5


@pytest.mark.parametrize(
    ("a", "b", "spans"),
    [
        ("S-01", "S-02", False),  # next to each other: nothing between
        ("S-02", "S-04", True),  # S-03 lies between
        ("S-04", "S-02", True),  # either order
        ("S-01", "S-01", False),  # a copy of a boundary number is not between
        ("S-02", "A-04", False),  # another series
        ("S-02", None, False),  # a sheet with no number
        (" S-02 ", "S-04", True),  # trimmed, as `numberParts`
        ("S-٢", "S-04", False),  # an Arabic-Indic digit is no running number, as the web's \d
    ],
)
def test_a_number_lies_between_two_only_strictly_as_the_webs_sheet_rows(
    a: str, b: str | None, spans: bool
) -> None:
    runnings = step1._runnings(["S-01", "S-01", "S-03", "S-02", "A-03", None, "S-04"])

    assert step1._spans(runnings, a, b) is spans
