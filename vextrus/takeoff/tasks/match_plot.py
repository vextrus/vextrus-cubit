"""The set's Plot matched again after the QS changed a read file's Discipline (S27-G1 fix round 1),
as a job on the `cad` queue: never in the QS's request, whose Discipline locks it would hold for
the minutes a large set's match takes (`read_propose.plot.find`).

    drawings.on_discipline_changed(match_plot.follow_discipline)    # takeoff's `ready`

A PDF of a known Discipline plots only that Discipline's sheets (and those of none), so a DWG whose
Discipline was guessed wrong is matched by its Plot only once the QS corrects it, and a PDF given a
Discipline lets go of the pages it held on another's. `follow_discipline` queues the job in the
change's transaction and the set keeps its id (`drawings.queue_plot`): till it has run, the set's
PDFs with no page matched read "Plot: waiting for its DWG. Its pages are matched when the DWG is
read.", never "0 of N matched". The job's one step is the set-level match a read runs
(`plot.match`), kept from scratch, so a retry or a second change runs it again whole; it lets the
set's waiting go in the same transaction (`drawings.plot_matched_again`).
"""

import uuid

from django.conf import settings

from vextrus.drawings import services as drawings
from vextrus.platform.services import jobs
from vextrus.takeoff.services.read_propose import plot


class _Unkept(jobs.StepStore):
    """No step kept: the match is a function of the set as it stands, run whole on every try."""

    def completed(self, key: jobs.StepKey) -> jobs.StepResult | None:
        return None

    def record(self, key: jobs.StepKey, result: jobs.StepResult) -> None:
        return None

    def progress(self, subject_id: uuid.UUID, progress: jobs.Progress) -> None:
        return None


@jobs.job(queue=settings.VEXTRUS_CAD_QUEUE)
def match_plot(run: jobs.Run, *, file_id: uuid.UUID) -> None:
    """Match the Plot of the file's set again (see the module)."""
    steps = run.steps(_Unkept(), subject_id=file_id, total=1)
    steps.run("plot", lambda: _match(file_id, run.job_id))


def _match(file_id: uuid.UUID, job_id: int | None) -> jobs.StepResult:
    matched = plot.match(file_id)
    drawings.plot_matched_again(drawings.file(file_id).set_id, job_id)
    return matched


def follow_discipline(file_id: uuid.UUID, actor_name: str = "") -> None:
    """After the QS changed a file's Discipline (in the change's transaction): a read DWG or PDF of
    a set with a read PDF has the set's Plot matched again by `match_plot`."""
    view = drawings.file(file_id)
    if view.state != drawings.FileState.READ or view.format not in ("dwg", "pdf"):
        return
    if not any(
        f.format == "pdf" and f.state == drawings.FileState.READ for f in drawings.files(view.set_id)
    ):
        return
    drawings.queue_plot(view.set_id, match_plot.defer(file_id=file_id))
