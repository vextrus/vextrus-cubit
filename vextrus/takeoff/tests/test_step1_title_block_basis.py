"""The title-block basis (#320; m0-screens §5, "What 'agrees' means"), at its helpers: where a number
sits in its Discipline's numbering, which places an open gap Question holds, and the order in which a
sheet's sources are named (`list`, then `plot`, then `title_block`). The end-to-end cases are the
acceptance tests' (`acceptance/w320`); every number here is invented."""

import uuid
from dataclasses import replace

import pytest

from engine.recognise.conflicts import Numbers, recognisers
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db


@pytest.fixture
def numbers() -> Numbers:
    conventions = step1._conventions()
    return Numbers(conventions, recognisers(conventions))


def test_a_place_is_the_series_and_running_number_whatever_the_suffix(numbers: Numbers) -> None:
    assert step1._place(numbers, "M-07", "electrical") == step1._place(numbers, "M-07A", "electrical")
    assert step1._place(numbers, "M-07", "electrical") != step1._place(numbers, "M-08", "electrical")


def test_no_number_or_one_that_does_not_parse_has_no_place(numbers: Numbers) -> None:
    assert step1._place(numbers, None, "electrical") is None
    assert step1._place(numbers, "", "electrical") is None
    assert step1._place(numbers, "PANEL/X", "electrical") is None


def test_a_gap_holds_the_places_either_side_of_it_in_its_own_discipline(numbers: Numbers) -> None:
    beside = step1._beside_gaps(
        numbers,
        [("plumbing", {"after": "M-11", "before": "M-14", "missing": 2, "discipline": "plumbing"})],
    )

    assert set(beside) == {"plumbing"}
    assert beside["plumbing"] == {
        step1._place(numbers, "M-11", "plumbing"),
        step1._place(numbers, "M-14", "plumbing"),
    }


def test_a_gap_whose_ends_do_not_parse_holds_nothing(numbers: Numbers) -> None:
    assert step1._beside_gaps(numbers, [("plumbing", {"after": "?", "before": ""})]) == {}


def _basis(project: Step1Project) -> dict[str | None, str | None]:
    found = {}
    for p in step1.proposals(project.project_id):
        assert p.agrees is (p.agrees_on is not None)
        found[p.number] = p.agrees_on
    return found


def test_a_plot_page_comes_before_the_title_block_and_a_list_before_both(
    step1_project: Step1Project, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheets_of = step1._sheets

    def plotted(project_id: uuid.UUID) -> list[drawings.SheetView]:
        return [replace(s, plot=replace(s.plot, page=n)) for n, s in enumerate(sheets_of(project_id), 1)]

    with step1_project.member.acting():
        assert set(_basis(step1_project).values()) == {"title_block"}
        monkeypatch.setattr(step1, "_sheets", plotted)
        assert set(_basis(step1_project).values()) == {"plot"}
        step1.set_list(step1_project.project_id, "structural", "S-01 to S-03", actor_name="QS")
        assert set(_basis(step1_project).values()) == {"list"}
