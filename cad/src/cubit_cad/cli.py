"""The one entry point: `python -m cubit_cad ingest <path> --out <path>` (SEAM-CAD).

"Stateless, temp-dir per invocation, loud failures, generous timeouts" (L-CAD-04). The
process is invoked once per drawing revision and holds nothing between invocations: the
artifact is built in a temp dir and moved into place in one step, so a failure of any kind
leaves nothing at `--out` for a caller to mistake for an answer.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

from .ingest import IngestError, ingest_dxf

#: The only format this increment's extractor speaks. Anything else is a loud refusal.
SUPPORTED_FORMAT = "dxf"

#: Exit codes: 0 is an artifact, 2 is a refusal that says why on stderr.
EXIT_OK = 0
EXIT_REFUSED = 2


def _refuse(message: str) -> int:
    print(f"cubit_cad: {message}", file=sys.stderr)
    return EXIT_REFUSED


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m cubit_cad",
        description="Turn one drawing into one EntityGraph v2 artifact, and stop.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    ingest = subcommands.add_parser("ingest", help="read a drawing and write its EntityGraph")
    ingest.add_argument("input", help="the drawing to read")
    ingest.add_argument("--out", required=True, help="where to write the EntityGraph JSON")
    ingest.add_argument(
        "--format",
        dest="drawing_format",
        default=None,
        help=f"the input format; only {SUPPORTED_FORMAT} is supported",
    )
    return parser


def _resolved_format(path: Path, declared: str | None) -> str:
    if declared is not None:
        return declared.lower()
    return path.suffix.lstrip(".").lower()


def run_ingest(input_path: str, out_path: str, declared_format: str | None) -> int:
    source = Path(input_path)
    drawing_format = _resolved_format(source, declared_format)
    if drawing_format != SUPPORTED_FORMAT:
        return _refuse(
            f"format {drawing_format or '(none)'} is not supported — this extractor reads "
            f"{SUPPORTED_FORMAT} only (DWG and PDF arrive with their own extractors)"
        )
    if not source.is_file():
        return _refuse(f"{source} is not a file")
    try:
        graph = ingest_dxf(source)
    except IngestError as error:
        return _refuse(str(error))

    destination = Path(out_path)
    with tempfile.TemporaryDirectory(prefix="cubit-cad-") as work:
        staged = Path(work) / "entitygraph.json"
        staged.write_text(json.dumps(graph, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        destination.parent.mkdir(parents=True, exist_ok=True)
        # `shutil.move`, not `Path.replace`: the temp dir and the destination need not
        # share a filesystem, and a cross-device rename would fail after the work is done.
        shutil.move(str(staged), str(destination))
    return EXIT_OK


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "ingest":
        return run_ingest(args.input, args.out, args.drawing_format)
    return _refuse(f"unknown command {args.command}")
