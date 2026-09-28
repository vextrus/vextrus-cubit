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
- **a body that says it is larger** than one file, the form's fields and 1 MB of the form's own
  framing is refused before a byte of it is read (`drawings.uploads.too_large_unnamed`, 413);
- **nothing kept on a refusal**: each file is spooled to a private temporary file, and every file the
  request had, whole or half-written, is closed (and so deleted) by the handler itself before the
  refusal (or a fault) is raised. A body cut short never gives a file: Django drops a part whose
  closing boundary never came, and the operation then answers "Upload stopped"
  (`drawings.uploads.stopped`); a connection that dropped as the body was read is refused so here; a
  body that is no well-formed form (no boundary or a bad one, a negative length, a part's headers past
  Django's 1 KB as a 1,000-character name makes them, a part's base64 that does not decode) is refused
  as unreadable (`drawings.uploads.malformed`), in these words, never Django's error page.

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

import io
from typing import Any, NoReturn

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


# What a whole request may carry past its one file: the form's fields (Django's own limit) and the
# form's framing (each part's boundary and headers, at most 1 KB each by Django's parser).
_FRAMING = 1024 * 1024


class DrawingUploadHandler(TemporaryFileUploadHandler):
    """Every file of a request to a private temporary file, bounded as it streams (see the module)."""

    def __init__(self, request: HttpRequest | None = None) -> None:
        super().__init__(request)
        self._files: list[UploadedFile[Any]] = []
        self._count = 0
        self._received = 0
        self._parsing = False
        if request is not None and request.content_type == "multipart/form-data":
            _check_form(request)

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
        one that is not a well-formed form (a part's headers past Django's 1 KB, a part's base64 that
        does not decode, too many fields) could not be read. Every file is closed first, the one
        being written too (Django closes only the files it finished)."""
        if self._parsing:
            return None
        self._parsing = True
        try:
            return MultiPartParser(META, input_data, [self], encoding).parse()
        except UploadRefused:
            raise
        except OSError:
            self._refuse(said.STOPPED(), 400)
        except MultiPartParserError, SuspiciousOperation:
            self._refuse(said.MALFORMED(), 400)
        except BaseException:
            self._close()  # anything else is a fault, raised as it is; its files go first
            raise
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
            size = megabytes(limit)
            if label:
                self._refuse(said.TOO_LARGE(file=label, megabytes=size), 413)
            self._refuse(said.TOO_LARGE_UNNAMED(megabytes=size), 413)
        self.file.write(raw_data)

    def file_complete(self, file_size: int) -> UploadedFile[Any] | None:
        done = super().file_complete(file_size)
        if done is not None:
            self._files.append(done)
        return done

    def _refuse(self, message: Message, status: int) -> NoReturn:
        """Close (and so delete) every file of this request, then refuse it."""
        self._close()
        raise UploadRefused(message, status)

    def _close(self) -> None:
        for kept in (*self._files, getattr(self, "file", None)):
            if kept is not None:
                kept.close()
        self._files.clear()


def _check_form(request: HttpRequest) -> None:
    """Refuse, before a byte of the body is read, a form Django's parser would refuse with its error
    page (its own checks, run on an empty body: the boundary, the length), and a body that says it
    is larger than any upload may be."""
    try:
        MultiPartParser(request.META, io.BytesIO(), [], request.encoding)
    except MultiPartParserError:
        raise UploadRefused(said.MALFORMED(), 400) from None
    try:
        declared = int(request.META.get("CONTENT_LENGTH") or 0)
    except ValueError, TypeError:
        declared = 0
    limit = settings.VEXTRUS_UPLOAD_MAX_BYTES
    most = limit * settings.VEXTRUS_UPLOAD_MAX_FILES + settings.DATA_UPLOAD_MAX_MEMORY_SIZE + _FRAMING
    if declared > most:
        raise UploadRefused(said.TOO_LARGE_UNNAMED(megabytes=megabytes(limit)), 413)
