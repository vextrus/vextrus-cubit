"""`flush`, always as the owner: flushing truncates, and `vextrus_app` is never granted TRUNCATE,
which bypasses row-level security (docs/data-model.md §2). A test's flush comes here too.

Django's flush empties only managed models' tables, and procrastinate's are not managed, so a job a
transactional test committed (the seed's `cad` read job) outlived the test and reached the next one on
that database: under pytest-xdist the order differs from a serial run's, and a test that counts the
`cad` queue's jobs (t21a's) failed. The job queue is emptied here too, and only after a yes: this
command asks once, and Django's flush then runs without asking again."""

from typing import Any

from django.core.management.commands.flush import Command as DjangoFlush
from django.db import connections

from vextrus.platform.database import OWNER_ALIAS, empty_job_queue

QUESTION = (
    "You have requested a flush of the database {name}: every table, the job queue's too, emptied.\n"
    "Are you sure you want to do this?\n\n    Type 'yes' to continue, or 'no' to cancel: "
)


class Command(DjangoFlush):
    help = "Empty every table, the job queue's too, always through the owner alias (the role vextrus)."

    def handle(self, **options: Any) -> None:
        options["database"] = OWNER_ALIAS
        if options["interactive"]:
            name = connections[OWNER_ALIAS].settings_dict["NAME"]
            if input(QUESTION.format(name=name)) != "yes":
                self.stdout.write("Flush cancelled.")
                return
        super().handle(**{**options, "interactive": False})
        empty_job_queue()
