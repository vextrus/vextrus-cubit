"""A bulk confirm pays little per sheet it names, and the four Step 1 lists cost the same on 20 sheets
and on 220 (T-W319 section 3, cases 7 and 8; split from `test_act_cost_is_flat.py` unchanged, so each
file runs within the acceptance lint's bound)."""

import pytest

from vextrus.takeoff.services import step1
from vextrus.testing.auth import Api
from vextrus.testing.drawings import QsProject

from .cost import LARGE, SMALL, CostProject, at_both_sizes, posted, project_of, queries, ready_api, undo

pytestmark = pytest.mark.django_db(databases=["default", "owner"])


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
