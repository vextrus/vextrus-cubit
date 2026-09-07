// L-CAD-06's ban, as a scanner: which files spell a view type as a string literal. The vocabulary has
// one home beside its sole predicate, so a member written as a string anywhere else is a second home
// for the law — and this is what finds one. The committed test beside it runs the scan over `src/**`.
//
// It reads through the tree's one source lexer (`tests/support/source-lex`, B-17), so what is judged
// is code and only code: a member named in prose is a comment, and a module specifier addresses a
// file rather than stating a class. Neither is a spelling of the law, and neither is reported.
import { readFileSync } from "node:fs";
import { dialectOf, scanned } from "../../../../../../tests/support/source-lex";
import { VIEW_TYPES } from "../law";

/** One finding: which file spells a member, on which line, and which member it spells. */
export type LiteralHit = { readonly file: string; readonly line: number; readonly literal: string };

/** The vocabulary as plain text — a scan reads strings, and the members are branded. */
const SPELLINGS = new Set<string>(VIEW_TYPES);

/** The modes a string's content is collected in: the three ways a source states one. */
const LITERAL_MODES = new Set(["single", "double", "template"]);

/**
 * The code that may stand before a string that addresses a file rather than stating a value. A
 * specifier is a path, so it is never a spelling of the law even where the path is spelled like one.
 */
const SPECIFIER_BEFORE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*$/u;

/** How much preceding code is enough to tell a specifier from a value — the longest word is seven. */
const TAIL_LENGTH = 32;

/** One string literal a source states: what it says, where it starts, and whether it addresses a file. */
type Literal = { readonly text: string; readonly line: number; readonly specifier: boolean };

/**
 * Every view-type spelling stated as a string literal in these files (L-CAD-06). The files are given
 * rather than discovered: the caller decides which tree the ban governs and which files it exempts.
 */
export function scanViewTypeLiterals(files: readonly string[]): readonly LiteralHit[] {
  const hits: LiteralHit[] = [];
  for (const file of files) {
    for (const literal of literalsIn(file, readFileSync(file, "utf8"))) {
      if (!literal.specifier && SPELLINGS.has(literal.text)) hits.push({ file, line: literal.line, literal: literal.text });
    }
  }
  return hits;
}

/** Every string literal one source states, in the order it states them. */
function literalsIn(file: string, source: string): Literal[] {
  const found: Literal[] = [];
  let run: { text: string; line: number; specifier: boolean } | null = null;
  let code = "";
  let line = 1;

  for (const { char, mode, edge } of scanned(source, dialectOf(file))) {
    if (LITERAL_MODES.has(mode)) {
      if (run === null || edge === "open") {
        if (run !== null) found.push({ ...run });
        run = { text: "", line, specifier: SPECIFIER_BEFORE.test(code) };
      }
      if (edge === null) run.text += char;
    } else {
      if (run !== null) {
        found.push({ ...run });
        run = null;
      }
      // Only code decides whether the next string addresses a file; a comment between the two says
      // nothing about it, and the tail is kept short so the question stays local to the call site.
      if (mode === "code") code = `${code}${char}`.slice(-TAIL_LENGTH);
    }
    if (char === "\n") line += 1;
  }
  if (run !== null) found.push({ ...run });
  return found;
}
