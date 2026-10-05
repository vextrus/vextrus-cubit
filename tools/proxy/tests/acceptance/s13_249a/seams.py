"""Ticket T-249 (PR A), A4's seams, fixed by the ticket (section 3, A4), imported when called so each
test fails on its own until the builder makes them (`tools.proxy` and `tools.lint.import_closure` do
not exist on main):

- `tools.proxy.cache.DecodeCache(root: Path, reader_hash: str)`, `.get(path: Path, read:
  Callable[[Path], T]) -> T`, and its counters `hits` and `misses`;
- `tools.proxy.cache.reader_hash(root: Path) -> str`: sha256 over the import closure of
  `engine/read/__init__.py` in a working tree (each file's relative path and bytes, in path order);
- `tools.lint.import_closure.closure(read: Callable[[str], bytes | None], entries: Sequence[str],
  tree: Iterable[str]) -> frozenset[str]`;
- `tools.proxy.snap.snapshot(path, cache, *, read, find_sheets, find_views) -> dict` and
  `tools.proxy.snap.main(argv)`.
"""

import importlib
import re
from pathlib import Path
from types import ModuleType

HEX = re.compile(r"[0-9a-f]+")


def cache() -> ModuleType:
    return importlib.import_module("tools.proxy.cache")


def snap() -> ModuleType:
    return importlib.import_module("tools.proxy.snap")


def import_closure() -> ModuleType:
    return importlib.import_module("tools.lint.import_closure")


def files_under(root: Path) -> list[Path]:
    """Every file under `root`, by its path relative to `root`."""
    return sorted(p.relative_to(root) for p in root.rglob("*") if p.is_file())
