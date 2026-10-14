"""A Building's Gross Floor Area and the Project's Display Units in the API (docs/plans/M1.md C15;
under `/api/projects/{project_id}/`).

Stubs of the contract freeze (M1-00): each route has its contract's request and reply, sits behind
07's guard, and then answers 501 `platform.stubs.not_built`. M1-44 replaces them whole.
"""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.http.stubs import not_built
from vextrus.projects import acts
from vextrus.projects.schemas.settings import (
    BuildingAreaOut,
    DisplayUnitsIn,
    DisplayUnitsOut,
    GrossFloorAreaIn,
)

router = Router()

_PREFIX = "/projects/{project_id}"


@router.put(
    f"{_PREFIX}/buildings/{{building_id}}/gross-floor-area",
    response={200: BuildingAreaOut, 501: Refusal},
)
@declare(acts.SET_UP, project="project_id")
def set_gross_floor_area(
    request: HttpRequest, project_id: uuid.UUID, building_id: uuid.UUID, payload: GrossFloorAreaIn
) -> HttpResponse:
    """Set a Building's Gross Floor Area."""
    return not_built()


@router.put(f"{_PREFIX}/display-units", response={200: DisplayUnitsOut, 501: Refusal})
@declare(acts.SET_UP, project="project_id")
def set_display_units(
    request: HttpRequest, project_id: uuid.UUID, payload: DisplayUnitsIn
) -> HttpResponse:
    """Set the Project's Display Units."""
    return not_built()
