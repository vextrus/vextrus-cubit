"""Ticket T-249 (PR A)'s invented keys and runs for the scorer's new diagnostics and `--agreement`:
24s's own writers (`t24s/runs.py`: `Place`, `key_sheet`, `export_sheet`), made-up sheets only.

The new diagnostic lines come after the existing `_diagnostic` block (whose last line is "subjects
outside the vocabulary: n") and before the totals (the lines holding " / "); `new_lines` reads them
there, so a test never depends on a heading's words the ticket does not give.
"""

import re

from tools.scorer.tests.acceptance.t24s.runs import (
    HEAD,
    RUN_ID,
    SET,
    Place,
    export_sheet,
    export_view,
    key_sheet,
    key_view,
)

__all__ = [
    "HEAD",
    "RUN_ID",
    "SET",
    "Place",
    "export_sheet",
    "export_view",
    "key_sheet",
    "key_view",
    "lines_after",
    "new_lines",
    "old_lines",
    "total",
]

LAST_OLD = "  subjects outside the vocabulary:"


def new_lines(output: str) -> list[str]:
    """The lines after the existing diagnostic block and before the totals."""
    lines = output.splitlines()
    starts = [n for n, line in enumerate(lines) if line.startswith(LAST_OLD)]
    assert len(starts) == 1, output
    found = []
    for line in lines[starts[0] + 1 :]:
        if " / " in line:
            break
        found.append(line)
    return found


def old_lines(output: str) -> list[str]:
    """The output with the new lines taken out: what main prints."""
    new = new_lines(output)
    lines = output.splitlines()
    start = next(n for n, line in enumerate(lines) if line.startswith(LAST_OLD)) + 1
    return lines[:start] + lines[start + len(new) :]


def lines_after(lines: list[str], heading: str) -> list[str]:
    """The lines indented under `heading` (four spaces), up to the next line indented less."""
    starts = [n for n, line in enumerate(lines) if line == heading]
    assert len(starts) == 1, lines
    found = []
    for line in lines[starts[0] + 1 :]:
        if not line.startswith("    "):
            break
        found.append(line)
    return found


def total(output: str, name: str, n: int, of: int) -> bool:
    """True when a line names `name` and gives `n / N` (as t24s reads a total)."""
    return (
        re.search(rf"(?im)^.*\b{re.escape(name)}\b.*(?<![\d/])\b{n} / {of}\b(?![\d/])", output)
        is not None
    )
