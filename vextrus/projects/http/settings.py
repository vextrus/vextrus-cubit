"""A Building's Gross Floor Area in the API (C15; the session-16 contract): a stub answering 501, the
guard first. B replaces this module."""

import uuid
from typing import Literal

from django.http import HttpRequest, HttpResponse
from ninja import Router, Schema

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services.auth import Act, Grant

router = Router()


class GrossFloorAreaIn(Schema):
    value: str
    unit: Literal["sft", "m2"]


class BuildingGrossFloorAreaOut(Schema):
    building_id: uuid.UUID
    gross_floor_area_m2: str


SET_GROSS_FLOOR_AREA = Act("projects.set_gross_floor_area", Grant.CHANGE)
"""Enter a Building's Gross Floor Area: the QS and the Vextrus Engineer."""


@router.put(
    "/projects/{project_id}/buildings/{building_id}/gross-floor-area",
    response={200: BuildingGrossFloorAreaOut, 400: Refusal, 404: Refusal},
)
@declare(SET_GROSS_FLOOR_AREA, project="project_id")
def set_gross_floor_area(
    request: HttpRequest, project_id: uuid.UUID, building_id: uuid.UUID, payload: GrossFloorAreaIn
) -> HttpResponse:
    return HttpResponse(status=501)
