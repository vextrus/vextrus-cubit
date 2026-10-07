"""The Market Prices and Rate Analyses in the API (ticket S16-RT; session 16's contract, rates; C12;
`/api/projects/{project_id}/...` like `vextrus/takeoff/http/step1.py`).

Every operation declares its act through 07's guard, which answers first: signed out 401; a Project
outside the Membership's scope 404, before the role; the MD or a Guest changing a price 403. Every
role reads. Money is `{amount, currency}`, the amount a decimal string; an empty price is `null`
("rate not entered"). A price that is not a plain non-negative decimal is `400 {code, params}`, not
Ninja's 422: the body is read as text and judged by the service.
"""

import uuid

from django.http import HttpRequest
from ninja import Router

from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.money import Money
from vextrus.platform.schemas.money import MoneySchema
from vextrus.rates import acts, services
from vextrus.rates.schemas.prices import (
    PriceIn,
    PriceOut,
    PriceSetOut,
    PricesOut,
    RateLineOut,
    RateOut,
)

router = Router()


def money(value: Money | None) -> MoneySchema | None:
    return None if value is None else MoneySchema.from_money(value)


def price_out(view: services.PriceView) -> PriceOut:
    return PriceOut(
        resource_code=view.resource_code,
        name=view.name,
        unit=view.unit,
        price=money(view.price),
        source_ref=view.source_ref,
        changed_at=view.changed_at,
    )


@router.get("/projects/{project_id}/prices", response={200: PricesOut, 404: Refusal})
@declare(acts.LOOK, project="project_id")
def list_prices(request: HttpRequest, project_id: uuid.UUID) -> PricesOut:
    """The Developer's Market Prices, in the Library's order; a price not entered is `null`."""
    found = services.prices(project_id)
    return PricesOut(
        price_set=PriceSetOut(
            id=found.price_set.id, name=found.price_set.name, currency=found.price_set.currency
        ),
        prices=[price_out(view) for view in found.prices],
    )


@router.put(
    "/projects/{project_id}/prices/{resource_code}",
    response={200: PriceOut, 400: Refusal, 404: Refusal},
)
@declare(acts.EDIT_PRICE, project="project_id")
def edit_price(
    request: HttpRequest, project_id: uuid.UUID, resource_code: str, payload: PriceIn
) -> PriceOut:
    """Set a price: one DomainEvent under the editor's name. A bad amount is 400, the price unchanged."""
    return price_out(services.set_price(project_id, resource_code, payload.amount))


@router.get("/projects/{project_id}/rates/{item_code}", response={200: RateOut, 404: Refusal})
@declare(acts.LOOK, project="project_id")
def get_rate(request: HttpRequest, project_id: uuid.UUID, item_code: str) -> RateOut:
    """A Rate Analysis line by line at the Developer's prices; `rate` is `null` while any price is
    not entered."""
    view = services.rate_analysis(project_id, item_code)
    return RateOut(
        item_code=view.item_code,
        per_unit=view.per_unit,
        rate=money(view.rate),
        lines=[
            RateLineOut(
                resource_code=line.resource_code,
                name=line.name,
                qty=line.qty,
                unit=line.unit,
                price=money(line.price),
                amount=money(line.amount),
                source_ref=line.source_ref,
            )
            for line in view.lines
        ],
    )
