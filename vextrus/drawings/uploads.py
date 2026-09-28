"""The upload handler (ticket 14; settings `FILE_UPLOAD_HANDLERS`): every multipart body the product
parses, bounded as it streams, whoever sends it.

A request's body is parsed before anyone is known: Django Ninja checks the CSRF token first (its
`Session` authentication, then 07's guard), and Django's CSRF check reads the form, so the files are
streamed through this handler before the sign-in or the act is checked. So the handler bounds every
request itself:

- **one file per request** (`VEXTRUS_UPLOAD_MAX_FILES`): the web sends each file on its own, with its
  own progress (m0-screens 4.5, "Uploading, 42%"); a second file refuses the whole request;
- **each file at most `VEXTRUS_UPLOAD_MAX_BYTES`**, counted as its bytes arrive, whatever the
  Content-Length says (or whether it says anything): past the limit the request is refused there,
  without reading on;
- **nothing kept on a refusal**: each file is spooled to a private temporary file, and every file the
  request had is closed (and so deleted) before the refusal is raised. A body cut short never gives a
  file: Django drops a part whose closing boundary never came, and the operation then answers
  "Upload stopped" (`drawings.uploads.stopped`); a connection that dropped as the body was read is
  refused so here; a body that is no well-formed form (a part's headers past Django's 1 KB, as a
  1,000-character name makes them) is refused as unreadable (`drawings.uploads.malformed`).

A refusal is an `UploadRefused`: an `auth.Refused` (so an API operation answers `{code, params}`) and a
`SuspiciousOperation` (so any other view answers 400, never 500). The file's name is only a label.

For 21a's upload operation (`takeoff/http/`), after the guard:

    @router.post("/projects/{project_id}/drawings/files", response={201: …, 200: …, 400: Refusal, …})
    @declare(drawings_acts.UPLOAD, project="project_id")
    def upload(request, project_id: uuid.UUID, file: File[UploadedFile] | None = None):
        if file is None:
            raise auth.Refused(uploads.STOPPED(), status=400)   # nothing whole arrived
        added = drawings.services.add_file(project_id, name=file.name, content=file,
                                           actor_name=request.user.name)
"""

from typing import Any

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from django.core.files.uploadedfile import UploadedFile
from django.core.files.uploadhandler import TemporaryFileUploadHandler
from django.http import HttpRequest
from django.http.multipartparser import MultiPartParser, MultiPartParserError

from engine.messages import Message
from vextrus.drawings.messages import uploads as said
from vextrus.drawings.services.drawing_files import clean_name, megabytes
from vextrus.platform.services import auth


class UploadRefused(auth.Refused, SuspiciousOperation):
    """A body the handler will not take: its words for the web, its status for everyone."""

    def __init__(self, message: Message, status: int) -> None:
        super().__init__(message, status=status)


class DrawingUploadHandler(TemporaryFileUploadHandler):
    """Every file of a request to a private temporary file, bounded as it streams (see the module)."""

    def __init__(self, request: HttpRequest | None = None) -> None:
        super().__init__(request)
        self._files: list[UploadedFile[Any]] = []
        self._count = 0
        self._received = 0
        self._parsing = False

    def handle_raw_input(
        self,
        input_data: Any,
        META: dict[str, Any],
        content_length: int,
        boundary: str,
        encoding: str | None = None,
    ) -> tuple[Any, Any] | None:
        """Parse the body here, so a body Django cannot parse is refused in the same words and
        status as every other refusal, never an error page: a body cut off as it came is "stopped";
        one that is not a well-formed form (a part's headers past Django's 1 KB, too many fields)
        could not be read. Django closes the files it had made before the error reaches here."""
        if self._parsing:
            return None
        self._parsing = True
        try:
            return MultiPartParser(META, input_data, [self], encoding).parse()
        except UploadRefused:
            raise
        except OSError:
            raise UploadRefused(said.STOPPED(), 400) from None
        except MultiPartParserError, SuspiciousOperation:
            raise UploadRefused(said.MALFORMED(), 400) from None
        finally:
            self._parsing = False

    def new_file(self, field_name: str, file_name: str, *args: Any, **kwargs: Any) -> None:
        self._count += 1
        if self._count > settings.VEXTRUS_UPLOAD_MAX_FILES:
            self._refuse(said.ONE_AT_A_TIME(), 400)
        super().new_file(field_name, file_name, *args, **kwargs)
        self._received = 0

    def receive_data_chunk(self, raw_data: bytes, start: int) -> None:
        self._received += len(raw_data)
        limit = settings.VEXTRUS_UPLOAD_MAX_BYTES
        if self._received > limit:
            label = clean_name(self.file_name or "")
            self._refuse(said.TOO_LARGE(file=label, megabytes=megabytes(limit)), 413)
        self.file.write(raw_data)

    def file_complete(self, file_size: int) -> UploadedFile[Any] | None:
        done = super().file_complete(file_size)
        if done is not None:
            self._files.append(done)
        return done

    def _refuse(self, message: Message, status: int) -> None:
        """Close (and so delete) every file of this request, then refuse it."""
        for kept in (*self._files, getattr(self, "file", None)):
            if kept is not None:
                kept.close()
        self._files.clear()
        raise UploadRefused(message, status)
