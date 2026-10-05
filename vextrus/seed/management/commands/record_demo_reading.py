"""`record_demo_reading`: draw KR-01's synthetic DWGs, write them with the repo's writer and read them
with the engine's two readers, keeping both in `vextrus/seed/recorded/` (`vextrus.seed.kr01.record`).
Needs the toolchain; the seed replays the recording with none. Run it again after changing the drawing
(`vextrus/seed/kr01.py`) or a reader, then commit `vextrus/seed/recorded/`."""

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from vextrus.seed import kr01


class Command(BaseCommand):
    help = "Record KR-01's synthetic DWGs and the engine's readings of them, for the demo seed."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("work", type=Path, help="A folder for the writer's and dumper's builds.")

    def handle(self, *args: Any, **options: Any) -> None:
        work: Path = options["work"]
        work.mkdir(parents=True, exist_ok=True)
        for line in kr01.record(work):
            self.stdout.write(line)
