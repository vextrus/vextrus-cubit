"""The Priced BOQ in the API: session 16's stubs (S16-K0), each answering 501 after 07's guard until
B replaces this module (`vextrus/boq/schemas/boq.py`)."""

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router, Status

from vextrus.boq.schemas.boq import BoqLinesOut, BoqOut
from vextrus.platform.http.acts import Act, Grant, Refusal, declare

router = Router()

LOOK = Act("boq.look", Grant.LOOK)
"""Read the Priced BOQ: every role."""

NOT_BUILT = Status(501, {"code": "platform.not_built", "params": {}})


@router.get("/projects/{project_id}/boq", response={200: BoqOut, 501: Refusal})
@declare(LOOK, project="project_id")
def get_boq(request: HttpRequest, project_id: uuid.UUID) -> Any:
    return NOT_BUILT


@router.get(
    "/projects/{project_id}/boq/items/{item_code}/lines",
    response={200: BoqLinesOut, 404: Refusal, 501: Refusal},
)
@declare(LOOK, project="project_id")
def list_item_lines(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> Any:
    return NOT_BUILT
