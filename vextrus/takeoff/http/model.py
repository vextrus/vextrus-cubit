"""The 3D's data in the API (M1.md C17; ticket S16-T2): `GET
/api/projects/{project_id}/takeoff/model/primitives?seq=`, the confirmed Elements at a ModelVersion
and the frame steps' open Proposals' candidate geometry, one row per Element. Every role reads it."""

import uuid
from dataclasses import asdict

from django.http import HttpRequest
from ninja import Router, Schema

from vextrus.platform.http.acts import Refusal, declare
from vextrus.takeoff import acts
from vextrus.takeoff.services import frame_steps

router = Router()


class PrimitiveOut(Schema):
    kind: str
    polygon: list[list[str]]
    z0: str
    z1: str


class ElementPrimitivesOut(Schema):
    element_id: uuid.UUID
    family: str
    storey: str | None
    part: str
    state: str
    primitives: list[PrimitiveOut]


@router.get(
    "/projects/{project_id}/takeoff/model/primitives",
    response={200: list[ElementPrimitivesOut], 409: Refusal},
)
@declare(acts.LOOK, project="project_id")
def list_primitives(
    request: HttpRequest, project_id: uuid.UUID, seq: int | None = None
) -> list[ElementPrimitivesOut]:
    rows = frame_steps.primitives(project_id, seq)
    return [ElementPrimitivesOut.model_validate(asdict(row)) for row in rows]
