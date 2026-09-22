/**
 * The tree reads feet and inches TWICE, and the two readers disagree on signs: the notation barrel's
 * `parseFeetInches` answers an unsigned length in inches — it refuses a sign before the feet and
 * reads `-6"` as six inches — while the grammar's dimension form (`readNotation`, F-FTIN) answers
 * signed millimetres. The levels proposal reads through the barrel (B-17) and reads a level mark's
 * sign itself, off the mark, handing the barrel the length after it (D-001).
 *
 * So this pins where the two MUST agree, and nothing wider: every length the barrel's own corpus
 * reads is the grammar's millimetres at exactly 25.4 to the inch, unsigned; and every signed level
 * mark the grammar's table reads has, after its sign, the length the barrel reads — the sign being the
 * mark's. A reader that moves either one off the other is red here.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseFeetInches } from "@/modules/takeoff/partition/notation";
import { GRAMMAR, readNotation, type Dimension } from "@/modules/takeoff/partition/notation/grammar";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** Exactly, as L-MEA-01 has it: an inch is 25.4 millimetres. */
const MM_PER_INCH = 25.4;

/** The barrel's own corpus of lengths (AC-6), which the golden suite already drives it over. */
const BARREL_CORPUS = (JSON.parse(readFileSync(join(REPO_ROOT, "tests", "takeoff", "partition", "notation", "golden", "feet-inches.json"), "utf8")) as { cases: { input: string; expect: number | null }[] }).cases;

/**
 * A level mark as the grammar's table writes one: its words, a sign, and a length in feet and inches.
 * The sign opens the figure — at the start, or after a space, an `=` or a bracket — so the dash of
 * `15'-0"`, which joins its feet to its inches, is no sign.
 */
const SIGNED_MARK = /(?:^|[\s=(])([+-])\s*(\d[^()]*?)\s*\)?$/;

/** Is this millimetre figure the one a reading of so many inches states — to the micron? */
function sameLength(mm: number, inches: number): boolean {
  return Math.abs(mm - inches * MM_PER_INCH) < 1e-6;
}

describe("the two feet-and-inches readers agree wherever both read a length", () => {
  test("every length the barrel reads is the grammar's, unsigned; every signed level mark's length after its sign is the barrel's", () => {
    const lengths = BARREL_CORPUS.filter((one) => one.expect !== null);
    expect(lengths.length, "the barrel's corpus states lengths to compare").toBeGreaterThan(0);
    for (const { input, expect: inches } of lengths) {
      const read = readNotation(input);
      expect(read.ok && read.kind === "dimension_ft_in", `the grammar reads ${input} as a length too`).toBe(true);
      const dimension = (read as { parsed: Dimension }).parsed;
      expect(dimension.sign, `${input} is written with no sign, and the grammar reads none`).toBe("");
      expect(sameLength(dimension.mm, inches as number), `${input}: barrel ${String(inches)} in, grammar ${String(dimension.mm)} mm`).toBe(true);
    }

    const marks = GRAMMAR.filter((row) => row.kind === "dimension_ft_in" && /['"]/.test(row.input) && SIGNED_MARK.test(row.input));
    expect(marks.map((row) => row.input), "the table's signed level marks in feet and inches — S-25's among them").toEqual(expect.arrayContaining([`EL +11'-0"`, `E.G.L (-1'-6")`, `P.L= +2'-6"`]));
    for (const row of marks) {
      const [, sign, length] = SIGNED_MARK.exec(row.input) as RegExpExecArray;
      const parsed = row.parsed as Dimension;
      const inches = parseFeetInches(length as string);
      expect(inches, `the barrel reads the length after the sign of ${row.input}`).not.toBeNull();
      expect(parsed.sign, `the sign of ${row.input} is the mark's`).toBe(sign);
      expect(sameLength(Math.abs(parsed.mm), inches as number), `${row.input}: barrel ${String(inches)} in after the sign, grammar ${String(parsed.mm)} mm`).toBe(true);
      expect(parseFeetInches(row.input), `the barrel reads no sign, so it refuses the mark whole rather than dropping its sign: ${row.input}`).toBeNull();
    }
  });
});
