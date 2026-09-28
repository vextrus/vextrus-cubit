"""`flush`, always as the owner: flushing truncates, and `vextrus_app` is never granted TRUNCATE,
which bypasses row-level security (docs/data-model.md §2). A test's flush comes here too."""

from typing import Any

from django.core.management.commands.flush import Command as DjangoFlush

from vextrus.platform.database import OWNER_ALIAS


class Command(DjangoFlush):
    help = "Empty every table, always through the owner alias (the role vextrus)."

    def handle(self, **options: Any) -> None:
        options["database"] = OWNER_ALIAS
        super().handle(**options)
