"""`migrate`, always as the owner: the app's role cannot create or alter a table, and a migration
recorded through it without running would leave the schema behind (vextrus.platform.database)."""

from typing import Any

from django.core.management.commands.migrate import Command as DjangoMigrate

from vextrus.platform.database import OWNER_ALIAS


class Command(DjangoMigrate):
    help = "Apply migrations, always through the owner alias (the role vextrus)."

    def handle(self, *args: Any, **options: Any) -> None:
        options["database"] = OWNER_ALIAS
        super().handle(*args, **options)
