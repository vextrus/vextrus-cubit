"""The Priced BOQ in the API (C13; the session-16 contract): a stub answering 501, the guard first.
B replaces this module."""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.boq.schemas.boq import BoqLinesOut, BoqOut
from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services.auth import Act, Grant

router = Router()

LOOK = Act("boq.look", Grant.LOOK)
"""Read the Priced BOQ and its lines: every role."""


@router.get("/projects/{project_id}/boq", response={200: BoqOut})
@declare(LOOK, project="project_id")
def get_boq(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    return HttpResponse(status=501)


@router.get(
    "/projects/{project_id}/boq/items/{item_code}/lines", response={200: BoqLinesOut, 404: Refusal}
)
@declare(LOOK, project="project_id")
def list_lines(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> HttpResponse:
    return HttpResponse(status=501)
