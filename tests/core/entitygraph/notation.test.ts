/**
 * Core's one reading of a drawing's text (L-CAD-02, L-CAD-03; Interpretation I-458): the MTEXT
 * inline codes a real set's labels, cells and notes are drawn with, resolved by ONE stripper that
 * keeps a stacked fraction's number and takes away every code that only says how the text is drawn.
 *
 * The table below is the stripper's contract, one row per code a draughtsman's MTEXT editor writes;
 * the two registered traps of F-RCC6-BNBC that name an MTEXT code (T-NOT-FTIN-STACK, T-MTEXT-CODES)
 * are then read off the fixture's own corpus through this core path, so a reader that lost the half
 * inch, or left a font code glued to a word, is red here rather than silent in a bill.
 *
 * Nothing here opens a store, a clock or a model: the reading is total over strings.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { mtextLines, normaliseNotation, notationLines, resolveCodePoints, resolveControlCodes, withoutMtextCodes } from "@/core/entitygraph/notation";
import { parseFeetInches } from "@/modules/takeoff/partition/notation";

/** One row of the stripper's contract: what the drawing carries, what it says once its codes go. */
type Row = { readonly code: string; readonly drawn: string; readonly said: string };

const STRIPPER: readonly Row[] = [
  // — the stacked fraction: the one code that carries a number —————————————————————————————
  { code: "\\Sa/b; (horizontal fraction)", drawn: "3'-6\\S1/2;\"", said: "3'-6 1/2\"" },
  { code: "\\Sa#b; (diagonal fraction)", drawn: "4\\S3#4;\"", said: "4 3/4\"" },
  { code: "\\S inside a height group", drawn: "10%%C @ 5{\\H0.7x;\\S1/2;}\" c/c", said: "10%%C @ 5 1/2\" c/c" },
  { code: "\\Sa#b; standing first: no space before it", drawn: "\\A1;{\\H0.7x;\\S5#8;}\"", said: "5/8\"" },
  { code: "\\Sa^b; (tolerance: its parts, never a fraction, set apart from the figure before it)", drawn: "150\\S+5^-0;", said: "150 +5 -0" },
  { code: "\\Sa^b; standing first", drawn: "\\S+0.5^-0.2;", said: "+0.5 -0.2" },
  { code: "\\Sa^; (a raised figure after a word joins it, as the sheet shows m²)", drawn: "N/mm\\S2^;", said: "N/mm2" },
  { code: "\\Sa^; after a figure stands apart: 10³ is never 103", drawn: "10\\S3^;", said: "10 3" },
  { code: "\\S^b; (a lowered figure)", drawn: "H\\S^2;O", said: "H2O" },
  // — font, height, width, tracking, slant, colour: how it is drawn ————————————————————————
  { code: "{\\f…;} font group", drawn: "{\\fSwis721 Cn BT|b0|i0|c0|p34;C-1}", said: "C-1" },
  { code: "\\F…; font file", drawn: "{\\Fromans|c0;\\W0.75;450mm}", said: "450mm" },
  { code: "\\H…x; height", drawn: "TH=6{\\H0.8x;\"}", said: "TH=6\"" },
  { code: "\\W…; width", drawn: "{\\W0.8;16%%C @ 7\" c/c}", said: "16%%C @ 7\" c/c" },
  { code: "\\T…; tracking", drawn: "{\\T0.95;SLAB LAYOUT PLAN}", said: "SLAB LAYOUT PLAN" },
  { code: "\\Q…; slant", drawn: "{\\Q15;GB-2}", said: "GB-2" },
  { code: "\\C…; and \\c…; colour", drawn: "\\C1;\\c6710371;RB-3\\C256;", said: "RB-3" },
  // — alignment and paragraph settings ————————————————————————————————————————————————————
  { code: "\\A…; alignment", drawn: "\\A1;12\"X24\"", said: "12\"X24\"" },
  { code: "\\p…; paragraph settings", drawn: "\\pxqc;{\\fArial|b1|i0|c0|p34;SOAK PIT}", said: "SOAK PIT" },
  // — the toggles ——————————————————————————————————————————————————————————————————————————
  { code: "\\L…\\l underline", drawn: "\\LSECTION A-A\\l", said: "SECTION A-A" },
  { code: "\\O…\\o overline, \\K…\\k strike", drawn: "\\OTOP\\o \\KOLD\\k", said: "TOP OLD" },
  { code: "an underline never takes the words after it for a parameter", drawn: "\\LSECTION A-A; SEE S-12", said: "SECTION A-A; SEE S-12" },
  // — breaks and spaces ————————————————————————————————————————————————————————————————————
  { code: "\\P paragraph", drawn: "GENERAL NOTES\\P1. READ WITH S-02.", said: "GENERAL NOTES\n1. READ WITH S-02." },
  { code: "\\P glued to the next word", drawn: "GRADES:\\Pfy = 415 MPa", said: "GRADES:\nfy = 415 MPa" },
  { code: "\\N column break, \\X a dimension's second line", drawn: "A\\NB\\XC", said: "A\nB\nC" },
  { code: "\\~ non-breaking space", drawn: "12\\~NOS", said: "12 NOS" },
  // — escapes, and a text with no code at all ——————————————————————————————————————————————
  { code: "\\\\ \\{ \\} escaped", drawn: "C\\\\C \\{TYP\\}", said: "C\\C {TYP}" },
  { code: "no backslash: read exactly as drawn, braces and all (I-330)", drawn: "SIZE {TYP}", said: "SIZE {TYP}" },
  // — code points, and a character read once ——————————————————————————————————————————————
  { code: "\\U+XXXX code point", drawn: "L \\U+2212 lap", said: "L − lap" },
  { code: "a brace spelled as a code point is a brace, never a group", drawn: "\\U+007bA\\U+007d", said: "{A}" },
  { code: "an escape naming no character is kept as drawn", drawn: "BAD \\U+D800 ESCAPE", said: "BAD \\U+D800 ESCAPE" },
  { code: "an escaped backslash is never read again as the code after it", drawn: "C:\\\\PLANS \\\\U+0041", said: "C:\\PLANS \\U+0041" },
];

