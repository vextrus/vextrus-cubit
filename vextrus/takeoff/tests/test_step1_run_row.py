"""S24-C1 fix round 1: the whole-run exemption judges the row as the web builds it (the run's sheets
decided alike), not every sheet of the run. The scene is the acceptance test's, with S-01 in the run."""

import pytest

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
