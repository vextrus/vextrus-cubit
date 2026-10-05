"""The proxy's decode cache (ticket T-249, A4): a drawing's reading, kept by what it was read from and
by what read it, never by where the file lies (session 12's throwaway named an entry by the path's
hash, so a renamed file missed and an edited one hit stale).

    DecodeCache(root, reader_hash).get(path, read)

An entry is `<root>/<reader_hash>/<sha256 of the file's bytes>.pickle`: the same bytes under another
path hit, changed bytes miss, and a changed reader (another `reader_hash`) misses while the old
entries stay for the old hash. A file whose bytes change while it is read is not kept. Names are hex
only, so no entry's name holds a drawing file's name (the reading itself must not either: the
snapshot reads under a neutral name and puts the file's own back on every hit). An entry
is the pickle behind its own sha256, written to a temporary file and renamed into place, so a
truncated or half-written entry is a miss and is replaced, never a wrong value. Pickle is loaded only
from a folder this user owns and nobody else may write.

`reader_hash(root)` is the sha256 over the import closure of `engine/read/__init__.py` in a working
tree (`tools.lint.import_closure`): each file's path and bytes, in path order, so editing a module the
reader loads (by an import, a function's import or a string target) changes it, and editing a test or
a module the reader never loads does not. The installed LibreDWG is not in it (see the PR body).
"""

import hashlib
import os
import pickle
import re
import secrets
import stat
from collections.abc import Callable
from pathlib import Path, PurePosixPath
from typing import TypeVar, cast

T = TypeVar("T")

READER = "engine/read/__init__.py"
HEX = re.compile(r"\A[0-9a-f]{16,128}\Z")
SKIPPED = frozenset({"__pycache__", "node_modules"})
_DIGEST = hashlib.sha256().digest_size


class CacheError(Exception):
    """The cache's folder is not this user's alone, or its reader hash is not hex."""


class DecodeCache:
    """A drawing's reading by (the file's content, the reader's code): see the module."""

    def __init__(self, root: Path, reader_hash: str) -> None:
        if not HEX.match(reader_hash):
            raise CacheError("a reader hash is hex")
        self.root = Path(root)
        self.folder = self.root / reader_hash
        self.hits = 0
        self.misses = 0

    def get(self, path: Path, read: Callable[[Path], T]) -> T:
        """`read(path)`, or the reading kept for the same bytes and reader."""
        entry = self.folder / f"{file_sha256(Path(path))}.pickle"
        found = self._load(entry)
        if found is not None:
            self.hits += 1
            return cast(T, found[0])
        self.misses += 1
        value = read(Path(path))
        # A file changed while it was read is not kept: its reading may be of other bytes than the key's.
        if entry.name == f"{file_sha256(Path(path))}.pickle":
            self._store(entry, value)
        return value

    def _load(self, entry: Path) -> tuple[object] | None:
        """The entry's value (in a 1-tuple, so a kept None is a hit), or None for no whole entry."""
        if not self.folder.is_dir():
            return None
        _own(self.folder)
        try:
            handle = os.open(entry, os.O_RDONLY | os.O_NOFOLLOW)
        except OSError:
            return None
        with os.fdopen(handle, "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o022:
                return None
            data = stream.read()
        digest, payload = data[:_DIGEST], data[_DIGEST:]
        if len(digest) != _DIGEST or hashlib.sha256(payload).digest() != digest:
            return None  # truncated or damaged: a miss, replaced by the next store
        try:
            return (pickle.loads(payload),)
        except Exception:
            return None

    def _store(self, entry: Path, value: object) -> None:
        """Writes the entry whole or not at all: pickled first, then a temporary file renamed."""
        payload = pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL)
        self.folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        _own(self.folder)
        partial = entry.with_name(f"{entry.stem}.{secrets.token_hex(8)}.part")
        handle = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(handle, "wb") as stream:
                stream.write(hashlib.sha256(payload).digest() + payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(partial, entry)
        except BaseException:
            partial.unlink(missing_ok=True)
            raise


def _own(folder: Path) -> None:
    info = os.lstat(folder)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o022:
        raise CacheError("the cache's folder is not this user's alone (no pickle is loaded from it)")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while chunk := handle.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def reader_hash(root: Path) -> str:
    """The sha256 over the import closure of `engine/read/__init__.py` under `root` (see the module)."""
    from tools.lint.import_closure import closure  # T-Q16's module (s13-q16b)

    root = Path(root)
    tree = list(_tree(root))

    def read(name: str) -> bytes | None:
        path = root / name
        return path.read_bytes() if path.is_file() else None

    digest = hashlib.sha256()
    for name in sorted(closure(read, [READER], tree)):
        data = read(name)
        digest.update(name.encode() + b"\0" + hashlib.sha256(data or b"").digest())
    return digest.hexdigest()


def _tree(root: Path) -> list[str]:
    """The files of the root's Python packages (its top folders holding an `__init__.py`), tests
    left out, by their paths relative to the root."""
    found = []
    for top in sorted(root.iterdir()):
        if not top.is_dir() or top.name.startswith(".") or not (top / "__init__.py").is_file():
            continue
        for folder, names, files in os.walk(top):
            names[:] = sorted(n for n in names if n not in SKIPPED and not n.startswith("."))
            for name in files:
                relative = (Path(folder) / name).relative_to(root).as_posix()
                if not _test(relative):
                    found.append(relative)
    return found


def _test(name: str) -> bool:
    """A test or a test's helper (a `tests` folder, `test_*.py`, `conftest.py`): never the reader's."""
    path = PurePosixPath(name)
    return (
        "tests" in path.parts[:-1]
        or path.name == "conftest.py"
        or (path.name.startswith("test_") and path.suffix == ".py")
    )
