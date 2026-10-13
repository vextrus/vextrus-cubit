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
PROSE_REF = r"(?:\bof|\bsee|\u00a7)\s*$"
# Written as escapes: the page prints the minus sign and the multiplication and division signs.
MINUS = "\u2212"
TIMES = "\u00d7\u00f7"
# A word after a figure that is not a unit; `lakh` and `crore` are short forms, never compared.
FILLER = {"per", "of", "in", "on", "and", "to", "at", "by", "is", "the", "a"}
SHORT_FORMS = {"lakh", "crore"}
# A real unit: a copy in one the row does not hold is another measure of the thing, never compared.
# Any other word after a figure (`covers`, `columns`) is prose, and the copy is a unitless one.
REAL_UNITS = {
    "%", "sft", "sqft", "cft", "cuft", "sqm", "cum", "ft", "inch", "mm", "cm", "m", "km", "rft",
    "ton", "tons", "tonne", "tonnes", "kg", "mt", "kn", "mpa", "psi", "ltr", "litre", "bag", "bags",
    "nos", "pcs",
}  # fmt: skip
HEADER = ("id", "what", "derivation", "value")
LIST_ITEM = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")
WORKING = re.compile(rf"[{TIMES}+]|/(?![A-Za-z])")


@dataclass(frozen=True)
class Row:
    id: str
    values: tuple[tuple[str, str], ...]  # (figure as printed, its unit: `%`, a word, or "")


def _unit(after: str) -> str:
    """The unit right after a figure: `%`, the word that follows it, or "" (a rate's `/sft` is none)."""
    if after.startswith("%"):
        return "%"
    word = re.match(r"\s+([A-Za-z]+)", after)
    found = word.group(1).lower() if word else ""
    return "" if found in FILLER else found


def _cells(line: str) -> list[str]:
    return [cell.strip().replace("*", "").strip() for cell in line.strip().strip("|").split("|")]


def _values(cell: str) -> tuple[tuple[str, str], ...]:
    """A Value cell's figures: those after the last `=` of each result, a result ending at a `;` that
    follows an `=` (`dry = 276.67; wet = 308.17` holds two), else all of them, but for a section number
    named by prose (`the level table of 6.2`)."""
    results: list[str] = []
    for part in cell.split(";"):
        if results and "=" not in results[-1]:
            results[-1] += ";" + part
        else:
            results.append(part)
    return tuple(
        (m.group(0), _unit(result[m.end() :]))
        for result in (r.rsplit("=", 1)[-1] for r in results)
        for m in re.finditer(NUMBER, result)
        if not re.search(PROSE_REF, result[: m.start()])
    )


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
                if len(cells) >= 4 and cells[0] and re.fullmatch(IDENT, cells[0]):
                    values = _values(cells[3])
                    if values:
                        rows[cells[0]] = Row(cells[0], values)
                index += 1
        else:
            index += 1
    return rows, taken


def _agrees(copy: str, unit: str, values: tuple[tuple[str, str], ...]) -> bool:
    """The copy against the row's figures. A copy without a unit, or in a word that is no unit, is
    compared with all of them (it may drop the unit the row carries); one in a real unit, with the
    row's figures in that unit, and is not compared when the row holds none in it."""
    if unit in SHORT_FORMS:
        return True
    if unit not in REAL_UNITS:
        pool = [n for n, _ in values]
    else:
        pool = [n for n, u in values if u == unit]
        if not pool and not any(u in REAL_UNITS for _, u in values):
            pool = [n for n, _ in values]
    places = len(copy.split(".")[1]) if "." in copy else 0
    quantum = Decimal(1).scaleb(-places)
    want = Decimal(copy.replace(",", ""))
    return not pool or any(
        Decimal(n.replace(",", "")).quantize(quantum, rounding=ROUND_HALF_UP) == want for n in pool
    )


def _clause(text: str) -> str:
    """The clause that ends `text`: closed parentheses are dropped (but one that ends the text, a
    working's own bracket), then it begins after the last `;`, `(`, comma, sentence end or colon."""
    while (shorter := re.sub(r"\([^()]*\)(?!\s*$)", " ", text)) != text:
        text = shorter
    return re.split(r";|\(|,\s|:\s|\.\s", text)[-1]


