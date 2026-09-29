"""A printed sheet's render and Plot in the API (ticket 14; for the sheet viewer, 16, and Step 1, 22).

The render is 11's sheet buffer, checked against its StoredFile as it is read and served as bytes; the
Plot is its PDF's page and the sheet-to-page transform, or why there is none (m0-screens 4.6). A
printed sheet is named by its own id: one of another Project or Developer, or of a file not in the
sheet list (cancelled, failed, held or refused), is the one 404.
"""

import uuid

from django.http import HttpRequest, HttpResponse
from ninja import Router

from vextrus.drawings import acts, services
from vextrus.drawings.schemas import PlotOut
from vextrus.drawings.services.sheet_list import RENDER_MEDIA_TYPE
from vextrus.platform.http.acts import declare
from vextrus.platform.services import auth

router = Router()

_PREFIX = "/projects/{project_id}/drawings/sheets/{sheet_id}"


def _sheet(project_id: uuid.UUID, sheet_id: uuid.UUID) -> services.SheetView:
    """The printed sheet, when it is of the path's Project and in its sheet list; else not found."""
    listed = services.sheet(sheet_id)
    drawing_set = services.set_of(project_id)
    if drawing_set is None or listed.set_id != drawing_set.id:
        raise auth.NotFound
    return listed


@router.get(f"{_PREFIX}/render")
@declare(acts.LOOK, project="project_id")
def sheet_render(request: HttpRequest, project_id: uuid.UUID, sheet_id: uuid.UUID) -> HttpResponse:
    """The sheet as Vextrus read it ("As read"), as 11's sheet buffer."""
    _sheet(project_id, sheet_id)
    response = HttpResponse(services.render(sheet_id), content_type=RENDER_MEDIA_TYPE)
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response


@router.get(f"{_PREFIX}/plot", response=PlotOut)
@declare(acts.LOOK, project="project_id")
def sheet_plot(request: HttpRequest, project_id: uuid.UUID, sheet_id: uuid.UUID) -> PlotOut:
    """Its Plot: the PDF's page (its bytes from `…/files/{file_id}/pdf`) and the transform, or why
    there is none."""
    return PlotOut.from_view(_sheet(project_id, sheet_id).plot)
