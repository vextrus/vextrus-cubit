"""The read job per file (ticket 21a), on the `cad` queue, and the add that queues it.

    added = read_file.add(project_id, name=upload.name, content=upload, actor_name=user.name)

`add` adds the file through `drawings.services.add_file` and, in the same transaction, defers its
read job and names it the file's (`drawings` may not call `takeoff`, docs/architecture.md): the job is
a row of that transaction, so an add rolled back takes its job with it, and a job that could not be
queued rolls the add back (`takeoff.read_file.not_started`, 503: nothing is kept). A file that already
has its read job (the same contents again) gets no second one; one waiting with none (added before its
job existed) gets its job here. When the same contents replace Vextrus's missing copy of a file whose
reading had failed, `drawings` starts its job again (09's `restart`, which defers this job): a job that
could not be queued there rolls back too, and the file stays as it was (`not_started_again`, 503).
"""

import logging
import uuid
from collections.abc import Callable
from contextvars import ContextVar
from typing import Any, BinaryIO

from django.conf import settings
from django.core.files import File
from django.db import DatabaseError, transaction

from vextrus.drawings import services as drawings
from vextrus.platform.services import auth, jobs
from vextrus.takeoff.messages import read_file as said
from vextrus.takeoff.services.read_propose import files

log = logging.getLogger(__name__)

_adding: ContextVar[bool] = ContextVar("vextrus_takeoff_adding", default=False)


class _NotQueued(Exception):
    """The read job could not be queued inside `add`: raised out of the add's transaction, so it
    rolls back."""


class _ReadJob(jobs.Job):
    """09's Job, whose deferral inside `add` (its own, or `drawings`' restart of it) that cannot be
    queued rolls the whole add back with the file's words, never a server error."""

    def defer(self, **ids: uuid.UUID) -> jobs.JobId:
        try:
            return super().defer(**ids)
        except (jobs.JobRefused, jobs.NotInTransaction, DatabaseError) as error:
            if not _adding.get():
                raise
            raise _NotQueued from error


def _read_job(fn: Callable[..., None]) -> _ReadJob:
    return _ReadJob(fn, queue=settings.VEXTRUS_CAD_QUEUE)


@_read_job
def read_file(run: jobs.Run, *, file_id: uuid.UUID) -> None:
    """Read one file, step by step (`read_propose.files`)."""
    files.read(run, file_id)


def add(
    project_id: uuid.UUID, *, name: str, content: BinaryIO | File[Any], actor_name: str = ""
) -> drawings.Added:
    """Add the file and queue its read job, in one transaction (see the module)."""
    token = _adding.set(True)
    new = False  # a deferral inside `add_file` is its restart of a file already here
    try:
        with transaction.atomic():
            added = drawings.add_file(project_id, name=name, content=content, actor_name=actor_name)
            new = added.outcome == "added"
            view = added.file
            if view.read_job_id is None and view.state == drawings.FileState.WAITING:
                job_id = read_file.defer(file_id=view.id)
                drawings.attach_read_job(view.id, job_id)
                added = drawings.Added(drawings.file(view.id), added.outcome, added.message)
    except _NotQueued as failed:
        log.error("a read job could not be queued; the add was rolled back", exc_info=failed.__cause__)
        # A new file was not added at all; one already here stays as it was, unread.
        words = said.NOT_STARTED if new else said.NOT_STARTED_AGAIN
        raise auth.Refused(words(file=drawings.clean_name(name)), status=503) from None
    finally:
        _adding.reset(token)
    return added
