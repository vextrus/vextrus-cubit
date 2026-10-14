"""The 3D's data and the Element inspector in the API (docs/plans/M1.md C17; under
`/api/projects/{project_id}/takeoff/model/`).

Stubs of the contract freeze (M1-00): each route has its contract's reply, sits behind 07's guard,
and then answers 501 `platform.stubs.not_built`. M1-25 replaces them whole.
"""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.http.stubs import not_built
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.model import ElementInspectorOut, ElementPrimitivesOut

router = Router()

_PREFIX = "/projects/{project_id}/takeoff/model"


@router.get(f"{_PREFIX}/primitives", response={200: list[ElementPrimitivesOut], 501: Refusal})
@declare(acts.LOOK, project="project_id")
def list_primitives(request: HttpRequest, project_id: uuid.UUID, seq: int | None = None) -> HttpResponse:
    """Every Element part's primitives at a ModelVersion (the latest without `seq`)."""
    return not_built()


@router.get(f"{_PREFIX}/elements/{{element_id}}", response={200: ElementInspectorOut, 501: Refusal})
@declare(acts.LOOK, project="project_id")
def get_element(request: HttpRequest, project_id: uuid.UUID, element_id: uuid.UUID) -> HttpResponse:
    """One Element as the inspector shows it."""
    return not_built()
