"""DWG → DXF through LibreDWG, audited by two reconciled passes (L-CAD-04, R-TO-001).

One invocation, one drawing, one scratch directory that does not survive the call. The census pass
asks `dwgread` for JSON and tallies it; the geometry pass asks `dwg2dxf` for a DXF and tallies that
back through ezdxf; the two tallies are reconciled class by class. Neither pass's exit code is
read — what a pass wrote is the only evidence it worked. The converted DXF is the one thing the
lane leaves behind, and it is moved into place only once both passes have been read.
"""

from __future__ import annotations

import json
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

from .census import census_of
from .errors import DwgError
from .reconcile import RefusedClass, reconcile
from .tally import geometry_tally
from .toolchain import DEFAULT_TOOLCHAIN, Toolchain, quote, run_pass, tool_version

#: The extractor identity this lane records; the version beside it is whatever the toolchain on
#: this machine reports for itself (R-TO-001).
TOOL: Final = "libredwg"

#: How the conversion is asked for, in order. Whole first: a DXF carrying its block definitions is
#: the one an extractor can read a block reference through. Some drawings LibreDWG only spells
#: readably in its minimal form (`$ACADVER`, `HANDSEED` and the entities — its whole-file spelling
#: of those carries an `ENDBLK` whose handle is zero, which no DXF reader admits), so that form is
#: tried next rather than refusing a drawing this toolchain can in fact convert.
_CONVERSION_FORMS: Final = ((), ("-m",))

#: Where the census pass is asked to write, inside the invocation's own scratch directory.
_CENSUS_JSON: Final = "census.json"


@dataclass(frozen=True)
class DwgConversion:
    """One drawing's conversion and the audit that admitted it (L-CAD-04, R-TO-001)."""

    dxf_path: Path
    census: dict[str, dict[str, int]]
    geometry: dict[str, dict[str, int]]
    refused: tuple[RefusedClass, ...]
    tool: str
    tool_version: str


def convert_dwg(source: Path, out_dir: Path, *, toolchain: Toolchain = DEFAULT_TOOLCHAIN) -> DwgConversion:
    """Convert one DWG and audit the conversion, or refuse the drawing by name."""
    source = Path(source)
    out_dir = Path(out_dir)
    if not source.is_file():
        raise DwgError(f"{source.name}: there is no drawing at {source}")

    with tempfile.TemporaryDirectory(prefix="vextrus-dwg-") as scratch_name:
        scratch = Path(scratch_name)
        census = _census_pass(source, scratch, toolchain)
        converted, geometry = _geometry_pass(source, scratch, toolchain)
        version = tool_version(toolchain, source)

        out_dir.mkdir(parents=True, exist_ok=True)
        dxf_path = out_dir / f"{source.stem}.dxf"
        shutil.move(str(converted), str(dxf_path))

    return DwgConversion(
        dxf_path=dxf_path,
        census=census,
        geometry=geometry,
        refused=tuple(reconcile(census, geometry)),
        tool=TOOL,
        tool_version=version,
    )


def _census_pass(source: Path, scratch: Path, toolchain: Toolchain) -> dict[str, dict[str, int]]:
    """`dwgread -O JSON`, tallied — or the drawing refused by name."""
    target = scratch / _CENSUS_JSON
    diagnostics = run_pass(
        toolchain.dwgread,
        [toolchain.dwgread, "-O", "JSON", "-o", str(target), str(source)],
        source=source,
        timeout_seconds=toolchain.timeout_seconds,
    )
    if not target.is_file():
        raise DwgError(f"{source.name}: the census pass wrote no JSON{quote(diagnostics)}")
    try:
        document: Any = json.loads(target.read_text(encoding="utf-8", errors="replace"))
    except (OSError, ValueError) as error:
        raise DwgError(f"{source.name}: the census cannot be read: {error}") from error
    try:
        return census_of(document)
    except DwgError as error:
        raise DwgError(f"{source.name}: {error}") from error


def _geometry_pass(
    source: Path,
    scratch: Path,
    toolchain: Toolchain,
) -> tuple[Path, dict[str, dict[str, int]]]:
    """`dwg2dxf`, read back and tallied — or the drawing refused by name.

    Each attempt converts into a room of its own, so a converter that named its own output is
    still found and one attempt's leavings can never be read as another's.
    """
    problems: list[str] = []
    for index, flags in enumerate(_CONVERSION_FORMS):
        room = scratch / f"conversion-{index}"
        room.mkdir()
        diagnostics = run_pass(
            toolchain.dwg2dxf,
            [toolchain.dwg2dxf, *flags, "-o", str(room / f"{source.stem}.dxf"), str(source)],
            source=source,
            timeout_seconds=toolchain.timeout_seconds,
        )
        converted = _written(room)
        if converted is None:
            problems.append(f"the geometry pass wrote no DXF{quote(diagnostics)}")
            continue
        try:
            return converted, geometry_tally(converted)
        except DwgError as error:
            problems.append(str(error))
    raise DwgError(f"{source.name}: {'; '.join(problems)}")


def _written(room: Path) -> Path | None:
    """What an attempt actually produced. The exit code says nothing (L-CAD-04); this does."""
    written = sorted(path for path in room.glob("*.dxf") if path.is_file())
    return written[0] if written else None
