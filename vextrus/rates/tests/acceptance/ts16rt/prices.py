"""S16-RT's shared words: the contract's starter set, items and paths (session 16's contracts, rates;
docs/plans/M1.md C12)."""

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

STARTER_SET = "PWD SoR 2022 2nd Rev (Dhaka)"
"""The starter MarketPriceSet's name (contracts, rates: 'starter MarketPriceSet "PWD SoR 2022 2nd Rev
(Dhaka)"')."""

ITEMS = ("RCC-COL-1:1.5:3", "FW-COL", "REBAR-500W")
"""The column items the subset prices (the brief: working_rate for RCC-COL-1:1.5:3, FW-COL and
REBAR-500W)."""


def prices_path(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/prices"


def price_path(project_id: uuid.UUID, resource_code: str) -> str:
    return f"/api/projects/{project_id}/prices/{resource_code}"


def rate_path(project_id: uuid.UUID, item_code: str) -> str:
    return f"/api/projects/{project_id}/rates/{item_code}"


def money(value: Any) -> Decimal:
    """A Money's amount (`{amount, currency}`, the amount a decimal string), or a failed test."""
    assert isinstance(value, dict), f"not a Money: {value!r}"
    assert set(value) >= {"amount", "currency"}, f"not a Money: {value!r}"
    assert isinstance(value["currency"], str), f"no currency: {value!r}"
    assert value["currency"], f"no currency: {value!r}"
    try:
        return Decimal(str(value["amount"]))
    except InvalidOperation:
        raise AssertionError(f"not a decimal amount: {value!r}") from None


def got(response: Any, status: int = 200) -> Any:
    assert response.status_code == status, (response.status_code, response.content[:400])
    return response.json()


def cites_a_page(source_ref: Any) -> bool:
    """A page reference: a non-empty text that names a page number."""
    return (
        isinstance(source_ref, str) and source_ref.strip() != "" and any(c.isdigit() for c in source_ref)
    )