describe("I-458: the one MTEXT stripper, row by row", () => {
  test.each(STRIPPER.map((row): [string, Row] => [row.code, row]))("%s", (_code, row) => {
    expect(withoutMtextCodes(row.drawn), `${JSON.stringify(row.drawn)} says ${JSON.stringify(row.said)}`).toBe(row.said);
    expect(mtextLines(row.drawn), "the lines are the stripped text cut at its breaks — one stripper, never two").toEqual(row.said.split("\n"));
  });

  test("the `%%` control codes stay the notation's, never the stripper's (a verbatim line keeps them)", () => {
    expect(withoutMtextCodes("{\\H0.7x;8-16%%C}")).toBe("8-16%%C");
    expect(normaliseNotation("{\\H0.7x;8-16%%C}"), "normaliseNotation resolves both").toBe("8-16Ø");
  });

  test("resolveControlCodes is the one home of a `%%` code, the `%%nnn` character code among them", () => {
    expect(resolveControlCodes("45%%176"), "`%%176` draws the degree sign").toBe("45°");
    expect(resolveControlCodes("WASTAGE 3%%%176"), "`%%%` is read first: a percent sign, then the figure").toBe("WASTAGE 3%176");
    expect(resolveControlCodes("kN/m%%2"), "`%%2` is no code: two digits spell no character").toBe("kN/m%%2");
    expect(resolveControlCodes("%%010 %%127"), "a code naming no printable character is kept as drawn").toBe("%%010 %%127");
    expect(resolveControlCodes("{\\H0.7x;8-16%%C}"), "and it touches nothing an MTEXT code says").toBe("{\\H0.7x;8-16Ø}");
    expect(normaliseNotation("16%%216"), "`%%216` is Ø, the notation's one diameter sign").toBe("16Ø");
  });

  test("resolveCodePoints reads a TEXT's code points and nothing else: a TEXT draws no MTEXT code", () => {
    expect(resolveCodePoints("L \\U+2212 lap")).toBe("L − lap");
    expect(resolveCodePoints("A\\PB {C}")).toBe("A\\PB {C}");
  });

  test("notationLines cuts the one reading at its breaks, resolving each code once", () => {
    expect(notationLines("{\\L1ST FLOOR}\\P8-16%%C")).toEqual(["1ST FLOOR", "8-16Ø"]);
    expect(notationLines("C:\\\\PLANS"), "an escaped backslash before a P is a backslash and a P, one line").toEqual(["C:\\PLANS"]);
  });

  test("normaliseNotation reads through the stripper before it resolves a glyph", () => {
    expect(normaliseNotation("\\A1;16%%C @ 3{\\H0.7x;\\S1/2;}\" c/c")).toBe("16Ø @ 3 1/2\" c/c");
    expect(normaliseNotation("{\\fSwis721 Cn BT|b1|i0|c0|p34;\\L1ST FLOOR SLAB}"), "a font group and an underline around a caption").toBe("1ST FLOOR SLAB");
  });

  test("the stripper is total: every string answers, and an unclosed or unknown code is kept as drawn", () => {
    for (const drawn of ["", "\\", "\\S1/2", "\\fArial", "\\U+2205", "{", "}"]) {
      expect(() => withoutMtextCodes(drawn), JSON.stringify(drawn)).not.toThrow();
    }
    expect(withoutMtextCodes("\\S1/2"), "a stack with no closing semicolon states no fraction and is left as drawn").toBe("\\S1/2");
    expect(withoutMtextCodes("10%%C @ 150 C\\C"), "a TEXT's `C\\C` centres word is no code: it closes on no semicolon").toBe("10%%C @ 150 C\\C");
  });
});

