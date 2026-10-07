"""One Element as the inspector reads it: session 16's stub (S16-K0), answering 501 after 07's guard
until L replaces this module (`vextrus/live_model/schemas/model.py`)."""

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router, Status

from vextrus.live_model.schemas.model import ElementOut
from vextrus.platform.http.acts import Act, Grant, Refusal, declare

router = Router()

LOOK = Act("live_model.look", Grant.LOOK)
"""Read the Live Model's Elements: every role."""

NOT_BUILT = Status(501, {"code": "platform.not_built", "params": {}})


@router.get(
    "/projects/{project_id}/model/elements/{element_id}",
    response={200: ElementOut, 501: Refusal},
)
@declare(LOOK, project="project_id")
def get_element(request: HttpRequest, project_id: uuid.UUID, element_id: uuid.UUID) -> Any:
    return NOT_BUILT
