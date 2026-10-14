"""Market Prices and Rate Analyses in the API (docs/plans/M1.md C12; under
`/api/projects/{project_id}/`).

Stubs of the contract freeze (M1-00): each route has its contract's request and reply, sits behind
07's guard, and then answers 501 `platform.stubs.not_built`. M1-14 replaces them whole (a refuter on
the write's tenant wall).
"""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.http.stubs import not_built
from vextrus.rates import acts
from vextrus.rates.schemas.prices import PriceIn, PriceRowOut, RateOut

router = Router()

_PREFIX = "/projects/{project_id}"


@router.get(f"{_PREFIX}/prices", response={200: list[PriceRowOut], 501: Refusal})
@declare(acts.LOOK, project="project_id")
def list_prices(request: HttpRequest, project_id: uuid.UUID) -> HttpResponse:
    """The Project's Market Prices."""
    return not_built()


@router.put(f"{_PREFIX}/prices/{{resource_code}}", response={200: PriceRowOut, 501: Refusal})
@declare(acts.EDIT, project="project_id")
def set_price(
    request: HttpRequest, project_id: uuid.UUID, resource_code: str, payload: PriceIn
) -> HttpResponse:
    """Enter or change one Market Price; the row as it now stands."""
    return not_built()


@router.get(f"{_PREFIX}/rates/{{item_code}}", response={200: RateOut, 501: Refusal})
@declare(acts.LOOK, project="project_id")
def get_rate(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> HttpResponse:
    """A BOQ Item's Rate Analysis."""
    return not_built()