/* ------------------------------------------------------------------ the registered traps, on the core path */

type CorpusString = { readonly raw: string; readonly plain: readonly string[]; readonly trap: string | null; readonly kind: string };
type Trap = { readonly id: string; readonly sample: string; readonly expected: string };

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const corpus = read("../../../fixtures/rcc6-bnbc/notation.corpus.json") as { strings: readonly CorpusString[] };
const traps = read("../../../fixtures/rcc6-bnbc/traps.json") as { traps: readonly Trap[] };

const trapNamed = (id: string): Trap => {
  const held = traps.traps.find((trap) => trap.id === id);
  expect(held, `${id} is a registered trap of F-RCC6-BNBC`).toBeDefined();
  return held as Trap;
};

/** Every string the fixture draws carrying an MTEXT inline code, as the corpus records it. */
const CODED = corpus.strings.filter((one) => one.raw.includes("\\"));

describe("F-RCC6-BNBC's MTEXT traps, read through core's one stripper", () => {
  test("T-NOT-FTIN-STACK: the stacked fraction is kept — 3'-6½\" reads 1079.5 mm, never 3'-6\"", () => {
    const trap = trapNamed("T-NOT-FTIN-STACK");
    const drawn = CODED.filter((one) => one.trap === trap.id);
    expect(drawn.length, "the fixture draws the trap").toBeGreaterThan(0);
    const expectedMm = Number(/=\s*([\d.]+)\s*mm/.exec(trap.expected)?.[1]);
    expect(expectedMm, "the trap states what the string reads as").toBe(1079.5);
    for (const one of drawn) {
      const lines = mtextLines(one.raw);
      expect(lines, "one line, with the fraction set apart from the six inches it follows").toEqual(["FLIGHT WIDTH 3'-6 1/2\""]);
      const length = (lines[0] ?? "").replace(/^[A-Z ]+/, "");
      const inches = parseFeetInches(length);
      expect(inches === null ? null : Math.round(inches * 25.4 * 1e6) / 1e6, `${JSON.stringify(one.raw)} reads as the trap says`).toBe(expectedMm);
    }
  });

  test("T-MTEXT-CODES: every other coded string the fixture draws reads line for line as it authored it", () => {
    trapNamed("T-MTEXT-CODES");
    const others = CODED.filter((one) => one.trap !== "T-NOT-FTIN-STACK");
    expect(others.some((one) => one.trap === "T-MTEXT-CODES"), "the trap is among them").toBe(true);
    expect(others.length, "the notes blocks, the one-text schedule header and its footer").toBe(5);
    for (const one of others) {
      expect(normaliseNotation(one.raw).split("\n"), `${JSON.stringify(one.raw.slice(0, 60))}… — the font, underline and alignment codes gone, \\P a line, every word kept`).toEqual(one.plain);
    }
  });
});
