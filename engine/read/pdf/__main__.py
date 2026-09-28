"""The report on one PDF, for a local session reading a real Drawing Set (ticket 12's local step):

    uv run --no-sync python -m engine.read.pdf <file.pdf> [--text]

prints the report's messages (codes and parameters), its counts, and a line per page; `--text` adds
each page's text items. It reads in the sandbox, as the product does. Drawing text is printed, so run
it only on the owner's machine and never paste its output into an issue or a PR.
"""

import argparse
import json
import sys
from pathlib import Path

from engine.read.errors import ReadError
from engine.read.pdf import page_text, report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m engine.read.pdf", description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--text", action="store_true", help="print each page's text items too")
    options = parser.parse_args(argv)
    try:
        found = report(options.pdf)
        pages = page_text(options.pdf)
    except ReadError as error:
        print(json.dumps({"refused": error.message}))
        return 1
    for message in found.messages:
        print(json.dumps(message, ensure_ascii=False))
    print(json.dumps(found.counts))
    for page, text in zip(found.pages, pages, strict=True):
        print(
            f"page {page.number}: turned {page.rotate}, {page.width:.0f} x {page.height:.0f} pt, "
            f"{page.shx_comments} comments, {page.chars} glyphs, {page.hidden_chars} hidden, "
            f"{page.strokes} strokes, pictures {page.picture_share:.1%}, lettering {page.lettering}, "
            f"{'scan, ' if page.scan else ''}{len(text.items)} text items"
        )
        if options.text:
            for item in text.items:
                x0, y0, x1, y1 = item.anchor.box
                where = f"#{item.anchor.path_index} ({x0:.1f}, {y0:.1f}, {x1:.1f}, {y1:.1f})"
                print(f"    {item.source:<12} {where} {item.text!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
