"""The frame Steps (3 storeys, 4 grid, 6 columns) in the API: session 16's stubs (S16-K0), each
answering 501 after 07's guard, until T2 replaces this module with the contract's replies
(`vextrus/takeoff/schemas/frame.py`)."""

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router, Status

from vextrus.platform.http.acts import Refusal, declare
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.frame import (
    FrameConfirmationIn,
    FrameConfirmationOut,
    FrameProposalsOut,
    FrameReadOut,
    FrameStepsOut,
    StoreyLevelsIn,
    StoreysOut,
    ViewPlacementIn,
)

router = Router()

_PREFIX = "/projects/{project_id}/takeoff"

NOT_BUILT = Status(501, {"code": "platform.not_built", "params": {}})
"""The stub's answer: the route is in the contract, its service is not built yet."""


@router.get(f"{_PREFIX}/steps", response={200: FrameStepsOut, 501: Refusal})
@declare(acts.LOOK, project="project_id")
def list_steps(request: HttpRequest, project_id: uuid.UUID) -> Any:
    return NOT_BUILT


@router.post(f"{_PREFIX}/steps/{{step}}/read", response={202: FrameReadOut, 400: Refusal, 501: Refusal})
@declare(acts.CONFIRM, project="project_id")
def read_step(request: HttpRequest, project_id: uuid.UUID, step: str) -> Any:
    return NOT_BUILT


@router.get(
    f"{_PREFIX}/steps/{{step}}/proposals", response={200: FrameProposalsOut, 400: Refusal, 501: Refusal}
)
@declare(acts.LOOK, project="project_id")
def list_step_proposals(
    request: HttpRequest, project_id: uuid.UUID, step: str, group: str = "band"
) -> Any:
    return NOT_BUILT


@router.get(f"{_PREFIX}/storeys", response={200: StoreysOut, 501: Refusal})
@declare(acts.LOOK, project="project_id")
def list_storeys(request: HttpRequest, project_id: uuid.UUID) -> Any:
    return NOT_BUILT


@router.put(f"{_PREFIX}/storeys/levels", response={200: StoreysOut, 400: Refusal, 501: Refusal})
@declare(acts.CONFIRM, project="project_id")
def set_storey_levels(request: HttpRequest, project_id: uuid.UUID, payload: StoreyLevelsIn) -> Any:
    return NOT_BUILT


@router.put(
    f"{_PREFIX}/view-placements/{{view_id}}", response={200: StoreysOut, 400: Refusal, 501: Refusal}
)
@declare(acts.CONFIRM, project="project_id")
def place_view(
    request: HttpRequest, project_id: uuid.UUID, view_id: uuid.UUID, payload: ViewPlacementIn
) -> Any:
    return NOT_BUILT


@router.post(
    f"{_PREFIX}/confirmations",
    response={200: FrameConfirmationOut, 400: Refusal, 409: Refusal, 501: Refusal},
)
@declare(acts.CONFIRM, project="project_id")
def confirm(request: HttpRequest, project_id: uuid.UUID, payload: FrameConfirmationIn) -> Any:
    return NOT_BUILT
