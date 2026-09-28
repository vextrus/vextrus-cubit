"""`worker`: run a job worker in this process, as `vextrus_app` (ticket 09).

    uv run manage.py worker               # the default queue, where the stalled-job retrier runs
    uv run manage.py worker --queue cad   # the CAD queue: one job at a time, under its memory cap

It refuses to start unless 02's startup check passes (connected as `vextrus_app`, which row-level
security binds). Stop it with Ctrl-C or SIGTERM: a running job finishes its step and is tried again.
"""

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from vextrus.platform.services import jobs
from vextrus.platform.startup import StartupRefused


class Command(BaseCommand):
    help = "Run a job worker on the named queues (the default queue if none)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--queue",
            action="append",
            dest="queues",
            help="A queue to run (repeatable). The cad queue runs alone.",
        )
        parser.add_argument("--concurrency", type=int, help="Jobs at once (the cad queue: 1).")
        parser.add_argument(
            "--no-wait", action="store_true", help="Stop once no job is left (for checks)."
        )

    def handle(self, *args: Any, **options: Any) -> None:
        queues = options["queues"] or [settings.VEXTRUS_DEFAULT_QUEUE]
        try:
            jobs.run_worker(queues, concurrency=options["concurrency"], wait=not options["no_wait"])
        except (StartupRefused, jobs.WorkerRefused) as refused:
            raise CommandError(str(refused)) from refused
