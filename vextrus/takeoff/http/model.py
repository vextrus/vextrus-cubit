"""The 3D's data in the API (C17; the session-16 contract): a stub answering 501, the guard first.
T2 replaces this module."""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import declare
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.frame import ModelElementPrimitivesOut

router = Router()


@router.get(
    "/projects/{project_id}/takeoff/model/primitives",
    response={200: list[ModelElementPrimitivesOut]},
)
@declare(acts.LOOK, project="project_id")
def list_primitives(request: HttpRequest, project_id: uuid.UUID, seq: int | None = None) -> HttpResponse:
    return HttpResponse(status=501)
