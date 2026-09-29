"""`seed_demo`: load the invented demo project (docs/design/m0-screens.md §7).

It runs `sync_library` first, as the owner (idempotent: the Markets and every module's Library rows),
so `flush` then `seed_demo` works (#95)."""

from typing import Any

from django.core.management.base import BaseCommand

from vextrus.platform.services import library
from vextrus.seed.demo import seed_demo


class Command(BaseCommand):
    help = "Load the invented demo project for walking the product (docs/design/m0-screens.md §7)."

    def handle(self, *args: Any, **options: Any) -> None:
        library.sync()
        made = seed_demo()
        self.stdout.write(f"seeded: {len(made)} named rows")
