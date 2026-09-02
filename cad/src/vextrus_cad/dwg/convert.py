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
import os
import re
import shutil
import tempfile
from collections.abc import Iterator
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

#: What a DXF printed to stdout opens with: the group code 0 and then a SECTION.
_SPOKEN_DXF: Final = re.compile(r"^[ \t]*0[ \t]*\r?\n[ \t]*SECTION[ \t]*\r?$", re.MULTILINE)

#: Where a JSON document can open.
_OPENS_JSON: Final = re.compile(r"[{\[]")

#: Where each pass keeps its copy of the drawing: a room of its own, so the name the pass is asked
#: to write at can never be the drawing it reads.
_DRAWING_ROOM: Final = "drawing"


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
    drawing = _drawing_in(room, source)
    output = run_pass(
        program,
        [program, "-O", "JSON", "-o", str(asked), str(drawing)],
        source=source,
        pass_name=CENSUS_PASS,
        room=room,
        deadline=deadline,
    )
    census = _census_tally(source, program, _written(room, asked, drawing), output)
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


def _census_tally(
    source: Path,
    program: str,
    written: list[Path],
    output: PassOutput,
) -> dict[str, dict[str, int]]:
    """The census, tallied from what the pass wrote — never from what it exited with.

    A census is looked for exactly as a conversion is: at the name the pass was given, then
    anywhere in the room it ran in, and last on the stdout `dwgread` prints a census to when it is
    given no name at all. Each place may hold several JSON documents — a greeting that is itself
    one (`[1]`, `{}`), a leaving of the pass's own — so the first document `census_of` admits is
    the census, just as the first DXF a reader admits is the conversion; one it rejects is not a
    census and the next is owed its turn. Nothing else is a census, and an empty answer, or one
    holding no census at all, refuses the drawing by name (L-CAD-04). `census_of` speaks about the
    document alone; the drawing, the pass and the program are added here, where they are known,
    so the refusal carries all four, in words and not as a traceback.
    """
    texts: list[str] = []
    for path in written:
        with contextlib.suppress(OSError):
            # A file this process cannot read is a pass that wrote no census it can read; the
            # next place a census may be is still owed its turn.
            texts.append(path.read_text(encoding="utf-8", errors="replace"))
    texts.append(output.stdout)
    texts = [text for text in texts if text.strip()]
    if not texts:
        raise DwgError(
            refusal(source, CENSUS_PASS, program, f"wrote no JSON{quote(output.diagnostics)}")
        )
    rejections: list[str] = []
    for text in texts:
        for document in _documents(text):
            try:
                return census_of(document)
            except Exception as error:
                rejections.append(str(error))
    if not rejections:
        raise DwgError(
            refusal(
                source,
                CENSUS_PASS,
                program,
                "wrote a census no parser admits: no JSON document opens in what it wrote"
                f"{quote(output.diagnostics)}",
            )
        )
    # The document that failed is the last one rejected: a greeting that is itself JSON (`[1]`,
    # `{}`) is rejected first and the census after it, so the refusal names the census, not the
    # greeting, and says what it was — a document that parsed and was not a census.
    raise DwgError(
        refusal(
            source,
            CENSUS_PASS,
            program,
            f"wrote JSON that is not a census: {rejections[-1]}",
        )
    )


