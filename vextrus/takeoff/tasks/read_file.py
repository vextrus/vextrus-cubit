"""The read job per file (ticket 21a), on the `cad` queue, and the add that queues it.

    added = read_file.add(project_id, name=upload.name, content=upload, actor_name=user.name)

`add` adds the file through `drawings.services.add_file` and, in the same transaction, defers its
read job and names it the file's (`drawings` may not call `takeoff`, docs/architecture.md): the job is
a row of that transaction, so an add rolled back takes its job with it, and a job that could not be
queued rolls the add back (`takeoff.read_file.not_started`, 503: nothing is kept). A file that already
has its read job (the same contents again) gets no second one; one waiting with none (added before
its job existed) gets its job here.
"""

import logging
import uuid
from typing import Any, BinaryIO

from django.conf import settings
from django.core.files import File
from django.db import DatabaseError, transaction

from vextrus.drawings import services as drawings
from vextrus.platform.services import auth, jobs
from vextrus.takeoff.messages import read_file as said
from vextrus.takeoff.services.read_propose import files

log = logging.getLogger(__name__)


@jobs.job(queue=settings.VEXTRUS_CAD_QUEUE)
def read_file(run: jobs.Run, *, file_id: uuid.UUID) -> None:
    """Read one file, step by step (`read_propose.files`)."""
    files.read(run, file_id)


class _NotQueued(Exception):
    """The read job could not be queued: raised out of the add's transaction, so it rolls back."""


def add(
    project_id: uuid.UUID, *, name: str, content: BinaryIO | File[Any], actor_name: str = ""
) -> drawings.Added:
    """Add the file and queue its read job, in one transaction (see the module)."""
    try:
        with transaction.atomic():
            added = drawings.add_file(project_id, name=name, content=content, actor_name=actor_name)
            view = added.file
            if view.read_job_id is None and view.state == drawings.FileState.WAITING:
                try:
                    job_id = read_file.defer(file_id=view.id)
                except (jobs.JobRefused, jobs.NotInTransaction, DatabaseError) as error:
                    raise _NotQueued from error
                drawings.attach_read_job(view.id, job_id)
                added = drawings.Added(drawings.file(view.id), added.outcome, added.message)
    except _NotQueued as failed:
        log.error("a read job could not be queued; the add was rolled back", exc_info=failed.__cause__)
        raise auth.Refused(said.NOT_STARTED(file=drawings.clean_name(name)), status=503) from None
    return added
