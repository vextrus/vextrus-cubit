"""The statements a Step 1 act runs through the API (S29-M0b): an act reads its Project's scope, its
Drawing Set and the Market's sheet conventions once, its progress rows count the set's files once, and
an undo reads the standing steps once a sheet, never once a view. Measured at S29-M0b: confirm 165
(main 178), exclude 166 (main 182), undo 100 (main 126), on 3 sheets."""

import uuid
from collections.abc import Callable

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from engine.recognise.types import Box, ViewCandidate, ViewKind
from vextrus.drawings import services as drawings
from vextrus.projects import services as projects
from vextrus.takeoff.services import step1
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, frame, read_dwg
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

CONFIRM = 165
EXCLUDE = 166
UNDO = 100


def step1_of(qs: QsProject, sheets: int, *, views: int = 1) -> tuple[Member, list[uuid.UUID]]:
    """A Step 1 Project of `sheets` printed sheets of `views` unaccounted views each, proposed and
    covered."""
    member = qs.member
    structural = add(member, qs.project_id, "KR-STR-R0.dwg", drawing()).file
    printed = read_dwg(member, structural.id, [f"S-{n + 1:03d}" for n in range(sheets)])
    with member.acting():
        if views > 1:
            for i, sheet in enumerate(printed):
                box = frame(i)
                width = (box.x1 - box.x0) / views
                drawings.record_views(
                    sheet.id,
                    [
                        ViewCandidate(
                            box=Box(box.x0 + n * width, 0, box.x0 + (n + 1) * width, 30),
                            kind=ViewKind.TITLE_BLOCK,
                        )
                        for n in range(views)
                    ],
                )
        drawing_set = drawings.set_of(qs.project_id)
        assert drawing_set is not None
        ids = [s.id for s in drawings.sheets(drawing_set.id)]
        proposals = [step1.propose_sheet(sheet_id) for sheet_id in ids]
        for sheet_id in ids:
            step1.record_coverage(sheet_id)
    return member, proposals


def statements(qs: QsProject, act: str, *, views: int = 1) -> int:
    member, proposals = step1_of(qs, 3, views=views)
    api = api_as(member)
    path = f"/api/projects/{qs.project_id}/takeoff/step1/"
    body: dict[str, object] = {"proposals": [str(proposals[0])]}
    if act == "undo":
        assert api.post(path + "confirm", body).status_code == 200
        body = {}
    elif act == "exclude":
        body |= {"reason": "other", "text": "a test"}
    with CaptureQueriesContext(connection) as captured:
        r = api.post(path + act, body)
    assert r.status_code == 200, r.content
    return len(captured)


@pytest.mark.parametrize(("act", "most"), [("confirm", CONFIRM), ("exclude", EXCLUDE), ("undo", UNDO)])
def test_an_act_runs_no_more_statements_than_measured(
    qs_project: QsProject, act: str, most: int
) -> None:
    count = statements(qs_project, act)
    assert count <= most, f"{act} ran {count} statements, more than {most}"


def test_an_undo_reads_the_standing_steps_once_a_sheet_not_once_a_view(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    """Each more view costs its own Coverage row's write, and no read (main read the sheet again for
    each view: about 10 statements a view)."""
    few = statements(qs_project, "undo")
    other = sign_in(role="qs")
    with other.acting():
        project = projects.create(code="M0B-VIEWS", name="Undo of a sheet of 8 views")
    many = statements(QsProject(other, project.id), "undo", views=8)
    assert many - few <= 8 - 1, f"undo grew with the views: {few} at 1 a sheet, {many} at 8"
