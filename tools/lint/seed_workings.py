"""The seed-working lint: a seed row's arithmetic is rebuilt from the figures it prints.

The seed table (`| Id | What | Derivation | Value |`) is where a page works every figure out. This
lint reads each row's Derivation and re-multiplies (or re-adds) each working it prints:

    A x B = C            a chain of figures, then `=`, then its result: C must be the chain's product
    ... x B | Value      the last chain of the derivation, when it ends the cell: the Value cell

A figure is a number (grouped or not, `13.31`), a feet-and-inches length (2 ft 3 in), or a row id
followed by its number (`E4a 141.81`: the number is the figure). A bare row id (`M3 + M4`) has no
figure on the line, so that working is not checked; neither is a chain that mixes `+` with `x`.
The result is compared as the nearest value at its own printed places (half up, 1.3: each
Measurement Line to two places), so a result printed from an unrounded product, or an intermediate
rounded the other way, is a finding.

    python3 -m tools.lint.seed_workings docs/design/m1-screens.md

Exit 0 when every working agrees, 1 when one does not (`page:line`, the row and the working), 2 when a
page cannot be read.
"""

import re
import sys
from collections.abc import Sequence
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from tools.lint.seed_figures import HEADER, _cells

NUMBER = r"\d[\d,]*(?:\.\d+)?"
FEET = r"\d+\u2032-\d+(?:\u00bd)?\u2033"
UNIT = r"(?:\s+(?:cft|sft|rft|kg|m|bags?|ton))?"
ID = r"[A-Z][A-Za-z0-9]*"
OPERAND = rf"(?:(?:{ID}\s+)?(?:{FEET}|{NUMBER}){UNIT})"
OPERATOR = r"\s*[\u00d7+\u2212\u00f7]\s*"
CHAIN = rf"{OPERAND}(?:{OPERATOR}{OPERAND})+"
BEFORE = re.compile(rf"(?<![\w.,\u2032\u2033-])({CHAIN})\s*$")
TAIL = re.compile(rf"(?<![\w.,\u2032\u2033-])({CHAIN})\s*$")


def _figure(operand: str) -> Decimal:
    feet = re.search(rf"({FEET})", operand)
    if feet:
        whole, inches = re.match(r"(\d+)\u2032-(\d+)(\u00bd)?", feet.group(1)).group(1, 2)  # type: ignore[union-attr]
        half = Decimal("0.5") if "\u00bd" in feet.group(1) else Decimal(0)
        return Decimal(whole) + (Decimal(inches) + half) / 12
    number = re.findall(NUMBER, operand)[-1]
    return Decimal(number.replace(",", ""))


def _evaluate(chain: str) -> Decimal | None:
    parts = re.split(rf"({OPERATOR})", chain)
    operands, operators = parts[0::2], [p.strip() for p in parts[1::2]]
    if len({"\u00d7\u00f7" if o in "\u00d7\u00f7" else "+-" for o in operators}) > 1:
        return None
    total = _figure(operands[0])
    for operator, operand in zip(operators, operands[1:], strict=True):
        value = _figure(operand)
        if operator == "\u00d7":
            total *= value
        elif operator == "\u00f7":
            total /= value
        elif operator == "+":
            total += value
        else:
            total -= value
    return total


def _places(printed: str) -> Decimal:
    return Decimal(1).scaleb(-(len(printed.split(".")[1]) if "." in printed else 0))


def _agrees(chain: str, printed: str) -> bool:
    value = _evaluate(chain)
    if value is None:
        return True
    want = Decimal(printed.replace(",", ""))
    return value.quantize(_places(printed), rounding=ROUND_HALF_UP) == want


def check(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    findings: list[str] = []
    inside = False
    for number, line in enumerate(lines, start=1):
        if not line.lstrip().startswith("|"):
            inside = False
            continue
        cells = _cells(line)
        if tuple(c.lower() for c in cells) == HEADER:
            inside = True
            continue
        if not inside or len(cells) < 4:
            continue
        row, derivation, value = cells[0], cells[2], cells[3]
        segments = derivation.split("=")
        for index in range(1, len(segments)):
            result = re.match(rf"\s*({NUMBER})", segments[index])
            found = BEFORE.search(segments[index - 1]) if result else None
            if found and result and not _agrees(found.group(1), result.group(1)):
                findings.append(
                    f"{path}:{number}: row {row}: {found.group(1).strip()} = {result.group(1)}, "
                    f"which it does not make"
                )
        tail = re.sub(r"\s*\([^()]*\)\s*$", "", segments[-1])
        end = TAIL.search(tail)
        printed = re.fullmatch(rf"\s*({NUMBER})(?:\s*[a-z%]+)?\s*", value.replace("*", ""))
        if end and printed and not _agrees(end.group(1), printed.group(1)):
            findings.append(
                f"{path}:{number}: row {row}: {end.group(1).strip()} is not its Value {printed.group(1)}"
            )
    return findings


def main(argv: Sequence[str] | None = None) -> int:
    pages = list(sys.argv[1:] if argv is None else argv)
    if not pages:
        print("usage: python3 -m tools.lint.seed_workings <page>...", file=sys.stderr)
        return 2
    failed = unreadable = False
    for name in pages:
        try:
            findings = check(Path(name))
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
