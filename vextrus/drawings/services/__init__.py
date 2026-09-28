"""`drawings`'s public services: other modules call only these and `schemas`.

Each ticket writes its own submodule (`services/<name>.py`); this file re-exports them, and a
re-export line is the only shared edit. Every service acts in the acting tenant (row-level security)
and checks the acting Membership's Project scope itself, a job step's included; what it does not find
there is `auth.NotFound`, one answer. Its refusals are `auth.Refused` with a `drawings.*` code.

For 21a (the upload operation and the read job, in `takeoff`):

    added = services.add_file(project_id, name=upload.name, content=upload, actor_name=user.name)
    job_id = read_file.defer(file_id=added.file.id)      # in the same transaction
    services.attach_read_job(added.file.id, job_id)
    # the job:
    steps = run.steps(services.step_store(), subject_id=file_id, total=…)
    with services.original(file_id) as path: …           # the upload, checked, as a private copy
    services.store_artefact(file_id, artefact)           # a ReadArtefact, as JSON, per reader version
    services.record_reports(file_id, cross_check=…, font_report=…, bangla_ansi=…)  # or upload_report=
    services.quarantine(file_id, finding)                # held (the two readers disagree)
    services.mark_failed(file_id, finding, tries=attempt)  # or failed: why, after how many tries
    services.mark_read(file_id)                          # in the last step's transaction
    # step names these words know: services.OPENING, READING, SECOND_READER, SHEETS,
    # sheet_step(n), FINISHING; a PDF's OPENING, page_step(n), MATCHING

For 21b (sheets, views, render and Plot):

    services.conventions(file_id)                        # the Market's Disciplines, key and prefixes
    [sr] = services.record_sheets(file_id, candidates)   # each candidate.group == file(file_id).group
    # sr.ordinal: its candidate's place in candidates (from 1); a sheet or view whose text is past
    # its column is not kept, alone, and the file's report counts it (views likewise, per sheet)
    services.record_views(sr.id, view_candidates)
    services.record_render(sr.id, buffers)
    services.record_plot(sr.id, plot_match)              # or services.PlotNone.NO_PDF, …
    services.record_kind(sr.id, "beam_layout")           # the kind as read (a key)
    services.artefact(file_id)                           # the kept ReadArtefact, loaded back
    services.record_bangla_lines(file_id, flagged.findings(sheet_of))  # the Bangla-ANSI lines
    services.record_page_reasons(pdf_id, [reports.PAGE_SHEET_NOT_IN_DWG(page=12, sheet="S-13")])

For the page (20b), through `drawings/http/` (list, one file, cancel, restart, Discipline, report):

    drawing_set = services.set_of(project_id)            # None before the first file
    views = services.files(drawing_set.id); services.summary(views)
    services.file(file_id); services.report(file_id)     # a file's status; its report panel
    services.set_discipline(file_id, "electrical")       # its unconfirmed sheets move with it
    services.cancel(file_id, actor_name=user.name); services.restart(file_id)
    services.disciplines()                               # the Market's, one name each (labels)
    services.sheet(sr.id); services.render(sr.id)        # a printed sheet; its render's bytes

For 19a and 21c (Step 1):

    services.files(set_id); services.sheets(set_id, "structural"); services.views(sr.id)
    services.confirm_sheet(sr.id, confirmation_id=c, kind="beam_layout")
    services.confirm_view(view.id, confirmation_id=c)
    services.exclude(view.id, "other", "The QS's words", confirmation_id=c)
    services.undo(c)                                     # every decision stamped with c
    services.resolve(anchor, sheet_revision_id=sr.id)    # file, printed sheet, entity and chain
    services.answer_held(file_id, "read_anyway")         # a held file's Question answered
"""

from vextrus.drawings.models import HeldAnswer, PlotNone
from vextrus.drawings.services.anchors import Resolved, resolve
from vextrus.drawings.services.drawing_files import (
    FINISHING,
    MATCHING,
    OPENING,
    READING,
    SECOND_READER,
    SHEETS,
    Added,
    FileState,
    FileView,
    SetView,
    add_file,
    cancel,
    clean_name,
    file,
    files,
    page_step,
    restart,
    set_discipline,
    set_of,
    sheet_step,
    summary,
)
from vextrus.drawings.services.library_disciplines import DisciplineView, conventions, disciplines
from vextrus.drawings.services.reads import (
    ArtefactRef,
    answer_held,
    artefact,
    attach_read_job,
    mark_failed,
    mark_read,
    original,
    quarantine,
    record_bangla_lines,
    record_page_reasons,
    record_reports,
    step_store,
    store_artefact,
)
from vextrus.drawings.services.reports import FontRow, Report, report
from vextrus.drawings.services.sheet_list import (
    PlotView,
    SheetView,
    ViewView,
    confirm_sheet,
    confirm_view,
    exclude,
    record_kind,
    record_plot,
    record_render,
    record_sheets,
    record_views,
    render,
    sheet,
    sheets,
    undo,
    views,
)
from vextrus.drawings.services.stored_anchor import StoredAnchor

__all__ = [
    "FINISHING",
    "MATCHING",
    "OPENING",
    "READING",
    "SECOND_READER",
    "SHEETS",
    "Added",
    "ArtefactRef",
    "DisciplineView",
    "FileState",
    "FileView",
    "FontRow",
    "HeldAnswer",
    "PlotNone",
    "PlotView",
    "Report",
    "Resolved",
    "SetView",
    "SheetView",
    "StoredAnchor",
    "ViewView",
    "add_file",
    "answer_held",
    "artefact",
    "attach_read_job",
    "cancel",
    "clean_name",
    "confirm_sheet",
    "confirm_view",
    "conventions",
    "disciplines",
    "exclude",
    "file",
    "files",
    "mark_failed",
    "mark_read",
    "original",
    "page_step",
    "quarantine",
    "record_bangla_lines",
    "record_kind",
    "record_page_reasons",
    "record_plot",
    "record_render",
    "record_reports",
    "record_sheets",
    "record_views",
    "render",
    "report",
    "resolve",
    "restart",
    "set_discipline",
    "set_of",
    "sheet",
    "sheet_step",
    "sheets",
    "step_store",
    "store_artefact",
    "summary",
    "undo",
    "views",
]
