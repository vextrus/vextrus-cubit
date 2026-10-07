"""The 3D's data in the API (docs/plans/M1.md C17): session 16's stub (S16-K0), answering 501 after
07's guard until T2 replaces this module."""

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router, Status

from vextrus.platform.http.acts import Refusal, declare
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.frame import ElementPrimitivesOut

router = Router()

NOT_BUILT = Status(501, {"code": "platform.not_built", "params": {}})


@router.get(
    "/projects/{project_id}/takeoff/model/primitives",
    response={200: list[ElementPrimitivesOut], 501: Refusal},
)
@declare(acts.LOOK, project="project_id")
def list_primitives(request: HttpRequest, project_id: uuid.UUID, seq: int | None = None) -> Any:
    return NOT_BUILT
