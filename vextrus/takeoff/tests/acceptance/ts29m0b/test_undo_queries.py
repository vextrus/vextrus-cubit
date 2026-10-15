"""Ticket S29-M0b, part 1: an undo on Step 1 runs fewer statements, and never more with more sheets.

G1 walk #1 of 9101c005 failed `act_p95_during_read` on the Edison set: the slow kind was undo (p95
1,159 ms against 1,000). The owner (session 29): "Also change undo now". Measured on main 1474ed4d
(the acceptance writer's scratch count, one confirm then one undo through the API): undo runs 126
statements on a Step 1 Project of 3, 30 and of 100 sheets alike; most are the same scope checks read
again (the Project about 16 times, its Drawing Set about 11). Step 1's write lock (`step1.writing`) is
not to change; the cut is in the statements.

Promises pinned:

1. **An undo runs at most `CEILING` statements** (the request's whole count, sign-in and scope checks
   included), on 3 sheets and on 100: about a sixth fewer than main's 126. The acceptance writer's
   throwaway (inside `step1.writing`, each Project scope check and Drawing Set read once an act; no
   change to the lock) runs 102.
2. **The count does not grow with the sheets** (a guard: green on main, kept green): an undo on 100
   sheets runs no more statements than on 3.

    uv run pytest -rf vextrus/takeoff/tests/acceptance/ts29m0b
"""

import uuid

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from vextrus.drawings import services as drawings
from vextrus.projects import services as projects
from vextrus.takeoff.services import step1
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

MAIN = 126
"""Statements an undo runs on main 1474ed4d, at 3, 30 and 100 sheets alike."""
CEILING = 105
"""Statements an undo may run at most (see the module)."""


def step1_of(qs: QsProject, sheets: int) -> tuple[Member, list[uuid.UUID]]:
    """A Step 1 Project of `sheets` printed sheets, proposed and covered, as `step1_project` makes 3."""
    member = qs.member
    structural = add(member, qs.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, structural.id, [f"S-{n + 1:03d}" for n in range(sheets)])
    with member.acting():
        drawing_set = drawings.set_of(qs.project_id)
        assert drawing_set is not None
        ids = [s.id for s in drawings.sheets(drawing_set.id)]
        proposals = [step1.propose_sheet(sheet_id) for sheet_id in ids]
        for sheet_id in ids:
            step1.record_coverage(sheet_id)
    return member, proposals


def undo_statements(qs: QsProject, sheets: int) -> int:
    """The statements one undo of one confirm runs, through the API."""
    member, proposals = step1_of(qs, sheets)
    api = api_as(member)
    path = f"/api/projects/{qs.project_id}/takeoff/step1/"
    r = api.post(path + "confirm", {"proposals": [str(proposals[0])]})
    assert r.status_code == 200, r.content
    with CaptureQueriesContext(connection) as captured:
        r = api.post(path + "undo", {})
    assert r.status_code == 200, r.content
    return len(captured)


@pytest.mark.parametrize("sheets", [3, 100])
def test_an_undo_runs_at_most_the_ceiling_of_statements(qs_project: QsProject, sheets: int) -> None:
    count = undo_statements(qs_project, sheets)
    assert count <= CEILING, f"undo ran too many statements: {count} > {CEILING} at {sheets} sheets"


def test_an_undo_runs_no_more_statements_on_100_sheets_than_on_3(qs_project: QsProject) -> None:
    few = undo_statements(qs_project, 3)
    # A second Project of the same Developer, its Step 1 of 100 sheets.
    member = qs_project.member
    with member.acting():
        other = projects.create(code="M0B-100", name="Undo at 100 sheets")
    many = undo_statements(QsProject(member, other.id), 100)
    assert many <= few, f"undo grew with the sheets: {few} at 3, {many} at 100"
