"""`vextrus-cad` — the one-shot extraction command (L-CAD-01).

One drawing revision in, one EntityGraph artifact out, then the process ends: stateless, a temp
directory per invocation, loud failures (L-CAD-04). `ingest` is the only subcommand.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

from .ingest import IngestError, ingest_dxf
from .model import EntityGraphError, parse_entity_graph
from .serialise import write_artifact

#: Nothing was written, and the drawing was named on stderr.
EXIT_REFUSED = 2


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vextrus-cad",
        description="Turn a drawing file into one EntityGraph artifact, and stop.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    ingest = subcommands.add_parser("ingest", help="ingest a DXF file into an EntityGraph artifact")
    ingest.add_argument("input", help="the drawing to read")
    ingest.add_argument("--out", required=True, help="where to write the EntityGraph artifact")
    return parser


def _ingest(source: str, destination: str) -> int:
    try:
        artifact = ingest_dxf(Path(source))
        # The artifact is the whole hand-off across the seam (L-CAD-05), so the extractor reads its
        # own output through the mirror before pinning it as a revision: a drawing that mints one
        # handle twice, or an attribute with no tag, is a drawing this extractor cannot represent,
        # and refusing it by name beats writing a file neither mirror will parse (L-CAD-02).
        parse_entity_graph(artifact)
    except (IngestError, EntityGraphError) as error:
        print(f"vextrus-cad: cannot ingest {source}: {error}", file=sys.stderr)
        return EXIT_REFUSED

    out = Path(destination)
    parent = out.parent if str(out.parent) else Path(".")
    try:
        parent.mkdir(parents=True, exist_ok=True)
        # Staged in a temp directory beside the destination, so a failed write leaves --out
        # untouched and the move onto it is atomic.
        with tempfile.TemporaryDirectory(dir=parent, prefix=".vextrus-cad-") as scratch:
            staged = Path(scratch) / "artifact.json"
            write_artifact(staged, artifact)
            os.replace(staged, out)
    except OSError as error:
        # A destination this invocation cannot write — a directory in the way, an unwritable parent,
        # a full disk — ends the run the same loud way an unreadable drawing does (L-CAD-04): named
        # on stderr, non-zero, `--out` as it stood. A traceback names cli.py where the operator needs
        # the drawing and the destination, and the staging directory is cleaned up on the way out.
        print(
            f"vextrus-cad: cannot write the artifact for {source} to {destination}: {error}",
            file=sys.stderr,
        )
        return EXIT_REFUSED
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    return _ingest(arguments.input, arguments.out)


if __name__ == "__main__":  # pragma: no cover - module entry point
    sys.exit(main())
