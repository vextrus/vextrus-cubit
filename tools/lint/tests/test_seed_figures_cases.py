"""Every case the seed-figure lint has been refused for, as one table (S25-SEEDLINT, rounds 1 to 4).

The lint regressed each round because a fix for one hole opened another; each case here is one page
body, the seed rows it is read against and what the lint must say: nothing, or the findings
`(body line, row, the copy's figure, the row's value as printed)`. A fix to the lint runs against
the whole table at once.
"""

from dataclasses import dataclass
from pathlib import Path

import pytest

from tools.lint import seed_figures

TAKA = "\u09f3"
TIMES = "\u00d7"
MINUS = "\u2212"

BASE = (
    "| A1 | Rate | entered | 2.50 |",
    "| **T2** | Total | W1 to W3 | **1,31,378.85** |",
    "| K1 | Area | entered | 42,000 sft |",
    "| W3 | Awaiting | entered | 672.48 |",
    "| T6 | Share | T1 ÷ T4 | 6.03% |",
    "| G4 | Columns | by state | 100 + 8 + 2 = 110 |",
    "| G2 | Storeys | by level | the level table of 6.2 |",
    "| G5 | Columns | by state | sum of 3 parts; 100 + 8 + 2 = 110 |",
)
MINUS_ROWS = (
    "| T1 | Measured | M1 to M14 | 1,000.00 |",
    "| W3 | Awaiting | entered | 400.00 |",
    f"| T5 | Remainder | T1 {MINUS} W3 | 600.00 |",
)
TWO_VALUES = (
    "| R1 | RCC per cft | the Rate Analysis | 276.67; 308.17 |",
    "| R2 | RCC per cft | working | dry = 276.67; wet = 308.17 |",
    f"| R3 | Cast | working | 2 {TIMES} 3 = 6; 4 {TIMES} 5 = 20 |",
)
HEADER = "| Id | What | Derivation | Value |\n|---|---|---|---|\n"

Finding = tuple[int, str, str, str]  # (body line, row, the copy, the row's value as printed)


@dataclass(frozen=True)
class Case:
    name: str
    body: str
    found: tuple[Finding, ...] = ()
    seed: tuple[str, ...] = BASE
    table: bool = True


def ok(name: str, body: str, seed: tuple[str, ...] = BASE) -> Case:
    return Case(name, body, (), seed)


def bad(name: str, body: str, *found: Finding, seed: tuple[str, ...] = BASE) -> Case:
    return Case(name, body, found, seed)


