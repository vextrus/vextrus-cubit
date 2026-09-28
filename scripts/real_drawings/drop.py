"""What leaves the sandbox, and the posting runs' drop folder (the M0 plan, the real-drawing check,
step 4).

The sandbox's output folder was writable by the PR's code, so the command takes from it only the files
it names, regular files only, opened without following a link; anything else there (a planted summary,
metadata, a link) is never read. A posting run writes into its own new folder under the drop folder,
one posting run at a time under the drop folder's lock.
"""

import fcntl
import hashlib
import io
import os
import stat
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from scripts.real_drawings.source import Refused

LOCK = ".lock"
MOST = 1 << 30  # an export larger than 1 GiB is refused


def take(folder: Path, name: str, into: Path) -> str:
    """Copy `folder/name` to `into` (a new file) if it is a regular file; returns its sha256."""
    directory = os.open(folder, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        try:
            source = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        except OSError as error:
            raise Refused(f"the sandbox left no regular file {name} ({error.strerror})") from None
    finally:
        os.close(directory)
    try:
        info = os.fstat(source)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MOST:
            raise Refused(f"the sandbox's {name} is not a plain file the check copies")
        digest = hashlib.sha256()
        with os.fdopen(os.dup(source), "rb") as reading, open_new(into) as writing:
            while chunk := reading.read(1 << 20):
                digest.update(chunk)
                writing.write(chunk)
        return digest.hexdigest()
    finally:
        os.close(source)


def open_new(path: Path, mode: int = 0o640) -> io.FileIO:
    """A new file, never an existing one and never through a link."""
    return io.FileIO(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode), "wb")


def write_new(path: Path, data: bytes) -> None:
    with open_new(path) as file:
        file.write(data)


@contextmanager
def posting_lock(drop: Path) -> Iterator[None]:
    """Held for a whole posting run; a second posting run is refused, never queued."""
    try:
        handle = os.open(drop / LOCK, os.O_RDWR | os.O_NOFOLLOW)
    except OSError as error:
        raise Refused(
            f"no lock at {drop / LOCK} ({error.strerror}): run scripts/owner/drop-setup.sh"
        ) from None
    try:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Refused(
                "another posting run holds the drop folder's lock; wait for it to finish"
            ) from None
        yield
    finally:
        os.close(handle)
