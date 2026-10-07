"""An answer costs the same on 20 sheets and on 220 (T-W319 section 3, cases 4 to 6; split from
`test_act_cost_is_flat.py` unchanged, so each file runs within the acceptance lint's bound): the
statements an answer runs over HTTP, equal at `SMALL` and `LARGE`."""

import pytest

from vextrus.takeoff.services import step1
from vextrus.testing.auth import Api
from vextrus.testing.drawings import QsProject

from .cost import (
    ACTED_ON,
    LARGE,
    SMALL,
    CostProject,
    answering,
    at_both_sizes,
    kinds_of,
    low_confidence,
    missing_number,
)

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


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
