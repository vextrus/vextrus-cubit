"""Ticket S25-SEEDLINT (#762): synthetic pages in the shape of docs/design/m1-screens.md, one seed table
(6.1's heading and its `| Id | What | Derivation | Value |` header) and figures elsewhere that cite its
rows. Everything here is invented; no figure is the real page's.

The command under test: `python -m tools.lint.seed_figures <page>...`, from any folder: exit 0 when
every figure that cites a seed row agrees with the row under the page's rounding, 1 when one does not,
each finding printed on one line naming `<file>:<line>`, the row's id, the copy's figure and the
row's value.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

MODULE = "tools.lint.seed_figures"
ROOT = Path(__file__).resolve().parents[5]

SEED = """\
### 6.1 KR-99's quantities (the one table)
| Id | What | Derivation | Value |
|---|---|---|---|
| **Given** | | | |
| G1 | Gross Floor Area | entered | 42,000 sft |
| G3 | Columns on the schedule | 11 per storey by 10 storeys | 110 |
| **Per element** | | | |
| E1 | Column concrete | 10 in by 20 in = 1.3889 sft by 9 ft 7 in | 13.31 cft |
| E1b | Column concrete, 10 in by 24 in | 10 in by 24 in = 1.6667 sft by 9 ft 7 in | 15.97 cft |
| **Rates** (৳) | | | |
| R1 | RCC per cft | the Rate Analysis; outside the contract + 31.50 casting labour | 276.67; 308.17 |
| **Totals** | | | |
| **T1** | **Measured** | M1 to M14 | **67,56,093.82** |
| **T2** | **Awaiting answer** | W1 to W3 | **1,31,378.85** |
| A4a | Steps 9 to 14, priced from B.4 | 1,701 per sft by G1 | 7,14,42,000.00 |
| T5 | Per sft | T4 ÷ G1 | 2,668.20 |
| T6 | Measured share | T1 ÷ T4 | 6.03% |
| X9 | Plain grouping | entered | 131378.85 |

"""


def page(*lines: str) -> str:
    """A page: a heading and prose, the seed table, then `lines`, one per line, after a blank line."""
    head = "# KR-99's screens\n\n## 1. Figures\n\nEvery figure cites its row.\n\n## 6. The seed\n\n"
    return head + SEED + "### 6.2 Elsewhere\n\n" + "".join(f"{line}\n" for line in lines)


def write(folder: Path, text: str, name: str = "page.md") -> Path:
    path = folder / name
    path.write_text(text, encoding="utf-8")
    return path


def line_of(text: str, needle: str) -> int:
    """The 1-based line of `text` holding `needle` (once)."""
    found = [number for number, line in enumerate(text.splitlines(), 1) if needle in line]
    assert len(found) == 1, f"the test's page holds {needle!r} on lines {found}"
    return found[0]


def command(folder: Path, *args: str) -> tuple[int, str]:
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    done = subprocess.run(
        [sys.executable, "-m", MODULE, *args], cwd=folder, env=env, capture_output=True, text=True
    )
    return done.returncode, done.stdout + done.stderr


def _has(rest: str, figure: str) -> bool:
    return re.search(rf"(?<![\d.,]){re.escape(figure)}(?![\d,]|\.\d)", rest) is not None


def naming(output: str, name: str, line: int, row: str, copy: str, value: str) -> bool:
    """One line of `output` names `<name>:<line>`, the row's id as a word, the copy's figure and the
    row's value as the page prints them (the location itself is not read for the figures)."""
    where = re.compile(rf"{re.escape(name)}:{line}(?!\d)")
    for text in output.splitlines():
        match = where.search(text)
        if match is None:
            continue
        rest = text[: match.start()] + " " + text[match.end() :]
        if (
            re.search(rf"(?<![A-Za-z0-9-]){re.escape(row)}(?![A-Za-z0-9-])", rest)
            and _has(rest, copy)
            and _has(rest, value)
        ):
            return True
    return False
