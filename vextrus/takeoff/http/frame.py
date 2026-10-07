"""The frame steps in the API (Steps 3, 4 and 6; the session-16 contract): a stub answering 501 to
every operation, the guard first (07's: 401, 403, 404). T2 replaces this module."""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.frame import (
    FrameConfirmationIn,
    FrameConfirmationOut,
    FrameProposalsOut,
    FrameStepsOut,
    ReadStartedOut,
    StoreyLevelsIn,
    StoreysOut,
    ViewPlacementIn,
)

router = Router()

_PREFIX = "/projects/{project_id}/takeoff"


def not_built() -> HttpResponse:
    return HttpResponse(status=501)


@router.get(f"{_PREFIX}/steps", response={200: FrameStepsOut})
@declare(acts.LOOK, project="project_id")
def list_steps(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    return not_built()


@router.post(f"{_PREFIX}/steps/{{step}}/read", response={202: ReadStartedOut, 400: Refusal})
@declare(acts.CONFIRM, project="project_id")
def read_step(request: HttpRequest, project_id: uuid.UUID, step: str) -> HttpResponse:
    return not_built()


@router.get(f"{_PREFIX}/steps/{{step}}/proposals", response={200: FrameProposalsOut, 400: Refusal})
@declare(acts.LOOK, project="project_id")
def list_step_proposals(
    request: HttpRequest, project_id: uuid.UUID, step: str, group: str = "band"
) -> HttpResponse:
    return not_built()


@router.get(f"{_PREFIX}/storeys", response={200: StoreysOut})
@declare(acts.LOOK, project="project_id")
def list_storeys(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    return not_built()


@router.put(f"{_PREFIX}/storeys/levels", response={200: StoreysOut, 400: Refusal})
@declare(acts.CONFIRM, project="project_id")
def set_levels(request: HttpRequest, project_id: uuid.UUID, payload: StoreyLevelsIn) -> HttpResponse:
    return not_built()


@router.put(f"{_PREFIX}/view-placements/{{view_id}}", response={200: StoreysOut, 400: Refusal})
@declare(acts.ASSIGN, project="project_id")
def place_view(
    request: HttpRequest, project_id: uuid.UUID, view_id: uuid.UUID, payload: ViewPlacementIn
) -> HttpResponse:
    return not_built()


@router.post(
    f"{_PREFIX}/confirmations", response={200: FrameConfirmationOut, 400: Refusal, 409: Refusal}
)
@declare(acts.CONFIRM, project="project_id")
def confirm(request: HttpRequest, project_id: uuid.UUID, payload: FrameConfirmationIn) -> HttpResponse:
    return not_built()
