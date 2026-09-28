"""Reading drawing files behind one reader interface: DWG (LibreDWG, checked by ACadSharp) and PDF.

`engine.read.read(path) -> ReadArtefact` is the stage the harness calls (04; the M0 plan, the
contracts): it reads a DWG with LibreDWG, sandboxed, and raises `ReadError` with the file's finding
when it cannot. A PDF is read by `engine.read.pdf` (12), never here. `acadsharp/` is 10's and `pdf/`
is 12's.
"""

from pathlib import Path

from engine.messages import read as codes
from engine.read import libredwg
from engine.read.artefact import ReadArtefact
from engine.read.errors import ReadError
from engine.read.sandbox import DEFAULT_LIMITS, Limits

__all__ = ["ReadArtefact", "ReadError", "read"]

_DWG_MAGIC = b"AC10"


def read(path: Path, *, source_name: str | None = None, limits: Limits = DEFAULT_LIMITS) -> ReadArtefact:
    """Read one drawing file. `source_name` is its name as uploaded (the path's name by default)."""
    with Path(path).open("rb") as file:
        magic = file.read(6)
    if not magic.startswith(_DWG_MAGIC):
        kind = "pdf" if magic.startswith(b"%PDF") else "unknown"
        raise ReadError(codes.UNSUPPORTED_FORMAT(format=kind))
    return libredwg.read(Path(path), source_name=source_name or Path(path).name, limits=limits)
