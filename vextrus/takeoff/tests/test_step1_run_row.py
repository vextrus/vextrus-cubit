"""S24-C1 fix round 1: the whole-run exemption judges the row as the web builds it (the run's sheets
decided alike), not every sheet of the run. The scene is the acceptance test's, with S-01 in the run."""

import pytest

from vextrus.drawings import models
from vextrus.takeoff.tests.acceptance.ts24c1 import test_a_run_confirms_as_its_row as scene
from vextrus.testing.drawings import QsProject

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


def test_a_run_whose_middle_sheet_is_proposed_out_confirms_as_the_row_left(
    the_set: scene._Set,
) -> None:
    # S-01 confirmed first, S-03 proposed out (blank): the web lists S-02, S-04 as the row left.
    assert the_set.confirm(["S-01"]).status_code == 200
    models.SheetRevision.objects.filter(
        drawing_set__project_id=the_set.project_id, sheet__number="S-03"
    ).update(proposed_exclusion="blank")
    assert the_set.listed()["S-03"]["proposed_exclusion"] == "blank"

    response = the_set.confirm(["S-02", "S-04"])

    assert response.status_code == 200, response.content
    assert response.json()["sheets"] == 2
