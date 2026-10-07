"""A Building's settings in the API (S16-B; M1.md C15): its Gross Floor Area.

`PUT /api/projects/{project_id}/buildings/{building_id}/gross-floor-area {value, unit}`, unit "sft" or
"m2". The guard answers first (signed out 401; a Project outside the Membership's scope 404; the MD or
a Guest 403); a Building not of the path's Project is the same 404; a value that is not a positive
area, or another unit, is 400 `projects.gfa.not_an_area`, never Ninja's 422 (the body is read loosely
and checked by the service).
"""

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router, Schema

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services.auth import Act, Grant
from vextrus.projects.services import gfa

router = Router()

ENTER_GFA = Act("projects.gross_floor_area", Grant.CHANGE)
"""Enter or change a Building's Gross Floor Area: the QS and the Vextrus Engineer."""


class GrossFloorAreaIn(Schema):
    """Read loosely, so a wrong type is the service's 400, not Ninja's 422: `value` a decimal string
    (or a number), `unit` "sft" or "m2"."""

    value: Any = None
    unit: Any = None


class GrossFloorAreaOut(Schema):
    building_id: uuid.UUID
    value: str
    """The stored area in m2, to four places."""
    unit: str
    basis: str


@router.put(
    "/projects/{project_id}/buildings/{building_id}/gross-floor-area",
    response={200: GrossFloorAreaOut, 400: Refusal},
)
@declare(ENTER_GFA, project="project_id")
def put_gross_floor_area(
    request: HttpRequest, project_id: uuid.UUID, building_id: uuid.UUID, payload: GrossFloorAreaIn
) -> GrossFloorAreaOut:
    entered = gfa.set_gross_floor_area(
        building_id,
        payload.value if isinstance(payload.value, str | int) else "",
        payload.unit if isinstance(payload.unit, str) else "",
        project_id=project_id,
    )
    return GrossFloorAreaOut(
        building_id=entered.building_id, value=str(entered.m2), unit="m2", basis="entered"
    )
