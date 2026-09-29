"""Adding a file to a Project's Drawing Set (ticket 21a; m0-screens 4.5): the upload operation.

    POST /api/projects/{project_id}/drawings/files     one multipart part, `file`; CSRF
    201 {file, outcome: "added", message}                   the file it became, waiting to be read
    200 {file, outcome: "already_here" | "replaced", message}

The body is streamed through 14's upload handler (`drawings.uploads`), which bounds every request
before anyone is known: one file, at most `VEXTRUS_UPLOAD_MAX_BYTES`, nothing kept on a refusal.
Then 07's guard: CSRF, signed in, the Project in the Membership's scope (else one 404), the act's
grant (the MD and a Guest add nothing, 403). Then `read_file.add`: the file and its read job, on the
`cad` queue, in one transaction. Every refusal is `{code, params}`: 14's `drawings.uploads.*`, 07's
`platform.auth.*`, and `takeoff.read_file.not_started` (503) when the job could not be queued.
"""

import uuid
from typing import Any

from django.http import HttpRequest
from ninja import Router, Schema, Status
from ninja.files import UploadedFile
from ninja.params import functions as params

from engine.messages import Message
from vextrus.drawings import acts
from vextrus.drawings.messages import uploads as said
from vextrus.drawings.schemas import FileOut
from vextrus.platform.http.acts import Refusal, declare
from vextrus.platform.services import auth
from vextrus.takeoff.tasks import read_file

router = Router()


class UploadOut(Schema):
    file: FileOut
    """The file the upload became, or the one already here with the same contents."""
    outcome: str
    """`added`, `already_here` (nothing was added) or `replaced` (Vextrus's missing or damaged copy
    was replaced)."""
    message: Message | None
    """The toast's words, when m0-screens 4.5 has any."""


NO_FILE: Any = params.File(None)
"""The operation's file: none when no whole file arrived (a body cut short, or no `file` part)."""


@router.post(
    "/projects/{project_id}/drawings/files",
    response={201: UploadOut, 200: UploadOut, 400: Refusal, 413: Refusal, 415: Refusal, 503: Refusal},
)
@declare(acts.UPLOAD, project="project_id")
def upload_file(
    request: HttpRequest, project_id: uuid.UUID, file: UploadedFile | None = NO_FILE
) -> Status[UploadOut]:
    """Add one file (the web sends each on its own, with its own progress)."""
    if file is None:
        raise auth.Refused(said.STOPPED(), status=400)
    added = read_file.add(
        project_id,
        name=file.name or "",
        content=file,
        actor_name=str(getattr(request.user, "name", "")),
    )
    out = UploadOut(file=FileOut.from_view(added.file), outcome=added.outcome, message=added.message)
    return Status(201 if added.outcome == "added" else 200, out)
