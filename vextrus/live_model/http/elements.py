"""The element inspector in the API (session 16's live_model contract):
`GET /api/projects/{project_id}/model/elements/{element_id}`.

It declares its act through 07's guard, which answers first: signed out 401; a Project outside the
Membership's scope 404. An Element of another Project, of another Developer, or none at all is the
one 404 (`platform.auth.not_found`).
"""

import uuid

from django.http import HttpRequest
from ninja import Router, Schema

from vextrus.live_model import acts, services
from vextrus.platform.http.acts import Refusal, declare

router = Router()


class ElementClassificationOut(Schema):
    system: str
    code: str


class ElementAttrOut(Schema):
    key: str
    value: str
    unit: str


class ElementTraceOut(Schema):
    fact: str
    kind: str
    sheet_id: str | None
    view_id: str | None
    anchor: dict[str, object]
    sheet_number: str | None = None
    sheet_title: str | None = None


class ElementOut(Schema):
    element_id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    grid_ref: str
    ifc_class: str
    classification: list[ElementClassificationOut]
    attrs: list[ElementAttrOut]
    trace: list[ElementTraceOut]


@router.get(
    "/projects/{project_id}/model/elements/{element_id}", response={200: ElementOut, 404: Refusal}
)
@declare(acts.LOOK, project="project_id")
def get_element(request: HttpRequest, project_id: uuid.UUID, element_id: uuid.UUID) -> ElementOut:
    """One Element as it stands: its family's IFC class and classification, its attributes in their
    storage units, and where each fact came from."""
    view = services.element(project_id, element_id)
    return ElementOut(
        element_id=view.element_id,
        family=view.family,
        mark=view.mark,
        storey=view.storey,
        grid_ref=view.grid_ref,
        ifc_class=view.ifc_class,
        classification=[
            ElementClassificationOut(system=c.system, code=c.code) for c in view.classification
        ],
        attrs=[ElementAttrOut(key=a.key, value=a.value, unit=a.unit) for a in view.attrs],
        trace=[
            ElementTraceOut(
                fact=t.fact,
                kind=t.kind,
                sheet_id=t.sheet_id,
                view_id=t.view_id,
                anchor=t.anchor,
                sheet_number=t.sheet_number,
                sheet_title=t.sheet_title,
            )
            for t in view.trace
        ],
    )
