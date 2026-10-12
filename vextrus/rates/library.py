"""`rates`'s Library rows, which `sync_library` (02) reads (ticket S16-RT; docs/plans/M1.md C12).

Into each Market's Library: its Resources, its Rate Analyses with their lines, and the starter Market
Price set with a price (or none) for every Resource, from `starter.py`. A Market with no starter data
gets none of these. A row's identity is `(tenant_id, code)` for a Resource, `(tenant_id, item_code)`
for a Rate Analysis, `(tenant_id, effective_date, label)` for a set and `(set, resource)` for a price;
a line's is `(analysis, ordinal)`. A change to the data is written by the next `sync_library`; a
Developer's own copy of the prices is never touched by it.
"""

from collections.abc import Sequence
from datetime import date
from typing import Any

from vextrus.platform.services import markets
from vextrus.platform.services.library import Library
from vextrus.rates import starter
from vextrus.rates.models import (
    MarketPrice,
    MarketPriceSet,
    RateAnalysis,
    RateAnalysisLine,
    Resource,
)


def sync(libraries: Sequence[Library], using: str) -> int:
    """Write the starter rows into each Market's Library through `using` (the owner); the rows
    created or changed (0 when every row is already as written here)."""
    written = 0
    for library in libraries:
        if library.market_code != starter.MARKET_CODE:
            continue
        currency = markets.by_code(library.market_code).currency.code
        resources, wrote = _resources(library, using)
        written += wrote
        written += _price_set(library, using, resources, currency)
        written += _analyses(library, using, resources)
    return written


def _put(
    model: Any, using: str, existing: Any, wanted: dict[str, Any], **identity: Any
) -> tuple[Any, int]:
    """The row of `model` with `identity`, made or brought to `wanted`; and 1 if it was written."""
    if existing is None:
        return model.objects.using(using).create(**identity, **wanted), 1
    if all(getattr(existing, name) == value for name, value in wanted.items()):
        return existing, 0
    for name, value in wanted.items():
        setattr(existing, name, value)
    existing.save(using=using, update_fields=list(wanted))
    return existing, 1


def _resources(library: Library, using: str) -> tuple[dict[str, Resource], int]:
    held = {r.code: r for r in Resource.objects.using(using).filter(tenant_id=library.library_id)}
    made: dict[str, Resource] = {}
    written = 0
    for ordinal, row in enumerate(starter.RESOURCES):
        wanted = {
            "name": row.name,
            "kind": row.kind,
            "quoted_unit": row.unit,
            "schedule_group": row.group,
            "in_material_schedule": row.in_material_schedule,
            "procurement_lead_days": row.lead_days,
            "ordinal": ordinal,
        }
        made[row.code], wrote = _put(
            Resource, using, held.get(row.code), wanted, tenant_id=library.library_id, code=row.code
        )
        written += wrote
    return made, written


def _price_set(library: Library, using: str, resources: dict[str, Resource], currency: str) -> int:
    day = date(*starter.STARTER_DATE)
    existing = MarketPriceSet.objects.using(using).filter(
        tenant_id=library.library_id, effective_date=day, label=starter.STARTER_LABEL
    )
    wanted = {"currency": currency, "source": starter.STARTER_SOURCE, "status": "open"}
    price_set, written = _put(
        MarketPriceSet,
        using,
        existing.first(),
        wanted,
        tenant_id=library.library_id,
        effective_date=day,
        label=starter.STARTER_LABEL,
    )
    held = {p.resource_id: p for p in MarketPrice.objects.using(using).filter(price_set=price_set)}
    for row in starter.RESOURCES:
        resource = resources[row.code]
        _, wrote = _put(
            MarketPrice,
            using,
            held.get(resource.id),
            {"price": row.price, "source_ref": row.source_ref},
            tenant_id=library.library_id,
            price_set=price_set,
            resource=resource,
        )
        written += wrote
    return written


def _analyses(library: Library, using: str, resources: dict[str, Resource]) -> int:
    held = {
        a.item_code: a for a in RateAnalysis.objects.using(using).filter(tenant_id=library.library_id)
    }
    written = 0
    for row in starter.ANALYSES:
        wanted = {
            "per_unit": row.per_unit,
            "mix": row.mix,
            "dry_volume_factor": row.dry_volume_factor,
            "benchmark_ref": row.benchmark_ref,
            "notes": row.notes,
        }
        analysis, wrote = _put(
            RateAnalysis,
            using,
            held.get(row.item_code),
            wanted,
            tenant_id=library.library_id,
            item_code=row.item_code,
        )
        written += wrote
        lines = {
            line.ordinal: line
            for line in RateAnalysisLine.objects.using(using).filter(analysis=analysis)
        }
        for ordinal, line in enumerate(row.lines, start=1):
            _, wrote = _put(
                RateAnalysisLine,
                using,
                lines.pop(ordinal, None),
                {
                    "resource": resources[line.resource],
                    "kind": line.kind,
                    "qty_per_unit": line.qty,
                    "wastage_pct": line.wastage_pct,
                    "source_ref": line.source_ref,
                },
                tenant_id=library.library_id,
                analysis=analysis,
                ordinal=ordinal,
            )
            written += wrote
        for stale in lines.values():
            stale.delete(using=using)
            written += 1
    return written
