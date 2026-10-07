"""The Element inspector in the API (the session-16 contract): a stub answering 501, the guard first.
L replaces this module."""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.live_model.schemas.model import ElementOut
from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services.auth import Act, Grant

router = Router()

LOOK = Act("live_model.look", Grant.LOOK)
"""Read the Live Model's Elements: every role."""


@router.get(
    "/projects/{project_id}/model/elements/{element_id}", response={200: ElementOut, 404: Refusal}
)
@declare(LOOK, project="project_id")
def get_element(request: HttpRequest, project_id: uuid.UUID, element_id: uuid.UUID) -> HttpResponse:
    return HttpResponse(status=501)
