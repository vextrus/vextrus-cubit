"""`vextrus-cad` — the one-shot extraction command (L-CAD-01).

One drawing revision in, one EntityGraph artifact out, then the process ends: stateless, a temp
directory per invocation, loud failures (L-CAD-04). `ingest` is the only subcommand, and the file's
own bytes decide its lane: a DWG converts through LibreDWG and reads as DXF, a PDF reads through
pdfium (R-TO-002), a PNG, JPEG or TIFF is traced by the pinned vectoriser (R-TO-003), and anything
else is read as DXF — or refused by name as one.

Where the run traced a picture, the page raster its lines were taken from is written beside the
artifact as `<sha256>.png`, the name the artifact's `rasters[]` record gives it (I-584): one
drawing revision in, and out the EntityGraph and the very pixels its traced keys were read from.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

from . import report
from .dwg import DwgError, convert_dwg, losses_by_space
from .ingest import IngestError, ingest_dxf
from .model import EntityGraphError, parse_entity_graph
from .pdf import ingest_pdf
from .raster import RASTER_SUFFIXES, ingest_raster, is_raster
from .serialise import write_artifact

#: Nothing was written, and the drawing was named on stderr.
EXIT_REFUSED = 2


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vextrus-cad",
        description="Turn a drawing file into one EntityGraph artifact, and stop.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    ingest = subcommands.add_parser(
        "ingest", help="ingest a DXF, DWG, PDF, PNG, JPEG or TIFF file into an EntityGraph artifact"
    )
    ingest.add_argument("input", help="the drawing to read")
    ingest.add_argument("--out", required=True, help="where to write the EntityGraph artifact")
    return parser


def _is_dwg(path: Path) -> bool:
    if path.suffix.lower() == ".dwg":
        return True
    try:
        with path.open("rb") as stream:
            magic = stream.read(6)
            return magic.startswith(b"AC")
    except OSError:
        return False


#: A PDF's header, which the format allows anywhere in the file's first kilobyte (ISO 32000-1 7.5.2).
_PDF_MAGIC = b"%PDF-"
_PDF_HEADER_WINDOW = 1024


def _is_pdf(path: Path) -> bool:
    """A PDF is known by its header, never by its name alone: a `.pdf` that is not one is refused by
    pdfium under its own name (PDF_UNREADABLE), and a PDF uploaded under another name still reads."""
    if path.suffix.lower() == ".pdf":
        return True
    try:
        with path.open("rb") as stream:
            return _PDF_MAGIC in stream.read(_PDF_HEADER_WINDOW)
    except OSError:
        return False


def _is_raster(path: Path) -> bool:
    """A scan is known by its magic number, or by its name where the bytes cannot be read: a `.png`
    that is not one is refused by OpenCV under its own name (RASTER_UNREADABLE)."""
    try:
        with path.open("rb") as stream:
            if is_raster(stream.read(8)):
                return True
    except OSError:
        pass
    return path.suffix.lower() in RASTER_SUFFIXES


#: What a page raster is written under beside the artifact: its sha256, then this.
PAGE_RASTER_SUFFIX = ".png"


def _said(notes: report.Report) -> None:
    """Every note of this run on stderr, one named line each (L-CAD-04: never a silent loss).

    The report travels beside the artifact rather than inside it, and this command's own stream is
    where it travels: a caller two processes away reads a line whose left half is a code from the
    closed table in `report.py`. Said before any refusal, so a caller that keeps only the TAIL of
    this stream — `src/modules/takeoff/ingest/cli.ts` keeps 4,000 characters of it — keeps the
    verdict that names the drawing.
    """
    for line in notes.lines():
        print(f"{report.NOTE_PREFIX}{line}", file=sys.stderr)


def _ingest(source: str, destination: str) -> int:
    source_path = Path(source)
    notes = report.Report()
    rasters: dict[str, bytes] = {}
    try:
        if _is_dwg(source_path):
            with tempfile.TemporaryDirectory(prefix=".vextrus-dwg-") as scratch:
                conversion = convert_dwg(source_path, Path(scratch))
                healed = conversion.rejoined_lines + conversion.reordered_texts
                if healed:
                    notes.add(
                        report.REJOINED_WRAPPED_TEXT,
                        f"{conversion.rejoined_lines} wrapped text lines rejoined,"
                        f" {conversion.reordered_texts} MTEXT chunk runs re-coded",
                        healed,
                    )
                if conversion.drawn_dimensions:
                    notes.add(
                        report.DREW_DIMENSION_PICTURES,
                        f"{conversion.drawn_dimensions} dimensions carried no picture, and each was"
                        " drawn from its own definition",
                        conversion.drawn_dimensions,
                    )
                # A class the two passes disagreed about is refused on that sheet and not the sheet
                # itself (L-CAD-04): it is named here, once per class per space, and carried onto
                # the artifact's counters — a drawing that still yields geometry is an ingest, and
                # an ingest whose losses nobody is told about is the silent one this lane forbids.
                for refused in conversion.refused:
                    notes.add(refused.note_code(), refused.detail(), refused.lost)
                artifact = ingest_dxf(
                    conversion.dxf_path, notes, losses_by_space(conversion.refused)
                )
        elif _is_pdf(source_path):
            artifact = ingest_pdf(source_path, notes, rasters)
        elif _is_raster(source_path):
            artifact = ingest_raster(source_path, notes, rasters)
        else:
            artifact = ingest_dxf(source_path, notes)
        # The artifact is the whole hand-off across the seam (L-CAD-05), so the extractor reads its
        # own output through the mirror before pinning it as a revision: a drawing that mints one
        # handle twice, or an attribute with no tag, is a drawing this extractor cannot represent,
        # and refusing it by name beats writing a file neither mirror will parse (L-CAD-02).
        parse_entity_graph(artifact)
    except (DwgError, IngestError, EntityGraphError) as error:
        # The notes stand whatever the ending: what a conversion lost is true of the drawing whether
        # or not the ingest after it could write an artifact.
        _said(notes)
        print(f"vextrus-cad: cannot ingest {source}: {error}", file=sys.stderr)
        return EXIT_REFUSED

    out = Path(destination)
    parent = out.parent if str(out.parent) else Path(".")
    try:
        parent.mkdir(parents=True, exist_ok=True)
        # Staged in a temp directory beside the destination, so a failed write leaves --out
        # untouched and the move onto it is atomic.
        with tempfile.TemporaryDirectory(dir=parent, prefix=".vextrus-cad-") as scratch:
            # The page rasters land first, so an artifact that stands always has its pixels beside it.
            for digest, data in sorted(rasters.items()):
                page_raster = Path(scratch) / f"{digest}{PAGE_RASTER_SUFFIX}"
                page_raster.write_bytes(data)
                os.replace(page_raster, parent / page_raster.name)
            staged = Path(scratch) / "artifact.json"
            write_artifact(staged, artifact)
            os.replace(staged, out)
    except OSError as error:
        # A destination this invocation cannot write — a directory in the way, an unwritable parent,
        # a full disk — ends the run the same loud way an unreadable drawing does (L-CAD-04): named
        # on stderr, non-zero, `--out` as it stood. A traceback names cli.py where the operator needs
        # the drawing and the destination, and the staging directory is cleaned up on the way out.
        _said(notes)
        print(
            f"vextrus-cad: cannot write the artifact for {source} to {destination}: {error}",
            file=sys.stderr,
        )
        return EXIT_REFUSED
    _said(notes)
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    return _ingest(arguments.input, arguments.out)


if __name__ == "__main__":  # pragma: no cover - module entry point
    sys.exit(main())
