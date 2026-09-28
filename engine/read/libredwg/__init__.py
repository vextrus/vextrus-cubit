"""The LibreDWG reader (ADR 0029): `dwgread` JSON for structure and text, `dwg2dxf` → ezdxf for geometry.

Both programs run in the sandbox (sandbox.py), each writing into a fresh folder of its own; their
output is parsed here, outside the sandbox, in the calling process (the CAD worker, under its memory
cap; ticket 09). LibreDWG is the pinned build under `/opt/vextrus/libredwg` (`VEXTRUS_LIBREDWG` names
another prefix, for a machine that installs it elsewhere).

Every entity `dwgread` decodes is in the artefact, so its handle set is the decoder's own (what the
cross-check, 10, compares); one whose geometry the DXF lost keeps empty values and is counted in a
`geometry_missing` note.
"""

import hashlib
import os
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import replace
from functools import cache
from pathlib import Path

from engine.messages import Message
from engine.messages import read as codes
from engine.read._json import Json
from engine.read.artefact import AnyEntity, Entity, Format, ReadArtefact
from engine.read.errors import ReadError
from engine.read.libredwg import dwgread, dxf
from engine.read.sandbox import DEFAULT_LIMITS, Limits, run

READER = "libredwg"


def prefix() -> Path:
    return Path(os.environ.get("VEXTRUS_LIBREDWG", "/opt/vextrus/libredwg"))


def version() -> str:
    """LibreDWG's version, as `dwgread --version` states it (asked once per process)."""
    return _version(prefix())


@cache
def _version(libredwg: Path) -> str:
    program = libredwg / "bin" / "dwgread"
    with tempfile.TemporaryDirectory(prefix="vextrus-read-") as scratch:
        finished = run([str(program), "--version"], reads=[libredwg], output=Path(scratch))
    words = finished.stdout.decode(errors="replace").split()
    if finished.exit_code != 0 or len(words) != 2 or words[0] != "dwgread":
        raise ReadError(codes.READER_FAILED(program="dwgread", exit_code=finished.exit_code))
    return words[1]


def read(path: Path, *, source_name: str, limits: Limits = DEFAULT_LIMITS) -> ReadArtefact:
    """Read a DWG. Raises `ReadError` with the file's finding when either program fails."""
    path = path.resolve()
    reader_version = version()
    with tempfile.TemporaryDirectory(prefix="vextrus-read-") as scratch:
        json_file = _convert(path, "dwgread", ["-O", "JSON", "-o"], Path(scratch, "json"), limits)
        decoded = _parse("dwgread", lambda: dwgread.decode(dwgread.load(json_file)))
        json_file.unlink()
        dxf_file = _convert(path, "dwg2dxf", ["-y", "-o"], Path(scratch, "dxf"), limits)
        geometry, dxf_notes = _parse("dwg2dxf", lambda: _geometry(dxf_file))

    entities: list[AnyEntity] = []
    missing = 0
    for placed in decoded.entities:
        if placed.handle in decoded.texts:
            entities.append(decoded.texts[placed.handle])
            continue
        values = geometry.get(placed.handle)
        missing += values is None
        if placed.handle in decoded.inserts:
            entities.append(replace(decoded.inserts[placed.handle], values=values or {}))
            continue
        entities.append(Entity(placed.handle, placed.type, placed.layer, placed.owner, values or {}))
    notes = [*decoded.notes, *dxf_notes]
    if missing:
        notes.append(codes.GEOMETRY_MISSING(count=missing))
    return ReadArtefact.build(
        source_sha256=_sha256(path),
        source_name=source_name,
        format=Format("dwg", decoded.version),
        reader=READER,
        reader_version=reader_version,
        layouts=decoded.layouts,
        insunits=decoded.insunits,
        notes=notes,
        blocks=decoded.blocks,
        entities=entities,
    )


def _convert(source: Path, program: str, options: Sequence[str], folder: Path, limits: Limits) -> Path:
    folder.mkdir()
    target = folder / ("file.json" if program == "dwgread" else "file.dxf")
    finished = run(
        [str(prefix() / "bin" / program), *options, str(target), str(source)],
        reads=[prefix(), source],
        output=folder,
        limits=limits,
    )
    if finished.exit_code != 0:
        raise ReadError(codes.READER_FAILED(program=program, exit_code=finished.exit_code))
    if not target.is_file():
        raise ReadError(codes.OUTPUT_UNREADABLE(program=program))
    return target


def _geometry(dxf_file: Path) -> tuple[dict[str, dict[str, Json]], list[Message]]:
    doc, notes = dxf.load(dxf_file)
    return dxf.values_by_handle(doc), notes  # the ezdxf document is freed on return


def _parse[T](program: str, parse: Callable[[], T]) -> T:
    try:
        return parse()
    except (ValueError, KeyError, TypeError, OSError, UnicodeError) as error:
        raise ReadError(codes.OUTPUT_UNREADABLE(program=program)) from error


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()
