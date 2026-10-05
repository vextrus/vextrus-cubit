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
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    jev_says,
    open_questions,
    proposals,
    readers,
    run_job,
    uploaded,
)
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import step1 as step1_path
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline
from vextrus.testing.takeoff import Step1Project

pytestmark = pytest.mark.django_db

TB = "title_block"


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


def _numbered(project: Step1Project, *printed: str) -> list[drawings.SheetView]:
    """The project's first sheet printed as each number in turn (only the numbering is read)."""
    with project.member.acting():
        first = step1._sheets(project.project_id)[0]
    return [replace(first, number=n) for n in printed]


def test_a_gap_holds_the_places_either_side_of_it_in_the_numbering_as_read_now(
    numbers: Numbers, step1_project: Step1Project
) -> None:
    sheets = _numbered(step1_project, "M-10", "M-11", "M-14", "M-15", "M-15")
    place = {n: step1._place(numbers, n, "plumbing") for n in ("M-11", "M-14")}

    assert step1._beside_gaps(numbers, "plumbing", sheets) == {place["M-11"], place["M-14"]}


def test_an_answered_gap_holds_nothing_and_a_closed_one_holds_nothing(
    numbers: Numbers, step1_project: Step1Project
) -> None:
    gap = (step1._place(numbers, "M-11", "plumbing"), step1._place(numbers, "M-14", "plumbing"))
    sheets = _numbered(step1_project, "M-11", "M-14")
    assert step1._beside_gaps(numbers, "plumbing", sheets, [gap]) == set()  # type: ignore[list-item]
    closed = _numbered(step1_project, "M-11", "M-12", "M-13", "M-14")
    assert step1._beside_gaps(numbers, "plumbing", closed) == set()


def test_a_gap_question_whose_ends_do_not_parse_releases_nothing(numbers: Numbers) -> None:
    assert step1._answered_gaps(numbers, [("plumbing", {"after": "?", "before": ""})]) == {}


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


# The review's orders (PR #428, round 1): the numbering as read now decides, not the Questions -----


def _read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, *printed: str) -> None:
    sheets = [Sheet(n, f"RISER {n[-2:]} SCHEMATIC", (f"RISER {n[-2:]} SCHEMATIC",)) for n in printed]
    run_job(qs.member, uploaded(qs.member, qs.project_id, name), monkeypatch, readers({name: sheets}))


def _on(qs: QsProject) -> dict[str | None, str | None]:
    return {p["number"]: p["agrees_on"] for p in proposals(api_as(qs.member), qs.project_id)}


def _gaps_asked(qs: QsProject) -> list[tuple[str, str]]:
    return [
        (q["params"]["after"], q["params"]["before"])
        for q in open_questions(api_as(qs.member), qs.project_id)
        if q["code"] == "engine.register_check.gap"
    ]


def test_a_gap_left_when_a_list_is_taken_back_holds_its_neighbours_and_is_asked(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    """Read E-01 to E-03, type the list E-01 to E-07, read E-07 (the Check uses the list: no gap
    asked), then undo the list: E-03 and E-07 sit beside a gap no Question asked about yet; the undo
    asks it, and its answer lets them join."""
    jev_says(jev_offline, "0.97")
    api = api_as(qs_project.member)
    _read(qs_project, monkeypatch, "ZX-ELE-A.dwg", "E-01", "E-02", "E-03")
    given = api.post(
        f"{step1_path(qs_project.project_id)}/drawing-list",
        {"discipline": "electrical", "text": "E-01 to E-07"},
    )
    assert given.status_code == 200, given.content
    _read(qs_project, monkeypatch, "ZX-ELE-B.dwg", "E-07")
    assert _gaps_asked(qs_project) == []

    undone = api.post(f"{step1_path(qs_project.project_id)}/undo", {})
    assert undone.status_code == 200, undone.content

    assert _on(qs_project) == {"E-01": TB, "E-02": TB, "E-03": None, "E-07": None}
    by = {p["number"]: p["id"] for p in proposals(api, qs_project.project_id)}
    refused = confirm(api, qs_project.project_id, [by["E-01"], by["E-03"], by["E-07"]])
    assert refused.status_code == 409, refused.content
    assert _gaps_asked(qs_project) == [("E-03", "E-07")]

    [question] = [
        q for q in open_questions(api, qs_project.project_id) if q["code"] == "engine.register_check.gap"
    ]
    assert answer(api, qs_project.project_id, question["id"], "not_in_set").status_code == 200
    assert set(_on(qs_project).values()) == {TB}


def test_a_gap_that_closes_holds_nothing_and_its_question_is_retired(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    _read(qs_project, monkeypatch, "ZX-ELE-A.dwg", "E-01", "E-02", "E-04")
    assert _gaps_asked(qs_project) == [("E-02", "E-04")]
    assert _on(qs_project)["E-02"] is None

    _read(qs_project, monkeypatch, "ZX-ELE-B.dwg", "E-03")

    assert set(_on(qs_project).values()) == {TB}
    assert _gaps_asked(qs_project) == []


def test_a_list_given_retires_the_gap_it_now_covers(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev_offline: Offline
) -> None:
    jev_says(jev_offline, "0.97")
    _read(qs_project, monkeypatch, "ZX-ELE-A.dwg", "E-01", "E-02", "E-04")
    assert _gaps_asked(qs_project) == [("E-02", "E-04")]

    given = api_as(qs_project.member).post(
        f"{step1_path(qs_project.project_id)}/drawing-list",
        {"discipline": "electrical", "text": "E-01 to E-04"},
    )

    assert given.status_code == 200, given.content
    assert _gaps_asked(qs_project) == []
