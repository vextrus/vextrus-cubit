"""Prices and rates in the API (C12; the session-16 contract): a stub answering 501, the guard first.
RT replaces this module."""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services.auth import Act, Grant
from vextrus.rates.schemas.prices import PriceIn, PriceOut, PricesOut, RateOut

router = Router()

LOOK = Act("rates.look", Grant.LOOK)
"""Read the Project's prices and rates: every role."""
EDIT_PRICE = Act("rates.edit_price", Grant.CHANGE)
"""Change one price: the QS and the Vextrus Engineer."""


@router.get("/projects/{project_id}/prices", response={200: PricesOut})
@declare(LOOK, project="project_id")
def list_prices(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    return HttpResponse(status=501)


@router.put(
    "/projects/{project_id}/prices/{resource_code}",
    response={200: PriceOut, 400: Refusal, 404: Refusal},
)
@declare(EDIT_PRICE, project="project_id")
def set_price(
    request: HttpRequest, project_id: uuid.UUID, resource_code: str, payload: PriceIn
) -> HttpResponse:
    return HttpResponse(status=501)


@router.get("/projects/{project_id}/rates/{item_code}", response={200: RateOut, 404: Refusal})
@declare(LOOK, project="project_id")
def get_rate(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> HttpResponse:
    return HttpResponse(status=501)
