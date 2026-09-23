/**
 * The notation grammar reads through core's one MTEXT stripper, and keeps no code table of its own
 * (Interpretation I-458, B-17, L-CAD-02).
 *
 * The grammar once held a second table that disagreed with core's: it kept a stacked fraction core
 * deleted, and it read a paragraph mark `\P` as a `\p…;` paragraph setting wherever a semicolon stood
 * later in the text, deleting every word between them. These cases are red against that table.
 *
 * Nothing here opens a store, a clock or a model: the grammar is total over strings.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { normaliseNotation } from "@/core/entitygraph/notation";
import { plainly, readNotation } from "@/modules/takeoff/partition/notation/grammar";
import { REPO_ROOT } from "../support/section-texts";

describe("I-458: the grammar reads a text as core reads it", () => {
  test("a paragraph mark is a line break, never a paragraph setting that runs to the next semicolon", () => {
    expect(plainly("LAPS STAGGERED\\PNOT MORE THAN 50%%% AT ONE SECTION; SEE S-02"), "every word after the break is kept").toBe("LAPS STAGGERED NOT MORE THAN 50% AT ONE SECTION; SEE S-02");
    expect(plainly("A\\PB; C")).toBe("A B; C");
  });

  test("the stacked fraction reads the same through the grammar as through core", () => {
    const drawn = "3'-6\\S1/2;\"";
    expect(plainly(drawn)).toBe(normaliseNotation(drawn).toUpperCase());
    const read = readNotation(drawn);
    expect(read.ok && read.parsed, "T-NOT-FTIN-STACK: 3'-6½\" is 1079.5 mm").toEqual({ mm: 1079.5, sign: "" });
  });

  test("a ties call drawn aligned, with the half inch stacked in a height group, reads its centres", () => {
    const read = readNotation("\\A1;10%%C @ 5{\\H0.7x;\\S1/2;}\" c/c");
    expect(read.ok && read.kind).toBe("spacing");
    expect(read.ok && (read.parsed as { spacingMm: number }).spacingMm, "5½ in = 139.7 mm").toBe(139.7);
  });

  test("a font-wrapped member label reads as its mark", () => {
    const read = readNotation("{\\fSwis721 Cn BT|b0|i0|c0|p34;GB-2}");
    expect(read.ok && read.parsed).toEqual({ family: "GB", number: 2, level: null, variant: null, part: null });
  });

  test("an underline whose words run to a semicolon keeps its words", () => {
    expect(plainly("\\LSECTION A-A; SEE S-12")).toBe("SECTION A-A; SEE S-12");
  });
});

/* ------------------------------------------------------------------ B-17: one home for the codes */

/** Every TypeScript source under `src/`, relative to the checkout. */
function sourcesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(REPO_ROOT, path)] : [];
  });
}

/** The one file that says what a DXF control code or an MTEXT inline code means. */
const THE_ONE_HOME = join("src", "core", "entitygraph", "notation.ts");

/**
 * How a second table would spell a code, as its source text reads: a `%%` class (`%%[Cc]`) or
 * character code (`%%(\d{3})`), an MTEXT stack (`\\S(`), font (`\\[fF]`) or break (`\\[XN]`,
 * `\\[PNX]`, the string `"\\P"`), or a code point escape (`[Uu]\+`).
 */
const SPELLINGS: readonly string[] = ["%%[", "%%(\\d", "\\\\S(", "\\\\[fF]", "\\\\[XN]", "\\\\[PNX]", '"\\\\P"', "[Uu]\\+"];

describe("B-17: the codes a drawing's text carries are spelled in one file", () => {
  test("no source but core's notation spells a `%%` control code, an MTEXT stack, font code or break, or a code point", () => {
    const spelled = sourcesUnder(join(REPO_ROOT, "src")).filter((path) => {
      if (path === THE_ONE_HOME) return false;
      const source = readFileSync(join(REPO_ROOT, path), "utf8");
      return SPELLINGS.some((spelling) => source.includes(spelling));
    });
    expect(spelled, "a second table of what `%%C` or `\\S1/2;` says is a second answer to it").toEqual([]);
  });
});
