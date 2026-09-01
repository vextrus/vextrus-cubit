"""DWG → DXF through LibreDWG, audited by two reconciled passes (L-CAD-04, R-TO-001).

One invocation, one drawing, one scratch directory that does not survive the call. The census pass
asks `dwgread` for JSON and tallies it; the geometry pass asks `dwg2dxf` for a DXF and tallies that
back through ezdxf; the two tallies are reconciled class by class. Neither pass's exit code is
read — what a pass wrote is the only evidence it worked. The converted DXF is the one thing the
lane leaves behind, and it is moved into place only once both passes have been read, so a refused
drawing leaves the caller's directory as it found it.
"""

from __future__ import annotations

import contextlib
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
from .toolchain import (
    CENSUS_PASS,
    DEFAULT_TOOLCHAIN,
    GEOMETRY_PASS,
    Deadline,
    PassOutput,
    Toolchain,
    quote,
    refusal,
    run_pass,
    tool_version,
)

#: The extractor identity this lane records; the version beside it is whatever the toolchain on
#: this machine reports for itself (R-TO-001).
TOOL: Final = "libredwg"

#: How the conversion is asked for, in order. Whole first: a DXF carrying its block definitions is
#: the one an extractor can read a block reference through. Some drawings LibreDWG only spells
#: readably in its minimal form (`$ACADVER`, `HANDSEED` and the entities — its whole-file spelling
#: of those carries an `ENDBLK` whose handle is zero, which no DXF reader admits), so that form is
#: tried next rather than refusing a drawing this toolchain can in fact convert.
_CONVERSION_FORMS: Final = (("whole", ()), ("minimal", ("-m",)))

#: Where the census pass is asked to write, inside the invocation's own scratch directory.
_CENSUS_JSON: Final = "census.json"

#: How many times the invocation's scratch is swept before the lane stops asking.
_SWEEPS: Final = 3


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

    deadline = Deadline.opening(toolchain.timeout_seconds)
    scratch = Path(tempfile.mkdtemp(prefix="vextrus-dwg-"))
    try:
        census = _census_pass(source, scratch, toolchain, deadline)
        converted, geometry = _geometry_pass(source, scratch, toolchain, deadline)
        # Asked last, and asked of the toolchain this call was given: by now both its programs have
        # done the work whose identity is being recorded (R-TO-001), and a program that will not
        # answer cannot be the reason the drawing outran its budget.
        version = tool_version(toolchain, source, room=_room(scratch, "version"), deadline=deadline)

        dxf_path = _placed(source, converted, out_dir)
    finally:
        _swept(scratch)

    return DwgConversion(
        dxf_path=dxf_path,
        census=census,
        geometry=geometry,
        refused=tuple(reconcile(census, geometry)),
        tool=TOOL,
        tool_version=version,
    )


def _census_pass(
    source: Path,
    scratch: Path,
    toolchain: Toolchain,
    deadline: Deadline,
) -> dict[str, dict[str, int]]:
    """`dwgread -O JSON`, tallied — or the drawing refused by name."""
    room = _room(scratch, "census")
    asked = room / _CENSUS_JSON
    program = toolchain.dwgread
    output = run_pass(
        program,
        [program, "-O", "JSON", "-o", str(asked), str(_drawing_in(room, source))],
        source=source,
        pass_name=CENSUS_PASS,
        room=room,
        deadline=deadline,
    )
    document = _census_document(source, program, room, asked, output)
    try:
        # `census_of` speaks about the document alone; the drawing, the pass and the program are
        # added here, where they are known, so every refusal this lane raises carries all four
        # (L-CAD-04). Whatever a document nothing wrote for this reader ends the read with is the
        # same fact about it — it is not a census — and is answered in words, not as a traceback.
        census = census_of(document)
    except Exception as error:
        raise DwgError(refusal(source, CENSUS_PASS, program, str(error))) from error
    if not census:
        raise DwgError(
            refusal(
                source,
                CENSUS_PASS,
                program,
                "named no entity at all, so there is nothing this conversion could be audited"
                f" against{quote(output.diagnostics)}",
            )
        )
    return census


def _census_document(source: Path, program: str, room: Path, asked: Path, output: PassOutput) -> Any:
    """The census document, from what the pass wrote — never from what it exited with.

    A census is looked for exactly as a conversion is: at the name the pass was given, then
    anywhere in the room it ran in, and last on the stdout `dwgread` prints a census to when it is
    given no name at all. Nothing else is a census: an empty answer, or one no parser admits,
    refuses the drawing by name (L-CAD-04).
    """
    written = _written(room, asked)
    text = ""
    if written is not None:
        try:
            text = written.read_text(encoding="utf-8", errors="replace")
        except OSError:
            # A file this process cannot read is a pass that wrote no census it can read; the
            # stdout convention is still owed its turn below.
            text = ""
    if not text.strip():
        text = output.stdout
    if not text.strip():
        raise DwgError(
            refusal(source, CENSUS_PASS, program, f"wrote no JSON{quote(output.diagnostics)}")
        )
    try:
        return _first_document(text)
    except Exception as error:
        raise DwgError(
            refusal(source, CENSUS_PASS, program, f"wrote a census no parser admits: {error}")
        ) from error


