"""Step 3's storeys and View Placements in the API (docs/plans/M1.md C19; under
`/api/projects/{project_id}/takeoff/`).

Stubs of the contract freeze (M1-00): each route has its contract's request and reply, sits behind
07's guard, and then answers 501 `platform.stubs.not_built`. M1-32a replaces them whole.
"""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.http.stubs import not_built
from vextrus.takeoff import acts
from vextrus.takeoff.schemas.storeys import (
    StoreyLevelIn,
    StoreyRowOut,
    StoreysOut,
    ViewPlacementIn,
    ViewPlacementOut,
)

router = Router()

_PREFIX = "/projects/{project_id}/takeoff"


@router.get(f"{_PREFIX}/storeys", response={200: StoreysOut, 501: Refusal})
@declare(acts.LOOK, project="project_id")
def list_storeys(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    """The storeys and every view's placement."""
    return not_built()


@router.put(f"{_PREFIX}/storeys/{{key}}/level", response={200: StoreyRowOut, 501: Refusal})
@declare(acts.STOREYS, project="project_id")
def type_level(
    request: HttpRequest, project_id: uuid.UUID, key: str, payload: StoreyLevelIn
) -> HttpResponse:
    """A storey's level, typed by the QS (O3)."""
    return not_built()


@router.put(f"{_PREFIX}/view-placements/{{view_id}}", response={200: ViewPlacementOut, 501: Refusal})
@declare(acts.STOREYS, project="project_id")
def place_view(
    request: HttpRequest, project_id: uuid.UUID, view_id: uuid.UUID, payload: ViewPlacementIn
) -> HttpResponse:
    """The storeys a view shows, corrected by the QS."""
    return not_built()
