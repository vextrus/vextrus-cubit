"""`seed_demo`: load the invented demo project (docs/design/m0-screens.md §7).

It runs `sync_library` first, as the owner (idempotent: it puts back a Market that is missing, then
every module's Library rows), so `flush` then `seed_demo` works (#95). It refuses, adding nothing,
when the demo's Developers already exist: a second run would make them again (#129)."""

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from vextrus.drawings.services.drawing_files import STEADY
from vextrus.platform.services import library
from vextrus.seed.demo import seed_demo
from vextrus.seed.drawings import PAGE_MINUTES
from vextrus.seed.platform import seeded_developers


class Command(BaseCommand):
    help = "Load the invented demo project for walking the product (docs/design/m0-screens.md §7)."

    def handle(self, *args: Any, **options: Any) -> None:
        if seeded := seeded_developers():
            raise CommandError(
                f"The demo is already seeded ({', '.join(seeded)}). To seed it afresh, run"
                " `uv run manage.py flush` (it empties the whole database), then"
                " `uv run manage.py seed_demo`."
            )
        library.sync()
        made = seed_demo()
        self.stdout.write(f"seeded: {len(made)} named rows")
        self.stdout.write(
            "Run flush then seed_demo just before a walk: the reading PDF shows its time left for"
            f" {STEADY * PAGE_MINUTES} minutes."
        )