def _first_document(text: str) -> Any:
    """The JSON a pass wrote, whether or not it stopped writing when the document ended.

    A program that prints its census and then says something about it has still written a census,
    and L-CAD-04 judges a pass by what it wrote rather than by how tidily it stopped. Text that
    does not open on a JSON document is not a census, and the reader raises to say so.
    """
    try:
        return json.loads(text)
    except ValueError:
        document, _ = json.JSONDecoder().raw_decode(text.lstrip())
        return document


def _geometry_pass(
    source: Path,
    scratch: Path,
    toolchain: Toolchain,
    deadline: Deadline,
) -> tuple[Path, dict[str, dict[str, int]]]:
    """`dwg2dxf`, read back and tallied — or the drawing refused by name.

    Each attempt converts into a room of its own, so a converter that named its own output is still
    found and one attempt's leavings can never be read as another's.
    """
    problems: list[str] = []
    program = toolchain.dwg2dxf
    for form, flags in _CONVERSION_FORMS:
        room = _room(scratch, f"conversion-{form}")
        asked = room / f"{source.stem}.dxf"
        output = run_pass(
            program,
            [program, *flags, "-o", str(asked), str(_drawing_in(room, source))],
            source=source,
            pass_name=GEOMETRY_PASS,
            room=room,
            deadline=deadline,
        )
        converted = _written(room, asked)
        if converted is None:
            problems.append(f"the {form} conversion wrote no DXF{quote(output.diagnostics)}")
            continue
        try:
            return converted, geometry_tally(converted)
        except DwgError as error:
            problems.append(f"the {form} conversion: {error}")
    raise DwgError(refusal(source, GEOMETRY_PASS, program, "; ".join(problems)))


def _room(scratch: Path, name: str) -> Path:
    """A room of one pass's own inside the invocation's scratch directory."""
    room = scratch / name
    room.mkdir()
    return room


def _drawing_in(room: Path, source: Path) -> Path:
    """The drawing a pass reads: a copy in its own room, never the caller's file.

    A converter that writes beside the drawing it read, rather than where it was asked to, then
    writes inside the scratch that dies with this call — never beside the caller's own drawing,
    where the lane would both find nothing and leave something behind (L-CAD-04's stateless lane).
    """
    drawing = room / source.name
    try:
        shutil.copy2(source, drawing)
    except OSError as error:
        raise DwgError(f"{source.name} ({source}): the drawing cannot be read: {error}") from error
    return drawing


def _written(room: Path, asked: Path) -> Path | None:
    """What a pass actually produced. The exit code says nothing (L-CAD-04); this does.

    What was asked for is preferred; anything else of that kind the room holds is the pass's work
    all the same, because a program is judged by what it wrote and not by whether it agreed about
    the name — LibreDWG's own programs write beside the drawing they read, and into the directory
    they were started in, as readily as at the name they were given. Both passes ask this one
    question, keyed on the suffix each asked for.
    """
    if _holds_something(asked):
        return asked
    written = sorted(path for path in room.rglob(f"*{asked.suffix}") if _holds_something(path))
    return written[0] if written else None


def _holds_something(path: Path) -> bool:
    """A file with bytes in it. An empty one is a name a pass touched, not work it did."""
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def _placed(source: Path, converted: Path, out_dir: Path) -> Path:
    """The converted DXF, moved where the caller asked — the one thing this lane leaves behind.

    A directory that cannot be written is the drawing refused by name, and nothing of a refused
    conversion stays in it (L-CAD-04's loud failures, stateless lane).
    """
    dxf_path = out_dir / f"{source.stem}.dxf"
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        # `shutil.Error` alongside `OSError`: a move that cannot be made says so in a class of its
        # own, and neither belongs in a caller's traceback.
        shutil.move(str(converted), str(dxf_path))
    except (OSError, shutil.Error) as error:
        with contextlib.suppress(OSError):
            dxf_path.unlink(missing_ok=True)
        raise DwgError(
            f"{source.name} ({source}): the converted DXF cannot be placed at {dxf_path}: {error}"
        ) from error
    return dxf_path


def _swept(scratch: Path) -> None:
    """The invocation's scratch, gone — whatever happened inside it (L-CAD-04's stateless lane).

    A sweep that cannot finish is never the answer the caller receives: it must not replace the
    refusal that named the drawing, so the directory is asked for again rather than complained
    about. Every pass's session is ended before this runs, so nothing is still writing here.
    """
    for _ in range(_SWEEPS):
        shutil.rmtree(scratch, ignore_errors=True)
        if not scratch.exists():
            return