def _part_before(text: str, start: int) -> bool:
    """The figure at `start` is a signed change, an operand, or the result of a working (a clause with
    an operator before the `=`); such a copy is a part of a row, not the row's figure."""
    before = text[:start]
    if re.search(rf"[+{MINUS}-][\u09f3$]?$", before):
        return True
    before = before.rstrip(" \u09f3$")
    if re.search(rf"[{TIMES}+]$|/$", before):
        return True
    if before.endswith("="):
        return WORKING.search(_clause(before[:-1])) is not None
    return False


def _operand_after(text: str, end: int) -> bool:
    return re.match(rf"\s*(?:[{TIMES}]|/(?![A-Za-z]))", text[end:]) is not None


def _citations(text: str, ids: Sequence[str]) -> list[tuple[tuple[str, ...], str, str, int]]:
    """(the rows cited, the copy's figure, its unit, where it starts) for each citation in `text`."""
    out: list[tuple[tuple[str, ...], str, str, int]] = []
    known = set(ids)
    listed = rf"\(\s*({IDENT}(?:\s*[,;]\s*{IDENT})*)\s*\)"
    shape = rf"(?<![A-Za-z0-9.,])({NUMBER})(%|/[A-Za-z]+)?((?:\s+[A-Za-z]+){{0,3}})\s*{listed}"
    for found in re.finditer(shape, text):
        rows = tuple(i for i in re.split(r"\s*[,;]\s*", found.group(4)) if i in known)
        if rows and not _part_before(text, found.start(1)):
            unit = _unit(found.group(2) or found.group(3))
            out.append((rows, found.group(1), unit, found.start(1)))
    for row_id in ids:
        token = rf"(?<![A-Za-z0-9-]){re.escape(row_id)}(?![A-Za-z0-9-])"
        for found in re.finditer(rf"{token}(?:\s*=\s*|\s+)[\u09f3$]?\s*({NUMBER})(%|/[A-Za-z]+)?", text):
            before = text[: found.start()]
            if re.search(rf"[{TIMES}+/{MINUS}]\s*$|\s-\s*$", before) or _operand_after(
                text, found.end()
            ):
                continue
            if re.search(rf"[+{MINUS}-][\u09f3$]?$", text[: found.start(1)]):
                continue
            unit = _unit(found.group(2) or text[found.end() :])
            out.append(((row_id,), found.group(1), unit, found.start(1)))
    return out


def _paragraphs(lines: Sequence[str], skip: set[int]) -> list[tuple[str, list[tuple[int, int]]]]:
    """Each paragraph of the page as one text (list markers, bold and italics stripped, wrapped lines
    joined), with the (offset, line) where each of its lines starts. A heading, a table row and a list
    item start a paragraph of their own; the seed table and fenced blocks are left out."""
    out: list[tuple[str, list[tuple[int, int]]]] = []
    text = ""
    starts: list[tuple[int, int]] = []
    fenced = False

    def flush() -> None:
        nonlocal text, starts
        if text:
            out.append((text, starts))
        text, starts = "", []

    for number, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            flush()
            fenced = not fenced
            continue
        if fenced or number in skip or not line.strip():
            flush()
            continue
        item = LIST_ITEM.match(line)
        body = line[item.end() :] if item else line
        body = body.replace("*", "").strip()
        alone = body.startswith(("|", "#"))
        if item or alone:
            flush()
        starts.append((len(text) + (1 if text else 0), number))
        text = f"{text} {body}" if text else body
        if alone:
            flush()
    flush()
    return out


def check(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    rows, taken = seed_rows(lines)
    if not rows:
        return []
    ids = sorted(rows, key=len, reverse=True)
    findings: list[tuple[int, int, str]] = []
    for text, starts in _paragraphs(lines, taken):
        for cited, copy, unit, start in _citations(text, ids):
            number = [line for offset, line in starts if offset <= start][-1]
            values = tuple(v for i in cited for v in rows[i].values)
            if not _agrees(copy, unit, values):
                shown = "; ".join(dict.fromkeys(n for n, _ in values))
                message = (
                    f"{path}:{number + 1}: row {', '.join(cited)}: the copy reads {copy} but the seed "
                    f"table's value is {shown}"
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