def _documents(text: str) -> Iterator[Any]:
    """Every JSON document a pass wrote, in order, however untidily it began or stopped.

    A program that says something before or after its census has still written a census, and
    L-CAD-04 judges a pass by what it wrote rather than by how tidily it began or stopped. A
    greeting may itself carry a brace or a bracket (`[INFO]`, `{basic.dwg}`), so every place a
    document could open is tried in turn; a document that parses is yielded and the scan resumes
    where it ended, and a failed try is skipped past to where the parser stopped, so a bracket
    inside a document that is not one is never re-read — one walk over the text, however chatty.
    """
    decoder = json.JSONDecoder()
    position = 0
    while (opens := _OPENS_JSON.search(text, position)) is not None:
        try:
            document, position = decoder.raw_decode(text, opens.start())
        except json.JSONDecodeError as error:
            position = max(error.pos, opens.start() + 1)
            continue
        yield document


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
        drawing = _drawing_in(room, source)
        output = run_pass(
            program,
            [program, *flags, "-o", str(asked), str(drawing)],
            source=source,
            pass_name=GEOMETRY_PASS,
            room=room,
            deadline=deadline,
        )
        written = _written(room, asked, drawing) or _spoken_dxf(asked, output)
        if not written:
            problems.append(f"the {form} conversion wrote no DXF{quote(output.diagnostics)}")
            continue
        # The first DXF a reader admits is the conversion: a room can hold the pass's leavings
        # beside its work, and a name that sorts first is not evidence of anything.
        for converted in written:
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
    drawing = room / _DRAWING_ROOM / source.name
    try:
        drawing.parent.mkdir()
        shutil.copy2(source, drawing)
    except OSError as error:
        raise DwgError(f"{source.name} ({source}): the drawing cannot be read: {error}") from error
    return drawing


def _written(room: Path, asked: Path, drawing: Path) -> list[Path]:
    """What a pass actually produced. The exit code says nothing (L-CAD-04); this does.

    What was asked for comes first; anything else of that kind the room holds is the pass's work
    all the same, because a program is judged by what it wrote and not by whether it agreed about
    the name — LibreDWG's own programs write beside the drawing they read, and into the directory
    they were started in, as readily as at the name they were given. Both passes ask this one
    question, keyed on the suffix each asked for. The drawing's own copy is never the answer,
    whatever suffix the caller's drawing happens to carry.
    """
    written = [asked] if _holds_something(asked) else []
    written += sorted(
        path
        for path in room.rglob(f"*{asked.suffix}")
        if path != asked and path != drawing and _holds_something(path)
    )
    return written


def _spoken_dxf(asked: Path, output: PassOutput) -> list[Path]:
    """A conversion the pass printed rather than wrote, kept at the name it was asked for.

    LibreDWG's readers answer on stdout when given no name to write to, so a converter that did the
    same has still converted the drawing (L-CAD-04 judges the artifact, not the convention). Only
    text that opens a DXF section is taken to be one; a program's chatter is not, and what it said
    before the section opened is left out of the file — the way a greeting before a census is.
    """
    opens = _SPOKEN_DXF.search(output.stdout)
    if opens is None:
        return []
    try:
        asked.write_text(output.stdout[opens.start() :].lstrip(), encoding="utf-8")
    except OSError:
        return []
    return [asked]


def _holds_something(path: Path) -> bool:
    """A file with bytes in it. An empty one is a name a pass touched, not work it did."""
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def _placed(source: Path, converted: Path, out_dir: Path) -> Path:
    """The converted DXF, moved where the caller asked — the one thing this lane leaves behind.

    A directory that cannot be written is the drawing refused by name, and nothing of a refused
    conversion stays in it (L-CAD-04's loud failures, stateless lane): the DXF is staged under a
    name of its own and takes the asked-for name in one step, so whatever the caller already held
    at that name is either replaced whole or left exactly as it was. A directory at that name is
    not a place a DXF can be, and refuses the drawing rather than being written into.
    """
    dxf_path = out_dir / f"{source.stem}.dxf"
    if dxf_path.is_dir():
        raise DwgError(
            f"{source.name} ({source}): the converted DXF cannot be placed at {dxf_path}:"
            " there is a directory at that name"
        )
    staged: Path | None = None
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        handle, name = tempfile.mkstemp(prefix=f".{source.stem}.", suffix=".dxf", dir=out_dir)
        os.close(handle)
        staged = Path(name)
        # `shutil.Error` alongside `OSError`: a move that cannot be made says so in a class of its
        # own, and neither belongs in a caller's traceback.
        shutil.move(str(converted), str(staged))
        os.replace(staged, dxf_path)
    except (OSError, shutil.Error) as error:
        if staged is not None:
            with contextlib.suppress(OSError):
                staged.unlink(missing_ok=True)
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
