"""`ensure_database`: create this worktree's database as the owner, unless it exists."""

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand

from vextrus.platform.database import OWNER_ALIAS, ensure_database


class Command(BaseCommand):
    help = "Create this worktree's database (settings: DATABASES) as the owner, unless it exists."

    def handle(self, *args: Any, **options: Any) -> None:
        name = settings.DATABASES[OWNER_ALIAS]["NAME"]
        made = ensure_database(name)
        self.stdout.write(f"{name}: {'created' if made else 'exists'}")
