"""S16-L's element inspector: `GET /api/projects/{project_id}/model/elements/{element_id}` returns
`{element_id, family, mark, storey, grid_ref, ifc_class, classification: [{system, code}],
attrs: [{key, value, unit}], trace: [{fact, kind, sheet_id, view_id, anchor}]}` (session 16's
contract, live_model), and 404 to another tenant."""

import uuid
from collections.abc import Callable

import pytest

from vextrus.live_model.tests.acceptance.ts16l.model import ANCHOR, building_of, column, live, tables
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member


def applied_column(project: QsProject) -> uuid.UUID:
    building = building_of(project)
    with project.member.acting():
        version = live.apply(building, uuid.uuid4(), [column()], cause="confirmation")
        state = tables.ElementState.objects.get(valid_from_seq=version.seq)
        return uuid.UUID(str(state.element_id))


def url(project: QsProject, element: uuid.UUID) -> str:
    return f"/api/projects/{project.project_id}/model/elements/{element}"


@pytest.mark.django_db
def test_the_inspector_shows_the_element_s_ifc_class_classification_and_trace(
    qs_project: QsProject,
) -> None:
    element = applied_column(qs_project)
    reply = api_as(qs_project.member).get(url(qs_project, element))
    assert reply.status_code == 200
    body = reply.json()
    assert body["element_id"] == str(element)
    assert body["family"] == "column"
    assert body["mark"] == "C2"
    assert body["grid_ref"] == "B/2"
    assert body["ifc_class"] == "IfcColumn"
    assert any("Uniclass" in c["system"] and c["code"].startswith("EF_") for c in body["classification"])
    assert {"key": "vx.column.section_b", "value": "0.254", "unit": "m"} in body["attrs"]
    size = [t for t in body["trace"] if t["fact"] == "size"]
    assert size
    assert size[0]["kind"] == "sheet_entity"
    assert size[0]["sheet_id"] == ANCHOR["sheet_id"]
    assert size[0]["view_id"] == ANCHOR["view_id"]


@pytest.mark.django_db
def test_another_tenant_gets_404_for_the_element(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    element = applied_column(qs_project)
    other = sign_in(role="qs")
    reply = api_as(other).get(url(qs_project, element))
    assert reply.status_code == 404
