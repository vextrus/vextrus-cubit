"""Storage: files kept by key, with a StoredFile row for each (docs/data-model.md §3.0; ticket 09).

A key begins with its tenant's id, then its Project's, then one to eight names:
`<tenant id>/<project id>/drawings/<file id>/original.dwg` (s02 Q15; ADR 0038 item 8). `key(project_id,
*names)` makes one in the acting tenant. In development the files live on the local file system
under `settings.VEXTRUS_STORAGE_ROOT`, at the key's own path; the beta moves them to object storage
behind the same functions.

- `put(key, content, …)` writes a file and its row inside the caller's transaction. A key names one
  content for good: putting the same bytes again returns the row; different bytes are refused.
- `get(key)` returns the bytes, `local_copy(key)` a private copy on disk (for a reader that takes a
  path), `info(key)` the row. Each checks the file against its row's sha256 and size, so a file
  changed on disk is never used.

What is refused (the trust boundary; each attack has its test in `tests/test_storage.py`):
- a key of another shape: `..`, `.`, an absolute key, a backslash, an empty name, a NUL, an upper-case
  id: every name starts with a letter, a digit or `_` and holds only `[A-Za-z0-9._@+-]`;
- a key whose first id is not the acting tenant's (a read answers "missing", as for any file that
  is not there; a write is refused); row-level security hides another tenant's rows and a check
  holds every row's key to its own tenant and Project;
- a key of a Project the acting Membership may not open (answered "missing", as `require` answers
  "not found", so its existence does not leak), and any key for a person acting with no current
  Membership (fail closed; a step for no user, the system, reads its tenant's);
- a symbolic link, or anything but a directory or a regular file, planted anywhere under the root:
  every name is opened relative to its parent's descriptor with `O_NOFOLLOW`, never through a path.
"""

import hashlib
import os
import re
import stat
import tempfile
import uuid
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.db import connection

from engine.messages import Message
from vextrus.platform.messages import storage as words
from vextrus.platform.models import STORED_FILE_KEY, StoredFile, StoredFileKind
from vextrus.platform.services import tenancy

_KEY = re.compile(STORED_FILE_KEY)
_NAME = re.compile(r"[A-Za-z0-9_][A-Za-z0-9._@+-]{0,127}")
_CHUNK = 1 << 20
_DIRECTORY = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
# O_NONBLOCK: a FIFO planted as a file must not hang the reader (no effect on a regular file).
_FILE = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC


class StorageError(Exception):
    """Storage refused an act or found a file unusable."""


class KeyRefused(StorageError):
    """The key is not a key, or not the acting tenant's: nothing is read or written."""


class KeyTaken(StorageError):
    """The key already names other content (a key names one content for good)."""


class UnsafePath(StorageError):
    """Something other than a directory or a regular file (a symbolic link, a device) sits on the
    key's path under the root: planted, since storage never makes one."""


class FileMissing(StorageError):
    """No file under this key that the acting tenant and Membership may read."""

    message: Message = words.MISSING()


class FileChanged(StorageError):
    """The file on disk no longer matches its row's sha256 or size, so it is not used."""

    message: Message = words.CHANGED()


@dataclass(frozen=True)
class StoredFileInfo:
    id: uuid.UUID
    key: str
    project_id: uuid.UUID
    sha256: str
    size: int
    kind: str
    media_type: str
    producer: str
    producer_version: str
    source_sha256: str


@dataclass(frozen=True)
class _Key:
    text: str
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    folders: tuple[str, ...]
    """The directories under the root: the tenant's, the Project's and every name but the last."""
    name: str


def key(project_id: uuid.UUID, *names: str) -> str:
    """The key of `names` in a Project of the acting tenant."""
    tenant_id = _acting_tenant()
    for name in names:
        if not isinstance(name, str) or not _NAME.fullmatch(name):
            raise KeyRefused(f"not a name: {name!r}")
    return _parse("/".join((str(tenant_id), str(project_id), *names))).text


