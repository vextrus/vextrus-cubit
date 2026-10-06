"""A Step 1 act costs the same on 20 sheets and on 220 (T-W319 section 3, cases 1 to 3; the answers,
the bulk confirm and the lists are in `test_answer_cost_is_flat.py` and `test_bulk_and_list_cost.py`,
split out unchanged so each file runs within the acceptance lint's bound): "A QS's confirm, exclude,
undo or answer on Step 1 costs time in proportion to the Project's Sheets, not to the Sheets the act
names." The pin is the count of SQL statements an act runs over HTTP (where `set_conflicts` runs, in
the router), equal at `SMALL` and `LARGE`: the Disciplines, the views per sheet and the acted-on
sheet are the same, so nothing legitimately differs between the sizes."""

import pytest

from vextrus.testing.auth import Api
from vextrus.testing.drawings import QsProject

from .cost import LARGE, SMALL, CostProject, at_both_sizes, confirm_one, exclude_one, queries, undo

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


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
