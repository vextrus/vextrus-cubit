"""Ticket S15-S1 (#533), #223: "The demo seed has no Question that asks 'Which Discipline?' ... Add to
`seed_demo` one file whose Discipline is unknown (so the Question is raised exactly as 21c's job would,
same subject and option keys) ... and must not raise a twin Question (#204)"; with #150 for its sheet:
"draw each seeded sheet's views with plausible content inside their boxes".

Which Project holds it is the seed's to choose (KR-01's counts are m0-screens §7's, pinned by t182 and
T-236): every seeded Project is looked at, as its Developer's QS sees it on the API.
"""

from typing import Any

import pytest

from vextrus.seed.demo import Demo
from vextrus.seed.tests.acceptance.t136.seeded import *  # noqa: F403 (its fixtures, found by name)
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import answer, keys, picked, questions
from vextrus.testing.auth import Api

from .walked import (
    KEEP_OPEN,
    WHICH_DISCIPLINE,
    asked_which_discipline,
    disciplines,
    empty_views,
    files,
    line,
    named,
    read_steps,
    the_sheet,
    twins,
)

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def test_the_seed_asks_which_discipline_a_sheet_is(demo: Demo, nusrat: Api, tanvir: Api) -> None:
    for _seeded, q in asked_which_discipline(demo, nusrat, tanvir):
        assert q["code"] == WHICH_DISCIPLINE, q
        assert q["status"] == "open", q


def test_the_seeded_question_offers_the_markets_disciplines_then_keep_open_none_picked(
    demo: Demo, nusrat: Api, tanvir: Api
) -> None:
    """21c's options: each of the Market's Disciplines by its key, in the Market's order, then "Keep
    open, ask the consultant"; the job pre-picks none."""
    for seeded, q in asked_which_discipline(demo, nusrat, tanvir):
        market = [d["key"] for d in disciplines(seeded)]
        assert keys(q) == [*market, KEEP_OPEN], (seeded.code, q["options"])
        assert picked(q) == [], (seeded.code, q["options"])


def test_the_seeded_question_is_about_one_sheet_of_no_discipline_read_by_the_job(
    demo: Demo, nusrat: Api, tanvir: Api
) -> None:
    """21c's subject: the sheet of no Discipline (its file's Discipline unknown), named in the words
    by its number (else its title), its Proposal the one the Question holds; the file read by the
    product's read job (#182), not written as rows."""
    for seeded, q in asked_which_discipline(demo, nusrat, tanvir):
        sheet = the_sheet(seeded, q["subject_id"])
        assert sheet["discipline"] is None, (seeded.code, sheet["number"])
        assert q["proposals"] == [sheet["id"]], (seeded.code, sheet["number"])
        assert q["params"] == named(sheet), (seeded.code, q["params"])
        assert files(seeded)[str(sheet["file_id"])]["discipline"] is None, sheet["file_name"]
        steps = read_steps(demo, seeded, str(sheet["file_id"]))
        assert {"sheets", "finishing"} <= steps, f"{sheet['file_name']} was not read by the job: {steps}"


def test_the_sheet_of_no_discipline_is_drawn_inside_its_view_boxes(
    demo: Demo, nusrat: Api, tanvir: Api
) -> None:
    """#150 for the sheet the Question asks about: it has views, and none of their boxes is empty."""
    for seeded, q in asked_which_discipline(demo, nusrat, tanvir):
        sheet = the_sheet(seeded, q["subject_id"])
        assert sheet["views"], (seeded.code, sheet["number"])
        assert empty_views(seeded, sheet) == [], (seeded.code, sheet["number"])


def test_answering_which_discipline_sets_the_sheets_discipline_and_raises_no_twin(
    demo: Demo, nusrat: Api, tanvir: Api
) -> None:
    [(seeded, q), *_] = asked_which_discipline(demo, nusrat, tanvir)
    assert twins(seeded) == []
    chosen = keys(q)[0]

    response = answer(seeded.api, seeded.project_id, q["id"], chosen)

    assert response.status_code == 200, response.content
    assert twins(seeded) == []
    [after] = [a for a in questions(seeded.api, seeded.project_id) if a["id"] == q["id"]]
    assert after["status"] == "answered"
    assert the_sheet(seeded, q["subject_id"])["discipline"] == chosen


def test_keeping_which_discipline_open_asks_nothing_again(demo: Demo, nusrat: Api, tanvir: Api) -> None:
    [(seeded, q), *_] = asked_which_discipline(demo, nusrat, tanvir)
    before = sorted(line(a) for a in questions(seeded.api, seeded.project_id))

    response = answer(seeded.api, seeded.project_id, q["id"], KEEP_OPEN)

    assert response.status_code == 200, response.content
    after: list[Any] = sorted(line(a) for a in questions(seeded.api, seeded.project_id))
    assert after == before
    assert twins(seeded) == []
