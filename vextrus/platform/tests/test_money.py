"""Money: an exact decimal with its currency, rounded to the currency's minor units from Market data,
`{amount, currency}` in the API; tested at 2 and 3 minor units (ADR 0038 item 5)."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from vextrus.platform.money import Currency, CurrencyMismatch, Money
from vextrus.platform.schemas.money import MoneySchema
from vextrus.platform.services.markets import MarketProfile

TWO = Currency("BDT", 2)
THREE = Currency("KWD", 3)  # a test-only 3-decimal currency; no Market holds it


@pytest.mark.parametrize(
    ("amount", "currency", "rounded"),
    [
        ("1234.565", TWO, "1234.57"),
        ("1234.564", TWO, "1234.56"),
        ("-1234.565", TWO, "-1234.57"),
        (Decimal("14707525.5"), TWO, "14707525.50"),
        (7, TWO, "7.00"),
        ("1.2345", THREE, "1.235"),
        ("1.2344", THREE, "1.234"),
        ("0.0005", THREE, "0.001"),
        (7, THREE, "7.000"),
    ],
)
def test_an_amount_rounds_half_up_to_its_currency_s_minor_units(
    amount: Decimal | int | str, currency: Currency, rounded: str
) -> None:
    money = Money.of(amount, currency)

    assert money.amount == Decimal(rounded)
    assert str(money.amount) == rounded


@pytest.mark.django_db
def test_the_currency_and_its_minor_units_come_from_the_market(market: MarketProfile) -> None:
    assert Money.of("10.005", market.currency).as_api() == {
        "amount": "10.01",
        "currency": market.currency.code,
    }


@pytest.mark.parametrize("bad", [1.5, True])
def test_money_is_never_made_or_multiplied_from_a_float(bad: object) -> None:
    with pytest.raises(TypeError):
        Money.of(bad, TWO)  # type: ignore[arg-type]
    with pytest.raises(TypeError):
        Money.of(1, TWO).times(bad)  # type: ignore[arg-type]


def test_arithmetic_keeps_the_currency_and_rounds_once() -> None:
    rate = Money.of("333.33", TWO)

    assert rate.times(Decimal("3")) == Money.of("999.99", TWO)
    assert rate.times(Decimal("0.125")) == Money.of("41.67", TWO)
    assert Money.of("0.10", TWO) + Money.of("0.20", TWO) == Money.of("0.30", TWO)
    assert Money.of("1.000", THREE) - Money.of("0.001", THREE) == Money.of("0.999", THREE)
    assert -Money.of("5", TWO) == Money.of("-5", TWO)
    assert Money.zero(THREE).as_api() == {"amount": "0.000", "currency": "KWD"}


def test_two_currencies_never_add() -> None:
    with pytest.raises(CurrencyMismatch):
        Money.of(1, TWO) + Money.of(1, THREE)


def test_an_unrounded_or_unknown_amount_is_refused() -> None:
    with pytest.raises(ValueError, match="not rounded"):
        Money(Decimal("1.005"), TWO)
    with pytest.raises(ValueError, match="not an amount"):
        Money.of("NaN", TWO)
    with pytest.raises(ValueError, match="ISO 4217"):
        Currency("taka", 2)
    with pytest.raises(ValueError, match="minor units"):
        Currency("XXX", 5)


@pytest.mark.parametrize(("currency", "amount"), [(TWO, "1234.57"), (THREE, "1.235")])
def test_the_api_sends_amount_and_currency_the_amount_as_a_string(
    currency: Currency, amount: str
) -> None:
    schema = MoneySchema.from_money(Money.of("1234.565" if currency is TWO else "1.2345", currency))

    assert schema.model_dump(mode="json") == {"amount": amount, "currency": currency.code}
    assert MoneySchema.model_validate({"amount": amount, "currency": currency.code}).amount == Decimal(
        amount
    )
    with pytest.raises(ValidationError, match="currency"):
        MoneySchema.model_validate({"amount": amount, "currency": "taka"})
