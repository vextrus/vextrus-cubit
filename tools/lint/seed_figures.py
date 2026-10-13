"""The seed-figure lint: a page's one seed table is the only place a figure is worked out.

Reads each page's seed table (the table headed `| Id | What | Derivation | Value |`) and fails on any
figure elsewhere on the page that cites a row of it and disagrees with the row's Value. A citation has
one of three shapes, where the id is the whole token (E1 is not E1b, and not the ticket name M1-20):

    <figure> (<id>)        13.31 cft (E1), ৳276.67 (R1)
    <id> <figure>          T6 7%, T1 ৳67,56,094
    <id> = <figure>        G1 = 37,800 sft

A copy may print fewer places than its row: the row's value is rounded to the nearest at the copy's
printed places before the two are compared (m1-screens 1.3). Grouping is not read: Indian and plain
grouping are one number. A row holding several values (`276.67; 308.17`) is agreed with by any of them.
The derivation column is not read. A page with no seed table passes.

    python3 -m tools.lint.seed_figures docs/design/m1-screens.md

Exit 0 when every citing copy agrees, 1 when one does not (one line each: `page:line`, the row, the
copy and the row's value), 2 when a page cannot be read.
"""

import re
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

NUMBER = r"\d+(?:,\d+)*(?:\.\d+)?"
IDENT = r"[A-Za-z][A-Za-z0-9]*"
PROSE_REF = r"(?:\bof|\bsee|§)\s*$"
# Written as escapes: the page prints the minus sign and the multiplication and division signs.
MINUS = "\u2212"
MULTIPLY = "\u00d7\u00f7*/"
SIGNS = ("+", MINUS, "-")
HEADER = ("id", "what", "derivation", "value")


@dataclass(frozen=True)
class Row:
    id: str
    values: tuple[str, ...]  # as the page prints them, grouping and all
    shown: str


def _cells(line: str) -> list[str]:
    return [cell.strip().replace("*", "").strip() for cell in line.strip().strip("|").split("|")]


def _number(text: str) -> str | None:
    found = re.search(NUMBER, text)
    return found.group(0) if found else None


def _values(cell: str) -> tuple[str, ...]:
    """The figures a Value cell stands for: each `;` part's result (after its last `=`), every number in
    it but a section number named by prose (`the level table of 6.2`)."""
    out: list[str] = []
    for part in cell.split(";"):
        result = part.rsplit("=", 1)[-1]
        out += [
            m.group(0)
            for m in re.finditer(NUMBER, result)
            if not re.search(PROSE_REF, result[: m.start()])
        ]
    return tuple(out)


def seed_rows(lines: Sequence[str]) -> tuple[dict[str, Row], set[int]]:
    """The rows of the seed table by id, and the (0-based) lines the table occupies."""
    rows: dict[str, Row] = {}
    taken: set[int] = set()
    index = 0
    while index < len(lines):
        if (
            lines[index].lstrip().startswith("|")
            and tuple(c.lower() for c in _cells(lines[index])) == HEADER
        ):
            taken.add(index)
            index += 1
            while index < len(lines) and lines[index].lstrip().startswith("|"):
                taken.add(index)
                cells = _cells(lines[index])
                if len(cells) >= 4 and cells[0] and re.fullmatch(r"[A-Za-z][A-Za-z0-9]*", cells[0]):
                    values = _values(cells[3])
                    if values:
                        rows[cells[0]] = Row(cells[0], values, cells[3])
                index += 1
        else:
            index += 1
    return rows, taken


def _places(figure: str) -> int:
    return len(figure.split(".")[1]) if "." in figure else 0


def _agrees(copy: str, values: tuple[str, ...]) -> bool:
    places = _places(copy)
    want = Decimal(copy.replace(",", ""))
    quantum = Decimal(1).scaleb(-places)
    return any(
        Decimal(v.replace(",", "")).quantize(quantum, rounding=ROUND_HALF_UP) == want for v in values
    )


