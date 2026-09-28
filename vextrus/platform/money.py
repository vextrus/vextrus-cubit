"""Money: an exact decimal with its currency, rounded to that currency's minor units (ADR 0038 item 5).

The currency and its minor units come from Market data (`markets.MarketProfile.currency`), never
from code: 2 for the taka, 3 for a 3-decimal currency. Amounts round half up, away from zero, as an
estimate is rounded by hand. A float is refused: nothing that feeds a figure is a float
(docs/data-model.md §2, Types). No M0 table holds money; columns that will are `dec(18,4)`.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class Currency:
    """An ISO 4217 code and its minor units, as a Market row gives them."""

    code: str
    minor_units: int

    def __post_init__(self) -> None:
        if not (len(self.code) == 3 and self.code.isascii() and self.code.isupper()):
            raise ValueError(f"{self.code!r} is not an ISO 4217 code")
        if not 0 <= self.minor_units <= 4:
            raise ValueError(f"{self.code} has {self.minor_units} minor units; money holds 0 to 4")

    @property
    def quantum(self) -> Decimal:
        return Decimal(1).scaleb(-self.minor_units)


class CurrencyMismatch(ValueError):
    pass


@dataclass(frozen=True)
class Money:
    """An amount in a currency, always rounded to its minor units. Make one with `Money.of`."""

    amount: Decimal
    currency: Currency

    def __post_init__(self) -> None:
        if not isinstance(self.amount, Decimal):
            raise TypeError("a Money amount is a Decimal; make one with Money.of")
        if self.amount != self.amount.quantize(self.currency.quantum):
            raise ValueError(f"{self.amount} is not rounded to {self.currency.code}'s minor units")

    @classmethod
    def of(cls, amount: Decimal | int | str, currency: Currency) -> Money:
        """`amount` rounded half up to the currency's minor units. A float is refused."""
        if isinstance(amount, (float, bool)):
            raise TypeError("money is never made from a float or a bool: pass a Decimal or a string")
        exact = Decimal(amount)
        if not exact.is_finite():
            raise ValueError(f"{amount!r} is not an amount")
        return cls(exact.quantize(currency.quantum, rounding=ROUND_HALF_UP), currency)

    @classmethod
    def zero(cls, currency: Currency) -> Money:
        return cls.of(0, currency)

    def __add__(self, other: Money) -> Money:
        return Money.of(self.amount + self._same(other).amount, self.currency)

    def __sub__(self, other: Money) -> Money:
        return Money.of(self.amount - self._same(other).amount, self.currency)

    def __neg__(self) -> Money:
        return Money.of(-self.amount, self.currency)

    def times(self, factor: Decimal | int) -> Money:
        """This amount times an exact factor (a quantity, a share), rounded once, at the end."""
        if isinstance(factor, (float, bool)):
            raise TypeError("money is never multiplied by a float or a bool")
        return Money.of(self.amount * Decimal(factor), self.currency)

    def as_api(self) -> dict[str, str]:
        """`{amount, currency}`: the amount as a decimal string with its minor units, never a float."""
        return {"amount": str(self.amount), "currency": self.currency.code}

    def _same(self, other: Money) -> Money:
        if other.currency.code != self.currency.code:
            raise CurrencyMismatch(f"{self.currency.code} and {other.currency.code} do not add")
        return other
