"""Market Prices and Rate Analyses in the API: session 16's stubs (S16-K0), each answering 501 after
07's guard until RT replaces this module (`vextrus/rates/schemas/prices.py`)."""

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router, Status

from vextrus.platform.http.acts import Act, Grant, Refusal, declare
from vextrus.rates.schemas.prices import PriceIn, PriceOut, PricesOut, RateOut

router = Router()

LOOK = Act("rates.look", Grant.LOOK)
"""Read the Market Prices and Rate Analyses: every role."""
PRICE = Act("rates.price", Grant.CHANGE)
"""Edit a Market Price: the QS and the Vextrus Engineer only."""

NOT_BUILT = Status(501, {"code": "platform.not_built", "params": {}})


@router.get("/projects/{project_id}/prices", response={200: PricesOut, 501: Refusal})
@declare(LOOK, project="project_id")
def list_prices(request: HttpRequest, project_id: uuid.UUID) -> Any:
    return NOT_BUILT


@router.put(
    "/projects/{project_id}/prices/{resource_code}",
    response={200: PriceOut, 400: Refusal, 501: Refusal},
)
@declare(PRICE, project="project_id")
def set_price(request: HttpRequest, project_id: uuid.UUID, resource_code: str, payload: PriceIn) -> Any:
    return NOT_BUILT


@router.get("/projects/{project_id}/rates/{item_code}", response={200: RateOut, 501: Refusal})
@declare(LOOK, project="project_id")
def get_rate(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> Any:
    return NOT_BUILT