CASES = (
    # --- the basics: rounding, the fence, a page with no table
    Case("no-table-passes", "A1 = 9\n", table=False),
    ok("half-rounds-up", "A1 = 3\n"),
    bad("round-down-is-stale", "A1 = 2\n", (1, "A1", "2", "2.50")),
    ok("fenced-block-unread", "```\nA1 = 9\n```\n"),
    ok("plain-grouping-agrees", f"Awaiting {TAKA}131,378.85 (T2), typed {TAKA}131378.85 (T2).\n"),
    bad("grouping-hides-no-digit", f"{TAKA}1,31,387.85 (T2)\n", (1, "T2", "1,31,387.85", "1,31,378.85")),
    ok("ticket-name-is-no-id", "A1-20 adds 3 screens; T2-7 shows 4 cards.\n"),
    ok("id-digit-is-no-figure", "T4 = A1 + T2, and in M1 (A1) too.\n"),
    # --- round 1: values, bold, lists of rows, shares, wrapped citations, signed and working figures
    ok("prose-value-gives-none", "G2 6.2\n"),
    ok("working-result-is-the-value", "110 columns (G4)\n"),
    bad("working-operand-is-not-the-value", "G4 100\n", (1, "G4", "100", "110")),
    bad("bold-id", f"**T2** {TAKA}1,31,387\n", (1, "T2", "1,31,387", "1,31,378.85")),
    bad("bold-figure", f"**{TAKA}1,31,387.85** (T2)\n", (1, "T2", "1,31,387.85", "1,31,378.85")),
    ok("bold-agreeing", f"**{TAKA}1,31,379** (T2)\n"),
    ok("row-list-one-matches", f"{TAKA}672.48 (T2, W3)\n"),
    bad(
        "row-list-none-matches",
        f"{TAKA}672.49 (T2, W3)\n",
        (1, "T2, W3", "672.49", "1,31,378.85; 672.48"),
    ),
    ok("share-with-phrase", "Rate 3% of the total (A1)\n"),
    bad("share-with-phrase-stale", "Rate 4% of the total (A1)\n", (1, "A1", "4", "2.50")),
    bad(
        "citation-wrapped",
        f"The awaiting answer is {TAKA}1,31,387.85\n(T2) today.\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    ok("signed-change", f"+{TAKA}47.00 (A1)\n"),
    ok("working-result", f"2 sft {TIMES} 3.00 = {TAKA}6.00 (A1); G4 100 {TIMES} E1 = 5\n"),
    # --- round 2: list markers, the operator's clause, rates, wrapped workings, other units
    bad(
        "list-marker-is-no-sign",
        f"- {TAKA}1,31,387.85 (T2) is awaiting.\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    bad("list-marker-bold", "- **4%** of the total (A1)\n", (1, "A1", "4", "2.50")),
    ok("list-marker-agreeing", f"- {TAKA}1,31,379 (T2)\n"),
    ok("list-items-stand-alone", "- 9\n- (A1) is the rate\n"),
    ok("table-rows-stand-alone", "| 9 |\n| (A1) |\n"),
    ok("heading-stands-alone", "# Total 9\n(A1) is the rate\n"),
    bad(
        "operator-in-a-comma-clause",
        f"On the strip (Measured / Awaiting), the awaiting answer = {TAKA}1,31,387.85 (T2).\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    bad(
        "signed-clause-before-semicolon",
        f"Beams +{TAKA}47.00 (A1); the awaiting answer = {TAKA}1,31,387.85 (T2).\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    bad(
        "italic-clause",
        f"In *the strip* the awaiting answer = {TAKA}1,31,387.85 (T2).\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    ok("working-before-equals", f"2 sft {TIMES} 3.00 = {TAKA}6.00 (A1)\n"),
    ok("decimal-point-is-no-sentence-end", f"3.00 {TIMES} 2.00 = {TAKA}6.00 (A1)\n"),
    bad("rate-slash-unit-id-first", f"A1 {TAKA}2.60/sft\n", (1, "A1", "2.60", "2.50")),
    bad("rate-slash-unit-figure-first", f"{TAKA}2.60/cft (A1)\n", (1, "A1", "2.60", "2.50")),
    ok("rate-slash-unit-agreeing", f"{TAKA}2.50/cft (A1)\n"),
    ok("division-is-a-working", "A1 12 / 4\n"),
    ok(
        "working-wrapped",
        f"Steps 9 to 14: 42,000 sft {TIMES}\n170.00 = {TAKA}71,40,000.00 (A1), a part\n",
    ),
    ok("short-form-and-other-unit", "T2 1.31 lakh, and K1 = 42 ton\n"),
    ok("crore-short-form", "T2 0.13 crore, K1 = 42,000 sft\n"),
    bad("own-unit-stale", "K1 = 42,001 sft\n", (1, "K1", "42,001", "42,000")),
    ok("own-unit-agreeing", "K1 = 42,000 sft\n"),
    # --- round 3 (finding 65): a copy may drop the unit its row carries, and is still compared
    bad("unit-dropped-after-equals", "K1 = 42,001\n", (1, "K1", "42,001", "42,000")),
    bad("unit-dropped-before-id", "The slab is 42,001 (K1).\n", (1, "K1", "42,001", "42,000")),
    bad("ordinary-word-is-no-unit", "K1 42,001 covers the slab.\n", (1, "K1", "42,001", "42,000")),
    bad(
        "ordinary-word-after-figure",
        "The slab covers 42,001 square (K1).\n",
        (1, "K1", "42,001", "42,000"),
    ),
    ok("unit-dropped-agreeing", "K1 = 42,000\n"),
    ok("unit-dropped-agreeing-before-id", "The slab is 42,000 (K1).\n"),
    ok("unit-dropped-share-agrees", "Measured 6 (T6)\n"),
    bad("unit-dropped-share-stale", "Measured 7 (T6)\n", (1, "T6", "7", "6.03")),
    bad("share-own-unit-stale", "Measured T6 7% of the total\n", (1, "T6", "7", "6.03")),
    ok("real-unit-the-row-lacks", "K1 = 42 ton and 9 kg (K1)\n"),
    # --- round 3 (finding 60): the clause before '=' ends at a sentence end, a closing parenthesis
    bad(
        "operator-in-an-earlier-line",
        f"Measured + Awaiting make the strip.\nThe awaiting answer = {TAKA}1,31,387.85 (T2).\n",
        (2, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    bad(
        "operator-in-an-earlier-sentence",
        f"Measured / Awaiting is the strip. The awaiting answer = {TAKA}1,31,387.85 (T2).\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    bad(
        "operator-in-a-closed-parenthesis",
        f"On the strip (Measured / Awaiting) the awaiting answer = {TAKA}1,31,387.85 (T2).\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    bad(
        "operator-in-a-closed-parenthesis-with-sentence-end",
        f"On the strip (Measured / Awaiting. Totals) the awaiting answer = {TAKA}1,31,387.85 (T2).\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    bad(
        "operator-before-a-colon",
        f"Strip: Measured + Awaiting. Answer: the awaiting total = {TAKA}1,31,387.85 (T2).\n",
        (1, "T2", "1,31,387.85", "1,31,378.85"),
    ),
    ok("working-after-a-closed-parenthesis", f"(2 + 3) {TIMES} 4 = {TAKA}6.00 (A1)\n"),
    ok("working-parenthesis-before-equals", f"(2 + 3) = {TAKA}6.00 (A1)\n"),
    ok("working-in-an_open_parenthesis", f"(see 2 {TIMES} 3 = {TAKA}6.00 (A1))\n"),
    # --- round 3 (finding 50): a minus before the id is an operator in the id-then-figure shape
    ok("minus-before-id", f"T5 = T1 {MINUS} W3 = {TAKA}600.00 (T5)\n", MINUS_ROWS),
    ok("hyphen-minus-before-id", f"T5 = T1 - W3 = {TAKA}600.00 (T5)\n", MINUS_ROWS),
    ok("minus-before-id-no-leading-t5", f"T1 {MINUS} W3 = {TAKA}600.00 (T5)\n", MINUS_ROWS),
    ok("minus-glued-before-id", f"T1{MINUS}W3 = {TAKA}600.00 (T5)\n", MINUS_ROWS),
    ok("hyphen-glued-in-a-name", f"T1-W3 = {TAKA}600.00 (T5)\n", MINUS_ROWS),
    bad(
        "id-after-no-operator",
        f"Awaiting W3 = {TAKA}401.00\n",
        (1, "W3", "401.00", "400.00"),
        seed=MINUS_ROWS,
    ),
    ok("id-after-no-operator-agreeing", f"Awaiting W3 = {TAKA}400.00\n", MINUS_ROWS),
    ok("signed-figure-after-id", f"T5 = {MINUS}{TAKA}47.00\n", MINUS_ROWS),
    # --- round 3 (finding 50): a row holding several values is agreed with by any of them
    ok("each-semicolon-part-first", f"{TAKA}276.67 (R2)\n", TWO_VALUES),
    ok("each-semicolon-part-last", f"{TAKA}308.17 (R2)\n", TWO_VALUES),
    bad(
        "each-semicolon-part-stale",
        f"{TAKA}300.00 (R2)\n",
        (1, "R2", "300.00", "276.67; 308.17"),
        seed=TWO_VALUES,
    ),
    ok("plain-values-first", f"{TAKA}276.67 (R1)\n", TWO_VALUES),
    ok("plain-values-last", f"{TAKA}308.17 (R1)\n", TWO_VALUES),
    bad(
        "plain-values-stale",
        f"{TAKA}308.71 (R1)\n",
        (1, "R1", "308.71", "276.67; 308.17"),
        seed=TWO_VALUES,
    ),
    ok("two-workings-first", "R3 6\n", TWO_VALUES),
    ok("two-workings-last", "R3 20\n", TWO_VALUES),
    bad("two-workings-operand", "R3 5\n", (1, "R3", "5", "6; 20"), seed=TWO_VALUES),
    bad("prose-before-semicolon-is-no-value", "G5 3\n", (1, "G5", "3", "110")),
    ok("prose-before-semicolon-working-result", "110 columns (G5)\n"),
)


@pytest.mark.parametrize("case", CASES, ids=[c.name for c in CASES])
def test_the_lint_says_what_the_case_expects(
    case: Case, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    head = (HEADER + "\n".join(case.seed) + "\n") if case.table else ""
    page = tmp_path / "p.md"
    page.write_text(head + "\n" + case.body, encoding="utf-8")
    first = len(head.splitlines()) + 2  # the page line of the body's first line
    code = seed_figures.main([str(page)])
    out = capsys.readouterr().out.splitlines()
    expected = [
        f"{page}:{first + line - 1}: row {row}: the copy reads {copy} "
        f"but the seed table's value is {value}"
        for line, row, copy, value in case.found
    ]
    assert out == expected
    assert code == (1 if case.found else 0)
