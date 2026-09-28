"""`sync_library`: write every module's Library rows into each Market's Library, as the owner."""

from typing import Any

from django.core.management.base import BaseCommand

from vextrus.platform.services import library


class Command(BaseCommand):
    help = "Write every module's Library rows (their library.py) into each Market's Library."

    def handle(self, *args: Any, **options: Any) -> None:
        written = library.sync()
        total = sum(written.values())
        self.stdout.write(f"sync_library: {total} rows from {len(written)} module(s)")
