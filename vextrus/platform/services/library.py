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
"""

import uuid
from dataclasses import dataclass
from importlib import import_module

from django.db import transaction

from vextrus.modules import MODULES
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import Market


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
        found = libraries(using)
        for module in MODULES:
            sync_module = getattr(import_module(f"vextrus.{module}.library"), "sync", None)
            if sync_module is not None:
                written[module] = sync_module(found, using)
    return written
