"""The Developer's Market Prices (ticket S16-RT; docs/plans/M1.md C12).

A Developer prices from its own Market Price set, a copy of the Market Library's starter set: made when
the Developer is made (`rates.apps`' signal) or, for one made before, at first use. An edit changes the
Developer's own price only, writes one DomainEvent under the editor's name, and is read by the next
`working_rate`. A price is empty ("rate not entered") or a non-negative amount in the set's currency,
never a silent zero.
"""

import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from vextrus.platform.money import Currency, Money
from vextrus.platform.services import auth, events, markets, tenancy
from vextrus.projects import services as projects
from vextrus.rates import acts, starter
from vextrus.rates.messages import prices as said
from vextrus.rates.models import MarketPrice, MarketPriceSet

_PLAIN = re.compile(r"(?P<whole>[0-9]{1,10})(?:\.(?P<places>[0-9]+))?")
r"""ASCII digits only: `\d` also matches other scripts' digits, which `Decimal` would read."""


@dataclass(frozen=True)
class PriceSetView:
    id: uuid.UUID
    name: str
    currency: str


@dataclass(frozen=True)
class PriceView:
    resource_code: str
    name: str
    unit: str
    price: Money | None
    """None: the rate is not entered."""
    source_ref: str
    changed_at: datetime


@dataclass(frozen=True)
class Prices:
    price_set: PriceSetView
    prices: tuple[PriceView, ...]


def require_project(act: auth.Act, project_id: uuid.UUID) -> None:
    """The act is the acting member's to do in a Project they can read: one of another Developer, or
    none at all, is the one 404 (`platform.auth.not_found`), as for Step 1."""
    auth.require(act, project_id)
    projects.get(project_id)


def own_currency() -> Currency:
    """The acting Developer's currency, with the minor units its Market gives it."""
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        raise auth.NotFound
    return markets.of_developer(tenant_id).currency


def own_set() -> MarketPriceSet:
    """The acting Developer's Market Price set: made from the Library's starter if it has none."""
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        raise auth.NotFound
    held = MarketPriceSet.objects.filter(tenant_id=tenant_id).order_by("-effective_date").first()
    if held is not None:
        return held
    made = copy_starter()
    if made is None:
        raise auth.Refused(said.PRICE_SET_MISSING(), status=404)
    return made


def copy_starter() -> MarketPriceSet | None:
    """Give the acting Developer its own copy of its Market's starter set (idempotent: the set it
    already has is returned), or None when the Library holds no starter yet (`sync_library` not run)."""
    tenant_id = tenancy.current_tenant_id()
    library_id = tenancy.current().library_id
    if tenant_id is None or library_id is None:
        return None
    starting = MarketPriceSet.objects.filter(tenant_id=library_id, label=starter.STARTER_LABEL).first()
    if starting is None:
        return None
    with transaction.atomic():
        made, created = MarketPriceSet.objects.get_or_create(
            tenant_id=tenant_id,
            effective_date=starting.effective_date,
            label=starting.label,
            defaults={
                "currency": starting.currency,
                "source": starting.source,
                "status": starting.status,
                "parent_set": starting,
            },
        )
        if created:
            now = timezone.now()
            MarketPrice.objects.bulk_create(
                MarketPrice(
                    tenant_id=tenant_id,
                    price_set=made,
                    resource_id=price.resource_id,
                    price=price.price,
                    source_ref=price.source_ref,
                    changed_at=now,
                )
                for price in MarketPrice.objects.filter(price_set=starting)
            )
    return made


def prices(project_id: uuid.UUID) -> Prices:
    """The Developer's Market Prices, in the Library's order; an empty price is `None`."""
    require_project(acts.LOOK, project_id)
    currency = own_currency()
    price_set = own_set()
    rows = (
        MarketPrice.objects.filter(price_set=price_set)
        .select_related("resource")
        .order_by("resource__ordinal")
    )
    return Prices(
        PriceSetView(price_set.id, price_set.label, price_set.currency),
        tuple(
            PriceView(
                resource_code=row.resource.code,
                name=row.resource.name,
                unit=row.resource.quoted_unit,
                price=None if row.price is None else Money.of(row.price, currency),
                source_ref=row.source_ref,
                changed_at=row.changed_at,
            )
            for row in rows
        ),
    )


def parse_amount(text: object, currency: Currency) -> Decimal:
    """A price as typed: a plain non-negative decimal with no more places than the currency's minor
    units; anything else is refused (400) and nothing changes."""
    typed = text.strip(" \t") if isinstance(text, str) else ""
    found = _PLAIN.fullmatch(typed)
    if found is None or len(found["places"] or "") > currency.minor_units:
        raise auth.Refused(said.AMOUNT_INVALID(), status=400)
    return Decimal(typed)


def set_price(project_id: uuid.UUID, resource_code: str, amount: object) -> PriceView:
    """Set the price of one Resource in the Developer's set, and write the event naming the editor.
    The Resource is named by its code; the amount is refused unless `parse_amount` takes it."""
    require_project(acts.EDIT_PRICE, project_id)
    currency = own_currency()
    value = parse_amount(amount, currency)
    with transaction.atomic():
        price_set = own_set()
        row = (
            MarketPrice.objects.select_for_update(of=("self",))
            .select_related("resource")
            .filter(price_set=price_set, resource__code=resource_code)
            .first()
        )
        if row is None:
            raise auth.Refused(said.RESOURCE_UNKNOWN(code=resource_code), status=404)
        editor = tenancy.current().user_id
        now = timezone.now()
        row.price = value
        row.changed_at = now
        row.changed_by_user_id = editor
        row.save(update_fields=["price", "changed_at", "changed_by_user_id"])
        events.record(
            said.PRICE_CHANGED,
            subject_type="market_price",
            subject_id=row.id,
            actor_user_id=editor,
            project_id=project_id,
            payload={"price_set": price_set.id, "resource": row.resource_id},
            occurred_at=now,
        )
    return PriceView(
        resource_code=row.resource.code,
        name=row.resource.name,
        unit=row.resource.quoted_unit,
        price=Money.of(value, currency),
        source_ref=row.source_ref,
        changed_at=now,
    )
