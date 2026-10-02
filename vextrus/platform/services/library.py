"""The Library contract's command, `sync_library` (docs/data-model.md §2, the Library rule; the M0
plan, "The Library").

Every Library row but the Markets (a data migration) comes from code: each module's `library.py`
may define

    def sync(libraries: Sequence[Library], using: str) -> int

which writes that module's rows into each Market's Library, idempotently (a row's identity is
`(tenant_id, key)`: update it where it exists, else create it), through the database alias
`using`, and returns how many rows it wrote. `sync_library` calls every module's in layer order,
in one transaction, as the owner (row-level security keeps every tenant, the app included, from
writing a Library row). It runs at deploy and in the tests' setup. No data migration reads it.

It first puts back a Market that is missing, as its data migration writes it, so `flush` then
`sync_library` (and so `seed_demo`, which runs it first) works (#95). A Market that is there is left
as it is and not locked: its migration, not this command, changes it, and a write here would hold its
row until the owner's transaction ends, stalling every app transaction that names the Market.
"""

import uuid
from dataclasses import dataclass
from importlib import import_module

from django.apps import apps
from django.db import transaction

from vextrus.modules import MODULES
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import Developer, Market

MARKET_MIGRATIONS = ("vextrus.platform.migrations.0004_bangladesh_market",)
"""The data migrations that write the Markets, each with its `MARKET_ID` and its
`seed(Market, Developer, using)`."""
DATE_ORDER_MIGRATION = "vextrus.platform.migrations.0009_market_date_order"
"""The data migration that writes each Market's date order, with its `seed(Market, using)`: added
to the Market after 0004, so put back after it."""


@dataclass(frozen=True)
class Library:
    """A Market's Library: the tenant its rows are written under."""

    market_id: uuid.UUID
    market_code: str
    library_id: uuid.UUID


def libraries(using: str = OWNER_ALIAS) -> list[Library]:
    return [
        Library(market_id, code, library_id)
        for market_id, code, library_id in Market.objects.using(using)
        .order_by("code")
        .values_list("id", "code", "tenant_id")
    ]


def sync(using: str = OWNER_ALIAS) -> dict[str, int]:
    """Run every module's `library.sync`; the rows each wrote, by module."""
    written: dict[str, int] = {}
    with transaction.atomic(using=using):
        for name in MARKET_MIGRATIONS:
            migration = import_module(name)
            if not Market.objects.using(using).filter(id=migration.MARKET_ID).exists():
                migration.seed(Market, Developer, using)
        import_module(DATE_ORDER_MIGRATION).seed(Market, using)
        found = libraries(using)
        for module in MODULES:
            if not apps.is_installed(f"vextrus.{module}"):
                continue  # the job's settings install four modules alone (vextrus.settings.job)
            sync_module = getattr(import_module(f"vextrus.{module}.library"), "sync", None)
            if sync_module is not None:
                written[module] = sync_module(found, using)
    return written