def put(
    key: str,
    content: bytes | BinaryIO,
    *,
    kind: StoredFileKind | str,
    media_type: str,
    producer: str,
    producer_version: str = "",
    source_sha256: str = "",
) -> StoredFileInfo:
    """Keep `content` under `key`, in the caller's transaction (it must be inside one).

    Putting the same bytes under the same key again returns its row; other bytes raise KeyTaken.
    If the transaction rolls back, the row goes and the file stays unreferenced, to be overwritten
    by the next put of that key.
    """
    parsed = _parse(key)
    _check_scope(parsed, refuse=KeyRefused)
    if not connection.in_atomic_block:
        raise StorageError("put runs inside the data's transaction.atomic()")
    with connection.cursor() as cursor:
        # Two puts of one key wait for each other, so neither replaces the file the other's row names.
        cursor.execute("select pg_advisory_xact_lock(hashtextextended(%s, 0))", [f"storage:{key}"])
    existing = StoredFile.objects.filter(tenant_id=parsed.tenant_id, key=parsed.text).first()
    folder = _open_folder(parsed, create=True)
    try:
        temporary, sha256, size = _write_temporary(folder, content)
        if existing is not None and (existing.sha256, existing.size) != (sha256, size):
            os.unlink(temporary, dir_fd=folder)
            raise KeyTaken(parsed.text)
        try:
            os.replace(temporary, parsed.name, src_dir_fd=folder, dst_dir_fd=folder)
        except IsADirectoryError as error:  # a directory planted where the file goes
            os.unlink(temporary, dir_fd=folder)
            raise UnsafePath(parsed.text) from error
        os.fsync(folder)
    finally:
        os.close(folder)
    if existing is None:
        existing = StoredFile.objects.create(
            tenant_id=parsed.tenant_id,
            project_id=parsed.project_id,
            key=parsed.text,
            sha256=sha256,
            size=size,
            kind=StoredFileKind(kind),
            media_type=media_type,
            producer=producer,
            producer_version=producer_version,
            source_sha256=source_sha256,
        )
    return _info(existing)


def info(key: str) -> StoredFileInfo:
    """The row of the file under `key` (FileMissing if the acting tenant may not read one)."""
    return _info(_row(_parse(key, reading=True)))


def get(key: str) -> bytes:
    """The bytes under `key`, checked against the row's sha256 and size."""
    parsed = _parse(key, reading=True)
    row = _row(parsed)
    chunks = []
    digest = hashlib.sha256()
    with _open_file(parsed) as file:
        while chunk := file.read(_CHUNK):
            digest.update(chunk)
            chunks.append(chunk)
    content = b"".join(chunks)
    if (digest.hexdigest(), len(content)) != (row.sha256, row.size):
        raise FileChanged(parsed.text)
    return content


@contextmanager
def local_copy(key: str) -> Iterator[Path]:
    """A private copy of the file under `key` on the local disk, checked, removed on leaving.

    For a reader that takes a path (the CAD readers run in a sandbox on a file).
    """
    parsed = _parse(key, reading=True)
    row = _row(parsed)
    suffix = Path(parsed.name).suffix
    handle, name = tempfile.mkstemp(prefix="vextrus-", suffix=suffix)
    try:
        digest = hashlib.sha256()
        size = 0
        with _open_file(parsed) as source, os.fdopen(handle, "wb") as copy:
            while chunk := source.read(_CHUNK):
                digest.update(chunk)
                size += len(chunk)
                copy.write(chunk)
        if (digest.hexdigest(), size) != (row.sha256, row.size):
            raise FileChanged(parsed.text)
        yield Path(name)
    finally:
        with suppress(FileNotFoundError):
            os.unlink(name)


# Keys -------------------------------------------------------------------------------------------


def _acting_tenant() -> uuid.UUID:
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        raise KeyRefused("storage is used only while acting in a tenant")
    return tenant_id


def _parse(text: object, *, reading: bool = False) -> _Key:
    """The key, or a refusal: `KeyRefused` for what is not a key (a caller's mistake, never shown);
    for a key of another tenant, or used acting in none, `KeyRefused` on a write and `FileMissing`
    on a read, so a read never tells another tenant's file from a missing one."""
    if not isinstance(text, str) or not _KEY.fullmatch(text):
        raise KeyRefused(f"not a key: {text!r}")
    tenant, project, *names = text.split("/")
    if not all(_NAME.fullmatch(name) for name in names):  # the pattern holds this; kept explicit
        raise KeyRefused(f"not a key: {text!r}")
    acting = tenancy.current_tenant_id()
    if uuid.UUID(tenant) != acting:
        if reading:
            raise FileMissing(text)
        if acting is None:
            raise KeyRefused("storage is used only while acting in a tenant")
        raise KeyRefused("the key is not the acting tenant's")
    return _Key(text, uuid.UUID(tenant), uuid.UUID(project), (tenant, project, *names[:-1]), names[-1])