def _part_before(text: str, start: int) -> bool:
    """The figure at `start` is a signed change or an operand or result of a working: `+৳47,880.00`,
    `42,000 sft x 170.00 = ৳71,40,000.00`. Such a copy is a part of a row, not the row's figure."""
    before = text[:start].rstrip(" ৳$")
    if before.endswith((*SIGNS, *MULTIPLY)):
        return True
    return before.endswith("=") and re.search(f"[{MULTIPLY}+]", before) is not None


def _operand_after(text: str, end: int) -> bool:
    return re.match(rf"%?(?:\s+[A-Za-z]+)?\s*[{MULTIPLY}]", text[end:]) is not None


def _citations(text: str, ids: Sequence[str]) -> list[tuple[tuple[str, ...], str, int]]:
    """(the rows cited, the copy's figure, where it starts) for each citation in `text`."""
    out: list[tuple[tuple[str, ...], str, int]] = []
    known = set(ids)
    listed = rf"\(\s*({IDENT}(?:\s*[,;]\s*{IDENT})*)\s*\)"
    for found in re.finditer(rf"(?<![A-Za-z0-9.,])({NUMBER})%?(?:\s+[A-Za-z]+){{0,3}}\s*{listed}", text):
        rows = tuple(i for i in re.split(r"\s*[,;]\s*", found.group(2)) if i in known)
        if rows and not _part_before(text, found.start(1)):
            out.append((rows, found.group(1), found.start(1)))
    for row_id in ids:
        token = rf"(?<![A-Za-z0-9-]){re.escape(row_id)}(?![A-Za-z0-9-])"
        for found in re.finditer(rf"{token}(?:\s*=\s*|\s+)[৳$]?\s*({NUMBER})", text):
            if re.search(rf"[+{MINUS}{MULTIPLY}]\s*$", text[: found.start()]) or _operand_after(
                text, found.end()
            ):
                continue
            if text[: found.start(1)].rstrip(" ৳$").endswith(SIGNS):
                continue
            out.append(((row_id,), found.group(1), found.start(1)))
    return out


def _joined(lines: Sequence[str], number: int) -> str:
    """Line `number`, with the next line after it when the paragraph wraps."""
    line = lines[number]
    follow = lines[number + 1] if number + 1 < len(lines) else ""
    if not line.strip() or line.lstrip().startswith(("|", "#", "```")):
        return line
    if not follow.strip() or follow.lstrip().startswith(("|", "#", "```")):
        return line
    return line + " " + follow.strip()


def check(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    rows, taken = seed_rows(lines)
    if not rows:
        return []
    ids = sorted(rows, key=len, reverse=True)
    plain = [line.replace("**", "") for line in lines]
    findings: list[tuple[int, int, str]] = []
    fenced = False
    for number, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            fenced = not fenced
            continue
        if fenced or number in taken:
            continue
        text = _joined(plain, number)
        for cited, copy, start in _citations(text, ids):
            if start >= len(plain[number]):
                continue
            values = tuple(v for i in cited for v in rows[i].values)
            if not _agrees(copy, values):
                message = (
                    f"{path}:{number + 1}: row {', '.join(cited)}: the copy reads {copy} but the seed "
                    f"table's value is {'; '.join(dict.fromkeys(values))}"
                )
                findings.append((number, start, message))
    return [message for _, _, message in sorted(findings)]


def main(argv: Sequence[str] | None = None) -> int:
    pages = list(sys.argv[1:] if argv is None else argv)
    if not pages:
        print("usage: python3 -m tools.lint.seed_figures <page>...", file=sys.stderr)
        return 2
    failed = False
    unreadable = False
    for name in pages:
        path = Path(name)
        try:
            findings = check(path)
        except (OSError, UnicodeDecodeError) as error:
            print(f"{name}: cannot be read ({error})", file=sys.stderr)
            unreadable = True
            continue
        for finding in findings:
            print(finding)
        failed = failed or bool(findings)
    return 2 if unreadable else int(failed)


if __name__ == "__main__":
    sys.exit(main())
