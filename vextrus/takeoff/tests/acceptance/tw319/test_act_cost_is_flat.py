"""A Step 1 act costs the same on 20 sheets and on 220 (T-W319 section 3, cases 1 to 8): "A QS's
confirm, exclude, undo or answer on Step 1 costs time in proportion to the Project's Sheets, not to
the Sheets the act names." The pin is the count of SQL statements an act runs over HTTP (where
`set_conflicts` runs, in the router), equal at `SMALL` and `LARGE`: the Disciplines, the views per
sheet and the acted-on sheet are the same, so nothing legitimately differs between the sizes."""

from collections.abc import Callable

import pytest

from vextrus.takeoff.services import step1
from vextrus.testing.auth import Api
from vextrus.testing.drawings import QsProject

from .cost import (
    ACTED_ON,
    LARGE,
    SMALL,
    CostProject,
    kinds_of,
    low_confidence,
    missing_number,
    posted,
    project_of,
    queries,
    ready_api,
)

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


def at_both_sizes[T](qs_project: QsProject, measure: Callable[[CostProject, Api], T]) -> dict[int, T]:
    """`measure` on a fresh Project of `SMALL` sheets and on one of `LARGE`: its counts by size."""
    counts = {}
    for size in (SMALL, LARGE):
        project = project_of(qs_project, size)
        counts[size] = measure(project, ready_api(project))
    return counts


def confirm_one(project: CostProject, api: Api) -> Callable[[], object]:
    return posted(api, f"{project.path}/confirm", {"proposals": [str(project.proposal_of[ACTED_ON])]})


def exclude_one(project: CostProject, api: Api) -> Callable[[], object]:
    return posted(
        api,
        f"{project.path}/exclude",
        {"proposals": [str(project.proposal_of[ACTED_ON])], "reason": "duplicate"},
    )


def undo(project: CostProject, api: Api) -> Callable[[], object]:
    return posted(api, f"{project.path}/undo", {})


def answering(project: CostProject, api: Api, question: object, option: str, text: str = "") -> int:
    return queries(
        posted(
            api,
            f"{project.path}/questions/{question}/answer",
            {"option": option, "text": text},
        )
    )


def test_confirming_one_sheet_costs_the_same_on_20_sheets_and_on_220(qs_project: QsProject) -> None:
    counts = at_both_sizes(qs_project, lambda p, api: queries(confirm_one(p, api)))

    assert counts[LARGE] == counts[SMALL], counts


def test_excluding_one_sheet_costs_the_same_on_20_sheets_and_on_220(qs_project: QsProject) -> None:
    counts = at_both_sizes(qs_project, lambda p, api: queries(exclude_one(p, api)))

    assert counts[LARGE] == counts[SMALL], counts


def test_undoing_a_confirm_and_an_exclude_costs_the_same_on_20_sheets_and_on_220(
    qs_project: QsProject,
) -> None:
    def measure(project: CostProject, api: Api) -> dict[str, int]:
        confirm_one(project, api)()
        after_confirm = queries(undo(project, api))
        exclude_one(project, api)()
        after_exclude = queries(undo(project, api))
        return {"undo a confirm": after_confirm, "undo an exclude": after_exclude}

    counts = at_both_sizes(qs_project, measure)

    assert counts[LARGE] == counts[SMALL], counts


def test_an_answer_that_confirms_a_sheet_costs_the_same_on_20_sheets_and_on_220(
    qs_project: QsProject,
) -> None:
    kind, _other = kinds_of()

    def measure(project: CostProject, api: Api) -> int:
        question = low_confidence(project)
        cost = answering(project, api, question, kind)
        listed = api.get(f"{project.path}/proposals").json()["proposals"]
        [acted] = [p for p in listed if p["number"] == ACTED_ON]
        assert (acted["decision"], acted["confirmed_kind"]) == ("confirmed", kind)
        return cost

    counts = at_both_sizes(qs_project, measure)

    assert counts[LARGE] == counts[SMALL], counts


def test_an_answer_that_keeps_a_question_open_costs_the_same_on_20_sheets_and_on_220(
    qs_project: QsProject,
) -> None:
    def measure(project: CostProject, api: Api) -> int:
        question = low_confidence(project)
        cost = answering(project, api, question, "keep_open")
        with project.member.acting():
            [still] = [q for q in step1.questions(project.project_id) if q.id == question]
        assert still.status == "open"
        return cost

    counts = at_both_sizes(qs_project, measure)

    assert counts[LARGE] == counts[SMALL], counts


def test_a_typed_number_answer_costs_the_same_on_20_sheets_and_on_220(qs_project: QsProject) -> None:
    def measure(project: CostProject, api: Api) -> int:
        question = missing_number(project)
        cost = answering(project, api, question, "type_number", "S-900")
        listed = api.get(f"{project.path}/proposals").json()["proposals"]
        assert [p["number"] for p in listed].count("S-900") == 1
        return cost

    counts = at_both_sizes(qs_project, measure)

    assert counts[LARGE] == counts[SMALL], counts


def test_a_bulk_confirm_pays_little_per_sheet_it_names(qs_project: QsProject) -> None:
    project = project_of(qs_project, LARGE)
    api = ready_api(project)
    with project.member.acting():
        step1.set_list(project.project_id, "structural", "S-001 to S-040", actor_name="A trial QS")
    named = [str(project.proposal_of[f"S-{n:03d}"]) for n in range(1, 41)]
    listed = api.get(f"{project.path}/proposals").json()["proposals"]
    assert {p["id"] for p in listed if p["agrees"]} >= set(named), "the list makes the 40 agree"

    ten = queries(posted(api, f"{project.path}/confirm", {"proposals": named[:10]}))
    undo(project, api)()
    forty = queries(posted(api, f"{project.path}/confirm", {"proposals": named}))

    assert (forty - ten) / 30 <= 20, {"ten": ten, "forty": forty}


def test_the_four_step1_lists_cost_the_same_on_20_sheets_and_on_220(qs_project: QsProject) -> None:
    def measure(project: CostProject, api: Api) -> dict[str, int]:
        counts = {}
        for name in ("proposals", "questions", "progress", "coverage"):

            def get(name: str = name) -> None:
                assert api.get(f"{project.path}/{name}").status_code == 200

            counts[name] = queries(get)
        return counts

    counts = at_both_sizes(qs_project, measure)

    assert counts[LARGE] == counts[SMALL], counts
