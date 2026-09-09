// L-FRM-06's ban, as a scanner: which files spell a conversion factor as a literal. "One factor per
// unit (`toCanonical`); every pair derives as a quotient" — so a factor written anywhere but the
// canon is a second home for the law, and this is what finds one. The committed test beside it runs
// the scan over `src/**`, all but the files `CONVERSION_SCAN_EXEMPT` names.
//
// What it looks for is the canon's own needles (`CONVERSION_LITERALS`), never a list of its own: the
// factors that are neither 1 nor an integer power of ten, because 1000 is a canon factor and also
// every timeout and grouping constant in the tree, and a scan that hunted it would redden the tree
// rather than the law (riskNotes 4).
//
// It reads through the tree's one source lexer (`tests/support/source-lex`, B-17), so what is judged
// is code and only code: a factor named in prose is a comment and a factor written into a template
// states no law, and neither is reported. A number written as a number and a number quoted as a
// string both are — those are the two ways a factor really creeps back in.
//
// What is compared is the VALUE, never the spelling: every numeric literal the code states and every
// wholly numeric string it quotes is read as an exact decimal and asked whether it equals one of the
// canon's factors, through the canon's own arithmetic (B-17, B-07). A second home for the law is a
// second home whether it is written `0.3048`, `0.30480` or `3048e-4`, and a text match would forgive
// two of those three. The finding names the canon member the value equals, so every spelling of one
// factor is reported as that factor.
import { readFileSync } from "node:fs";
// white-box: L-FRM-06 — the ban IS a claim about source text ("a conversion literal outside the
// canon is a lint failure"), so the tree's one lexer is what this scanner is built out of: a
// spelling that never runs has no runtime observable, and only reading the text can find one.
import { dialectOf, scanned } from "../../../../tests/support/source-lex";
import { CONVERSION_LITERALS, exact } from "../canon";

/** One finding: which file spells a factor, on which line, and which factor of the canon it is. */
export type ConversionLiteralHit = { readonly file: string; readonly line: number; readonly literal: string };

/** The modes a quoted factor is collected in. A template states no law (riskNotes 4), so it is out. */
const QUOTED_MODES = new Set(["single", "double"]);

/** The canon's needles, each carried as the exact decimal it is, so a match is by value (B-07). */
const NEEDLES = CONVERSION_LITERALS.map((literal) => ({ literal, value: exact(literal) }));

/**
 * A numeric literal as TypeScript writes one: decimal digits with optional separators, an optional
 * fraction, an optional exponent and an optional bigint suffix. A radix form (`0x`, `0o`, `0b`) is
 * left out — its digits are read as `0` and then rejected by the guard below, and no conversion
 * factor of the canon is an integer anyway.
 */
const NUMERIC_TOKEN = /(?<![\w$.])(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?/gu;

/** A quoted run that is a number and nothing else — the shape a factor smuggled as a string wears. */
const NUMERIC_STRING = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

/**
 * The canon factor a spelling states, or null when it states none. The comparison is `Decimal.eq`
 * over the canon's own clone, so a trailing zero, a leading dot and an exponent are the same number
 * they would be at runtime — the ban is on the factor, not on the four characters it is usually
 * typed with.
 */
function needleOf(spelling: string): string | null {
  const value = exact(spelling);
  return NEEDLES.find((needle) => needle.value.eq(value))?.literal ?? null;
}

/**
 * Every conversion factor spelled as a literal in these files (L-FRM-06). The files are given rather
 * than discovered: the caller decides which tree the ban governs and which files it exempts.
 */
export function scanConversionLiterals(files: readonly string[]): readonly ConversionLiteralHit[] {
  const hits: ConversionLiteralHit[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const { code, quoted } = readingOf(file, source);

    NUMERIC_TOKEN.lastIndex = 0;
    for (let found = NUMERIC_TOKEN.exec(code); found !== null; found = NUMERIC_TOKEN.exec(code)) {
      // A radix form lexes as its leading `0` followed by an identifier character; so does a number
      // that is really the head of a name. Neither is a decimal literal, and neither is judged.
      if (/[\w$]/u.test(code.charAt(found.index + found[0].length))) continue;
      const literal = needleOf(found[0].replace(/[_n]/gu, ""));
      if (literal !== null) hits.push({ file, line: lineAt(code, found.index), literal });
    }
    for (const run of quoted) {
      const spelling = run.text.trim();
      if (!NUMERIC_STRING.test(spelling)) continue;
      const literal = needleOf(spelling);
      if (literal !== null) hits.push({ file, line: run.line, literal });
    }
  }
  return hits.sort((left, right) => left.line - right.line || (left.literal < right.literal ? -1 : left.literal > right.literal ? 1 : 0));
}

/** One quoted run of a source: what it says, and the line it opens on. */
type QuotedRun = { readonly text: string; readonly line: number };

/**
 * A source read twice over: masked down to its code, so a number counted is a number the file
 * states, and its quoted runs, so a factor written as a string is found where a number scan cannot
 * see it. The mask is the same length as the source, so an index into it is an index into the file.
 */
function readingOf(file: string, source: string): { code: string; quoted: readonly QuotedRun[] } {
  const mask = new Array<string>(source.length).fill(" ");
  const quoted: QuotedRun[] = [];
  let run: { text: string; line: number } | null = null;
  let line = 1;

  for (const { index, char, mode, edge } of scanned(source, dialectOf(file))) {
    if (QUOTED_MODES.has(mode)) {
      if (run === null || edge === "open") {
        if (run !== null) quoted.push({ ...run });
        run = { text: "", line };
      }
      if (edge === null) run.text += char;
    } else if (run !== null) {
      quoted.push({ ...run });
      run = null;
    }
    mask[index] = mode === "code" || char === "\n" ? char : " ";
    if (char === "\n") line += 1;
  }
  if (run !== null) quoted.push({ ...run });

  return { code: mask.join(""), quoted };
}

/** The 1-based line an index of the masked source stands on — the mask keeps every newline. */
function lineAt(code: string, index: number): number {
  let line = 1;
  for (let at = 0; at < index; at += 1) {
    if (code.charAt(at) === "\n") line += 1;
  }
  return line;
}
