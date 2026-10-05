"""`flush`, always as the owner: flushing truncates, and `vextrus_app` is never granted TRUNCATE,
which bypasses row-level security (docs/data-model.md §2). A test's flush comes here too.

Django's flush empties only managed models' tables, and procrastinate's are not managed, so a job a
transactional test committed (the seed's `cad` read job) outlived the test and reached the next one on
that database: under pytest-xdist the order differs from a serial run's, and a test that counts the
`cad` queue's jobs (t21a's) failed. The job queue is emptied here too."""

from typing import Any

from django.core.management.commands.flush import Command as DjangoFlush
from django.db import connections

from vextrus.platform.database import OWNER_ALIAS

JOB_TABLES = ("procrastinate_jobs", "procrastinate_workers")  # their events and defers cascade


class Command(DjangoFlush):
    help = "Empty every table, the job queue's too, always through the owner alias (the role vextrus)."

    def handle(self, **options: Any) -> None:
        options["database"] = OWNER_ALIAS
        super().handle(**options)
        with connections[OWNER_ALIAS].cursor() as cursor:
            cursor.execute("select to_regclass(%s) is not null", [JOB_TABLES[0]])
            row = cursor.fetchone()
            if row is not None and row[0]:
                cursor.execute(f"truncate {', '.join(JOB_TABLES)} cascade")
