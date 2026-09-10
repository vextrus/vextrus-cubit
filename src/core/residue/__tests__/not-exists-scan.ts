// L-QTY-05's ban, as a scanner: which files spell `NOT EXISTS` — in SQL, at any case, or as drizzle's
// `notExists` operator. The clause allows the phrase exactly once, in the residue query, because a
// recogniser answers what it SAW and a second home for the judgement "this is absent" is the defect
// the clause exists to prevent. This is what finds one; the committed test beside it runs the scan
// over `src/core/residue/**` and over the declared corpus.
//
// It reads through the tree's one source lexer (`tests/support/source-lex`, B-17), so what is judged
// is code and only code: the phrase written in prose is a comment explaining the ban, not a spelling
// of it — which is exactly the trap the corpus's lawful half is built out of. A string literal, on
// the other hand, IS a spelling: SQL reaches the database as a string, so a scan that read only
// identifiers would be blind to every straight spelling of the phrase.
import { readFileSync } from "node:fs";
// white-box: AC-2 — the ban IS a claim about source text ("no file but the residue query spells it"),
// so the tree's one lexer is what this scanner is built out of: a spelling that never runs has no
// runtime observable, and only reading the text can find one.
import { dialectOf, scanned } from "../../../../tests/support/source-lex";

/** One finding: which file spells the phrase, on which line, and how it spelled it. */
export type NotExistsHit = { readonly file: string; readonly line: number; readonly spelling: string };

/**
 * The two ways the phrase is written in this tree. The SQL one is case-insensitive and tolerant of
 * the whitespace a wrapped statement puts between the words, because a driver reads all of them
 * alike; the operator one is drizzle's own export, spelled as an identifier and therefore exactly.
 */
const SPELLINGS = /not\s+exists|\bnotExists\b/giu;

/** The modes a phrase counts in: code, and the literals code states. Prose is not a spelling. */
const JUDGED_MODES = new Set(["code", "single", "double", "template", "regex"]);

/**
 * Every spelling of the ban in these files (L-QTY-05). The files are given rather than discovered:
 * the caller decides which tree the ban governs and which files stand outside it.
 */
export function scanNotExists(files: readonly string[]): readonly NotExistsHit[] {
  const hits: NotExistsHit[] = [];
  for (const file of files) {
    for (const hit of spellingsIn(readFileSync(file, "utf8"), dialectOf(file))) {
      hits.push({ file, line: hit.line, spelling: hit.spelling });
    }
  }
  return hits;
}

/**
 * The source masked down to what is judged — comments and rendered copy blanked, newlines kept — so
 * an index into the mask is an index into the file and a match's line is the file's own line.
 */
function judgedText(source: string, dialect: ReturnType<typeof dialectOf>): string {
  const mask = new Array<string>(source.length).fill(" ");
  for (const { index, char, mode } of scanned(source, dialect)) {
    mask[index] = char === "\n" ? "\n" : JUDGED_MODES.has(mode) ? char : " ";
  }
  return mask.join("");
}

/** Every spelling one source states, with the line it stands on. */
function spellingsIn(source: string, dialect: ReturnType<typeof dialectOf>): { line: number; spelling: string }[] {
  const judged = judgedText(source, dialect);
  const found: { line: number; spelling: string }[] = [];
  // The pattern is global, so its cursor is reset before each file rather than carried between them.
  SPELLINGS.lastIndex = 0;
  for (let match = SPELLINGS.exec(judged); match !== null; match = SPELLINGS.exec(judged)) {
    // A phrase may wrap, and the line it is FOUND on is where it begins — the line a reader would
    // strike to remove it.
    const line = judged.slice(0, match.index).split("\n").length;
    found.push({ line, spelling: match[0] });
  }
  return found;
}