def _check_scope(parsed: _Key, *, refuse: type[StorageError]) -> None:
    """A Membership scoped to Projects reads and writes only theirs (its existence not leaked); a
    person acting with no current Membership (it ended, or staff in the admin) reads and writes none.
    The system (a step for no user) reads its tenant's."""
    acting = tenancy.current()
    if acting.user_id is not None and acting.membership is None:
        raise refuse(parsed.text)
    if acting.membership is not None and not acting.membership.may_open(parsed.project_id):
        raise refuse(parsed.text)


def _row(parsed: _Key) -> StoredFile:
    _check_scope(parsed, refuse=FileMissing)
    row = StoredFile.objects.filter(tenant_id=parsed.tenant_id, key=parsed.text).first()
    if row is None:
        raise FileMissing(parsed.text)
    return row


def _info(row: StoredFile) -> StoredFileInfo:
    return StoredFileInfo(
        id=row.id,
        key=row.key,
        project_id=row.project_id,
        sha256=row.sha256,
        size=row.size,
        kind=row.kind,
        media_type=row.media_type,
        producer=row.producer,
        producer_version=row.producer_version,
        source_sha256=row.source_sha256,
    )


# The file system: every name opened relative to its parent, never following a link --------------


def _root() -> Path:
    root = Path(settings.VEXTRUS_STORAGE_ROOT)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    return root


def _open_folder(parsed: _Key, *, create: bool) -> int:
    """A descriptor of the key's directory, each level opened without following a link."""
    folder = os.open(_root(), os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for name in parsed.folders:
            if create:
                with suppress(FileExistsError):
                    os.mkdir(name, 0o700, dir_fd=folder)
            try:
                inner = os.open(name, _DIRECTORY, dir_fd=folder)
            except FileNotFoundError:
                raise FileMissing(parsed.text) from None
            except OSError as error:  # ELOOP (a link) or ENOTDIR (a file): planted
                raise UnsafePath(parsed.text) from error
            os.close(folder)
            folder = inner
    except BaseException:
        os.close(folder)
        raise
    return folder


@contextmanager
def _open_file(parsed: _Key) -> Iterator[BinaryIO]:
    folder = _open_folder(parsed, create=False)
    try:
        try:
            handle = os.open(parsed.name, _FILE, dir_fd=folder)
        except FileNotFoundError:
            raise FileMissing(parsed.text) from None
        except OSError as error:  # ELOOP: a link planted as the file
            raise UnsafePath(parsed.text) from error
    finally:
        os.close(folder)
    if not stat.S_ISREG(os.fstat(handle).st_mode):  # a FIFO, a device, a directory
        os.close(handle)
        raise UnsafePath(parsed.text)
    with os.fdopen(handle, "rb") as file:
        yield file


def _write_temporary(folder: int, content: bytes | BinaryIO) -> tuple[str, str, int]:
    """Write `content` beside its final name; (the temporary name, its sha256, its size).

    The temporary name starts with a dot, which no key's name may, so it never meets a kept file.
    """
    temporary = f".put-{uuid.uuid4().hex}"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC
    handle = os.open(temporary, flags, 0o600, dir_fd=folder)
    digest = hashlib.sha256()
    size = 0
    try:
        with os.fdopen(handle, "wb") as file:
            for chunk in _chunks(content):
                digest.update(chunk)
                size += len(chunk)
                file.write(chunk)
            file.flush()
            os.fsync(file.fileno())
    except BaseException:
        with suppress(FileNotFoundError):
            os.unlink(temporary, dir_fd=folder)
        raise
    return temporary, digest.hexdigest(), size


def _chunks(content: bytes | BinaryIO) -> Iterator[bytes]:
    if isinstance(content, bytes):
        yield content
        return
    while chunk := content.read(_CHUNK):
        yield chunk
