// R-TO-034's general notes, cut into the CLAUSES a reader reads them in — the state one clause is
// put to a model as, and nothing more (L-AI-03).
//
// The grammar beside this file reads a sheet ENTITY by entity, because a figure is read off a
// sentence and a sentence is what an entity carries. A general-notes MTEXT is not one sentence: it
// is a numbered block of many clauses in one entity, drawn with the font, underline and alignment
// codes an MTEXT carries, and a clause of it the grammar attributes no kind to is a clause nobody
// has read at all. This file is that second reading — additive, pure, and used only where a clause
// is put to a model: `proposeNotes` is untouched, so the committed goldens and every reading
// already made stand exactly as they stood (R-TO-034, L-MEA-01).
//
// Nothing here opens a store, asks a model or judges a clause. It answers what the sheet says, cut
// where the sheet cuts it.
import { normaliseNotation, notationLines } from "../entitygraph/notation";
import { NOTE_FIGURE, proposeNotes, type SheetText } from "./grammar";

/** A figure as a note writes one — the grammar's own pattern, never a second spelling of it (B-17). */
const FIGURE = new RegExp(NOTE_FIGURE, "g");

/**
 * A WORD: four letters together. A clause states a figure in words or it is not a clause — a table
 * cell (`8Ø`, `1000`), a bar call (`4-25Ø TOP`), a spacing (`12Ø @ 100 c/c`), a revision letter and
 * a date all state a figure and say nothing about detailing. Every detail sheet of a set is full of
 * them, and putting one to a model spends a tenant's money on a question the sheet never posed
 * (L-AI-01).
 */
const WORD = /[A-Za-z]{4}/;

/**
 * How many words a clause is. A general note is a SENTENCE about the building, and the drawing's
 * own shorthand is not: with the rule above, four is the count F-RCC6-BNBC settles on — its
 * shortest real clause is `25mm clear cover (beams)` at four, and its wordiest shorthand,
 * `12Ø @ 100 c/c`, carries four words and no word of four letters.
 *
 * Both are a COST decision made in code, tested against the fixture's own corpus sheet by sheet,
 * and cheap to move; neither is a reading of the law (I-296).
 */
const WORDS_OF_A_CLAUSE = 4;

/** The words of a clause, as a reader counts them: runs of anything that is not whitespace. */
function wordsIn(clause: string): number {
  return clause.split(/\s+/u).filter((word) => word !== "").length;
}

/** Does this clause speak of a lap at all? The grammar's own test, spelled for the Noul's subject. */
const STATES_LAP = /\bLAPS?\b/i;

/**
 * A heading of a development-length or lap table printed on a sheet: `DEVELOPMENT LENGTH ld`,
 * `ld TOP (mm)`, `LAP TENSION (mm)`. It is the table a general note may GOVERN OVER (AM-03(e),
 * T-NOTE-OVERRIDE), so what the model is told about is the table's own words and never a figure
 * read out of it.
 */
const LD_TABLE_HEADING = /\b(?:development\s+length|ld)\b/i;
const LAP_COLUMN_HEADING = /\blaps?\b[^)]*\(\s*mm\s*\)/i;

/** One clause of a sheet's notes: the entity it stands on, where in it, what it says, and its figures. */
export type NoteClause = {
  readonly sourceKey: string;
  /** Which clause of that entity this is, counting from one in the drawing's own order. */
  readonly ordinal: number;
  /** The clause verbatim, with the control and MTEXT codes resolved (L-CAD-03, T-MTEXT-CODES). */
  readonly clause: string;
  /** Every figure the clause states, as the drawing writes them — `50d`, `3500`, `75`. */
  readonly figures: readonly string[];
};

/**
 * One clause a model may be asked about, with what its answer may be USED for.
 *
 * `classifiable` is false where the grammar already read a kind off this clause's entity: L-AI-03
 * puts the deterministic reading first, so a class the model names there is recorded and never
 * offered — the clause is asked at all only because its OTHER answer, whether the lap it states
 * governs over the sheet's table, is a question the grammar has no word for (AM-03(e)).
 */
export type AskedClause = NoteClause & { readonly classifiable: boolean };

/**
 * The clauses one text carries, in the drawing's own order. A text with no paragraph mark is one
 * clause — which is what a plain TEXT entity is — and a block of them is as many clauses as the
 * draughtsman wrote paragraphs. A blank paragraph is no clause at all.
 *
 * Each clause is the text as the one reading of a drawing's words reads it (`notationLines`, B-17):
 * the MTEXT drawing codes taken away and the DXF control codes resolved in one pass, with `\P`
 * standing as the break between clauses — never resolved a second time, so a character the
 * draughtsman escaped is never read again as a code (I-458).
 */
export function clausesOf(text: string): string[] {
  return notationLines(text)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== "");
}

/** Every figure a text the notation has already read states, in the order it states them. */
function figuresOfRead(said: string): string[] {
  return [...said.matchAll(FIGURE)].map((match) => match[0]);
}

/** Every figure this clause states, as the drawing writes them, in the order it writes them. */
export function figuresIn(clause: string): string[] {
  return figuresOfRead(normaliseNotation(clause));
}

/**
 * The headings of a development-length or lap table standing on this sheet, in the artifact's own
 * order — empty where the sheet prints no such table.
 *
 * It is the Noul's context and nothing else: what is carried is the table's own HEADINGS, never a
 * figure out of its body, because the question is which of two statements governs and not what
 * either says (AM-03(e)).
 */
export function lapTableHeadingsOn(texts: readonly SheetText[]): string[] {
  const headings: string[] = [];
  for (const text of texts) {
    for (const clause of clausesOf(text.text)) {
      if (LD_TABLE_HEADING.test(clause) || LAP_COLUMN_HEADING.test(clause)) headings.push(clause);
    }
  }
  return headings;
}

/**
 * The clauses of one sheet a model is asked about, in the artifact's own order.
 *
 * THE GRAMMAR SPEAKS FIRST (L-AI-03, L-CAD-06's order as the partition keeps it for captions): a
 * clause standing on an entity the grammar read a kind off is not asked for a class at all. It is
 * asked only where the sheet also prints a lap or development-length table and the clause states a
 * lap — the one place a second statement of the same figure has to be ranked, and the one thing
 * only a reader can rank (AM-03(e)).
 *
 * A clause stating no figure is never asked: a class with no figure behind it bills nothing, and
 * the question would be a token spent on a sentence nobody could act on. A clause stating a figure
 * in no words — a table cell, a revision letter, a date — is not a clause of the notes and is not
 * asked either; it is a cost decision, made in code, tested against the fixture's own corpus, and
 * cheap to widen.
 */
export function askedClausesOf(texts: readonly SheetText[]): AskedClause[] {
  const readByGrammar = new Set(proposeNotes(texts).map((proposal) => proposal.sourceKey));
  const sheetPrintsLapTable = lapTableHeadingsOn(texts).length > 0;
  const asked: AskedClause[] = [];
  for (const text of texts) {
    let ordinal = 0;
    for (const clause of clausesOf(text.text)) {
      ordinal += 1;
      const figures = figuresOfRead(clause);
      if (figures.length === 0 || !WORD.test(clause) || wordsIn(clause) < WORDS_OF_A_CLAUSE) continue;
      const classifiable = !readByGrammar.has(text.sourceKey);
      if (!classifiable && !(sheetPrintsLapTable && STATES_LAP.test(clause))) continue;
      asked.push({ sourceKey: text.sourceKey, ordinal, clause, figures, classifiable });
    }
  }
  return asked;
}
