"""A Project's settings in the API (docs/plans/M1.md C15): session 16's stub for a Building's Gross
Floor Area (S16-K0), answering 501 after 07's guard until B replaces this module."""

import uuid
from decimal import Decimal
from typing import Any

from django.http import HttpRequest
from ninja import Router, Schema, Status

from vextrus.platform.http.acts import Act, Grant, Refusal, declare

router = Router()


class GrossFloorAreaIn(Schema):
    """The value as text, `unit` "sft" or "m2"; the service converts it and answers a bad one 400."""

    value: str
    unit: str


class GrossFloorAreaOut(Schema):
    building_id: uuid.UUID
    gross_floor_area_m2: Decimal


GROSS_FLOOR_AREA = Act("projects.gross_floor_area", Grant.CHANGE)
"""Enter a Building's Gross Floor Area: the QS and the Vextrus Engineer only."""

NOT_BUILT = Status(501, {"code": "platform.not_built", "params": {}})


@router.put(
    "/projects/{project_id}/buildings/{building_id}/gross-floor-area",
    response={200: GrossFloorAreaOut, 400: Refusal, 404: Refusal, 501: Refusal},
)
@declare(GROSS_FLOOR_AREA, project="project_id")
def set_gross_floor_area(
    request: HttpRequest, project_id: uuid.UUID, building_id: uuid.UUID, payload: GrossFloorAreaIn
) -> Any:
    return NOT_BUILT
