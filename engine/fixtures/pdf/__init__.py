"""Synthetic PDF fixtures: one generator per file here (`<name>.py`), run at test time, never committed.

A generator exposes `write(**options) -> bytes`, the whole file, drawn with `_writer` (ours: it writes
the hostile structures no PDF library writes on purpose). `build(name, folder, **options)` writes it
into the folder and returns its path. They prove the reader's mechanics only, never a reading
(docs/sdlc.md: synthetic fixtures are never offered as proof); every string in them is invented.
"""

from importlib import import_module
from pathlib import Path
from types import ModuleType


def generator(name: str) -> ModuleType:
    return import_module(f"{__name__}.{name}")


def build(name: str, folder: Path, **options: object) -> Path:
    """Write fixture `name`, with its options, into `folder`; returns the PDF's path."""
    data = generator(name).write(**options)
    suffix = "".join(f"-{key}={value}" for key, value in sorted(options.items()))
    path = folder / f"{name}{suffix}.pdf"
    path.write_bytes(data)
    return path
