"""A Drawing Set's files in the API (ticket 14; m0-screens 4.5): list, one file's progress, cancel,
restart, Mark for Vextrus, its Discipline, its report and a PDF's own bytes (the Plot).

Each operation declares its act through 07's guard, which answers first (signed out 401; no current
Membership 403; a Project outside the Membership's scope 404, before the role; the MD or a Guest
changing anything 403). A file is named by its own id, so the operation checks it belongs to the
path's Project: a file of another Project, of another Developer, or none at all is one 404
(`platform.auth.not_found`). Cancel and restart act on the file's own read job, never one the client
names. Adding a file is 21a's operation (`takeoff/http/`), since the upload defers the read job in
the same transaction (`drawings.uploads` shows how).
"""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.drawings import acts, services
from vextrus.drawings.models import FileFormat
from vextrus.drawings.schemas import DisciplineIn, DisciplineOut, FileOut, FilesOut, ReportOut
from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services import auth, deadlocks, storage

router = Router()

_PREFIX = "/projects/{project_id}/drawings"


def in_project(view: services.FileView, project_id: uuid.UUID) -> services.FileView:
    """The file, when it is of the path's Project; else the one "not found"."""
    if view.project_id != project_id:
        raise auth.NotFound
    return view


def actor(request: HttpRequest) -> str:
    return str(getattr(request.user, "name", ""))


@router.get(f"{_PREFIX}/disciplines", response=list[DisciplineOut])
@declare(acts.LOOK, project="project_id")
def list_disciplines(request: HttpRequest, project_id: uuid.UUID) -> list[DisciplineOut]:
    """The Market's Disciplines, one name each, for a file's Discipline select."""
    return [DisciplineOut.from_view(view) for view in services.disciplines()]


@router.get(f"{_PREFIX}/files", response=FilesOut)
@declare(acts.LOOK, project="project_id")
def list_files(request: HttpRequest, project_id: uuid.UUID) -> FilesOut:
    """The Project's Drawing Set's files, in the order they were added, with the page's summary."""
    drawing_set = services.set_of(project_id)
    views = services.files(drawing_set.id) if drawing_set else []
    return FilesOut.from_views(drawing_set, views, services.summary(views))


@router.get(f"{_PREFIX}/files/{{file_id}}", response=FileOut)
@declare(acts.LOOK, project="project_id")
def get_file(request: HttpRequest, project_id: uuid.UUID, file_id: uuid.UUID) -> FileOut:
    """One file and its status: what the page polls while it is read."""
    return FileOut.from_view(in_project(services.file(file_id), project_id))


@router.post(f"{_PREFIX}/files/{{file_id}}/cancel", response=FileOut)
@declare(acts.CANCEL, project="project_id")
def cancel_reading(request: HttpRequest, project_id: uuid.UUID, file_id: uuid.UUID) -> FileOut:
    """Cancel the file's reading ("Cancel reading"); a file already ended is left as it is."""
    in_project(services.file(file_id), project_id)
    return FileOut.from_view(services.cancel(file_id, actor_name=actor(request)))


@router.post(f"{_PREFIX}/files/{{file_id}}/restart", response={200: FileOut, 409: Refusal})
@declare(acts.RESTART, project="project_id")
def restart_reading(request: HttpRequest, project_id: uuid.UUID, file_id: uuid.UUID) -> FileOut:
    """Read a failed or cancelled file again ("Read again", "Try again"); anything else is 409."""
    in_project(services.file(file_id), project_id)
    return FileOut.from_view(services.restart(file_id))


@router.post(f"{_PREFIX}/files/{{file_id}}/mark-for-vextrus", response={200: FileOut, 409: Refusal})
@declare(acts.MARK_FOR_VEXTRUS, project="project_id")
def mark_for_vextrus(request: HttpRequest, project_id: uuid.UUID, file_id: uuid.UUID) -> FileOut:
    """Mark a file that could not be read for Vextrus to look at ("Mark for Vextrus"); anything
    else is 409."""
    in_project(services.file(file_id), project_id)
    return FileOut.from_view(services.mark_for_vextrus(file_id))


@router.put(
    f"{_PREFIX}/files/{{file_id}}/discipline",
    response={200: FileOut, 400: Refusal, 409: Refusal},
)
@declare(acts.SET_DISCIPLINE, project="project_id")
def set_discipline(
    request: HttpRequest, project_id: uuid.UUID, file_id: uuid.UUID, payload: DisciplineIn
) -> FileOut:
    """The QS's choice of the file's Discipline; its unconfirmed sheets move with it."""
    in_project(services.file(file_id), project_id)
    changed = deadlocks.retried(
        lambda: services.set_discipline(file_id, payload.discipline, actor_name=actor(request)),
        what="drawings.set_discipline",
    )
    return FileOut.from_view(changed)


@router.get(f"{_PREFIX}/files/{{file_id}}/report", response=ReportOut)
@declare(acts.LOOK, project="project_id")
def file_report(request: HttpRequest, project_id: uuid.UUID, file_id: uuid.UUID) -> ReportOut:
    in_project(services.file(file_id), project_id)
    return ReportOut.from_report(services.report(file_id))


@router.get(f"{_PREFIX}/files/{{file_id}}/pdf", response={409: Refusal})
@declare(acts.LOOK, project="project_id")
def file_pdf(request: HttpRequest, project_id: uuid.UUID, file_id: uuid.UUID) -> HttpResponse:
    """A PDF as it was added, for its Plot beneath a sheet (a DWG's bytes are never served)."""
    view = in_project(services.file(file_id), project_id)
    if view.format != FileFormat.PDF:
        raise auth.NotFound
    try:
        with services.original(file_id) as path:
            content = path.read_bytes()
    except storage.FileMissing as missing:
        raise auth.Refused(missing.message, status=409) from None
    except storage.StorageError:  # damaged, or something planted where the file goes
        raise auth.Refused(storage.FileChanged.message, status=409) from None
    response = HttpResponse(content, content_type="application/pdf")
    response["Content-Disposition"] = "inline"
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response
