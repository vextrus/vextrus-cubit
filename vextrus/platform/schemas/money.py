"""Money in the API: `{amount, currency}`, the amount a decimal string (docs/data-model.md §2)."""

from decimal import Decimal

from ninja import Schema
from pydantic import Field

from vextrus.platform.money import Money


class MoneySchema(Schema):
    """An amount and its ISO 4217 code. The amount travels as a string, never a float."""

    amount: Decimal
    currency: str = Field(pattern=r"^[A-Z]{3}$")

    @classmethod
    def from_money(cls, money: Money) -> MoneySchema:
        return cls(amount=money.amount, currency=money.currency.code)
